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

// PUT /api/pnl/[id] - обновить запись
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
  const { amount, type, description, date, dueDate, isPaid, categoryId, businessUnitId, counterparty, debtType, client, salesManagerId } = body

  // Сохраняем старую запись для лога
  const oldRecord = await prisma.financeRecord.findUnique({
    where: { id },
    include: { category: true }
  })

  const record = await prisma.financeRecord.update({
    where: { id },
    data: {
      ...(amount !== undefined && { amount: parseFloat(amount) }),
      ...(type && { type }),
      ...(description !== undefined && { description }),
      ...(date && { date: new Date(date) }),
      ...(dueDate !== undefined && { dueDate: dueDate ? new Date(dueDate) : null }),
      ...(isPaid !== undefined && { isPaid }),
      ...(counterparty !== undefined && { counterparty: counterparty || null }),
      ...(debtType !== undefined && { debtType: debtType || null }),
      ...(client !== undefined && { client: client || null }),
      ...(salesManagerId !== undefined && { salesManagerId: salesManagerId || null }),
      ...(body.fromSafe !== undefined && { fromSafe: body.fromSafe === true }),
      ...(body.paidByFounder !== undefined && { paidByFounder: body.paidByFounder || null }),
      ...(body.founderRepayment !== undefined && { founderRepayment: body.founderRepayment || null }),
      ...(categoryId && { categoryId }),
      ...(businessUnitId !== undefined && { businessUnitId: businessUnitId || null }),
      ...(body.legalEntityId !== undefined && { legalEntityId: body.legalEntityId || null }),
    },
    include: {
      category: true,
      businessUnit: true,
      legalEntity: true,
      salesManager: true
    }
  })

  // Audit log
  const changes: string[] = []
  if (oldRecord) {
    if (amount !== undefined && parseFloat(amount) !== oldRecord.amount) changes.push(`сумма: ${oldRecord.amount} → ${parseFloat(amount)}`)
    if (isPaid !== undefined && isPaid !== oldRecord.isPaid) changes.push(isPaid ? 'оплачено' : 'снята оплата')
    if (description !== undefined && description !== oldRecord.description) changes.push(`описание: "${description}"`)
  }
  await prisma.financeAuditLog.create({
    data: {
      action: 'UPDATE',
      amount: record.amount,
      description: `Изменено: ${oldRecord?.category.name || record.category.name}${oldRecord?.description ? ' — ' + oldRecord.description : ''} (${record.amount.toLocaleString('ru')} ₽)${changes.length ? '. ' + changes.join(', ') : ''}`,
    }
  })

  return NextResponse.json({ record })
}

// DELETE /api/pnl/[id] - удалить запись
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await getAdminUser(request)
  if (!admin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { id } = await params

  // Сохраняем инфо для лога до удаления
  const record = await prisma.financeRecord.findUnique({
    where: { id },
    include: { category: true }
  })

  await prisma.financeRecord.delete({
    where: { id }
  })

  // Audit log
  if (record) {
    await prisma.financeAuditLog.create({
      data: {
        action: 'DELETE',
        amount: record.amount,
        description: `Удалено: ${record.type === 'INCOME' ? 'Доход' : 'Расход'} — ${record.category.name}${record.description ? ' — ' + record.description : ''} (${record.amount.toLocaleString('ru')} ₽)`,
      }
    })
  }

  return NextResponse.json({ success: true })
}
