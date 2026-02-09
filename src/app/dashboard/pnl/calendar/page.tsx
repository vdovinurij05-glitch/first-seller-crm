'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import {
  ChevronLeft,
  ChevronRight,
  ArrowLeft,
  Check,
  Clock,
  AlertCircle
} from 'lucide-react'

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
  category: { id: string; name: string; type: string }
  businessUnit: { id: string; name: string } | null
}

interface DayData {
  paid: FinanceRecord[]
  unpaid: FinanceRecord[]
}

function formatMoney(n: number) {
  return new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0 }).format(n)
}

const WEEKDAYS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс']

export default function PaymentCalendarPage() {
  const [year, setYear] = useState(new Date().getFullYear())
  const [month, setMonth] = useState(new Date().getMonth())
  const [days, setDays] = useState<Record<string, DayData>>({})
  const [loading, setLoading] = useState(true)
  const [selectedDay, setSelectedDay] = useState<string | null>(null)

  useEffect(() => {
    fetchCalendar()
  }, [year, month])

  async function fetchCalendar() {
    setLoading(true)
    const res = await fetch(`/api/pnl/calendar?year=${year}&month=${month}`)
    if (res.ok) {
      const data = await res.json()
      setDays(data.days)
    }
    setLoading(false)
  }

  function prevMonth() {
    if (month === 0) { setYear(y => y - 1); setMonth(11) }
    else setMonth(m => m - 1)
  }

  function nextMonth() {
    if (month === 11) { setYear(y => y + 1); setMonth(0) }
    else setMonth(m => m + 1)
  }

  const monthName = new Date(year, month).toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' })
  const today = new Date().toISOString().split('T')[0]

  // Генерируем сетку календаря
  const firstDay = new Date(year, month, 1)
  const lastDay = new Date(year, month + 1, 0)
  const startOffset = (firstDay.getDay() + 6) % 7 // Пн=0
  const totalDays = lastDay.getDate()

  const calendarDays: (number | null)[] = []
  for (let i = 0; i < startOffset; i++) calendarDays.push(null)
  for (let d = 1; d <= totalDays; d++) calendarDays.push(d)
  while (calendarDays.length % 7 !== 0) calendarDays.push(null)

  // Подсчёт итогов за месяц
  let monthPaid = 0
  let monthUnpaid = 0
  Object.values(days).forEach(d => {
    d.paid.forEach(r => { if (r.type === 'EXPENSE') monthPaid += r.amount })
    d.unpaid.forEach(r => { if (r.type === 'EXPENSE') monthUnpaid += r.amount })
  })

  const selectedDayData = selectedDay ? days[selectedDay] : null

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/dashboard/pnl" className="p-2 hover:bg-gray-100 rounded-lg transition">
            <ArrowLeft className="w-5 h-5 text-gray-600" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Платёжный календарь</h1>
            <p className="text-gray-500 text-sm mt-0.5">Планируемые и фактические платежи</p>
          </div>
        </div>
      </div>

      {/* Сводка месяца */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl border border-gray-100 p-5">
          <div className="flex items-center gap-2 mb-2">
            <Check className="w-4 h-4 text-emerald-500" />
            <span className="text-xs font-medium text-gray-500 uppercase">Оплачено</span>
          </div>
          <p className="text-2xl font-bold text-emerald-600">{formatMoney(monthPaid)} ₽</p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 p-5">
          <div className="flex items-center gap-2 mb-2">
            <Clock className="w-4 h-4 text-amber-500" />
            <span className="text-xs font-medium text-gray-500 uppercase">Ожидает</span>
          </div>
          <p className="text-2xl font-bold text-amber-600">{formatMoney(monthUnpaid)} ₽</p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 p-5">
          <div className="flex items-center gap-2 mb-2">
            <AlertCircle className="w-4 h-4 text-gray-400" />
            <span className="text-xs font-medium text-gray-500 uppercase">Итого расходов</span>
          </div>
          <p className="text-2xl font-bold text-gray-900">{formatMoney(monthPaid + monthUnpaid)} ₽</p>
        </div>
      </div>

      {/* Навигация по месяцу */}
      <div className="flex items-center justify-center gap-4">
        <button onClick={prevMonth} className="p-2 hover:bg-gray-100 rounded-xl transition">
          <ChevronLeft className="w-5 h-5 text-gray-600" />
        </button>
        <span className="text-lg font-semibold text-gray-900 capitalize min-w-[200px] text-center">{monthName}</span>
        <button onClick={nextMonth} className="p-2 hover:bg-gray-100 rounded-xl transition">
          <ChevronRight className="w-5 h-5 text-gray-600" />
        </button>
      </div>

      <div className="flex gap-6">
        {/* Календарь */}
        <div className="flex-1 bg-white rounded-2xl border border-gray-100 p-5">
          {/* Дни недели */}
          <div className="grid grid-cols-7 mb-2">
            {WEEKDAYS.map(d => (
              <div key={d} className="text-center text-xs font-medium text-gray-400 py-2">{d}</div>
            ))}
          </div>

          {/* Сетка дней */}
          <div className="grid grid-cols-7 gap-1">
            {calendarDays.map((day, i) => {
              if (day === null) return <div key={i} className="aspect-square" />

              const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
              const dayData = days[dateStr]
              const isToday = dateStr === today
              const isSelected = dateStr === selectedDay
              const hasPaid = dayData?.paid.length > 0
              const hasUnpaid = dayData?.unpaid.length > 0
              const paidSum = dayData?.paid.reduce((s, r) => s + r.amount, 0) || 0
              const unpaidSum = dayData?.unpaid.reduce((s, r) => s + r.amount, 0) || 0

              return (
                <button
                  key={i}
                  onClick={() => setSelectedDay(dateStr === selectedDay ? null : dateStr)}
                  className={`aspect-square rounded-xl p-1 flex flex-col items-center justify-start transition relative ${
                    isSelected
                      ? 'bg-indigo-50 ring-2 ring-indigo-400'
                      : isToday
                        ? 'bg-indigo-50/50'
                        : 'hover:bg-gray-50'
                  }`}
                >
                  <span className={`text-sm font-medium ${
                    isToday ? 'text-indigo-600' : 'text-gray-700'
                  }`}>
                    {day}
                  </span>

                  {/* Индикаторы */}
                  <div className="flex gap-0.5 mt-0.5">
                    {hasPaid && <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />}
                    {hasUnpaid && <div className="w-1.5 h-1.5 rounded-full bg-red-400" />}
                  </div>

                  {/* Суммы */}
                  {(paidSum > 0 || unpaidSum > 0) && (
                    <div className="mt-auto text-center w-full">
                      {unpaidSum > 0 && (
                        <div className="text-[9px] font-medium text-red-500 leading-tight truncate">
                          {formatMoney(unpaidSum)}
                        </div>
                      )}
                      {paidSum > 0 && (
                        <div className="text-[9px] font-medium text-emerald-500 leading-tight truncate">
                          {formatMoney(paidSum)}
                        </div>
                      )}
                    </div>
                  )}
                </button>
              )
            })}
          </div>

          {/* Легенда */}
          <div className="flex items-center gap-4 mt-4 pt-4 border-t border-gray-100">
            <div className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
              <span className="text-xs text-gray-500">Оплачено</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full bg-red-400" />
              <span className="text-xs text-gray-500">Ожидает оплаты</span>
            </div>
          </div>
        </div>

        {/* Детали выбранного дня */}
        <div className="w-80 shrink-0">
          {selectedDay && selectedDayData ? (
            <div className="bg-white rounded-2xl border border-gray-100 p-5 sticky top-6">
              <h3 className="font-semibold text-gray-900 mb-4">
                {new Date(selectedDay + 'T12:00:00').toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })}
              </h3>

              {/* Неоплаченные */}
              {selectedDayData.unpaid.length > 0 && (
                <div className="mb-4">
                  <p className="text-xs font-medium text-red-500 uppercase mb-2">Ожидает оплаты</p>
                  <div className="space-y-2">
                    {selectedDayData.unpaid.map(r => (
                      <div key={r.id} className="bg-red-50 rounded-xl px-3 py-2.5">
                        <div className="flex justify-between items-start">
                          <div>
                            <p className="text-sm font-medium text-gray-900">{r.category.name}</p>
                            {r.description && <p className="text-xs text-gray-500 mt-0.5">{r.description}</p>}
                            {r.counterparty && (
                              <p className="text-xs text-gray-500 mt-0.5">
                                {r.debtType === 'RECEIVABLE' ? 'Должен нам:' : 'Мы должны:'} {r.counterparty}
                              </p>
                            )}
                            {r.businessUnit && (
                              <span className="inline-block text-[10px] bg-white text-gray-500 px-1.5 py-0.5 rounded mt-1">{r.businessUnit.name}</span>
                            )}
                          </div>
                          <span className="text-sm font-bold text-red-600 whitespace-nowrap ml-2">
                            {formatMoney(r.amount)} ₽
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Оплаченные */}
              {selectedDayData.paid.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-emerald-600 uppercase mb-2">Оплачено</p>
                  <div className="space-y-2">
                    {selectedDayData.paid.map(r => (
                      <div key={r.id} className="bg-emerald-50 rounded-xl px-3 py-2.5">
                        <div className="flex justify-between items-start">
                          <div>
                            <p className="text-sm font-medium text-gray-900">{r.category.name}</p>
                            {r.description && <p className="text-xs text-gray-500 mt-0.5">{r.description}</p>}
                            {r.counterparty && (
                              <p className="text-xs text-gray-500 mt-0.5">{r.counterparty}</p>
                            )}
                            {r.businessUnit && (
                              <span className="inline-block text-[10px] bg-white text-gray-500 px-1.5 py-0.5 rounded mt-1">{r.businessUnit.name}</span>
                            )}
                          </div>
                          <span className={`text-sm font-bold whitespace-nowrap ml-2 ${
                            r.type === 'INCOME' ? 'text-emerald-600' : 'text-gray-700'
                          }`}>
                            {r.type === 'INCOME' ? '+' : '−'}{formatMoney(r.amount)} ₽
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {selectedDayData.paid.length === 0 && selectedDayData.unpaid.length === 0 && (
                <p className="text-sm text-gray-400 text-center py-4">Нет платежей</p>
              )}
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-gray-100 p-5 text-center">
              <p className="text-sm text-gray-400 py-8">Выберите день в календаре</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
