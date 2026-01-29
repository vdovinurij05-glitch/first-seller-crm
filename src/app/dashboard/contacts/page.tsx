'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Search, Filter, Upload, X, UserPlus, FileSpreadsheet, Mail, Phone as PhoneIcon, MessageCircle, Download } from 'lucide-react'

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
  manager?: { name: string }
  _count?: {
    messages: number
    calls: number
  }
}

export default function ContactsPage() {
  const router = useRouter()
  const [contacts, setContacts] = useState<Contact[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [showAddModal, setShowAddModal] = useState(false)
  const [showImportModal, setShowImportModal] = useState(false)
  const [importing, setImporting] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Форма добавления контакта
  const [newContact, setNewContact] = useState({
    name: '',
    phone: '',
    email: '',
    telegramUsername: '',
    notes: '',
    status: 'NEW'
  })

  const statuses = [
    { id: 'all', name: 'Все' },
    { id: 'NEW', name: 'Новый' },
    { id: 'IN_PROGRESS', name: 'В работе' },
    { id: 'QUALIFIED', name: 'Квалифицирован' },
    { id: 'CONVERTED', name: 'Конвертирован' },
    { id: 'LOST', name: 'Потерян' }
  ]

  useEffect(() => {
    fetchContacts()
  }, [statusFilter])

  const fetchContacts = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (statusFilter !== 'all') params.append('status', statusFilter)

      const res = await fetch(`/api/contacts?${params.toString()}`)
      const data = await res.json()
      setContacts(data.contacts || [])
    } catch (error) {
      console.error('Error fetching contacts:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleAddContact = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const res = await fetch('/api/contacts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newContact)
      })

      if (res.ok) {
        setShowAddModal(false)
        setNewContact({ name: '', phone: '', email: '', telegramUsername: '', notes: '', status: 'NEW' })
        fetchContacts()
      }
    } catch (error) {
      console.error('Error adding contact:', error)
    }
  }

  const handleFileImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const formData = new FormData()
    formData.append('file', file)

    setImporting(true)
    try {
      const res = await fetch('/api/contacts/import', {
        method: 'POST',
        body: formData
      })

      const data = await res.json()

      if (res.ok) {
        alert(`Успешно импортировано: ${data.imported} контактов`)
        setShowImportModal(false)
        fetchContacts()
      } else {
        alert(`Ошибка: ${data.error}`)
      }
    } catch (error) {
      console.error('Error importing contacts:', error)
      alert('Ошибка при импорте файла')
    } finally {
      setImporting(false)
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  const handleContactClick = (contactId: string) => {
    router.push(`/dashboard/contacts/${contactId}`)
  }

  // Скачивание шаблона CSV
  const downloadTemplate = () => {
    const headers = 'Имя,Email,Телефон,Комментарий'
    const csvContent = headers

    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'contacts_template.csv'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  const handlePhoneClick = (e: React.MouseEvent, phone: string) => {
    e.stopPropagation()
    // Телефон уже кликабельный через tel: ссылку
  }

  const handleTelegramClick = (e: React.MouseEvent, username: string) => {
    e.stopPropagation()
    // Telegram уже кликабельный через https://t.me/ ссылку
  }

  const filteredContacts = contacts.filter(contact =>
    contact.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    contact.phone?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    contact.email?.toLowerCase().includes(searchQuery.toLowerCase())
  )

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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Контакты</h1>
          <p className="text-gray-500 mt-1">Управление базой клиентов</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => setShowImportModal(true)}
            className="px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-xl font-medium hover:bg-gray-50 transition flex items-center gap-2"
          >
            <Upload className="w-5 h-5" />
            Импорт
          </button>
          <button
            onClick={() => setShowAddModal(true)}
            className="px-4 py-2 bg-indigo-600 text-white rounded-xl font-medium hover:bg-indigo-700 transition flex items-center gap-2"
          >
            <Plus className="w-5 h-5" />
            Добавить контакт
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Поиск по имени, телефону, email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
          </div>
          <div className="flex gap-2 overflow-x-auto">
            {statuses.map((status) => (
              <button
                key={status.id}
                onClick={() => setStatusFilter(status.id)}
                className={`px-4 py-2 rounded-xl font-medium transition whitespace-nowrap ${
                  statusFilter === status.id
                    ? 'bg-indigo-600 text-white'
                    : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
                }`}
              >
                {status.name}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Contacts Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Имя
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Телефон
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Email
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Telegram
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Статус
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Источник
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Менеджер
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Активность
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td colSpan={8} className="px-6 py-8 text-center text-gray-500">
                    Загрузка...
                  </td>
                </tr>
              ) : filteredContacts.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-8 text-center text-gray-500">
                    Контакты не найдены
                  </td>
                </tr>
              ) : (
                filteredContacts.map((contact) => (
                  <tr
                    key={contact.id}
                    onClick={() => handleContactClick(contact.id)}
                    className="hover:bg-gray-50 transition cursor-pointer"
                  >
                    <td className="px-6 py-4">
                      <p className="font-medium text-gray-900">{contact.name}</p>
                    </td>
                    <td className="px-6 py-4">
                      {contact.phone ? (
                        <a
                          href={`tel:${contact.phone}`}
                          onClick={(e) => handlePhoneClick(e, contact.phone!)}
                          className="flex items-center gap-2 text-indigo-600 hover:text-indigo-800 font-medium"
                        >
                          <PhoneIcon className="w-4 h-4" />
                          {contact.phone}
                        </a>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      {contact.email ? (
                        <a
                          href={`mailto:${contact.email}`}
                          onClick={(e) => e.stopPropagation()}
                          className="flex items-center gap-2 text-indigo-600 hover:text-indigo-800"
                        >
                          <Mail className="w-4 h-4" />
                          {contact.email}
                        </a>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      {contact.telegramUsername ? (
                        <a
                          href={`https://t.me/${contact.telegramUsername}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => handleTelegramClick(e, contact.telegramUsername!)}
                          className="flex items-center gap-2 text-indigo-600 hover:text-indigo-800 font-medium"
                        >
                          <MessageCircle className="w-4 h-4" />
                          @{contact.telegramUsername}
                        </a>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(contact.status)}`}>
                        {getStatusName(contact.status)}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm text-gray-600">
                        {contact.source || '—'}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm text-gray-600">
                        {contact.manager?.name || 'Не назначен'}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3 text-sm text-gray-600">
                        <span>{contact._count?.messages || 0} сообщ.</span>
                        <span>{contact._count?.calls || 0} звонков</span>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Contact Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-gray-900">Добавить контакт</h2>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <form onSubmit={handleAddContact} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Имя *
                  </label>
                  <input
                    type="text"
                    required
                    value={newContact.name}
                    onChange={(e) => setNewContact({ ...newContact, name: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    placeholder="Иван Иванов"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Телефон
                  </label>
                  <input
                    type="tel"
                    value={newContact.phone}
                    onChange={(e) => setNewContact({ ...newContact, phone: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    placeholder="+7 999 123-45-67"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Email
                  </label>
                  <input
                    type="email"
                    value={newContact.email}
                    onChange={(e) => setNewContact({ ...newContact, email: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    placeholder="example@mail.com"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Telegram (username)
                  </label>
                  <input
                    type="text"
                    value={newContact.telegramUsername}
                    onChange={(e) => setNewContact({ ...newContact, telegramUsername: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    placeholder="username"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Статус
                  </label>
                  <select
                    value={newContact.status}
                    onChange={(e) => setNewContact({ ...newContact, status: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  >
                    <option value="NEW">Новый</option>
                    <option value="IN_PROGRESS">В работе</option>
                    <option value="QUALIFIED">Квалифицирован</option>
                    <option value="CONVERTED">Конвертирован</option>
                    <option value="LOST">Потерян</option>
                  </select>
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Заметки
                  </label>
                  <textarea
                    value={newContact.notes}
                    onChange={(e) => setNewContact({ ...newContact, notes: e.target.value })}
                    rows={3}
                    className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    placeholder="Дополнительная информация о контакте..."
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 mt-6">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 border border-gray-300 text-gray-700 rounded-xl font-medium hover:bg-gray-50 transition"
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 text-white rounded-xl font-medium hover:bg-indigo-700 transition"
                >
                  Добавить
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Import Modal */}
      {showImportModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-gray-900">Импорт контактов</h2>
              <button
                onClick={() => setShowImportModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="space-y-4">
              <p className="text-sm text-gray-600">
                Загрузите файл CSV или Excel с контактами. Файл должен содержать 4 колонки: Имя, Email, Телефон, Комментарий
              </p>

              {/* Кнопка скачивания шаблона */}
              <button
                onClick={downloadTemplate}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-green-50 border border-green-200 text-green-700 rounded-xl font-medium hover:bg-green-100 transition"
              >
                <Download className="w-5 h-5" />
                Скачать шаблон CSV
              </button>

              <div className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center">
                <FileSpreadsheet className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,.xls,.xlsx"
                  onChange={handleFileImport}
                  className="hidden"
                  id="file-upload"
                />
                <label
                  htmlFor="file-upload"
                  className="cursor-pointer"
                >
                  <span className="text-indigo-600 font-medium hover:text-indigo-700">
                    Выберите файл
                  </span>
                  <span className="text-gray-600"> или перетащите сюда</span>
                </label>
                <p className="text-xs text-gray-500 mt-2">CSV, XLS, XLSX до 10MB</p>
              </div>

              {importing && (
                <div className="flex items-center justify-center gap-3 text-indigo-600">
                  <div className="w-5 h-5 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
                  <span>Импортируем контакты...</span>
                </div>
              )}

              <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                <p className="text-sm text-blue-800 font-medium mb-2">Формат файла:</p>
                <pre className="text-xs text-blue-900 bg-white p-2 rounded overflow-x-auto">
Имя,Email,Телефон,Комментарий{'\n'}
Иван Иванов,ivan@mail.ru,+79991234567,Клиент из рекламы
                </pre>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
