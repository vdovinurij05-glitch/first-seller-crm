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

// GET /api/pnl/calendar - платежи за месяц (по dueDate и date)
export async function GET(request: NextRequest) {
  const admin = await getAdminUser(request)
  if (!admin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { searchParams } = new URL(request.url)
  const year = parseInt(searchParams.get('year') || String(new Date().getFullYear()))
  const month = parseInt(searchParams.get('month') || String(new Date().getMonth()))

  const from = new Date(year, month, 1)
  const to = new Date(year, month + 1, 0, 23, 59, 59)

  // Все записи с dueDate в этом месяце (запланированные платежи)
  const byDueDate = await prisma.financeRecord.findMany({
    where: {
      dueDate: { gte: from, lte: to }
    },
    include: { category: true, businessUnit: true },
    orderBy: { dueDate: 'asc' }
  })

  // Все записи с date в этом месяце (фактические операции)
  const byDate = await prisma.financeRecord.findMany({
    where: {
      date: { gte: from, lte: to }
    },
    include: { category: true, businessUnit: true },
    orderBy: { date: 'asc' }
  })

  // Группировка по дням
  const days: Record<string, { paid: typeof byDate; unpaid: typeof byDate }> = {}

  for (const r of byDate) {
    const day = new Date(r.date).toISOString().split('T')[0]
    if (!days[day]) days[day] = { paid: [], unpaid: [] }
    if (r.isPaid) days[day].paid.push(r)
    else days[day].unpaid.push(r)
  }

  for (const r of byDueDate) {
    const day = new Date(r.dueDate!).toISOString().split('T')[0]
    if (!days[day]) days[day] = { paid: [], unpaid: [] }
    // Не дублируем если уже есть по date
    const exists = days[day].paid.some(x => x.id === r.id) || days[day].unpaid.some(x => x.id === r.id)
    if (!exists) {
      if (r.isPaid) days[day].paid.push(r)
      else days[day].unpaid.push(r)
    }
  }

  return NextResponse.json({ days, year, month })
}
