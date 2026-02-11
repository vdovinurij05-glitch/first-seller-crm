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

function getNextMonth10th(month: string): Date {
  const year = parseInt(month.split('-')[0])
  const mon = parseInt(month.split('-')[1])
  // 10-е число следующего месяца
  if (mon === 12) {
    return new Date(year + 1, 0, 10) // январь следующего года
  }
  return new Date(year, mon, 10) // mon уже 1-based, Date принимает 0-based → это следующий месяц
}

// GET /api/pnl/commissions?month=2026-02 — расчёт комиссий за месяц
export async function GET(request: NextRequest) {
  const admin = await getAdminUser(request)
  if (!admin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { searchParams } = new URL(request.url)
  const month = searchParams.get('month') // "2026-02"

  if (!month) {
    return NextResponse.json({ error: 'Month is required' }, { status: 400 })
  }

  const start = new Date(`${month}-01`)
  const end = new Date(start)
  end.setMonth(end.getMonth() + 1)

  // Все INCOME записи с менеджером за этот месяц
  const records = await prisma.financeRecord.findMany({
    where: {
      type: 'INCOME',
      salesManagerId: { not: null },
      date: { gte: start, lt: end },
    },
    include: { salesManager: true },
  })

  // Группировка по менеджеру
  const managerMap = new Map<string, { employee: typeof records[0]['salesManager'], totalSales: number }>()

  for (const r of records) {
    if (!r.salesManagerId || !r.salesManager) continue
    const existing = managerMap.get(r.salesManagerId)
    if (existing) {
      existing.totalSales += r.amount
    } else {
      managerMap.set(r.salesManagerId, {
        employee: r.salesManager,
        totalSales: r.amount,
      })
    }
  }

  // Проверяем, сгенерированы ли уже комиссии (SalaryPayment типа COMMISSION на 10-е след. месяца)
  const payoutDate = getNextMonth10th(month)
  const payoutStart = new Date(payoutDate)
  payoutStart.setHours(0, 0, 0, 0)
  const payoutEnd = new Date(payoutDate)
  payoutEnd.setHours(23, 59, 59, 999)

  const existingCommissions = await prisma.salaryPayment.findMany({
    where: {
      salaryType: 'COMMISSION',
      date: { gte: payoutStart, lte: payoutEnd },
    },
  })

  const generatedIds = new Set(existingCommissions.map(c => c.employeeId))

  // Формируем ответ
  const commissions = Array.from(managerMap.values()).map(({ employee, totalSales }) => ({
    employee,
    totalSales,
    commissionPercent: employee!.salesCommissionPercent,
    commissionAmount: Math.round(totalSales * employee!.salesCommissionPercent / 100),
    isGenerated: generatedIds.has(employee!.id),
  }))

  return NextResponse.json({ commissions })
}

// POST /api/pnl/commissions — сгенерировать выплаты комиссий
export async function POST(request: NextRequest) {
  const admin = await getAdminUser(request)
  if (!admin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await request.json()
  const { month } = body // "2026-02"

  if (!month) {
    return NextResponse.json({ error: 'Month is required' }, { status: 400 })
  }

  const start = new Date(`${month}-01`)
  const end = new Date(start)
  end.setMonth(end.getMonth() + 1)

  // Все INCOME записи с менеджером за этот месяц
  const records = await prisma.financeRecord.findMany({
    where: {
      type: 'INCOME',
      salesManagerId: { not: null },
      date: { gte: start, lt: end },
    },
    include: { salesManager: true },
  })

  // Группировка по менеджеру
  const managerMap = new Map<string, { employee: typeof records[0]['salesManager'], totalSales: number }>()

  for (const r of records) {
    if (!r.salesManagerId || !r.salesManager) continue
    const existing = managerMap.get(r.salesManagerId)
    if (existing) {
      existing.totalSales += r.amount
    } else {
      managerMap.set(r.salesManagerId, {
        employee: r.salesManager,
        totalSales: r.amount,
      })
    }
  }

  const payoutDate = getNextMonth10th(month)
  const payoutStart = new Date(payoutDate)
  payoutStart.setHours(0, 0, 0, 0)
  const payoutEnd = new Date(payoutDate)
  payoutEnd.setHours(23, 59, 59, 999)

  // Проверяем существующие
  const existingCommissions = await prisma.salaryPayment.findMany({
    where: {
      salaryType: 'COMMISSION',
      date: { gte: payoutStart, lte: payoutEnd },
    },
  })
  const generatedIds = new Set(existingCommissions.map(c => c.employeeId))

  // Название месяца для комментария
  const monthNames = ['январь', 'февраль', 'март', 'апрель', 'май', 'июнь', 'июль', 'август', 'сентябрь', 'октябрь', 'ноябрь', 'декабрь']
  const monthIdx = parseInt(month.split('-')[1]) - 1
  const monthName = monthNames[monthIdx]

  const paymentsToCreate = []

  for (const [managerId, { employee, totalSales }] of managerMap) {
    if (generatedIds.has(managerId)) continue // уже сгенерировано
    const percent = employee!.salesCommissionPercent
    if (percent <= 0) continue

    const commissionAmount = Math.round(totalSales * percent / 100)
    if (commissionAmount <= 0) continue

    const formatMoney = (v: number) => v.toLocaleString('ru-RU')

    paymentsToCreate.push({
      employeeId: managerId,
      amount: commissionAmount,
      salaryType: 'COMMISSION',
      date: payoutDate,
      isPaid: false,
      comment: `Комиссия за ${monthName}: ${percent}% от ${formatMoney(totalSales)}₽`,
    })
  }

  if (paymentsToCreate.length === 0) {
    return NextResponse.json({ generated: 0, message: 'Нет новых комиссий для генерации' })
  }

  const created = await prisma.salaryPayment.createMany({ data: paymentsToCreate })

  return NextResponse.json({ generated: created.count })
}
