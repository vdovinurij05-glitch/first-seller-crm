import prisma from '../src/lib/prisma'

async function main() {
  const arg = process.argv[2]

  if (arg === 'delete-short') {
    // Удалить контакты с коротким именем (1-2 символа)
    const allContacts = await prisma.contact.findMany({
      select: { id: true, name: true, phone: true }
    })

    const shortNames = allContacts.filter(c => !c.name || c.name.length <= 2)

    if (shortNames.length === 0) {
      console.log('Контактов с коротким именем не найдено')
      return
    }

    console.log('Найдены контакты с коротким именем:')
    for (const c of shortNames) {
      console.log(`- "${c.name}" | ${c.phone} | ${c.id}`)
      await prisma.contact.delete({ where: { id: c.id } })
      console.log(`  Удалён!`)
    }
  } else {
    // Показать все контакты
    const allContacts = await prisma.contact.findMany({
      select: { id: true, name: true, phone: true },
      orderBy: { name: 'asc' }
    })

    console.log('Все контакты:')
    allContacts.forEach(c => console.log(`"${c.name}" | ${c.phone} | ${c.id}`))
    console.log('\nДля удаления коротких имён: npx tsx scripts/find-contact.ts delete-short')
  }
}

main().catch(console.error).finally(() => prisma.$disconnect())
