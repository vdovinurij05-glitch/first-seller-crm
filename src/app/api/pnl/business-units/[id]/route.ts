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

// DELETE /api/pnl/business-units/[id] - удалить направление
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
    // Отвязываем сотрудников от этого направления
    await prisma.employee.updateMany({
      where: { businessUnitId: id },
      data: { businessUnitId: null }
    })

    // Отвязываем финансовые записи от этого направления
    await prisma.financeRecord.updateMany({
      where: { businessUnitId: id },
      data: { businessUnitId: null }
    })

    await prisma.businessUnit.delete({
      where: { id }
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting business unit:', error)
    return NextResponse.json({ error: 'Failed to delete business unit' }, { status: 500 })
  }
}
