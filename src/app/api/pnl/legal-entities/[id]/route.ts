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

// PUT /api/pnl/legal-entities/[id] - обновить юрлицо
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

  const entity = await prisma.legalEntity.update({
    where: { id },
    data: {
      ...(body.name !== undefined && { name: body.name }),
      ...(body.initialBalance !== undefined && { initialBalance: parseFloat(body.initialBalance) }),
      ...(body.effectiveDate !== undefined && { effectiveDate: new Date(body.effectiveDate) }),
    },
    include: { businessUnit: true }
  })

  return NextResponse.json({ legalEntity: entity })
}

// DELETE /api/pnl/legal-entities/[id] - удалить юрлицо
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await getAdminUser(request)
  if (!admin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { id } = await params

  try {
    // Отвязываем записи
    await prisma.financeRecord.updateMany({
      where: { legalEntityId: id },
      data: { legalEntityId: null }
    })

    await prisma.legalEntity.delete({ where: { id } })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting legal entity:', error)
    return NextResponse.json({ error: 'Failed to delete' }, { status: 500 })
  }
}
