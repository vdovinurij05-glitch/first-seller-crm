// Скрипт для создания воронок и их стадий
// Запуск: npx tsx scripts/seed-pipelines.ts

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Seeding pipelines...')

  // Создаем воронку "Отдел продаж"
  const salesPipeline = await prisma.pipeline.upsert({
    where: { slug: 'sales' },
    update: {},
    create: {
      name: 'Отдел продаж',
      slug: 'sales',
      icon: 'filter',
      order: 0,
      isDefault: true
    }
  })

  console.log(`✅ Created pipeline: ${salesPipeline.name}`)

  // Стадии для "Отдел продаж"
  const salesStages = [
    { name: 'Новые', slug: 'NEW', color: '#94a3b8', order: 0, isDefault: true },
    { name: 'Контакт', slug: 'CONTACTED', color: '#3b82f6', order: 1, isDefault: false },
    { name: 'Встреча', slug: 'MEETING', color: '#8b5cf6', order: 2, isDefault: false },
    { name: 'Предложение', slug: 'PROPOSAL', color: '#f59e0b', order: 3, isDefault: false },
    { name: 'Переговоры', slug: 'NEGOTIATION', color: '#ec4899', order: 4, isDefault: false },
    { name: 'Выиграно', slug: 'WON', color: '#10b981', order: 5, isDefault: false },
    { name: 'Проиграно', slug: 'LOST', color: '#ef4444', order: 6, isDefault: false }
  ]

  for (const stage of salesStages) {
    await prisma.pipelineStage.upsert({
      where: {
        pipelineId_slug: {
          pipelineId: salesPipeline.id,
          slug: stage.slug
        }
      },
      update: {},
      create: {
        ...stage,
        pipelineId: salesPipeline.id
      }
    })
    console.log(`  ✅ Created stage: ${stage.name}`)
  }

  // Создаем воронку "Яндекс Кит"
  const yandexKitPipeline = await prisma.pipeline.upsert({
    where: { slug: 'yandex-kit' },
    update: {},
    create: {
      name: 'Яндекс Кит',
      slug: 'yandex-kit',
      icon: 'filter',
      order: 1,
      isDefault: false
    }
  })

  console.log(`✅ Created pipeline: ${yandexKitPipeline.name}`)

  // Стадии для "Яндекс Кит"
  const yandexKitStages = [
    { name: 'Новый магазин', slug: 'NEW_SHOP', color: '#94a3b8', order: 0, isDefault: true },
    { name: 'ПЛ подключена', slug: 'PL_CONNECTED', color: '#3b82f6', order: 1, isDefault: false },
    { name: 'Магазин запущен', slug: 'SHOP_LAUNCHED', color: '#8b5cf6', order: 2, isDefault: false },
    { name: 'Магазин настроен', slug: 'SHOP_CONFIGURED', color: '#f59e0b', order: 3, isDefault: false },
    { name: 'Дизайн согласован', slug: 'DESIGN_APPROVED', color: '#ec4899', order: 4, isDefault: false },
    { name: 'Директ включен', slug: 'DIRECT_ENABLED', color: '#06b6d4', order: 5, isDefault: false },
    { name: 'Заказ получен', slug: 'ORDER_RECEIVED', color: '#10b981', order: 6, isDefault: false }
  ]

  for (const stage of yandexKitStages) {
    await prisma.pipelineStage.upsert({
      where: {
        pipelineId_slug: {
          pipelineId: yandexKitPipeline.id,
          slug: stage.slug
        }
      },
      update: {},
      create: {
        ...stage,
        pipelineId: yandexKitPipeline.id
      }
    })
    console.log(`  ✅ Created stage: ${stage.name}`)
  }

  // Обновляем существующие сделки, привязывая к воронке "Отдел продаж"
  const dealsCount = await prisma.deal.updateMany({
    where: { pipelineId: null },
    data: { pipelineId: salesPipeline.id }
  })

  console.log(`✅ Updated ${dealsCount.count} existing deals to Sales pipeline`)

  console.log('✅ Seeding completed!')
}

main()
  .catch((e) => {
    console.error('❌ Error seeding pipelines:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
