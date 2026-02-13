const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
  // Находим категорию ЗП
  const salaryCat = await prisma.financeCategory.findFirst({
    where: { group: 'SALARY', type: 'EXPENSE' }
  })
  if (!salaryCat) {
    console.log('ERROR: No salary category found')
    return
  }
  console.log('Salary category:', salaryCat.id, salaryCat.name)

  // Текущий месяц
  const now = new Date()
  const start = new Date(now.getFullYear(), now.getMonth(), 1)
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 1)

  const payments = await prisma.salaryPayment.findMany({
    where: { date: { gte: start, lt: end } },
    include: { employee: true },
    orderBy: { date: 'asc' }
  })
  console.log('Salary payments for current month:', payments.length)

  let created = 0, skipped = 0
  for (const sp of payments) {
    // Проверяем, нет ли уже FinanceRecord для этого платежа
    const existing = await prisma.financeRecord.findFirst({
      where: { salaryPaymentId: sp.id }
    })
    if (existing) {
      skipped++
      continue
    }

    const typeLabel = sp.salaryType === 'OFFICIAL' ? 'белая' : 'чёрная'
    await prisma.financeRecord.create({
      data: {
        type: 'EXPENSE',
        amount: sp.amount,
        date: sp.date,
        dueDate: sp.date,
        description: `ЗП ${sp.employee.name} — ${sp.comment || typeLabel}`,
        categoryId: salaryCat.id,
        businessUnitId: sp.employee.businessUnitId || undefined,
        isPaid: sp.isPaid,
        salaryPaymentId: sp.id,
        source: 'MANUAL'
      }
    })
    created++
    console.log(`Created: ЗП ${sp.employee.name} — ${sp.comment} (${sp.amount}, isPaid=${sp.isPaid})`)
  }

  console.log(`\nDone: ${created} created, ${skipped} skipped`)
}

main()
  .catch(e => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
