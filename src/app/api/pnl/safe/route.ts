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

// GET /api/pnl/safe - получить настройки сейфа и текущий баланс
export async function GET(request: NextRequest) {
  const admin = await getAdminUser(request)
  if (!admin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const settings = await prisma.safeSettings.findFirst()

  if (!settings) {
    return NextResponse.json({
      settings: null,
      safeBalance: 0,
      totalSafeExpenses: 0
    })
  }

  const safeExpenses = await prisma.financeRecord.aggregate({
    where: {
      fromSafe: true,
      type: 'EXPENSE',
      date: { gte: settings.effectiveDate }
    },
    _sum: { amount: true }
  })

  const totalSafeExpenses = safeExpenses._sum.amount || 0
  const safeBalance = settings.initialBalance - totalSafeExpenses

  return NextResponse.json({
    settings,
    safeBalance,
    totalSafeExpenses
  })
}

// POST /api/pnl/safe - создать/обновить настройки сейфа
export async function POST(request: NextRequest) {
  const admin = await getAdminUser(request)
  if (!admin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await request.json()
  const { initialBalance, effectiveDate } = body

  if (initialBalance === undefined || !effectiveDate) {
    return NextResponse.json(
      { error: 'initialBalance and effectiveDate are required' },
      { status: 400 }
    )
  }

  const existing = await prisma.safeSettings.findFirst()

  let settings
  if (existing) {
    settings = await prisma.safeSettings.update({
      where: { id: existing.id },
      data: {
        initialBalance: parseFloat(initialBalance),
        effectiveDate: new Date(effectiveDate)
      }
    })
  } else {
    settings = await prisma.safeSettings.create({
      data: {
        initialBalance: parseFloat(initialBalance),
        effectiveDate: new Date(effectiveDate)
      }
    })
  }

  const safeExpenses = await prisma.financeRecord.aggregate({
    where: {
      fromSafe: true,
      type: 'EXPENSE',
      date: { gte: settings.effectiveDate }
    },
    _sum: { amount: true }
  })

  const totalSafeExpenses = safeExpenses._sum.amount || 0
  const safeBalance = settings.initialBalance - totalSafeExpenses

  return NextResponse.json({ settings, safeBalance, totalSafeExpenses })
}
