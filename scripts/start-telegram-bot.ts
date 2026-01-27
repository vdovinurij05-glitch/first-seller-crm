import 'dotenv/config'
import { Bot, Context } from 'grammy'
import prisma from '../src/lib/prisma'
import fs from 'fs/promises'
import * as fsSync from 'fs'
import path from 'path'
import https from 'https'

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN

if (!TELEGRAM_BOT_TOKEN || TELEGRAM_BOT_TOKEN === 'YOUR_TELEGRAM_BOT_TOKEN') {
  console.error('❌ TELEGRAM_BOT_TOKEN не найден или не настроен в .env файле')
  console.error('Получите токен у @BotFather в Telegram')
  process.exit(1)
}

// Создаем ОТДЕЛЬНЫЙ экземпляр бота для polling режима
const bot = new Bot(TELEGRAM_BOT_TOKEN)

// Типы для контекста
interface MessageContext extends Context {
  message: NonNullable<Context['message']>
}

// Директория для хранения файлов
const UPLOADS_DIR = path.join(process.cwd(), 'public', 'uploads', 'telegram')

// Создаем директорию для файлов если её нет
async function ensureUploadsDir() {
  try {
    await fs.mkdir(UPLOADS_DIR, { recursive: true })
  } catch (error) {
    console.error('Error creating uploads directory:', error)
  }
}

ensureUploadsDir()

// Функция для скачивания файла из Telegram
async function downloadTelegramFile(fileId: string, filename: string): Promise<string> {
  try {
    const file = await bot.api.getFile(fileId)
    const fileUrl = `https://api.telegram.org/file/bot${TELEGRAM_BOT_TOKEN}/${file.file_path}`

    const timestamp = Date.now()
    const safeFilename = `${timestamp}_${filename.replace(/[^a-zA-Z0-9._-]/g, '_')}`
    const filePath = path.join(UPLOADS_DIR, safeFilename)

    await new Promise<void>((resolve, reject) => {
      https.get(fileUrl, (response) => {
        const fileStream = fsSync.createWriteStream(filePath)
        response.pipe(fileStream)
        fileStream.on('finish', () => {
          fileStream.close()
          resolve()
        })
        fileStream.on('error', reject)
      }).on('error', reject)
    })

    return `/uploads/telegram/${safeFilename}`
  } catch (error) {
    console.error('Error downloading file from Telegram:', error)
    throw error
  }
}

// Функция для получения аватарки пользователя
async function getUserAvatar(userId: number): Promise<string | null> {
  try {
    const photos = await bot.api.getUserProfilePhotos(userId, { limit: 1 })

    if (photos.total_count > 0 && photos.photos[0]?.length > 0) {
      const photo = photos.photos[0][0]
      const avatarUrl = await downloadTelegramFile(photo.file_id, `avatar_${userId}.jpg`)
      return avatarUrl
    }

    return null
  } catch (error) {
    console.error('Error getting user avatar:', error)
    return null
  }
}

// Функция для создания контакта и сделки
async function createContactAndDeal(ctx: MessageContext) {
  const telegramId = ctx.from?.id.toString()
  const username = ctx.from?.username
  const firstName = ctx.from?.first_name
  const lastName = ctx.from?.last_name

  if (!telegramId) return null

  try {
    // Проверяем, существует ли контакт
    let contact = await prisma.contact.findUnique({
      where: { telegramId }
    })

    if (!contact) {
      // Получаем аватарку пользователя
      const avatar = await getUserAvatar(ctx.from!.id)

      // Создаем новый контакт
      contact = await prisma.contact.create({
        data: {
          telegramId,
          telegramUsername: username,
          name: [firstName, lastName].filter(Boolean).join(' ') || username || 'Telegram User',
          source: 'telegram',
          status: 'NEW'
        }
      })

      // Создаем сделку для нового контакта
      const dealTitle = `Обращение от ${contact.name}`

      await prisma.deal.create({
        data: {
          title: dealTitle,
          amount: 0,
          stage: 'NEW',
          probability: 50,
          description: `Автоматически создана при первом обращении через Telegram\nUsername: @${username || 'нет'}\nTelegram ID: ${telegramId}`,
          contactId: contact.id,
          order: 0
        }
      })

      console.log(`✓ Создан новый контакт и сделка для Telegram пользователя: ${contact.name}`)
    }

    return contact
  } catch (error) {
    console.error('Error creating contact and deal:', error)
    return null
  }
}

// Обработка входящих текстовых сообщений
bot.on('message:text', async (ctx: MessageContext) => {
  const telegramId = ctx.from?.id.toString()
  const text = ctx.message.text
  const messageId = ctx.message.message_id

  if (!telegramId || !text) return

  try {
    // Создаем контакт и сделку если нужно
    const contact = await createContactAndDeal(ctx)
    if (!contact) return

    // Сохраняем сообщение
    await prisma.message.create({
      data: {
        content: text,
        type: 'TEXT',
        direction: 'IN',
        telegramMsgId: messageId,
        contactId: contact.id
      }
    })

    console.log(`✓ Получено текстовое сообщение от ${contact.name}: ${text}`)

  } catch (error) {
    console.error('Error processing telegram message:', error)
  }
})

// Обработка фото
bot.on('message:photo', async (ctx) => {
  const telegramId = ctx.from?.id.toString()
  if (!telegramId) return

  try {
    const contact = await createContactAndDeal(ctx as MessageContext)
    if (!contact) return

    const photo = ctx.message.photo
    const fileId = photo[photo.length - 1].file_id

    const fileUrl = await downloadTelegramFile(fileId, 'photo.jpg')

    await prisma.message.create({
      data: {
        content: ctx.message.caption || '[Фото]',
        type: 'PHOTO',
        direction: 'IN',
        telegramMsgId: ctx.message.message_id,
        contactId: contact.id,
        attachments: {
          create: {
            filename: 'photo.jpg',
            url: fileUrl,
            mimeType: 'image/jpeg'
          }
        }
      }
    })

    console.log(`✓ Получено фото от ${contact.name}`)
  } catch (error) {
    console.error('Error processing telegram photo:', error)
  }
})

// Обработка документов
bot.on('message:document', async (ctx) => {
  const telegramId = ctx.from?.id.toString()
  if (!telegramId) return

  try {
    const contact = await createContactAndDeal(ctx as MessageContext)
    if (!contact) return

    const doc = ctx.message.document

    const fileUrl = await downloadTelegramFile(doc.file_id, doc.file_name || 'document')

    await prisma.message.create({
      data: {
        content: ctx.message.caption || `[Документ: ${doc.file_name}]`,
        type: 'DOCUMENT',
        direction: 'IN',
        telegramMsgId: ctx.message.message_id,
        contactId: contact.id,
        attachments: {
          create: {
            filename: doc.file_name || 'document',
            url: fileUrl,
            mimeType: doc.mime_type,
            size: doc.file_size
          }
        }
      }
    })

    console.log(`✓ Получен документ от ${contact.name}`)
  } catch (error) {
    console.error('Error processing telegram document:', error)
  }
})

// Обработка голосовых сообщений
bot.on('message:voice', async (ctx) => {
  const telegramId = ctx.from?.id.toString()
  if (!telegramId) return

  try {
    const contact = await createContactAndDeal(ctx as MessageContext)
    if (!contact) return

    const voice = ctx.message.voice

    const fileUrl = await downloadTelegramFile(voice.file_id, 'voice.ogg')

    await prisma.message.create({
      data: {
        content: '[Голосовое сообщение]',
        type: 'VOICE',
        direction: 'IN',
        telegramMsgId: ctx.message.message_id,
        contactId: contact.id,
        attachments: {
          create: {
            filename: 'voice.ogg',
            url: fileUrl,
            mimeType: voice.mime_type || 'audio/ogg',
            size: voice.file_size
          }
        }
      }
    })

    console.log(`✓ Получено голосовое сообщение от ${contact.name}`)
  } catch (error) {
    console.error('Error processing telegram voice:', error)
  }
})

// Обработка аудио
bot.on('message:audio', async (ctx) => {
  const telegramId = ctx.from?.id.toString()
  if (!telegramId) return

  try {
    const contact = await createContactAndDeal(ctx as MessageContext)
    if (!contact) return

    const audio = ctx.message.audio

    const fileUrl = await downloadTelegramFile(audio.file_id, audio.file_name || 'audio.mp3')

    await prisma.message.create({
      data: {
        content: ctx.message.caption || `[Аудио: ${audio.title || audio.file_name || 'audio'}]`,
        type: 'AUDIO',
        direction: 'IN',
        telegramMsgId: ctx.message.message_id,
        contactId: contact.id,
        attachments: {
          create: {
            filename: audio.file_name || 'audio.mp3',
            url: fileUrl,
            mimeType: audio.mime_type,
            size: audio.file_size
          }
        }
      }
    })

    console.log(`✓ Получено аудио от ${contact.name}`)
  } catch (error) {
    console.error('Error processing telegram audio:', error)
  }
})

// Обработка видео
bot.on('message:video', async (ctx) => {
  const telegramId = ctx.from?.id.toString()
  if (!telegramId) return

  try {
    const contact = await createContactAndDeal(ctx as MessageContext)
    if (!contact) return

    const video = ctx.message.video

    const fileUrl = await downloadTelegramFile(video.file_id, video.file_name || 'video.mp4')

    await prisma.message.create({
      data: {
        content: ctx.message.caption || '[Видео]',
        type: 'VIDEO',
        direction: 'IN',
        telegramMsgId: ctx.message.message_id,
        contactId: contact.id,
        attachments: {
          create: {
            filename: video.file_name || 'video.mp4',
            url: fileUrl,
            mimeType: video.mime_type,
            size: video.file_size
          }
        }
      }
    })

    console.log(`✓ Получено видео от ${contact.name}`)
  } catch (error) {
    console.error('Error processing telegram video:', error)
  }
})

// Обработка видео-заметок (кружочков)
bot.on('message:video_note', async (ctx) => {
  const telegramId = ctx.from?.id.toString()
  if (!telegramId) return

  try {
    const contact = await createContactAndDeal(ctx as MessageContext)
    if (!contact) return

    const videoNote = ctx.message.video_note

    const fileUrl = await downloadTelegramFile(videoNote.file_id, 'video_note.mp4')

    await prisma.message.create({
      data: {
        content: '[Видео-заметка]',
        type: 'VIDEO_NOTE',
        direction: 'IN',
        telegramMsgId: ctx.message.message_id,
        contactId: contact.id,
        attachments: {
          create: {
            filename: 'video_note.mp4',
            url: fileUrl,
            mimeType: 'video/mp4',
            size: videoNote.file_size
          }
        }
      }
    })

    console.log(`✓ Получена видео-заметка от ${contact.name}`)
  } catch (error) {
    console.error('Error processing telegram video note:', error)
  }
})

async function startPolling() {
  try {
    console.log('🚀 Запуск Telegram бота в polling режиме...')
    console.log('📱 Токен:', TELEGRAM_BOT_TOKEN!.substring(0, 10) + '...')

    // Сначала удаляем webhook если он есть
    console.log('🗑️  Удаление webhook (если установлен)...')
    await fetch(
      `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/deleteWebhook?drop_pending_updates=true`,
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
