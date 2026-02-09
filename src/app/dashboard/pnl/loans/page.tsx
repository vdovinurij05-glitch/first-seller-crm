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
  HelpCircle
} from 'lucide-react'

interface Loan {
  id: string
  name: string
  loanType: string
  totalAmount: number
  remainingAmount: number
  monthlyPayment: number
  interestRate: number | null
  paymentDay: number
  startDate: string
  endDate: string | null
  creditor: string | null
  isActive: boolean
}

interface LoanSummary {
  totalMonthly: number
  totalRemaining: number
  totalDebt: number
  activeCount: number
}

function formatMoney(n: number) {
  return new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB', maximumFractionDigits: 0 }).format(n)
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

export default function LoansPage() {
  const [loans, setLoans] = useState<Loan[]>([])
  const [summary, setSummary] = useState<LoanSummary>({ totalMonthly: 0, totalRemaining: 0, totalDebt: 0, activeCount: 0 })
  const [loading, setLoading] = useState(true)
  const [showAddLoan, setShowAddLoan] = useState(false)
  const [editingLoan, setEditingLoan] = useState<Loan | null>(null)

  const [form, setForm] = useState({
    name: '',
    loanType: 'CREDIT',
    totalAmount: '',
    remainingAmount: '',
    monthlyPayment: '',
    interestRate: '',
    paymentDay: '1',
    startDate: new Date().toISOString().slice(0, 10),
    endDate: '',
    creditor: '',
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
    if (!confirm('Удалить этот займ?')) return
    await fetch(`/api/pnl/loans/${id}`, { method: 'DELETE' })
    fetchLoans()
  }

  const openEdit = (loan: Loan) => {
    setEditingLoan(loan)
    setForm({
      name: loan.name,
      loanType: loan.loanType,
      totalAmount: String(loan.totalAmount),
      remainingAmount: String(loan.remainingAmount),
      monthlyPayment: String(loan.monthlyPayment),
      interestRate: loan.interestRate ? String(loan.interestRate) : '',
      paymentDay: String(loan.paymentDay),
      startDate: new Date(loan.startDate).toISOString().slice(0, 10),
      endDate: loan.endDate ? new Date(loan.endDate).toISOString().slice(0, 10) : '',
      creditor: loan.creditor || '',
    })
    setShowAddLoan(true)
  }

  const resetForm = () => {
    setForm({
      name: '', loanType: 'CREDIT', totalAmount: '', remainingAmount: '',
      monthlyPayment: '', interestRate: '', paymentDay: '1',
      startDate: new Date().toISOString().slice(0, 10), endDate: '', creditor: '',
    })
  }

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

        <div className="bg-white rounded-2xl border border-gray-100 p-5 hover:shadow-md transition">
          <div className="flex items-center gap-2 mb-2">
            <div className="p-1.5 bg-blue-50 rounded-lg"><CreditCard className="w-4 h-4 text-blue-600" /></div>
            <span className="text-xs font-medium text-gray-500">Всего взято</span>
          </div>
          <p className="text-xl font-bold text-gray-900">{formatMoney(summary.totalDebt)}</p>
          <p className="text-xs text-gray-400 mt-1">начальная сумма</p>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 p-5 hover:shadow-md transition">
          <div className="flex items-center gap-2 mb-2">
            <div className="p-1.5 bg-purple-50 rounded-lg"><CalendarDays className="w-4 h-4 text-purple-600" /></div>
            <span className="text-xs font-medium text-gray-500">Активных</span>
          </div>
          <p className="text-xl font-bold text-gray-900">{summary.activeCount}</p>
          <p className="text-xs text-gray-400 mt-1">кредитов/займов</p>
        </div>
      </div>

      {/* Список займов */}
      <div className="space-y-4">
        {loans.length > 0 ? loans.map(loan => {
          const lt = LOAN_TYPES[loan.loanType] || LOAN_TYPES.LOAN
          const Icon = lt.icon
          const progress = loan.totalAmount > 0 ? ((loan.totalAmount - loan.remainingAmount) / loan.totalAmount) * 100 : 0

          return (
            <div key={loan.id} className="bg-white rounded-2xl border border-gray-100 p-5 hover:shadow-md transition">
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-4">
                  <div className={`p-2.5 rounded-xl ${lt.color}`}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900">{loan.name}</h3>
                    <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${lt.color}`}>{lt.label}</span>
                      {loan.creditor && <span>{loan.creditor}</span>}
                      {loan.interestRate && (
                        <span className="flex items-center gap-0.5"><Percent className="w-3 h-3" />{loan.interestRate}%</span>
                      )}
                      <span>Платёж {loan.paymentDay}-го числа</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="text-right mr-3">
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
                  <span>Погашено {Math.round(progress)}%</span>
                  <span>Остаток: {formatMoney(loan.remainingAmount)}</span>
                </div>
                <div className="w-full bg-gray-100 rounded-full h-2">
                  <div
                    className="bg-gradient-to-r from-emerald-400 to-emerald-500 h-2 rounded-full transition-all"
                    style={{ width: `${Math.min(progress, 100)}%` }}
                  />
                </div>
                <div className="flex items-center justify-between text-xs text-gray-400 mt-1">
                  <span>Взято: {formatMoney(loan.totalAmount)}</span>
                  {loan.endDate && <span>До: {new Date(loan.endDate).toLocaleDateString('ru-RU')}</span>}
                </div>
              </div>
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
          <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-2xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
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
                    <FieldHint text="Полная сумма кредита/займа/лизинга, которую вы получили изначально." />
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
                    <FieldHint text="Сколько осталось погасить на данный момент. Обновляйте вручную по мере оплаты." />
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

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Ежемесячный платёж</label>
                  <input
                    type="number"
                    value={form.monthlyPayment}
                    onChange={e => setForm(f => ({ ...f, monthlyPayment: e.target.value }))}
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    placeholder="0"
                    required
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
                    placeholder="24"
                  />
                </div>
              </div>

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
