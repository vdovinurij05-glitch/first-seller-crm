'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Filter, TrendingUp, ArrowRight } from 'lucide-react'

interface Pipeline {
  id: string
  name: string
  slug: string
  icon: string | null
  _count: {
    deals: number
  }
}

export default function PipelinesPage() {
  const [pipelines, setPipelines] = useState<Pipeline[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchPipelines()
  }, [])

  const fetchPipelines = async () => {
    try {
      const res = await fetch('/api/pipelines')
      if (res.ok) {
        const data = await res.json()
        setPipelines(data.pipelines)
      }
    } catch (error) {
      console.error('Error fetching pipelines:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Воронки продаж</h1>
        <p className="mt-2 text-gray-600">
          Управляйте различными воронками продаж и отслеживайте прогресс сделок
        </p>
      </div>

      {/* Pipelines Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {pipelines.map((pipeline) => (
          <Link
            key={pipeline.id}
            href={`/dashboard/pipelines/${pipeline.slug}`}
            className="block group"
          >
            <div className="bg-white rounded-xl border-2 border-gray-200 hover:border-indigo-500 hover:shadow-lg transition-all p-6">
              {/* Icon */}
              <div className="w-12 h-12 bg-indigo-100 rounded-lg flex items-center justify-center mb-4 group-hover:bg-indigo-600 transition-colors">
                <Filter className="w-6 h-6 text-indigo-600 group-hover:text-white transition-colors" />
              </div>

              {/* Pipeline Name */}
              <h3 className="text-xl font-bold text-gray-900 mb-2 group-hover:text-indigo-600 transition-colors">
                {pipeline.name}
              </h3>

              {/* Stats */}
              <div className="flex items-center gap-2 text-gray-600 mb-4">
                <TrendingUp className="w-4 h-4" />
                <span className="text-sm">
                  {pipeline._count.deals} {pipeline._count.deals === 1 ? 'сделка' : 'сделок'}
                </span>
              </div>

              {/* Arrow */}
              <div className="flex items-center text-indigo-600 font-medium group-hover:translate-x-1 transition-transform">
                <span className="text-sm">Открыть воронку</span>
                <ArrowRight className="w-4 h-4 ml-2" />
              </div>
            </div>
          </Link>
        ))}
      </div>

      {/* Empty State */}
      {pipelines.length === 0 && (
        <div className="text-center py-12 bg-gray-50 rounded-xl">
          <Filter className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            Нет воронок
          </h3>
          <p className="text-gray-600">
            Воронки продаж еще не созданы
          </p>
        </div>
      )}
    </div>
  )
}
