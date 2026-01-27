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

// Получение истории звонков контакта из Mango Office
export async function getContactCallHistory(
  phoneNumber: string,
  dateFrom?: Date,
  dateTo?: Date
): Promise<any[]> {
  try {
    const from = dateFrom || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) // 30 дней назад
    const to = dateTo || new Date()

    const data = {
      date_from: Math.floor(from.getTime() / 1000),
      date_to: Math.floor(to.getTime() / 1000),
      fields: 'start,finish,from_number,to_number,disconnect_reason,line_number,location,entry_id,talk_duration',
      request: {
        or: [
          { from_number: phoneNumber },
          { to_number: phoneNumber }
        ]
      }
    }

    const response = await mangoRequest('/stats/request', data)
    return response.data || []
  } catch (error) {
    console.error('Error getting contact call history:', error)
    return []
  }
}

// Синхронизация истории звонков контакта с базой данных
export async function syncContactCallHistory(
  contactId: string,
  phoneNumber: string
): Promise<void> {
  try {
    console.log(`🔄 Syncing call history for contact ${contactId}, phone ${phoneNumber}`)

    // Получаем историю звонков за последние 30 дней
    const callHistory = await getContactCallHistory(phoneNumber)

    if (!callHistory || callHistory.length === 0) {
      console.log('No call history found')
      return
    }

    console.log(`📞 Found ${callHistory.length} calls in Mango for ${phoneNumber}`)

    // Синхронизируем каждый звонок
    for (const mangoCall of callHistory) {
      try {
        // Проверяем, существует ли уже этот звонок
        const existingCall = await prisma.call.findFirst({
          where: { externalId: mangoCall.entry_id }
        })

        if (existingCall) {
          continue
        }

        // Определяем направление
        const isIncoming = mangoCall.to_number === phoneNumber ||
                          mangoCall.from_number !== phoneNumber

        // Определяем статус
        let status = 'COMPLETED'
        if (mangoCall.disconnect_reason === 1103) status = 'MISSED'
        else if (mangoCall.disconnect_reason === 1102) status = 'BUSY'
        else if (!mangoCall.talk_duration) status = 'MISSED'

        // Создаем запись звонка
        await prisma.call.create({
          data: {
            externalId: mangoCall.entry_id,
            direction: isIncoming ? 'IN' : 'OUT',
            fromNumber: mangoCall.from_number,
            toNumber: mangoCall.to_number,
            status,
            startTime: new Date(mangoCall.start * 1000),
            endTime: mangoCall.finish ? new Date(mangoCall.finish * 1000) : new Date(),
            duration: mangoCall.talk_duration || 0,
            result: mangoCall.disconnect_reason ? String(mangoCall.disconnect_reason) : 'completed',
            contactId
          }
        })

        console.log(`✅ Created call record for ${mangoCall.entry_id}`)
      } catch (error) {
        console.error(`Error syncing call ${mangoCall.entry_id}:`, error)
      }
    }

    console.log(`✅ Sync completed for contact ${contactId}`)
  } catch (error) {
    console.error('Error syncing contact call history:', error)
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

    // Находим активную сделку для существующего контакта
    let activeDeal = null
    if (contact) {
      activeDeal = await prisma.deal.findFirst({
        where: {
          contactId: contact.id,
          closedAt: null
        },
        orderBy: {
          updatedAt: 'desc'
        }
      })
    }

    // Находим или создаем запись о звонке
    let call = await prisma.call.findUnique({
      where: { mangoCallId: call_id }
    })

    if (!call) {
      // Создаем новый звонок
      call = await prisma.call.create({
        data: {
          mangoCallId: call_id,
          externalId: event.entry_id,
          direction: isIncoming ? 'IN' : 'OUT',
          phone: clientPhone,
          fromNumber: from.number,
          toNumber: to.number,
          status: 'INITIATED',
          contactId: contact?.id,
          dealId: activeDeal?.id, // Связываем звонок со сделкой
          startTime: new Date(timestamp * 1000),
          createdAt: new Date(timestamp * 1000)
        }
      })

      // Если контакт не найден и звонок входящий, создаем новый контакт и сделку
      if (!contact && isIncoming) {
        const newContact = await prisma.contact.create({
          data: {
            name: `Звонок: ${clientPhone}`,
            phone: clientPhone,
            source: 'PHONE',
            status: 'NEW'
          }
        })

        // Создаем сделку для нового контакта
        const newDeal = await prisma.deal.create({
          data: {
            title: `Входящий звонок от ${clientPhone}`,
            amount: 0,
            stage: 'NEW',
            probability: 50,
            description: `Автоматически создана при входящем звонке\nНомер: ${clientPhone}\nДата звонка: ${new Date(timestamp * 1000).toLocaleString('ru-RU')}`,
            contactId: newContact.id
          }
        })

        // Обновляем звонок, связывая с новым контактом и сделкой
        await prisma.call.update({
          where: { id: call.id },
          data: {
            contactId: newContact.id,
            dealId: newDeal.id
          }
        })

        // Синхронизируем историю звонков из Mango
        setTimeout(async () => {
          await syncContactCallHistory(newContact.id, clientPhone)
        }, 1000)

        console.log(`✅ Created new contact ${newContact.id} and deal ${newDeal.id} for incoming call`)
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

        const duration = call.answeredAt
          ? Math.floor((timestamp * 1000 - call.answeredAt.getTime()) / 1000)
          : 0

        await prisma.call.update({
          where: { id: call.id },
          data: {
            status,
            endedAt: new Date(timestamp * 1000),
            duration
          }
        })

        // Добавляем системное событие в сделку
        if (call.contactId) {
          const activeDeal = await prisma.deal.findFirst({
            where: {
              contactId: call.contactId,
              closedAt: null
            },
            orderBy: {
              updatedAt: 'desc'
            }
          })

          if (activeDeal) {
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
                  callId: call_id,
                  callRecordId: call.id, // ID записи в БД для получения аудио и транскрибации
                  entryId: event.entry_id,
                  duration,
                  disconnectReason: disconnect_reason,
                  status,
                  recordingUrl: call.recordingUrl || null // Ссылка на аудиозапись если есть
                }),
                dealId: activeDeal.id
              }
            })

            console.log(`✅ Created deal comment for call in deal ${activeDeal.id}`)
          }
        }

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
      // Обновляем звонок
      const call = await prisma.call.update({
        where: { mangoCallId: call_id },
        data: { recordingUrl }
      })

      console.log(`✅ Recording URL saved for call ${call_id}`)

      // Если звонок связан со сделкой, обновляем системное событие
      if (call.dealId) {
        // Находим системное событие о звонке в сделке
        const dealComment = await prisma.dealComment.findFirst({
          where: {
            dealId: call.dealId,
            type: 'SYSTEM_EVENT',
            metadata: {
              contains: call_id // Ищем по call_id в metadata
            }
          },
          orderBy: {
            createdAt: 'desc'
          }
        })

        if (dealComment) {
          // Обновляем metadata с URL записи
          const metadata = JSON.parse(dealComment.metadata || '{}')
          metadata.recordingUrl = recordingUrl
          metadata.recordingId = recording_id

          await prisma.dealComment.update({
            where: { id: dealComment.id },
            data: {
              metadata: JSON.stringify(metadata)
            }
          })

          console.log(`✅ Updated deal comment with recording URL`)

          // Запускаем транскрибацию в фоне (если настроено)
          setTimeout(async () => {
            await transcribeCallRecording(call.id, recordingUrl)
          }, 2000)
        }
      }
    }
  } catch (error) {
    console.error('Error handling Mango recording:', error)
  }
}

// Транскрибация звонка (заглушка для будущей интеграции)
export async function transcribeCallRecording(
  callId: string,
  recordingUrl: string
): Promise<void> {
  try {
    console.log(`🎙️ Transcription requested for call ${callId}`)
    console.log(`Recording URL: ${recordingUrl}`)

    // TODO: Здесь будет интеграция с OpenAI Whisper API или другим сервисом транскрибации
    // 1. Скачать аудиофайл по recordingUrl
    // 2. Отправить на транскрибацию (OpenAI Whisper, Google Speech-to-Text, и т.д.)
    // 3. Получить текст транскрибации
    // 4. Сохранить в CallTranscription
    // 5. Опционально: сделать анализ sentiment, извлечь ключевые слова
    // 6. Обновить системное событие в сделке с текстом транскрибации

    // Пример будущей реализации:
    // const audioBuffer = await downloadAudio(recordingUrl)
    // const transcription = await openai.audio.transcriptions.create({
    //   file: audioBuffer,
    //   model: 'whisper-1',
    //   language: 'ru'
    // })
    //
    // await prisma.callTranscription.create({
    //   data: {
    //     callId,
    //     text: transcription.text,
    //     summary: await generateSummary(transcription.text),
    //     sentiment: await analyzeSentiment(transcription.text),
    //     keywords: JSON.stringify(await extractKeywords(transcription.text))
    //   }
    // })

    console.log(`⏸️ Transcription skipped - not implemented yet`)
  } catch (error) {
    console.error('Error transcribing call recording:', error)
  }
}

export { config as mangoConfig }
