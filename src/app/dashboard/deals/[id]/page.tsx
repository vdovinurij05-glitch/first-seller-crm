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
  Mic,
  Activity,
  CheckCircle2,
  Bell,
  Phone,
  Clock,
  Check,
  Search,
  ChevronDown,
  Play,
  Pause,
  Volume2
} from 'lucide-react'
import TaskModal from '@/components/tasks/TaskModal'

interface Deal {
  id: string
  title: string
  amount: number
  stage: string
  probability: number
  description?: string
  closedAt?: string
  createdAt: string
  pipelineId?: string
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

interface Comment {
  id: string
  content: string
  type: string  // 'COMMENT' | 'SYSTEM_EVENT' | 'TELEGRAM_MESSAGE'
  eventType?: string  // 'STAGE_CHANGED' | 'CALL_INCOMING' | etc
  metadata?: string
  createdAt: string
  user?: {
    id: string
    name: string
    avatar?: string
  }
}

interface Task {
  id: string
  title: string
  description?: string
  type: string
  status: string
  dueDate: string
  reminderSent: boolean
  completedAt?: string
  createdAt: string
}

type ActivityItem = (Message | Comment) & {
  itemType: 'message' | 'comment'
}

export default function DealDetailPage() {
  const router = useRouter()
  const params = useParams()
  const dealId = params.id as string
  const chatEndRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [deal, setDeal] = useState<Deal | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [comments, setComments] = useState<Comment[]>([])
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [sending, setSending] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [showTaskModal, setShowTaskModal] = useState(false)

  const [inputMode, setInputMode] = useState<'message' | 'comment'>('comment')
  const [messageContent, setMessageContent] = useState('')
  const [selectedFile, setSelectedFile] = useState<File | null>(null)

  const [contacts, setContacts] = useState<any[]>([])
  const [managers, setManagers] = useState<any[]>([])
  const [pipelines, setPipelines] = useState<any[]>([])

  const [editData, setEditData] = useState({
    title: '',
    amount: 0,
    stage: '',
    pipelineId: '',
    description: '',
    contactId: '',
    managerId: ''
  })

  const [contactSearch, setContactSearch] = useState('')
  const [contactDropdownOpen, setContactDropdownOpen] = useState(false)
  const contactDropdownRef = useRef<HTMLDivElement>(null)

  // Audio player state for call recordings
  const [playingCommentId, setPlayingCommentId] = useState<string | null>(null)
  const [audioUrl, setAudioUrl] = useState<string | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [audioDuration, setAudioDuration] = useState(0)
  const [audioLoading, setAudioLoading] = useState(false)
  const audioRef = useRef<HTMLAudioElement>(null)

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
    fetchContacts()
    fetchManagers()
    fetchPipelines()

    if (dealId !== 'new') {
      fetchDeal()
      fetchMessages()
      fetchComments()
      fetchTasks()
    } else {
      // Для новой сделки устанавливаем режим редактирования
      setEditing(true)
      setLoading(false)
      setEditData({
        title: '',
        amount: 0,
        stage: 'NEW',
        pipelineId: '',
        description: '',
        contactId: '',
        managerId: ''
      })
    }
  }, [dealId])

  useEffect(() => {
    scrollToBottom()
  }, [messages, comments])

  // Закрытие dropdown при клике вне его
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (contactDropdownRef.current && !contactDropdownRef.current.contains(event.target as Node)) {
        setContactDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

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
          pipelineId: data.deal.pipelineId || '',
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

  const fetchPipelines = async () => {
    try {
      const res = await fetch('/api/pipelines')
      const data = await res.json()
      setPipelines(data.pipelines || [])
    } catch (error) {
      console.error('Error fetching pipelines:', error)
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

  const fetchComments = async () => {
    try {
      const res = await fetch(`/api/deals/${dealId}/comments`)
      if (res.ok) {
        const data = await res.json()
        setComments(data.comments || [])
      }
    } catch (error) {
      console.error('Error fetching comments:', error)
    }
  }

  const fetchTasks = async () => {
    try {
      const res = await fetch(`/api/tasks?dealId=${dealId}`)
      if (res.ok) {
        const data = await res.json()
        setTasks(data.tasks || [])
      }
    } catch (error) {
      console.error('Error fetching tasks:', error)
    }
  }

  const handleCompleteTask = async (taskId: string) => {
    try {
      const res = await fetch(`/api/tasks/${taskId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'COMPLETED' })
      })
      if (res.ok) {
        await fetchTasks()
        await fetchComments() // Обновляем комментарии чтобы увидеть системное событие
      }
    } catch (error) {
      console.error('Error completing task:', error)
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
    if (!editData.title.trim() || !editData.amount) {
      alert('Заполните обязательные поля: название и сумму')
      return
    }

    setSaving(true)
    try {
      if (dealId === 'new') {
        // Создание новой сделки
        const res = await fetch('/api/deals', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(editData)
        })

        if (res.ok) {
          const data = await res.json()
          // Перенаправляем на страницу созданной сделки
          router.push(`/dashboard/deals/${data.deal.id}`)
        } else {
          alert('Ошибка при создании сделки')
        }
      } else {
        // Обновление существующей сделки
        const res = await fetch(`/api/deals/${dealId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(editData)
        })

        if (res.ok) {
          await fetchDeal()
          await fetchComments()  // Обновляем комментарии чтобы увидеть системные события
          setEditing(false)
        } else {
          alert('Ошибка при обновлении сделки')
        }
      }
    } catch (error) {
      console.error('Error saving deal:', error)
      alert('Ошибка при сохранении сделки')
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

  const handleSend = async () => {
    if (!messageContent.trim() && !selectedFile) return

    setSending(true)
    try {
      if (inputMode === 'comment') {
        // Создаем комментарий
        const sendToTelegram = deal?.contact?.telegramId ? confirm('Отправить это сообщение также в Telegram?') : false

        const res = await fetch(`/api/deals/${dealId}/comments`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            content: messageContent,
            type: 'COMMENT',
            sendToTelegram,
            userId: deal?.manager?.id
          })
        })

        if (res.ok) {
          setMessageContent('')
          await fetchComments()
        } else {
          alert('Ошибка при создании комментария')
        }
      } else {
        // Отправка в Telegram
        if (!deal?.contact?.telegramId) {
          alert('У этого контакта нет Telegram ID')
          return
        }

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
      }
    } catch (error) {
      console.error('Error sending:', error)
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

  // Play call recording from comment metadata
  const handlePlayCallRecording = async (commentId: string, metadata: string) => {
    try {
      const meta = JSON.parse(metadata)
      const callRecordId = meta.callRecordId

      if (!callRecordId) {
        alert('Записи нет в базе данных')
        return
      }

      // If already playing this comment, toggle play/pause
      if (playingCommentId === commentId && audioUrl) {
        if (isPlaying) {
          audioRef.current?.pause()
          setIsPlaying(false)
        } else {
          audioRef.current?.play()
          setIsPlaying(true)
        }
        return
      }

      // Fetch call recording URL
      setAudioLoading(true)
      const res = await fetch(`/api/calls/${callRecordId}`)

      if (!res.ok) {
        alert('Записи нет в базе данных')
        setAudioLoading(false)
        return
      }

      const data = await res.json()
      const call = data.call

      if (!call?.recordingUrl) {
        alert('Записи нет в базе данных')
        setAudioLoading(false)
        return
      }

      // Start playing new recording
      const fullUrl = call.recordingUrl.startsWith('http')
        ? call.recordingUrl
        : `${window.location.origin}${call.recordingUrl}`

      setPlayingCommentId(commentId)
      setAudioUrl(fullUrl)
      setIsPlaying(true)
      setCurrentTime(0)
      setAudioLoading(false)
    } catch (error) {
      console.error('Error playing call recording:', error)
      alert('Ошибка при воспроизведении записи')
      setAudioLoading(false)
    }
  }

  // Close audio player
  const handleClosePlayer = () => {
    audioRef.current?.pause()
    setPlayingCommentId(null)
    setAudioUrl(null)
    setIsPlaying(false)
    setCurrentTime(0)
    setAudioDuration(0)
  }

  // Audio event handlers
  const handleTimeUpdate = () => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime)
    }
  }

  const handleLoadedMetadata = () => {
    if (audioRef.current) {
      setAudioDuration(audioRef.current.duration)
      audioRef.current.play().catch(err => {
        console.error('Play failed:', err)
        alert('Не удалось воспроизвести: ' + err.message)
      })
    }
  }

  const handleAudioEnded = () => {
    setIsPlaying(false)
    setCurrentTime(0)
  }

  const handleAudioError = (e: React.SyntheticEvent<HTMLAudioElement, Event>) => {
    const audio = e.currentTarget
    console.error('Audio error:', audio.error?.code, audio.error?.message)
    alert(`Ошибка воспроизведения: ${audio.error?.message || 'Неизвестная ошибка'}`)
    setIsPlaying(false)
    setAudioLoading(false)
  }

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = parseFloat(e.target.value)
    if (audioRef.current) {
      audioRef.current.currentTime = time
      setCurrentTime(time)
    }
  }

  const formatAudioTime = (seconds: number) => {
    if (!seconds || isNaN(seconds)) return '0:00'
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  // Check if comment is a call event
  const isCallEvent = (comment: Comment) => {
    return comment.type === 'SYSTEM_EVENT' &&
           (comment.eventType === 'CALL_INCOMING' || comment.eventType === 'CALL_OUTGOING')
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!deal && dealId !== 'new') {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-gray-500">Сделка не найдена</p>
      </div>
    )
  }

  const isNewDeal = dealId === 'new'

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
            <h1 className="text-2xl font-bold text-gray-900">
              {isNewDeal ? 'Новая сделка' : deal?.title}
            </h1>
            {!isNewDeal && <p className="text-gray-500 mt-1">ID: {dealId}</p>}
          </div>
        </div>
        <div className="flex gap-3">
          {isNewDeal ? (
            <>
              <button
                onClick={() => router.push('/dashboard/deals')}
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
                {saving ? 'Создание...' : 'Создать сделку'}
              </button>
            </>
          ) : editing ? (
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
      <div className={`grid grid-cols-1 ${isNewDeal ? 'lg:grid-cols-1 max-w-2xl mx-auto' : 'lg:grid-cols-3'} gap-6`}>
        {/* Left Panel - Deal Info */}
        <div className={`${isNewDeal ? '' : 'lg:col-span-1'} bg-white rounded-2xl shadow-sm border border-gray-100 p-6`}>
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
                  Воронка
                </label>
                <select
                  value={editData.pipelineId}
                  onChange={(e) => {
                    const pipeline = pipelines.find(p => p.id === e.target.value)
                    setEditData({
                      ...editData,
                      pipelineId: e.target.value,
                      stage: pipeline?.stages?.[0]?.slug || 'NEW'
                    })
                  }}
                  className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                >
                  <option value="">Выберите воронку</option>
                  {pipelines.map(pipeline => (
                    <option key={pipeline.id} value={pipeline.id}>{pipeline.name}</option>
                  ))}
                </select>
              </div>

              {editData.pipelineId && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Этап
                  </label>
                  <select
                    value={editData.stage}
                    onChange={(e) => setEditData({ ...editData, stage: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  >
                    {(pipelines.find(p => p.id === editData.pipelineId)?.stages || stages).map((stage: any) => (
                      <option key={stage.slug || stage.id} value={stage.slug || stage.id}>
                        {stage.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Контакт
                </label>
                <div ref={contactDropdownRef} className="relative">
                  <button
                    type="button"
                    onClick={() => setContactDropdownOpen(!contactDropdownOpen)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-white text-left flex items-center justify-between"
                  >
                    <span className={editData.contactId ? 'text-gray-900' : 'text-gray-500'}>
                      {editData.contactId
                        ? contacts.find(c => c.id === editData.contactId)?.name || 'Не выбран'
                        : 'Не выбран'}
                    </span>
                    <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${contactDropdownOpen ? 'rotate-180' : ''}`} />
                  </button>

                  {contactDropdownOpen && (
                    <div className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-xl shadow-lg max-h-64 overflow-hidden">
                      <div className="p-2 border-b border-gray-200">
                        <div className="relative">
                          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                          <input
                            type="text"
                            value={contactSearch}
                            onChange={(e) => setContactSearch(e.target.value)}
                            placeholder="Поиск контакта..."
                            className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                            autoFocus
                          />
                        </div>
                      </div>
                      <div className="max-h-48 overflow-y-auto">
                        <button
                          type="button"
                          onClick={() => {
                            setEditData({ ...editData, contactId: '' })
                            setContactDropdownOpen(false)
                            setContactSearch('')
                          }}
                          className="w-full px-4 py-2 text-left text-sm text-gray-500 hover:bg-gray-50"
                        >
                          Не выбран
                        </button>
                        {contacts
                          .filter(contact =>
                            contact.name?.toLowerCase().includes(contactSearch.toLowerCase()) ||
                            contact.phone?.includes(contactSearch) ||
                            contact.telegramUsername?.toLowerCase().includes(contactSearch.toLowerCase())
                          )
                          .map(contact => (
                            <button
                              key={contact.id}
                              type="button"
                              onClick={() => {
                                setEditData({ ...editData, contactId: contact.id })
                                setContactDropdownOpen(false)
                                setContactSearch('')
                              }}
                              className={`w-full px-4 py-2 text-left text-sm hover:bg-indigo-50 flex items-center justify-between ${
                                editData.contactId === contact.id ? 'bg-indigo-50 text-indigo-700' : 'text-gray-900'
                              }`}
                            >
                              <div>
                                <div className="font-medium">{contact.name}</div>
                                {(contact.phone || contact.telegramUsername) && (
                                  <div className="text-xs text-gray-500">
                                    {contact.phone}{contact.phone && contact.telegramUsername && ' • '}
                                    {contact.telegramUsername && `@${contact.telegramUsername}`}
                                  </div>
                                )}
                              </div>
                              {editData.contactId === contact.id && (
                                <Check className="w-4 h-4 text-indigo-600" />
                              )}
                            </button>
                          ))}
                        {contacts.filter(contact =>
                          contact.name?.toLowerCase().includes(contactSearch.toLowerCase()) ||
                          contact.phone?.includes(contactSearch) ||
                          contact.telegramUsername?.toLowerCase().includes(contactSearch.toLowerCase())
                        ).length === 0 && (
                          <div className="px-4 py-3 text-sm text-gray-500 text-center">
                            Ничего не найдено
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
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
                <p className="text-3xl font-bold text-green-600">{formatCurrency(deal?.amount || 0)}</p>
              </div>

              <div>
                <p className="text-sm text-gray-500 mb-1">Этап</p>
                <p className="font-medium text-gray-900">
                  {pipelines.find(p => p.id === deal?.pipelineId)?.stages?.find((s: any) => s.slug === deal?.stage)?.name ||
                   stages.find(s => s.id === deal?.stage)?.name ||
                   deal?.stage}
                </p>
              </div>

              {deal?.contact && (
                <div>
                  <div className="flex items-center gap-2 text-sm text-gray-500 mb-2">
                    <User className="w-4 h-4" />
                    <span>Контакт</span>
                  </div>
                  <p className="font-medium text-gray-900">{deal?.contact.name}</p>
                  {deal?.contact.phone && (
                    <p className="text-sm text-gray-600 mt-1">{deal?.contact.phone}</p>
                  )}
                  {deal?.contact.telegramUsername && (
                    <p className="text-sm text-indigo-600 mt-1">@{deal?.contact.telegramUsername}</p>
                  )}
                </div>
              )}

              {deal?.manager && (
                <div>
                  <p className="text-sm text-gray-500 mb-1">Менеджер</p>
                  <p className="font-medium text-gray-900">{deal?.manager.name}</p>
                </div>
              )}

              {deal?.description && (
                <div>
                  <p className="text-sm text-gray-500 mb-2">Описание</p>
                  <p className="text-gray-700 text-sm">{deal?.description}</p>
                </div>
              )}

              {deal?.createdAt && (
              <div className="pt-4 border-t border-gray-100">
                <div className="flex items-center gap-2 text-sm text-gray-500 mb-2">
                  <Calendar className="w-4 h-4" />
                  <span>Создано</span>
                </div>
                <p className="text-sm text-gray-900">{formatDate(deal?.createdAt)}</p>
              </div>
              )}
            </div>
          )}
        </div>

        {/* Right Panel - Activity Feed */}
        {!isNewDeal && (
        <div className="lg:col-span-2 bg-white rounded-2xl shadow-sm border border-gray-100 flex flex-col" style={{ height: '700px' }}>
          {/* Activity Header */}
          <div className="p-6 border-b border-gray-100">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-indigo-100 rounded-lg">
                  <Activity className="w-5 h-5 text-indigo-600" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-gray-900">Лента активности</h2>
                  <p className="text-sm text-gray-500">
                    {deal?.contact?.telegramUsername ? `@${deal?.contact.telegramUsername}` : 'Комментарии и события'}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Pending Tasks */}
          {tasks.filter(t => t.status === 'PENDING').length > 0 && (
            <div className="px-6 pt-4 pb-2 border-b border-gray-100">
              <div className="space-y-2">
                {tasks.filter(t => t.status === 'PENDING').map((task) => {
                  const dueDate = new Date(task.dueDate)
                  const isOverdue = dueDate < new Date()
                  const formatTaskTime = (date: Date) => {
                    const day = String(date.getDate()).padStart(2, '0')
                    const month = String(date.getMonth() + 1).padStart(2, '0')
                    const hours = String(date.getHours()).padStart(2, '0')
                    const minutes = String(date.getMinutes()).padStart(2, '0')
                    return `${day}.${month} в ${hours}:${minutes}`
                  }
                  return (
                    <div
                      key={task.id}
                      className={`flex items-center justify-between p-3 rounded-xl border ${
                        isOverdue
                          ? 'bg-red-50 border-red-200'
                          : 'bg-orange-50 border-orange-200'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-lg ${isOverdue ? 'bg-red-100' : 'bg-orange-100'}`}>
                          <Bell className={`w-4 h-4 ${isOverdue ? 'text-red-600' : 'text-orange-600'}`} />
                        </div>
                        <div>
                          <p className={`font-medium text-sm ${isOverdue ? 'text-red-900' : 'text-gray-900'}`}>
                            {task.title}
                          </p>
                          <div className="flex items-center gap-2 text-xs text-gray-500">
                            <Clock className="w-3 h-3" />
                            <span className={isOverdue ? 'text-red-600 font-medium' : ''}>
                              {isOverdue ? 'Просрочено: ' : ''}{formatTaskTime(dueDate)}
                            </span>
                          </div>
                        </div>
                      </div>
                      <button
                        onClick={() => handleCompleteTask(task.id)}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-green-500 text-white text-xs font-medium rounded-lg hover:bg-green-600 transition"
                      >
                        <Check className="w-3 h-3" />
                        Выполнено
                      </button>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Activity Feed */}
          <div className="flex-1 overflow-y-auto p-6 space-y-4">
            {(() => {
              // Объединяем сообщения и комментарии в единую ленту
              const activityItems: ActivityItem[] = [
                ...messages.map(m => ({ ...m, itemType: 'message' as const })),
                ...comments.map(c => ({ ...c, itemType: 'comment' as const }))
              ].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())

              if (activityItems.length === 0) {
                return (
                  <div className="flex items-center justify-center h-full text-gray-500">
                    <p>Пока нет активности</p>
                  </div>
                )
              }

              return activityItems.map((item) => {
                if (item.itemType === 'message') {
                  const message = item as Message & { itemType: 'message' }
                  return (
                <div
                  key={`msg-${message.id}`}
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
                  )
                } else {
                  // Рендер комментария или системного события
                  const comment = item as Comment & { itemType: 'comment' }

                  if (comment.type === 'SYSTEM_EVENT') {
                    // Check if this is a call event
                    const isCall = isCallEvent(comment)

                    return (
                      <div key={`evt-${comment.id}`} className="flex items-center justify-center">
                        <div className="flex items-center gap-2 px-4 py-2 bg-gray-50 rounded-full text-sm text-gray-600">
                          {isCall ? (
                            <Phone className="w-4 h-4 text-indigo-500" />
                          ) : (
                            <Activity className="w-4 h-4" />
                          )}
                          <span>{comment.content}</span>
                          {isCall && comment.metadata && (
                            <button
                              onClick={() => handlePlayCallRecording(comment.id, comment.metadata!)}
                              disabled={audioLoading && playingCommentId === comment.id}
                              className={`p-1.5 rounded-full transition ${
                                playingCommentId === comment.id && isPlaying
                                  ? 'bg-indigo-100 text-indigo-600'
                                  : 'hover:bg-indigo-100 text-gray-500 hover:text-indigo-600'
                              }`}
                              title="Прослушать запись"
                            >
                              {audioLoading && playingCommentId === comment.id ? (
                                <div className="w-4 h-4 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
                              ) : playingCommentId === comment.id && isPlaying ? (
                                <Pause className="w-4 h-4" />
                              ) : (
                                <Play className="w-4 h-4" />
                              )}
                            </button>
                          )}
                          <span className="text-xs text-gray-400">
                            {formatDate(comment.createdAt)}
                          </span>
                        </div>
                      </div>
                    )
                  }

                  return (
                    <div key={`cmt-${comment.id}`} className="flex flex-col items-start">
                      <div className="max-w-[70%] bg-amber-50 border-l-4 border-amber-400 rounded-r-2xl px-4 py-3">
                        <div className="flex items-center gap-2 mb-1">
                          <MessageSquare className="w-4 h-4 text-amber-600" />
                          {comment.user && (
                            <span className="text-sm font-medium text-amber-900">{comment.user.name}</span>
                          )}
                          <span className="text-xs text-amber-600">Комментарий</span>
                        </div>
                        <p className="text-sm text-gray-900 whitespace-pre-wrap">{comment.content}</p>
                        <p className="text-xs text-gray-500 mt-2">
                          {formatDate(comment.createdAt)}
                        </p>
                      </div>
                    </div>
                  )
                }
              })
            })()}
            <div ref={chatEndRef} />
          </div>

          {/* Input Section */}
          <div className="p-6 border-t border-gray-100 space-y-3">
            {/* Mode Toggle + Task Button */}
            <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 bg-gray-100 p-1 rounded-lg w-fit">
              <button
                onClick={() => setInputMode('comment')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                  inputMode === 'comment'
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <div className="flex items-center gap-2">
                  <MessageSquare className="w-4 h-4" />
                  Комментарий
                </div>
              </button>
              {deal?.contact?.telegramId && (
                <button
                  onClick={() => setInputMode('message')}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                    inputMode === 'message'
                      ? 'bg-white text-gray-900 shadow-sm'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <Send className="w-4 h-4" />
                    Telegram
                  </div>
                </button>
              )}
            </div>

              {/* Task/Reminder Button */}
              <button
                onClick={() => setShowTaskModal(true)}
                className="px-4 py-2 bg-orange-100 text-orange-700 hover:bg-orange-200 rounded-lg text-sm font-medium transition flex items-center gap-2"
              >
                <Bell className="w-4 h-4" />
                Напоминание
              </button>
            </div>

            {selectedFile && inputMode === 'message' && (
              <div className="p-3 bg-gray-50 rounded-lg flex items-center gap-3">
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
              {inputMode === 'message' && (
                <>
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
                </>
              )}
              <input
                type="text"
                value={messageContent}
                onChange={(e) => setMessageContent(e.target.value)}
                onKeyPress={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    handleSend()
                    }
                  }}
                  placeholder={
                    inputMode === 'comment'
                      ? 'Добавить комментарий...'
                      : selectedFile
                      ? 'Добавить подпись к файлу...'
                      : 'Написать сообщение...'
                  }
                  disabled={sending}
                  className="flex-1 px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent disabled:opacity-50"
                />
                <button
                  onClick={handleSend}
                  disabled={sending || (!messageContent.trim() && !selectedFile)}
                  className={`px-6 py-3 rounded-xl font-medium transition flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed ${
                    inputMode === 'comment'
                      ? 'bg-amber-600 text-white hover:bg-amber-700'
                      : 'bg-indigo-600 text-white hover:bg-indigo-700'
                  }`}
                >
                  {inputMode === 'comment' ? (
                    <CheckCircle2 className="w-5 h-5" />
                  ) : (
                    <Send className="w-5 h-5" />
                  )}
                  {sending
                    ? 'Отправка...'
                    : inputMode === 'comment'
                    ? 'Добавить'
                    : 'Отправить'}
                </button>
              </div>
            </div>
        </div>
        )}
      </div>

      {/* Task Modal */}
      <TaskModal
        isOpen={showTaskModal}
        onClose={() => setShowTaskModal(false)}
        dealId={dealId}
        contactId={deal?.contact?.id}
        contactName={deal?.contact?.name}
        onTaskCreated={() => {
          fetchTasks()
          fetchComments()
        }}
      />

      {/* Audio Player for Call Recordings */}
      {playingCommentId && audioUrl && (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 shadow-lg p-4 z-50">
          <div className="max-w-4xl mx-auto flex items-center gap-4">
            <button
              onClick={() => {
                if (isPlaying) {
                  audioRef.current?.pause()
                  setIsPlaying(false)
                } else {
                  audioRef.current?.play()
                  setIsPlaying(true)
                }
              }}
              className="p-3 bg-indigo-600 text-white rounded-full hover:bg-indigo-700 transition"
            >
              {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
            </button>

            <div className="flex-1">
              <div className="flex items-center gap-3">
                <span className="text-sm text-gray-500 font-mono w-12">{formatAudioTime(currentTime)}</span>
                <input
                  type="range"
                  min={0}
                  max={audioDuration || 100}
                  value={currentTime}
                  onChange={handleSeek}
                  className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                />
                <span className="text-sm text-gray-500 font-mono w-12">{formatAudioTime(audioDuration)}</span>
              </div>
              <div className="flex items-center gap-2 mt-1">
                <Volume2 className="w-4 h-4 text-gray-400" />
                <span className="text-sm text-gray-600">Запись звонка</span>
              </div>
            </div>

            <button
              onClick={handleClosePlayer}
              className="p-2 text-gray-400 hover:text-gray-600 rounded-lg transition"
            >
              <X className="w-5 h-5" />
            </button>

            <audio
              ref={audioRef}
              src={audioUrl}
              onTimeUpdate={handleTimeUpdate}
              onLoadedMetadata={handleLoadedMetadata}
              onEnded={handleAudioEnded}
              onError={handleAudioError}
            />
          </div>
        </div>
      )}
    </div>
  )
}
