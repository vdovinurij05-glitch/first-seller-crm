const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

// IDs из базы
const LE_OOO = 'cmlj0y1f1000112u40c3im5ju'  // ООО Первый Селлер
const LE_IPG = 'cmlizo1lw0001481rmt6znf5a'  // ИП Гвоздков
const BU_ID  = 'cmlfaz6uk000010inzqa9jaum'  // Агентство Первый Селлер
const CAT_KRISTINA = 'cmlj87kog00015sroaxzoplth' // Кредит Кристины
const CAT_YURA     = 'cmlj87kom00025srovxm35yrp' // Кредит Юры
const CAT_TBANK    = 'cmliyi0wr0007ihpjrbpimdhw' // Кредит Т БАНК
const CAT_CREDIT   = 'cmlj0y1g6000712u4pdfik2ht' // Кредит (общая)

function addMonths(date, n) {
  const d = new Date(date)
  d.setMonth(d.getMonth() + n)
  return d
}

function makeDate(year, month, day) {
  return new Date(year, month - 1, day, 12, 0, 0)
}

async function createLoanWithPayments(loanData, payments, legalEntityId, categoryId) {
  console.log(`\n=== ${loanData.name} ===`)

  const loan = await prisma.loan.create({ data: loanData })
  console.log('Loan created:', loan.id)

  let paidCount = 0, unpaidCount = 0

  for (const p of payments) {
    // LoanPayment
    await prisma.loanPayment.create({
      data: {
        loanId: loan.id,
        date: p.date,
        amount: p.amount,
        principalPart: p.principal || null,
        interestPart: p.interest || null,
        isPaid: p.isPaid,
        paidAt: p.isPaid ? p.date : null,
        comment: p.comment || null
      }
    })

    // FinanceRecord для PnL календаря
    await prisma.financeRecord.create({
      data: {
        type: 'EXPENSE',
        amount: p.amount,
        date: p.date,
        dueDate: p.date,
        description: `${loanData.name} (платёж ${p.num}/${payments.length})`,
        categoryId: categoryId,
        legalEntityId: legalEntityId,
        businessUnitId: BU_ID,
        isPaid: p.isPaid,
        loanId: loan.id,
        source: 'MANUAL'
      }
    })

    if (p.isPaid) paidCount++
    else unpaidCount++
  }

  console.log(`Created ${payments.length} payments (${paidCount} paid, ${unpaidCount} unpaid)`)
  return loan
}

async function main() {
  // ========================================
  // 1. Кредит Кристина Т БАНК
  // ========================================
  const loan1Payments = []
  // 59 платежей, день 6, начало Oct 2025
  // P1-P5: оплачены (33890), P6-P58: неоплачены (33890), P59: 23698.18
  for (let i = 1; i <= 59; i++) {
    const date = addMonths(makeDate(2025, 10, 6), i - 1)
    loan1Payments.push({
      num: i,
      date,
      amount: i === 59 ? 23698.18 : 33890,
      isPaid: i <= 5,
      principal: null,
      interest: null
    })
  }

  await createLoanWithPayments({
    name: 'Кредит Кристина Т БАНК',
    loanType: 'CREDIT',
    scheduleType: 'MANUAL',
    totalAmount: 1989317.18,
    remainingAmount: 748885.32,
    monthlyPayment: 33890,
    interestRate: 0,
    paymentDay: 6,
    startDate: makeDate(2025, 10, 6),
    endDate: addMonths(makeDate(2025, 10, 6), 58),
    creditor: 'Т-Банк'
  }, loan1Payments, LE_OOO, CAT_KRISTINA)

  // ========================================
  // 2. Кредит Кристина ПОЧТА БАНК
  // ========================================
  // 48 платежей, день 11, 8 оплачено
  // Структура: interest-only, ставка ~1.35%/мес
  // Ежемесячный платёж (процент): 45941.57/8 ≈ 5742.70
  // Последний платёж: тело + проценты
  const pochta_monthly = 5742.70
  const pochta_principal = 424753.43
  const loan2Payments = []
  for (let i = 1; i <= 48; i++) {
    const date = addMonths(makeDate(2025, 7, 11), i - 1)
    let amount
    if (i <= 7) amount = pochta_monthly
    else if (i === 8) amount = 45941.57 - 7 * pochta_monthly // точная подгонка
    else if (i < 48) amount = pochta_monthly
    else amount = pochta_principal + pochta_monthly // последний: тело + %
    loan2Payments.push({
      num: i,
      date,
      amount: Math.round(amount * 100) / 100,
      isPaid: i <= 8,
      principal: i === 48 ? pochta_principal : 0,
      interest: i === 48 ? pochta_monthly : (i <= 47 ? amount : 0)
    })
  }

  await createLoanWithPayments({
    name: 'Кредит Кристина ПОЧТА БАНК',
    loanType: 'CREDIT',
    scheduleType: 'INTEREST_ONLY',
    totalAmount: pochta_principal,
    remainingAmount: pochta_principal,
    monthlyPayment: pochta_monthly,
    interestRate: 16.2,
    paymentDay: 11,
    startDate: makeDate(2025, 7, 11),
    endDate: addMonths(makeDate(2025, 7, 11), 47),
    creditor: 'Почта Банк'
  }, loan2Payments, LE_OOO, CAT_KRISTINA)

  // ========================================
  // 3. Дима АЛЬФА БАНК
  // ========================================
  // 61 платеж, 16 оплачено, 34556.16, день 5
  // P1: Oct 5, 2024
  const loan3Payments = []
  for (let i = 1; i <= 61; i++) {
    const date = addMonths(makeDate(2024, 10, 5), i - 1)
    loan3Payments.push({
      num: i,
      date,
      amount: 34556.16,
      isPaid: i <= 16,
      principal: null,
      interest: null
    })
  }

  await createLoanWithPayments({
    name: 'Кредит Дима АЛЬФА БАНК',
    loanType: 'CREDIT',
    scheduleType: 'MANUAL',
    totalAmount: 61 * 34556.16,
    remainingAmount: 676648.74,
    monthlyPayment: 34556.16,
    interestRate: 0,
    paymentDay: 5,
    startDate: makeDate(2024, 10, 5),
    endDate: addMonths(makeDate(2024, 10, 5), 60),
    creditor: 'Альфа-Банк'
  }, loan3Payments, LE_OOO, CAT_CREDIT)

  // ========================================
  // 4. ИП Гвоздков Т БАНК
  // ========================================
  // 570000, 3.99%/мес, платёж 117743, последний 95000
  // 4 оплачено, ближайший 17.02.2026, последний 17.04.2026
  // Flat commission: principal/payment = 95000, commission = 22743
  const ipg_payments_data = [
    { num: 1, date: makeDate(2025, 10, 17), amount: 117743, isPaid: true },
    { num: 2, date: makeDate(2025, 11, 17), amount: 117743, isPaid: true },
    { num: 3, date: makeDate(2025, 12, 17), amount: 117743, isPaid: true },
    { num: 4, date: makeDate(2026, 1, 17),  amount: 117743, isPaid: true },
    { num: 5, date: makeDate(2026, 2, 17),  amount: 117743, isPaid: false },
    { num: 6, date: makeDate(2026, 3, 17),  amount: 117743, isPaid: false },
    { num: 7, date: makeDate(2026, 4, 17),  amount: 95000,  isPaid: false }
  ]
  for (const p of ipg_payments_data) {
    p.principal = p.num <= 6 ? 95000 : 95000
    p.interest = p.num <= 6 ? 22743 : 0
  }

  await createLoanWithPayments({
    name: 'Кредит ИП Гвоздков Т БАНК',
    loanType: 'CREDIT',
    scheduleType: 'MANUAL',
    totalAmount: 570000,
    remainingAmount: 190000,
    monthlyPayment: 117743,
    interestRate: 3.99 * 12,
    paymentDay: 17,
    startDate: makeDate(2025, 10, 17),
    endDate: makeDate(2026, 4, 17),
    creditor: 'Т-Банк'
  }, ipg_payments_data, LE_IPG, CAT_TBANK)

  // ========================================
  // 5. Главцентр Т БАНК
  // ========================================
  // 110000 на 12 мес, 3.49%/мес, платёж 13039
  // P1: 11.08.2025 (3839), P2-P12: 13039, P13: 8800
  // 7 оплачено
  // Flat commission: 110000 * 3.49% = 3839/мес
  // Principal per payment: 13039 - 3839 = 9200
  const gc_payments_data = [
    { num: 1,  date: makeDate(2025, 8, 11),  amount: 3839,  isPaid: true,  principal: 0, interest: 3839 },
    { num: 2,  date: makeDate(2025, 9, 11),  amount: 13039, isPaid: true,  principal: 9200, interest: 3839 },
    { num: 3,  date: makeDate(2025, 10, 11), amount: 13039, isPaid: true,  principal: 9200, interest: 3839 },
    { num: 4,  date: makeDate(2025, 11, 11), amount: 13039, isPaid: true,  principal: 9200, interest: 3839 },
    { num: 5,  date: makeDate(2025, 12, 11), amount: 13039, isPaid: true,  principal: 9200, interest: 3839 },
    { num: 6,  date: makeDate(2026, 1, 11),  amount: 13039, isPaid: true,  principal: 9200, interest: 3839 },
    { num: 7,  date: makeDate(2026, 2, 11),  amount: 13039, isPaid: true,  principal: 9200, interest: 3839 },
    { num: 8,  date: makeDate(2026, 3, 11),  amount: 13039, isPaid: false, principal: 9200, interest: 3839 },
    { num: 9,  date: makeDate(2026, 4, 13),  amount: 13039, isPaid: false, principal: 9200, interest: 3839 },
    { num: 10, date: makeDate(2026, 5, 11),  amount: 13039, isPaid: false, principal: 9200, interest: 3839 },
    { num: 11, date: makeDate(2026, 6, 11),  amount: 13039, isPaid: false, principal: 9200, interest: 3839 },
    { num: 12, date: makeDate(2026, 7, 13),  amount: 13039, isPaid: false, principal: 9200, interest: 3839 },
    { num: 13, date: makeDate(2026, 8, 11),  amount: 8800,  isPaid: false, principal: 8800, interest: 0 }
  ]

  await createLoanWithPayments({
    name: 'Кредит Главцентр Т БАНК',
    loanType: 'CREDIT',
    scheduleType: 'MANUAL',
    totalAmount: 110000,
    remainingAmount: 54800,
    monthlyPayment: 13039,
    interestRate: 3.49 * 12,
    paymentDay: 11,
    startDate: makeDate(2025, 8, 11),
    endDate: makeDate(2026, 8, 11),
    creditor: 'Т-Банк'
  }, gc_payments_data, LE_IPG, CAT_TBANK)

  // ========================================
  // 6. Юрий АЛЬФА БАНК
  // ========================================
  // 810000 тело, 31400/мес, 60 платежей, 12 оплачено
  // P58: 11477.66, P59-P60: 0
  // День: 5
  // P1: Feb 5, 2025
  const loan6Payments = []
  for (let i = 1; i <= 60; i++) {
    const date = addMonths(makeDate(2025, 2, 5), i - 1)
    let amount
    if (i <= 57) amount = 31400
    else if (i === 58) amount = 11477.66
    else amount = 0 // P59, P60

    loan6Payments.push({
      num: i,
      date,
      amount,
      isPaid: i <= 12,
      principal: null,
      interest: null
    })
  }
  // Убираем нулевые платежи (P59, P60) из FinanceRecord - они по факту не нужны
  // Но в LoanPayment оставим для полноты графика

  await createLoanWithPayments({
    name: 'Кредит Юрий АЛЬФА БАНК',
    loanType: 'CREDIT',
    scheduleType: 'MANUAL',
    totalAmount: 810000,
    remainingAmount: 729477,
    monthlyPayment: 31400,
    interestRate: 0,
    paymentDay: 5,
    startDate: makeDate(2025, 2, 5),
    endDate: addMonths(makeDate(2025, 2, 5), 59),
    creditor: 'Альфа-Банк'
  }, loan6Payments, LE_OOO, CAT_YURA)

  console.log('\n=== DONE ===')
  console.log('All 6 loans imported with payments and PnL records')
}

main()
  .catch(e => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
