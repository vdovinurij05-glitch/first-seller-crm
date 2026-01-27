'use client'

import { useEffect, useState } from 'react'
import { Users, Phone, MessageSquare, Briefcase, TrendingUp, TrendingDown, ArrowUpRight } from 'lucide-react'

interface Stats {
  contacts: number
  calls: number
  messages: number
  deals: number
  contactsChange: number
  callsChange: number
  messagesChange: number
  dealsChange: number
}

export default function DashboardPage() {
  const [stats, setStats] = useState<Stats>({
    contacts: 0,
    calls: 0,
    messages: 0,
    deals: 0,
    contactsChange: 0,
    callsChange: 0,
    messagesChange: 0,
    dealsChange: 0
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // TODO: Fetch real stats from API
    setTimeout(() => {
      setStats({
        contacts: 156,
        calls: 43,
        messages: 287,
        deals: 12,
        contactsChange: 12,
        callsChange: -5,
        messagesChange: 23,
        dealsChange: 8
      })
      setLoading(false)
    }, 500)
  }, [])

  const statCards = [
    {
      title: 'Контакты',
      value: stats.contacts,
      change: stats.contactsChange,
      icon: Users,
      color: 'bg-blue-500'
    },
    {
      title: 'Звонки сегодня',
      value: stats.calls,
      change: stats.callsChange,
      icon: Phone,
      color: 'bg-green-500'
    },
    {
      title: 'Сообщения',
      value: stats.messages,
      change: stats.messagesChange,
      icon: MessageSquare,
      color: 'bg-purple-500'
    },
    {
      title: 'Активные сделки',
      value: stats.deals,
      change: stats.dealsChange,
      icon: Briefcase,
      color: 'bg-orange-500'
    }
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Дашборд</h1>
          <p className="text-gray-500 mt-1">Обзор активности</p>
        </div>
        <div className="text-sm text-gray-500">
          {new Date().toLocaleDateString('ru-RU', {
            weekday: 'long',
            day: 'numeric',
            month: 'long',
            year: 'numeric'
          })}
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {statCards.map((stat) => (
          <div
            key={stat.title}
            className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100"
          >
            <div className="flex items-center justify-between">
              <div className={`p-3 rounded-xl ${stat.color}`}>
                <stat.icon className="w-6 h-6 text-white" />
              </div>
              <div
                className={`flex items-center gap-1 text-sm font-medium ${
                  stat.change >= 0 ? 'text-green-600' : 'text-red-600'
                }`}
              >
                {stat.change >= 0 ? (
                  <TrendingUp className="w-4 h-4" />
                ) : (
                  <TrendingDown className="w-4 h-4" />
                )}
                {Math.abs(stat.change)}%
              </div>
            </div>
            <div className="mt-4">
              <p className="text-3xl font-bold text-gray-900">
                {loading ? '...' : stat.value}
              </p>
              <p className="text-sm text-gray-500 mt-1">{stat.title}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Contacts */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">
              Последние контакты
            </h2>
            <a
              href="/dashboard/contacts"
              className="text-sm text-indigo-600 hover:text-indigo-700 flex items-center gap-1"
            >
              Все контакты
              <ArrowUpRight className="w-4 h-4" />
            </a>
          </div>
          <div className="space-y-4">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center">
                  <span className="text-gray-600 font-medium">
                    {String.fromCharCode(64 + i)}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">
                    Контакт {i}
                  </p>
                  <p className="text-xs text-gray-500">Telegram</p>
                </div>
                <span className="text-xs text-gray-400">5 мин назад</span>
              </div>
            ))}
          </div>
        </div>

        {/* Recent Calls */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">
              Последние звонки
            </h2>
            <a
              href="/dashboard/calls"
              className="text-sm text-indigo-600 hover:text-indigo-700 flex items-center gap-1"
            >
              Все звонки
              <ArrowUpRight className="w-4 h-4" />
            </a>
          </div>
          <div className="space-y-4">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="flex items-center gap-3">
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center ${
                    i % 2 === 0 ? 'bg-green-100' : 'bg-red-100'
                  }`}
                >
                  <Phone
                    className={`w-5 h-5 ${
                      i % 2 === 0 ? 'text-green-600' : 'text-red-600'
                    }`}
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">
                    +7 (999) 123-45-{String(i).padStart(2, '0')}
                  </p>
                  <p className="text-xs text-gray-500">
                    {i % 2 === 0 ? 'Входящий • 2:45' : 'Пропущенный'}
                  </p>
                </div>
                <span className="text-xs text-gray-400">10 мин назад</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
