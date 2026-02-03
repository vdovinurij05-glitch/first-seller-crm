'use client'

import { useState, useEffect, useRef } from 'react'
import { Phone, PhoneIncoming, PhoneOutgoing, PhoneMissed, Play, Pause, Download, FileText, RefreshCw, Volume2, X } from 'lucide-react'
import { format } from 'date-fns'
import { ru } from 'date-fns/locale/ru'

interface Call {
  id: string
  mangoCallId: string
  direction: string
  phone: string
  duration?: number
  status: string
  recordingUrl?: string
  createdAt: string
  answeredAt?: string
  endedAt?: string
  contact?: {
    id: string
    name: string
  }
  manager?: {
    id: string
    name: string
  }
  transcription?: {
    id: string
    summary?: string
    sentiment?: string
  }
}

export default function CallsPage() {
  const [calls, setCalls] = useState<Call[]>([])
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [directionFilter, setDirectionFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')

  // Audio player state
  const [playingCallId, setPlayingCallId] = useState<string | null>(null)
  const [audioUrl, setAudioUrl] = useState<string | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [audioDuration, setAudioDuration] = useState(0)
  const audioRef = useRef<HTMLAudioElement>(null)

  useEffect(() => {
    fetchCalls()
  }, [directionFilter, statusFilter])

  const fetchCalls = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (directionFilter !== 'all') params.append('direction', directionFilter)
      if (statusFilter !== 'all') params.append('status', statusFilter)

      const res = await fetch(`/api/calls?${params.toString()}`)
      const data = await res.json()
      setCalls(data.calls || [])
    } catch (error) {
      console.error('Error fetching calls:', error)
    } finally {
      setLoading(false)
    }
  }

  // Play/pause audio
  const handlePlayRecording = async (call: Call) => {
    if (playingCallId === call.id && isPlaying) {
      // Pause current
      audioRef.current?.pause()
      setIsPlaying(false)
      return
    }

    if (playingCallId === call.id && !isPlaying) {
      // Resume current
      audioRef.current?.play()
      setIsPlaying(true)
      return
    }

    // Play new recording
    if (call.recordingUrl) {
      setPlayingCallId(call.id)
      setAudioUrl(call.recordingUrl)
      setIsPlaying(true)
      setCurrentTime(0)
    }
  }

  // Close player
  const handleClosePlayer = () => {
    audioRef.current?.pause()
    setPlayingCallId(null)
    setAudioUrl(null)
    setIsPlaying(false)
    setCurrentTime(0)
  }

  // Audio time update
  const handleTimeUpdate = () => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime)
    }
  }

  // Audio loaded
  const handleLoadedMetadata = () => {
    if (audioRef.current) {
      setAudioDuration(audioRef.current.duration)
      audioRef.current.play()
    }
  }

  // Audio ended
  const handleAudioEnded = () => {
    setIsPlaying(false)
    setCurrentTime(0)
  }

  // Seek audio
  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = parseFloat(e.target.value)
    if (audioRef.current) {
      audioRef.current.currentTime = time
      setCurrentTime(time)
    }
  }

  // Sync recordings from Mango
  const handleSyncRecordings = async () => {
    setSyncing(true)
    try {
      const res = await fetch('/api/mango/sync', { method: 'POST' })
      if (res.ok) {
        await fetchCalls()
      }
    } catch (error) {
      console.error('Error syncing recordings:', error)
    } finally {
      setSyncing(false)
    }
  }

  // Format time for player
  const formatTime = (seconds: number) => {
    if (!seconds || isNaN(seconds)) return '0:00'
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  const formatDuration = (seconds?: number) => {
    if (!seconds) return '—'
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  const getStatusIcon = (status: string, direction: string) => {
    if (status === 'MISSED') return <PhoneMissed className="w-5 h-5 text-red-500" />
    if (direction === 'IN') return <PhoneIncoming className="w-5 h-5 text-green-500" />
    return <PhoneOutgoing className="w-5 h-5 text-blue-500" />
  }

  const getStatusText = (status: string) => {
    switch (status) {
      case 'COMPLETED': return 'Завершен'
      case 'MISSED': return 'Пропущен'
      case 'BUSY': return 'Занято'
      case 'FAILED': return 'Не удался'
      case 'ANSWERED': return 'Отвечен'
      case 'INITIATED': return 'Инициирован'
      case 'RINGING': return 'Звонит'
      default: return status
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'COMPLETED': return 'bg-green-100 text-green-700'
      case 'MISSED': return 'bg-red-100 text-red-700'
      case 'BUSY': return 'bg-yellow-100 text-yellow-700'
      case 'FAILED': return 'bg-red-100 text-red-700'
      case 'ANSWERED': return 'bg-blue-100 text-blue-700'
      default: return 'bg-gray-100 text-gray-700'
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Звонки</h1>
          <p className="text-gray-500 mt-1">История звонков и записи разговоров</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleSyncRecordings}
            disabled={syncing}
            className="px-4 py-2 bg-indigo-600 text-white rounded-xl font-medium hover:bg-indigo-700 transition flex items-center gap-2 disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
            {syncing ? 'Синхронизация...' : 'Синхронизировать'}
          </button>
          <select
            value={directionFilter}
            onChange={(e) => setDirectionFilter(e.target.value)}
            className="px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
          >
            <option value="all">Все звонки</option>
            <option value="IN">Входящие</option>
            <option value="OUT">Исходящие</option>
          </select>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
          >
            <option value="all">Все статусы</option>
            <option value="COMPLETED">Завершенные</option>
            <option value="MISSED">Пропущенные</option>
            <option value="BUSY">Занято</option>
          </select>
        </div>
      </div>

      {/* Calls List */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Тип
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Контакт
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Телефон
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Длительность
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Статус
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Менеджер
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Дата/Время
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Действия
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center">
                    <div className="flex items-center justify-center">
                      <div className="animate-spin w-8 h-8 border-2 border-indigo-600 border-t-transparent rounded-full" />
                    </div>
                  </td>
                </tr>
              ) : calls.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center text-gray-500">
                    Звонков не найдено
                  </td>
                </tr>
              ) : (
                calls.map((call) => (
                  <tr key={call.id} className="hover:bg-gray-50 transition">
                    <td className="px-6 py-4">
                      {getStatusIcon(call.status, call.direction)}
                    </td>
                    <td className="px-6 py-4">
                      {call.contact ? (
                        <span className="font-medium text-gray-900">{call.contact.name}</span>
                      ) : (
                        <span className="text-gray-400">Не определен</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2 text-gray-600">
                        <Phone className="w-4 h-4" />
                        <span className="text-sm">{call.phone}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm text-gray-600 font-mono">
                        {formatDuration(call.duration)}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(call.status)}`}>
                        {getStatusText(call.status)}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      {call.manager ? (
                        <span className="text-sm text-gray-600">{call.manager.name}</span>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-gray-600">
                        {format(new Date(call.createdAt), 'dd MMM yyyy, HH:mm', { locale: ru })}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        {call.recordingUrl && (
                          <>
                            <button
                              onClick={() => handlePlayRecording(call)}
                              className={`p-2 rounded-lg transition ${
                                playingCallId === call.id && isPlaying
                                  ? 'text-indigo-600 bg-indigo-50'
                                  : 'text-gray-400 hover:text-indigo-600 hover:bg-indigo-50'
                              }`}
                              title="Воспроизвести"
                            >
                              {playingCallId === call.id && isPlaying ? (
                                <Pause className="w-4 h-4" />
                              ) : (
                                <Play className="w-4 h-4" />
                              )}
                            </button>
                            <a
                              href={call.recordingUrl}
                              download
                              target="_blank"
                              rel="noopener noreferrer"
                              className="p-2 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition"
                              title="Скачать запись"
                            >
                              <Download className="w-4 h-4" />
                            </a>
                          </>
                        )}
                        {!call.recordingUrl && call.status === 'COMPLETED' && (
                          <span className="text-xs text-gray-400">Нет записи</span>
                        )}
                        {call.transcription && (
                          <button className="p-2 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition" title="Транскрипция">
                            <FileText className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Audio Player */}
      {playingCallId && audioUrl && (
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
                <span className="text-sm text-gray-500 font-mono w-12">{formatTime(currentTime)}</span>
                <input
                  type="range"
                  min={0}
                  max={audioDuration || 100}
                  value={currentTime}
                  onChange={handleSeek}
                  className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                />
                <span className="text-sm text-gray-500 font-mono w-12">{formatTime(audioDuration)}</span>
              </div>
              <div className="flex items-center gap-2 mt-1">
                <Volume2 className="w-4 h-4 text-gray-400" />
                <span className="text-sm text-gray-600">
                  {calls.find(c => c.id === playingCallId)?.contact?.name || calls.find(c => c.id === playingCallId)?.phone}
                </span>
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
            />
          </div>
        </div>
      )}
    </div>
  )
}
