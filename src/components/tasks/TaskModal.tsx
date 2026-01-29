'use client'

import { useState, useEffect } from 'react'
import { X, Bell, Phone, Calendar as CalendarIcon, Clock } from 'lucide-react'

interface TaskModalProps {
  isOpen: boolean
  onClose: () => void
  dealId?: string
  contactId?: string
  contactName?: string
  onTaskCreated?: () => void
}

export default function TaskModal({
  isOpen,
  onClose,
  dealId,
  contactId,
  contactName,
  onTaskCreated
}: TaskModalProps) {
  const [loading, setLoading] = useState(false)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [date, setDate] = useState('')
  const [time, setTime] = useState('')

  // Предустановленные варианты времени
  const quickTimes = [
    { label: 'Через 15 мин', minutes: 15 },
    { label: 'Через 30 мин', minutes: 30 },
    { label: 'Через 1 час', minutes: 60 },
    { label: 'Через 3 часа', minutes: 180 },
    { label: 'Завтра 10:00', tomorrow: true, hour: 10 },
    { label: 'Завтра 14:00', tomorrow: true, hour: 14 }
  ]

  useEffect(() => {
    if (isOpen) {
      // Устанавливаем значения по умолчанию
      const now = new Date()
      const defaultDate = now.toISOString().split('T')[0]
      const defaultTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`

      setDate(defaultDate)
      setTime(defaultTime)
      setTitle(contactName ? `Перезвонить ${contactName}` : 'Перезвонить')
      setDescription('')
    }
  }, [isOpen, contactName])

  const handleQuickTime = (option: typeof quickTimes[0]) => {
    const now = new Date()

    if (option.tomorrow) {
      const tomorrow = new Date(now)
      tomorrow.setDate(tomorrow.getDate() + 1)
      tomorrow.setHours(option.hour!, 0, 0, 0)
      setDate(tomorrow.toISOString().split('T')[0])
      setTime(`${String(option.hour).padStart(2, '0')}:00`)
    } else if (option.minutes) {
      const future = new Date(now.getTime() + option.minutes * 60 * 1000)
      setDate(future.toISOString().split('T')[0])
      setTime(`${String(future.getHours()).padStart(2, '0')}:${String(future.getMinutes()).padStart(2, '0')}`)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!title.trim() || !date || !time) {
      alert('Заполните все обязательные поля')
      return
    }

    setLoading(true)
    try {
      const dueDate = new Date(`${date}T${time}:00`)

      const res = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          description,
          type: 'CALL',
          dueDate: dueDate.toISOString(),
          dealId,
          contactId
        })
      })

      if (res.ok) {
        // Запрашиваем разрешение на уведомления
        if ('Notification' in window && Notification.permission === 'default') {
          await Notification.requestPermission()
        }

        onTaskCreated?.()
        onClose()
      } else {
        alert('Ошибка при создании задачи')
      }
    } catch (error) {
      console.error('Error creating task:', error)
      alert('Ошибка при создании задачи')
    } finally {
      setLoading(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-orange-100 rounded-lg">
              <Bell className="w-5 h-5 text-orange-600" />
            </div>
            <h2 className="text-lg font-bold text-gray-900">Напоминание о перезвоне</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* Название */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Название задачи
            </label>
            <div className="relative">
              <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                placeholder="Перезвонить клиенту"
                required
              />
            </div>
          </div>

          {/* Быстрый выбор времени */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Быстрый выбор
            </label>
            <div className="grid grid-cols-3 gap-2">
              {quickTimes.map((option) => (
                <button
                  key={option.label}
                  type="button"
                  onClick={() => handleQuickTime(option)}
                  className="px-3 py-2 text-sm bg-gray-100 hover:bg-orange-100 hover:text-orange-700 rounded-lg transition text-center"
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          {/* Дата и время */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Дата
              </label>
              <div className="relative">
                <CalendarIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  required
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Время
              </label>
              <div className="relative">
                <Clock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="time"
                  value={time}
                  onChange={(e) => setTime(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  required
                />
              </div>
            </div>
          </div>

          {/* Комментарий */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Комментарий (необязательно)
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-transparent resize-none"
              placeholder="Дополнительные заметки..."
            />
          </div>

          {/* Кнопки */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-3 border border-gray-200 text-gray-700 rounded-xl font-medium hover:bg-gray-50 transition"
            >
              Отмена
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-4 py-3 bg-orange-600 text-white rounded-xl font-medium hover:bg-orange-700 transition disabled:opacity-50 flex items-center justify-center gap-2"
            >
              <Bell className="w-5 h-5" />
              {loading ? 'Создание...' : 'Создать напоминание'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
