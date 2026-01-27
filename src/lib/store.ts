import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface User {
  id: string
  email: string
  name: string
  role: string
  avatar?: string
}

interface Contact {
  id: string
  name: string
  phone?: string
  email?: string
  telegramId?: string
  telegramUsername?: string
  status: string
  source?: string
  managerId?: string
}

interface Message {
  id: string
  content: string
  type: string
  direction: 'IN' | 'OUT'
  createdAt: string
  contactId: string
  managerId?: string
  manager?: { id: string; name: string; avatar?: string }
}

interface AuthState {
  user: User | null
  token: string | null
  isAuthenticated: boolean
  login: (user: User, token: string) => void
  logout: () => void
}

interface ChatState {
  activeContactId: string | null
  messages: Record<string, Message[]>
  unreadCounts: Record<string, number>
  setActiveContact: (contactId: string | null) => void
  addMessage: (contactId: string, message: Message) => void
  setMessages: (contactId: string, messages: Message[]) => void
  markAsRead: (contactId: string) => void
}

interface UIState {
  sidebarOpen: boolean
  toggleSidebar: () => void
}

// Auth Store
export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      isAuthenticated: false,
      login: (user, token) => set({ user, token, isAuthenticated: true }),
      logout: () => set({ user: null, token: null, isAuthenticated: false })
    }),
    { name: 'auth-storage' }
  )
)

// Chat Store
export const useChatStore = create<ChatState>((set) => ({
  activeContactId: null,
  messages: {},
  unreadCounts: {},
  setActiveContact: (contactId) => set({ activeContactId: contactId }),
  addMessage: (contactId, message) =>
    set((state) => ({
      messages: {
        ...state.messages,
        [contactId]: [...(state.messages[contactId] || []), message]
      },
      unreadCounts:
        message.direction === 'IN' && state.activeContactId !== contactId
          ? {
              ...state.unreadCounts,
              [contactId]: (state.unreadCounts[contactId] || 0) + 1
            }
          : state.unreadCounts
    })),
  setMessages: (contactId, messages) =>
    set((state) => ({
      messages: { ...state.messages, [contactId]: messages }
    })),
  markAsRead: (contactId) =>
    set((state) => ({
      unreadCounts: { ...state.unreadCounts, [contactId]: 0 }
    }))
}))

// UI Store
export const useUIStore = create<UIState>((set) => ({
  sidebarOpen: true,
  toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen }))
}))
