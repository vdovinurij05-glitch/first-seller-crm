import prisma from '../src/lib/prisma'

async function main() {
  // Показать все воронки
  console.log('Текущие воронки:')
  const pipelines = await prisma.pipeline.findMany({
    include: {
      stages: {
        orderBy: { order: 'asc' }
      }
    }
  })

  pipelines.forEach(p => {
    console.log(`\n${p.name} (${p.id}):`)
    p.stages.forEach(s => {
      console.log(`  - ${s.name} (order: ${s.order})`)
    })
  })

  // Найти воронку "Отдел продаж" и переименовать
  const salesPipeline = pipelines.find(p => p.name === 'Отдел продаж')
  if (salesPipeline) {
    console.log('\n✏️ Переименовываю "Отдел продаж" в "Продвижение МП"...')
    await prisma.pipeline.update({
      where: { id: salesPipeline.id },
      data: { name: 'Продвижение МП' }
    })
    console.log('✅ Переименовано!')
  }

  // Создать воронку "Фабрика Контента" если её нет
  const contentFactory = pipelines.find(p => p.name === 'Фабрика Контента')
  if (!contentFactory) {
    console.log('\n✨ Создаю воронку "Фабрика Контента"...')
    const newPipeline = await prisma.pipeline.create({
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
    console.log('✅ Создана воронка:', newPipeline.name)
  } else {
    console.log('\n✅ Воронка "Фабрика Контента" уже существует')
  }

  console.log('\n\nИтоговые воронки:')
  const updatedPipelines = await prisma.pipeline.findMany({
    include: {
      stages: {
        orderBy: { order: 'asc' }
      }
    }
  })

  updatedPipelines.forEach(p => {
    console.log(`\n${p.name} (${p.id}):`)
    p.stages.forEach(s => {
      console.log(`  - ${s.name} (order: ${s.order})`)
    })
  })
}

main().catch(console.error).finally(() => prisma.$disconnect())
