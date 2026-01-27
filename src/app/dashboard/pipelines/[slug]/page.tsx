'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { Plus, ArrowLeft, Filter } from 'lucide-react'
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
    const newStage = over.id as string

    console.log('🎯 Drag ended:', { dealId, newStage })

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

        <button
          onClick={() => router.push('/dashboard/deals/new')}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
        >
          <Plus className="w-5 h-5" />
          <span>Новая сделка</span>
        </button>
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
    </div>
  )
}
