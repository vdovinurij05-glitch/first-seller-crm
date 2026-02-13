import { NextRequest, NextResponse } from 'next/server'
import jwt from 'jsonwebtoken'
import prisma from '@/lib/prisma'

async function getAdminUser(request: NextRequest) {
  const token = request.cookies.get('token')?.value
  if (!token) return null
  try {
    const decoded = jwt.verify(
      token,
      process.env.NEXTAUTH_SECRET || process.env.JWT_SECRET || 'secret'
    ) as { id: string; role: string }
    if (decoded.role !== 'ADMIN') return null
    return decoded
  } catch {
    return null
  }
}

// GET /api/pnl/salary-payments?month=2026-02 - выплаты за месяц
export async function GET(request: NextRequest) {
  const admin = await getAdminUser(request)
  if (!admin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { searchParams } = new URL(request.url)
  const month = searchParams.get('month') // 2026-02

  const where: Record<string, unknown> = {}
  if (month) {
    const start = new Date(`${month}-01`)
    const end = new Date(start)
    end.setMonth(end.getMonth() + 1)
    where.date = { gte: start, lt: end }
  }

  const payments = await prisma.salaryPayment.findMany({
    where,
    include: { employee: true },
    orderBy: { date: 'asc' }
  })

  return NextResponse.json(payments)
}

// POST /api/pnl/salary-payments - создать выплату
export async function POST(request: NextRequest) {
  const admin = await getAdminUser(request)
  if (!admin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await request.json()
  const { employeeId, amount, salaryType, date, isPaid, comment } = body

  if (!employeeId || !amount || !salaryType || !date) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  const payment = await prisma.salaryPayment.create({
    data: {
      employeeId,
      amount: parseFloat(amount),
      salaryType, // "OFFICIAL" | "UNOFFICIAL"
      date: new Date(date),
      isPaid: isPaid ?? false,
      comment: comment || null,
    },
    include: { employee: true }
  })

  return NextResponse.json(payment, { status: 201 })
}

// PUT /api/pnl/salary-payments - генерация выплат на месяц
export async function PUT(request: NextRequest) {
  const admin = await getAdminUser(request)
  if (!admin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await request.json()
  const { month } = body // "2026-02"

  if (!month) {
    return NextResponse.json({ error: 'Month is required' }, { status: 400 })
  }

  const employees = await prisma.employee.findMany({ where: { isActive: true } })
  const year = parseInt(month.split('-')[0])
  const mon = parseInt(month.split('-')[1])

  // Проверяем, есть ли уже выплаты за этот месяц
  const start = new Date(`${month}-01`)
  const end = new Date(start)
  end.setMonth(end.getMonth() + 1)

  const existing = await prisma.salaryPayment.count({
    where: { date: { gte: start, lt: end } }
  })

  if (existing > 0) {
    return NextResponse.json({ error: 'Payments already generated for this month' }, { status: 400 })
  }

  const payments = []

  for (const emp of employees) {
    // Официальная ЗП: 10-е число (~50%) и 25-е число (~50%)
    if (emp.officialSalary > 0) {
      const half = Math.round(emp.officialSalary / 2)
      payments.push({
        employeeId: emp.id,
        amount: half,
        salaryType: 'OFFICIAL',
        date: new Date(year, mon - 1, 10),
        isPaid: false,
        comment: 'Аванс (белая)',
      })
      payments.push({
        employeeId: emp.id,
        amount: emp.officialSalary - half,
        salaryType: 'OFFICIAL',
        date: new Date(year, mon - 1, 25),
        isPaid: false,
        comment: 'Остаток (белая)',
      })
    }

    // Неофициальная ЗП: тоже 50/50 — 10-е и 25-е число
    if (emp.unofficialSalary > 0) {
      const halfU = Math.round(emp.unofficialSalary / 2)
      payments.push({
        employeeId: emp.id,
        amount: halfU,
        salaryType: 'UNOFFICIAL',
        date: new Date(year, mon - 1, 10),
        isPaid: false,
        comment: 'Аванс (чёрная)',
      })
      payments.push({
        employeeId: emp.id,
        amount: emp.unofficialSalary - halfU,
        salaryType: 'UNOFFICIAL',
        date: new Date(year, mon - 1, 25),
        isPaid: false,
        comment: 'Остаток (чёрная)',
      })
    }
  }

  // Создаём SalaryPayment записи по одной чтобы получить id для связи
  const createdPayments = []
  for (const p of payments) {
    const sp = await prisma.salaryPayment.create({
      data: p,
      include: { employee: true }
    })
    createdPayments.push(sp)
  }

  // Находим категорию ЗП для FinanceRecord
  const salaryCat = await prisma.financeCategory.findFirst({
    where: { group: 'SALARY', type: 'EXPENSE' }
  })

  // Создаём FinanceRecord для каждого платежа (для отображения в календаре)
  if (salaryCat) {
    for (const sp of createdPayments) {
      const typeLabel = sp.salaryType === 'OFFICIAL' ? 'белая' : 'чёрная'
      await prisma.financeRecord.create({
        data: {
          type: 'EXPENSE',
          amount: sp.amount,
          date: sp.date,
          dueDate: sp.date,
          description: `ЗП ${sp.employee.name} — ${sp.comment || typeLabel}`,
          categoryId: salaryCat.id,
          businessUnitId: sp.employee.businessUnitId || undefined,
          isPaid: sp.isPaid,
          salaryPaymentId: sp.id,
          source: 'MANUAL'
        }
      })
    }
  }

  return NextResponse.json({ generated: createdPayments.length })
}
