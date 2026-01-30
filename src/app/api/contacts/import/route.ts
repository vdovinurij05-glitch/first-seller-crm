import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

// Маппинг русских названий колонок на английские
const columnMapping: Record<string, string> = {
  'Имя': 'name',
  'имя': 'name',
  'Name': 'name',
  'name': 'name',
  'Email': 'email',
  'email': 'email',
  'Почта': 'email',
  'почта': 'email',
  'Телефон': 'phone',
  'телефон': 'phone',
  'Phone': 'phone',
  'phone': 'phone',
  'Комментарий': 'notes',
  'комментарий': 'notes',
  'Notes': 'notes',
  'notes': 'notes',
  'Заметки': 'notes',
  'заметки': 'notes',
  'Telegram': 'telegramUsername',
  'telegram': 'telegramUsername',
  'Телеграм': 'telegramUsername',
  'телеграм': 'telegramUsername',
  'TG': 'telegramUsername',
  'tg': 'telegramUsername',
  'Ник': 'telegramUsername',
  'ник': 'telegramUsername',
  'Username': 'telegramUsername',
  'username': 'telegramUsername'
}

// Парсинг CSV
function parseCSV(text: string): Record<string, string>[] {
  // Удаляем BOM если есть
  const cleanText = text.replace(/^\ufeff/, '')
  const lines = cleanText.trim().split('\n')
  if (lines.length < 2) return []

  // Парсим заголовки с учётом разделителя (запятая или точка с запятой)
  const separator = lines[0].includes(';') ? ';' : ','
  const rawHeaders = lines[0].split(separator).map(h => h.trim().replace(/^["']|["']$/g, ''))

  // Маппим заголовки
  const headers = rawHeaders.map(h => columnMapping[h] || h)
  const results: Record<string, string>[] = []

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim()
    if (!line) continue

    const values = line.split(separator).map(v => v.trim().replace(/^["']|["']$/g, ''))
    const row: Record<string, string> = {}

    headers.forEach((header, index) => {
      row[header] = values[index] || ''
    })

    if (row.name) { // Только если есть имя
      results.push(row)
    }
  }

  return results
}

// Парсинг XLS/XLSX (базовый парсер для простых файлов)
function parseXLS(text: string): Record<string, string>[] {
  // Для полноценной работы с XLS нужна библиотека xlsx
  // Пока возвращаем пустой массив, можно установить библиотеку позже
  return []
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const file = formData.get('file') as File

    if (!file) {
      return NextResponse.json(
        { error: 'Файл не найден' },
        { status: 400 }
      )
    }

    const fileName = file.name.toLowerCase()
    const text = await file.text()

    let contacts: Record<string, string>[] = []

    if (fileName.endsWith('.csv')) {
      contacts = parseCSV(text)
    } else if (fileName.endsWith('.xls') || fileName.endsWith('.xlsx')) {
      // Для XLS/XLSX нужна библиотека xlsx
      // Пока парсим как CSV (многие Excel можно сохранить как CSV)
      contacts = parseCSV(text)
    } else {
      return NextResponse.json(
        { error: 'Неподдерживаемый формат файла. Используйте CSV, XLS или XLSX' },
        { status: 400 }
      )
    }

    if (contacts.length === 0) {
      return NextResponse.json(
        { error: 'Файл пустой или неверный формат' },
        { status: 400 }
      )
    }

    // Импортируем контакты в базу
    let imported = 0
    const errors: string[] = []

    for (const contact of contacts) {
      try {
        // Проверяем, не существует ли уже контакт с таким телефоном
        if (contact.phone) {
          const existing = await prisma.contact.findFirst({
            where: { phone: contact.phone }
          })

          if (existing) {
            errors.push(`Контакт с телефоном ${contact.phone} уже существует`)
            continue
          }
        }

        // Создаем контакт
        await prisma.contact.create({
          data: {
            name: contact.name,
            phone: contact.phone || null,
            email: contact.email || null,
            telegramUsername: contact.telegramUsername || null,
            status: contact.status || 'NEW',
            notes: contact.notes || null,
            source: 'import'
          }
        })

        imported++
      } catch (error) {
        console.error('Error importing contact:', error)
        errors.push(`Ошибка импорта: ${contact.name}`)
      }
    }

    return NextResponse.json({
      success: true,
      imported,
      total: contacts.length,
      errors: errors.length > 0 ? errors : undefined
    })
  } catch (error) {
    console.error('Import error:', error)
    return NextResponse.json(
      { error: 'Ошибка при импорте файла' },
      { status: 500 }
    )
  }
}
