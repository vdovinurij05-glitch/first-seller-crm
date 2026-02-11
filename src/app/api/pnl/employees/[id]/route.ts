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

// PUT /api/pnl/employees/[id] - обновить сотрудника
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

  const employee = await prisma.employee.update({
    where: { id },
    data: {
      ...(body.name !== undefined && { name: body.name }),
      ...(body.position !== undefined && { position: body.position }),
      ...(body.officialSalary !== undefined && { officialSalary: parseFloat(body.officialSalary) || 0 }),
      ...(body.unofficialSalary !== undefined && { unofficialSalary: parseFloat(body.unofficialSalary) || 0 }),
      ...(body.isActive !== undefined && { isActive: body.isActive }),
      ...(body.salesCommissionPercent !== undefined && { salesCommissionPercent: parseFloat(body.salesCommissionPercent) || 0 }),
      ...(body.businessUnitId !== undefined && { businessUnitId: body.businessUnitId || null }),
    },
    include: { businessUnit: true }
  })

  return NextResponse.json(employee)
}

// DELETE /api/pnl/employees/[id] - удалить сотрудника
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await getAdminUser(request)
  if (!admin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { id } = await params

  await prisma.employee.delete({ where: { id } })

  return NextResponse.json({ success: true })
}
