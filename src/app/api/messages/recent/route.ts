import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

// GET /api/messages/recent - получить последние входящие сообщения по сделкам
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const since = searchParams.get('since') // timestamp последней проверки

    const sinceDate = since ? new Date(parseInt(since)) : new Date(Date.now() - 60000) // По умолчанию последняя минута

    // Получаем последние входящие сообщения с контактами
    const messages = await prisma.message.findMany({
      where: {
        direction: 'IN',
        createdAt: {
          gt: sinceDate
        }
      },
      include: {
        contact: {
          select: {
            id: true,
            name: true,
            telegramUsername: true,
            deals: {
              where: {
                closedAt: null
              },
              orderBy: {
                updatedAt: 'desc'
              },
              take: 1,
              select: {
                id: true,
                title: true
              }
            }
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      },
      take: 10
    })

    // Фильтруем только те сообщения, у контактов которых есть активные сделки
    const messagesWithDeals = messages
      .filter(msg => msg.contact?.deals && msg.contact.deals.length > 0)
      .map(msg => ({
        ...msg,
        deal: msg.contact.deals[0]
      }))

    return NextResponse.json({ messages: messagesWithDeals })
  } catch (error) {
    console.error('Error fetching recent messages:', error)
    return NextResponse.json(
      { error: 'Failed to fetch recent messages' },
      { status: 500 }
    )
  }
}
