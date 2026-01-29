import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

// Маппинг русских названий колонок на английские
const columnMapping: Record<string, string> = {
  'Название': 'title',
  'название': 'title',
  'Title': 'title',
  'title': 'title',
  'Сумма': 'amount',
  'сумма': 'amount',
  'Amount': 'amount',
  'amount': 'amount',
  'Контакт (телефон)': 'contactPhone',
  'Контакт': 'contactPhone',
  'контакт': 'contactPhone',
  'Телефон': 'contactPhone',
  'телефон': 'contactPhone',
  'Contact': 'contactPhone',
  'contact': 'contactPhone',
  'Phone': 'contactPhone',
  'phone': 'contactPhone',
  'Этап': 'stage',
  'этап': 'stage',
  'Stage': 'stage',
  'stage': 'stage',
  'Описание': 'description',
  'описание': 'description',
  'Description': 'description',
  'description': 'description'
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

    if (row.title) { // Только если есть название
      results.push(row)
    }
  }

  return results
}

// Нормализация телефона для поиска контакта
function normalizePhone(phone: string): string {
  // Убираем все кроме цифр
  const digits = phone.replace(/\D/g, '')

  // Если 11 цифр и начинается с 7 или 8 - убираем первую
  if (digits.length === 11 && (digits.startsWith('7') || digits.startsWith('8'))) {
    return digits.slice(1)
  }
  // Если 10 цифр - возвращаем как есть
  if (digits.length === 10) return digits
  return digits
}

// Генерация вариантов телефона для поиска
function getPhoneVariants(phone: string): string[] {
  const normalized = normalizePhone(phone)
  if (!normalized || normalized.length < 10) return []

  const variants = [
    phone, // оригинал
    normalized, // только 10 цифр
    `+7${normalized}`, // +7...
    `7${normalized}`, // 7...
    `8${normalized}`, // 8...
    `+7 ${normalized.slice(0, 3)} ${normalized.slice(3, 6)}-${normalized.slice(6, 8)}-${normalized.slice(8)}`, // +7 999 123-45-67
  ]

  return [...new Set(variants)]
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const file = formData.get('file') as File
    const pipelineId = formData.get('pipelineId') as string

    if (!file) {
      return NextResponse.json(
        { error: 'Файл не найден' },
        { status: 400 }
      )
    }

    if (!pipelineId) {
      return NextResponse.json(
        { error: 'ID воронки не указан' },
        { status: 400 }
      )
    }

    // Получаем воронку с этапами
    const pipeline = await prisma.pipeline.findUnique({
      where: { id: pipelineId },
      include: { stages: true }
    })

    if (!pipeline) {
      return NextResponse.json(
        { error: 'Воронка не найдена' },
        { status: 404 }
      )
    }

    const validStageSlugs = pipeline.stages.map(s => s.slug)
    const defaultStage = pipeline.stages.find(s => s.isDefault)?.slug || pipeline.stages[0]?.slug || 'NEW'

    const fileName = file.name.toLowerCase()
    const text = await file.text()

    let deals: Record<string, string>[] = []

    if (fileName.endsWith('.csv')) {
      deals = parseCSV(text)
    } else if (fileName.endsWith('.xls') || fileName.endsWith('.xlsx')) {
      // Для XLS/XLSX парсим как CSV (временное решение)
      deals = parseCSV(text)
    } else {
      return NextResponse.json(
        { error: 'Неподдерживаемый формат файла. Используйте CSV, XLS или XLSX' },
        { status: 400 }
      )
    }

    if (deals.length === 0) {
      return NextResponse.json(
        { error: 'Файл пустой или неверный формат' },
        { status: 400 }
      )
    }

    // Импортируем сделки в базу
    let imported = 0
    let updated = 0
    const errors: string[] = []

    // Получаем максимальный order для сделок в воронке
    const maxOrderDeal = await prisma.deal.findFirst({
      where: { pipelineId },
      orderBy: { order: 'desc' }
    })
    let currentOrder = (maxOrderDeal?.order || 0) + 1

    for (const deal of deals) {
      try {
        // Определяем этап
        let stage = deal.stage || defaultStage
        if (!validStageSlugs.includes(stage)) {
          stage = defaultStage
        }

        // Ищем контакт по телефону если указан
        let contactId: string | null = null
        if (deal.contactPhone) {
          const phoneVariants = getPhoneVariants(deal.contactPhone)
          console.log(`🔍 Поиск контакта по телефону: ${deal.contactPhone}, варианты:`, phoneVariants)

          if (phoneVariants.length > 0) {
            // Ищем контакт по любому из вариантов телефона
            const contact = await prisma.contact.findFirst({
              where: {
                OR: phoneVariants.map(variant => ({ phone: variant }))
              }
            })

            if (contact) {
              contactId = contact.id
              console.log(`✅ Найден контакт: ${contact.name} (${contact.phone})`)
            } else {
              console.log(`❌ Контакт не найден для телефона: ${deal.contactPhone}`)
            }
          }
        }

        // Парсим сумму
        const amount = parseInt(deal.amount?.replace(/\D/g, '') || '0', 10)

        // Проверяем, существует ли сделка с таким названием в этой воронке
        const existingDeal = await prisma.deal.findFirst({
          where: {
            title: deal.title,
            pipelineId
          }
        })

        if (existingDeal) {
          // Обновляем существующую сделку
          await prisma.deal.update({
            where: { id: existingDeal.id },
            data: {
              amount,
              stage,
              description: deal.description || existingDeal.description,
              contactId: contactId || existingDeal.contactId
            }
          })
          updated++
          console.log(`📝 Обновлена сделка: ${deal.title}`)
        } else {
          // Создаем новую сделку
          await prisma.deal.create({
            data: {
              title: deal.title,
              amount,
              stage,
              probability: 50,
              description: deal.description || null,
              contactId,
              pipelineId,
              order: currentOrder++
            }
          })
          imported++
          console.log(`➕ Создана сделка: ${deal.title}`)
        }
      } catch (error) {
        console.error('Error importing deal:', error)
        errors.push(`Ошибка импорта: ${deal.title}`)
      }
    }

    return NextResponse.json({
      success: true,
      imported,
      updated,
      total: deals.length,
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
