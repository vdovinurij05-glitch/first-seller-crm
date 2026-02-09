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

// GET /api/pnl/employees - список сотрудников
export async function GET(request: NextRequest) {
  const admin = await getAdminUser(request)
  if (!admin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { searchParams } = new URL(request.url)
  const businessUnitId = searchParams.get('businessUnitId')

  const where: Record<string, unknown> = { isActive: true }
  if (businessUnitId) where.businessUnitId = businessUnitId

  const employees = await prisma.employee.findMany({
    where,
    include: { businessUnit: true },
    orderBy: [{ businessUnitId: 'asc' }, { name: 'asc' }]
  })

  return NextResponse.json(employees)
}

// POST /api/pnl/employees - создать сотрудника
export async function POST(request: NextRequest) {
  const admin = await getAdminUser(request)
  if (!admin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await request.json()
  const { name, position, officialSalary, unofficialSalary, businessUnitId } = body

  if (!name) {
    return NextResponse.json({ error: 'Name is required' }, { status: 400 })
  }

  const employee = await prisma.employee.create({
    data: {
      name,
      position: position || null,
      officialSalary: parseFloat(officialSalary) || 0,
      unofficialSalary: parseFloat(unofficialSalary) || 0,
      businessUnitId: businessUnitId || null,
    },
    include: { businessUnit: true }
  })

  return NextResponse.json(employee, { status: 201 })
}
