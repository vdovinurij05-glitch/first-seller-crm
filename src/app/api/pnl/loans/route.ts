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
        orderBy: { date: 'desc' },
        take: 12
      }
    },
    orderBy: { paymentDay: 'asc' }
  })

  // Считаем сводку
  const totalMonthly = loans.filter(l => l.isActive).reduce((s, l) => s + l.monthlyPayment, 0)
  const totalRemaining = loans.filter(l => l.isActive).reduce((s, l) => s + l.remainingAmount, 0)
  const totalDebt = loans.filter(l => l.isActive).reduce((s, l) => s + l.totalAmount, 0)

  return NextResponse.json({
    loans,
    summary: { totalMonthly, totalRemaining, totalDebt, activeCount: loans.filter(l => l.isActive).length }
  })
}

// POST /api/pnl/loans - создать займ
export async function POST(request: NextRequest) {
  const admin = await getAdminUser(request)
  if (!admin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await request.json()
  const { name, loanType, totalAmount, remainingAmount, monthlyPayment, interestRate, paymentDay, startDate, endDate, creditor } = body

  if (!name || !loanType || !totalAmount || !monthlyPayment || !startDate) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  const loan = await prisma.loan.create({
    data: {
      name,
      loanType,
      totalAmount: parseFloat(totalAmount),
      remainingAmount: parseFloat(remainingAmount || totalAmount),
      monthlyPayment: parseFloat(monthlyPayment),
      interestRate: interestRate ? parseFloat(interestRate) : null,
      paymentDay: parseInt(paymentDay) || 1,
      startDate: new Date(startDate),
      endDate: endDate ? new Date(endDate) : null,
      creditor: creditor || null,
    }
  })

  return NextResponse.json(loan, { status: 201 })
}
