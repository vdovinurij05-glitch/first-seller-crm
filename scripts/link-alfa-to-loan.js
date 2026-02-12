const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
  // Находим кредит Альфа-Банк
  const loan = await prisma.loan.findFirst({ where: { name: { contains: 'Альфа-Банк' } } })
  if (!loan) throw new Error('Loan not found')
  console.log('Loan:', loan.id, loan.name)

  // Привязываем записи FinanceRecord с описанием Альфа-Банк к займу
  const result = await prisma.financeRecord.updateMany({
    where: { description: { contains: 'Альфа-Банк' } },
    data: { loanId: loan.id }
  })
  console.log('Linked', result.count, 'records to loan')

  // Проверяем итог
  const le = await prisma.legalEntity.findFirst({ where: { name: { contains: 'ООО' } } })
  const income = await prisma.financeRecord.aggregate({
    where: { legalEntityId: le.id, type: 'INCOME', date: { gte: le.effectiveDate } },
    _sum: { amount: true }
  })
  const expense = await prisma.financeRecord.aggregate({
    where: { legalEntityId: le.id, type: 'EXPENSE', date: { gte: le.effectiveDate }, paidByFounder: null, loanId: null },
    _sum: { amount: true }
  })
  const bal = le.initialBalance + (income._sum.amount || 0) - (expense._sum.amount || 0)
  console.log('ООО ПС balance now:', bal.toFixed(2))
}

main().catch(console.error).finally(() => prisma.$disconnect())
