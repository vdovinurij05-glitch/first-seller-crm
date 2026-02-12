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
  const legalEntityId = searchParams.get('legalEntityId')

  // По умолчанию текущий месяц
  const now = new Date()
  const dateFrom = from ? new Date(from) : new Date(now.getFullYear(), now.getMonth(), 1)
  const dateTo = to ? new Date(to) : new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59)

  const where: any = {
    date: { gte: dateFrom, lte: dateTo }
  }
  if (businessUnitId) where.businessUnitId = businessUnitId
  if (legalEntityId) where.legalEntityId = legalEntityId

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
    // Возвраты учредителям не считаются бизнес-расходами (это погашение долга)
    if (r.founderRepayment) continue

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

  // Задолженность компании перед учредителями (всё время, не за период)
  const [founderExpenses, founderRepayments] = await Promise.all([
    prisma.financeRecord.findMany({
      where: { paidByFounder: { not: null } },
      select: { paidByFounder: true, amount: true }
    }),
    prisma.financeRecord.findMany({
      where: { founderRepayment: { not: null } },
      select: { founderRepayment: true, amount: true }
    })
  ])
  const founderDebts: Record<string, number> = {}
  for (const r of founderExpenses) {
    const name = r.paidByFounder!
    founderDebts[name] = (founderDebts[name] || 0) + r.amount
  }
  for (const r of founderRepayments) {
    const name = r.founderRepayment!
    founderDebts[name] = (founderDebts[name] || 0) - r.amount
  }
  const founderDebtsArray = Object.entries(founderDebts)
    .filter(([, amount]) => Math.abs(amount) > 0.01)
    .map(([name, amount]) => ({ name, amount }))

  // Текущий остаток по юрлицам: начальный + доходы − расходы (с effectiveDate)
  const legalEntities = await prisma.legalEntity.findMany({
    include: { businessUnit: true }
  })
  const accountBalances = await Promise.all(legalEntities.map(async (le) => {
    const [incomeAgg, expenseAgg] = await Promise.all([
      prisma.financeRecord.aggregate({
        where: {
          legalEntityId: le.id,
          type: 'INCOME',
          date: { gte: le.effectiveDate }
        },
        _sum: { amount: true }
      }),
      prisma.financeRecord.aggregate({
        where: {
          legalEntityId: le.id,
          type: 'EXPENSE',
          date: { gte: le.effectiveDate },
          paidByFounder: null, // не учитываем расходы оплаченные учредителями из своих
          founderRepayment: null, // не учитываем возврат долга учредителям
          loanId: null // не учитываем платежи по кредитам (обслуживание долга)
        },
        _sum: { amount: true }
      })
    ])
    const totalInc = incomeAgg._sum.amount || 0
    const totalExp = expenseAgg._sum.amount || 0
    return {
      legalEntityId: le.id,
      name: le.name,
      businessUnitName: le.businessUnit.name,
      initialBalance: le.initialBalance,
      totalIncome: totalInc,
      totalExpenses: totalExp,
      balance: le.initialBalance + totalInc - totalExp
    }
  }))
  const totalBalance = accountBalances.reduce((sum, ab) => sum + ab.balance, 0)

  return NextResponse.json({
    period: { from: dateFrom, to: dateTo },
    totalIncome,
    totalExpense,
    profit: totalIncome - totalExpense,
    totalUnpaid,
    totalReceivable,
    totalPayable,
    totalBalance,
    accountBalances,
    founderDebts: founderDebtsArray,
    byCategory: Object.values(byCategory),
    byBusinessUnit: Object.values(byBusinessUnit),
    upcomingExpenses,
    receivables,
    payables
  })
}
