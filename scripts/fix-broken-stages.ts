import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('🔧 Исправление сломанных stage значений...\n')

  // Получаем все сделки
  const deals = await prisma.deal.findMany({
    include: {
      pipeline: {
        include: {
          stages: true
        }
      }
    }
  })

  console.log(`📦 Всего сделок: ${deals.length}\n`)

  let fixed = 0

  for (const deal of deals) {
    // Проверяем, является ли stage.id ID сделки (сломанный stage)
    const isValidStage = deal.pipeline?.stages.some(s => s.slug === deal.stage)

    if (!isValidStage) {
      console.log(`⚠️  Сделка "${deal.title}" имеет невалидный stage: ${deal.stage}`)

      // Проверяем, является ли это ID другой сделки
      const isDealId = deals.some(d => d.id === deal.stage)

      if (isDealId) {
        console.log(`   → Это ID сделки! Ищем правильный stage...`)

        // Если это ID сделки, берем stage той сделки
        const targetDeal = deals.find(d => d.id === deal.stage)
        if (targetDeal && targetDeal.stage !== deal.stage) {
          // Проверяем, валиден ли stage целевой сделки
          const targetStageValid = targetDeal.pipeline?.stages.some(s => s.slug === targetDeal.stage)

          if (targetStageValid) {
            console.log(`   → Используем stage целевой сделки: ${targetDeal.stage}`)
            await prisma.deal.update({
              where: { id: deal.id },
              data: { stage: targetDeal.stage }
            })
            fixed++
            continue
          }
        }
      }

      // Если не смогли определить правильный stage, устанавливаем первый stage воронки
      if (deal.pipeline && deal.pipeline.stages.length > 0) {
        const firstStage = deal.pipeline.stages[0].slug
        console.log(`   → Устанавливаем первый stage воронки: ${firstStage}`)
        await prisma.deal.update({
          where: { id: deal.id },
          data: { stage: firstStage }
        })
        fixed++
      } else {
        console.log(`   → ❌ Не удалось исправить (нет воронки или этапов)`)
      }
    }
  }

  console.log(`\n✅ Исправлено сделок: ${fixed}`)
}

main()
  .catch((e) => {
    console.error('❌ Ошибка:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
