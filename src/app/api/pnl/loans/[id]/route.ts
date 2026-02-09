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

// PUT /api/pnl/loans/[id] - обновить займ
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await getAdminUser(request)
  if (!admin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { id } = await params
  const body = await request.json()

  const data: Record<string, unknown> = {}
  if (body.name !== undefined) data.name = body.name
  if (body.loanType !== undefined) data.loanType = body.loanType
  if (body.totalAmount !== undefined) data.totalAmount = parseFloat(body.totalAmount)
  if (body.remainingAmount !== undefined) data.remainingAmount = parseFloat(body.remainingAmount)
  if (body.monthlyPayment !== undefined) data.monthlyPayment = parseFloat(body.monthlyPayment)
  if (body.interestRate !== undefined) data.interestRate = body.interestRate ? parseFloat(body.interestRate) : null
  if (body.paymentDay !== undefined) data.paymentDay = parseInt(body.paymentDay)
  if (body.startDate !== undefined) data.startDate = new Date(body.startDate)
  if (body.endDate !== undefined) data.endDate = body.endDate ? new Date(body.endDate) : null
  if (body.creditor !== undefined) data.creditor = body.creditor
  if (body.isActive !== undefined) data.isActive = body.isActive

  const loan = await prisma.loan.update({ where: { id }, data })

  return NextResponse.json(loan)
}

// DELETE /api/pnl/loans/[id]
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await getAdminUser(request)
  if (!admin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { id } = await params
  await prisma.loan.delete({ where: { id } })

  return NextResponse.json({ success: true })
}
