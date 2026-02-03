import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import crypto from 'crypto'
import axios from 'axios'

const MANGO_API_URL = 'https://app.mango-office.ru/vpbx'

interface MangoConfig {
  apiKey: string
  apiSalt: string
}

const config: MangoConfig = {
  apiKey: process.env.MANGO_API_KEY || '',
  apiSalt: process.env.MANGO_API_SALT || ''
}

// Нормализация номера телефона для поиска
function normalizePhone(phone: string): string {
  // Убираем все нецифровые символы
  const digits = phone.replace(/\D/g, '')
  // Если начинается с 8 или 7, возвращаем последние 10 цифр
  if (digits.length === 11 && (digits.startsWith('7') || digits.startsWith('8'))) {
    return digits.slice(1)
  }
  // Если уже 10 цифр, возвращаем как есть
  if (digits.length === 10) {
    return digits
  }
  return digits
}

// Генерация подписи для Mango API
function generateSign(json: string): string {
  const signString = config.apiKey + json + config.apiSalt
  return crypto.createHash('sha256').update(signString).digest('hex')
}

// Выполнение запроса к Mango API
async function mangoRequest(endpoint: string, data: object): Promise<any> {
  const json = JSON.stringify(data)
  const sign = generateSign(json)

  const formData = new URLSearchParams()
  formData.append('vpbx_api_key', config.apiKey)
  formData.append('sign', sign)
  formData.append('json', json)

  const response = await axios.post(`${MANGO_API_URL}${endpoint}`, formData, {
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded'
    }
  })

  return response.data
}

// Получение URL записи разговора
async function getRecordingUrl(recordingId: string): Promise<string | null> {
  try {
    console.log(`🎙️ Fetching recording URL for: ${recordingId}`)

    const response = await mangoRequest('/queries/recording/post/', {
      recording_id: recordingId,
      action: 'download' // или 'play' для стриминга
    })

    console.log('🎙️ Recording response:', response)

    // Mango возвращает URL напрямую или в поле url
    if (typeof response === 'string' && response.startsWith('http')) {
      return response
    }
    if (response?.url) {
      return response.url
    }

    return null
  } catch (error: any) {
    // Код 4102 = запись не найдена (нормальная ситуация для коротких/пропущенных звонков)
    if (error?.response?.data?.code === 4102 || error?.response?.status === 404) {
      console.log(`⚠️ No recording available for: ${recordingId}`)
      return null
    }
    console.error(`❌ Error fetching recording for ${recordingId}:`, error?.message || error)
    return null
  }
}

// Получение звонков за последние N минут
async function getRecentCalls(minutes: number = 60): Promise<any> {
  const dateTo = new Date()
  const dateFrom = new Date(Date.now() - minutes * 60 * 1000)

  console.log(`📞 Fetching calls from Mango for last ${minutes} minutes...`)

  const requestData = {
    date_from: Math.floor(dateFrom.getTime() / 1000),
    date_to: Math.floor(dateTo.getTime() / 1000),
    fields: 'start,finish,from_number,to_number,disconnect_reason,entry_id'
  }

  console.log('🔵 Mango API request to /stats/request:', requestData)

  try {
    // Запрашиваем ключ для получения результата
    const requestResponse = await mangoRequest('/stats/request', requestData)
    console.log('✅ Mango API response:', requestResponse)

    if (!requestResponse || !requestResponse.key) {
      console.log('⚠️ No key received from Mango API')
      return null
    }

    const resultKey = requestResponse.key

    // Получаем результат по ключу
    const resultData = {
      key: resultKey
    }

    console.log('🔵 Mango API request to /stats/result:', resultData)
    const resultResponse = await mangoRequest('/stats/result', resultData)
    console.log('✅ Mango API response:', resultResponse)

    // Проверяем результат
    if (!resultResponse) {
      console.log('⚠️ No result received')
      return null
    }

    // CSV парсинг - Mango возвращает данные без заголовков
    if (typeof resultResponse === 'string') {
      const lines = resultResponse.trim().split('\n').filter(line => line.trim())

      if (lines.length === 0) {
        console.log('⚠️ No calls found in the period')
        return []
      }

      // Фиксированные имена полей для Mango CSV (без заголовков)
      const fieldNames = ['start', 'finish', 'from_number', 'to_number', 'disconnect_reason', 'entry_id']

      const calls = lines.map(line => {
        const values = line.split(';')
        const call: any = {}
        fieldNames.forEach((name, index) => {
          call[name] = values[index]
        })
        console.log(`📞 Parsed call: from=${call.from_number}, to=${call.to_number}, entry=${call.entry_id}`)
        return call
      })

      console.log(`📊 Parsed ${calls.length} calls from Mango CSV`)
      return calls
    }

    console.log('⚠️ No calls found in the period')
    return []
  } catch (error) {
    console.error('❌ Error fetching calls from Mango:', error)
    throw error
  }
}

// Синхронизация звонков с базой данных
async function syncCalls(calls: any[]): Promise<number> {
  let syncedCount = 0

  for (const mangoCall of calls) {
    try {
      const entryId = mangoCall.entry_id || mangoCall['Идентификатор звонка']

      if (!entryId) {
        console.log('⚠️ Skipping call without entry_id')
        continue
      }

      // Проверяем, существует ли уже этот звонок
      const existingCall = await prisma.call.findFirst({
        where: { externalId: entryId }
      })

      if (existingCall) {
        // Если звонок есть, но нет записи - пробуем получить запись
        if (!existingCall.recordingUrl && existingCall.status === 'COMPLETED' && existingCall.duration && existingCall.duration > 0) {
          const recordingUrl = await getRecordingUrl(entryId)
          if (recordingUrl) {
            await prisma.call.update({
              where: { id: existingCall.id },
              data: { recordingUrl }
            })
            console.log(`🎙️ Updated recording URL for existing call: ${entryId}`)
            syncedCount++
          }
        } else {
          console.log(`⏭️ Skipping duplicate call: ${entryId}`)
        }
        continue
      }

      // Парсим данные звонка
      const fromNumber = mangoCall.from_number || mangoCall['Номер, с которого звонили']
      const toNumber = mangoCall.to_number || mangoCall['Номер, на который звонили']
      const disconnectReason = mangoCall.disconnect_reason || mangoCall['Причина завершения']
      const start = mangoCall.start || mangoCall['Время звонка']
      const finish = mangoCall.finish || mangoCall['Время завершения звонка']

      if (!fromNumber || !toNumber) {
        console.log('⚠️ Skipping call without phone numbers')
        continue
      }

      // Определяем направление по наличию SIP-адреса
      // Если from_number содержит "sip:" - это исходящий звонок (звоним из Mango)
      // Если to_number содержит "sip:" - это входящий звонок (звонят нам)
      const fromIsSip = fromNumber.includes('sip:') || fromNumber.includes('@')
      const toIsSip = toNumber.includes('sip:') || toNumber.includes('@')

      // Исходящий если from = SIP (наш внутренний номер)
      const isOutgoing = fromIsSip && !toIsSip

      // Определяем номер клиента (внешний номер, не SIP)
      const clientPhone = isOutgoing ? toNumber : fromNumber

      console.log(`📞 Call direction: ${isOutgoing ? 'OUTGOING' : 'INCOMING'}, client: ${clientPhone}`)

      // Нормализуем номер клиента для поиска
      const normalizedClient = normalizePhone(clientPhone)

      // Создаём варианты номеров для поиска (с разными префиксами)
      const phoneVariants = [
        clientPhone,
        normalizedClient,
        `7${normalizedClient}`,
        `8${normalizedClient}`,
        `+7${normalizedClient}`
      ].filter(Boolean)

      console.log(`🔍 Searching contact with phones:`, phoneVariants)

      // Ищем контакт по номеру клиента
      const contact = await prisma.contact.findFirst({
        where: {
          OR: phoneVariants.map(phone => ({ phone }))
        }
      })

      const isIncoming = !isOutgoing

      // Определяем статус
      let status = 'COMPLETED'
      if (disconnectReason === '1103' || disconnectReason === 1103) status = 'MISSED'
      else if (disconnectReason === '1102' || disconnectReason === 1102) status = 'BUSY'

      // Вычисляем длительность
      let duration = 0
      if (start && finish) {
        const startTime = typeof start === 'number' ? start : parseInt(start)
        const finishTime = typeof finish === 'number' ? finish : parseInt(finish)
        duration = finishTime - startTime
      }

      // Находим или создаём контакт и сделку
      let dealId = null
      let contactId = contact?.id

      if (contact) {
        console.log(`✅ Found contact: ${contact.name} (${contact.phone})`)
        const activeDeal = await prisma.deal.findFirst({
          where: {
            contactId: contact.id,
            closedAt: null
          },
          orderBy: {
            updatedAt: 'desc'
          }
        })
        dealId = activeDeal?.id
        if (dealId) {
          console.log(`✅ Found active deal: ${activeDeal?.title} (${dealId})`)
        } else {
          console.log(`⚠️ No active deal found for contact ${contact.name}`)
        }
      } else {
        // Контакт не найден - создаём новый контакт и сделку
        console.log(`📝 Creating new contact for phone: ${clientPhone}`)

        const callType = isIncoming ? 'Входящий' : 'Исходящий'
        const newContact = await prisma.contact.create({
          data: {
            name: `Звонок: ${clientPhone}`,
            phone: clientPhone,
            source: 'PHONE',
            status: 'NEW'
          }
        })
        contactId = newContact.id

        // Создаем сделку для нового контакта
        const newDeal = await prisma.deal.create({
          data: {
            title: `${callType} звонок: ${clientPhone}`,
            amount: 0,
            stage: 'NEW',
            probability: 50,
            description: `Автоматически создана при ${isIncoming ? 'входящем' : 'исходящем'} звонке\nНомер: ${clientPhone}\nДата звонка: ${new Date(typeof start === 'number' ? start * 1000 : parseInt(start) * 1000).toLocaleString('ru-RU')}`,
            contactId: newContact.id
          }
        })
        dealId = newDeal.id

        console.log(`✅ Created new contact ${newContact.id} and deal ${newDeal.id}`)
      }

      // Получаем URL записи (только для завершённых звонков с длительностью > 0)
      let recordingUrl: string | null = null
      if (status === 'COMPLETED' && duration > 0) {
        recordingUrl = await getRecordingUrl(entryId)
        if (recordingUrl) {
          console.log(`🎙️ Got recording URL for ${entryId}`)
        }
      }

      // Создаем запись звонка
      const call = await prisma.call.create({
        data: {
          externalId: entryId,
          direction: isIncoming ? 'IN' : 'OUT',
          phone: clientPhone, // Номер клиента
          fromNumber,
          toNumber,
          status,
          startTime: new Date(typeof start === 'number' ? start * 1000 : parseInt(start) * 1000),
          endTime: finish ? new Date(typeof finish === 'number' ? finish * 1000 : parseInt(finish) * 1000) : new Date(),
          duration,
          result: disconnectReason ? String(disconnectReason) : 'completed',
          recordingUrl,
          contactId,
          dealId
        }
      })

      // Если звонок связан со сделкой, добавляем в ленту активности
      if (dealId) {
        const direction = isIncoming ? 'входящий' : 'исходящий'
        const durationText = duration > 0
          ? `${Math.floor(duration / 60)} мин ${duration % 60} сек`
          : 'не состоялся'

        await prisma.dealComment.create({
          data: {
            content: `Звонок (${direction}): ${durationText}`,
            type: 'SYSTEM_EVENT',
            eventType: isIncoming ? 'CALL_INCOMING' : 'CALL_OUTGOING',
            metadata: JSON.stringify({
              callId: entryId,
              callRecordId: call.id,
              entryId,
              duration,
              disconnectReason,
              status
            }),
            dealId
          }
        })

        console.log(`✅ Added call to deal activity: ${call.id}`)
      }

      syncedCount++
      console.log(`✅ Synced call ${entryId}`)
    } catch (error) {
      console.error(`Error syncing call:`, error)
    }
  }

  return syncedCount
}

async function performSync() {
  console.log('🚀 Mango sync v2.0 - with phone normalization')
  // Получаем звонки за последний час
  const calls = await getRecentCalls(60)

  if (!calls || calls.length === 0) {
    return {
      success: true,
      message: 'No new calls to sync',
      synced: 0
    }
  }

  // Синхронизируем звонки
  const syncedCount = await syncCalls(calls)

  return {
    success: true,
    message: `Synced ${syncedCount} calls`,
    synced: syncedCount,
    total: calls.length
  }
}

export async function GET() {
  try {
    const result = await performSync()
    return NextResponse.json(result)
  } catch (error) {
    console.error('Error in Mango sync:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

export async function POST() {
  try {
    const result = await performSync()
    return NextResponse.json(result)
  } catch (error) {
    console.error('Error in Mango sync:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
