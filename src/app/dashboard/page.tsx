'use client'

import { useEffect, useState } from 'react'
import {
  Users,
  Phone,
  MessageSquare,
  Briefcase,
  TrendingUp,
  TrendingDown,
  ArrowUpRight,
  PhoneIncoming,
  PhoneOutgoing,
  PhoneMissed,
  Banknote,
  Bell
} from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { ru } from 'date-fns/locale/ru'

interface Stats {
  contacts: number
  calls: number
  messages: number
  deals: number
  contactsChange: number
  callsChange: number
  messagesChange: number
  dealsChange: number
  dealsSum: number
  pendingTasks: number
}

interface RecentContact {
  id: string
  name: string
  phone?: string
  telegramUsername?: string
  source: string
  createdAt: string
}

interface RecentCall {
  id: string
  phone: string
  direction: string
  status: string
  duration?: number
  contactName?: string
  createdAt: string
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
    dealsChange: 0,
    dealsSum: 0,
    pendingTasks: 0
  })
  const [recentContacts, setRecentContacts] = useState<RecentContact[]>([])
  const [recentCalls, setRecentCalls] = useState<RecentCall[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchDashboardStats()
  }, [])

  const fetchDashboardStats = async () => {
    try {
      const res = await fetch('/api/dashboard/stats')
      if (res.ok) {
        const data = await res.json()
        setStats(data.stats)
        setRecentContacts(data.recentContacts || [])
        setRecentCalls(data.recentCalls || [])
      }
    } catch (error) {
      console.error('Error fetching dashboard stats:', error)
    } finally {
      setLoading(false)
    }
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('ru-RU', {
      style: 'currency',
      currency: 'RUB',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount)
  }

  const formatDuration = (seconds?: number) => {
    if (!seconds) return ''
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  const formatTimeAgo = (dateString: string) => {
    try {
      return formatDistanceToNow(new Date(dateString), { addSuffix: true, locale: ru })
    } catch {
      return ''
    }
  }

  const getCallIcon = (status: string, direction: string) => {
    if (status === 'MISSED') {
      return <PhoneMissed className="w-5 h-5 text-red-600" />
    }
    if (direction === 'IN') {
      return <PhoneIncoming className="w-5 h-5 text-green-600" />
    }
    return <PhoneOutgoing className="w-5 h-5 text-blue-600" />
  }

  const getCallBgColor = (status: string, direction: string) => {
    if (status === 'MISSED') return 'bg-red-100'
    if (direction === 'IN') return 'bg-green-100'
    return 'bg-blue-100'
  }

  const getCallStatusText = (status: string, duration?: number) => {
    if (status === 'MISSED') return 'Пропущенный'
    if (status === 'COMPLETED' && duration) return `Завершен • ${formatDuration(duration)}`
    if (status === 'COMPLETED') return 'Завершен'
    return status
  }

  const getSourceLabel = (source: string) => {
    switch (source) {
      case 'TELEGRAM': return 'Telegram'
      case 'PHONE': return 'Телефон'
      case 'MANUAL': return 'Вручную'
      case 'WEBSITE': return 'Сайт'
      default: return source || 'Неизвестно'
    }
  }

  const statCards = [
    {
      title: 'Контакты',
      value: stats.contacts,
      change: stats.contactsChange,
      icon: Users,
      color: 'bg-blue-500',
      href: '/dashboard/contacts'
    },
    {
      title: 'Звонки сегодня',
      value: stats.calls,
      change: stats.callsChange,
      icon: Phone,
      color: 'bg-green-500',
      href: '/dashboard/calls'
    },
    {
      title: 'Сообщения',
      value: stats.messages,
      change: stats.messagesChange,
      icon: MessageSquare,
      color: 'bg-purple-500',
      href: '/dashboard/chat'
    },
    {
      title: 'Активные сделки',
      value: stats.deals,
      change: stats.dealsChange,
      icon: Briefcase,
      color: 'bg-orange-500',
      href: '/dashboard/deals'
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
          <a
            key={stat.title}
            href={stat.href}
            className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 hover:shadow-md transition-shadow"
          >
            <div className="flex items-center justify-between">
              <div className={`p-3 rounded-xl ${stat.color}`}>
                <stat.icon className="w-6 h-6 text-white" />
              </div>
              {stat.change !== 0 && (
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
              )}
            </div>
            <div className="mt-4">
              <p className="text-3xl font-bold text-gray-900">
                {loading ? '...' : stat.value}
              </p>
              <p className="text-sm text-gray-500 mt-1">{stat.title}</p>
            </div>
          </a>
        ))}
      </div>

      {/* Additional Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Deals Sum */}
        <div className="bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl p-6 text-white">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-3 bg-white/20 rounded-xl">
              <Banknote className="w-6 h-6" />
            </div>
            <div>
              <p className="text-white/80 text-sm">Сумма активных сделок</p>
              <p className="text-2xl font-bold">
                {loading ? '...' : formatCurrency(stats.dealsSum)}
              </p>
            </div>
          </div>
        </div>

        {/* Pending Tasks */}
        <div className={`rounded-2xl p-6 ${stats.pendingTasks > 0 ? 'bg-gradient-to-br from-orange-500 to-red-500 text-white' : 'bg-white border border-gray-100'}`}>
          <div className="flex items-center gap-3 mb-4">
            <div className={`p-3 rounded-xl ${stats.pendingTasks > 0 ? 'bg-white/20' : 'bg-orange-100'}`}>
              <Bell className={`w-6 h-6 ${stats.pendingTasks > 0 ? 'text-white' : 'text-orange-600'}`} />
            </div>
            <div>
              <p className={`text-sm ${stats.pendingTasks > 0 ? 'text-white/80' : 'text-gray-500'}`}>
                Задачи на сегодня
              </p>
              <p className={`text-2xl font-bold ${stats.pendingTasks > 0 ? 'text-white' : 'text-gray-900'}`}>
                {loading ? '...' : stats.pendingTasks}
              </p>
            </div>
          </div>
        </div>
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
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <div className="w-6 h-6 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : recentContacts.length === 0 ? (
              <p className="text-center text-gray-500 py-8">Нет контактов</p>
            ) : (
              recentContacts.map((contact) => (
                <a
                  key={contact.id}
                  href={`/dashboard/contacts/${contact.id}`}
                  className="flex items-center gap-3 p-2 -mx-2 rounded-lg hover:bg-gray-50 transition"
                >
                  <div className="w-10 h-10 bg-indigo-100 rounded-full flex items-center justify-center">
                    <span className="text-indigo-600 font-medium">
                      {contact.name.charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {contact.name}
                    </p>
                    <p className="text-xs text-gray-500">
                      {contact.telegramUsername ? `@${contact.telegramUsername}` : contact.phone || getSourceLabel(contact.source)}
                    </p>
                  </div>
                  <span className="text-xs text-gray-400">
                    {formatTimeAgo(contact.createdAt)}
                  </span>
                </a>
              ))
            )}
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
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <div className="w-6 h-6 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : recentCalls.length === 0 ? (
              <p className="text-center text-gray-500 py-8">Нет звонков</p>
            ) : (
              recentCalls.map((call) => (
                <div key={call.id} className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center ${getCallBgColor(call.status, call.direction)}`}>
                    {getCallIcon(call.status, call.direction)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {call.contactName || call.phone}
                    </p>
                    <p className="text-xs text-gray-500">
                      {call.direction === 'IN' ? 'Входящий' : 'Исходящий'} • {getCallStatusText(call.status, call.duration)}
                    </p>
                  </div>
                  <span className="text-xs text-gray-400">
                    {formatTimeAgo(call.createdAt)}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
