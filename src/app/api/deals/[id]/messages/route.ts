import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { sendTelegramMessage, sendTelegramFile } from '@/services/telegram'
import fs from 'fs/promises'
import path from 'path'

// GET /api/deals/:id/messages - Получить все сообщения Telegram по сделке
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    // Получаем сделку с контактом
    const deal = await prisma.deal.findUnique({
      where: { id },
      include: {
        contact: true
      }
    })

    if (!deal || !deal.contact) {
      return NextResponse.json({ messages: [] })
    }

    // Получаем все сообщения для этого контакта
    const messages = await prisma.message.findMany({
      where: {
        contactId: deal.contact.id
      },
      include: {
        attachments: true,
        manager: {
          select: {
            name: true
          }
        }
      },
      orderBy: {
        createdAt: 'asc'
      }
    })

    return NextResponse.json({ messages })
  } catch (error) {
    console.error('Error fetching messages:', error)
    return NextResponse.json(
      { error: 'Ошибка при получении сообщений' },
      { status: 500 }
    )
  }
}

// POST /api/deals/:id/messages - Отправить сообщение в Telegram
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

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

    if (!deal.contact?.telegramId) {
      return NextResponse.json(
        { error: 'У контакта нет Telegram ID' },
        { status: 400 }
      )
    }

    const contentType = req.headers.get('content-type') || ''

    // Если это JSON сообщение
    if (contentType.includes('application/json')) {
      const body = await req.json()
      const { text } = body

      if (!text) {
        return NextResponse.json(
          { error: 'text is required' },
          { status: 400 }
        )
      }

      const messageId = await sendTelegramMessage(
        deal.contact.telegramId,
        text,
        deal.managerId || undefined
      )

      if (!messageId) {
        return NextResponse.json(
          { error: 'Failed to send message' },
          { status: 500 }
        )
      }

      return NextResponse.json({
        success: true,
        messageId
      })
    }

    // Если это multipart/form-data с файлом
    if (contentType.includes('multipart/form-data')) {
      const formData = await req.formData()

      const file = formData.get('file') as File
      const caption = formData.get('caption') as string || undefined

      if (!file) {
        return NextResponse.json(
          { error: 'file is required' },
          { status: 400 }
        )
      }

      // Сохраняем файл временно
      const uploadsDir = path.join(process.cwd(), 'public', 'uploads', 'temp')
      await fs.mkdir(uploadsDir, { recursive: true })

      const fileName = `${Date.now()}_${file.name}`
      const filePath = path.join(uploadsDir, fileName)

      const bytes = await file.arrayBuffer()
      await fs.writeFile(filePath, Buffer.from(bytes))

      // Отправляем файл
      const relativePath = `/uploads/temp/${fileName}`
      const messageId = await sendTelegramFile(
        deal.contact.telegramId,
        relativePath,
        caption,
        deal.managerId || undefined
      )

      // Удаляем временный файл
      try {
        await fs.unlink(filePath)
      } catch (error) {
        console.error('Error deleting temp file:', error)
      }

      if (!messageId) {
        return NextResponse.json(
          { error: 'Failed to send file' },
          { status: 500 }
        )
      }

      return NextResponse.json({
        success: true,
        messageId
      })
    }

    return NextResponse.json(
      { error: 'Invalid content type' },
      { status: 400 }
    )

  } catch (error) {
    console.error('Error sending message:', error)
    return NextResponse.json(
      { error: 'Ошибка при отправке сообщения' },
      { status: 500 }
    )
  }
}
