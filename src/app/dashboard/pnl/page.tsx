'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  Plus,
  X,
  Calendar,
  Building2,
  Tag,
  AlertTriangle,
  Wallet,
  ArrowUpRight,
  ArrowDownRight,
  Trash2,
  Edit,
  ChevronLeft,
  ChevronRight,
  LayoutGrid,
  List,
  Users,
  HandCoins,
  HelpCircle
} from 'lucide-react'
import {
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell
} from 'recharts'

interface FinanceCategory {
  id: string
  name: string
  type: string
  group: string | null
}

interface BusinessUnit {
  id: string
  name: string
}

interface SalesEmployee {
  id: string
  name: string
  salesCommissionPercent: number
}

interface LegalEntity {
  id: string
  name: string
  businessUnitId: string
  businessUnit: BusinessUnit
  initialBalance: number
  effectiveDate: string
  order: number
}

interface FinanceRecord {
  id: string
  amount: number
  type: string
  description: string | null
  date: string
  dueDate: string | null
  isPaid: boolean
  counterparty: string | null
  debtType: string | null
  client: string | null
  salesManagerId: string | null
  salesManager: SalesEmployee | null
  fromSafe: boolean
  categoryId: string
  businessUnitId: string | null
  legalEntityId: string | null
  category: FinanceCategory
  businessUnit: BusinessUnit | null
  legalEntity: LegalEntity | null
  source: string
  createdAt: string
}

interface AccountBalanceItem {
  legalEntityId: string
  name: string
  businessUnitName: string
  initialBalance: number
  totalIncome: number
  totalExpenses: number
  balance: number
}

interface Summary {
  totalIncome: number
  totalExpense: number
  profit: number
  totalUnpaid: number
  totalReceivable: number
  totalPayable: number
  totalBalance: number
  accountBalances: AccountBalanceItem[]
  byCategory: { name: string; group: string | null; income: number; expense: number }[]
  byBusinessUnit: { name: string; income: number; expense: number }[]
  upcomingExpenses: FinanceRecord[]
  receivables: FinanceRecord[]
  payables: FinanceRecord[]
}

const COLORS = ['#6366f1', '#8b5cf6', '#a855f7', '#ec4899', '#f43f5e', '#f97316', '#eab308', '#22c55e', '#14b8a6', '#06b6d4']

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

const GROUP_LABELS: Record<string, string> = {
  SALARY: 'Зарплата',
  ADMIN: 'Административные',
  MANDATORY: 'Обязательные',
  MARKETING: 'Маркетинг',
  OTHER: 'Прочее'
}

function formatMoney(n: number) {
  return new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB', maximumFractionDigits: 0 }).format(n)
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', year: 'numeric' })
}

export default function PnLPage() {
  const [records, setRecords] = useState<FinanceRecord[]>([])
  const [categories, setCategories] = useState<FinanceCategory[]>([])
  const [businessUnits, setBusinessUnits] = useState<BusinessUnit[]>([])
  const [employees, setEmployees] = useState<SalesEmployee[]>([])
  const [legalEntities, setLegalEntities] = useState<LegalEntity[]>([])
  const [summary, setSummary] = useState<Summary | null>(null)
  const [loading, setLoading] = useState(true)

  // Фильтры
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [filterBU, setFilterBU] = useState<string>('')
  const [filterLE, setFilterLE] = useState<string>('')
  const [filterType, setFilterType] = useState<string>('')
  const [viewMode, setViewMode] = useState<'cards' | 'table'>('cards')

  // Модалки
  const [showAddRecord, setShowAddRecord] = useState(false)
  const [showAddCategory, setShowAddCategory] = useState(false)
  const [showManageCategories, setShowManageCategories] = useState(false)
  const [showAddBU, setShowAddBU] = useState(false)
  const [showManageBU, setShowManageBU] = useState(false)
  const [editingRecord, setEditingRecord] = useState<FinanceRecord | null>(null)
  const [showLegalEntities, setShowLegalEntities] = useState(false)
  const [leForm, setLeForm] = useState({ name: '', businessUnitId: '', initialBalance: '', effectiveDate: new Date().getFullYear() + '-01-01' })
  const [editingLE, setEditingLE] = useState<LegalEntity | null>(null)

  // Форма записи
  const [form, setForm] = useState({
    amount: '',
    type: 'EXPENSE',
    description: '',
    date: new Date().toISOString().split('T')[0],
    dueDate: '',
    isPaid: true,
    categoryId: '',
    businessUnitId: '',
    legalEntityId: '',
    counterparty: '',
    debtType: '',
    client: '',
    salesManagerId: '',
    fromSafe: false
  })

  // Форма категории
  const [catForm, setCatForm] = useState({ name: '', type: 'EXPENSE', group: 'OTHER' })
  // Форма направления
  const [buForm, setBuForm] = useState({ name: '' })

  const monthStart = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1)
  const monthEnd = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0)

  useEffect(() => {
    fetchAll()
  }, [currentMonth, filterBU, filterLE])

  async function fetchAll() {
    setLoading(true)
    const from = monthStart.toISOString()
    const to = monthEnd.toISOString()
    const buParam = filterBU ? `&businessUnitId=${filterBU}` : ''
    const leParam = filterLE ? `&legalEntityId=${filterLE}` : ''

    const [recRes, catRes, buRes, sumRes, empRes, leRes] = await Promise.all([
      fetch(`/api/pnl?from=${from}&to=${to}${buParam}${leParam}`),
      fetch('/api/pnl/categories'),
      fetch('/api/pnl/business-units'),
      fetch(`/api/pnl/summary?from=${from}&to=${to}${buParam}${leParam}`),
      fetch('/api/pnl/employees'),
      fetch('/api/pnl/legal-entities')
    ])

    if (recRes.ok) {
      const data = await recRes.json()
      setRecords(data.records)
    }
    if (catRes.ok) {
      const data = await catRes.json()
      setCategories(data.categories)
    }
    if (buRes.ok) {
      const data = await buRes.json()
      setBusinessUnits(data.units)
    }
    if (sumRes.ok) {
      const data = await sumRes.json()
      setSummary(data)
    }
    if (empRes.ok) {
      const data = await empRes.json()
      setEmployees(Array.isArray(data) ? data : [])
    }
    if (leRes.ok) {
      const data = await leRes.json()
      setLegalEntities(data.legalEntities || [])
    }
    setLoading(false)
  }

  async function handleSubmitRecord(e: React.FormEvent) {
    e.preventDefault()
    const url = editingRecord ? `/api/pnl/${editingRecord.id}` : '/api/pnl'
    const method = editingRecord ? 'PUT' : 'POST'

    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...form,
        amount: parseFloat(form.amount)
      })
    })

    if (res.ok) {
      setShowAddRecord(false)
      setEditingRecord(null)
      resetForm()
      fetchAll()
    }
  }

  async function handleDeleteRecord(id: string) {
    if (!confirm('Удалить запись?')) return
    await fetch(`/api/pnl/${id}`, { method: 'DELETE' })
    fetchAll()
  }

  async function handleSubmitCategory(e: React.FormEvent) {
    e.preventDefault()
    const res = await fetch('/api/pnl/categories', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(catForm)
    })
    if (res.ok) {
      setShowAddCategory(false)
      setCatForm({ name: '', type: 'EXPENSE', group: 'OTHER' })
      fetchAll()
    }
  }

  async function handleDeleteCategory(id: string, name: string) {
    if (!confirm(`Удалить категорию "${name}"?`)) return

    const res = await fetch(`/api/pnl/categories/${id}`, {
      method: 'DELETE'
    })

    if (res.ok) {
      fetchAll()
    } else {
      const data = await res.json()
      alert(data.error || 'Ошибка при удалении категории')
    }
  }

  async function handleDeleteBU(id: string, name: string) {
    if (!confirm(`Удалить направление "${name}"?`)) return

    const res = await fetch(`/api/pnl/business-units/${id}`, {
      method: 'DELETE'
    })

    if (res.ok) {
      fetchAll()
    } else {
      const data = await res.json()
      alert(data.error || 'Ошибка при удалении направления')
    }
  }

  async function handleSubmitBU(e: React.FormEvent) {
    e.preventDefault()
    const res = await fetch('/api/pnl/business-units', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(buForm)
    })
    if (res.ok) {
      setShowAddBU(false)
      setBuForm({ name: '' })
      fetchAll()
    }
  }

  async function handleSubmitLE(e: React.FormEvent) {
    e.preventDefault()
    const url = editingLE ? `/api/pnl/legal-entities/${editingLE.id}` : '/api/pnl/legal-entities'
    const method = editingLE ? 'PUT' : 'POST'
    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: leForm.name,
        businessUnitId: leForm.businessUnitId,
        initialBalance: parseFloat(leForm.initialBalance) || 0,
        effectiveDate: leForm.effectiveDate
      })
    })
    if (res.ok) {
      setLeForm({ name: '', businessUnitId: '', initialBalance: '', effectiveDate: new Date().getFullYear() + '-01-01' })
      setEditingLE(null)
      fetchAll()
    }
  }

  async function handleDeleteLE(id: string, name: string) {
    if (!confirm(`Удалить юр.лицо "${name}"? Записи будут отвязаны.`)) return
    const res = await fetch(`/api/pnl/legal-entities/${id}`, { method: 'DELETE' })
    if (res.ok) fetchAll()
  }

  function resetForm() {
    setForm({
      amount: '',
      type: 'EXPENSE',
      description: '',
      date: new Date().toISOString().split('T')[0],
      dueDate: '',
      isPaid: true,
      categoryId: '',
      businessUnitId: '',
      legalEntityId: '',
      counterparty: '',
      debtType: '',
      client: '',
      salesManagerId: '',
      fromSafe: false
    })
  }

  function openEdit(record: FinanceRecord) {
    setEditingRecord(record)
    setForm({
      amount: String(record.amount),
      type: record.type,
      description: record.description || '',
      date: record.date.split('T')[0],
      dueDate: record.dueDate ? record.dueDate.split('T')[0] : '',
      isPaid: record.isPaid,
      categoryId: record.categoryId,
      businessUnitId: record.businessUnitId || '',
      legalEntityId: record.legalEntityId || '',
      counterparty: record.counterparty || '',
      debtType: record.debtType || '',
      client: record.client || '',
      salesManagerId: record.salesManagerId || '',
      fromSafe: record.fromSafe || false
    })
    setShowAddRecord(true)
  }

  function prevMonth() {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1))
  }

  function nextMonth() {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1))
  }

  const monthName = currentMonth.toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' })

  // Данные для графика расходов по категориям
  const expenseChartData = summary?.byCategory
    .filter(c => c.expense > 0)
    .sort((a, b) => b.expense - a.expense) || []

  // Данные для pie chart по направлениям
  const buChartData = summary?.byBusinessUnit
    .filter(b => b.expense > 0 || b.income > 0)
    .map(b => ({ name: b.name, value: b.income + b.expense })) || []

  // Фильтрованные записи
  const filteredRecords = filterType
    ? records.filter(r => r.type === filterType)
    : records

  if (loading && !summary) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full" />
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">P&L</h1>
          <p className="text-gray-500 text-sm mt-1">Управленческий учёт</p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/dashboard/pnl/calendar"
            className="px-3 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 transition flex items-center gap-1.5"
          >
            <Calendar className="w-4 h-4" />
            Календарь
          </Link>
          <Link
            href="/dashboard/pnl/salary"
            className="px-3 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 transition flex items-center gap-1.5"
          >
            <Users className="w-4 h-4" />
            Зарплаты
          </Link>
          <Link
            href="/dashboard/pnl/loans"
            className="px-3 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 transition flex items-center gap-1.5"
          >
            <HandCoins className="w-4 h-4" />
            Кредиты
          </Link>
          <button
            onClick={() => setShowManageBU(true)}
            className="px-3 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 transition flex items-center gap-1.5"
          >
            <Building2 className="w-4 h-4" />
            Направления
          </button>
          <button
            onClick={() => setShowManageCategories(true)}
            className="px-3 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 transition flex items-center gap-1.5"
          >
            <Tag className="w-4 h-4" />
            Категории
          </button>
          <button
            onClick={() => { resetForm(); setEditingRecord(null); setShowAddRecord(true) }}
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition flex items-center gap-1.5 text-sm font-medium"
          >
            <Plus className="w-4 h-4" />
            Запись
          </button>
        </div>
      </div>

      {/* Переключатель месяца и фильтры */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3 bg-white rounded-xl border border-gray-200 px-4 py-2">
          <button onClick={prevMonth} className="p-1 hover:bg-gray-100 rounded-lg transition">
            <ChevronLeft className="w-5 h-5 text-gray-600" />
          </button>
          <span className="text-sm font-medium text-gray-900 capitalize min-w-[140px] text-center">{monthName}</span>
          <button onClick={nextMonth} className="p-1 hover:bg-gray-100 rounded-lg transition">
            <ChevronRight className="w-5 h-5 text-gray-600" />
          </button>
        </div>

        <div className="flex items-center gap-2">
          {businessUnits.length > 0 && (
            <select
              value={filterBU}
              onChange={e => { setFilterBU(e.target.value); setFilterLE('') }}
              className="px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white"
            >
              <option value="">Все направления</option>
              {businessUnits.map(bu => (
                <option key={bu.id} value={bu.id}>{bu.name}</option>
              ))}
            </select>
          )}
          {legalEntities.filter(le => !filterBU || le.businessUnitId === filterBU).length > 0 && (
            <select
              value={filterLE}
              onChange={e => setFilterLE(e.target.value)}
              className="px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white"
            >
              <option value="">Все юр.лица</option>
              {legalEntities
                .filter(le => !filterBU || le.businessUnitId === filterBU)
                .map(le => (
                  <option key={le.id} value={le.id}>{le.name}</option>
                ))}
            </select>
          )}
          <div className="flex border border-gray-200 rounded-lg overflow-hidden">
            <button
              onClick={() => setViewMode('cards')}
              className={`p-2 ${viewMode === 'cards' ? 'bg-indigo-50 text-indigo-600' : 'text-gray-400 hover:bg-gray-50'}`}
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('table')}
              className={`p-2 ${viewMode === 'table' ? 'bg-indigo-50 text-indigo-600' : 'text-gray-400 hover:bg-gray-50'}`}
            >
              <List className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Виджеты сводки */}
      {summary && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          <div className="bg-white rounded-2xl border border-gray-100 p-5 hover:shadow-md transition">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Доходы</span>
              <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center">
                <ArrowUpRight className="w-4 h-4 text-emerald-600" />
              </div>
            </div>
            <p className="text-2xl font-bold text-gray-900">{formatMoney(summary.totalIncome)}</p>
          </div>

          <div className="bg-white rounded-2xl border border-gray-100 p-5 hover:shadow-md transition">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Расходы</span>
              <div className="w-8 h-8 rounded-lg bg-red-50 flex items-center justify-center">
                <ArrowDownRight className="w-4 h-4 text-red-500" />
              </div>
            </div>
            <p className="text-2xl font-bold text-gray-900">{formatMoney(summary.totalExpense)}</p>
          </div>

          <div className={`rounded-2xl border p-5 hover:shadow-md transition ${
            summary.profit >= 0
              ? 'bg-gradient-to-br from-emerald-50 to-teal-50 border-emerald-100'
              : 'bg-gradient-to-br from-red-50 to-orange-50 border-red-100'
          }`}>
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Чистыми</span>
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                summary.profit >= 0 ? 'bg-emerald-100' : 'bg-red-100'
              }`}>
                {summary.profit >= 0
                  ? <TrendingUp className="w-4 h-4 text-emerald-600" />
                  : <TrendingDown className="w-4 h-4 text-red-500" />}
              </div>
            </div>
            <p className={`text-2xl font-bold ${summary.profit >= 0 ? 'text-emerald-700' : 'text-red-600'}`}>
              {formatMoney(summary.profit)}
            </p>
          </div>

          <div className={`rounded-2xl border p-5 hover:shadow-md transition ${
            summary.totalUnpaid > 0
              ? 'bg-gradient-to-br from-amber-50 to-yellow-50 border-amber-100'
              : 'bg-white border-gray-100'
          }`}>
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Ожидает оплаты</span>
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                summary.totalUnpaid > 0 ? 'bg-amber-100' : 'bg-gray-50'
              }`}>
                <Wallet className="w-4 h-4 text-amber-600" />
              </div>
            </div>
            <p className={`text-2xl font-bold ${summary.totalUnpaid > 0 ? 'text-amber-700' : 'text-gray-400'}`}>
              {formatMoney(summary.totalUnpaid)}
            </p>
          </div>

          {/* Баланс */}
          <div
            className="rounded-2xl border p-5 hover:shadow-md transition cursor-pointer bg-gradient-to-br from-violet-50 to-purple-50 border-violet-100"
            onClick={() => setShowLegalEntities(true)}
          >
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Остаток</span>
              <div className="w-8 h-8 rounded-lg bg-violet-100 flex items-center justify-center">
                <Wallet className="w-4 h-4 text-violet-600" />
              </div>
            </div>
            <p className={`text-2xl font-bold ${
              summary.totalBalance >= 0 ? 'text-violet-700' : 'text-red-600'
            }`}>
              {formatMoney(summary.totalBalance)}
            </p>
            {summary.accountBalances && summary.accountBalances.length > 0 && (
              <div className="mt-2 space-y-1">
                {summary.accountBalances.map(ab => (
                  <div key={ab.legalEntityId} className="flex justify-between text-xs">
                    <span className="text-gray-500 truncate">{ab.name}</span>
                    <span className={ab.balance >= 0 ? 'text-violet-600' : 'text-red-500'}>{formatMoney(ab.balance)}</span>
                  </div>
                ))}
              </div>
            )}
            <p className="text-xs text-gray-400 mt-1">Юр.лица</p>
          </div>
        </div>
      )}

      {/* Дебиторка / Кредиторка */}
      {summary && (summary.totalReceivable > 0 || summary.totalPayable > 0) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Нам должны */}
          <div className="bg-white rounded-2xl border border-gray-100 p-5">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center">
                <HandCoins className="w-4 h-4 text-blue-600" />
              </div>
              <div>
                <p className="text-xs font-medium text-gray-500 uppercase">Нам должны (дебиторка)</p>
                <p className="text-xl font-bold text-blue-600">{formatMoney(summary.totalReceivable)}</p>
              </div>
            </div>
            {summary.receivables.length > 0 && (
              <div className="space-y-2 mt-3">
                {summary.receivables.map(r => (
                  <div key={r.id} className="flex items-center justify-between bg-blue-50/50 rounded-xl px-3 py-2">
                    <div>
                      <span className="text-sm font-medium text-gray-900">{r.counterparty || r.description || r.category.name}</span>
                      {r.dueDate && <span className="text-xs text-gray-500 ml-2">{formatDate(r.dueDate)}</span>}
                    </div>
                    <span className="text-sm font-bold text-blue-600">{formatMoney(r.amount)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Мы должны */}
          <div className="bg-white rounded-2xl border border-gray-100 p-5">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 rounded-lg bg-orange-50 flex items-center justify-center">
                <Users className="w-4 h-4 text-orange-600" />
              </div>
              <div>
                <p className="text-xs font-medium text-gray-500 uppercase">Мы должны (кредиторка)</p>
                <p className="text-xl font-bold text-orange-600">{formatMoney(summary.totalPayable)}</p>
              </div>
            </div>
            {summary.payables.length > 0 && (
              <div className="space-y-2 mt-3">
                {summary.payables.map(r => (
                  <div key={r.id} className="flex items-center justify-between bg-orange-50/50 rounded-xl px-3 py-2">
                    <div>
                      <span className="text-sm font-medium text-gray-900">{r.counterparty || r.description || r.category.name}</span>
                      {r.dueDate && <span className="text-xs text-gray-500 ml-2">{formatDate(r.dueDate)}</span>}
                    </div>
                    <span className="text-sm font-bold text-orange-600">{formatMoney(r.amount)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Расходы по категориям — полная ширина */}
      {summary && expenseChartData.length > 0 && (() => {
        const totalExpense = expenseChartData.reduce((s, c) => s + c.expense, 0)
        return (
          <div className="bg-white rounded-2xl border border-gray-100 p-5">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-sm font-medium text-gray-900">Расходы по категориям</h3>
              <span className="text-sm text-gray-500">Итого: <span className="font-bold text-red-500">{formatMoney(totalExpense)}</span></span>
            </div>
            <div className="space-y-3">
              {expenseChartData.map((cat, i) => {
                const pct = totalExpense > 0 ? (cat.expense / totalExpense) * 100 : 0
                return (
                  <div key={cat.name} className="group">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm text-gray-700 truncate mr-3">{cat.name}</span>
                      <div className="flex items-center gap-3 shrink-0">
                        <span className="text-xs text-gray-400">{pct.toFixed(1)}%</span>
                        <span className="text-sm font-semibold text-gray-900 w-28 text-right">{formatMoney(cat.expense)}</span>
                      </div>
                    </div>
                    <div className="h-5 bg-gray-50 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{
                          width: `${Math.max(pct, 0.5)}%`,
                          backgroundColor: COLORS[i % COLORS.length]
                        }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )
      })()}

      {/* По направлениям — pie chart */}
      {summary && buChartData.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 p-5">
          <h3 className="text-sm font-medium text-gray-900 mb-4">По направлениям</h3>
          <ResponsiveContainer width="100%" height={250}>
            <PieChart>
              <Pie
                data={buChartData}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={100}
                dataKey="value"
                label={(props) => `${props.name ?? ''} ${(((props.percent as number) ?? 0) * 100).toFixed(0)}%`}
                fontSize={12}
              >
                {buChartData.map((_, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip formatter={(v) => formatMoney(Number(v))} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* По направлениям — карточки */}
      {summary && summary.byBusinessUnit.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {summary.byBusinessUnit.map((bu, i) => (
            <div key={i} className="bg-white rounded-2xl border border-gray-100 p-5 hover:shadow-md transition">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                <h3 className="font-medium text-gray-900">{bu.name}</h3>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Доходы</span>
                  <span className="text-emerald-600 font-medium">{formatMoney(bu.income)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Расходы</span>
                  <span className="text-red-500 font-medium">{formatMoney(bu.expense)}</span>
                </div>
                <div className="border-t pt-2 mt-2 flex justify-between text-sm">
                  <span className="text-gray-700 font-medium">Итого</span>
                  <span className={`font-bold ${bu.income - bu.expense >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                    {formatMoney(bu.income - bu.expense)}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Предстоящие расходы */}
      {summary && summary.upcomingExpenses.length > 0 && (
        <div className="bg-gradient-to-r from-amber-50 to-orange-50 rounded-2xl border border-amber-100 p-5">
          <div className="flex items-center gap-2 mb-4">
            <AlertTriangle className="w-5 h-5 text-amber-600" />
            <h3 className="font-medium text-gray-900">Предстоящие расходы</h3>
            <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-medium">
              {summary.upcomingExpenses.length}
            </span>
          </div>
          <div className="space-y-2">
            {summary.upcomingExpenses.map(r => (
              <div key={r.id} className="flex items-center justify-between bg-white/80 rounded-xl px-4 py-3">
                <div className="flex items-center gap-3">
                  <div className="text-xs text-gray-500 min-w-[80px]">
                    {r.dueDate ? formatDate(r.dueDate) : formatDate(r.date)}
                  </div>
                  <span className="text-sm font-medium text-gray-900">{r.category.name}</span>
                  {r.description && <span className="text-sm text-gray-500">— {r.description}</span>}
                  {r.businessUnit && (
                    <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{r.businessUnit.name}</span>
                  )}
                </div>
                <span className="text-sm font-bold text-red-600">{formatMoney(r.amount)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Фильтры записей */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => setFilterType('')}
          className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${
            !filterType ? 'bg-indigo-100 text-indigo-700' : 'text-gray-500 hover:bg-gray-100'
          }`}
        >
          Все
        </button>
        <button
          onClick={() => setFilterType('INCOME')}
          className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${
            filterType === 'INCOME' ? 'bg-emerald-100 text-emerald-700' : 'text-gray-500 hover:bg-gray-100'
          }`}
        >
          Доходы
        </button>
        <button
          onClick={() => setFilterType('EXPENSE')}
          className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${
            filterType === 'EXPENSE' ? 'bg-red-100 text-red-700' : 'text-gray-500 hover:bg-gray-100'
          }`}
        >
          Расходы
        </button>
      </div>

      {/* Таблица записей */}
      {filteredRecords.length > 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="text-left px-5 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Дата</th>
                <th className="text-left px-5 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Категория</th>
                <th className="text-left px-5 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Описание</th>
                <th className="text-left px-5 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Направление</th>
                <th className="text-left px-5 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Менеджер</th>
                <th className="text-left px-5 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Статус</th>
                <th className="text-right px-5 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Сумма</th>
                <th className="px-5 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {filteredRecords.map(r => (
                <tr key={r.id} className="border-b border-gray-50 hover:bg-gray-50/50 transition">
                  <td className="px-5 py-3.5 text-sm text-gray-600">{formatDate(r.date)}</td>
                  <td className="px-5 py-3.5">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      r.type === 'INCOME'
                        ? 'bg-emerald-50 text-emerald-700'
                        : 'bg-red-50 text-red-700'
                    }`}>
                      {r.category.name}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 text-sm text-gray-600">{r.description || '—'}</td>
                  <td className="px-5 py-3.5 text-sm text-gray-500">
                    <div>{r.businessUnit?.name || '—'}</div>
                    {r.legalEntity && (
                      <div className="text-xs text-gray-400">{r.legalEntity.name}</div>
                    )}
                  </td>
                  <td className="px-5 py-3.5 text-sm text-gray-500">
                    {r.salesManager ? (
                      <span className="text-xs bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-full">
                        {r.salesManager.name}
                      </span>
                    ) : '—'}
                  </td>
                  <td className="px-5 py-3.5">
                    {r.isPaid ? (
                      <span className="text-xs text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">Оплачено</span>
                    ) : (
                      <span className="text-xs text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">Ожидает</span>
                    )}
                  </td>
                  <td className={`px-5 py-3.5 text-sm font-semibold text-right ${
                    r.type === 'INCOME' ? 'text-emerald-600' : 'text-red-500'
                  }`}>
                    {r.type === 'INCOME' ? '+' : '−'}{formatMoney(r.amount)}
                  </td>
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => openEdit(r)}
                        className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition"
                      >
                        <Edit className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDeleteRecord(r.id)}
                        className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center">
          <DollarSign className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500">Нет записей за этот период</p>
          <button
            onClick={() => { resetForm(); setEditingRecord(null); setShowAddRecord(true) }}
            className="mt-3 text-indigo-600 text-sm font-medium hover:underline"
          >
            Добавить первую запись
          </button>
        </div>
      )}

      {/* Модалка: Добавить/редактировать запись */}
      {showAddRecord && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => setShowAddRecord(false)}>
          <div className="bg-white rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto p-6 shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-semibold text-gray-900">
                {editingRecord ? 'Редактировать запись' : 'Новая запись'}
              </h2>
              <button onClick={() => setShowAddRecord(false)} className="p-1 hover:bg-gray-100 rounded-lg">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            <form onSubmit={handleSubmitRecord} className="space-y-4">
              {/* Тип */}
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setForm(f => ({ ...f, type: 'EXPENSE' }))}
                  className={`flex-1 py-2.5 rounded-xl text-sm font-medium transition ${
                    form.type === 'EXPENSE'
                      ? 'bg-red-100 text-red-700 ring-2 ring-red-200'
                      : 'bg-gray-50 text-gray-500'
                  }`}
                >
                  Расход
                </button>
                <button
                  type="button"
                  onClick={() => setForm(f => ({ ...f, type: 'INCOME' }))}
                  className={`flex-1 py-2.5 rounded-xl text-sm font-medium transition ${
                    form.type === 'INCOME'
                      ? 'bg-emerald-100 text-emerald-700 ring-2 ring-emerald-200'
                      : 'bg-gray-50 text-gray-500'
                  }`}
                >
                  Доход
                </button>
              </div>

              {/* Сумма */}
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Сумма</label>
                <input
                  type="number"
                  step="0.01"
                  value={form.amount}
                  onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-lg font-semibold focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  placeholder="0"
                  required
                />
              </div>

              {/* Категория */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-medium text-gray-500">Категория</label>
                  <button
                    type="button"
                    onClick={() => setShowAddCategory(true)}
                    className="text-xs text-indigo-600 hover:underline"
                  >
                    + Новая
                  </button>
                </div>
                <select
                  value={form.categoryId}
                  onChange={e => setForm(f => ({ ...f, categoryId: e.target.value }))}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500"
                  required
                >
                  <option value="">Выберите...</option>
                  {categories
                    .filter(c => c.type === form.type)
                    .map(c => (
                      <option key={c.id} value={c.id}>
                        {c.group ? `${GROUP_LABELS[c.group] || c.group} — ` : ''}{c.name}
                      </option>
                    ))}
                </select>
              </div>

              {/* Направление */}
              {businessUnits.length > 0 && (
                <div>
                  <label className="flex items-center text-xs font-medium text-gray-500 mb-1">
                    Направление
                    <FieldHint text="Бизнес-направление: Агентство, Банкротство и т.д. Позволяет разделять P&L по направлениям и видеть прибыль каждого." />
                  </label>
                  <select
                    value={form.businessUnitId}
                    onChange={e => setForm(f => ({ ...f, businessUnitId: e.target.value }))}
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="">Общие</option>
                    {businessUnits.map(bu => (
                      <option key={bu.id} value={bu.id}>{bu.name}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Юр.лицо (каскадно от направления) */}
              {legalEntities.filter(le => !form.businessUnitId || le.businessUnitId === form.businessUnitId).length > 0 && (
                <div>
                  <label className="flex items-center text-xs font-medium text-gray-500 mb-1">
                    Юр.лицо
                    <FieldHint text="Юридическое лицо, к которому относится операция. Список зависит от выбранного направления." />
                  </label>
                  <select
                    value={form.legalEntityId}
                    onChange={e => setForm(f => ({ ...f, legalEntityId: e.target.value }))}
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="">Не указано</option>
                    {legalEntities
                      .filter(le => !form.businessUnitId || le.businessUnitId === form.businessUnitId)
                      .map(le => (
                        <option key={le.id} value={le.id}>{le.name}</option>
                      ))}
                  </select>
                </div>
              )}

              {/* Описание */}
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Описание</label>
                <input
                  type="text"
                  value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500"
                  placeholder="Комментарий..."
                />
              </div>

              {/* Клиент (только для доходов) */}
              {form.type === 'INCOME' && (
                <div>
                  <label className="flex items-center text-xs font-medium text-gray-500 mb-1">
                    Клиент
                    <FieldHint text="Компания или ФИО клиента, от которого получен доход. Используется для отчёта по комиссиям менеджеров." />
                  </label>
                  <input
                    type="text"
                    value={form.client}
                    onChange={e => setForm(f => ({ ...f, client: e.target.value }))}
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    placeholder="ООО Ромашка..."
                  />
                </div>
              )}

              {/* Менеджер (только для доходов) */}
              {form.type === 'INCOME' && employees.length > 0 && (
                <div>
                  <label className="flex items-center text-xs font-medium text-gray-500 mb-1">
                    Менеджер
                    <FieldHint text="Менеджер по продажам, который привёл этот доход. На основе этого поля рассчитывается комиссия с продаж." />
                  </label>
                  <select
                    value={form.salesManagerId}
                    onChange={e => setForm(f => ({ ...f, salesManagerId: e.target.value }))}
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  >
                    <option value="">Не указан</option>
                    {employees.map(emp => (
                      <option key={emp.id} value={emp.id}>
                        {emp.name} ({emp.salesCommissionPercent}%)
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Даты */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Дата операции</label>
                  <input
                    type="date"
                    value={form.date}
                    onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500"
                    required
                  />
                </div>
                <div>
                  <label className="flex items-center text-xs font-medium text-gray-500 mb-1">
                    Дата оплаты
                    <FieldHint text="Планируемая дата оплаты. Отображается в платёжном календаре. Если не указана — запись видна только в общем списке." />
                  </label>
                  <input
                    type="date"
                    value={form.dueDate}
                    onChange={e => setForm(f => ({ ...f, dueDate: e.target.value }))}
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              {/* Контрагент и долг */}
              <div>
                <label className="flex items-center text-xs font-medium text-gray-500 mb-1">
                  Контрагент
                  <FieldHint text="Компания или ФИО контрагента. Например: «ООО Ромашка» — если они должны вам деньги (дебиторка), или «ИП Иванов» — если вы должны ему (кредиторка). После ввода появится выбор типа долга." />
                </label>
                <input
                  type="text"
                  value={form.counterparty}
                  onChange={e => setForm(f => ({ ...f, counterparty: e.target.value }))}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500"
                  placeholder="Название компании / ФИО..."
                />
              </div>

              {form.counterparty && (
                <div>
                  <label className="flex items-center text-xs font-medium text-gray-500 mb-1">
                    Тип задолженности
                    <FieldHint text="«Нам должны» — дебиторка (клиент/партнёр задолжал вам). «Мы должны» — кредиторка (вы задолжали поставщику/партнёру)." />
                  </label>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setForm(f => ({ ...f, debtType: 'RECEIVABLE' }))}
                      className={`flex-1 py-2 rounded-lg text-sm font-medium transition ${
                        form.debtType === 'RECEIVABLE'
                          ? 'bg-blue-100 text-blue-700 ring-2 ring-blue-200'
                          : 'bg-gray-50 text-gray-500'
                      }`}
                    >
                      Нам должны
                    </button>
                    <button
                      type="button"
                      onClick={() => setForm(f => ({ ...f, debtType: 'PAYABLE' }))}
                      className={`flex-1 py-2 rounded-lg text-sm font-medium transition ${
                        form.debtType === 'PAYABLE'
                          ? 'bg-orange-100 text-orange-700 ring-2 ring-orange-200'
                          : 'bg-gray-50 text-gray-500'
                      }`}
                    >
                      Мы должны
                    </button>
                  </div>
                </div>
              )}

              {/* Оплачено */}
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.isPaid}
                  onChange={e => setForm(f => ({ ...f, isPaid: e.target.checked }))}
                  className="w-4 h-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                />
                <span className="text-sm text-gray-700">Уже оплачено</span>
                <FieldHint text="Снимите галочку, если платёж запланирован, но ещё не оплачен. Неоплаченные записи попадают в раздел «Ожидает оплаты» и отображаются в платёжном календаре красным." />
              </label>

              <button
                type="submit"
                className="w-full py-3 bg-indigo-600 text-white rounded-xl font-medium hover:bg-indigo-700 transition"
              >
                {editingRecord ? 'Сохранить' : 'Добавить'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Модалка: Управление категориями */}
      {showManageCategories && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-[60] p-4" onClick={() => setShowManageCategories(false)}>
          <div className="bg-white rounded-2xl w-full max-w-2xl p-6 shadow-2xl max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">Управление категориями</h2>
              <button
                onClick={() => {
                  setShowManageCategories(false)
                  setShowAddCategory(true)
                }}
                className="px-3 py-1.5 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700 transition flex items-center gap-1.5"
              >
                <Plus className="w-4 h-4" />
                Новая
              </button>
            </div>

            {/* Список категорий по типам */}
            <div className="space-y-4">
              {/* Доходы */}
              <div>
                <h3 className="text-sm font-medium text-emerald-700 mb-2 flex items-center gap-2">
                  <TrendingUp className="w-4 h-4" />
                  Доходы
                </h3>
                <div className="space-y-1">
                  {categories.filter(c => c.type === 'INCOME').length === 0 ? (
                    <p className="text-xs text-gray-400 italic px-3 py-2">Нет категорий</p>
                  ) : (
                    categories.filter(c => c.type === 'INCOME').map(cat => (
                      <div key={cat.id} className="flex items-center justify-between px-3 py-2 bg-emerald-50 rounded-lg group hover:bg-emerald-100 transition">
                        <span className="text-sm text-gray-900">{cat.name}</span>
                        <button
                          onClick={() => handleDeleteCategory(cat.id, cat.name)}
                          className="opacity-0 group-hover:opacity-100 transition p-1 hover:bg-red-100 rounded"
                          title="Удалить"
                        >
                          <Trash2 className="w-4 h-4 text-red-600" />
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Расходы */}
              <div>
                <h3 className="text-sm font-medium text-red-700 mb-2 flex items-center gap-2">
                  <TrendingDown className="w-4 h-4" />
                  Расходы
                </h3>
                <div className="space-y-1">
                  {categories.filter(c => c.type === 'EXPENSE').length === 0 ? (
                    <p className="text-xs text-gray-400 italic px-3 py-2">Нет категорий</p>
                  ) : (
                    categories.filter(c => c.type === 'EXPENSE').map(cat => (
                      <div key={cat.id} className="flex items-center justify-between px-3 py-2 bg-red-50 rounded-lg group hover:bg-red-100 transition">
                        <span className="text-sm text-gray-900">{cat.name}</span>
                        <button
                          onClick={() => handleDeleteCategory(cat.id, cat.name)}
                          className="opacity-0 group-hover:opacity-100 transition p-1 hover:bg-red-100 rounded"
                          title="Удалить"
                        >
                          <Trash2 className="w-4 h-4 text-red-600" />
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>

            <div className="mt-4 pt-4 border-t">
              <button
                onClick={() => setShowManageCategories(false)}
                className="w-full py-2 text-sm text-gray-600 hover:text-gray-900 transition"
              >
                Закрыть
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Модалка: Управление направлениями */}
      {showManageBU && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-[60] p-4" onClick={() => setShowManageBU(false)}>
          <div className="bg-white rounded-2xl w-full max-w-2xl p-6 shadow-2xl max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">Управление направлениями</h2>
              <button
                onClick={() => {
                  setShowManageBU(false)
                  setShowAddBU(true)
                }}
                className="px-3 py-1.5 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700 transition flex items-center gap-1.5"
              >
                <Plus className="w-4 h-4" />
                Новое
              </button>
            </div>

            {/* Список направлений */}
            <div className="space-y-1">
              {businessUnits.length === 0 ? (
                <p className="text-sm text-gray-400 italic text-center py-8">Нет направлений</p>
              ) : (
                businessUnits.map(bu => (
                  <div key={bu.id} className="flex items-center justify-between px-3 py-2 bg-indigo-50 rounded-lg group hover:bg-indigo-100 transition">
                    <div className="flex items-center gap-2">
                      <Building2 className="w-4 h-4 text-indigo-600" />
                      <span className="text-sm text-gray-900">{bu.name}</span>
                    </div>
                    <button
                      onClick={() => handleDeleteBU(bu.id, bu.name)}
                      className="opacity-0 group-hover:opacity-100 transition p-1 hover:bg-red-100 rounded"
                      title="Удалить"
                    >
                      <Trash2 className="w-4 h-4 text-red-600" />
                    </button>
                  </div>
                ))
              )}
            </div>

            <div className="mt-4 pt-4 border-t">
              <button
                onClick={() => setShowManageBU(false)}
                className="w-full py-2 text-sm text-gray-600 hover:text-gray-900 transition"
              >
                Закрыть
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Модалка: Новая категория */}
      {showAddCategory && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-[60] p-4" onClick={() => setShowAddCategory(false)}>
          <div className="bg-white rounded-2xl w-full max-w-sm p-6 shadow-2xl" onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Новая категория</h2>
            <form onSubmit={handleSubmitCategory} className="space-y-3">
              <input
                type="text"
                value={catForm.name}
                onChange={e => setCatForm(f => ({ ...f, name: e.target.value }))}
                className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500"
                placeholder="Название..."
                required
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setCatForm(f => ({ ...f, type: 'EXPENSE' }))}
                  className={`flex-1 py-2 rounded-lg text-sm font-medium ${
                    catForm.type === 'EXPENSE' ? 'bg-red-100 text-red-700' : 'bg-gray-50 text-gray-500'
                  }`}
                >
                  Расход
                </button>
                <button
                  type="button"
                  onClick={() => setCatForm(f => ({ ...f, type: 'INCOME' }))}
                  className={`flex-1 py-2 rounded-lg text-sm font-medium ${
                    catForm.type === 'INCOME' ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-50 text-gray-500'
                  }`}
                >
                  Доход
                </button>
              </div>
              <select
                value={catForm.group}
                onChange={e => setCatForm(f => ({ ...f, group: e.target.value }))}
                className="w-full px-4 py-2.5 border border-gray-200 rounded-xl"
              >
                {Object.entries(GROUP_LABELS).map(([key, label]) => (
                  <option key={key} value={key}>{label}</option>
                ))}
              </select>
              <button type="submit" className="w-full py-2.5 bg-indigo-600 text-white rounded-xl font-medium hover:bg-indigo-700 transition">
                Создать
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Модалка: Новое направление */}
      {showAddBU && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-[60] p-4" onClick={() => setShowAddBU(false)}>
          <div className="bg-white rounded-2xl w-full max-w-sm p-6 shadow-2xl" onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Новое направление</h2>
            <form onSubmit={handleSubmitBU} className="space-y-3">
              <input
                type="text"
                value={buForm.name}
                onChange={e => setBuForm({ name: e.target.value })}
                className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500"
                placeholder="Например: Агентство, Банкротство..."
                required
              />
              <button type="submit" className="w-full py-2.5 bg-indigo-600 text-white rounded-xl font-medium hover:bg-indigo-700 transition">
                Создать
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Модалка: Юр.лица (сейф) */}
      {showLegalEntities && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-[60] p-4"
          onClick={() => setShowLegalEntities(false)}>
          <div className="bg-white rounded-2xl w-full max-w-lg p-6 shadow-2xl max-h-[90vh] overflow-y-auto"
            onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-semibold text-gray-900">Юр.лица и балансы</h2>
              <button
                onClick={() => setShowLegalEntities(false)}
                className="p-1 hover:bg-gray-100 rounded-lg"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            {/* Суммарный баланс */}
            <div className="bg-violet-50 rounded-xl p-4 mb-5">
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium text-gray-700">Общий текущий остаток</span>
                <span className={`text-xl font-bold ${(summary?.totalBalance ?? 0) >= 0 ? 'text-violet-700' : 'text-red-600'}`}>
                  {formatMoney(summary?.totalBalance ?? 0)}
                </span>
              </div>
            </div>

            {/* Список юрлиц */}
            <div className="space-y-3 mb-5">
              {legalEntities.length === 0 ? (
                <p className="text-sm text-gray-400 italic text-center py-4">Нет юр.лиц. Добавьте первое.</p>
              ) : (
                legalEntities.map(le => {
                  const ab = summary?.accountBalances?.find(s => s.legalEntityId === le.id)
                  return (
                    <div key={le.id} className="border border-gray-100 rounded-xl p-4 hover:border-violet-200 transition group">
                      <div className="flex items-center justify-between mb-2">
                        <div>
                          <span className="text-sm font-medium text-gray-900">{le.name}</span>
                          <span className="text-xs text-gray-400 ml-2">{le.businessUnit?.name}</span>
                        </div>
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition">
                          <button
                            onClick={() => {
                              setEditingLE(le)
                              setLeForm({
                                name: le.name,
                                businessUnitId: le.businessUnitId,
                                initialBalance: String(le.initialBalance),
                                effectiveDate: le.effectiveDate.split('T')[0]
                              })
                            }}
                            className="p-1.5 hover:bg-indigo-50 rounded-lg"
                          >
                            <Edit className="w-3.5 h-3.5 text-indigo-600" />
                          </button>
                          <button
                            onClick={() => handleDeleteLE(le.id, le.name)}
                            className="p-1.5 hover:bg-red-50 rounded-lg"
                          >
                            <Trash2 className="w-3.5 h-3.5 text-red-600" />
                          </button>
                        </div>
                      </div>
                      <div className="grid grid-cols-4 gap-2 text-xs">
                        <div>
                          <span className="text-gray-400">Нач. остаток</span>
                          <p className="font-medium text-gray-700">{formatMoney(ab?.initialBalance ?? le.initialBalance)}</p>
                        </div>
                        <div>
                          <span className="text-gray-400">Доходы</span>
                          <p className="font-medium text-emerald-600">{formatMoney(ab?.totalIncome ?? 0)}</p>
                        </div>
                        <div>
                          <span className="text-gray-400">Расходы</span>
                          <p className="font-medium text-red-500">{formatMoney(ab?.totalExpenses ?? 0)}</p>
                        </div>
                        <div>
                          <span className="text-gray-400">Остаток</span>
                          <p className={`font-medium ${(ab?.balance ?? 0) >= 0 ? 'text-violet-700' : 'text-red-600'}`}>
                            {formatMoney(ab?.balance ?? le.initialBalance)}
                          </p>
                        </div>
                      </div>
                    </div>
                  )
                })
              )}
            </div>

            {/* Форма добавления/редактирования */}
            <div className="border-t pt-4">
              <h3 className="text-sm font-medium text-gray-700 mb-3">
                {editingLE ? 'Редактировать юр.лицо' : 'Добавить юр.лицо'}
              </h3>
              <form onSubmit={handleSubmitLE} className="space-y-3">
                <input
                  type="text"
                  value={leForm.name}
                  onChange={e => setLeForm(f => ({ ...f, name: e.target.value }))}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-violet-500"
                  placeholder="Название (ИП Гвоздков, ООО Первый Селлер...)"
                  required
                />
                <select
                  value={leForm.businessUnitId}
                  onChange={e => setLeForm(f => ({ ...f, businessUnitId: e.target.value }))}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-violet-500"
                  required
                >
                  <option value="">Направление...</option>
                  {businessUnits.map(bu => (
                    <option key={bu.id} value={bu.id}>{bu.name}</option>
                  ))}
                </select>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Начальный баланс</label>
                    <input
                      type="number"
                      step="0.01"
                      value={leForm.initialBalance}
                      onChange={e => setLeForm(f => ({ ...f, initialBalance: e.target.value }))}
                      className="w-full px-3 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-violet-500"
                      placeholder="0"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Дата начала</label>
                    <input
                      type="date"
                      value={leForm.effectiveDate}
                      onChange={e => setLeForm(f => ({ ...f, effectiveDate: e.target.value }))}
                      className="w-full px-3 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-violet-500"
                    />
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    type="submit"
                    className="flex-1 py-2.5 bg-violet-600 text-white rounded-xl font-medium hover:bg-violet-700 transition"
                  >
                    {editingLE ? 'Сохранить' : 'Добавить'}
                  </button>
                  {editingLE && (
                    <button
                      type="button"
                      onClick={() => {
                        setEditingLE(null)
                        setLeForm({ name: '', businessUnitId: '', initialBalance: '', effectiveDate: new Date().getFullYear() + '-01-01' })
                      }}
                      className="px-4 py-2.5 border border-gray-200 rounded-xl text-gray-600 hover:bg-gray-50 transition"
                    >
                      Отмена
                    </button>
                  )}
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
