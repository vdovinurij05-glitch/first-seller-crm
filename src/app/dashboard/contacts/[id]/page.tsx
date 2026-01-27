'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import {
  ArrowLeft,
  Phone,
  Mail,
  MessageCircle,
  Calendar,
  Edit,
  Trash2,
  Save,
  X,
  PhoneCall,
  MessageSquare,
  DollarSign,
  User
} from 'lucide-react'

interface Contact {
  id: string
  name: string
  phone?: string
  email?: string
  telegramId?: string
  telegramUsername?: string
  source?: string
  status: string
  notes?: string
  createdAt: string
  updatedAt: string
  manager?: {
    id: string
    name: string
  }
  messages: Array<{
    id: string
    content: string
    direction: string
    createdAt: string
  }>
  calls: Array<{
    id: string
    direction: string
    phone: string
    status: string
    duration?: number
    createdAt: string
  }>
  deals: Array<{
    id: string
    title: string
    amount: number
    stage: string
    createdAt: string
  }>
}

export default function ContactDetailPage() {
  const router = useRouter()
  const params = useParams()
  const contactId = params.id as string

  const [contact, setContact] = useState<Contact | null>(null)
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)

  const [editData, setEditData] = useState({
    name: '',
    phone: '',
    email: '',
    telegramUsername: '',
    status: '',
    notes: ''
  })

  useEffect(() => {
    fetchContact()
  }, [contactId])

  const fetchContact = async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/contacts/${contactId}`)
      if (res.ok) {
        const data = await res.json()
        setContact(data.contact)
        setEditData({
          name: data.contact.name,
          phone: data.contact.phone || '',
          email: data.contact.email || '',
          telegramUsername: data.contact.telegramUsername || '',
          status: data.contact.status,
          notes: data.contact.notes || ''
        })
      } else {
        router.push('/dashboard/contacts')
      }
    } catch (error) {
      console.error('Error fetching contact:', error)
      router.push('/dashboard/contacts')
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const res = await fetch(`/api/contacts/${contactId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editData)
      })

      if (res.ok) {
        await fetchContact()
        setEditing(false)
      }
    } catch (error) {
      console.error('Error updating contact:', error)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!confirm('Вы уверены, что хотите удалить этот контакт?')) return

    try {
      const res = await fetch(`/api/contacts/${contactId}`, {
        method: 'DELETE'
      })

      if (res.ok) {
        router.push('/dashboard/contacts')
      }
    } catch (error) {
      console.error('Error deleting contact:', error)
    }
  }

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      NEW: 'bg-blue-100 text-blue-700',
      IN_PROGRESS: 'bg-yellow-100 text-yellow-700',
      QUALIFIED: 'bg-purple-100 text-purple-700',
      CONVERTED: 'bg-green-100 text-green-700',
      LOST: 'bg-red-100 text-red-700'
    }
    return colors[status] || 'bg-gray-100 text-gray-700'
  }

  const getStatusName = (status: string) => {
    const names: Record<string, string> = {
      NEW: 'Новый',
      IN_PROGRESS: 'В работе',
      QUALIFIED: 'Квалифицирован',
      CONVERTED: 'Конвертирован',
      LOST: 'Потерян'
    }
    return names[status] || status
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

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!contact) {
    return null
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={() => router.push('/dashboard/contacts')}
            className="p-2 hover:bg-gray-100 rounded-xl transition"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{contact.name}</h1>
            <p className="text-gray-500 mt-1">
              Создан {formatDate(contact.createdAt)}
            </p>
          </div>
        </div>

        <div className="flex gap-3">
          {!editing ? (
            <>
              <button
                onClick={() => setEditing(true)}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-xl font-medium hover:bg-gray-50 transition flex items-center gap-2"
              >
                <Edit className="w-5 h-5" />
                Редактировать
              </button>
              <button
                onClick={handleDelete}
                className="px-4 py-2 border border-red-300 text-red-700 rounded-xl font-medium hover:bg-red-50 transition flex items-center gap-2"
              >
                <Trash2 className="w-5 h-5" />
                Удалить
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => setEditing(false)}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-xl font-medium hover:bg-gray-50 transition flex items-center gap-2"
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
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Info */}
        <div className="lg:col-span-2 space-y-6">
          {/* Contact Info Card */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            <h2 className="text-lg font-bold text-gray-900 mb-4">Контактная информация</h2>

            {editing ? (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Имя
                  </label>
                  <input
                    type="text"
                    value={editData.name}
                    onChange={(e) => setEditData({ ...editData, name: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Телефон
                    </label>
                    <input
                      type="tel"
                      value={editData.phone}
                      onChange={(e) => setEditData({ ...editData, phone: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Email
                    </label>
                    <input
                      type="email"
                      value={editData.email}
                      onChange={(e) => setEditData({ ...editData, email: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Telegram
                    </label>
                    <input
                      type="text"
                      value={editData.telegramUsername}
                      onChange={(e) => setEditData({ ...editData, telegramUsername: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Статус
                    </label>
                    <select
                      value={editData.status}
                      onChange={(e) => setEditData({ ...editData, status: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    >
                      <option value="NEW">Новый</option>
                      <option value="IN_PROGRESS">В работе</option>
                      <option value="QUALIFIED">Квалифицирован</option>
                      <option value="CONVERTED">Конвертирован</option>
                      <option value="LOST">Потерян</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Заметки
                  </label>
                  <textarea
                    value={editData.notes}
                    onChange={(e) => setEditData({ ...editData, notes: e.target.value })}
                    rows={4}
                    className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  />
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {contact.phone && (
                  <div className="flex items-center gap-3">
                    <Phone className="w-5 h-5 text-gray-400" />
                    <a
                      href={`tel:${contact.phone}`}
                      className="text-indigo-600 hover:text-indigo-800 font-medium"
                    >
                      {contact.phone}
                    </a>
                  </div>
                )}

                {contact.email && (
                  <div className="flex items-center gap-3">
                    <Mail className="w-5 h-5 text-gray-400" />
                    <a
                      href={`mailto:${contact.email}`}
                      className="text-indigo-600 hover:text-indigo-800"
                    >
                      {contact.email}
                    </a>
                  </div>
                )}

                {contact.telegramUsername && (
                  <div className="flex items-center gap-3">
                    <MessageCircle className="w-5 h-5 text-gray-400" />
                    <a
                      href={`https://t.me/${contact.telegramUsername}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-indigo-600 hover:text-indigo-800"
                    >
                      @{contact.telegramUsername}
                    </a>
                  </div>
                )}

                <div className="flex items-center gap-3">
                  <Calendar className="w-5 h-5 text-gray-400" />
                  <span className="text-gray-600">
                    Создан: {formatDate(contact.createdAt)}
                  </span>
                </div>

                {contact.notes && (
                  <div className="mt-4 pt-4 border-t border-gray-200">
                    <p className="text-sm font-medium text-gray-700 mb-2">Заметки</p>
                    <p className="text-gray-600">{contact.notes}</p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Activity Timeline */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            <h2 className="text-lg font-bold text-gray-900 mb-4">История активности</h2>

            <div className="space-y-4">
              {/* Messages */}
              {contact.messages && contact.messages.length > 0 && (
                <div>
                  <h3 className="text-sm font-medium text-gray-700 mb-3 flex items-center gap-2">
                    <MessageSquare className="w-4 h-4" />
                    Сообщения ({contact.messages.length})
                  </h3>
                  <div className="space-y-2">
                    {contact.messages.slice(0, 5).map((message) => (
                      <div key={message.id} className="bg-gray-50 rounded-lg p-3">
                        <div className="flex items-center justify-between mb-1">
                          <span className={`text-xs font-medium ${message.direction === 'IN' ? 'text-blue-600' : 'text-green-600'}`}>
                            {message.direction === 'IN' ? 'Входящее' : 'Исходящее'}
                          </span>
                          <span className="text-xs text-gray-500">
                            {formatDate(message.createdAt)}
                          </span>
                        </div>
                        <p className="text-sm text-gray-700">{message.content}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Calls */}
              {contact.calls && contact.calls.length > 0 && (
                <div>
                  <h3 className="text-sm font-medium text-gray-700 mb-3 flex items-center gap-2">
                    <PhoneCall className="w-4 h-4" />
                    Звонки ({contact.calls.length})
                  </h3>
                  <div className="space-y-2">
                    {contact.calls.slice(0, 5).map((call) => (
                      <div key={call.id} className="bg-gray-50 rounded-lg p-3">
                        <div className="flex items-center justify-between">
                          <div>
                            <span className={`text-xs font-medium ${call.direction === 'IN' ? 'text-blue-600' : 'text-green-600'}`}>
                              {call.direction === 'IN' ? 'Входящий' : 'Исходящий'}
                            </span>
                            <span className="text-xs text-gray-500 ml-2">
                              {call.status}
                            </span>
                            {call.duration && (
                              <span className="text-xs text-gray-500 ml-2">
                                {Math.floor(call.duration / 60)}:{(call.duration % 60).toString().padStart(2, '0')}
                              </span>
                            )}
                          </div>
                          <span className="text-xs text-gray-500">
                            {formatDate(call.createdAt)}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Status Card */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            <h3 className="text-sm font-medium text-gray-700 mb-3">Статус</h3>
            <span className={`inline-flex px-3 py-1 text-sm font-medium rounded-full ${getStatusColor(contact.status)}`}>
              {getStatusName(contact.status)}
            </span>

            {contact.source && (
              <div className="mt-4 pt-4 border-t border-gray-200">
                <h3 className="text-sm font-medium text-gray-700 mb-2">Источник</h3>
                <p className="text-sm text-gray-600">{contact.source}</p>
              </div>
            )}

            {contact.manager && (
              <div className="mt-4 pt-4 border-t border-gray-200">
                <h3 className="text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                  <User className="w-4 h-4" />
                  Менеджер
                </h3>
                <p className="text-sm text-gray-600">{contact.manager.name}</p>
              </div>
            )}
          </div>

          {/* Deals Card */}
          {contact.deals && contact.deals.length > 0 && (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
              <h3 className="text-sm font-medium text-gray-700 mb-3 flex items-center gap-2">
                <DollarSign className="w-4 h-4" />
                Сделки ({contact.deals.length})
              </h3>
              <div className="space-y-3">
                {contact.deals.map((deal) => (
                  <div key={deal.id} className="border border-gray-200 rounded-lg p-3">
                    <p className="font-medium text-gray-900 text-sm">{deal.title}</p>
                    <p className="text-sm text-gray-600 mt-1">
                      {new Intl.NumberFormat('ru-RU', {
                        style: 'currency',
                        currency: 'RUB',
                        minimumFractionDigits: 0
                      }).format(deal.amount)}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">{deal.stage}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Quick Actions */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            <h3 className="text-sm font-medium text-gray-700 mb-3">Быстрые действия</h3>
            <div className="space-y-2">
              {contact.phone && (
                <a
                  href={`tel:${contact.phone}`}
                  className="flex items-center gap-3 px-4 py-2 bg-indigo-50 text-indigo-600 rounded-xl hover:bg-indigo-100 transition"
                >
                  <Phone className="w-4 h-4" />
                  <span className="text-sm font-medium">Позвонить</span>
                </a>
              )}
              {contact.telegramUsername && (
                <a
                  href={`https://t.me/${contact.telegramUsername}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 px-4 py-2 bg-blue-50 text-blue-600 rounded-xl hover:bg-blue-100 transition"
                >
                  <MessageCircle className="w-4 h-4" />
                  <span className="text-sm font-medium">Написать в Telegram</span>
                </a>
              )}
              {contact.email && (
                <a
                  href={`mailto:${contact.email}`}
                  className="flex items-center gap-3 px-4 py-2 bg-purple-50 text-purple-600 rounded-xl hover:bg-purple-100 transition"
                >
                  <Mail className="w-4 h-4" />
                  <span className="text-sm font-medium">Написать Email</span>
                </a>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
