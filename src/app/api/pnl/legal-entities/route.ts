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

// GET /api/pnl/legal-entities - список юрлиц с балансами
export async function GET(request: NextRequest) {
  const admin = await getAdminUser(request)
  if (!admin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const entities = await prisma.legalEntity.findMany({
    include: { businessUnit: true },
    orderBy: [{ businessUnitId: 'asc' }, { order: 'asc' }]
  })

  // Считаем баланс сейфа для каждого юрлица
  const result = await Promise.all(entities.map(async (le) => {
    const safeExpenses = await prisma.financeRecord.aggregate({
      where: {
        legalEntityId: le.id,
        fromSafe: true,
        type: 'EXPENSE',
        date: { gte: le.effectiveDate }
      },
      _sum: { amount: true }
    })
    const safeBalance = le.initialBalance - (safeExpenses._sum.amount || 0)
    return { ...le, safeBalance }
  }))

  return NextResponse.json({ legalEntities: result })
}

// POST /api/pnl/legal-entities - создать юрлицо
export async function POST(request: NextRequest) {
  const admin = await getAdminUser(request)
  if (!admin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await request.json()
  const { name, businessUnitId, initialBalance, effectiveDate } = body

  if (!name || !businessUnitId) {
    return NextResponse.json({ error: 'name and businessUnitId are required' }, { status: 400 })
  }

  const entity = await prisma.legalEntity.create({
    data: {
      name,
      businessUnitId,
      initialBalance: parseFloat(initialBalance) || 0,
      effectiveDate: effectiveDate ? new Date(effectiveDate) : new Date(new Date().getFullYear(), 0, 1)
    },
    include: { businessUnit: true }
  })

  return NextResponse.json({ legalEntity: entity }, { status: 201 })
}
