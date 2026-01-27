import crypto from 'crypto'

// Конфигурация Mango Office
export const MANGO_CONFIG = {
  vpbxApiKey: process.env.MANGO_VPBX_API_KEY || 'lusswwlovwg779dq6d79y0efyr2gii2r',
  vpbxApiSalt: process.env.MANGO_VPBX_API_SALT || 'qh0fz5t2w0hvjls4y485es0zh44u045b',
  apiUrl: 'https://app.mango-office.ru/vpbx'
}

/**
 * Создает подпись для запросов к Mango Office API
 * @param apiKey - Уникальный код АТС
 * @param apiSalt - Ключ для создания подписи
 * @param json - JSON строка с параметрами запроса
 */
export function createMangoSignature(apiKey: string, apiSalt: string, json: string): string {
  const hash = crypto.createHash('sha256')
  hash.update(apiKey + json + apiSalt)
  return hash.digest('hex')
}

/**
 * Отправляет запрос к Mango Office API
 */
export async function mangoApiRequest(commandId: string, params: Record<string, any> = {}) {
  const json = JSON.stringify(params)
  const sign = createMangoSignature(MANGO_CONFIG.vpbxApiKey, MANGO_CONFIG.vpbxApiSalt, json)

  const url = new URL(`${MANGO_CONFIG.apiUrl}/commands/callback`)
  url.searchParams.append('vpbx_api_key', MANGO_CONFIG.vpbxApiKey)
  url.searchParams.append('sign', sign)
  url.searchParams.append('json', json)
  url.searchParams.append('command_id', commandId)

  const response = await fetch(url.toString(), {
    method: 'POST'
  })

  if (!response.ok) {
    throw new Error(`Mango API error: ${response.statusText}`)
  }

  return response.json()
}

/**
 * Инициирует исходящий звонок через Mango Office
 * @param fromExtension - Внутренний номер сотрудника
 * @param toNumber - Номер клиента для звонка
 * @param lineNumber - Внешний номер для звонка (опционально)
 */
export async function initiateCall(fromExtension: string, toNumber: string, lineNumber?: string) {
  const params: Record<string, any> = {
    from_extension: fromExtension,
    to_number: toNumber
  }

  if (lineNumber) {
    params.line_number = lineNumber
  }

  return mangoApiRequest('call', params)
}

/**
 * Получает статистику звонков
 */
export async function getCallStats(dateFrom: Date, dateTo: Date) {
  const params = {
    date_from: Math.floor(dateFrom.getTime() / 1000),
    date_to: Math.floor(dateTo.getTime() / 1000),
    fields: 'start,finish,from_number,to_number,disconnect_reason,entry_id'
  }

  return mangoApiRequest('stats', params)
}

/**
 * Получает запись звонка
 */
export async function getRecording(recordingId: string) {
  const params = {
    recording_id: recordingId
  }

  return mangoApiRequest('recording', params)
}

/**
 * Типы событий от Mango Office
 */
export enum MangoEventType {
  CALL = 'call', // Событие звонка
  RECORDING = 'recording', // Запись разговора
  SMS = 'sms', // SMS сообщение
  SUMMARY = 'summary' // Итоги
}

/**
 * Направление звонка
 */
export enum CallDirection {
  IN = 'in', // Входящий
  OUT = 'out' // Исходящий
}

/**
 * Интерфейс события звонка от Mango
 */
export interface MangoCallEvent {
  call_id: string
  timestamp: number
  seq: number

  // Номера
  from: {
    number: string
    extension?: string
    name?: string
  }
  to: {
    number: string
    extension?: string
    name?: string
  }

  // Детали
  direction: 'in' | 'out'
  location: string
  disconnect_reason?: string
  entry_id?: string

  // Запись
  recording_id?: string

  // Состояние
  create?: string
  connected?: string
  disconnected?: string
}
