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

// GET /api/pnl/summary - сводка P&L за период
export async function GET(request: NextRequest) {
  const admin = await getAdminUser(request)
  if (!admin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { searchParams } = new URL(request.url)
  const from = searchParams.get('from')
  const to = searchParams.get('to')
  const businessUnitId = searchParams.get('businessUnitId')

  // По умолчанию текущий месяц
  const now = new Date()
  const dateFrom = from ? new Date(from) : new Date(now.getFullYear(), now.getMonth(), 1)
  const dateTo = to ? new Date(to) : new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59)

  const where: any = {
    date: { gte: dateFrom, lte: dateTo }
  }
  if (businessUnitId) where.businessUnitId = businessUnitId

  // Все записи за период
  const records = await prisma.financeRecord.findMany({
    where,
    include: { category: true, businessUnit: true }
  })

  // Считаем итоги
  let totalIncome = 0
  let totalExpense = 0
  const byCategory: Record<string, { name: string; group: string | null; income: number; expense: number }> = {}
  const byBusinessUnit: Record<string, { name: string; income: number; expense: number }> = {}

  for (const r of records) {
    if (r.type === 'INCOME') totalIncome += r.amount
    else totalExpense += r.amount

    // По категориям
    const catKey = r.categoryId
    if (!byCategory[catKey]) {
      byCategory[catKey] = { name: r.category.name, group: r.category.group, income: 0, expense: 0 }
    }
    if (r.type === 'INCOME') byCategory[catKey].income += r.amount
    else byCategory[catKey].expense += r.amount

    // По направлениям
    const buKey = r.businessUnitId || '_general'
    const buName = r.businessUnit?.name || 'Общие'
    if (!byBusinessUnit[buKey]) {
      byBusinessUnit[buKey] = { name: buName, income: 0, expense: 0 }
    }
    if (r.type === 'INCOME') byBusinessUnit[buKey].income += r.amount
    else byBusinessUnit[buKey].expense += r.amount
  }

  // Предстоящие неоплаченные расходы (dueDate в будущем)
  const upcomingExpenses = await prisma.financeRecord.findMany({
    where: {
      isPaid: false,
      type: 'EXPENSE',
      ...(businessUnitId && { businessUnitId })
    },
    include: { category: true, businessUnit: true },
    orderBy: { dueDate: 'asc' }
  })

  const totalUnpaid = upcomingExpenses.reduce((sum, r) => sum + r.amount, 0)

  // Дебиторка (нам должны) — неоплаченные
  const receivables = await prisma.financeRecord.findMany({
    where: {
      debtType: 'RECEIVABLE',
      isPaid: false,
      ...(businessUnitId && { businessUnitId })
    },
    include: { category: true, businessUnit: true },
    orderBy: { dueDate: 'asc' }
  })
  const totalReceivable = receivables.reduce((sum, r) => sum + r.amount, 0)

  // Кредиторка (мы должны) — неоплаченные
  const payables = await prisma.financeRecord.findMany({
    where: {
      debtType: 'PAYABLE',
      isPaid: false,
      ...(businessUnitId && { businessUnitId })
    },
    include: { category: true, businessUnit: true },
    orderBy: { dueDate: 'asc' }
  })
  const totalPayable = payables.reduce((sum, r) => sum + r.amount, 0)

  // Баланс сейфа (глобальный, не зависит от фильтров)
  const safeSettings = await prisma.safeSettings.findFirst()
  let safeBalance = 0
  if (safeSettings) {
    const safeExpenses = await prisma.financeRecord.aggregate({
      where: {
        fromSafe: true,
        type: 'EXPENSE',
        date: { gte: safeSettings.effectiveDate }
      },
      _sum: { amount: true }
    })
    safeBalance = safeSettings.initialBalance - (safeExpenses._sum.amount || 0)
  }

  return NextResponse.json({
    period: { from: dateFrom, to: dateTo },
    totalIncome,
    totalExpense,
    profit: totalIncome - totalExpense,
    totalUnpaid,
    totalReceivable,
    totalPayable,
    safeBalance,
    byCategory: Object.values(byCategory),
    byBusinessUnit: Object.values(byBusinessUnit),
    upcomingExpenses,
    receivables,
    payables
  })
}
