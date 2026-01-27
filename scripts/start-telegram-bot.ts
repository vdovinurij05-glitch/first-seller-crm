import 'dotenv/config'
import { bot } from '../src/services/telegram'

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN

if (!TELEGRAM_BOT_TOKEN || TELEGRAM_BOT_TOKEN === 'YOUR_TELEGRAM_BOT_TOKEN') {
  console.error('❌ TELEGRAM_BOT_TOKEN не найден или не настроен в .env файле')
  console.error('Получите токен у @BotFather в Telegram')
  process.exit(1)
}

async function startPolling() {
  try {
    console.log('🚀 Запуск Telegram бота в polling режиме...')
    console.log('📱 Токен:', TELEGRAM_BOT_TOKEN!.substring(0, 10) + '...')

    // Сначала удаляем webhook если он есть
    console.log('🗑️  Удаление webhook (если установлен)...')
    await fetch(
      `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/deleteWebhook`,
      { method: 'POST' }
    )

    console.log('✅ Webhook удален')
    console.log('⏳ Запуск бота...')

    // Запускаем бота
    await bot.start()

    console.log('✅ Бот успешно запущен!')
    console.log('💬 Теперь можете писать боту в Telegram')
    console.log('🛑 Для остановки нажмите Ctrl+C')
  } catch (error) {
    console.error('❌ Ошибка при запуске бота:', error)
    process.exit(1)
  }
}

// Graceful shutdown
process.once('SIGINT', () => {
  console.log('\n🛑 Остановка бота...')
  bot.stop()
  process.exit(0)
})

process.once('SIGTERM', () => {
  console.log('\n🛑 Остановка бота...')
  bot.stop()
  process.exit(0)
})

startPolling()
