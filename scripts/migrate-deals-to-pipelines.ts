import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('🔄 Миграция сделок к воронкам...')

  // Получаем дефолтную воронку (Отдел продаж)
  const defaultPipeline = await prisma.pipeline.findFirst({
    where: { slug: 'sales' }
  })

  if (!defaultPipeline) {
    console.error('❌ Дефолтная воронка не найдена!')
    return
  }

  // Находим все сделки без воронки
  const dealsWithoutPipeline = await prisma.deal.findMany({
    where: {
      pipelineId: null
    }
  })

  console.log(`📊 Найдено ${dealsWithoutPipeline.length} сделок без воронки`)

  if (dealsWithoutPipeline.length === 0) {
    console.log('✅ Все сделки уже привязаны к воронкам')
    return
  }

  // Обновляем все сделки без воронки
  const result = await prisma.deal.updateMany({
    where: {
      pipelineId: null
    },
    data: {
      pipelineId: defaultPipeline.id
    }
  })

  console.log(`✅ Обновлено ${result.count} сделок, привязаны к воронке "${defaultPipeline.name}"`)

  // Проверяем результат
  const remainingDeals = await prisma.deal.count({
    where: { pipelineId: null }
  })

  console.log(`📊 Осталось сделок без воронки: ${remainingDeals}`)
}

main()
  .catch((e) => {
    console.error('❌ Ошибка:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
