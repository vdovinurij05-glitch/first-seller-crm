'use client'

import { useEffect, useState } from 'react'
import { X, MessageSquare } from 'lucide-react'
import { useRouter } from 'next/navigation'

interface NotificationData {
  id: string
  content: string
  dealId: string
  dealTitle: string
  contactName: string
  contactUsername?: string
}

interface DealNotificationProps {
  notification: NotificationData
  onClose: () => void
}

export default function DealNotification({ notification, onClose }: DealNotificationProps) {
  const router = useRouter()
  const [isVisible, setIsVisible] = useState(false)
  const [isExiting, setIsExiting] = useState(false)

  useEffect(() => {
    // Анимация появления
    setTimeout(() => setIsVisible(true), 10)

    // Автоматическое скрытие через 7 секунд
    const timer = setTimeout(() => {
      handleClose()
    }, 7000)

    return () => clearTimeout(timer)
  }, [])

  const handleClose = () => {
    setIsExiting(true)
    setTimeout(() => {
      onClose()
    }, 300)
  }

  const handleClick = () => {
    router.push(`/dashboard/deals/${notification.dealId}`)
    handleClose()
  }

  return (
    <div
      className={`fixed left-6 bottom-6 z-50 transition-all duration-300 ${
        isVisible && !isExiting
          ? 'translate-x-0 opacity-100'
          : '-translate-x-full opacity-0'
      }`}
    >
      <div
        onClick={handleClick}
        className="bg-white rounded-xl shadow-2xl border border-gray-200 p-4 w-80 cursor-pointer hover:shadow-3xl transition-shadow"
      >
        <div className="flex items-start gap-3">
          {/* Icon */}
          <div className="p-2 bg-indigo-100 rounded-lg flex-shrink-0">
            <MessageSquare className="w-5 h-5 text-indigo-600" />
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2 mb-1">
              <p className="text-sm font-semibold text-gray-900 truncate">
                {notification.dealTitle}
              </p>
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  handleClose()
                }}
                className="p-1 hover:bg-gray-100 rounded transition flex-shrink-0"
              >
                <X className="w-4 h-4 text-gray-400" />
              </button>
            </div>
            <p className="text-xs text-gray-500 mb-2">
              {notification.contactUsername
                ? `@${notification.contactUsername}`
                : notification.contactName}
            </p>
            <p className="text-sm text-gray-700 line-clamp-2">
              {notification.content}
            </p>
          </div>
        </div>

        {/* Progress bar */}
        <div className="mt-3 h-1 bg-gray-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-indigo-600 rounded-full animate-progress"
            style={{ animation: 'progress 7s linear forwards' }}
          />
        </div>
      </div>

      <style jsx>{`
        @keyframes progress {
          from {
            width: 100%;
          }
          to {
            width: 0%;
          }
        }
        .animate-progress {
          animation: progress 7s linear forwards;
        }
      `}</style>
    </div>
  )
}
