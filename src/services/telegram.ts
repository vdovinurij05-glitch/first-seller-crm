import { Bot, Context, webhookCallback } from 'grammy'
import prisma from '@/lib/prisma'
import fs from 'fs/promises'
import * as fsSync from 'fs'
import path from 'path'
import https from 'https'

// Инициализация бота
const bot = new Bot(process.env.TELEGRAM_BOT_TOKEN || '')

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
    const fileUrl = `https://api.telegram.org/file/bot${process.env.TELEGRAM_BOT_TOKEN}/${file.file_path}`

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

    console.log(`✓ Получено текстовое сообщение от ${contact.name}`)

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
    const fileId = photo[photo.length - 1].file_id // Берем самое большое фото

    // Скачиваем файл
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

    // Скачиваем файл
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

    // Скачиваем голосовое сообщение
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

    // Скачиваем аудио
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

    // Скачиваем видео
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

    // Скачиваем видео-заметку
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

// Отправка сообщения в Telegram
export async function sendTelegramMessage(
  telegramId: string,
  text: string,
  managerId?: string
): Promise<number | null> {
  try {
    const result = await bot.api.sendMessage(telegramId, text)

    // Сохраняем исходящее сообщение
    const contact = await prisma.contact.findUnique({
      where: { telegramId }
    })

    if (contact) {
      await prisma.message.create({
        data: {
          content: text,
          type: 'TEXT',
          direction: 'OUT',
          telegramMsgId: result.message_id,
          contactId: contact.id,
          managerId
        }
      })
    }

    return result.message_id
  } catch (error) {
    console.error('Error sending telegram message:', error)
    return null
  }
}

// Отправка файла в Telegram
export async function sendTelegramFile(
  telegramId: string,
  filePath: string,
  caption?: string,
  managerId?: string
): Promise<number | null> {
  try {
    // Определяем тип файла по расширению
    const ext = path.extname(filePath).toLowerCase()
    const fullPath = path.join(process.cwd(), 'public', filePath)

    let result: any

    if (['.jpg', '.jpeg', '.png', '.gif'].includes(ext)) {
      result = await bot.api.sendPhoto(telegramId, fullPath, { caption })
    } else if (['.mp4', '.avi', '.mov'].includes(ext)) {
      result = await bot.api.sendVideo(telegramId, fullPath, { caption })
    } else if (['.mp3', '.wav', '.ogg'].includes(ext)) {
      result = await bot.api.sendAudio(telegramId, fullPath, { caption })
    } else {
      result = await bot.api.sendDocument(telegramId, fullPath, { caption })
    }

    // Сохраняем исходящее сообщение
    const contact = await prisma.contact.findUnique({
      where: { telegramId }
    })

    if (contact) {
      await prisma.message.create({
        data: {
          content: caption || '[Файл]',
          type: 'DOCUMENT',
          direction: 'OUT',
          telegramMsgId: result.message_id,
          contactId: contact.id,
          managerId
        }
      })
    }

    return result.message_id
  } catch (error) {
    console.error('Error sending telegram file:', error)
    return null
  }
}

// Webhook handler для Next.js API route (закомментировано, т.к. требуется HTTPS)
// export const telegramWebhook = webhookCallback(bot, 'std/http')

// Запуск бота в polling режиме
export async function startBot() {
  await bot.start()
  console.log('✅ Telegram bot started in polling mode')
}

export { bot }
