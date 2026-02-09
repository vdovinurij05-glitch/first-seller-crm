'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import {
  ArrowLeft,
  Plus,
  X,
  Users,
  Banknote,
  BadgeDollarSign,
  Wallet,
  Edit,
  Trash2,
  Check,
  Clock,
  ChevronLeft,
  ChevronRight,
  Zap,
  HelpCircle,
  Building2,
  Filter
} from 'lucide-react'

interface BusinessUnit {
  id: string
  name: string
}

interface Employee {
  id: string
  name: string
  position: string | null
  officialSalary: number
  unofficialSalary: number
  businessUnitId: string | null
  businessUnit: BusinessUnit | null
  isActive: boolean
}

interface SalaryPayment {
  id: string
  employeeId: string
  employee: Employee
  amount: number
  salaryType: string
  date: string
  isPaid: boolean
  comment: string | null
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

export default function SalaryPage() {
  const [employees, setEmployees] = useState<Employee[]>([])
  const [businessUnits, setBusinessUnits] = useState<BusinessUnit[]>([])
  const [payments, setPayments] = useState<SalaryPayment[]>([])
  const [loading, setLoading] = useState(true)
  const [showAddEmployee, setShowAddEmployee] = useState(false)
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null)
  const [editingPayment, setEditingPayment] = useState<SalaryPayment | null>(null)
  const [filterBU, setFilterBU] = useState<string>('all')

  const [currentDate, setCurrentDate] = useState(new Date())
  const currentMonth = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}`

  const [form, setForm] = useState({
    name: '',
    position: '',
    officialSalary: '',
    unofficialSalary: '',
    businessUnitId: '',
  })

  const [paymentForm, setPaymentForm] = useState({
    amount: '',
    isPaid: false,
    comment: '',
  })

  useEffect(() => {
    fetchEmployees()
    fetchBusinessUnits()
  }, [])

  useEffect(() => {
    fetchPayments()
  }, [currentMonth])

  const fetchEmployees = async () => {
    try {
      const res = await fetch('/api/pnl/employees')
      const data = await res.json()
      setEmployees(data || [])
    } catch (error) {
      console.error('Error fetching employees:', error)
      setEmployees([])
    } finally {
      setLoading(false)
    }
  }

  const fetchBusinessUnits = async () => {
    try {
      const res = await fetch('/api/pnl/business-units')
      const data = await res.json()
      setBusinessUnits(data.units || [])
    } catch (error) {
      console.error('Error fetching BU:', error)
      setBusinessUnits([])
    }
  }

  const fetchPayments = async () => {
    try {
      const res = await fetch(`/api/pnl/salary-payments?month=${currentMonth}`)
      const data = await res.json()
      setPayments(data || [])
    } catch (error) {
      console.error('Error fetching payments:', error)
      setPayments([])
    }
  }

  const handleSubmitEmployee = async (e: React.FormEvent) => {
    e.preventDefault()
    const url = editingEmployee ? `/api/pnl/employees/${editingEmployee.id}` : '/api/pnl/employees'
    const res = await fetch(url, {
      method: editingEmployee ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    if (res.ok) {
      setShowAddEmployee(false)
      setEditingEmployee(null)
      setForm({ name: '', position: '', officialSalary: '', unofficialSalary: '', businessUnitId: '' })
      fetchEmployees()
    }
  }

  const handleDeleteEmployee = async (id: string) => {
    if (!confirm('Удалить сотрудника? Все его выплаты тоже будут удалены.')) return
    await fetch(`/api/pnl/employees/${id}`, { method: 'DELETE' })
    fetchEmployees()
    fetchPayments()
  }

  const handleGeneratePayments = async () => {
    const monthName = currentDate.toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' })
    if (!confirm(`Сгенерировать выплаты на ${monthName}?\n\nБелая и чёрная ЗП: 10-го (аванс 50%) и 25-го (остаток 50%)`)) return
    const res = await fetch('/api/pnl/salary-payments', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ month: currentMonth }),
    })
    if (res.ok) {
      const data = await res.json()
      alert(`Создано ${data.generated} выплат`)
      fetchPayments()
    } else {
      const err = await res.json()
      alert(err.error || 'Ошибка')
    }
  }

  const handleUpdatePayment = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingPayment) return
    await fetch(`/api/pnl/salary-payments/${editingPayment.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        amount: paymentForm.amount,
        isPaid: paymentForm.isPaid,
        comment: paymentForm.comment,
      }),
    })
    setEditingPayment(null)
    fetchPayments()
  }

  const handleTogglePaid = async (payment: SalaryPayment) => {
    await fetch(`/api/pnl/salary-payments/${payment.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isPaid: !payment.isPaid }),
    })
    fetchPayments()
  }

  const handleDeletePayment = async (id: string) => {
    await fetch(`/api/pnl/salary-payments/${id}`, { method: 'DELETE' })
    fetchPayments()
  }

  const openEditEmployee = (emp: Employee) => {
    setEditingEmployee(emp)
    setForm({
      name: emp.name,
      position: emp.position || '',
      officialSalary: String(emp.officialSalary),
      unofficialSalary: String(emp.unofficialSalary),
      businessUnitId: emp.businessUnitId || '',
    })
    setShowAddEmployee(true)
  }

  const openEditPayment = (p: SalaryPayment) => {
    setEditingPayment(p)
    setPaymentForm({ amount: String(p.amount), isPaid: p.isPaid, comment: p.comment || '' })
  }

  const prevMonth = () => setCurrentDate(d => { const n = new Date(d); n.setMonth(n.getMonth() - 1); return n })
  const nextMonth = () => setCurrentDate(d => { const n = new Date(d); n.setMonth(n.getMonth() + 1); return n })

  // Ранний выход при загрузке
  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      </div>
    )
  }

  // Фильтр по направлению
  const filteredEmployees = filterBU === 'all'
    ? employees
    : filterBU === 'none'
      ? employees.filter(e => !e.businessUnitId)
      : employees.filter(e => e.businessUnitId === filterBU)

  const filteredPayments = filterBU === 'all'
    ? payments
    : filterBU === 'none'
      ? payments.filter(p => {
          const emp = employees.find(e => e.id === p.employeeId)
          return emp && !emp.businessUnitId
        })
      : payments.filter(p => {
          const emp = employees.find(e => e.id === p.employeeId)
          return emp && emp.businessUnitId === filterBU
        })

  // Группировка сотрудников по направлениям
  const employeesByBU: Record<string, Employee[]> = {}
  filteredEmployees.forEach(emp => {
    const key = emp.businessUnit?.name || 'Без направления'
    if (!employeesByBU[key]) employeesByBU[key] = []
    employeesByBU[key].push(emp)
  })

  // Сводка
  const totalOfficial = filteredEmployees.reduce((s, e) => s + e.officialSalary, 0)
  const totalUnofficial = filteredEmployees.reduce((s, e) => s + e.unofficialSalary, 0)
  const totalFOT = totalOfficial + totalUnofficial

  // Сводка выплат
  const paidPayments = filteredPayments.filter(p => p.isPaid)
  const unpaidPayments = filteredPayments.filter(p => !p.isPaid)
  const totalPaid = paidPayments.reduce((s, p) => s + p.amount, 0)
  const totalUnpaid = unpaidPayments.reduce((s, p) => s + p.amount, 0)

  // Группировка выплат по дате
  const paymentsByDate: Record<string, SalaryPayment[]> = {}
  filteredPayments.forEach(p => {
    const d = new Date(p.date).toLocaleDateString('ru-RU')
    if (!paymentsByDate[d]) paymentsByDate[d] = []
    paymentsByDate[d].push(p)
  })

  // Сводка по направлениям
  const buSummary = (businessUnits || []).map(bu => {
    const buEmps = (employees || []).filter(e => e.businessUnitId === bu.id)
    const official = buEmps.reduce((s, e) => s + e.officialSalary, 0)
    const unofficial = buEmps.reduce((s, e) => s + e.unofficialSalary, 0)
    return { ...bu, employeeCount: buEmps.length, official, unofficial, total: official + unofficial }
  }).filter(bu => bu.employeeCount > 0)

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Шапка */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/dashboard/pnl" className="p-2 hover:bg-gray-100 rounded-xl transition">
            <ArrowLeft className="w-5 h-5 text-gray-500" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Зарплатный проект</h1>
            <p className="text-sm text-gray-500 mt-0.5">Сотрудники и выплаты по направлениям</p>
          </div>
        </div>
        <button
          onClick={() => {
            setEditingEmployee(null)
            setForm({ name: '', position: '', officialSalary: '', unofficialSalary: '', businessUnitId: '' })
            setShowAddEmployee(true)
          }}
          className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-medium hover:bg-indigo-700 transition"
        >
          <Plus className="w-4 h-4" />
          Сотрудник
        </button>
      </div>

      {/* Фильтр по направлению */}
      {businessUnits.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          <Filter className="w-4 h-4 text-gray-400" />
          <button
            onClick={() => setFilterBU('all')}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${
              filterBU === 'all' ? 'bg-indigo-100 text-indigo-700' : 'bg-gray-50 text-gray-500 hover:bg-gray-100'
            }`}
          >
            Все
          </button>
          {businessUnits.map(bu => (
            <button
              key={bu.id}
              onClick={() => setFilterBU(bu.id)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${
                filterBU === bu.id ? 'bg-indigo-100 text-indigo-700' : 'bg-gray-50 text-gray-500 hover:bg-gray-100'
              }`}
            >
              {bu.name}
            </button>
          ))}
        </div>
      )}

      {/* Виджеты по направлениям */}
      {buSummary.length > 1 && filterBU === 'all' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {buSummary.map(bu => (
            <div
              key={bu.id}
              onClick={() => setFilterBU(bu.id)}
              className="bg-white rounded-2xl border border-gray-100 p-5 hover:shadow-md transition cursor-pointer"
            >
              <div className="flex items-center gap-2 mb-3">
                <Building2 className="w-4 h-4 text-indigo-600" />
                <h3 className="font-semibold text-gray-900">{bu.name}</h3>
                <span className="text-xs text-gray-400 ml-auto">{bu.employeeCount} чел.</span>
              </div>
              <div className="grid grid-cols-3 gap-4 text-center">
                <div>
                  <p className="text-xs text-gray-400">Белая</p>
                  <p className="text-sm font-bold text-emerald-600">{formatMoney(bu.official)}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-400">Чёрная</p>
                  <p className="text-sm font-bold text-gray-600">{formatMoney(bu.unofficial)}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-400">Итого</p>
                  <p className="text-sm font-bold text-gray-900">{formatMoney(bu.total)}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Общая сводка */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl border border-gray-100 p-5 hover:shadow-md transition">
          <div className="flex items-center gap-2 mb-2">
            <div className="p-1.5 bg-emerald-50 rounded-lg"><Banknote className="w-4 h-4 text-emerald-600" /></div>
            <span className="text-xs font-medium text-gray-500">Белая ЗП</span>
          </div>
          <p className="text-xl font-bold text-gray-900">{formatMoney(totalOfficial)}</p>
          <p className="text-xs text-gray-400 mt-1">на {filteredEmployees.length} чел.</p>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 p-5 hover:shadow-md transition">
          <div className="flex items-center gap-2 mb-2">
            <div className="p-1.5 bg-gray-100 rounded-lg"><BadgeDollarSign className="w-4 h-4 text-gray-600" /></div>
            <span className="text-xs font-medium text-gray-500">Чёрная ЗП</span>
          </div>
          <p className="text-xl font-bold text-gray-900">{formatMoney(totalUnofficial)}</p>
        </div>

        <div className="bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl p-5 text-white hover:shadow-md transition">
          <div className="flex items-center gap-2 mb-2">
            <div className="p-1.5 bg-white/20 rounded-lg"><Wallet className="w-4 h-4 text-white" /></div>
            <span className="text-xs font-medium text-white/80">Итого ФОТ</span>
          </div>
          <p className="text-xl font-bold">{formatMoney(totalFOT)}</p>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 p-5 hover:shadow-md transition">
          <div className="flex items-center gap-2 mb-2">
            <div className="p-1.5 bg-blue-50 rounded-lg"><Users className="w-4 h-4 text-blue-600" /></div>
            <span className="text-xs font-medium text-gray-500">Сотрудников</span>
          </div>
          <p className="text-xl font-bold text-gray-900">{filteredEmployees.length}</p>
        </div>
      </div>

      {/* Таблица сотрудников по направлениям */}
      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-900">Штатное расписание</h2>
        </div>
        {filteredEmployees.length > 0 ? (
          <table className="w-full">
            <thead>
              <tr className="text-xs text-gray-500 border-b border-gray-50">
                <th className="text-left px-6 py-3 font-medium">Сотрудник</th>
                <th className="text-left px-4 py-3 font-medium">Направление</th>
                <th className="text-right px-4 py-3 font-medium">Белая ЗП</th>
                <th className="text-right px-4 py-3 font-medium">Чёрная ЗП</th>
                <th className="text-right px-4 py-3 font-medium">Итого</th>
                <th className="text-right px-6 py-3 font-medium w-24"></th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(employeesByBU).map(([buName, buEmployees]) => (
                <Fragment key={buName}>
                  {Object.keys(employeesByBU).length > 1 && (
                    <tr className="bg-indigo-50/50">
                      <td colSpan={6} className="px-6 py-2">
                        <span className="text-xs font-semibold text-indigo-600 flex items-center gap-1.5">
                          <Building2 className="w-3.5 h-3.5" />
                          {buName}
                          <span className="text-indigo-400 font-normal ml-1">({buEmployees.length} чел.)</span>
                        </span>
                      </td>
                    </tr>
                  )}
                  {buEmployees.map(emp => (
                    <tr key={emp.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50/50 transition">
                      <td className="px-6 py-3.5">
                        <p className="font-medium text-gray-900 text-sm">{emp.name}</p>
                        {emp.position && <p className="text-xs text-gray-400">{emp.position}</p>}
                      </td>
                      <td className="px-4 py-3.5">
                        {emp.businessUnit ? (
                          <span className="text-xs px-2 py-0.5 bg-indigo-50 text-indigo-600 rounded-full">{emp.businessUnit.name}</span>
                        ) : (
                          <span className="text-xs text-gray-400">—</span>
                        )}
                      </td>
                      <td className="text-right px-4 py-3.5 text-sm text-emerald-600 font-medium">{formatMoney(emp.officialSalary)}</td>
                      <td className="text-right px-4 py-3.5 text-sm text-gray-600 font-medium">{formatMoney(emp.unofficialSalary)}</td>
                      <td className="text-right px-4 py-3.5 text-sm font-bold text-gray-900">{formatMoney(emp.officialSalary + emp.unofficialSalary)}</td>
                      <td className="text-right px-6 py-3.5">
                        <div className="flex items-center justify-end gap-1">
                          <button onClick={() => openEditEmployee(emp)} className="p-1.5 hover:bg-gray-100 rounded-lg transition">
                            <Edit className="w-3.5 h-3.5 text-gray-400" />
                          </button>
                          <button onClick={() => handleDeleteEmployee(emp.id)} className="p-1.5 hover:bg-red-50 rounded-lg transition">
                            <Trash2 className="w-3.5 h-3.5 text-gray-400 hover:text-red-500" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </Fragment>
              ))}
              <tr className="bg-gray-50 font-bold">
                <td className="px-6 py-3.5 text-sm text-gray-700">Итого</td>
                <td></td>
                <td className="text-right px-4 py-3.5 text-sm text-emerald-700">{formatMoney(totalOfficial)}</td>
                <td className="text-right px-4 py-3.5 text-sm text-gray-700">{formatMoney(totalUnofficial)}</td>
                <td className="text-right px-4 py-3.5 text-sm text-gray-900">{formatMoney(totalFOT)}</td>
                <td></td>
              </tr>
            </tbody>
          </table>
        ) : (
          <div className="p-12 text-center">
            <Users className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500">Нет сотрудников</p>
            <button onClick={() => setShowAddEmployee(true)} className="mt-3 text-indigo-600 text-sm font-medium hover:underline">
              Добавить первого сотрудника
            </button>
          </div>
        )}
      </div>

      {/* Выплаты за месяц */}
      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h2 className="font-semibold text-gray-900">Выплаты</h2>
            <div className="flex items-center gap-2">
              <button onClick={prevMonth} className="p-1 hover:bg-gray-100 rounded-lg"><ChevronLeft className="w-4 h-4" /></button>
              <span className="text-sm font-medium text-gray-700 min-w-[120px] text-center">
                {currentDate.toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' })}
              </span>
              <button onClick={nextMonth} className="p-1 hover:bg-gray-100 rounded-lg"><ChevronRight className="w-4 h-4" /></button>
            </div>
          </div>
          <button
            onClick={handleGeneratePayments}
            className="flex items-center gap-2 px-3 py-2 bg-amber-50 text-amber-700 rounded-xl text-sm font-medium hover:bg-amber-100 transition"
          >
            <Zap className="w-4 h-4" />
            Сгенерировать
          </button>
        </div>

        {filteredPayments.length > 0 && (
          <div className="grid grid-cols-3 gap-4 p-6 border-b border-gray-100">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-emerald-50 rounded-lg"><Check className="w-4 h-4 text-emerald-600" /></div>
              <div>
                <p className="text-xs text-gray-500">Оплачено</p>
                <p className="text-sm font-bold text-emerald-600">{formatMoney(totalPaid)}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="p-2 bg-red-50 rounded-lg"><Clock className="w-4 h-4 text-red-500" /></div>
              <div>
                <p className="text-xs text-gray-500">Ожидает</p>
                <p className="text-sm font-bold text-red-500">{formatMoney(totalUnpaid)}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="p-2 bg-indigo-50 rounded-lg"><Wallet className="w-4 h-4 text-indigo-600" /></div>
              <div>
                <p className="text-xs text-gray-500">Всего</p>
                <p className="text-sm font-bold text-gray-900">{formatMoney(totalPaid + totalUnpaid)}</p>
              </div>
            </div>
          </div>
        )}

        {filteredPayments.length > 0 ? (
          <div className="divide-y divide-gray-50">
            {Object.entries(paymentsByDate)
              .sort(([a], [b]) => {
                const [da] = a.split('.')
                const [db] = b.split('.')
                return parseInt(da) - parseInt(db)
              })
              .map(([date, datePayments]) => (
                <div key={date}>
                  <div className="px-6 py-2 bg-gray-50/50">
                    <span className="text-xs font-medium text-gray-500">{date}</span>
                    <span className="text-xs text-gray-400 ml-2">
                      ({formatMoney(datePayments.reduce((s, p) => s + p.amount, 0))})
                    </span>
                  </div>
                  {datePayments.map(p => (
                    <div key={p.id} className="px-6 py-3 flex items-center justify-between hover:bg-gray-50/50 transition">
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => handleTogglePaid(p)}
                          className={`p-1 rounded-md transition ${
                            p.isPaid
                              ? 'bg-emerald-100 text-emerald-600'
                              : 'bg-gray-100 text-gray-400 hover:bg-red-50 hover:text-red-400'
                          }`}
                        >
                          {p.isPaid ? <Check className="w-3.5 h-3.5" /> : <Clock className="w-3.5 h-3.5" />}
                        </button>
                        <div>
                          <p className="text-sm font-medium text-gray-900">
                            {p.employee.name}
                            {p.employee.businessUnit && (
                              <span className="ml-2 text-xs px-1.5 py-0.5 bg-indigo-50 text-indigo-500 rounded-full">{p.employee.businessUnit.name}</span>
                            )}
                          </p>
                          <p className="text-xs text-gray-400">
                            {p.salaryType === 'OFFICIAL' ? 'Белая' : 'Чёрная'}
                            {p.comment ? ` · ${p.comment}` : ''}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className={`text-sm font-bold ${p.isPaid ? 'text-emerald-600' : 'text-red-500'}`}>
                          {formatMoney(p.amount)}
                        </span>
                        <button onClick={() => openEditPayment(p)} className="p-1.5 hover:bg-gray-100 rounded-lg transition">
                          <Edit className="w-3.5 h-3.5 text-gray-400" />
                        </button>
                        <button onClick={() => handleDeletePayment(p.id)} className="p-1.5 hover:bg-red-50 rounded-lg transition">
                          <Trash2 className="w-3.5 h-3.5 text-gray-400 hover:text-red-500" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ))}
          </div>
        ) : (
          <div className="p-12 text-center">
            <Banknote className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500">Нет выплат за этот месяц</p>
            {employees.length > 0 && (
              <button onClick={handleGeneratePayments} className="mt-3 text-amber-600 text-sm font-medium hover:underline">
                Сгенерировать выплаты
              </button>
            )}
          </div>
        )}
      </div>

      {/* Модалка: Добавить/редактировать сотрудника */}
      {showAddEmployee && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => setShowAddEmployee(false)}>
          <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-semibold text-gray-900">
                {editingEmployee ? 'Редактировать сотрудника' : 'Новый сотрудник'}
              </h2>
              <button onClick={() => setShowAddEmployee(false)} className="p-1 hover:bg-gray-100 rounded-lg">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            <form onSubmit={handleSubmitEmployee} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">ФИО</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  placeholder="Иванов Иван Иванович"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Должность</label>
                <input
                  type="text"
                  value={form.position}
                  onChange={e => setForm(f => ({ ...f, position: e.target.value }))}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  placeholder="Менеджер по продажам"
                />
              </div>
              <div>
                <label className="flex items-center text-xs font-medium text-gray-500 mb-1">
                  Направление
                  <FieldHint text="К какому бизнес-направлению относится сотрудник. Позволяет видеть ФОТ в разрезе каждой компании холдинга." />
                </label>
                <select
                  value={form.businessUnitId}
                  onChange={e => setForm(f => ({ ...f, businessUnitId: e.target.value }))}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="">Без направления</option>
                  {businessUnits.map(bu => (
                    <option key={bu.id} value={bu.id}>{bu.name}</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="flex items-center text-xs font-medium text-gray-500 mb-1">
                    Белая ЗП
                    <FieldHint text="Официальный оклад. Делится 50/50: аванс 10-го и остаток 25-го числа." />
                  </label>
                  <input
                    type="number"
                    value={form.officialSalary}
                    onChange={e => setForm(f => ({ ...f, officialSalary: e.target.value }))}
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    placeholder="0"
                  />
                </div>
                <div>
                  <label className="flex items-center text-xs font-medium text-gray-500 mb-1">
                    Чёрная ЗП
                    <FieldHint text="Неофициальная часть. Тоже делится 50/50: аванс 10-го и остаток 25-го числа." />
                  </label>
                  <input
                    type="number"
                    value={form.unofficialSalary}
                    onChange={e => setForm(f => ({ ...f, unofficialSalary: e.target.value }))}
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    placeholder="0"
                  />
                </div>
              </div>
              <button type="submit" className="w-full py-3 bg-indigo-600 text-white rounded-xl font-medium hover:bg-indigo-700 transition">
                {editingEmployee ? 'Сохранить' : 'Добавить сотрудника'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Модалка: Редактировать выплату */}
      {editingPayment && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => setEditingPayment(null)}>
          <div className="bg-white rounded-2xl w-full max-w-sm p-6 shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-semibold text-gray-900">Редактировать выплату</h2>
              <button onClick={() => setEditingPayment(null)} className="p-1 hover:bg-gray-100 rounded-lg">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            <p className="text-sm text-gray-500 mb-4">
              {editingPayment.employee.name} · {editingPayment.salaryType === 'OFFICIAL' ? 'Белая' : 'Чёрная'} ЗП
            </p>
            <form onSubmit={handleUpdatePayment} className="space-y-4">
              <div>
                <label className="flex items-center text-xs font-medium text-gray-500 mb-1">
                  Фактическая сумма
                  <FieldHint text="Укажите реальную сумму выплаты после расчёта бухгалтером (KPI, больничные, вычеты)." />
                </label>
                <input
                  type="number"
                  value={paymentForm.amount}
                  onChange={e => setPaymentForm(f => ({ ...f, amount: e.target.value }))}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-lg font-semibold focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Комментарий</label>
                <input
                  type="text"
                  value={paymentForm.comment}
                  onChange={e => setPaymentForm(f => ({ ...f, comment: e.target.value }))}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  placeholder="KPI, бонус, вычет..."
                />
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={paymentForm.isPaid}
                  onChange={e => setPaymentForm(f => ({ ...f, isPaid: e.target.checked }))}
                  className="w-4 h-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                />
                <span className="text-sm text-gray-700">Оплачено</span>
              </label>
              <button type="submit" className="w-full py-3 bg-indigo-600 text-white rounded-xl font-medium hover:bg-indigo-700 transition">
                Сохранить
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

// Fragment для группировки
function Fragment({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
