'use client'

import { X, Phone, Check, Clock } from 'lucide-react'
import { useEffect, useState } from 'react'

interface TaskToastProps {
  id: string
  title: string
  description?: string
  dueDate: string
  dealId?: string
  onClose: () => void
  onComplete: () => void
}

export default function TaskToast({
  id,
  title,
  description,
  dueDate,
  dealId,
  onClose,
  onComplete
}: TaskToastProps) {
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    // Анимация появления
    setTimeout(() => setIsVisible(true), 10)
  }, [])

  const handleClose = () => {
    setIsVisible(false)
    setTimeout(onClose, 300)
  }

  const handleComplete = () => {
    setIsVisible(false)
    setTimeout(onComplete, 300)
  }

  const handleOpenDeal = () => {
    if (dealId) {
      window.location.href = `/dashboard/deals/${dealId}`
    }
  }

  // Форматируем время в 24-часовом формате
  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr)
    const hours = String(date.getHours()).padStart(2, '0')
    const minutes = String(date.getMinutes()).padStart(2, '0')
    return `${hours}:${minutes}`
  }

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    const day = String(date.getDate()).padStart(2, '0')
    const month = String(date.getMonth() + 1).padStart(2, '0')
    return `${day}.${month}`
  }

  return (
    <div
      className={`transform transition-all duration-300 ease-out ${
        isVisible
          ? 'translate-x-0 opacity-100'
          : '-translate-x-full opacity-0'
      }`}
    >
      <div className="bg-white rounded-xl shadow-2xl border border-orange-200 w-80 overflow-hidden">
        {/* Header */}
        <div className="bg-orange-500 px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2 text-white">
            <Phone className="w-4 h-4" />
            <span className="font-medium text-sm">Напоминание</span>
          </div>
          <div className="flex items-center gap-2 text-white/90 text-xs">
            <Clock className="w-3 h-3" />
            <span>{formatDate(dueDate)} {formatTime(dueDate)}</span>
          </div>
        </div>

        {/* Content */}
        <div className="p-4">
          <h4 className="font-semibold text-gray-900 mb-1">{title}</h4>
          {description && (
            <p className="text-sm text-gray-600 mb-3">{description}</p>
          )}

          {/* Actions */}
          <div className="flex gap-2 mt-3">
            <button
              onClick={handleComplete}
              className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-green-500 text-white text-sm font-medium rounded-lg hover:bg-green-600 transition"
            >
              <Check className="w-4 h-4" />
              Выполнено
            </button>
            {dealId && (
              <button
                onClick={handleOpenDeal}
                className="flex-1 px-3 py-2 bg-indigo-500 text-white text-sm font-medium rounded-lg hover:bg-indigo-600 transition"
              >
                Открыть
              </button>
            )}
            <button
              onClick={handleClose}
              className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
