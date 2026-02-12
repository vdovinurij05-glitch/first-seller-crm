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

// POST /api/pnl/loans/[id]/generate-schedule
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await getAdminUser(request)
  if (!admin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { id } = await params
  const loan = await prisma.loan.findUnique({ where: { id } })
  if (!loan) {
    return NextResponse.json({ error: 'Loan not found' }, { status: 404 })
  }

  if (loan.scheduleType === 'MANUAL') {
    return NextResponse.json({ error: 'Manual loans do not support auto-generation' }, { status: 400 })
  }

  if (!loan.interestRate || !loan.totalMonths) {
    return NextResponse.json({ error: 'interestRate and totalMonths are required for auto-generation' }, { status: 400 })
  }

  // Удаляем существующие неоплаченные платежи
  await prisma.loanPayment.deleteMany({
    where: { loanId: id, isPaid: false }
  })

  const principal = loan.totalAmount
  const monthlyRate = loan.interestRate / 100 / 12
  const n = loan.totalMonths
  const payments: { amount: number; principalPart: number; interestPart: number; date: Date }[] = []

  if (loan.scheduleType === 'ANNUITY') {
    // M = P * [r(1+r)^n] / [(1+r)^n - 1]
    const monthlyPayment = monthlyRate > 0
      ? principal * (monthlyRate * Math.pow(1 + monthlyRate, n)) / (Math.pow(1 + monthlyRate, n) - 1)
      : principal / n
    let remaining = principal

    for (let i = 0; i < n; i++) {
      const interestPart = remaining * monthlyRate
      const principalPart = monthlyPayment - interestPart
      remaining -= principalPart

      const date = new Date(loan.startDate)
      date.setMonth(date.getMonth() + i + 1)
      date.setDate(loan.paymentDay)

      payments.push({
        amount: Math.round(monthlyPayment * 100) / 100,
        principalPart: Math.round(principalPart * 100) / 100,
        interestPart: Math.round(interestPart * 100) / 100,
        date
      })
    }
  } else if (loan.scheduleType === 'DIFFERENTIATED') {
    const principalPerMonth = principal / n
    let remaining = principal

    for (let i = 0; i < n; i++) {
      const interestPart = remaining * monthlyRate
      const amount = principalPerMonth + interestPart
      remaining -= principalPerMonth

      const date = new Date(loan.startDate)
      date.setMonth(date.getMonth() + i + 1)
      date.setDate(loan.paymentDay)

      payments.push({
        amount: Math.round(amount * 100) / 100,
        principalPart: Math.round(principalPerMonth * 100) / 100,
        interestPart: Math.round(interestPart * 100) / 100,
        date
      })
    }
  } else if (loan.scheduleType === 'INTEREST_ONLY') {
    const monthlyInterest = principal * monthlyRate

    for (let i = 0; i < n; i++) {
      const isLast = i === n - 1
      const date = new Date(loan.startDate)
      date.setMonth(date.getMonth() + i + 1)
      date.setDate(loan.paymentDay)

      payments.push({
        amount: Math.round((monthlyInterest + (isLast ? principal : 0)) * 100) / 100,
        principalPart: isLast ? principal : 0,
        interestPart: Math.round(monthlyInterest * 100) / 100,
        date
      })
    }
  }

  // Создаём платежи
  const created = await prisma.$transaction(
    payments.map((p) =>
      prisma.loanPayment.create({
        data: {
          loanId: id,
          amount: p.amount,
          principalPart: p.principalPart,
          interestPart: p.interestPart,
          date: p.date,
          isPaid: false
        }
      })
    )
  )

  // Обновляем monthlyPayment на первый платёж из графика
  if (payments.length > 0) {
    await prisma.loan.update({
      where: { id },
      data: {
        monthlyPayment: payments[0].amount,
        endDate: payments[payments.length - 1].date
      }
    })
  }

  return NextResponse.json({ count: created.length, payments: created })
}
