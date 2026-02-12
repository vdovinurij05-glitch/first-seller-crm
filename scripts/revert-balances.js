const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
  // Откат ООО Первый Селлер: 6406854.40 → 265698.09
  const ooo = await prisma.legalEntity.findFirst({ where: { name: { contains: 'ООО' } } })
  console.log('ООО ПС current:', ooo.initialBalance)
  await prisma.legalEntity.update({ where: { id: ooo.id }, data: { initialBalance: 265698.09 } })
  console.log('ООО ПС reverted to: 265698.09')

  // Откат ИП Гвоздков: 218062.76 → 155762.76
  const ipg = await prisma.legalEntity.findFirst({ where: { name: { contains: 'ИП Гвоздков' } } })
  console.log('ИПГ current:', ipg.initialBalance)
  await prisma.legalEntity.update({ where: { id: ipg.id }, data: { initialBalance: 155762.76 } })
  console.log('ИПГ reverted to: 155762.76')

  console.log('Done')
}

main().catch(console.error).finally(() => prisma.$disconnect())
