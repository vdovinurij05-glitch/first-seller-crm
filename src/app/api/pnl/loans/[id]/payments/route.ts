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

// GET /api/pnl/loans/[id]/payments
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await getAdminUser(request)
  if (!admin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { id } = await params

  const payments = await prisma.loanPayment.findMany({
    where: { loanId: id },
    orderBy: { date: 'asc' }
  })

  return NextResponse.json({ payments })
}

// POST /api/pnl/loans/[id]/payments
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await getAdminUser(request)
  if (!admin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { id } = await params
  const body = await request.json()
  const { amount, date, principalPart, interestPart, isPaid, comment } = body

  if (!amount || !date) {
    return NextResponse.json({ error: 'amount and date are required' }, { status: 400 })
  }

  const payment = await prisma.loanPayment.create({
    data: {
      loanId: id,
      amount: parseFloat(amount),
      principalPart: principalPart ? parseFloat(principalPart) : null,
      interestPart: interestPart ? parseFloat(interestPart) : null,
      date: new Date(date),
      isPaid: isPaid === true,
      paidAt: isPaid === true ? new Date() : null,
      comment: comment || null
    }
  })

  return NextResponse.json({ payment }, { status: 201 })
}
