import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('🔍 Проверка сделок и воронок...\n')

  // Получаем все воронки
  const pipelines = await prisma.pipeline.findMany({
    include: {
      stages: {
        orderBy: { order: 'asc' }
      }
    }
  })

  console.log('📊 Воронки:')
  for (const pipeline of pipelines) {
    console.log(`\n  ${pipeline.name} (${pipeline.slug}):`)
    console.log(`    Этапы:`)
    for (const stage of pipeline.stages) {
      console.log(`      - ${stage.name} (slug: ${stage.slug})`)
    }
  }

  // Получаем все сделки
  const deals = await prisma.deal.findMany({
    include: {
      pipeline: true
    }
  })

  console.log(`\n\n📦 Всего сделок: ${deals.length}`)

  // Группируем по воронкам
  const dealsByPipeline = deals.reduce((acc: Record<string, typeof deals>, deal) => {
    const key = deal.pipelineId || 'null'
    if (!acc[key]) acc[key] = []
    acc[key].push(deal)
    return acc
  }, {} as Record<string, typeof deals>)

  console.log('\n📊 Сделки по воронкам:')
  for (const [pipelineId, pipelineDeals] of Object.entries(dealsByPipeline)) {
    const pipeline = pipelines.find(p => p.id === pipelineId)
    const name = pipeline ? pipeline.name : 'Без воронки'
    console.log(`\n  ${name} (${pipelineDeals.length} сделок):`)

    // Группируем по stage
    const stageGroups = pipelineDeals.reduce((acc, deal) => {
      if (!acc[deal.stage]) acc[deal.stage] = []
      acc[deal.stage].push(deal)
      return acc
    }, {} as Record<string, typeof deals>)

    for (const [stage, stageDeals] of Object.entries(stageGroups)) {
      console.log(`    ${stage}: ${stageDeals.length} сделок`)
      for (const deal of stageDeals) {
        console.log(`      - ${deal.title} (id: ${deal.id})`)
      }
    }
  }

  // Проверяем stage слаги
  console.log('\n\n🔍 Проверка соответствия stage и этапов:')
  const salesPipeline = pipelines.find(p => p.slug === 'sales')
  if (salesPipeline) {
    const salesDeals = deals.filter(d => d.pipelineId === salesPipeline.id)
    const stageSlugs = salesPipeline.stages.map(s => s.slug)

    console.log(`\n  Воронка "Отдел продаж":`)
    console.log(`    Ожидаемые stage slugs:`, stageSlugs)

    const actualStages = [...new Set(salesDeals.map(d => d.stage))]
    console.log(`    Фактические stage в сделках:`, actualStages)

    const mismatched = actualStages.filter(s => !stageSlugs.includes(s))
    if (mismatched.length > 0) {
      console.log(`    ⚠️  Несовпадающие stages:`, mismatched)
    }
  }
}

main()
  .catch((e) => {
    console.error('❌ Ошибка:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
