import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { sendTelegramMessage } from '@/services/telegram'

// GET /api/deals/:id/comments - Получить комментарии сделки
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const comments = await prisma.dealComment.findMany({
      where: { dealId: id },
      include: {
        user: {
          select: {
            name: true
          }
        }
      },
      orderBy: {
        createdAt: 'asc'
      }
    })

    return NextResponse.json({ comments })
  } catch (error) {
    console.error('Error fetching comments:', error)
    return NextResponse.json(
      { error: 'Ошибка при получении комментариев' },
      { status: 500 }
    )
  }
}

// POST /api/deals/:id/comments - Добавить комментарий
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await req.json()
    const { content, type } = body // type: 'COMMENT' | 'TELEGRAM'

    // Получаем сделку с контактом
    const deal = await prisma.deal.findUnique({
      where: { id },
      include: {
        contact: true
      }
    })

    if (!deal) {
      return NextResponse.json(
        { error: 'Сделка не найдена' },
        { status: 404 }
      )
    }

    let sentToTelegram = false

    // Если тип TELEGRAM, отправляем сообщение в Telegram
    if (type === 'TELEGRAM' && deal.contact?.telegramId) {
      const telegramSent = await sendTelegramMessage(
        deal.contact.telegramId,
        content
      )
      sentToTelegram = telegramSent !== null
    }

    // Сохраняем комментарий
    const comment = await prisma.dealComment.create({
      data: {
        content,
        type,
        sentToTelegram,
        dealId: id,
        userId: deal.managerId // Берем ID менеджера из сделки, в реальности нужно брать из сессии
      },
      include: {
        user: {
          select: {
            name: true
          }
        }
      }
    })

    return NextResponse.json({ comment })
  } catch (error) {
    console.error('Error creating comment:', error)
    return NextResponse.json(
      { error: 'Ошибка при создании комментария' },
      { status: 500 }
    )
  }
}
