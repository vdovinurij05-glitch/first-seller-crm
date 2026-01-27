import crypto from 'crypto'
import axios from 'axios'
import prisma from '@/lib/prisma'

const MANGO_API_URL = 'https://app.mango-office.ru/vpbx'

interface MangoConfig {
  apiKey: string
  apiSalt: string
  vpnId: string
}

const config: MangoConfig = {
  apiKey: process.env.MANGO_API_KEY || '',
  apiSalt: process.env.MANGO_API_SALT || '',
  vpnId: process.env.MANGO_VPN_ID || ''
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

// Получение статистики звонков
export async function getCallsStatistics(
  dateFrom: Date,
  dateTo: Date
): Promise<any> {
  const data = {
    date_from: Math.floor(dateFrom.getTime() / 1000),
    date_to: Math.floor(dateTo.getTime() / 1000)
  }

  return mangoRequest('/stats/request', data)
}

// Получение записи звонка
export async function getCallRecording(recordingId: string): Promise<string | null> {
  try {
    const data = {
      recording_id: recordingId,
      action: 'download'
    }

    const response = await mangoRequest('/queries/recording/post', data)
    return response.url || null
  } catch (error) {
    console.error('Error getting call recording:', error)
    return null
  }
}

// Инициация исходящего звонка (click-to-call)
export async function initiateCall(
  fromExtension: string,
  toNumber: string,
  managerId?: string
): Promise<string | null> {
  try {
    const data = {
      command_id: crypto.randomUUID(),
      from: {
        extension: fromExtension
      },
      to_number: toNumber
    }

    const response = await mangoRequest('/commands/callback', data)

    // Сохраняем звонок в БД
    if (response.call_id) {
      // Ищем контакт по номеру
      const contact = await prisma.contact.findFirst({
        where: { phone: toNumber }
      })

      await prisma.call.create({
        data: {
          mangoCallId: response.call_id,
          direction: 'OUT',
          phone: toNumber,
          status: 'INITIATED',
          contactId: contact?.id,
          managerId
        }
      })
    }

    return response.call_id || null
  } catch (error) {
    console.error('Error initiating call:', error)
    return null
  }
}

// Обработка webhook от Mango (события звонков)
export interface MangoCallEvent {
  entry_id: string
  call_id: string
  timestamp: number
  seq: number
  call_state: 'Appeared' | 'Connected' | 'Disconnected' | 'OnHold' | 'Resumed'
  location: 'ivr' | 'queue' | 'ext' | 'abonent'
  from: {
    number: string
    extension?: string
  }
  to: {
    number: string
    extension?: string
  }
  dct?: {
    type: number
  }
  disconnect_reason?: number
  call_direction?: 1 | 2 // 1 - входящий, 2 - исходящий
}

export async function handleMangoWebhook(event: MangoCallEvent): Promise<void> {
  const { call_id, call_state, from, to, timestamp, disconnect_reason } = event

  try {
    // Определяем направление и номер клиента
    const isIncoming = event.call_direction === 1
    const clientPhone = isIncoming ? from.number : to.number

    // Ищем контакт по номеру
    const contact = await prisma.contact.findFirst({
      where: { phone: clientPhone }
    })

    // Находим или создаем запись о звонке
    let call = await prisma.call.findUnique({
      where: { mangoCallId: call_id }
    })

    if (!call) {
      // Создаем новый звонок
      call = await prisma.call.create({
        data: {
          mangoCallId: call_id,
          direction: isIncoming ? 'IN' : 'OUT',
          phone: clientPhone,
          status: 'INITIATED',
          contactId: contact?.id,
          createdAt: new Date(timestamp * 1000)
        }
      })

      // Если контакт не найден, создаем новый
      if (!contact && isIncoming) {
        await prisma.contact.create({
          data: {
            name: `Звонок: ${clientPhone}`,
            phone: clientPhone,
            source: 'phone',
            status: 'NEW'
          }
        })
      }
    }

    // Обновляем статус звонка
    switch (call_state) {
      case 'Connected':
        await prisma.call.update({
          where: { id: call.id },
          data: {
            status: 'ANSWERED',
            answeredAt: new Date(timestamp * 1000)
          }
        })
        break

      case 'Disconnected':
        const status = disconnect_reason === 1103 ? 'MISSED' :
                       disconnect_reason === 1102 ? 'BUSY' :
                       call.status === 'ANSWERED' ? 'COMPLETED' : 'MISSED'

        await prisma.call.update({
          where: { id: call.id },
          data: {
            status,
            endedAt: new Date(timestamp * 1000),
            duration: call.answeredAt
              ? Math.floor((timestamp * 1000 - call.answeredAt.getTime()) / 1000)
              : 0
          }
        })
        break
    }
  } catch (error) {
    console.error('Error handling Mango webhook:', error)
  }
}

// Обработка записи разговора
export interface MangoRecordingEvent {
  entry_id: string
  call_id: string
  recording_id: string
  start: number
  finish: number
}

export async function handleMangoRecording(event: MangoRecordingEvent): Promise<void> {
  const { call_id, recording_id } = event

  try {
    // Получаем URL записи
    const recordingUrl = await getCallRecording(recording_id)

    if (recordingUrl) {
      await prisma.call.update({
        where: { mangoCallId: call_id },
        data: { recordingUrl }
      })
    }
  } catch (error) {
    console.error('Error handling Mango recording:', error)
  }
}

export { config as mangoConfig }
