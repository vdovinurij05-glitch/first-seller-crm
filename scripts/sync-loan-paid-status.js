const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
  // Находим все LoanPayment которые isPaid=true
  const paidPayments = await prisma.loanPayment.findMany({
    where: { isPaid: true }
  })
  console.log('Total paid LoanPayments:', paidPayments.length)

  let updated = 0
  for (const lp of paidPayments) {
    // Находим соответствующий FinanceRecord
    const fr = await prisma.financeRecord.findFirst({
      where: {
        loanId: lp.loanId,
        amount: lp.amount,
        date: lp.date,
        isPaid: false  // только неоплаченные
      }
    })
    if (fr) {
      await prisma.financeRecord.update({
        where: { id: fr.id },
        data: { isPaid: true }
      })
      updated++
      console.log('Synced:', fr.description, formatDate(fr.date))
    }
  }

  // Также проверим обратную ситуацию: LoanPayment unpaid, но FinanceRecord paid
  const unpaidPayments = await prisma.loanPayment.findMany({
    where: { isPaid: false }
  })
  let reverted = 0
  for (const lp of unpaidPayments) {
    const fr = await prisma.financeRecord.findFirst({
      where: {
        loanId: lp.loanId,
        amount: lp.amount,
        date: lp.date,
        isPaid: true
      }
    })
    if (fr) {
      await prisma.financeRecord.update({
        where: { id: fr.id },
        data: { isPaid: false }
      })
      reverted++
      console.log('Reverted:', fr.description, formatDate(fr.date))
    }
  }

  console.log('\nSynced:', updated, 'records to paid')
  console.log('Reverted:', reverted, 'records to unpaid')
}

function formatDate(d) {
  return d.toISOString().slice(0, 10)
}

main()
  .catch(e => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
