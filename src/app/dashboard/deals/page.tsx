'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, TrendingUp, Users, Calendar, Search, Settings, Trash2, X } from 'lucide-react'
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
  rectIntersection,
  useDroppable
} from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import DealCard from '@/components/deals/DealCard'
import DraggableDealCard from '@/components/deals/DraggableDealCard'

interface Deal {
  id: string
  title: string
  amount: number
  stage: string
  probability: number
  order: number
  contact?: {
    id: string
    name: string
    phone?: string
  }
  manager?: {
    id: string
    name: string
  }
  createdAt: string
}

interface Stage {
  id: string
  name: string
  color: string
  order: number
  isDefault: boolean
}

function DroppableColumn({
  id,
  children,
  stage
}: {
  id: string
  children: React.ReactNode
  stage: { id: string; name: string; color: string }
}) {
  const { setNodeRef, isOver } = useDroppable({ id })

  return (
    <div
      ref={setNodeRef}
      className={`flex-shrink-0 w-80 bg-gray-50 rounded-2xl p-4 transition-colors ${
        isOver ? 'bg-indigo-50 ring-2 ring-indigo-300' : ''
      }`}
    >
      {children}
    </div>
  )
}

export default function DealsPage() {
  const router = useRouter()
  const [deals, setDeals] = useState<Deal[]>([])
  const [stages, setStages] = useState<Stage[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [activeDeal, setActiveDeal] = useState<Deal | null>(null)
  const [showStagesModal, setShowStagesModal] = useState(false)
  const [newStageName, setNewStageName] = useState('')
  const [newStageColor, setNewStageColor] = useState('bg-gray-500')

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8
      }
    })
  )

  useEffect(() => {
    fetchDeals()
    fetchStages()
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

  const fetchStages = async () => {
    try {
      const res = await fetch('/api/stages')
      const data = await res.json()
      setStages(data.stages || [])
    } catch (error) {
      console.error('Error fetching stages:', error)
    }
  }

  const handleDragStart = (event: DragStartEvent) => {
    const deal = deals.find(d => d.id === event.active.id)
    setActiveDeal(deal || null)
  }

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event
    setActiveDeal(null)

    if (!over) return

    const dealId = active.id as string
    const deal = deals.find(d => d.id === dealId)
    if (!deal) return

    // Определяем целевой stage
    let newStage = over.id as string
    const overDeal = deals.find(d => d.id === over.id)
    if (overDeal) {
      newStage = overDeal.stage
    }

    // Проверяем, что newStage - это валидный этап
    const isValidStage = stages.some(s => s.id === newStage)
    if (!isValidStage) return

    const isSameStage = deal.stage === newStage

    // Если перемещаем в том же столбце
    if (isSameStage && overDeal && dealId !== overDeal.id) {
      console.log('Reordering within same stage')

      const stageDeals = deals.filter(d => d.stage === newStage).sort((a, b) => a.order - b.order)
      const oldIndex = stageDeals.findIndex(d => d.id === dealId)
      const newIndex = stageDeals.findIndex(d => d.id === overDeal.id)

      if (oldIndex === newIndex) return

      // Создаем новый массив с переставленными элементами
      const reorderedDeals = [...stageDeals]
      const [movedDeal] = reorderedDeals.splice(oldIndex, 1)
      reorderedDeals.splice(newIndex, 0, movedDeal)

      // Пересчитываем order для всех сделок в этом stage
      const updatedDeals = reorderedDeals.map((d, idx) => ({ ...d, order: idx }))

      // Оптимистичное обновление UI
      setDeals(prevDeals => {
        const otherDeals = prevDeals.filter(d => d.stage !== newStage)
        return [...otherDeals, ...updatedDeals]
      })

      // Обновляем на сервере
      try {
        await Promise.all(
          updatedDeals.map(d =>
            fetch(`/api/deals/${d.id}`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ order: d.order })
            })
          )
        )
        console.log('Deals reordered successfully')
      } catch (error) {
        console.error('Error reordering deals:', error)
        await fetchDeals()
      }
    }
    // Если перемещаем в другой столбец
    else if (!isSameStage) {
      console.log('Moving deal', dealId, 'from', deal.stage, 'to stage', newStage)

      // Найдем максимальный order в целевом stage
      const targetStageDeals = deals.filter(d => d.stage === newStage)
      const maxOrder = targetStageDeals.length > 0
        ? Math.max(...targetStageDeals.map(d => d.order))
        : -1

      // Оптимистичное обновление UI
      setDeals(prevDeals =>
        prevDeals.map(d =>
          d.id === dealId ? { ...d, stage: newStage, order: maxOrder + 1 } : d
        )
      )

      // Обновляем на сервере
      try {
        const res = await fetch(`/api/deals/${dealId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ stage: newStage, order: maxOrder + 1 })
        })

        if (!res.ok) {
          console.error('Failed to update deal on server')
          await fetchDeals()
        } else {
          console.log('Deal updated successfully')
        }
      } catch (error) {
        console.error('Error updating deal:', error)
        await fetchDeals()
      }
    }
  }

  const handleAddStage = async () => {
    if (!newStageName.trim()) return

    try {
      const id = newStageName.toUpperCase().replace(/\s+/g, '_')

      const res = await fetch('/api/stages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id,
          name: newStageName,
          color: newStageColor
        })
      })

      if (res.ok) {
        setNewStageName('')
        setNewStageColor('bg-gray-500')
        await fetchStages()
      } else {
        alert('Ошибка при создании статуса')
      }
    } catch (error) {
      console.error('Error creating stage:', error)
      alert('Ошибка при создании статуса')
    }
  }

  const handleDeleteStage = async (stageId: string) => {
    if (!confirm('Вы уверены, что хотите удалить этот статус?')) return

    try {
      const res = await fetch(`/api/stages/${stageId}`, {
        method: 'DELETE'
      })

      if (res.ok) {
        await fetchStages()
      } else {
        const data = await res.json()
        alert(data.error || 'Ошибка при удалении статуса')
      }
    } catch (error) {
      console.error('Error deleting stage:', error)
      alert('Ошибка при удалении статуса')
    }
  }

  const getDealsByStage = (stageId: string) => {
    return deals
      .filter(deal =>
        deal.stage === stageId &&
        (searchQuery === '' ||
          deal.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
          deal.contact?.name.toLowerCase().includes(searchQuery.toLowerCase()))
      )
      .sort((a, b) => a.order - b.order)
  }

  const calculateStats = () => {
    const totalDeals = deals.length
    const totalAmount = deals.reduce((sum, deal) => sum + deal.amount, 0)
    const wonDeals = deals.filter(d => d.stage === 'WON').length
    const thisMonthDeals = deals.filter(d => {
      const dealDate = new Date(d.createdAt)
      const now = new Date()
      return dealDate.getMonth() === now.getMonth() &&
        dealDate.getFullYear() === now.getFullYear()
    }).length

    return { totalDeals, totalAmount, wonDeals, thisMonthDeals }
  }

  const stats = calculateStats()

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('ru-RU', {
      style: 'currency',
      currency: 'RUB',
      minimumFractionDigits: 0
    }).format(amount)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Сделки</h1>
          <p className="text-gray-500 mt-1">Управление воронкой продаж</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => setShowStagesModal(true)}
            className="px-4 py-2 bg-gray-100 text-gray-700 rounded-xl font-medium hover:bg-gray-200 transition flex items-center gap-2"
          >
            <Settings className="w-5 h-5" />
            Настроить статусы
          </button>
          <button
            onClick={() => router.push('/dashboard/deals/new')}
            className="px-4 py-2 bg-indigo-600 text-white rounded-xl font-medium hover:bg-indigo-700 transition flex items-center gap-2"
          >
            <Plus className="w-5 h-5" />
            Создать сделку
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <TrendingUp className="w-5 h-5 text-blue-600" />
            </div>
            <span className="text-sm font-medium text-gray-600">Всего сделок</span>
          </div>
          <p className="text-2xl font-bold text-gray-900">{stats.totalDeals}</p>
        </div>

        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 bg-green-100 rounded-lg">
              <TrendingUp className="w-5 h-5 text-green-600" />
            </div>
            <span className="text-sm font-medium text-gray-600">Сумма сделок</span>
          </div>
          <p className="text-2xl font-bold text-gray-900">{formatCurrency(stats.totalAmount)}</p>
        </div>

        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 bg-purple-100 rounded-lg">
              <Calendar className="w-5 h-5 text-purple-600" />
            </div>
            <span className="text-sm font-medium text-gray-600">В этом месяце</span>
          </div>
          <p className="text-2xl font-bold text-gray-900">{stats.thisMonthDeals}</p>
        </div>

        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 bg-orange-100 rounded-lg">
              <Users className="w-5 h-5 text-orange-600" />
            </div>
            <span className="text-sm font-medium text-gray-600">Выиграно</span>
          </div>
          <p className="text-2xl font-bold text-gray-900">{stats.wonDeals}</p>
        </div>
      </div>

      {/* Search */}
      <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="Поиск сделок..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
          />
        </div>
      </div>

      {/* Kanban Board */}
      <DndContext
        sensors={sensors}
        collisionDetection={rectIntersection}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="overflow-x-auto pb-4">
          <div className="inline-flex gap-4 min-w-full">
            {stages.map((stage) => {
              const stageDeals = getDealsByStage(stage.id)

              return (
                <DroppableColumn key={stage.id} id={stage.id} stage={stage}>
                  {/* Column Header */}
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <div className={`w-3 h-3 rounded-full ${stage.color}`} />
                      <h3 className="font-semibold text-gray-900">{stage.name}</h3>
                      <span className="text-sm text-gray-500 bg-white px-2 py-0.5 rounded-full">
                        {stageDeals.length}
                      </span>
                    </div>
                  </div>

                  {/* Deals in this column */}
                  <SortableContext
                    items={stageDeals.map(d => d.id)}
                    strategy={verticalListSortingStrategy}
                  >
                    <div className="space-y-3 min-h-[200px]">
                      {stageDeals.map((deal) => (
                        <DraggableDealCard
                          key={deal.id}
                          deal={deal}
                          onClick={() => router.push(`/dashboard/deals/${deal.id}`)}
                        />
                      ))}
                    </div>
                  </SortableContext>
                </DroppableColumn>
              )
            })}
          </div>
        </div>

        {/* Drag Overlay */}
        <DragOverlay>
          {activeDeal && (
            <div className="rotate-3 opacity-90">
              <DealCard deal={activeDeal} />
            </div>
          )}
        </DragOverlay>
      </DndContext>

      {/* Stages Management Modal */}
      {showStagesModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full mx-4 max-h-[80vh] overflow-hidden flex flex-col">
            {/* Modal Header */}
            <div className="p-6 border-b border-gray-100 flex items-center justify-between">
              <h2 className="text-xl font-bold text-gray-900">Управление статусами</h2>
              <button
                onClick={() => setShowStagesModal(false)}
                className="p-2 hover:bg-gray-100 rounded-lg transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {/* Add New Stage */}
              <div className="bg-gray-50 rounded-xl p-4">
                <h3 className="font-semibold text-gray-900 mb-3">Добавить новый статус</h3>
                <div className="flex gap-3">
                  <input
                    type="text"
                    placeholder="Название статуса"
                    value={newStageName}
                    onChange={(e) => setNewStageName(e.target.value)}
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  />
                  <select
                    value={newStageColor}
                    onChange={(e) => setNewStageColor(e.target.value)}
                    className="px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  >
                    <option value="bg-gray-500">Серый</option>
                    <option value="bg-blue-500">Синий</option>
                    <option value="bg-indigo-500">Индиго</option>
                    <option value="bg-purple-500">Фиолетовый</option>
                    <option value="bg-pink-500">Розовый</option>
                    <option value="bg-red-500">Красный</option>
                    <option value="bg-orange-500">Оранжевый</option>
                    <option value="bg-yellow-500">Желтый</option>
                    <option value="bg-green-500">Зеленый</option>
                    <option value="bg-teal-500">Бирюзовый</option>
                  </select>
                  <button
                    onClick={handleAddStage}
                    disabled={!newStageName.trim()}
                    className="px-6 py-2 bg-indigo-600 text-white rounded-xl font-medium hover:bg-indigo-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Добавить
                  </button>
                </div>
              </div>

              {/* Existing Stages */}
              <div className="space-y-2">
                <h3 className="font-semibold text-gray-900 mb-3">Существующие статусы</h3>
                {stages.map((stage) => (
                  <div
                    key={stage.id}
                    className="flex items-center justify-between p-4 bg-white border border-gray-200 rounded-xl hover:border-gray-300 transition"
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-4 h-4 rounded-full ${stage.color}`} />
                      <span className="font-medium text-gray-900">{stage.name}</span>
                      {stage.isDefault && (
                        <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-full">
                          Стандартный
                        </span>
                      )}
                    </div>
                    {!stage.isDefault && (
                      <button
                        onClick={() => handleDeleteStage(stage.id)}
                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-6 border-t border-gray-100">
              <button
                onClick={() => setShowStagesModal(false)}
                className="w-full px-4 py-2 bg-gray-100 text-gray-700 rounded-xl font-medium hover:bg-gray-200 transition"
              >
                Закрыть
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
