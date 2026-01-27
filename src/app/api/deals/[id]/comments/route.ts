import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

// GET /api/deals/[id]/comments - получить все комментарии и события сделки
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id: dealId } = params

    const comments = await prisma.dealComment.findMany({
      where: { dealId },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            avatar: true
          }
        }
      },
      orderBy: { createdAt: 'asc' }
    })

    return NextResponse.json({ comments })
  } catch (error) {
    console.error('Error fetching comments:', error)
    return NextResponse.json(
      { error: 'Failed to fetch comments' },
      { status: 500 }
    )
  }
}

// POST /api/deals/[id]/comments - создать комментарий или отправить в Telegram
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id: dealId } = params
    const body = await request.json()
    const { content, type, sendToTelegram, userId } = body

    // Валидация
    if (!content || !content.trim()) {
      return NextResponse.json(
        { error: 'Content is required' },
        { status: 400 }
      )
    }

    // Создаем комментарий
    const comment = await prisma.dealComment.create({
      data: {
        content,
        type: type || 'COMMENT',
        sentToTelegram: sendToTelegram || false,
        dealId,
        userId
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            avatar: true
          }
        }
      }
    })

    // Если нужно отправить в Telegram
    if (sendToTelegram) {
      const deal = await prisma.deal.findUnique({
        where: { id: dealId },
        include: { contact: true }
      })

      if (deal?.contact?.telegramId) {
        try {
          await fetch(`${request.nextUrl.origin}/api/telegram/send`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              telegramId: deal.contact.telegramId,
              text: content
            })
          })
        } catch (error) {
          console.error('Error sending to Telegram:', error)
        }
      }
    }

    return NextResponse.json({ comment }, { status: 201 })
  } catch (error) {
    console.error('Error creating comment:', error)
    return NextResponse.json(
      { error: 'Failed to create comment' },
      { status: 500 }
    )
  }
}
