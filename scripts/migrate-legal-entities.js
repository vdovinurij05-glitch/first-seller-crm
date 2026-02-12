const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
  // 1. Найти направление "Агентство Первый Селлер"
  const bu = await prisma.businessUnit.findFirst({
    where: { name: { contains: 'Первый Селлер' } }
  })
  if (!bu) {
    console.error('BusinessUnit "Первый Селлер" not found!')
    process.exit(1)
  }
  console.log('Found BU:', bu.name, '(' + bu.id + ')')

  // 2. Создать юрлицо "ИП Гвоздков"
  let ipg = await prisma.legalEntity.findFirst({
    where: { name: 'ИП Гвоздков', businessUnitId: bu.id }
  })
  if (!ipg) {
    ipg = await prisma.legalEntity.create({
      data: {
        name: 'ИП Гвоздков',
        businessUnitId: bu.id,
        initialBalance: 155762.76,
        effectiveDate: new Date('2026-01-01'),
        order: 0
      }
    })
    console.log('Created LegalEntity:', ipg.name, '(' + ipg.id + ')')
  } else {
    console.log('LegalEntity already exists:', ipg.name, '(' + ipg.id + ')')
  }

  // 3. Привязать все записи с source='EXCEL' к ИП Гвоздков
  const result = await prisma.financeRecord.updateMany({
    where: {
      source: 'EXCEL',
      businessUnitId: bu.id,
      legalEntityId: null
    },
    data: {
      legalEntityId: ipg.id
    }
  })
  console.log('Updated', result.count, 'records -> legalEntityId =', ipg.id)

  // 4. Проверка
  const count = await prisma.financeRecord.count({
    where: { legalEntityId: ipg.id }
  })
  console.log('Total records with legalEntityId:', count)

  const leCount = await prisma.legalEntity.count()
  console.log('Total legal entities:', leCount)
}

main()
  .catch(e => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
