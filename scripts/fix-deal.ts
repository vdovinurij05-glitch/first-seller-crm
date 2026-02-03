import prisma from '../src/lib/prisma'

async function main() {
  const arg = process.argv[2]

  if (arg === 'delete-contact') {
    const contactId = process.argv[3]
    if (!contactId) {
      console.log('Usage: npx tsx scripts/fix-deal.ts delete-contact <contactId>')
      return
    }

    console.log(`🗑️ Удаляю контакт ${contactId}...`)
    try {
      await prisma.contact.delete({ where: { id: contactId } })
      console.log('✅ Контакт удалён!')
    } catch (error) {
      console.error('❌ Ошибка:', error)
    }
  }

  if (arg === 'fix-stage') {
    const dealId = process.argv[3]
    const newStage = process.argv[4]
    if (!dealId || !newStage) {
      console.log('Usage: npx tsx scripts/fix-deal.ts fix-stage <dealId> <newStage>')
      return
    }

    console.log(`🔧 Исправляю stage для сделки ${dealId} на ${newStage}...`)
    try {
      await prisma.deal.update({
        where: { id: dealId },
        data: { stage: newStage }
      })
      console.log('✅ Stage исправлен!')
    } catch (error) {
      console.error('❌ Ошибка:', error)
    }
  }

  if (arg === 'show-deal') {
    const dealId = process.argv[3]
    if (!dealId) {
      console.log('Usage: npx tsx scripts/fix-deal.ts show-deal <dealId>')
      return
    }

    const deal = await prisma.deal.findUnique({
      where: { id: dealId },
      include: {
        pipeline: {
          include: {
            stages: true
          }
        }
      }
    })

    if (deal) {
      console.log(`\n📋 Сделка: ${deal.title}`)
      console.log(`   ID: ${deal.id}`)
      console.log(`   Stage: ${deal.stage}`)
      console.log(`   Pipeline: ${deal.pipeline?.name || 'Нет'}`)
      if (deal.pipeline?.stages) {
        console.log(`\n   Доступные этапы в воронке:`)
        deal.pipeline.stages.forEach(s => {
          console.log(`     - ${s.slug} (${s.name})`)
        })
      }
    } else {
      console.log('Сделка не найдена')
    }
  }
}

main().catch(console.error).finally(() => prisma.$disconnect())
