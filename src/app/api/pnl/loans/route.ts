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

// GET /api/pnl/loans - список займов
export async function GET(request: NextRequest) {
  const admin = await getAdminUser(request)
  if (!admin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { searchParams } = new URL(request.url)
  const activeOnly = searchParams.get('active') !== 'false'

  const loans = await prisma.loan.findMany({
    where: activeOnly ? { isActive: true } : undefined,
    include: {
      payments: {
        orderBy: { date: 'asc' }
      }
    },
    orderBy: { paymentDay: 'asc' }
  })

  const now = new Date()

  // Считаем сводку
  const activeLoans = loans.filter(l => l.isActive)
  const totalMonthly = activeLoans.reduce((s, l) => s + l.monthlyPayment, 0)
  const totalRemaining = activeLoans.reduce((s, l) => s + l.remainingAmount, 0)
  const totalDebt = activeLoans.reduce((s, l) => s + l.totalAmount, 0)

  // Просроченные платежи
  let overdueCount = 0
  let overdueAmount = 0
  let nextPaymentDate: string | null = null
  let nextPaymentMinDate: Date | null = null

  for (const loan of activeLoans) {
    for (const p of loan.payments) {
      if (!p.isPaid && new Date(p.date) < now) {
        overdueCount++
        overdueAmount += p.amount
      }
      if (!p.isPaid && new Date(p.date) >= now) {
        if (!nextPaymentMinDate || new Date(p.date) < nextPaymentMinDate) {
          nextPaymentMinDate = new Date(p.date)
        }
      }
    }
  }

  if (nextPaymentMinDate) {
    nextPaymentDate = nextPaymentMinDate.toISOString()
  }

  return NextResponse.json({
    loans,
    summary: {
      totalMonthly,
      totalRemaining,
      totalDebt,
      activeCount: activeLoans.length,
      overdueCount,
      overdueAmount,
      nextPaymentDate
    }
  })
}

// POST /api/pnl/loans - создать займ
export async function POST(request: NextRequest) {
  const admin = await getAdminUser(request)
  if (!admin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await request.json()
  const { name, loanType, scheduleType, totalAmount, remainingAmount, monthlyPayment, interestRate, totalMonths, paymentDay, startDate, endDate, creditor } = body

  if (!name || !loanType || !totalAmount || !startDate) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  const loan = await prisma.loan.create({
    data: {
      name,
      loanType,
      scheduleType: scheduleType || 'MANUAL',
      totalAmount: parseFloat(totalAmount),
      remainingAmount: parseFloat(remainingAmount || totalAmount),
      monthlyPayment: parseFloat(monthlyPayment || '0'),
      interestRate: interestRate ? parseFloat(interestRate) : null,
      totalMonths: totalMonths ? parseInt(totalMonths) : null,
      paymentDay: parseInt(paymentDay) || 1,
      startDate: new Date(startDate),
      endDate: endDate ? new Date(endDate) : null,
      creditor: creditor || null,
    },
    include: { payments: true }
  })

  return NextResponse.json(loan, { status: 201 })
}
