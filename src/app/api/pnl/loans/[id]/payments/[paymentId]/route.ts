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

// PUT /api/pnl/loans/[id]/payments/[paymentId]
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; paymentId: string }> }
) {
  const admin = await getAdminUser(request)
  if (!admin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { paymentId } = await params
  const body = await request.json()

  const data: Record<string, unknown> = {}
  if (body.amount !== undefined) data.amount = parseFloat(body.amount)
  if (body.principalPart !== undefined) data.principalPart = body.principalPart ? parseFloat(body.principalPart) : null
  if (body.interestPart !== undefined) data.interestPart = body.interestPart ? parseFloat(body.interestPart) : null
  if (body.date !== undefined) data.date = new Date(body.date)
  if (body.isPaid !== undefined) {
    data.isPaid = body.isPaid
    data.paidAt = body.isPaid ? (body.paidAt ? new Date(body.paidAt) : new Date()) : null
  }
  if (body.comment !== undefined) data.comment = body.comment || null

  const payment = await prisma.loanPayment.update({
    where: { id: paymentId },
    data
  })

  // Синхронизировать isPaid в FinanceRecord (PnL календарь)
  if (body.isPaid !== undefined) {
    const { id: loanId } = await params
    // Находим FinanceRecord по loanId и дате платежа
    const fr = await prisma.financeRecord.findFirst({
      where: {
        loanId,
        amount: payment.amount,
        date: payment.date
      }
    })
    if (fr) {
      await prisma.financeRecord.update({
        where: { id: fr.id },
        data: { isPaid: body.isPaid }
      })
    }
  }

  return NextResponse.json({ payment })
}

// DELETE /api/pnl/loans/[id]/payments/[paymentId]
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; paymentId: string }> }
) {
  const admin = await getAdminUser(request)
  if (!admin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { paymentId } = await params
  await prisma.loanPayment.delete({ where: { id: paymentId } })

  return NextResponse.json({ success: true })
}
