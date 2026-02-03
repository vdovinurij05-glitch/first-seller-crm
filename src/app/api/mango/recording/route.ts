import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

// POST /api/mango/recording - Webhook для получения записей от Mango
export async function POST(request: NextRequest) {
  try {
    // Mango отправляет данные как form-urlencoded
    const formData = await request.formData()
    const json = formData.get('json') as string

    console.log('🎙️ Mango recording webhook received')
    console.log('🎙️ Raw json:', json)

    if (!json) {
      // Попробуем получить как JSON body
      const body = await request.json().catch(() => null)
      console.log('🎙️ JSON body:', body)

      if (body) {
        return handleRecordingData(body)
      }

      return NextResponse.json({ error: 'No data received' }, { status: 400 })
    }

    const data = JSON.parse(json)
    console.log('🎙️ Parsed recording data:', data)

    return handleRecordingData(data)
  } catch (error) {
    console.error('❌ Error processing recording webhook:', error)
    return NextResponse.json(
      { error: 'Failed to process recording' },
      { status: 500 }
    )
  }
}

async function handleRecordingData(data: any) {
  // Mango отправляет данные в разных форматах в зависимости от события
  // Типичные поля: entry_id, recording_id, record_url, recording_url

  const entryId = data.entry_id || data.call_id || data.recording_id
  const recordingUrl = data.recording_url || data.record_url || data.url || data.link

  console.log(`🎙️ Processing recording: entryId=${entryId}, url=${recordingUrl}`)

  if (!entryId) {
    console.log('⚠️ No entry_id in recording webhook')
    return NextResponse.json({ status: 'ok', message: 'No entry_id' })
  }

  if (!recordingUrl) {
    console.log('⚠️ No recording URL in webhook')
    return NextResponse.json({ status: 'ok', message: 'No recording URL' })
  }

  // Ищем звонок по entry_id
  const call = await prisma.call.findFirst({
    where: { externalId: entryId }
  })

  if (!call) {
    console.log(`⚠️ Call not found for entry_id: ${entryId}`)
    return NextResponse.json({ status: 'ok', message: 'Call not found' })
  }

  // Обновляем URL записи
  await prisma.call.update({
    where: { id: call.id },
    data: { recordingUrl }
  })

  console.log(`✅ Updated recording URL for call ${call.id}`)

  return NextResponse.json({
    status: 'ok',
    message: 'Recording URL updated',
    callId: call.id
  })
}

// GET для проверки работоспособности
export async function GET() {
  return NextResponse.json({
    status: 'ok',
    message: 'Mango recording webhook endpoint'
  })
}
