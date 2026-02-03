import prisma from '../src/lib/prisma'

async function main() {
  // Показать все сделки с воронками
  const deals = await prisma.deal.findMany({
    include: {
      pipeline: {
        select: {
          name: true,
          slug: true
        }
      },
      contact: {
        select: {
          name: true
        }
      },
      manager: {
        select: {
          name: true
        }
      }
    },
    orderBy: {
      createdAt: 'desc'
    }
  })

  console.log(`Всего сделок в базе: ${deals.length}\n`)

  // Группируем по воронкам
  const byPipeline: Record<string, typeof deals> = {}
  deals.forEach(deal => {
    const pipelineName = deal.pipeline?.name || 'Без воронки'
    if (!byPipeline[pipelineName]) {
      byPipeline[pipelineName] = []
    }
    byPipeline[pipelineName].push(deal)
  })

  // Показываем по воронкам
  Object.keys(byPipeline).forEach(pipelineName => {
    const pipelineDeals = byPipeline[pipelineName]
    console.log(`\n📊 ${pipelineName}: ${pipelineDeals.length} сделок`)
    pipelineDeals.forEach(deal => {
      console.log(`  - ${deal.title} | ${deal.amount}₽ | ${deal.contact?.name || 'Без контакта'} | ${deal.stage}`)
    })
  })
}

main().catch(console.error).finally(() => prisma.$disconnect())
