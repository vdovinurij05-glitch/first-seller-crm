import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { handleMangoWebhook, handleMangoRecording, MangoCallEvent, MangoRecordingEvent } from '@/services/mango'

// Проверка подписи Mango
function verifyMangoSignature(body: string, sign: string): boolean {
  const apiKey = process.env.MANGO_API_KEY || ''
  const apiSalt = process.env.MANGO_API_SALT || ''
  const expectedSign = crypto
    .createHash('sha256')
    .update(apiKey + body + apiSalt)
    .digest('hex')
  return sign === expectedSign
}


export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const json = formData.get('json') as string
    const sign = formData.get('sign') as string

    console.log('📥 Mango webhook received')
    console.log('📥 Raw JSON:', json)

    // Проверяем подпись
    if (!verifyMangoSignature(json, sign)) {
      console.error('Invalid Mango signature')
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
    }

    const event = JSON.parse(json)
    console.log('📥 Parsed event:', JSON.stringify(event, null, 2))

    // Определяем тип события
    if (event.call_state) {
      // Событие звонка
      console.log('📞 Call event, state:', event.call_state)
      await handleMangoWebhook(event as MangoCallEvent)
    } else if (event.recording_id || event.recording_url || event.record_url) {
      // Событие записи
      console.log('🎙️ Recording event detected')
      await handleMangoRecording(event as MangoRecordingEvent)
    } else {
      console.log('❓ Unknown event type')
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('Mango webhook error:', error)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

export async function GET() {
  return NextResponse.json({ status: 'Mango webhook is active' })
}
