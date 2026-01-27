'use client'

import { useState, useEffect, useRef } from 'react'
import { useChatStore, useAuthStore } from '@/lib/store'
import {
  Search,
  Send,
  Phone,
  MoreVertical,
  Paperclip,
  Smile,
  Check,
  CheckCheck,
  Circle
} from 'lucide-react'
import { format } from 'date-fns'
import { ru } from 'date-fns/locale'

interface Contact {
  id: string
  name: string
  phone?: string
  telegramUsername?: string
  status: string
  lastMessage?: string
  lastMessageTime?: string
  unreadCount?: number
  isOnline?: boolean
}

export default function ChatPage() {
  const [contacts, setContacts] = useState<Contact[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [newMessage, setNewMessage] = useState('')
  const [loading, setLoading] = useState(true)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const { activeContactId, setActiveContact, messages, setMessages, addMessage } = useChatStore()
  const { user } = useAuthStore()

  const activeContact = contacts.find((c) => c.id === activeContactId)
  const activeMessages = activeContactId ? messages[activeContactId] || [] : []

  // Загрузка контактов
  useEffect(() => {
    const fetchContacts = async () => {
      try {
        const res = await fetch('/api/contacts?limit=50')
        const data = await res.json()
        setContacts(data.contacts || [])
      } catch (error) {
        console.error('Error fetching contacts:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchContacts()

    // Polling для обновления списка контактов каждые 10 секунд
    const interval = setInterval(fetchContacts, 10000)

    return () => clearInterval(interval)
  }, [])

  // Загрузка сообщений при выборе контакта
  useEffect(() => {
    if (!activeContactId) return

    const fetchMessages = async () => {
      try {
        const res = await fetch(`/api/messages?contactId=${activeContactId}`)
        const data = await res.json()
        setMessages(activeContactId, data.messages || [])
      } catch (error) {
        console.error('Error fetching messages:', error)
      }
    }

    fetchMessages()
  }, [activeContactId, setMessages])

  // Polling для новых сообщений (каждые 3 секунды)
  useEffect(() => {
    if (!activeContactId) return

    const pollMessages = async () => {
      try {
        const res = await fetch(`/api/messages?contactId=${activeContactId}`)
        const data = await res.json()
        const newMessages = data.messages || []

        // Обновляем только если количество сообщений изменилось
        if (newMessages.length !== activeMessages.length) {
          setMessages(activeContactId, newMessages)
        }
      } catch (error) {
        console.error('Error polling messages:', error)
      }
    }

    // Запускаем polling каждые 3 секунды
    const interval = setInterval(pollMessages, 3000)

    // Очищаем interval при размонтировании или смене контакта
    return () => clearInterval(interval)
  }, [activeContactId, activeMessages.length, setMessages])

  // Скролл к последнему сообщению
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [activeMessages])

  // Отправка сообщения
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newMessage.trim() || !activeContactId) return

    const content = newMessage
    setNewMessage('')

    try {
      const res = await fetch('/api/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contactId: activeContactId,
          content,
          managerId: user?.id
        })
      })

      if (res.ok) {
        const message = await res.json()
        addMessage(activeContactId, message)
      }
    } catch (error) {
      console.error('Error sending message:', error)
    }
  }

  // Фильтрация контактов
  const filteredContacts = contacts.filter(
    (c) =>
      c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.phone?.includes(searchQuery) ||
      c.telegramUsername?.toLowerCase().includes(searchQuery.toLowerCase())
  )

  return (
    <div className="h-[calc(100vh-6rem)] flex bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
      {/* Contacts List */}
      <div className="w-80 border-r border-gray-200 flex flex-col">
        {/* Search */}
        <div className="p-4 border-b border-gray-200">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              placeholder="Поиск контактов..."
            />
          </div>
        </div>

        {/* Contacts */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center h-32">
              <div className="animate-spin w-6 h-6 border-2 border-indigo-600 border-t-transparent rounded-full" />
            </div>
          ) : filteredContacts.length === 0 ? (
            <div className="text-center text-gray-500 py-8">
              Контакты не найдены
            </div>
          ) : (
            filteredContacts.map((contact) => (
              <button
                key={contact.id}
                onClick={() => setActiveContact(contact.id)}
                className={`w-full p-4 flex items-center gap-3 hover:bg-gray-50 transition ${
                  activeContactId === contact.id ? 'bg-indigo-50' : ''
                }`}
              >
                <div className="relative">
                  <div className="w-12 h-12 bg-indigo-100 rounded-full flex items-center justify-center">
                    <span className="text-indigo-600 font-medium">
                      {contact.name.charAt(0).toUpperCase()}
                    </span>
                  </div>
                  {contact.isOnline && (
                    <Circle className="absolute bottom-0 right-0 w-3 h-3 text-green-500 fill-green-500" />
                  )}
                </div>
                <div className="flex-1 min-w-0 text-left">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {contact.name}
                    </p>
                    {contact.lastMessageTime && (
                      <span className="text-xs text-gray-400">
                        {contact.lastMessageTime}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 truncate">
                    {contact.telegramUsername
                      ? `@${contact.telegramUsername}`
                      : contact.phone}
                  </p>
                </div>
                {contact.unreadCount && contact.unreadCount > 0 && (
                  <span className="w-5 h-5 bg-indigo-600 text-white text-xs rounded-full flex items-center justify-center">
                    {contact.unreadCount}
                  </span>
                )}
              </button>
            ))
          )}
        </div>
      </div>

      {/* Chat Area */}
      <div className="flex-1 flex flex-col">
        {activeContact ? (
          <>
            {/* Chat Header */}
            <div className="p-4 border-b border-gray-200 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-indigo-100 rounded-full flex items-center justify-center">
                  <span className="text-indigo-600 font-medium">
                    {activeContact.name.charAt(0).toUpperCase()}
                  </span>
                </div>
                <div>
                  <p className="font-medium text-gray-900">{activeContact.name}</p>
                  <p className="text-xs text-gray-500">
                    {activeContact.telegramUsername
                      ? `@${activeContact.telegramUsername}`
                      : activeContact.phone}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button className="p-2 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition">
                  <Phone className="w-5 h-5" />
                </button>
                <button className="p-2 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition">
                  <MoreVertical className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50">
              {activeMessages.map((message) => (
                <div
                  key={message.id}
                  className={`flex ${
                    message.direction === 'OUT' ? 'justify-end' : 'justify-start'
                  }`}
                >
                  <div
                    className={`max-w-[70%] px-4 py-2 rounded-2xl ${
                      message.direction === 'OUT'
                        ? 'bg-indigo-600 text-white rounded-br-md'
                        : 'bg-white text-gray-900 rounded-bl-md shadow-sm'
                    }`}
                  >
                    <p className="text-sm">{message.content}</p>
                    <div
                      className={`flex items-center justify-end gap-1 mt-1 ${
                        message.direction === 'OUT' ? 'text-indigo-200' : 'text-gray-400'
                      }`}
                    >
                      <span className="text-xs">
                        {format(new Date(message.createdAt), 'HH:mm', { locale: ru })}
                      </span>
                      {message.direction === 'OUT' && (
                        <CheckCheck className="w-4 h-4" />
                      )}
                    </div>
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <form
              onSubmit={handleSendMessage}
              className="p-4 border-t border-gray-200 flex items-center gap-3"
            >
              <button
                type="button"
                className="p-2 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition"
              >
                <Paperclip className="w-5 h-5" />
              </button>
              <input
                type="text"
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                className="flex-1 px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                placeholder="Введите сообщение..."
              />
              <button
                type="button"
                className="p-2 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition"
              >
                <Smile className="w-5 h-5" />
              </button>
              <button
                type="submit"
                disabled={!newMessage.trim()}
                className="p-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Send className="w-5 h-5" />
              </button>
            </form>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-gray-400">
            <div className="text-center">
              <MessageSquare className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>Выберите контакт для начала общения</p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function MessageSquare({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
      />
    </svg>
  )
}
