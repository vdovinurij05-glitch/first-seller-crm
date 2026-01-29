'use client'

import { useEffect, useRef, useCallback } from 'react'

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

export default function TaskNotificationProvider({ children }: { children: React.ReactNode }) {
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const notifiedTasksRef = useRef<Set<string>>(new Set())

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

    // Показываем браузерное уведомление
    if ('Notification' in window && Notification.permission === 'granted') {
      const notification = new Notification('Напоминание о перезвоне', {
        body: task.title + (task.description ? `\n${task.description}` : ''),
        icon: '/favicon.ico',
        tag: task.id,
        requireInteraction: true
      })

      notification.onclick = () => {
        window.focus()
        if (task.dealId) {
          window.location.href = `/dashboard/deals/${task.dealId}`
        }
        notification.close()
      }
    }

    // Также показываем alert как запасной вариант
    setTimeout(() => {
      const message = `🔔 НАПОМИНАНИЕ: ${task.title}${task.description ? `\n\n${task.description}` : ''}`
      if (confirm(message + '\n\nОтметить как выполненное?')) {
        markTaskCompleted(task.id)
      }
    }, 100)
  }, [playNotificationSound])

  const markTaskCompleted = async (taskId: string) => {
    try {
      await fetch(`/api/tasks/${taskId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'COMPLETED', reminderSent: true })
      })
    } catch (error) {
      console.error('Error marking task completed:', error)
    }
  }

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
    // Запрашиваем разрешение на уведомления при загрузке
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission()
    }

    // Проверяем задачи сразу и каждые 30 секунд
    checkPendingTasks()
    const interval = setInterval(checkPendingTasks, 30000)

    return () => clearInterval(interval)
  }, [checkPendingTasks])

  return <>{children}</>
}
