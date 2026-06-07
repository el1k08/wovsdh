'use client'

import { useState, useEffect } from 'react'
import { X, MessageCircle, Shield, CheckCircle, AlertCircle, FlaskConical } from 'lucide-react'
import type { InlineMessage } from './types'

interface UserProfile {
  id: string
  email: string
  name: string
  role: string
  telegramChatId: string | null
  twoFactorEnabled: boolean
}

interface UserSettingsModalProps {
  onClose: () => void
  apiFetch: (path: string, options?: RequestInit) => Promise<Response>
}

export function UserSettingsModal({ onClose, apiFetch }: UserSettingsModalProps) {
  const [tab, setTab] = useState<'telegram' | 'security'>('telegram')
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [msg, setMsg] = useState<InlineMessage | null>(null)
  const [saving, setSaving] = useState(false)

  const [telegramInput, setTelegramInput] = useState('')
  const [testing, setTesting] = useState(false)

  const showMsg = (m: InlineMessage) => {
    setMsg(m)
    setTimeout(() => setMsg(null), 4000)
  }

  useEffect(() => {
    void loadProfile()
  }, [])

  async function loadProfile() {
    setLoading(true)
    try {
      const res = await apiFetch('/api/admin/user/profile')
      if (!res.ok) return
      const data = await res.json() as UserProfile
      setProfile(data)
      setTelegramInput(data.telegramChatId ?? '')
    } catch {
      /* ignore */
    } finally {
      setLoading(false)
    }
  }

  async function saveTelegram(e: React.FormEvent) {
    e.preventDefault()
    if (!profile) return
    setSaving(true)
    try {
      const chatId = telegramInput.trim() || null
      const res = await apiFetch('/api/admin/user/profile', {
        method: 'PATCH',
        body: JSON.stringify({ telegramChatId: chatId }),
      })
      if (!res.ok) { showMsg({ type: 'error', text: 'Ошибка сохранения' }); return }
      setProfile((p) => p ? { ...p, telegramChatId: chatId } : p)
      showMsg({ type: 'success', text: 'Telegram сохранён' })
    } catch {
      showMsg({ type: 'error', text: 'Ошибка сети' })
    } finally {
      setSaving(false)
    }
  }

  async function handleTestTelegram() {
    const chatId = Number(telegramInput.trim())
    if (!chatId) return
    setTesting(true)
    try {
      const res = await apiFetch('/api/admin/telegram/test', {
        method: 'POST',
        body: JSON.stringify({ name: profile?.name ?? 'User', chat_id: chatId }),
      })
      if (!res.ok) { showMsg({ type: 'error', text: 'Не удалось отправить тест' }); return }
      showMsg({ type: 'success', text: 'Тестовое сообщение отправлено!' })
    } catch {
      showMsg({ type: 'error', text: 'Ошибка сети' })
    } finally {
      setTesting(false)
    }
  }

  async function toggle2FA() {
    if (!profile) return
    if (!profile.twoFactorEnabled && !profile.telegramChatId) {
      setTab('telegram')
      showMsg({ type: 'error', text: 'Сначала подключите Telegram для 2FA' })
      return
    }
    setSaving(true)
    try {
      const next = !profile.twoFactorEnabled
      const res = await apiFetch('/api/admin/user/profile', {
        method: 'PATCH',
        body: JSON.stringify({ twoFactorEnabled: next }),
      })
      if (!res.ok) { showMsg({ type: 'error', text: 'Ошибка сохранения' }); return }
      setProfile((p) => p ? { ...p, twoFactorEnabled: next } : p)
      showMsg({ type: 'success', text: next ? '2FA включена' : '2FA отключена' })
    } catch {
      showMsg({ type: 'error', text: 'Ошибка сети' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div
      className="fixed inset-0 bg-black/40 flex items-center justify-center z-50"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-base font-semibold text-[var(--color-charcoal)]">Настройки аккаунта</h2>
          <button
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-100 px-6">
          {[
            { key: 'telegram', label: 'Telegram', icon: MessageCircle },
            { key: 'security', label: 'Безопасность', icon: Shield },
          ].map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setTab(key as typeof tab)}
              className={`flex items-center gap-1.5 px-3 py-3 text-sm font-medium border-b-2 -mb-px transition-colors ${
                tab === key
                  ? 'border-[var(--color-rose)] text-[var(--color-rose)]'
                  : 'border-transparent text-gray-500 hover:text-[var(--color-charcoal)]'
              }`}
            >
              <Icon size={14} />
              {label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="px-6 py-5">
          {loading ? (
            <p className="text-sm text-gray-400 text-center py-8">Загрузка...</p>
          ) : (
            <>
              {msg && (
                <div className={`flex items-center gap-2 text-sm px-3 py-2 rounded-lg mb-4 ${
                  msg.type === 'success'
                    ? 'bg-green-50 text-green-700 border border-green-200'
                    : 'bg-red-50 text-red-700 border border-red-200'
                }`}>
                  {msg.type === 'success' ? <CheckCircle size={14} /> : <AlertCircle size={14} />}
                  {msg.text}
                </div>
              )}

              {tab === 'telegram' && (
                <div className="space-y-4">
                  <div>
                    <h3 className="text-sm font-medium text-[var(--color-charcoal)] mb-1">Ваш Telegram</h3>
                    <p className="text-xs text-gray-500">
                      Укажите ваш Chat ID в Telegram. Используется для уведомлений и двухфакторной аутентификации.
                    </p>
                  </div>
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs text-blue-800 space-y-1">
                    <p className="font-medium">Как получить Chat ID:</p>
                    <p>1. Напишите боту <span className="font-mono">@userinfobot</span></p>
                    <p>2. Он ответит вашим Chat ID (число)</p>
                    <p>3. Вставьте его ниже и нажмите «Тест»</p>
                  </div>
                  <form onSubmit={saveTelegram} className="space-y-3">
                    <div className="flex gap-2">
                      <input
                        type="number"
                        value={telegramInput}
                        onChange={(e) => setTelegramInput(e.target.value)}
                        placeholder="Chat ID (например: 123456789)"
                        className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[var(--color-rose)]"
                      />
                      <button
                        type="button"
                        onClick={handleTestTelegram}
                        disabled={testing || !telegramInput.trim()}
                        className="flex items-center gap-1.5 px-3 py-2 border border-blue-300 text-blue-600 rounded-lg text-sm hover:bg-blue-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                      >
                        <FlaskConical size={13} />
                        {testing ? '...' : 'Тест'}
                      </button>
                    </div>
                    <div className="flex gap-2">
                      {profile?.telegramChatId && (
                        <button
                          type="button"
                          onClick={() => { setTelegramInput(''); void apiFetch('/api/admin/user/profile', { method: 'PATCH', body: JSON.stringify({ telegramChatId: null }) }).then(() => setProfile((p) => p ? { ...p, telegramChatId: null } : p)) }}
                          className="px-4 py-2 border border-gray-300 text-gray-600 rounded-lg text-sm hover:bg-gray-50 transition-colors"
                        >
                          Отвязать
                        </button>
                      )}
                      <button
                        type="submit"
                        disabled={saving}
                        className="flex-1 px-4 py-2 bg-[var(--color-rose)] text-white rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-50 transition-opacity"
                      >
                        {saving ? 'Сохранение...' : 'Сохранить'}
                      </button>
                    </div>
                  </form>

                  {profile?.telegramChatId && (
                    <div className="flex items-center gap-2 text-xs text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2">
                      <CheckCircle size={13} />
                      Telegram подключён (ID: {profile.telegramChatId})
                    </div>
                  )}
                </div>
              )}

              {tab === 'security' && (
                <div className="space-y-4">
                  <div>
                    <h3 className="text-sm font-medium text-[var(--color-charcoal)] mb-1">Двухфакторная аутентификация</h3>
                    <p className="text-xs text-gray-500">
                      При включённой 2FA при входе на ваш Telegram придёт код подтверждения.
                    </p>
                  </div>

                  {!profile?.telegramChatId && (
                    <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-800">
                      <AlertCircle size={14} className="flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="font-medium">Telegram не подключён</p>
                        <p>Для включения 2FA сначала подключите Telegram на вкладке «Telegram».</p>
                        <button
                          onClick={() => setTab('telegram')}
                          className="mt-1 underline font-medium"
                        >
                          Перейти к настройке
                        </button>
                      </div>
                    </div>
                  )}

                  <div className="flex items-center justify-between p-4 border border-gray-200 rounded-xl">
                    <div>
                      <p className="text-sm font-medium text-[var(--color-charcoal)]">2FA через Telegram</p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {profile?.twoFactorEnabled ? 'Включена' : 'Отключена'}
                      </p>
                    </div>
                    <button
                      onClick={toggle2FA}
                      disabled={saving}
                      className={`relative w-11 h-6 rounded-full transition-colors flex-shrink-0 ${
                        profile?.twoFactorEnabled ? 'bg-[var(--color-rose)]' : 'bg-gray-300'
                      } disabled:opacity-50`}
                    >
                      <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                        profile?.twoFactorEnabled ? 'translate-x-5' : 'translate-x-0'
                      }`} />
                    </button>
                  </div>

                  {profile?.twoFactorEnabled && (
                    <div className="flex items-center gap-2 text-xs text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2">
                      <Shield size={13} />
                      2FA активна. При следующем входе потребуется код из Telegram.
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
