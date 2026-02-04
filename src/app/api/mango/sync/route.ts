import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import crypto from 'crypto'
import axios from 'axios'
import fs from 'fs'
import path from 'path'

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

// Конфигурация Mango для построения URL записей
const MANGO_ACCOUNT_ID = '400192121' // ID аккаунта из URL записи
const MANGO_VPBX_ID = '400363906' // ID VPBX из SIP адреса

// Директория для хранения записей
const RECORDINGS_DIR = path.join(process.cwd(), 'public', 'recordings')

// Создаём директорию для записей если её нет
if (!fs.existsSync(RECORDINGS_DIR)) {
  fs.mkdirSync(RECORDINGS_DIR, { recursive: true })
}

// Построение URL записи из recording_id (для скачивания)
function buildRecordingUrl(recordingId: string): string {
  return `https://lk.mango-office.ru/issa/api/${MANGO_ACCOUNT_ID}/${MANGO_VPBX_ID}/call-recording/play-record/${recordingId}`
}

// Скачивание записи через Mango API
// Согласно документации, POST /vpbx/queries/recording/post возвращает 302 redirect на временную ссылку
async function downloadRecording(recordingId: string, entryId: string): Promise<string | null> {
  try {
    console.log(`🎙️ Downloading recording: ${recordingId}`)

    // Формируем запрос к API
    const json = JSON.stringify({
      recording_id: recordingId,
      action: 'download'
    })
    const sign = generateSign(json)

    const formData = new URLSearchParams()
    formData.append('vpbx_api_key', config.apiKey)
    formData.append('sign', sign)
    formData.append('json', json)

    // Делаем запрос с отключенным автоматическим следованием за редиректами
    const response = await axios.post(`${MANGO_API_URL}/queries/recording/post/`, formData, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      maxRedirects: 0,
      validateStatus: (status) => status >= 200 && status < 400
    })

    console.log(`🎙️ API response status: ${response.status}`)
    console.log(`🎙️ API response headers:`, JSON.stringify(response.headers))

    // API должен вернуть 302 с Location header
    let fileUrl: string | null = null

    if (response.status === 302 || response.status === 301) {
      fileUrl = response.headers['location']
      console.log(`🎙️ Redirect URL: ${fileUrl}`)
    } else if (response.data?.url) {
      fileUrl = response.data.url
      console.log(`🎙️ URL from response body: ${fileUrl}`)
    }

    if (!fileUrl) {
      console.log(`⚠️ No file URL in response`)
      console.log(`🎙️ Response data:`, JSON.stringify(response.data).substring(0, 500))
      return null
    }

    // Скачиваем файл по полученной ссылке
    console.log(`🎙️ Downloading file from: ${fileUrl}`)
    const fileResponse = await axios.get(fileUrl, {
      responseType: 'arraybuffer',
      timeout: 60000
    })

    if (fileResponse.status !== 200) {
      console.log(`⚠️ File download failed: ${fileResponse.status}`)
      return null
    }

    const fileSize = fileResponse.data.length
    console.log(`🎙️ Downloaded ${fileSize} bytes`)

    if (fileSize < 1000) {
      console.log(`⚠️ File too small, likely an error`)
      return null
    }

    // Определяем расширение файла
    const contentType = fileResponse.headers['content-type'] || 'audio/mpeg'
    const ext = contentType.includes('wav') ? 'wav' : 'mp3'

    // Генерируем имя файла (используем entry_id для уникальности)
    const safeEntryId = entryId.replace(/[^a-zA-Z0-9]/g, '_')
    const filename = `${safeEntryId}.${ext}`
    const filepath = path.join(RECORDINGS_DIR, filename)

    // Сохраняем файл
    fs.writeFileSync(filepath, fileResponse.data)
    console.log(`✅ Recording saved: ${filepath} (${fileSize} bytes)`)

    // Возвращаем публичный URL
    return `/recordings/${filename}`
  } catch (error: any) {
    // Обрабатываем redirect как ошибку axios (при maxRedirects: 0)
    if (error.response?.status === 302 || error.response?.status === 301) {
      const fileUrl = error.response.headers['location']
      if (fileUrl) {
        console.log(`🎙️ Got redirect URL from error: ${fileUrl}`)
        try {
          const fileResponse = await axios.get(fileUrl, {
            responseType: 'arraybuffer',
            timeout: 60000
          })

          const fileSize = fileResponse.data.length
          if (fileSize < 1000) {
            console.log(`⚠️ File too small`)
            return null
          }

          const contentType = fileResponse.headers['content-type'] || 'audio/mpeg'
          const ext = contentType.includes('wav') ? 'wav' : 'mp3'
          const safeEntryId = entryId.replace(/[^a-zA-Z0-9]/g, '_')
          const filename = `${safeEntryId}.${ext}`
          const filepath = path.join(RECORDINGS_DIR, filename)

          fs.writeFileSync(filepath, fileResponse.data)
          console.log(`✅ Recording saved: ${filepath} (${fileSize} bytes)`)

          return `/recordings/${filename}`
        } catch (downloadError: any) {
          console.error(`❌ File download failed:`, downloadError?.message)
        }
      }
    }

    console.error(`❌ Recording download error:`, error?.response?.status, error?.response?.data || error?.message)
    return null
  }
}

// Построение URL записи в личном кабинете Mango (требует авторизации) - fallback
function buildMangoRecordingUrl(recordingId: string): string {
  return `https://lk.mango-office.ru/issa/api/${MANGO_ACCOUNT_ID}/${MANGO_VPBX_ID}/call-recording/play-record/${recordingId}`
}

// Извлечение recording_id из поля records
function extractRecordingId(recordsField: string): string | null {
  try {
    // Убираем скобки если есть: [value] -> value
    let value = recordsField.trim()
    if (value.startsWith('[') && value.endsWith(']')) {
      value = value.slice(1, -1)
    }

    // Декодируем base64: MToxMDI0MjQyNzoyNTg2MzI1NzAxODow -> 1:10242427:25863257018:0
    const decoded = Buffer.from(value, 'base64').toString('utf-8')
    console.log(`🎙️ Decoded records field: ${decoded}`)

    // Формат: type:recording_id:entry_id:flag
    const parts = decoded.split(':')
    if (parts.length >= 2) {
      const recordingId = parts[1] // Второй элемент - recording_id
      console.log(`🎙️ Extracted recording_id: ${recordingId}`)
      return recordingId
    }

    return null
  } catch (e) {
    console.log(`🎙️ Failed to decode records field: ${recordsField}`, e)
    return null
  }
}

// Получение URL записи разговора
// Сначала пытаемся скачать через API, если не получится - возвращаем URL для ЛК
async function getRecordingUrl(entryId: string, recordsField?: string): Promise<string | null> {
  console.log(`🎙️ Getting recording URL for entry: ${entryId}, records: ${recordsField}`)

  if (!recordsField || recordsField === '' || recordsField === '0') {
    console.log(`⚠️ No records field for: ${entryId}`)
    return null
  }

  // Получаем сырое base64 значение из поля records (без скобок)
  // Согласно документации Mango, recording_id должен быть в формате base64
  let rawRecordingId = recordsField.trim()
  if (rawRecordingId.startsWith('[') && rawRecordingId.endsWith(']')) {
    rawRecordingId = rawRecordingId.slice(1, -1)
  }

  console.log(`🎙️ Raw recording_id (base64): ${rawRecordingId}`)

  // Пытаемся скачать запись через API
  const localUrl = await downloadRecording(rawRecordingId, entryId)
  if (localUrl) {
    console.log(`✅ Recording downloaded: ${localUrl}`)
    return localUrl
  }

  // Если скачать не удалось, извлекаем числовой ID для URL в ЛК
  const numericId = extractRecordingId(recordsField)
  if (numericId) {
    const lkUrl = buildMangoRecordingUrl(numericId)
    console.log(`🎙️ Fallback to LK URL: ${lkUrl}`)
    return lkUrl
  }

  console.log(`⚠️ No recording available for: ${entryId}`)
  return null
}

// Получение звонков за последние N минут
async function getRecentCalls(minutes: number = 60): Promise<any> {
  const dateTo = new Date()
  const dateFrom = new Date(Date.now() - minutes * 60 * 1000)

  console.log(`📞 Fetching calls from Mango for last ${minutes} minutes...`)

  const requestData = {
    date_from: Math.floor(dateFrom.getTime() / 1000),
    date_to: Math.floor(dateTo.getTime() / 1000),
    fields: 'records,start,finish,from_number,to_number,disconnect_reason,entry_id'
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
      const fieldNames = ['records', 'start', 'finish', 'from_number', 'to_number', 'disconnect_reason', 'entry_id']

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
          // Получаем поле records из текущих данных Mango
          const recordsField = mangoCall.records
          const recordingUrl = await getRecordingUrl(entryId, recordsField)
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
      const recordsField = mangoCall.records
      if (status === 'COMPLETED' && duration > 0) {
        recordingUrl = await getRecordingUrl(entryId, recordsField)
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

// Обновление записей для существующих звонков без URL записи
// Примечание: Эта функция не может обновить записи без поля records из Mango API
// Записи обновляются только при синхронизации новых данных из Mango
async function updateMissingRecordings(): Promise<number> {
  // Подсчитываем звонки без записей для статистики
  const callsWithoutRecordings = await prisma.call.count({
    where: {
      recordingUrl: null,
      status: 'COMPLETED',
      duration: { gt: 0 }
    }
  })

  if (callsWithoutRecordings > 0) {
    console.log(`🎙️ Found ${callsWithoutRecordings} calls without recordings (will be updated on next sync with Mango data)`)
  }

  return 0
}

async function performSync() {
  console.log('🚀 Mango sync v2.0 - with phone normalization')

  // Сначала обновляем записи для существующих звонков
  const recordingsUpdated = await updateMissingRecordings()

  // Получаем звонки за последние 24 часа (увеличено для обновления старых записей)
  const calls = await getRecentCalls(24 * 60)

  if (!calls || calls.length === 0) {
    return {
      success: true,
      message: recordingsUpdated > 0 ? `Updated ${recordingsUpdated} recordings` : 'No new calls to sync',
      synced: 0,
      recordingsUpdated
    }
  }

  // Синхронизируем звонки
  const syncedCount = await syncCalls(calls)

  return {
    success: true,
    message: `Synced ${syncedCount} calls, updated ${recordingsUpdated} recordings`,
    synced: syncedCount,
    recordingsUpdated,
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
