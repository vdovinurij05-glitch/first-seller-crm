import { NextRequest, NextResponse } from 'next/server'
import { sendTelegramMessage, sendTelegramFile } from '@/services/telegram'
import formidable from 'formidable'
import fs from 'fs/promises'
import path from 'path'

// POST /api/telegram/send - Отправка сообщения или файла в Telegram
export async function POST(req: NextRequest) {
  try {
    const contentType = req.headers.get('content-type') || ''

    // Если это обычное JSON сообщение
    if (contentType.includes('application/json')) {
      const body = await req.json()
      const { telegramId, text, managerId } = body

      if (!telegramId || !text) {
        return NextResponse.json(
          { error: 'telegramId and text are required' },
          { status: 400 }
        )
      }

      const messageId = await sendTelegramMessage(telegramId, text, managerId)

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
      // Для загрузки файлов в Next.js 15 нужно использовать FormData
      const formData = await req.formData()

      const telegramId = formData.get('telegramId') as string
      const file = formData.get('file') as File
      const caption = formData.get('caption') as string || undefined
      const managerId = formData.get('managerId') as string || undefined

      if (!telegramId || !file) {
        return NextResponse.json(
          { error: 'telegramId and file are required' },
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
      const messageId = await sendTelegramFile(telegramId, relativePath, caption, managerId)

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
    console.error('Error sending telegram message:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
