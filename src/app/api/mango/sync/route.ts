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

    // CSV парсинг если нужен
    if (typeof resultResponse === 'string') {
      // Если ответ в формате CSV
      const lines = resultResponse.trim().split('\n')
      if (lines.length <= 1) {
        console.log('⚠️ No calls found in the period')
        return []
      }

      // Парсим CSV
      const headers = lines[0].split(';')
      const calls = lines.slice(1).map(line => {
        const values = line.split(';')
        const call: any = {}
        headers.forEach((header, index) => {
          call[header] = values[index]
        })
        return call
      })

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

      // Нормализуем номера для поиска
      const normalizedFrom = normalizePhone(fromNumber)
      const normalizedTo = normalizePhone(toNumber)

      // Создаём варианты номеров для поиска (с разными префиксами)
      const phoneVariants = [
        fromNumber, toNumber,
        normalizedFrom, normalizedTo,
        `7${normalizedFrom}`, `7${normalizedTo}`,
        `8${normalizedFrom}`, `8${normalizedTo}`,
        `+7${normalizedFrom}`, `+7${normalizedTo}`
      ].filter(Boolean)

      console.log(`🔍 Searching contact with phones:`, phoneVariants.slice(0, 4))

      // Ищем контакт по номеру (входящий или исходящий) с разными форматами
      const contact = await prisma.contact.findFirst({
        where: {
          OR: phoneVariants.map(phone => ({ phone }))
        }
      })

      // Определяем направление (сравниваем нормализованные номера)
      const contactNormalized = contact?.phone ? normalizePhone(contact.phone) : ''
      const isIncoming = contact ? (contactNormalized === normalizedFrom) : true

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

      // Находим активную сделку для контакта
      let dealId = null
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
        console.log(`⚠️ No contact found for phones: ${fromNumber} / ${toNumber}`)
      }

      // Создаем запись звонка
      const call = await prisma.call.create({
        data: {
          externalId: entryId,
          direction: isIncoming ? 'IN' : 'OUT',
          fromNumber,
          toNumber,
          status,
          startTime: new Date(typeof start === 'number' ? start * 1000 : parseInt(start) * 1000),
          endTime: finish ? new Date(typeof finish === 'number' ? finish * 1000 : parseInt(finish) * 1000) : new Date(),
          duration,
          result: disconnectReason ? String(disconnectReason) : 'completed',
          contactId: contact?.id,
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

export async function GET() {
  try {
    // Получаем звонки за последний час
    const calls = await getRecentCalls(60)

    if (!calls || calls.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No new calls to sync',
        synced: 0
      })
    }

    // Синхронизируем звонки
    const syncedCount = await syncCalls(calls)

    return NextResponse.json({
      success: true,
      message: `Synced ${syncedCount} calls`,
      synced: syncedCount,
      total: calls.length
    })
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
