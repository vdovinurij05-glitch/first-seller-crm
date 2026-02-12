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

// GET /api/pnl - список записей с фильтрами
export async function GET(request: NextRequest) {
  const admin = await getAdminUser(request)
  if (!admin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { searchParams } = new URL(request.url)
  const from = searchParams.get('from')
  const to = searchParams.get('to')
  const type = searchParams.get('type') // INCOME | EXPENSE
  const categoryId = searchParams.get('categoryId')
  const businessUnitId = searchParams.get('businessUnitId')
  const legalEntityId = searchParams.get('legalEntityId')
  const paidByFounder = searchParams.get('paidByFounder')
  const isPaid = searchParams.get('isPaid')

  const where: any = {}
  if (from || to) {
    where.date = {}
    if (from) where.date.gte = new Date(from)
    if (to) where.date.lte = new Date(to)
  }
  if (type) where.type = type
  if (categoryId) where.categoryId = categoryId
  if (businessUnitId) where.businessUnitId = businessUnitId
  if (legalEntityId) where.legalEntityId = legalEntityId
  if (paidByFounder) where.paidByFounder = paidByFounder
  if (isPaid !== null && isPaid !== undefined && isPaid !== '') {
    where.isPaid = isPaid === 'true'
  }

  const records = await prisma.financeRecord.findMany({
    where,
    include: {
      category: true,
      businessUnit: true,
      legalEntity: true,
      salesManager: true
    },
    orderBy: { date: 'desc' }
  })

  return NextResponse.json({ records })
}

// POST /api/pnl - создать запись
export async function POST(request: NextRequest) {
  const admin = await getAdminUser(request)
  if (!admin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await request.json()
  const { amount, type, description, date, dueDate, isPaid, categoryId, businessUnitId, counterparty, debtType, client, salesManagerId } = body

  if (!amount || !type || !categoryId || !date) {
    return NextResponse.json({ error: 'amount, type, categoryId, date are required' }, { status: 400 })
  }

  const record = await prisma.financeRecord.create({
    data: {
      amount: parseFloat(amount),
      type,
      description: description || null,
      date: new Date(date),
      dueDate: dueDate ? new Date(dueDate) : null,
      isPaid: isPaid !== false,
      counterparty: counterparty || null,
      debtType: debtType || null,
      client: client || null,
      salesManagerId: salesManagerId || null,
      fromSafe: type === 'EXPENSE' ? (body.fromSafe === true) : false,
      paidByFounder: body.paidByFounder || null,
      founderRepayment: body.founderRepayment || null,
      categoryId,
      businessUnitId: businessUnitId || null,
      legalEntityId: body.legalEntityId || null,
      userId: admin.id,
      source: 'MANUAL'
    },
    include: {
      category: true,
      businessUnit: true,
      legalEntity: true,
      salesManager: true
    }
  })

  return NextResponse.json({ record }, { status: 201 })
}
