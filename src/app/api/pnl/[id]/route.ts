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

// PUT /api/pnl/[id] - обновить запись
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
  const { amount, type, description, date, dueDate, isPaid, categoryId, businessUnitId, counterparty, debtType } = body

  const record = await prisma.financeRecord.update({
    where: { id },
    data: {
      ...(amount !== undefined && { amount: parseFloat(amount) }),
      ...(type && { type }),
      ...(description !== undefined && { description }),
      ...(date && { date: new Date(date) }),
      ...(dueDate !== undefined && { dueDate: dueDate ? new Date(dueDate) : null }),
      ...(isPaid !== undefined && { isPaid }),
      ...(counterparty !== undefined && { counterparty: counterparty || null }),
      ...(debtType !== undefined && { debtType: debtType || null }),
      ...(categoryId && { categoryId }),
      ...(businessUnitId !== undefined && { businessUnitId: businessUnitId || null }),
    },
    include: {
      category: true,
      businessUnit: true
    }
  })

  return NextResponse.json({ record })
}

// DELETE /api/pnl/[id] - удалить запись
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await getAdminUser(request)
  if (!admin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { id } = await params

  await prisma.financeRecord.delete({
    where: { id }
  })

  return NextResponse.json({ success: true })
}
