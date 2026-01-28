'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useAuthStore, useUIStore } from '@/lib/store'
import { useEffect, useState, useRef } from 'react'
import {
  LayoutDashboard,
  MessageSquare,
  Users,
  Phone,
  Filter,
  Settings,
  LogOut,
  Menu,
  X
} from 'lucide-react'
import DealNotification from '@/components/DealNotification'

interface NotificationData {
  id: string
  content: string
  dealId: string
  dealTitle: string
  contactName: string
  contactUsername?: string
}

const navigation = [
  { name: 'Дашборд', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Чат', href: '/dashboard/chat', icon: MessageSquare },
  { name: 'Контакты', href: '/dashboard/contacts', icon: Users },
  { name: 'Звонки', href: '/dashboard/calls', icon: Phone },
  { name: 'Воронки', href: '/dashboard/pipelines', icon: Filter },
  { name: 'Настройки', href: '/dashboard/settings', icon: Settings },
]

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const pathname = usePathname()
  const router = useRouter()
  const { user, isAuthenticated, login, logout } = useAuthStore()
  const { sidebarOpen, toggleSidebar } = useUIStore()
  const [checkingAuth, setCheckingAuth] = useState(true)
  const [notifications, setNotifications] = useState<NotificationData[]>([])
  const lastCheckRef = useRef<number>(Date.now())
  const shownMessagesRef = useRef<Set<string>>(new Set())

  // Проверка авторизации при загрузке страницы
  useEffect(() => {
    const checkAuth = async () => {
      // Если уже авторизован в store, не проверяем
      if (isAuthenticated) {
        setCheckingAuth(false)
        return
      }

      try {
        const res = await fetch('/api/auth/me')
        if (res.ok) {
          const data = await res.json()
          login(data.user, data.token)
        } else {
          logout()
          router.push('/')
        }
      } catch (error) {
        console.error('Auth check failed:', error)
        logout()
        router.push('/')
      } finally {
        setCheckingAuth(false)
      }
    }

    checkAuth()
  }, [])

  // Polling для новых сообщений в сделках
  useEffect(() => {
    if (!isAuthenticated) return

    const checkNewMessages = async () => {
      try {
        const res = await fetch(`/api/messages/recent?since=${lastCheckRef.current}`)
        if (res.ok) {
          const data = await res.json()
          const messages = data.messages || []

          // Фильтруем сообщения, которые мы еще не показали
          const newMessages = messages.filter((msg: any) => !shownMessagesRef.current.has(msg.id))

          if (newMessages.length > 0) {
            // Добавляем новые уведомления
            const newNotifications: NotificationData[] = newMessages
              .filter((msg: any) => msg.deal?.id) // Только сообщения со сделками
              .map((msg: any) => ({
                id: msg.id,
                content: msg.content,
                dealId: msg.deal.id,
                dealTitle: msg.deal.title || 'Сделка',
                contactName: msg.contact?.name || 'Контакт',
                contactUsername: msg.contact?.telegramUsername
              }))

            if (newNotifications.length > 0) {
              setNotifications((prev) => [...prev, ...newNotifications])
            }

            // Добавляем в список показанных
            newMessages.forEach((msg: any) => {
              shownMessagesRef.current.add(msg.id)
            })
          }

          // Обновляем время последней проверки
          lastCheckRef.current = Date.now()
        }
      } catch (error) {
        console.error('Error checking new messages:', error)
      }
    }

    // Проверяем сразу
    checkNewMessages()

    // Затем каждые 5 секунд
    const interval = setInterval(checkNewMessages, 5000)

    return () => clearInterval(interval)
  }, [isAuthenticated])

  // Автосинхронизация звонков из Mango Office каждые 60 секунд
  useEffect(() => {
    if (!isAuthenticated) return

    const syncMangoCalls = async () => {
      try {
        console.log('🔄 Syncing Mango calls...')
        const res = await fetch('/api/mango/sync')
        if (res.ok) {
          const data = await res.json()
          console.log(`✅ Mango sync completed: ${data.synced || 0} calls synced`)
        }
      } catch (error) {
        console.error('Error syncing Mango calls:', error)
      }
    }

    // Синхронизируем сразу при загрузке
    syncMangoCalls()

    // Затем каждые 60 секунд
    const interval = setInterval(syncMangoCalls, 60000)

    return () => clearInterval(interval)
  }, [isAuthenticated])

  const handleLogout = () => {
    logout()
    router.push('/')
  }

  const handleCloseNotification = (id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id))
  }

  // Показываем загрузку пока проверяем авторизацию
  if (checkingAuth) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full mx-auto mb-4" />
          <p className="text-gray-600">Загрузка...</p>
        </div>
      </div>
    )
  }

  // Если не авторизован после проверки, показываем null
  if (!isAuthenticated) {
    return null
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Mobile sidebar toggle */}
      <button
        onClick={toggleSidebar}
        className="lg:hidden fixed top-4 left-4 z-50 p-2 bg-white rounded-lg shadow-md"
      >
        {sidebarOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
      </button>

      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 w-64 bg-white border-r border-gray-200 transform transition-transform duration-200 lg:translate-x-0 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Logo */}
        <div className="h-16 flex items-center px-6 border-b border-gray-200">
          <h1 className="text-xl font-bold text-indigo-600">First Seller</h1>
        </div>

        {/* Navigation */}
        <nav className="p-4 space-y-1">
          {navigation.map((item) => {
            const isActive = pathname === item.href
            return (
              <Link
                key={item.name}
                href={item.href}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl transition ${
                  isActive
                    ? 'bg-indigo-50 text-indigo-600'
                    : 'text-gray-600 hover:bg-gray-50'
                }`}
              >
                <item.icon className="w-5 h-5" />
                <span className="font-medium">{item.name}</span>
              </Link>
            )
          })}
        </nav>

        {/* User */}
        <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-gray-200">
          <div className="flex items-center gap-3 px-4 py-3">
            <div className="w-10 h-10 bg-indigo-100 rounded-full flex items-center justify-center">
              <span className="text-indigo-600 font-medium">
                {user?.name?.charAt(0).toUpperCase()}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 truncate">
                {user?.name}
              </p>
              <p className="text-xs text-gray-500 truncate">{user?.email}</p>
            </div>
            <button
              onClick={handleLogout}
              className="p-2 text-gray-400 hover:text-red-500 transition"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main className={`transition-all duration-200 ${sidebarOpen ? 'lg:ml-64' : ''} lg:ml-64`}>
        <div className="p-6">{children}</div>
      </main>

      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black/50 z-30"
          onClick={toggleSidebar}
        />
      )}

      {/* Notifications */}
      <div className="fixed left-0 bottom-0 z-50 space-y-3 p-6">
        {notifications.map((notification, index) => (
          <div
            key={notification.id}
            style={{
              transform: `translateY(-${index * 10}px)`,
              zIndex: 50 + index
            }}
          >
            <DealNotification
              notification={notification}
              onClose={() => handleCloseNotification(notification.id)}
            />
          </div>
        ))}
      </div>
    </div>
  )
}
