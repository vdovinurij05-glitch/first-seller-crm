import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { sendTelegramMessage } from '@/services/telegram'

// GET - Получение сообщений контакта
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const contactId = searchParams.get('contactId')
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '50')

    if (!contactId) {
      return NextResponse.json(
        { error: 'contactId обязателен' },
        { status: 400 }
      )
    }

    const [messages, total] = await Promise.all([
      prisma.message.findMany({
        where: { contactId },
        include: {
          manager: {
            select: { id: true, name: true, avatar: true }
          },
          attachments: true
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit
      }),
      prisma.message.count({ where: { contactId } })
    ])

    // Отмечаем сообщения как прочитанные
    await prisma.message.updateMany({
      where: {
        contactId,
        direction: 'IN',
        isRead: false
      },
      data: { isRead: true }
    })

    return NextResponse.json({
      messages: messages.reverse(), // Возвращаем в хронологическом порядке
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    })
  } catch (error) {
    console.error('Error fetching messages:', error)
    return NextResponse.json(
      { error: 'Ошибка при получении сообщений' },
      { status: 500 }
    )
  }
}

// POST - Отправка сообщения
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { contactId, content, managerId } = body

    if (!contactId || !content) {
      return NextResponse.json(
        { error: 'contactId и content обязательны' },
        { status: 400 }
      )
    }

    // Получаем контакт
    const contact = await prisma.contact.findUnique({
      where: { id: contactId }
    })

    if (!contact) {
      return NextResponse.json(
        { error: 'Контакт не найден' },
        { status: 404 }
      )
    }

    // Если у контакта есть Telegram ID, отправляем через Telegram
    if (contact.telegramId) {
      const telegramMsgId = await sendTelegramMessage(
        contact.telegramId,
        content,
        managerId
      )

      if (!telegramMsgId) {
        return NextResponse.json(
          { error: 'Ошибка отправки в Telegram' },
          { status: 500 }
        )
      }

      // Сообщение уже сохранено в sendTelegramMessage
      const message = await prisma.message.findFirst({
        where: {
          contactId,
          telegramMsgId
        },
        include: {
          manager: {
            select: { id: true, name: true, avatar: true }
          },
          attachments: true
        }
      })

      return NextResponse.json(message, { status: 201 })
    }

    // Если нет Telegram, просто сохраняем сообщение (для SMS или других каналов)
    const message = await prisma.message.create({
      data: {
        content,
        type: 'TEXT',
        direction: 'OUT',
        contactId,
        managerId
      },
      include: {
        manager: {
          select: { id: true, name: true, avatar: true }
        },
        attachments: true
      }
    })

    return NextResponse.json(message, { status: 201 })
  } catch (error) {
    console.error('Error sending message:', error)
    return NextResponse.json(
      { error: 'Ошибка при отправке сообщения' },
      { status: 500 }
    )
  }
}
