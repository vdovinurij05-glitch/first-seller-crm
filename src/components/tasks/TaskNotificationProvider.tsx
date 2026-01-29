'use client'

import { useEffect, useRef, useCallback, useState } from 'react'
import TaskToast from './TaskToast'

// Звуковой сигнал напоминания (base64 encoded short beep)
const NOTIFICATION_SOUND = 'data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2teleQU3T4i1xJVRAB0zpMLNh0oAJXquxriPVxsJNIe6y5FRAyN4psDKjVgYCDaHucqSUgQie6W/yo5ZGAY2iLrJkVIDIXykv8mOWRgGNom7yZBSAyF9pb/JjlkYBjaJu8mPUgMhfaW/yY5ZGAY2ibvJj1IDIX2lv8mOWRgGNom7yY9SAyF9pb/JjlkYBjaJu8mPUgMhfaW/yY5ZGAY2ibvJj1IDIX2lv8mOWRgGNom7yY9SAyF9pb/JjlkYBjaJu8mPUgMhfaW/yY5Z'

interface Task {
  id: string
  title: string
  description?: string
  dueDate: string
  dealId?: string
  contactId?: string
}

interface VisibleNotification extends Task {
  shownAt: number
}

export default function TaskNotificationProvider({ children }: { children: React.ReactNode }) {
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const notifiedTasksRef = useRef<Set<string>>(new Set())
  const [visibleNotifications, setVisibleNotifications] = useState<VisibleNotification[]>([])

  const playNotificationSound = useCallback(() => {
    try {
      if (!audioRef.current) {
        audioRef.current = new Audio(NOTIFICATION_SOUND)
        audioRef.current.volume = 0.7
      }

      // Играем звук 3 раза с паузой
      let playCount = 0
      const playSound = () => {
        if (playCount < 3) {
          audioRef.current?.play().catch(console.error)
          playCount++
          setTimeout(playSound, 500)
        }
      }
      playSound()
    } catch (error) {
      console.error('Error playing notification sound:', error)
    }
  }, [])

  const showNotification = useCallback((task: Task) => {
    // Проверяем, не показывали ли уже уведомление для этой задачи
    if (notifiedTasksRef.current.has(task.id)) {
      return
    }
    notifiedTasksRef.current.add(task.id)

    // Играем звук
    playNotificationSound()

    // Добавляем в список видимых уведомлений
    setVisibleNotifications(prev => [
      ...prev,
      { ...task, shownAt: Date.now() }
    ])
  }, [playNotificationSound])

  const handleCloseNotification = useCallback((taskId: string) => {
    setVisibleNotifications(prev => prev.filter(n => n.id !== taskId))
  }, [])

  const handleCompleteTask = useCallback(async (taskId: string) => {
    try {
      await fetch(`/api/tasks/${taskId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'COMPLETED', reminderSent: true })
      })
      // Убираем уведомление
      setVisibleNotifications(prev => prev.filter(n => n.id !== taskId))
    } catch (error) {
      console.error('Error marking task completed:', error)
    }
  }, [])

  const checkPendingTasks = useCallback(async () => {
    try {
      const res = await fetch('/api/tasks?pending=true')
      if (!res.ok) return

      const data = await res.json()
      const tasks: Task[] = data.tasks || []

      const now = new Date()

      for (const task of tasks) {
        const dueDate = new Date(task.dueDate)

        // Если время наступило
        if (dueDate <= now) {
          showNotification(task)

          // Помечаем что напоминание отправлено
          await fetch(`/api/tasks/${task.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ reminderSent: true })
          })
        }
      }
    } catch (error) {
      console.error('Error checking pending tasks:', error)
    }
  }, [showNotification])

  useEffect(() => {
    // Проверяем задачи сразу и каждые 30 секунд
    checkPendingTasks()
    const interval = setInterval(checkPendingTasks, 30000)

    return () => clearInterval(interval)
  }, [checkPendingTasks])

  return (
    <>
      {children}

      {/* Уведомления слева внизу */}
      <div className="fixed left-6 bottom-6 z-50 space-y-3">
        {visibleNotifications.map((notification) => (
          <TaskToast
            key={notification.id}
            id={notification.id}
            title={notification.title}
            description={notification.description}
            dueDate={notification.dueDate}
            dealId={notification.dealId}
            onClose={() => handleCloseNotification(notification.id)}
            onComplete={() => handleCompleteTask(notification.id)}
          />
        ))}
      </div>
    </>
  )
}
