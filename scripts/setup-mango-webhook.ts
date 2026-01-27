// Скрипт для настройки webhook в Mango Office через API
// Запуск: npx tsx scripts/setup-mango-webhook.ts

import crypto from 'crypto'
import axios from 'axios'

const MANGO_CONFIG = {
  apiKey: 'lusswwlovwg779dq6d79y0efyr2gii2r',
  apiSalt: 'qh0fz5t2w0hvjls4y485es0zh44u045b',
  apiUrl: 'https://app.mango-office.ru/vpbx'
}

const WEBHOOK_URL = 'http://194.150.220.136:3000/api/mango/webhook'

function generateSign(json: string): string {
  const signString = MANGO_CONFIG.apiKey + json + MANGO_CONFIG.apiSalt
  return crypto.createHash('sha256').update(signString).digest('hex')
}

async function setupWebhook() {
  try {
    console.log('🔧 Настройка webhook в Mango Office...')
    console.log(`📍 URL: ${WEBHOOK_URL}`)

    const data = {
      url: WEBHOOK_URL,
      events: [
        'call_state_changed',  // События звонков
        'recording_ready'       // Готовность записи
      ]
    }

    const json = JSON.stringify(data)
    const sign = generateSign(json)

    const formData = new URLSearchParams()
    formData.append('vpbx_api_key', MANGO_CONFIG.apiKey)
    formData.append('sign', sign)
    formData.append('json', json)

    const response = await axios.post(
      `${MANGO_CONFIG.apiUrl}/config/webhook`,
      formData,
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      }
    )

    console.log('✅ Webhook настроен успешно!')
    console.log('Ответ:', response.data)
  } catch (error: any) {
    if (error.response) {
      console.error('❌ Ошибка API:', error.response.data)
      console.error('Статус:', error.response.status)
    } else {
      console.error('❌ Ошибка:', error.message)
    }
    console.log('\n💡 Попробуйте настроить webhook вручную через панель управления Mango Office')
    console.log('URL для webhook:', WEBHOOK_URL)
  }
}

setupWebhook()
