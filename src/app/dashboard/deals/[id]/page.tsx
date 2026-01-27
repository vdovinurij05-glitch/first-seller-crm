'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter, useParams } from 'next/navigation'
import {
  ArrowLeft,
  Edit,
  Save,
  X,
  Send,
  MessageCircle,
  MessageSquare,
  User,
  Calendar,
  Trash2,
  Paperclip,
  Download,
  FileText,
  Image as ImageIcon,
  Music,
  Video,
  Mic
} from 'lucide-react'

interface Deal {
  id: string
  title: string
  amount: number
  stage: string
  probability: number
  description?: string
  closedAt?: string
  createdAt: string
  contact?: {
    id: string
    name: string
    phone?: string
    telegramId?: string
    telegramUsername?: string
  }
  manager?: {
    id: string
    name: string
  }
}

interface Attachment {
  id: string
  filename: string
  url: string
  mimeType?: string
  size?: number
}

interface Message {
  id: string
  content: string
  type: string
  direction: 'IN' | 'OUT'
  createdAt: string
  attachments?: Attachment[]
  manager?: {
    name: string
  }
}

export default function DealDetailPage() {
  const router = useRouter()
  const params = useParams()
  const dealId = params.id as string
  const chatEndRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [deal, setDeal] = useState<Deal | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [sending, setSending] = useState(false)
  const [uploading, setUploading] = useState(false)

  const [messageContent, setMessageContent] = useState('')
  const [selectedFile, setSelectedFile] = useState<File | null>(null)

  const [contacts, setContacts] = useState<any[]>([])
  const [managers, setManagers] = useState<any[]>([])

  const [editData, setEditData] = useState({
    title: '',
    amount: 0,
    stage: '',
    description: '',
    contactId: '',
    managerId: ''
  })

  const stages = [
    { id: 'NEW', name: 'Новые' },
    { id: 'CONTACTED', name: 'Контакт' },
    { id: 'MEETING', name: 'Встреча' },
    { id: 'PROPOSAL', name: 'Предложение' },
    { id: 'NEGOTIATION', name: 'Переговоры' },
    { id: 'WON', name: 'Выиграно' },
    { id: 'LOST', name: 'Проиграно' }
  ]

  useEffect(() => {
    fetchDeal()
    fetchMessages()
    fetchContacts()
    fetchManagers()
  }, [dealId])

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const scrollToBottom = () => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  const fetchDeal = async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/deals/${dealId}`)
      if (res.ok) {
        const data = await res.json()
        setDeal(data.deal)
        setEditData({
          title: data.deal.title,
          amount: data.deal.amount,
          stage: data.deal.stage,
          description: data.deal.description || '',
          contactId: data.deal.contact?.id || '',
          managerId: data.deal.manager?.id || ''
        })
      }
    } catch (error) {
      console.error('Error fetching deal:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchMessages = async () => {
    try {
      const res = await fetch(`/api/deals/${dealId}/messages`)
      if (res.ok) {
        const data = await res.json()
        setMessages(data.messages || [])
      }
    } catch (error) {
      console.error('Error fetching messages:', error)
    }
  }

  const fetchContacts = async () => {
    try {
      const res = await fetch('/api/contacts')
      if (res.ok) {
        const data = await res.json()
        setContacts(data.contacts || [])
      }
    } catch (error) {
      console.error('Error fetching contacts:', error)
    }
  }

  const fetchManagers = async () => {
    try {
      const res = await fetch('/api/users')
      if (res.ok) {
        const data = await res.json()
        setManagers(data.users || [])
      }
    } catch (error) {
      console.error('Error fetching managers:', error)
    }
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const res = await fetch(`/api/deals/${dealId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editData)
      })

      if (res.ok) {
        await fetchDeal()
        setEditing(false)
      }
    } catch (error) {
      console.error('Error updating deal:', error)
    } finally {
      setSaving(false)
    }
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setSelectedFile(file)
    }
  }

  const handleSendMessage = async () => {
    if (!messageContent.trim() && !selectedFile) return
    if (!deal?.contact?.telegramId) {
      alert('У этого контакта нет Telegram ID')
      return
    }

    setSending(true)
    try {
      if (selectedFile) {
        // Отправка файла
        const formData = new FormData()
        formData.append('file', selectedFile)
        if (messageContent.trim()) {
          formData.append('caption', messageContent)
        }

        const res = await fetch(`/api/deals/${dealId}/messages`, {
          method: 'POST',
          body: formData
        })

        if (res.ok) {
          setMessageContent('')
          setSelectedFile(null)
          if (fileInputRef.current) {
            fileInputRef.current.value = ''
          }
          await fetchMessages()
        } else {
          alert('Ошибка при отправке файла')
        }
      } else {
        // Отправка текстового сообщения
        const res = await fetch(`/api/deals/${dealId}/messages`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            text: messageContent
          })
        })

        if (res.ok) {
          setMessageContent('')
          await fetchMessages()
        } else {
          alert('Ошибка при отправке сообщения')
        }
      }
    } catch (error) {
      console.error('Error sending message:', error)
      alert('Ошибка при отправке')
    } finally {
      setSending(false)
    }
  }

  const handleDeleteDeal = async () => {
    if (!confirm('Вы уверены, что хотите удалить эту сделку?')) return

    try {
      const res = await fetch(`/api/deals/${dealId}`, {
        method: 'DELETE'
      })

      if (res.ok) {
        router.push('/dashboard/deals')
      }
    } catch (error) {
      console.error('Error deleting deal:', error)
    }
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('ru-RU', {
      style: 'currency',
      currency: 'RUB',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount)
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('ru-RU', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return ''
    const kb = bytes / 1024
    if (kb < 1024) return `${kb.toFixed(1)} KB`
    return `${(kb / 1024).toFixed(1)} MB`
  }

  const getFileIcon = (mimeType?: string, type?: string) => {
    if (type === 'PHOTO' || mimeType?.startsWith('image/')) {
      return <ImageIcon className="w-5 h-5" />
    }
    if (type === 'VOICE' || type === 'AUDIO' || mimeType?.startsWith('audio/')) {
      return <Mic className="w-5 h-5" />
    }
    if (type === 'VIDEO' || mimeType?.startsWith('video/')) {
      return <Video className="w-5 h-5" />
    }
    return <FileText className="w-5 h-5" />
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!deal) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-gray-500">Сделка не найдена</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={() => router.push('/dashboard/deals')}
            className="p-2 hover:bg-gray-100 rounded-lg transition"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{deal.title}</h1>
            <p className="text-gray-500 mt-1">ID: {deal.id}</p>
          </div>
        </div>
        <div className="flex gap-3">
          {editing ? (
            <>
              <button
                onClick={() => setEditing(false)}
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-xl font-medium hover:bg-gray-200 transition flex items-center gap-2"
              >
                <X className="w-5 h-5" />
                Отмена
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-4 py-2 bg-indigo-600 text-white rounded-xl font-medium hover:bg-indigo-700 transition flex items-center gap-2 disabled:opacity-50"
              >
                <Save className="w-5 h-5" />
                {saving ? 'Сохранение...' : 'Сохранить'}
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => setEditing(true)}
                className="px-4 py-2 bg-indigo-600 text-white rounded-xl font-medium hover:bg-indigo-700 transition flex items-center gap-2"
              >
                <Edit className="w-5 h-5" />
                Редактировать
              </button>
              <button
                onClick={handleDeleteDeal}
                className="px-4 py-2 bg-red-600 text-white rounded-xl font-medium hover:bg-red-700 transition flex items-center gap-2"
              >
                <Trash2 className="w-5 h-5" />
                Удалить
              </button>
            </>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Panel - Deal Info */}
        <div className="lg:col-span-1 bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          {editing ? (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Название *
                </label>
                <input
                  type="text"
                  value={editData.title}
                  onChange={(e) => setEditData({ ...editData, title: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Сумма *
                </label>
                <input
                  type="number"
                  value={editData.amount}
                  onChange={(e) => setEditData({ ...editData, amount: Number(e.target.value) })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Этап
                </label>
                <select
                  value={editData.stage}
                  onChange={(e) => setEditData({ ...editData, stage: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                >
                  {stages.map(stage => (
                    <option key={stage.id} value={stage.id}>{stage.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Контакт
                </label>
                <select
                  value={editData.contactId}
                  onChange={(e) => setEditData({ ...editData, contactId: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                >
                  <option value="">Не выбран</option>
                  {contacts.map(contact => (
                    <option key={contact.id} value={contact.id}>{contact.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Менеджер
                </label>
                <select
                  value={editData.managerId}
                  onChange={(e) => setEditData({ ...editData, managerId: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                >
                  <option value="">Не назначен</option>
                  {managers.map(manager => (
                    <option key={manager.id} value={manager.id}>{manager.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Описание
                </label>
                <textarea
                  value={editData.description}
                  onChange={(e) => setEditData({ ...editData, description: e.target.value })}
                  rows={4}
                  className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  placeholder="Детали сделки..."
                />
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              <div>
                <p className="text-sm text-gray-500 mb-2">Сумма сделки</p>
                <p className="text-3xl font-bold text-green-600">{formatCurrency(deal.amount)}</p>
              </div>

              <div>
                <p className="text-sm text-gray-500 mb-1">Этап</p>
                <p className="font-medium text-gray-900">
                  {stages.find(s => s.id === deal.stage)?.name}
                </p>
              </div>

              {deal.contact && (
                <div>
                  <div className="flex items-center gap-2 text-sm text-gray-500 mb-2">
                    <User className="w-4 h-4" />
                    <span>Контакт</span>
                  </div>
                  <p className="font-medium text-gray-900">{deal.contact.name}</p>
                  {deal.contact.phone && (
                    <p className="text-sm text-gray-600 mt-1">{deal.contact.phone}</p>
                  )}
                  {deal.contact.telegramUsername && (
                    <p className="text-sm text-indigo-600 mt-1">@{deal.contact.telegramUsername}</p>
                  )}
                </div>
              )}

              {deal.manager && (
                <div>
                  <p className="text-sm text-gray-500 mb-1">Менеджер</p>
                  <p className="font-medium text-gray-900">{deal.manager.name}</p>
                </div>
              )}

              {deal.description && (
                <div>
                  <p className="text-sm text-gray-500 mb-2">Описание</p>
                  <p className="text-gray-700 text-sm">{deal.description}</p>
                </div>
              )}

              <div className="pt-4 border-t border-gray-100">
                <div className="flex items-center gap-2 text-sm text-gray-500 mb-2">
                  <Calendar className="w-4 h-4" />
                  <span>Создано</span>
                </div>
                <p className="text-sm text-gray-900">{formatDate(deal.createdAt)}</p>
              </div>
            </div>
          )}
        </div>

        {/* Right Panel - Telegram Chat */}
        <div className="lg:col-span-2 bg-white rounded-2xl shadow-sm border border-gray-100 flex flex-col" style={{ height: '700px' }}>
          {/* Chat Header */}
          <div className="p-6 border-b border-gray-100">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-indigo-100 rounded-lg">
                <MessageCircle className="w-5 h-5 text-indigo-600" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-gray-900">Telegram чат</h2>
                {deal.contact?.telegramUsername && (
                  <p className="text-sm text-gray-500">@{deal.contact.telegramUsername}</p>
                )}
              </div>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-6 space-y-4">
            {!deal.contact?.telegramId ? (
              <div className="flex items-center justify-center h-full text-gray-500">
                <p>У этого контакта нет Telegram ID</p>
              </div>
            ) : messages.length === 0 ? (
              <div className="flex items-center justify-center h-full text-gray-500">
                <p>Пока нет сообщений</p>
              </div>
            ) : (
              messages.map((message) => (
                <div
                  key={message.id}
                  className={`flex flex-col ${
                    message.direction === 'OUT' ? 'items-end' : 'items-start'
                  }`}
                >
                  <div
                    className={`max-w-[70%] rounded-2xl px-4 py-3 ${
                      message.direction === 'OUT'
                        ? 'bg-indigo-600 text-white'
                        : 'bg-gray-100 text-gray-900'
                    }`}
                  >
                    {/* Attachments */}
                    {message.attachments && message.attachments.length > 0 && (
                      <div className="mb-2 space-y-2">
                        {message.attachments.map((attachment) => (
                          <div key={attachment.id}>
                            {/* Image attachments */}
                            {(message.type === 'PHOTO' || attachment.mimeType?.startsWith('image/')) && (
                              <img
                                src={attachment.url}
                                alt={attachment.filename}
                                className="rounded-lg max-w-full"
                                style={{ maxHeight: '300px' }}
                              />
                            )}

                            {/* Audio player */}
                            {(message.type === 'VOICE' || message.type === 'AUDIO' || attachment.mimeType?.startsWith('audio/')) && (
                              <audio controls className="w-full">
                                <source src={attachment.url} type={attachment.mimeType || 'audio/mpeg'} />
                              </audio>
                            )}

                            {/* Video player */}
                            {(message.type === 'VIDEO' || message.type === 'VIDEO_NOTE' || attachment.mimeType?.startsWith('video/')) && (
                              <video controls className="rounded-lg max-w-full" style={{ maxHeight: '300px' }}>
                                <source src={attachment.url} type={attachment.mimeType || 'video/mp4'} />
                              </video>
                            )}

                            {/* Document download */}
                            {message.type === 'DOCUMENT' && !attachment.mimeType?.startsWith('image/') && !attachment.mimeType?.startsWith('audio/') && !attachment.mimeType?.startsWith('video/') && (
                              <a
                                href={attachment.url}
                                download={attachment.filename}
                                className={`flex items-center gap-2 p-3 rounded-lg ${
                                  message.direction === 'OUT'
                                    ? 'bg-indigo-500'
                                    : 'bg-gray-200'
                                }`}
                              >
                                {getFileIcon(attachment.mimeType, message.type)}
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-medium truncate">{attachment.filename}</p>
                                  {attachment.size && (
                                    <p className="text-xs opacity-75">{formatFileSize(attachment.size)}</p>
                                  )}
                                </div>
                                <Download className="w-4 h-4" />
                              </a>
                            )}
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Text content */}
                    <p className="text-sm whitespace-pre-wrap">{message.content}</p>

                    <p className={`text-xs mt-2 ${
                      message.direction === 'OUT' ? 'text-indigo-200' : 'text-gray-500'
                    }`}>
                      {formatDate(message.createdAt)}
                      {message.direction === 'OUT' && message.manager && ` • ${message.manager.name}`}
                    </p>
                  </div>
                </div>
              ))
            )}
            <div ref={chatEndRef} />
          </div>

          {/* Message Input */}
          {deal.contact?.telegramId && (
            <div className="p-6 border-t border-gray-100">
              {selectedFile && (
                <div className="mb-3 p-3 bg-gray-50 rounded-lg flex items-center gap-3">
                  {getFileIcon(selectedFile.type)}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{selectedFile.name}</p>
                    <p className="text-xs text-gray-500">{formatFileSize(selectedFile.size)}</p>
                  </div>
                  <button
                    onClick={() => {
                      setSelectedFile(null)
                      if (fileInputRef.current) {
                        fileInputRef.current.value = ''
                      }
                    }}
                    className="p-1 hover:bg-gray-200 rounded"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}

              <div className="flex gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  onChange={handleFileSelect}
                  className="hidden"
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={sending}
                  className="p-3 bg-gray-100 hover:bg-gray-200 rounded-xl transition disabled:opacity-50"
                >
                  <Paperclip className="w-5 h-5 text-gray-600" />
                </button>
                <input
                  type="text"
                  value={messageContent}
                  onChange={(e) => setMessageContent(e.target.value)}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault()
                      handleSendMessage()
                    }
                  }}
                  placeholder={selectedFile ? "Добавить подпись к файлу..." : "Написать сообщение..."}
                  disabled={sending}
                  className="flex-1 px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent disabled:opacity-50"
                />
                <button
                  onClick={handleSendMessage}
                  disabled={sending || (!messageContent.trim() && !selectedFile)}
                  className="px-6 py-3 bg-indigo-600 text-white rounded-xl font-medium hover:bg-indigo-700 transition flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Send className="w-5 h-5" />
                  {sending ? 'Отправка...' : 'Отправить'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
