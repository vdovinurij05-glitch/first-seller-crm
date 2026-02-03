import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

// POST /api/admin/setup-pipelines - Настроить воронки
export async function POST() {
  try {
    console.log('🔧 Настройка воронок...')

    // Получить все воронки
    const pipelines = await prisma.pipeline.findMany({
      include: {
        stages: {
          orderBy: { order: 'asc' }
        }
      }
    })

    console.log(`Найдено воронок: ${pipelines.length}`)

    // Переименовать "Отдел продаж" в "Продвижение МП"
    const salesPipeline = pipelines.find(p => p.name === 'Отдел продаж')
    if (salesPipeline) {
      console.log('✏️ Переименовываю "Отдел продаж" в "Продвижение МП"...')
      await prisma.pipeline.update({
        where: { id: salesPipeline.id },
        data: { name: 'Продвижение МП' }
      })
      console.log('✅ Переименовано!')
    }

    // Создать воронку "Фабрика Контента" если её нет
    const contentFactory = pipelines.find(p => p.name === 'Фабрика Контента')
    if (!contentFactory) {
      console.log('✨ Создаю воронку "Фабрика Контента"...')
      await prisma.pipeline.create({
        data: {
          name: 'Фабрика Контента',
          slug: 'content-factory',
          stages: {
            create: [
              { name: 'Новая заявка', slug: 'new', order: 0, color: '#3B82F6' },
              { name: 'Квалификация', slug: 'qualification', order: 1, color: '#8B5CF6' },
              { name: 'Подготовка ТЗ', slug: 'brief-preparation', order: 2, color: '#F59E0B' },
              { name: 'В производстве', slug: 'in-production', order: 3, color: '#10B981' },
              { name: 'На ревью', slug: 'review', order: 4, color: '#06B6D4' },
              { name: 'Завершено', slug: 'completed', order: 5, color: '#22C55E' },
              { name: 'Отклонено', slug: 'rejected', order: 6, color: '#EF4444' }
            ]
          }
        }
      })
      console.log('✅ Создана воронка "Фабрика Контента"')
    } else {
      console.log('✅ Воронка "Фабрика Контента" уже существует')
    }

    // Получить итоговые воронки
    const updatedPipelines = await prisma.pipeline.findMany({
      include: {
        stages: {
          orderBy: { order: 'asc' }
        }
      }
    })

    return NextResponse.json({
      success: true,
      message: 'Воронки настроены',
      pipelines: updatedPipelines.map(p => ({
        id: p.id,
        name: p.name,
        slug: p.slug,
        stages: p.stages.map(s => ({ name: s.name, slug: s.slug, order: s.order }))
      }))
    })
  } catch (error) {
    console.error('Ошибка настройки воронок:', error)
    return NextResponse.json(
      { error: 'Ошибка настройки воронок' },
      { status: 500 }
    )
  }
}
