'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Plus, X } from 'lucide-react'
import Link from 'next/link'

interface Contact {
  id: string
  name: string
  phone?: string
}

interface Pipeline {
  id: string
  name: string
  slug: string
  stages: Array<{
    id: string
    name: string
    slug: string
  }>
}

export default function NewDealPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [contacts, setContacts] = useState<Contact[]>([])
  const [pipelines, setPipelines] = useState<Pipeline[]>([])

  // Быстрое создание контакта
  const [showContactModal, setShowContactModal] = useState(false)
  const [contactLoading, setContactLoading] = useState(false)
  const [newContact, setNewContact] = useState({
    name: '',
    phone: '',
    email: ''
  })

  const [formData, setFormData] = useState({
    title: '',
    amount: '',
    pipelineId: '',
    stage: '',
    contactId: '',
    description: ''
  })

  useEffect(() => {
    fetchContacts()
    fetchPipelines()
  }, [])

  const fetchContacts = async () => {
    try {
      const res = await fetch('/api/contacts?limit=100')
      const data = await res.json()
      setContacts(data.contacts || [])
    } catch (error) {
      console.error('Error fetching contacts:', error)
    }
  }

  const fetchPipelines = async () => {
    try {
      const res = await fetch('/api/pipelines')
      const data = await res.json()
      setPipelines(data.pipelines || [])

      // Устанавливаем первую воронку по умолчанию
      if (data.pipelines && data.pipelines.length > 0) {
        const defaultPipeline = data.pipelines.find((p: Pipeline) => p.slug === 'sales') || data.pipelines[0]
        setFormData(prev => ({
          ...prev,
          pipelineId: defaultPipeline.id,
          stage: defaultPipeline.stages[0]?.slug || 'NEW'
        }))
      }
    } catch (error) {
      console.error('Error fetching pipelines:', error)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      const res = await fetch('/api/deals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: formData.title,
          amount: parseInt(formData.amount),
          pipelineId: formData.pipelineId,
          stage: formData.stage,
          contactId: formData.contactId || null,
          description: formData.description || null
        })
      })

      if (res.ok) {
        const data = await res.json()
        // Перенаправляем в воронку где создали сделку
        const pipeline = pipelines.find(p => p.id === formData.pipelineId)
        if (pipeline) {
          router.push(`/dashboard/pipelines/${pipeline.slug}`)
        } else {
          router.push('/dashboard/pipelines')
        }
      } else {
        alert('Ошибка при создании сделки')
      }
    } catch (error) {
      console.error('Error creating deal:', error)
      alert('Ошибка при создании сделки')
    } finally {
      setLoading(false)
    }
  }

  const selectedPipeline = pipelines.find(p => p.id === formData.pipelineId)

  // Быстрое создание контакта
  const handleQuickCreateContact = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newContact.name.trim()) return

    setContactLoading(true)
    try {
      const res = await fetch('/api/contacts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newContact.name,
          phone: newContact.phone || null,
          email: newContact.email || null,
          source: 'manual'
        })
      })

      if (res.ok) {
        const contact = await res.json()
        // Добавляем новый контакт в список и выбираем его
        setContacts(prev => [...prev, contact])
        setFormData(prev => ({ ...prev, contactId: contact.id }))
        setShowContactModal(false)
        setNewContact({ name: '', phone: '', email: '' })
      } else {
        alert('Ошибка при создании контакта')
      }
    } catch (error) {
      console.error('Error creating contact:', error)
      alert('Ошибка при создании контакта')
    } finally {
      setContactLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link
          href="/dashboard/pipelines"
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <ArrowLeft className="w-6 h-6 text-gray-600" />
        </Link>
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Новая сделка</h1>
          <p className="text-gray-600 mt-1">Создайте новую сделку</p>
        </div>
      </div>

      {/* Form */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Воронка */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Воронка *
            </label>
            <select
              value={formData.pipelineId}
              onChange={(e) => {
                const pipeline = pipelines.find(p => p.id === e.target.value)
                setFormData({
                  ...formData,
                  pipelineId: e.target.value,
                  stage: pipeline?.stages[0]?.slug || 'NEW'
                })
              }}
              className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              required
            >
              <option value="">Выберите воронку</option>
              {pipelines.map((pipeline) => (
                <option key={pipeline.id} value={pipeline.id}>
                  {pipeline.name}
                </option>
              ))}
            </select>
          </div>

          {/* Этап */}
          {selectedPipeline && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Этап *
              </label>
              <select
                value={formData.stage}
                onChange={(e) => setFormData({ ...formData, stage: e.target.value })}
                className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                required
              >
                {selectedPipeline.stages.map((stage) => (
                  <option key={stage.id} value={stage.slug}>
                    {stage.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Название */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Название сделки *
            </label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              placeholder="Название сделки"
              required
            />
          </div>

          {/* Сумма */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Сумма (₽) *
            </label>
            <input
              type="number"
              value={formData.amount}
              onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
              className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              placeholder="100000"
              required
            />
          </div>

          {/* Контакт */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Контакт
            </label>
            <div className="flex gap-2">
              <select
                value={formData.contactId}
                onChange={(e) => setFormData({ ...formData, contactId: e.target.value })}
                className="flex-1 px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              >
                <option value="">Выберите контакт (необязательно)</option>
                {contacts.map((contact) => (
                  <option key={contact.id} value={contact.id}>
                    {contact.name}{contact.phone ? ` (${contact.phone})` : ''}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => setShowContactModal(true)}
                className="px-3 py-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition flex items-center gap-1"
                title="Быстрое создание контакта"
              >
                <Plus className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Описание */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Описание
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              rows={4}
              placeholder="Описание сделки (необязательно)"
            />
          </div>

          {/* Actions */}
          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={loading}
              className="px-6 py-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Создание...' : 'Создать сделку'}
            </button>
            <Link
              href="/dashboard/pipelines"
              className="px-6 py-2 border border-gray-200 text-gray-700 rounded-xl hover:bg-gray-50 transition"
            >
              Отмена
            </Link>
          </div>
        </form>
      </div>

      {/* Модальное окно быстрого создания контакта */}
      {showContactModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-md mx-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Быстрое создание контакта</h3>
              <button
                type="button"
                onClick={() => setShowContactModal(false)}
                className="p-1 hover:bg-gray-100 rounded-lg transition"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            <form onSubmit={handleQuickCreateContact} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Имя *
                </label>
                <input
                  type="text"
                  value={newContact.name}
                  onChange={(e) => setNewContact({ ...newContact, name: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  placeholder="Имя контакта"
                  required
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Телефон
                </label>
                <input
                  type="tel"
                  value={newContact.phone}
                  onChange={(e) => setNewContact({ ...newContact, phone: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  placeholder="+7 (999) 123-45-67"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Email
                </label>
                <input
                  type="email"
                  value={newContact.email}
                  onChange={(e) => setNewContact({ ...newContact, email: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  placeholder="email@example.com"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="submit"
                  disabled={contactLoading || !newContact.name.trim()}
                  className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {contactLoading ? 'Создание...' : 'Создать и выбрать'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowContactModal(false)}
                  className="px-4 py-2 border border-gray-200 text-gray-700 rounded-xl hover:bg-gray-50 transition"
                >
                  Отмена
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
