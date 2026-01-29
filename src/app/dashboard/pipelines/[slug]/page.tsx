'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { Plus, ArrowLeft, Filter, Upload, Download, X, FileSpreadsheet } from 'lucide-react'
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
  useDroppable
} from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import DealCard from '@/components/deals/DealCard'
import DraggableDealCard from '@/components/deals/DraggableDealCard'
import Link from 'next/link'

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

interface PipelineStage {
  id: string
  name: string
  slug: string
  color: string
  order: number
  isDefault: boolean
}

interface Pipeline {
  id: string
  name: string
  slug: string
  icon: string | null
  stages: PipelineStage[]
  _count: {
    deals: number
  }
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

export default function PipelinePage() {
  const router = useRouter()
  const params = useParams()
  const slug = params?.slug as string

  const [pipeline, setPipeline] = useState<Pipeline | null>(null)
  const [deals, setDeals] = useState<Deal[]>([])
  const [loading, setLoading] = useState(true)
  const [activeDeal, setActiveDeal] = useState<Deal | null>(null)
  const [showImportModal, setShowImportModal] = useState(false)
  const [importing, setImporting] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8
      }
    })
  )

  useEffect(() => {
    if (slug) {
      fetchPipeline()
      fetchDeals()
    }
  }, [slug])

  const fetchPipeline = async () => {
    try {
      const res = await fetch(`/api/pipelines/${slug}`)
      if (res.ok) {
        const data = await res.json()
        setPipeline(data.pipeline)
      } else {
        router.push('/dashboard/pipelines')
      }
    } catch (error) {
      console.error('Error fetching pipeline:', error)
      router.push('/dashboard/pipelines')
    }
  }

  const fetchDeals = async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/deals?pipelineSlug=${slug}`)
      const data = await res.json()
      setDeals(data.deals || [])
    } catch (error) {
      console.error('Error fetching deals:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleDragStart = (event: DragStartEvent) => {
    const deal = deals.find((d) => d.id === event.active.id)
    if (deal) {
      setActiveDeal(deal)
    }
  }

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event
    setActiveDeal(null)

    if (!over || active.id === over.id) return

    const dealId = active.id as string

    // Определяем новый stage
    // over.id может быть либо stage slug (если дропнули на колонку), либо deal id (если дропнули на сделку)
    let newStage: string

    // Проверяем, является ли over.id ID сделки
    const droppedOnDeal = deals.find(d => d.id === over.id)
    if (droppedOnDeal) {
      // Дропнули на сделку - берем её stage
      newStage = droppedOnDeal.stage
      console.log('🎯 Drag ended: dropped on deal, using its stage:', { dealId, newStage, droppedOnDealId: over.id })
    } else {
      // Дропнули на колонку - используем её ID как stage
      newStage = over.id as string
      console.log('🎯 Drag ended: dropped on column:', { dealId, newStage })
    }

    // Оптимистичное обновление UI
    setDeals((prevDeals) =>
      prevDeals.map((deal) =>
        deal.id === dealId ? { ...deal, stage: newStage } : deal
      )
    )

    try {
      console.log('📡 Sending PATCH request...')
      const res = await fetch(`/api/deals/${dealId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stage: newStage })
      })

      if (!res.ok) {
        const error = await res.json()
        console.error('❌ API Error:', error)
        throw new Error('Failed to update deal')
      }

      const result = await res.json()
      console.log('✅ API Success:', result)

      // Не перезагружаем список - используем оптимистичное обновление
      // Обновляем только полученную сделку
      setDeals((prevDeals) =>
        prevDeals.map((deal) =>
          deal.id === dealId ? { ...deal, ...result.deal } : deal
        )
      )
    } catch (error) {
      console.error('❌ Error updating deal stage:', error)
      // При ошибке откатываем изменения, перезагружая список
      await fetchDeals()
    }
  }

  const getDealsByStage = (stageSlug: string) => {
    return deals
      .filter((deal) => deal.stage === stageSlug)
      .sort((a, b) => a.order - b.order)
  }

  // Скачивание шаблона CSV для сделок
  const downloadTemplate = () => {
    const stagesList = pipeline?.stages.map(s => s.slug).join(' / ') || 'NEW'
    const headers = 'Название,Сумма,Контакт (телефон),Этап,Описание'
    const exampleRow = `Сделка с клиентом,100000,+79991234567,${pipeline?.stages[0]?.slug || 'NEW'},Описание сделки`
    const csvContent = `${headers}\n${exampleRow}`

    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'deals_template.csv'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  // Импорт сделок из файла
  const handleFileImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !pipeline) return

    const formData = new FormData()
    formData.append('file', file)
    formData.append('pipelineId', pipeline.id)

    setImporting(true)
    try {
      const res = await fetch('/api/deals/import', {
        method: 'POST',
        body: formData
      })

      const data = await res.json()

      if (res.ok) {
        alert(`Успешно импортировано: ${data.imported} сделок`)
        setShowImportModal(false)
        fetchDeals()
      } else {
        alert(`Ошибка: ${data.error}`)
      }
    } catch (error) {
      console.error('Error importing deals:', error)
      alert('Ошибка при импорте файла')
    } finally {
      setImporting(false)
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  if (loading || !pipeline) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link
            href="/dashboard/pipelines"
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-6 h-6 text-gray-600" />
          </Link>
          <div>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-indigo-100 rounded-lg flex items-center justify-center">
                <Filter className="w-5 h-5 text-indigo-600" />
              </div>
              <h1 className="text-3xl font-bold text-gray-900">{pipeline.name}</h1>
            </div>
            <p className="mt-1 text-gray-600">{pipeline._count.deals} активных сделок</p>
          </div>
        </div>

        <div className="flex gap-3">
          <button
            onClick={() => setShowImportModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <Upload className="w-5 h-5" />
            <span>Импорт</span>
          </button>
          <button
            onClick={() => router.push('/dashboard/deals/new')}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
          >
            <Plus className="w-5 h-5" />
            <span>Новая сделка</span>
          </button>
        </div>
      </div>

      {/* Kanban Board */}
      <DndContext
        sensors={sensors}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="flex gap-6 overflow-x-auto pb-4 pt-8">
          {pipeline.stages.map((stage) => {
            const stageDeals = getDealsByStage(stage.slug)
            const totalAmount = stageDeals.reduce((sum, deal) => sum + deal.amount, 0)

            return (
              <DroppableColumn key={stage.slug} id={stage.slug} stage={stage}>
                {/* Stage Header */}
                <div className="mb-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: stage.color }}
                      />
                      <h3 className="font-semibold text-gray-900">{stage.name}</h3>
                      <span className="text-sm text-gray-500">({stageDeals.length})</span>
                    </div>
                  </div>
                  <div className="text-sm font-medium text-gray-700">
                    {totalAmount.toLocaleString('ru-RU')} ₽
                  </div>
                </div>

                {/* Deals List */}
                <SortableContext
                  items={stageDeals.map((d) => d.id)}
                  strategy={verticalListSortingStrategy}
                >
                  <div className="space-y-3 min-h-[200px] mt-8">
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

        {/* Drag Overlay */}
        <DragOverlay>
          {activeDeal && (
            <div className="opacity-90">
              <DealCard deal={activeDeal} />
            </div>
          )}
        </DragOverlay>
      </DndContext>

      {/* Import Modal */}
      {showImportModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-gray-900">Импорт сделок</h2>
              <button
                onClick={() => setShowImportModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="space-y-4">
              <p className="text-sm text-gray-600">
                Загрузите файл CSV или Excel со сделками. Файл должен содержать 5 колонок: Название, Сумма, Контакт (телефон), Этап, Описание
              </p>

              {/* Кнопка скачивания шаблона */}
              <button
                onClick={downloadTemplate}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-green-50 border border-green-200 text-green-700 rounded-xl font-medium hover:bg-green-100 transition"
              >
                <Download className="w-5 h-5" />
                Скачать шаблон CSV
              </button>

              <div className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center">
                <FileSpreadsheet className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,.xls,.xlsx"
                  onChange={handleFileImport}
                  className="hidden"
                  id="deals-file-upload"
                />
                <label
                  htmlFor="deals-file-upload"
                  className="cursor-pointer"
                >
                  <span className="text-indigo-600 font-medium hover:text-indigo-700">
                    Выберите файл
                  </span>
                  <span className="text-gray-600"> или перетащите сюда</span>
                </label>
                <p className="text-xs text-gray-500 mt-2">CSV, XLS, XLSX до 10MB</p>
              </div>

              {importing && (
                <div className="flex items-center justify-center gap-3 text-indigo-600">
                  <div className="w-5 h-5 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
                  <span>Импортируем сделки...</span>
                </div>
              )}

              <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                <p className="text-sm text-blue-800 font-medium mb-2">Формат файла:</p>
                <pre className="text-xs text-blue-900 bg-white p-2 rounded overflow-x-auto">
Название,Сумма,Контакт (телефон),Этап,Описание{'\n'}
Сделка с клиентом,100000,+79991234567,{pipeline?.stages[0]?.slug || 'NEW'},Описание
                </pre>
                <p className="text-xs text-blue-700 mt-2">
                  Доступные этапы: {pipeline?.stages.map(s => s.slug).join(', ')}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
