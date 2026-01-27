import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const existingStages = await prisma.stage.count()

  if (existingStages === 0) {
    console.log('Добавляем дефолтные статусы...')

    const defaultStages = [
      { id: 'NEW', name: 'Новые', color: 'bg-blue-500', order: 0, isDefault: true },
      { id: 'CONTACTED', name: 'Контакт', color: 'bg-indigo-500', order: 1, isDefault: true },
      { id: 'MEETING', name: 'Встреча', color: 'bg-purple-500', order: 2, isDefault: true },
      { id: 'PROPOSAL', name: 'Предложение', color: 'bg-yellow-500', order: 3, isDefault: true },
      { id: 'NEGOTIATION', name: 'Переговоры', color: 'bg-orange-500', order: 4, isDefault: true },
      { id: 'WON', name: 'Выиграно', color: 'bg-green-500', order: 5, isDefault: true },
      { id: 'LOST', name: 'Проиграно', color: 'bg-red-500', order: 6, isDefault: true }
    ]

    for (const stage of defaultStages) {
      await prisma.stage.create({
        data: stage
      })
    }

    console.log('✓ Дефолтные статусы добавлены')
  } else {
    console.log('Статусы уже существуют, пропускаем...')
  }
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
