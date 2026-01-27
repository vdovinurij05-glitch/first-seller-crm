'use client'

import { useState, useEffect } from 'react'
import { useAuthStore } from '@/lib/store'
import {
  User,
  Building2,
  Bell,
  Shield,
  Key,
  Users,
  Save,
  Phone,
  MessageSquare,
  Mic,
  CheckCircle2,
  XCircle
} from 'lucide-react'

export default function SettingsPage() {
  const user = useAuthStore((state) => state.user)
  const [activeTab, setActiveTab] = useState('profile')
  const [saving, setSaving] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState(false)

  // Профиль пользователя
  const [profileData, setProfileData] = useState({
    name: user?.name || '',
    email: user?.email || '',
    phone: '',
    avatar: user?.avatar || ''
  })

  // Интеграции
  const [integrations, setIntegrations] = useState({
    telegram: {
      enabled: false,
      botToken: '',
      status: 'disconnected'
    },
    mango: {
      enabled: false,
      apiKey: '',
      apiSalt: '',
      vpnId: '',
      status: 'disconnected'
    },
    openai: {
      enabled: false,
      apiKey: '',
      status: 'disconnected'
    }
  })

  // Уведомления
  const [notifications, setNotifications] = useState({
    newMessage: true,
    newCall: true,
    newDeal: true,
    missedCall: true,
    email: false,
    sound: true
  })

  const handleSave = async () => {
    setSaving(true)
    setSaveSuccess(false)

    try {
      // Здесь будет API вызов для сохранения настроек
      await new Promise(resolve => setTimeout(resolve, 1000))
      setSaveSuccess(true)
      setTimeout(() => setSaveSuccess(false), 3000)
    } catch (error) {
      console.error('Error saving settings:', error)
    } finally {
      setSaving(false)
    }
  }

  const tabs = [
    { id: 'profile', name: 'Профиль', icon: User },
    { id: 'integrations', name: 'Интеграции', icon: Building2 },
    { id: 'notifications', name: 'Уведомления', icon: Bell },
    { id: 'security', name: 'Безопасность', icon: Shield },
    { id: 'team', name: 'Команда', icon: Users }
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Настройки</h1>
          <p className="text-gray-500 mt-1">Управление системой и интеграциями</p>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-4 py-2 bg-indigo-600 text-white rounded-xl font-medium hover:bg-indigo-700 transition flex items-center gap-2 disabled:opacity-50"
        >
          {saving ? (
            <>
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              Сохранение...
            </>
          ) : (
            <>
              <Save className="w-5 h-5" />
              Сохранить
            </>
          )}
        </button>
      </div>

      {/* Success Message */}
      {saveSuccess && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-4 flex items-center gap-3">
          <CheckCircle2 className="w-5 h-5 text-green-600" />
          <span className="text-green-800 font-medium">Настройки успешно сохранены</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Tabs Sidebar */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-2">
            {tabs.map((tab) => {
              const Icon = tab.icon
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition ${
                    activeTab === tab.id
                      ? 'bg-indigo-50 text-indigo-600'
                      : 'text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  <Icon className="w-5 h-5" />
                  <span className="font-medium">{tab.name}</span>
                </button>
              )
            })}
          </div>
        </div>

        {/* Content */}
        <div className="lg:col-span-3">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            {/* Profile Tab */}
            {activeTab === 'profile' && (
              <div className="space-y-6">
                <h2 className="text-xl font-bold text-gray-900">Профиль пользователя</h2>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Имя
                    </label>
                    <input
                      type="text"
                      value={profileData.name}
                      onChange={(e) => setProfileData({ ...profileData, name: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Email
                    </label>
                    <input
                      type="email"
                      value={profileData.email}
                      onChange={(e) => setProfileData({ ...profileData, email: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Телефон
                    </label>
                    <input
                      type="tel"
                      value={profileData.phone}
                      onChange={(e) => setProfileData({ ...profileData, phone: e.target.value })}
                      placeholder="+7 (999) 123-45-67"
                      className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Роль
                    </label>
                    <input
                      type="text"
                      value={user?.role || 'MANAGER'}
                      disabled
                      className="w-full px-4 py-2 border border-gray-300 rounded-xl bg-gray-50 text-gray-500"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Integrations Tab */}
            {activeTab === 'integrations' && (
              <div className="space-y-6">
                <h2 className="text-xl font-bold text-gray-900">Интеграции</h2>

                {/* Telegram */}
                <div className="border border-gray-200 rounded-xl p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="p-3 bg-blue-100 rounded-xl">
                        <MessageSquare className="w-6 h-6 text-blue-600" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-gray-900">Telegram Bot</h3>
                        <p className="text-sm text-gray-500">Интеграция с Telegram мессенджером</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`text-sm font-medium ${integrations.telegram.status === 'connected' ? 'text-green-600' : 'text-red-600'}`}>
                        {integrations.telegram.status === 'connected' ? 'Подключено' : 'Отключено'}
                      </span>
                      {integrations.telegram.status === 'connected' ? (
                        <CheckCircle2 className="w-5 h-5 text-green-600" />
                      ) : (
                        <XCircle className="w-5 h-5 text-red-600" />
                      )}
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Bot Token
                      </label>
                      <input
                        type="password"
                        value={integrations.telegram.botToken}
                        onChange={(e) => setIntegrations({
                          ...integrations,
                          telegram: { ...integrations.telegram, botToken: e.target.value }
                        })}
                        placeholder="1234567890:ABCdefGHIjklMNOpqrsTUVwxyz"
                        className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        Получите токен у @BotFather в Telegram
                      </p>
                    </div>

                    <label className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        checked={integrations.telegram.enabled}
                        onChange={(e) => setIntegrations({
                          ...integrations,
                          telegram: { ...integrations.telegram, enabled: e.target.checked }
                        })}
                        className="w-5 h-5 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                      />
                      <span className="text-sm text-gray-700">Включить интеграцию</span>
                    </label>
                  </div>
                </div>

                {/* Mango Office */}
                <div className="border border-gray-200 rounded-xl p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="p-3 bg-orange-100 rounded-xl">
                        <Phone className="w-6 h-6 text-orange-600" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-gray-900">Mango Office</h3>
                        <p className="text-sm text-gray-500">Интеграция с телефонией</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`text-sm font-medium ${integrations.mango.status === 'connected' ? 'text-green-600' : 'text-red-600'}`}>
                        {integrations.mango.status === 'connected' ? 'Подключено' : 'Отключено'}
                      </span>
                      {integrations.mango.status === 'connected' ? (
                        <CheckCircle2 className="w-5 h-5 text-green-600" />
                      ) : (
                        <XCircle className="w-5 h-5 text-red-600" />
                      )}
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        API Key
                      </label>
                      <input
                        type="password"
                        value={integrations.mango.apiKey}
                        onChange={(e) => setIntegrations({
                          ...integrations,
                          mango: { ...integrations.mango, apiKey: e.target.value }
                        })}
                        className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        API Salt
                      </label>
                      <input
                        type="password"
                        value={integrations.mango.apiSalt}
                        onChange={(e) => setIntegrations({
                          ...integrations,
                          mango: { ...integrations.mango, apiSalt: e.target.value }
                        })}
                        className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        VPN ID
                      </label>
                      <input
                        type="text"
                        value={integrations.mango.vpnId}
                        onChange={(e) => setIntegrations({
                          ...integrations,
                          mango: { ...integrations.mango, vpnId: e.target.value }
                        })}
                        className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                      />
                    </div>

                    <label className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        checked={integrations.mango.enabled}
                        onChange={(e) => setIntegrations({
                          ...integrations,
                          mango: { ...integrations.mango, enabled: e.target.checked }
                        })}
                        className="w-5 h-5 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                      />
                      <span className="text-sm text-gray-700">Включить интеграцию</span>
                    </label>
                  </div>
                </div>

                {/* OpenAI */}
                <div className="border border-gray-200 rounded-xl p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="p-3 bg-purple-100 rounded-xl">
                        <Mic className="w-6 h-6 text-purple-600" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-gray-900">OpenAI</h3>
                        <p className="text-sm text-gray-500">Транскрибация и анализ звонков</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`text-sm font-medium ${integrations.openai.status === 'connected' ? 'text-green-600' : 'text-red-600'}`}>
                        {integrations.openai.status === 'connected' ? 'Подключено' : 'Отключено'}
                      </span>
                      {integrations.openai.status === 'connected' ? (
                        <CheckCircle2 className="w-5 h-5 text-green-600" />
                      ) : (
                        <XCircle className="w-5 h-5 text-red-600" />
                      )}
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        API Key
                      </label>
                      <input
                        type="password"
                        value={integrations.openai.apiKey}
                        onChange={(e) => setIntegrations({
                          ...integrations,
                          openai: { ...integrations.openai, apiKey: e.target.value }
                        })}
                        placeholder="sk-..."
                        className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        Получите ключ на platform.openai.com
                      </p>
                    </div>

                    <label className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        checked={integrations.openai.enabled}
                        onChange={(e) => setIntegrations({
                          ...integrations,
                          openai: { ...integrations.openai, enabled: e.target.checked }
                        })}
                        className="w-5 h-5 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                      />
                      <span className="text-sm text-gray-700">Включить интеграцию</span>
                    </label>
                  </div>
                </div>
              </div>
            )}

            {/* Notifications Tab */}
            {activeTab === 'notifications' && (
              <div className="space-y-6">
                <h2 className="text-xl font-bold text-gray-900">Уведомления</h2>

                <div className="space-y-4">
                  <label className="flex items-center justify-between p-4 border border-gray-200 rounded-xl hover:bg-gray-50 cursor-pointer">
                    <div>
                      <p className="font-medium text-gray-900">Новые сообщения</p>
                      <p className="text-sm text-gray-500">Уведомлять о новых сообщениях от клиентов</p>
                    </div>
                    <input
                      type="checkbox"
                      checked={notifications.newMessage}
                      onChange={(e) => setNotifications({ ...notifications, newMessage: e.target.checked })}
                      className="w-5 h-5 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                    />
                  </label>

                  <label className="flex items-center justify-between p-4 border border-gray-200 rounded-xl hover:bg-gray-50 cursor-pointer">
                    <div>
                      <p className="font-medium text-gray-900">Новые звонки</p>
                      <p className="text-sm text-gray-500">Уведомлять о входящих звонках</p>
                    </div>
                    <input
                      type="checkbox"
                      checked={notifications.newCall}
                      onChange={(e) => setNotifications({ ...notifications, newCall: e.target.checked })}
                      className="w-5 h-5 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                    />
                  </label>

                  <label className="flex items-center justify-between p-4 border border-gray-200 rounded-xl hover:bg-gray-50 cursor-pointer">
                    <div>
                      <p className="font-medium text-gray-900">Пропущенные звонки</p>
                      <p className="text-sm text-gray-500">Уведомлять о пропущенных звонках</p>
                    </div>
                    <input
                      type="checkbox"
                      checked={notifications.missedCall}
                      onChange={(e) => setNotifications({ ...notifications, missedCall: e.target.checked })}
                      className="w-5 h-5 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                    />
                  </label>

                  <label className="flex items-center justify-between p-4 border border-gray-200 rounded-xl hover:bg-gray-50 cursor-pointer">
                    <div>
                      <p className="font-medium text-gray-900">Новые сделки</p>
                      <p className="text-sm text-gray-500">Уведомлять о новых сделках в системе</p>
                    </div>
                    <input
                      type="checkbox"
                      checked={notifications.newDeal}
                      onChange={(e) => setNotifications({ ...notifications, newDeal: e.target.checked })}
                      className="w-5 h-5 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                    />
                  </label>

                  <label className="flex items-center justify-between p-4 border border-gray-200 rounded-xl hover:bg-gray-50 cursor-pointer">
                    <div>
                      <p className="font-medium text-gray-900">Email уведомления</p>
                      <p className="text-sm text-gray-500">Получать дублирующие уведомления на почту</p>
                    </div>
                    <input
                      type="checkbox"
                      checked={notifications.email}
                      onChange={(e) => setNotifications({ ...notifications, email: e.target.checked })}
                      className="w-5 h-5 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                    />
                  </label>

                  <label className="flex items-center justify-between p-4 border border-gray-200 rounded-xl hover:bg-gray-50 cursor-pointer">
                    <div>
                      <p className="font-medium text-gray-900">Звуковые уведомления</p>
                      <p className="text-sm text-gray-500">Воспроизводить звук при уведомлениях</p>
                    </div>
                    <input
                      type="checkbox"
                      checked={notifications.sound}
                      onChange={(e) => setNotifications({ ...notifications, sound: e.target.checked })}
                      className="w-5 h-5 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                    />
                  </label>
                </div>
              </div>
            )}

            {/* Security Tab */}
            {activeTab === 'security' && (
              <div className="space-y-6">
                <h2 className="text-xl font-bold text-gray-900">Безопасность</h2>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Текущий пароль
                    </label>
                    <input
                      type="password"
                      className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Новый пароль
                    </label>
                    <input
                      type="password"
                      className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Подтвердите новый пароль
                    </label>
                    <input
                      type="password"
                      className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    />
                  </div>

                  <button className="px-4 py-2 bg-indigo-600 text-white rounded-xl font-medium hover:bg-indigo-700 transition flex items-center gap-2">
                    <Key className="w-5 h-5" />
                    Изменить пароль
                  </button>
                </div>

                <div className="border-t border-gray-200 pt-6">
                  <h3 className="font-semibold text-gray-900 mb-4">Активные сессии</h3>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between p-4 border border-gray-200 rounded-xl">
                      <div>
                        <p className="font-medium text-gray-900">Текущая сессия</p>
                        <p className="text-sm text-gray-500">Windows • Chrome • Сейчас</p>
                      </div>
                      <span className="text-green-600 text-sm font-medium">Активна</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Team Tab */}
            {activeTab === 'team' && (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-bold text-gray-900">Команда</h2>
                  <button className="px-4 py-2 bg-indigo-600 text-white rounded-xl font-medium hover:bg-indigo-700 transition">
                    Добавить менеджера
                  </button>
                </div>

                <div className="text-sm text-gray-500 bg-blue-50 border border-blue-200 rounded-xl p-4">
                  Управление командой доступно только для администраторов
                </div>

                <div className="space-y-3">
                  {[
                    { name: 'Администратор', email: 'admin@first-seller.ru', role: 'ADMIN', status: 'online' },
                    { name: 'Менеджер Иван', email: 'manager@first-seller.ru', role: 'MANAGER', status: 'online' },
                  ].map((member, index) => (
                    <div key={index} className="flex items-center justify-between p-4 border border-gray-200 rounded-xl">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-indigo-100 rounded-full flex items-center justify-center">
                          <User className="w-5 h-5 text-indigo-600" />
                        </div>
                        <div>
                          <p className="font-medium text-gray-900">{member.name}</p>
                          <p className="text-sm text-gray-500">{member.email}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-sm text-gray-600 px-3 py-1 bg-gray-100 rounded-full">
                          {member.role === 'ADMIN' ? 'Администратор' : 'Менеджер'}
                        </span>
                        <div className={`w-2 h-2 rounded-full ${member.status === 'online' ? 'bg-green-500' : 'bg-gray-300'}`} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
