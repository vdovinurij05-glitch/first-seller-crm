import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

// GET - получить список задач
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const dealId = searchParams.get('dealId')
    const contactId = searchParams.get('contactId')
    const status = searchParams.get('status')
    const pending = searchParams.get('pending') // для получения предстоящих напоминаний

    const where: any = {}

    if (dealId) where.dealId = dealId
    if (contactId) where.contactId = contactId
    if (status) where.status = status

    // Получить задачи с напоминаниями на ближайшие 5 минут
    if (pending === 'true') {
      const now = new Date()
      const fiveMinutesLater = new Date(now.getTime() + 5 * 60 * 1000)

      where.status = 'PENDING'
      where.reminderSent = false
      where.dueDate = {
        lte: fiveMinutesLater
      }
    }

    const tasks = await prisma.task.findMany({
      where,
      orderBy: { dueDate: 'asc' }
    })

    return NextResponse.json({ tasks })
  } catch (error) {
    console.error('Error fetching tasks:', error)
    return NextResponse.json(
      { error: 'Ошибка при получении задач' },
      { status: 500 }
    )
  }
}

// POST - создать задачу
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { title, description, type, dueDate, dealId, contactId, userId } = body

    if (!title || !dueDate) {
      return NextResponse.json(
        { error: 'Название и дата обязательны' },
        { status: 400 }
      )
    }

    const task = await prisma.task.create({
      data: {
        title,
        description,
        type: type || 'CALL',
        dueDate: new Date(dueDate),
        dealId,
        contactId,
        userId
      }
    })

    return NextResponse.json(task)
  } catch (error) {
    console.error('Error creating task:', error)
    return NextResponse.json(
      { error: 'Ошибка при создании задачи' },
      { status: 500 }
    )
  }
}
