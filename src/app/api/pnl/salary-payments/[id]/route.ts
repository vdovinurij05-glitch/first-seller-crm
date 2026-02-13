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

// PUT /api/pnl/salary-payments/[id] - обновить выплату (факт сумма, оплачено)
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

  const payment = await prisma.salaryPayment.update({
    where: { id },
    data: {
      ...(body.amount !== undefined && { amount: parseFloat(body.amount) }),
      ...(body.isPaid !== undefined && { isPaid: body.isPaid }),
      ...(body.comment !== undefined && { comment: body.comment }),
      ...(body.date !== undefined && { date: new Date(body.date) }),
    },
    include: { employee: true }
  })

  // Синхронизировать isPaid/amount в FinanceRecord (PnL календарь)
  const frData: Record<string, unknown> = {}
  if (body.isPaid !== undefined) frData.isPaid = body.isPaid
  if (body.amount !== undefined) frData.amount = parseFloat(body.amount)
  if (Object.keys(frData).length > 0) {
    await prisma.financeRecord.updateMany({
      where: { salaryPaymentId: id },
      data: frData
    })
  }

  return NextResponse.json(payment)
}

// DELETE /api/pnl/salary-payments/[id]
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await getAdminUser(request)
  if (!admin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { id } = await params
  // Удаляем связанную запись из PnL календаря
  await prisma.financeRecord.deleteMany({ where: { salaryPaymentId: id } })
  await prisma.salaryPayment.delete({ where: { id } })

  return NextResponse.json({ success: true })
}
