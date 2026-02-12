'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import {
  ArrowLeft,
  Plus,
  X,
  Landmark,
  CreditCard,
  Car,
  HandCoins,
  Edit,
  Trash2,
  TrendingDown,
  CalendarDays,
  Percent,
  HelpCircle,
  ChevronDown,
  ChevronUp,
  Check,
  AlertTriangle,
  Clock,
  RefreshCw
} from 'lucide-react'

interface LoanPayment {
  id: string
  loanId: string
  amount: number
  principalPart: number | null
  interestPart: number | null
  date: string
  isPaid: boolean
  paidAt: string | null
  comment: string | null
}

interface Loan {
  id: string
  name: string
  loanType: string
  scheduleType: string
  totalAmount: number
  remainingAmount: number
  monthlyPayment: number
  interestRate: number | null
  totalMonths: number | null
  paymentDay: number
  startDate: string
  endDate: string | null
  creditor: string | null
  isActive: boolean
  payments: LoanPayment[]
}

interface LoanSummary {
  totalMonthly: number
  totalRemaining: number
  totalDebt: number
  activeCount: number
  overdueCount: number
  overdueAmount: number
  nextPaymentDate: string | null
}

function formatMoney(n: number) {
  return new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB', maximumFractionDigits: 0 }).format(n)
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('ru-RU')
}

function FieldHint({ text }: { text: string }) {
  const [show, setShow] = useState(false)
  return (
    <span className="relative inline-flex ml-1">
      <button
        type="button"
        onMouseEnter={() => setShow(true)}
        onMouseLeave={() => setShow(false)}
        onClick={() => setShow(s => !s)}
        className="text-gray-400 hover:text-gray-600 transition"
      >
        <HelpCircle className="w-3.5 h-3.5" />
      </button>
      {show && (
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-gray-900 text-white text-xs rounded-lg shadow-lg w-56 z-50 leading-relaxed">
          {text}
          <div className="absolute top-full left-1/2 -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-900" />
        </div>
      )}
    </span>
  )
}

const LOAN_TYPES: Record<string, { label: string; icon: typeof CreditCard; color: string }> = {
  CREDIT: { label: 'Кредит', icon: CreditCard, color: 'text-red-600 bg-red-50' },
  LEASING: { label: 'Лизинг', icon: Car, color: 'text-amber-600 bg-amber-50' },
  LOAN: { label: 'Займ', icon: HandCoins, color: 'text-blue-600 bg-blue-50' },
}

const SCHEDULE_TYPES: Record<string, { label: string; description: string }> = {
  MANUAL: { label: 'Ручной', description: 'Вводите платежи вручную' },
  ANNUITY: { label: 'Аннуитетный', description: 'Равные платежи каждый месяц' },
  DIFFERENTIATED: { label: 'Дифференцированный', description: 'Убывающие платежи' },
  INTEREST_ONLY: { label: 'Процентный', description: '% ежемесячно, тело в конце' },
}

export default function LoansPage() {
  const [loans, setLoans] = useState<Loan[]>([])
  const [summary, setSummary] = useState<LoanSummary>({ totalMonthly: 0, totalRemaining: 0, totalDebt: 0, activeCount: 0, overdueCount: 0, overdueAmount: 0, nextPaymentDate: null })
  const [loading, setLoading] = useState(true)
  const [showAddLoan, setShowAddLoan] = useState(false)
  const [editingLoan, setEditingLoan] = useState<Loan | null>(null)
  const [expandedLoan, setExpandedLoan] = useState<string | null>(null)
  const [showAddPayment, setShowAddPayment] = useState<string | null>(null)

  const [form, setForm] = useState({
    name: '',
    loanType: 'CREDIT',
    scheduleType: 'MANUAL',
    totalAmount: '',
    remainingAmount: '',
    monthlyPayment: '',
    interestRate: '',
    totalMonths: '',
    paymentDay: '1',
    startDate: new Date().toISOString().slice(0, 10),
    endDate: '',
    creditor: '',
  })

  const [paymentForm, setPaymentForm] = useState({
    amount: '',
    date: new Date().toISOString().slice(0, 10),
    principalPart: '',
    interestPart: '',
    comment: '',
    isPaid: false,
  })

  useEffect(() => { fetchLoans() }, [])

  const fetchLoans = async () => {
    try {
      const res = await fetch('/api/pnl/loans')
      const data = await res.json()
      setLoans(data.loans)
      setSummary(data.summary)
    } catch (error) {
      console.error('Error fetching loans:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const url = editingLoan ? `/api/pnl/loans/${editingLoan.id}` : '/api/pnl/loans'
    const res = await fetch(url, {
      method: editingLoan ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    if (res.ok) {
      setShowAddLoan(false)
      setEditingLoan(null)
      resetForm()
      fetchLoans()
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Удалить этот займ со всеми платежами?')) return
    await fetch(`/api/pnl/loans/${id}`, { method: 'DELETE' })
    fetchLoans()
  }

  const handleGenerateSchedule = async (loanId: string) => {
    if (!confirm('Пересчитать график? Все неоплаченные платежи будут заменены.')) return
    const res = await fetch(`/api/pnl/loans/${loanId}/generate-schedule`, { method: 'POST' })
    if (res.ok) {
      fetchLoans()
    } else {
      const data = await res.json()
      alert(data.error || 'Ошибка генерации')
    }
  }

  const handleMarkPaid = async (loanId: string, paymentId: string) => {
    await fetch(`/api/pnl/loans/${loanId}/payments/${paymentId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isPaid: true })
    })
    fetchLoans()
  }

  const handleMarkUnpaid = async (loanId: string, paymentId: string) => {
    await fetch(`/api/pnl/loans/${loanId}/payments/${paymentId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isPaid: false })
    })
    fetchLoans()
  }

  const handleDeletePayment = async (loanId: string, paymentId: string) => {
    if (!confirm('Удалить этот платёж?')) return
    await fetch(`/api/pnl/loans/${loanId}/payments/${paymentId}`, { method: 'DELETE' })
    fetchLoans()
  }

  const handleAddPayment = async (e: React.FormEvent, loanId: string) => {
    e.preventDefault()
    const res = await fetch(`/api/pnl/loans/${loanId}/payments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(paymentForm)
    })
    if (res.ok) {
      setShowAddPayment(null)
      setPaymentForm({ amount: '', date: new Date().toISOString().slice(0, 10), principalPart: '', interestPart: '', comment: '', isPaid: false })
      fetchLoans()
    }
  }

  const openEdit = (loan: Loan) => {
    setEditingLoan(loan)
    setForm({
      name: loan.name,
      loanType: loan.loanType,
      scheduleType: loan.scheduleType,
      totalAmount: String(loan.totalAmount),
      remainingAmount: String(loan.remainingAmount),
      monthlyPayment: String(loan.monthlyPayment),
      interestRate: loan.interestRate ? String(loan.interestRate) : '',
      totalMonths: loan.totalMonths ? String(loan.totalMonths) : '',
      paymentDay: String(loan.paymentDay),
      startDate: new Date(loan.startDate).toISOString().slice(0, 10),
      endDate: loan.endDate ? new Date(loan.endDate).toISOString().slice(0, 10) : '',
      creditor: loan.creditor || '',
    })
    setShowAddLoan(true)
  }

  const resetForm = () => {
    setForm({
      name: '', loanType: 'CREDIT', scheduleType: 'MANUAL', totalAmount: '', remainingAmount: '',
      monthlyPayment: '', interestRate: '', totalMonths: '', paymentDay: '1',
      startDate: new Date().toISOString().slice(0, 10), endDate: '', creditor: '',
    })
  }

  const getPaymentStatus = (p: LoanPayment): 'paid' | 'overdue' | 'upcoming' => {
    if (p.isPaid) return 'paid'
    if (new Date(p.date) < new Date()) return 'overdue'
    return 'upcoming'
  }

  const needsAutoFields = form.scheduleType !== 'MANUAL'

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      </div>
    )
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Шапка */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/dashboard/pnl" className="p-2 hover:bg-gray-100 rounded-xl transition">
            <ArrowLeft className="w-5 h-5 text-gray-500" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Кредитная нагрузка</h1>
            <p className="text-sm text-gray-500 mt-0.5">Кредиты, лизинги, займы</p>
          </div>
        </div>
        <button
          onClick={() => { setEditingLoan(null); resetForm(); setShowAddLoan(true) }}
          className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-medium hover:bg-indigo-700 transition"
        >
          <Plus className="w-4 h-4" />
          Добавить
        </button>
      </div>

      {/* Сводка */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-gradient-to-br from-red-500 to-red-600 rounded-2xl p-5 text-white hover:shadow-md transition">
          <div className="flex items-center gap-2 mb-2">
            <div className="p-1.5 bg-white/20 rounded-lg"><TrendingDown className="w-4 h-4 text-white" /></div>
            <span className="text-xs font-medium text-white/80">Ежемесячно</span>
          </div>
          <p className="text-xl font-bold">{formatMoney(summary.totalMonthly)}</p>
          <p className="text-xs text-white/60 mt-1">платежи в месяц</p>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 p-5 hover:shadow-md transition">
          <div className="flex items-center gap-2 mb-2">
            <div className="p-1.5 bg-amber-50 rounded-lg"><Landmark className="w-4 h-4 text-amber-600" /></div>
            <span className="text-xs font-medium text-gray-500">Остаток долга</span>
          </div>
          <p className="text-xl font-bold text-gray-900">{formatMoney(summary.totalRemaining)}</p>
          <p className="text-xs text-gray-400 mt-1">осталось погасить</p>
        </div>

        {summary.overdueCount > 0 ? (
          <div className="bg-gradient-to-br from-orange-500 to-red-500 rounded-2xl p-5 text-white hover:shadow-md transition">
            <div className="flex items-center gap-2 mb-2">
              <div className="p-1.5 bg-white/20 rounded-lg"><AlertTriangle className="w-4 h-4 text-white" /></div>
              <span className="text-xs font-medium text-white/80">Просрочено</span>
            </div>
            <p className="text-xl font-bold">{formatMoney(summary.overdueAmount)}</p>
            <p className="text-xs text-white/60 mt-1">{summary.overdueCount} платежей</p>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-gray-100 p-5 hover:shadow-md transition">
            <div className="flex items-center gap-2 mb-2">
              <div className="p-1.5 bg-emerald-50 rounded-lg"><Check className="w-4 h-4 text-emerald-600" /></div>
              <span className="text-xs font-medium text-gray-500">Просрочки нет</span>
            </div>
            <p className="text-xl font-bold text-emerald-600">0</p>
            <p className="text-xs text-gray-400 mt-1">все оплачено вовремя</p>
          </div>
        )}

        <div className="bg-white rounded-2xl border border-gray-100 p-5 hover:shadow-md transition">
          <div className="flex items-center gap-2 mb-2">
            <div className="p-1.5 bg-purple-50 rounded-lg"><CalendarDays className="w-4 h-4 text-purple-600" /></div>
            <span className="text-xs font-medium text-gray-500">Активных</span>
          </div>
          <p className="text-xl font-bold text-gray-900">{summary.activeCount}</p>
          <p className="text-xs text-gray-400 mt-1">
            {summary.nextPaymentDate ? `След. платёж: ${formatDate(summary.nextPaymentDate)}` : 'кредитов/займов'}
          </p>
        </div>
      </div>

      {/* Список займов */}
      <div className="space-y-4">
        {loans.length > 0 ? loans.map(loan => {
          const lt = LOAN_TYPES[loan.loanType] || LOAN_TYPES.LOAN
          const Icon = lt.icon
          const isExpanded = expandedLoan === loan.id
          const st = SCHEDULE_TYPES[loan.scheduleType] || SCHEDULE_TYPES.MANUAL
          const now = new Date()
          const overduePayments = loan.payments.filter(p => !p.isPaid && new Date(p.date) < now)
          const paidPayments = loan.payments.filter(p => p.isPaid)
          const upcomingPayments = loan.payments.filter(p => !p.isPaid && new Date(p.date) >= now)

          // Прогресс по фактическим платежам
          const totalPaymentsSum = loan.payments.reduce((s, p) => s + p.amount, 0)
          const paidPaymentsSum = paidPayments.reduce((s, p) => s + p.amount, 0)
          const progress = totalPaymentsSum > 0 ? (paidPaymentsSum / totalPaymentsSum) * 100 : 0

          return (
            <div key={loan.id} className="bg-white rounded-2xl border border-gray-100 hover:shadow-md transition overflow-hidden">
              {/* Основная информация */}
              <div className="p-5">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-4 flex-1 min-w-0">
                    <div className={`p-2.5 rounded-xl ${lt.color} shrink-0`}>
                      <Icon className="w-5 h-5" />
                    </div>
                    <div className="min-w-0">
                      <h3 className="font-semibold text-gray-900">{loan.name}</h3>
                      <div className="flex flex-wrap items-center gap-2 mt-1 text-xs text-gray-500">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${lt.color}`}>{lt.label}</span>
                        <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600">{st.label}</span>
                        {loan.creditor && <span>{loan.creditor}</span>}
                        {loan.interestRate && (
                          <span className="flex items-center gap-0.5"><Percent className="w-3 h-3" />{loan.interestRate}%</span>
                        )}
                        {loan.totalMonths && <span>{loan.totalMonths} мес.</span>}
                        <span>Платёж {loan.paymentDay}-го числа</span>
                        {overduePayments.length > 0 && (
                          <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">
                            {overduePayments.length} просрочено
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <div className="text-right mr-2">
                      <p className="text-lg font-bold text-red-600">{formatMoney(loan.monthlyPayment)}</p>
                      <p className="text-xs text-gray-400">в месяц</p>
                    </div>
                    <button onClick={() => openEdit(loan)} className="p-1.5 hover:bg-gray-100 rounded-lg transition">
                      <Edit className="w-4 h-4 text-gray-400" />
                    </button>
                    <button onClick={() => handleDelete(loan.id)} className="p-1.5 hover:bg-red-50 rounded-lg transition">
                      <Trash2 className="w-4 h-4 text-gray-400 hover:text-red-500" />
                    </button>
                  </div>
                </div>

                {/* Прогресс-бар */}
                <div className="mt-4">
                  <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
                    <span>Оплачено {paidPayments.length} из {loan.payments.length} платежей ({Math.round(progress)}%)</span>
                    <span>{formatMoney(paidPaymentsSum)} из {formatMoney(totalPaymentsSum)}</span>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-2">
                    <div
                      className="bg-gradient-to-r from-emerald-400 to-emerald-500 h-2 rounded-full transition-all"
                      style={{ width: `${Math.min(progress, 100)}%` }}
                    />
                  </div>
                  <div className="flex items-center justify-between text-xs text-gray-400 mt-1">
                    <span className="flex items-center">
                      Тело кредита: {formatMoney(loan.remainingAmount)}
                      <FieldHint text="Остаток по телу кредита из банковского приложения. Разбивка тело/проценты в каждом платеже не учитывается — это связано с особенностями условий по взятым кредитам." />
                    </span>
                    {loan.endDate && <span>До: {formatDate(loan.endDate)}</span>}
                  </div>
                </div>

                {/* Кнопка раскрытия графика */}
                <button
                  onClick={() => setExpandedLoan(isExpanded ? null : loan.id)}
                  className="mt-3 flex items-center gap-2 text-sm text-indigo-600 hover:text-indigo-700 font-medium transition"
                >
                  {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  График платежей ({loan.payments.length})
                  {overduePayments.length > 0 && (
                    <span className="text-red-500 text-xs">({overduePayments.length} просрочено)</span>
                  )}
                </button>
              </div>

              {/* Раскрывающийся график платежей */}
              {isExpanded && (
                <div className="border-t border-gray-100 bg-gray-50/50">
                  {/* Действия */}
                  <div className="px-5 pt-4 pb-2 flex items-center gap-3 flex-wrap">
                    {loan.scheduleType !== 'MANUAL' && (
                      <button
                        onClick={() => handleGenerateSchedule(loan.id)}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-indigo-50 text-indigo-600 rounded-lg hover:bg-indigo-100 transition"
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                        {loan.payments.length > 0 ? 'Пересчитать' : 'Сгенерировать'} график
                      </button>
                    )}
                    {loan.scheduleType === 'MANUAL' && (
                      <button
                        onClick={() => setShowAddPayment(showAddPayment === loan.id ? null : loan.id)}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-emerald-50 text-emerald-600 rounded-lg hover:bg-emerald-100 transition"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        Добавить платёж
                      </button>
                    )}
                    <div className="flex items-center gap-3 text-xs text-gray-500 ml-auto">
                      <span className="flex items-center gap-1"><span className="w-2 h-2 bg-emerald-500 rounded-full"></span> Оплачено: {paidPayments.length}</span>
                      <span className="flex items-center gap-1"><span className="w-2 h-2 bg-amber-500 rounded-full"></span> Предстоит: {upcomingPayments.length}</span>
                      {overduePayments.length > 0 && (
                        <span className="flex items-center gap-1"><span className="w-2 h-2 bg-red-500 rounded-full"></span> Просрочено: {overduePayments.length}</span>
                      )}
                    </div>
                  </div>

                  {/* Форма добавления платежа (для MANUAL) */}
                  {showAddPayment === loan.id && (
                    <div className="px-5 pb-3">
                      <form onSubmit={(e) => handleAddPayment(e, loan.id)} className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                          <div>
                            <label className="block text-xs font-medium text-gray-500 mb-1">Сумма</label>
                            <input
                              type="number"
                              step="0.01"
                              value={paymentForm.amount}
                              onChange={e => setPaymentForm(f => ({ ...f, amount: e.target.value }))}
                              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                              required
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-gray-500 mb-1">Дата</label>
                            <input
                              type="date"
                              value={paymentForm.date}
                              onChange={e => setPaymentForm(f => ({ ...f, date: e.target.value }))}
                              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                              required
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-gray-500 mb-1">Тело</label>
                            <input
                              type="number"
                              step="0.01"
                              value={paymentForm.principalPart}
                              onChange={e => setPaymentForm(f => ({ ...f, principalPart: e.target.value }))}
                              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                              placeholder="опционально"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-gray-500 mb-1">Проценты</label>
                            <input
                              type="number"
                              step="0.01"
                              value={paymentForm.interestPart}
                              onChange={e => setPaymentForm(f => ({ ...f, interestPart: e.target.value }))}
                              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                              placeholder="опционально"
                            />
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <input
                            type="text"
                            value={paymentForm.comment}
                            onChange={e => setPaymentForm(f => ({ ...f, comment: e.target.value }))}
                            className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                            placeholder="Комментарий (опционально)"
                          />
                          <label className="flex items-center gap-1.5 text-xs text-gray-600 cursor-pointer whitespace-nowrap">
                            <input
                              type="checkbox"
                              checked={paymentForm.isPaid}
                              onChange={e => setPaymentForm(f => ({ ...f, isPaid: e.target.checked }))}
                              className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                            />
                            Оплачен
                          </label>
                          <button type="submit" className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition">
                            Добавить
                          </button>
                          <button type="button" onClick={() => setShowAddPayment(null)} className="px-3 py-2 text-gray-500 hover:bg-gray-100 rounded-lg text-sm transition">
                            Отмена
                          </button>
                        </div>
                      </form>
                    </div>
                  )}

                  {/* Таблица платежей */}
                  {loan.payments.length > 0 ? (
                    <div className="px-5 pb-4 overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="text-xs text-gray-500 uppercase">
                            <th className="py-2 px-2 text-left font-medium">#</th>
                            <th className="py-2 px-2 text-left font-medium">Дата</th>
                            <th className="py-2 px-2 text-right font-medium">Сумма</th>
                            <th className="py-2 px-2 text-right font-medium">Тело</th>
                            <th className="py-2 px-2 text-right font-medium">%</th>
                            <th className="py-2 px-2 text-center font-medium">Статус</th>
                            <th className="py-2 px-2 text-right font-medium">Действия</th>
                          </tr>
                        </thead>
                        <tbody>
                          {loan.payments.map((p, idx) => {
                            const status = getPaymentStatus(p)
                            return (
                              <tr
                                key={p.id}
                                className={`border-t border-gray-100 ${
                                  status === 'paid' ? 'bg-emerald-50/50' :
                                  status === 'overdue' ? 'bg-red-50/50' :
                                  ''
                                }`}
                              >
                                <td className="py-2.5 px-2 text-gray-400">{idx + 1}</td>
                                <td className="py-2.5 px-2 text-gray-700">{formatDate(p.date)}</td>
                                <td className="py-2.5 px-2 text-right font-medium text-gray-900">{formatMoney(p.amount)}</td>
                                <td className="py-2.5 px-2 text-right text-gray-500">
                                  {p.principalPart != null ? formatMoney(p.principalPart) : '—'}
                                </td>
                                <td className="py-2.5 px-2 text-right text-gray-500">
                                  {p.interestPart != null ? formatMoney(p.interestPart) : '—'}
                                </td>
                                <td className="py-2.5 px-2 text-center">
                                  {status === 'paid' && (
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700">
                                      <Check className="w-3 h-3" /> Оплачен
                                    </span>
                                  )}
                                  {status === 'overdue' && (
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">
                                      <AlertTriangle className="w-3 h-3" /> Просрочен
                                    </span>
                                  )}
                                  {status === 'upcoming' && (
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700">
                                      <Clock className="w-3 h-3" /> Предстоит
                                    </span>
                                  )}
                                </td>
                                <td className="py-2.5 px-2 text-right">
                                  <div className="flex items-center justify-end gap-1">
                                    {!p.isPaid ? (
                                      <button
                                        onClick={() => handleMarkPaid(loan.id, p.id)}
                                        className="p-1 hover:bg-emerald-100 rounded text-emerald-600 transition"
                                        title="Отметить оплаченным"
                                      >
                                        <Check className="w-4 h-4" />
                                      </button>
                                    ) : (
                                      <button
                                        onClick={() => handleMarkUnpaid(loan.id, p.id)}
                                        className="p-1 hover:bg-amber-100 rounded text-amber-600 transition"
                                        title="Отменить оплату"
                                      >
                                        <X className="w-4 h-4" />
                                      </button>
                                    )}
                                    <button
                                      onClick={() => handleDeletePayment(loan.id, p.id)}
                                      className="p-1 hover:bg-red-100 rounded text-gray-400 hover:text-red-500 transition"
                                      title="Удалить"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            )
                          })}
                        </tbody>
                        <tfoot>
                          <tr className="border-t-2 border-gray-200 font-medium">
                            <td className="py-2.5 px-2 text-gray-500" colSpan={2}>Итого</td>
                            <td className="py-2.5 px-2 text-right text-gray-900">
                              {formatMoney(loan.payments.reduce((s, p) => s + p.amount, 0))}
                            </td>
                            <td className="py-2.5 px-2 text-right text-gray-500">
                              {loan.payments.some(p => p.principalPart != null) ?
                                formatMoney(loan.payments.reduce((s, p) => s + (p.principalPart || 0), 0)) : '—'}
                            </td>
                            <td className="py-2.5 px-2 text-right text-gray-500">
                              {loan.payments.some(p => p.interestPart != null) ?
                                formatMoney(loan.payments.reduce((s, p) => s + (p.interestPart || 0), 0)) : '—'}
                            </td>
                            <td className="py-2.5 px-2 text-center text-xs text-gray-500">
                              {paidPayments.length} из {loan.payments.length}
                            </td>
                            <td></td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  ) : (
                    <div className="px-5 pb-4 text-center text-sm text-gray-400 py-6">
                      {loan.scheduleType === 'MANUAL'
                        ? 'Нет платежей. Добавьте вручную.'
                        : 'График не сгенерирован. Нажмите "Сгенерировать график".'}
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        }) : (
          <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center">
            <Landmark className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500">Нет активных кредитов и займов</p>
            <button
              onClick={() => setShowAddLoan(true)}
              className="mt-3 text-indigo-600 text-sm font-medium hover:underline"
            >
              Добавить первый
            </button>
          </div>
        )}
      </div>

      {/* Модалка: Добавить/редактировать займ */}
      {showAddLoan && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => setShowAddLoan(false)}>
          <div className="bg-white rounded-2xl w-full max-w-lg p-6 shadow-2xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-semibold text-gray-900">
                {editingLoan ? 'Редактировать' : 'Новый кредит / займ'}
              </h2>
              <button onClick={() => setShowAddLoan(false)} className="p-1 hover:bg-gray-100 rounded-lg">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Тип */}
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-2">Тип обязательства</label>
                <div className="flex gap-2">
                  {Object.entries(LOAN_TYPES).map(([key, val]) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setForm(f => ({ ...f, loanType: key }))}
                      className={`flex-1 py-2.5 rounded-xl text-sm font-medium transition flex items-center justify-center gap-1.5 ${
                        form.loanType === key ? val.color + ' ring-2 ring-current/20' : 'bg-gray-50 text-gray-500'
                      }`}
                    >
                      {val.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Тип графика */}
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-2">Тип графика платежей</label>
                <div className="grid grid-cols-2 gap-2">
                  {Object.entries(SCHEDULE_TYPES).map(([key, val]) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setForm(f => ({ ...f, scheduleType: key }))}
                      className={`py-2.5 px-3 rounded-xl text-left transition ${
                        form.scheduleType === key
                          ? 'bg-indigo-50 text-indigo-700 ring-2 ring-indigo-200'
                          : 'bg-gray-50 text-gray-500 hover:bg-gray-100'
                      }`}
                    >
                      <span className="text-sm font-medium block">{val.label}</span>
                      <span className="text-xs opacity-70">{val.description}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Название</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  placeholder="Кредит Сбер на оборотку"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Кредитор</label>
                <input
                  type="text"
                  value={form.creditor}
                  onChange={e => setForm(f => ({ ...f, creditor: e.target.value }))}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  placeholder="Сбербанк, Альфа-Лизинг, ИП Петров..."
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="flex items-center text-xs font-medium text-gray-500 mb-1">
                    Сумма займа
                    <FieldHint text="Полная сумма кредита/займа/лизинга (тело долга)." />
                  </label>
                  <input
                    type="number"
                    value={form.totalAmount}
                    onChange={e => setForm(f => ({ ...f, totalAmount: e.target.value }))}
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    placeholder="0"
                    required
                  />
                </div>
                <div>
                  <label className="flex items-center text-xs font-medium text-gray-500 mb-1">
                    Остаток
                    <FieldHint text="Сколько осталось погасить. По умолчанию = сумме займа." />
                  </label>
                  <input
                    type="number"
                    value={form.remainingAmount}
                    onChange={e => setForm(f => ({ ...f, remainingAmount: e.target.value }))}
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    placeholder="= сумме займа"
                  />
                </div>
              </div>

              {/* Поля для авто-расчёта */}
              {needsAutoFields && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="flex items-center text-xs font-medium text-gray-500 mb-1">
                      Ставка % годовых
                      <FieldHint text="Годовая процентная ставка. Для частных займов — тоже в % годовых (напр. 36% = 3% в месяц)." />
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      value={form.interestRate}
                      onChange={e => setForm(f => ({ ...f, interestRate: e.target.value }))}
                      className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                      placeholder="24"
                      required
                    />
                  </div>
                  <div>
                    <label className="flex items-center text-xs font-medium text-gray-500 mb-1">
                      Срок (мес.)
                      <FieldHint text="Количество месяцев для расчёта графика." />
                    </label>
                    <input
                      type="number"
                      value={form.totalMonths}
                      onChange={e => setForm(f => ({ ...f, totalMonths: e.target.value }))}
                      className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                      placeholder="12"
                      required
                    />
                  </div>
                </div>
              )}

              {/* Ежемесячный платёж — для MANUAL */}
              {form.scheduleType === 'MANUAL' && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Ежемесячный платёж</label>
                    <input
                      type="number"
                      value={form.monthlyPayment}
                      onChange={e => setForm(f => ({ ...f, monthlyPayment: e.target.value }))}
                      className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                      placeholder="0"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Ставка %</label>
                    <input
                      type="number"
                      step="0.1"
                      value={form.interestRate}
                      onChange={e => setForm(f => ({ ...f, interestRate: e.target.value }))}
                      className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                      placeholder="необязательно"
                    />
                  </div>
                </div>
              )}

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Число оплаты</label>
                  <input
                    type="number"
                    min="1"
                    max="31"
                    value={form.paymentDay}
                    onChange={e => setForm(f => ({ ...f, paymentDay: e.target.value }))}
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Дата начала</label>
                  <input
                    type="date"
                    value={form.startDate}
                    onChange={e => setForm(f => ({ ...f, startDate: e.target.value }))}
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">До</label>
                  <input
                    type="date"
                    value={form.endDate}
                    onChange={e => setForm(f => ({ ...f, endDate: e.target.value }))}
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  />
                </div>
              </div>

              <button
                type="submit"
                className="w-full py-3 bg-indigo-600 text-white rounded-xl font-medium hover:bg-indigo-700 transition"
              >
                {editingLoan ? 'Сохранить' : 'Добавить'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
