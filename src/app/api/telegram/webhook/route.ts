import { NextRequest, NextResponse } from 'next/server'
import { telegramWebhook } from '@/services/telegram'

// POST /api/telegram/webhook - Webhook для получения сообщений от Telegram
export async function POST(req: NextRequest) {
  try {
    const body = await req.text()

    // Передаем запрос в обработчик grammy
    const response = await telegramWebhook(
      new Request(req.url, {
        method: 'POST',
        headers: req.headers,
        body
      })
    )

    return new NextResponse(response.body, {
      status: response.status,
      headers: response.headers
    })
  } catch (error) {
    console.error('Error handling telegram webhook:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// GET endpoint для проверки
export async function GET() {
  return NextResponse.json({
    status: 'ok',
    message: 'Telegram webhook endpoint is running'
  })
}
