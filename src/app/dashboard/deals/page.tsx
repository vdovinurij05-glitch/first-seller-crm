'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Search, Filter, TrendingUp, Calendar, User, Phone } from 'lucide-react'

interface Pipeline {
  id: string
  name: string
  slug: string
}

interface Deal {
  id: string
  title: string
  amount: number
  stage: string
  probability: number
  createdAt: string
  pipeline?: Pipeline
  contact?: {
    id: string
    name: string
    phone?: string
    telegramUsername?: string
  }
  manager?: {
    id: string
    name: string
  }
}

export default function DealsPage() {
  const router = useRouter()
  const [deals, setDeals] = useState<Deal[]>([])
  const [pipelines, setPipelines] = useState<Pipeline[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [pipelineFilter, setPipelineFilter] = useState<string>('all')

  useEffect(() => {
    fetchDeals()
    fetchPipelines()
  }, [])

  const fetchDeals = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/deals')
      const data = await res.json()
      setDeals(data.deals || [])
    } catch (error) {
      console.error('Error fetching deals:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchPipelines = async () => {
    try {
      const res = await fetch('/api/pipelines')
      const data = await res.json()
      setPipelines(data.pipelines || [])
    } catch (error) {
      console.error('Error fetching pipelines:', error)
    }
  }

  const handleDealClick = (dealId: string) => {
    router.push(`/dashboard/deals/${dealId}`)
  }

  const filteredDeals = deals.filter(deal => {
    const matchesSearch =
      deal.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      deal.contact?.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      deal.contact?.phone?.includes(searchQuery)

    const matchesPipeline = pipelineFilter === 'all' || deal.pipeline?.id === pipelineFilter

    return matchesSearch && matchesPipeline
  })

  const totalAmount = filteredDeals.reduce((sum, deal) => sum + deal.amount, 0)

  const formatAmount = (amount: number) => {
    return new Intl.NumberFormat('ru-RU', {
      style: 'currency',
      currency: 'RUB',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount)
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    })
  }

  const getStageColor = (stage: string) => {
    const colors: Record<string, string> = {
      'NEW': 'bg-blue-100 text-blue-700',
      'CONTACTED': 'bg-purple-100 text-purple-700',
      'MEETING': 'bg-yellow-100 text-yellow-700',
      'NEGOTIATION': 'bg-orange-100 text-orange-700',
      'WON': 'bg-green-100 text-green-700',
      'LOST': 'bg-red-100 text-red-700',
      'PL_CONNECTED': 'bg-emerald-100 text-emerald-700',
      'STORE_LAUNCHED': 'bg-teal-100 text-teal-700',
    }
    return colors[stage] || 'bg-gray-100 text-gray-700'
  }

  const getStageName = (stage: string) => {
    const names: Record<string, string> = {
      'NEW': 'Новые',
      'CONTACTED': 'Контакт',
      'MEETING': 'Встреча',
      'NEGOTIATION': 'Переговоры',
      'PROPOSAL': 'Предложение',
      'WON': 'Выиграно',
      'LOST': 'Проиграно',
      'PL_CONNECTED': 'ПЛ подключена',
      'STORE_LAUNCHED': 'Магазин запущен',
    }
    return names[stage] || stage
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Все сделки</h1>
          <p className="text-gray-500 mt-1">
            {filteredDeals.length} сделок на сумму {formatAmount(totalAmount)}
          </p>
        </div>
        <button
          onClick={() => router.push('/dashboard/deals/new')}
          className="px-4 py-2 bg-indigo-600 text-white rounded-xl font-medium hover:bg-indigo-700 transition flex items-center gap-2"
        >
          <Plus className="w-5 h-5" />
          Новая сделка
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
        <div className="flex flex-col md:flex-row gap-4">
          {/* Search */}
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Поиск по названию, контакту, телефону..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
          </div>

          {/* Pipeline Filter */}
          <div className="flex gap-2 overflow-x-auto">
            <button
              onClick={() => setPipelineFilter('all')}
              className={`px-4 py-2 rounded-xl font-medium transition whitespace-nowrap ${
                pipelineFilter === 'all'
                  ? 'bg-indigo-600 text-white'
                  : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
              }`}
            >
              Все воронки
            </button>
            {pipelines.map((pipeline) => (
              <button
                key={pipeline.id}
                onClick={() => setPipelineFilter(pipeline.id)}
                className={`px-4 py-2 rounded-xl font-medium transition whitespace-nowrap ${
                  pipelineFilter === pipeline.id
                    ? 'bg-indigo-600 text-white'
                    : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
                }`}
              >
                {pipeline.name}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Deals Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Сделка
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Контакт
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Воронка
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Статус
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Сумма
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Дата
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-gray-500">
                    Загрузка...
                  </td>
                </tr>
              ) : filteredDeals.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-gray-500">
                    Сделки не найдены
                  </td>
                </tr>
              ) : (
                filteredDeals.map((deal) => (
                  <tr
                    key={deal.id}
                    onClick={() => handleDealClick(deal.id)}
                    className="hover:bg-gray-50 transition cursor-pointer"
                  >
                    <td className="px-6 py-4">
                      <div>
                        <p className="font-medium text-gray-900">{deal.title}</p>
                        {deal.manager && (
                          <p className="text-sm text-gray-500 flex items-center gap-1 mt-1">
                            <User className="w-3 h-3" />
                            {deal.manager.name}
                          </p>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      {deal.contact ? (
                        <div>
                          <p className="font-medium text-gray-900">{deal.contact.name}</p>
                          {deal.contact.phone && (
                            <a
                              href={`tel:${deal.contact.phone}`}
                              onClick={(e) => e.stopPropagation()}
                              className="text-sm text-indigo-600 hover:text-indigo-800 flex items-center gap-1"
                            >
                              <Phone className="w-3 h-3" />
                              {deal.contact.phone}
                            </a>
                          )}
                        </div>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      {deal.pipeline ? (
                        <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full bg-indigo-50 text-indigo-700">
                          <Filter className="w-3 h-3" />
                          {deal.pipeline.name}
                        </span>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${getStageColor(deal.stage)}`}>
                        {getStageName(deal.stage)}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="font-medium text-gray-900">
                        {formatAmount(deal.amount)}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm text-gray-600 flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {formatDate(deal.createdAt)}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Quick Stats by Pipeline */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {pipelines.map((pipeline) => {
          const pipelineDeals = deals.filter(d => d.pipeline?.id === pipeline.id)
          const pipelineAmount = pipelineDeals.reduce((sum, d) => sum + d.amount, 0)

          return (
            <div
              key={pipeline.id}
              onClick={() => router.push(`/dashboard/pipelines/${pipeline.slug}`)}
              className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 cursor-pointer hover:shadow-md transition"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-indigo-100 rounded-xl flex items-center justify-center">
                  <TrendingUp className="w-5 h-5 text-indigo-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">{pipeline.name}</p>
                  <p className="font-bold text-gray-900">{pipelineDeals.length} сделок</p>
                  <p className="text-xs text-gray-500">{formatAmount(pipelineAmount)}</p>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
