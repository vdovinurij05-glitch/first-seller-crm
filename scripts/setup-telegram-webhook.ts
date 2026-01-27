import 'dotenv/config'

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN
const WEBHOOK_URL = process.env.TELEGRAM_WEBHOOK_URL || 'https://your-domain.com/api/telegram/webhook'

if (!TELEGRAM_BOT_TOKEN) {
  console.error('❌ TELEGRAM_BOT_TOKEN не найден в .env файле')
  process.exit(1)
}

async function setupWebhook() {
  try {
    console.log('🔧 Настройка Telegram webhook...')
    console.log(`📍 Webhook URL: ${WEBHOOK_URL}`)

    // Устанавливаем webhook
    const response = await fetch(
      `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/setWebhook`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: WEBHOOK_URL,
          allowed_updates: [
            'message',
            'edited_message',
            'channel_post',
            'edited_channel_post'
          ]
        })
      }
    )

    const data = await response.json()

    if (data.ok) {
      console.log('✅ Webhook успешно установлен!')
      console.log('📋 Ответ Telegram:', data.result)

      // Получаем информацию о webhook
      const infoResponse = await fetch(
        `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getWebhookInfo`
      )
      const infoData = await infoResponse.json()

      if (infoData.ok) {
        console.log('\n📊 Информация о webhook:')
        console.log('  URL:', infoData.result.url)
        console.log('  Pending updates:', infoData.result.pending_update_count)
        console.log('  Last error:', infoData.result.last_error_message || 'Нет ошибок')
      }
    } else {
      console.error('❌ Ошибка при установке webhook:', data.description)
      process.exit(1)
    }
  } catch (error) {
    console.error('❌ Ошибка:', error)
    process.exit(1)
  }
}

async function removeWebhook() {
  try {
    console.log('🗑️  Удаление Telegram webhook...')

    const response = await fetch(
      `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/deleteWebhook`,
      {
        method: 'POST'
      }
    )

    const data = await response.json()

    if (data.ok) {
      console.log('✅ Webhook успешно удален!')
    } else {
      console.error('❌ Ошибка при удалении webhook:', data.description)
    }
  } catch (error) {
    console.error('❌ Ошибка:', error)
  }
}

// Парсим аргументы командной строки
const command = process.argv[2]

if (command === 'remove' || command === 'delete') {
  removeWebhook()
} else {
  setupWebhook()
}
