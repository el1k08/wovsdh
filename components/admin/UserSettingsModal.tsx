'use client'

import { useState, useEffect, useTransition } from 'react'
import { X, MessageCircle, Shield, CheckCircle, AlertCircle, FlaskConical, Languages } from 'lucide-react'
import { useLocale, useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'
import { setLocaleCookie } from '@/app/actions'
import type { InlineMessage } from './types'

const LOCALES = [
  { code: 'uk', label: 'Українська', flag: 'UA' },
  { code: 'he', label: 'עברית', flag: 'HE' },
  { code: 'en', label: 'English', flag: 'EN' },
] as const

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
  const t = useTranslations('admin.user_settings')
  const [tab, setTab] = useState<'telegram' | 'security' | 'language'>('telegram')
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [msg, setMsg] = useState<InlineMessage | null>(null)
  const [saving, setSaving] = useState(false)
  const [telegramInput, setTelegramInput] = useState('')
  const [testing, setTesting] = useState(false)
  const locale = useLocale()
  const router = useRouter()
  const [localePending, startLocaleTransition] = useTransition()

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
      if (!res.ok) { showMsg({ type: 'error', text: t('error_save') }); return }
      setProfile((p) => p ? { ...p, telegramChatId: chatId } : p)
      showMsg({ type: 'success', text: t('success_telegram') })
    } catch {
      showMsg({ type: 'error', text: t('error_network') })
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
      if (!res.ok) { showMsg({ type: 'error', text: t('error_test') }); return }
      showMsg({ type: 'success', text: t('success_test') })
    } catch {
      showMsg({ type: 'error', text: t('error_network') })
    } finally {
      setTesting(false)
    }
  }

  async function toggle2FA() {
    if (!profile) return
    if (!profile.twoFactorEnabled && !profile.telegramChatId) {
      setTab('telegram')
      showMsg({ type: 'error', text: t('error_no_telegram') })
      return
    }
    setSaving(true)
    try {
      const next = !profile.twoFactorEnabled
      const res = await apiFetch('/api/admin/user/profile', {
        method: 'PATCH',
        body: JSON.stringify({ twoFactorEnabled: next }),
      })
      if (!res.ok) { showMsg({ type: 'error', text: t('error_save') }); return }
      setProfile((p) => p ? { ...p, twoFactorEnabled: next } : p)
      showMsg({ type: 'success', text: next ? t('success_2fa_on') : t('success_2fa_off') })
    } catch {
      showMsg({ type: 'error', text: t('error_network') })
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
          <h2 className="text-base font-semibold text-[var(--color-charcoal)]">{t('heading')}</h2>
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
            { key: 'security', label: t('tab_security'), icon: Shield },
            { key: 'language', label: t('tab_language'), icon: Languages },
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
            <p className="text-sm text-gray-400 text-center py-8">{t('loading')}</p>
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
                    <h3 className="text-sm font-medium text-[var(--color-charcoal)] mb-1">{t('telegram_heading')}</h3>
                    <p className="text-xs text-gray-500">{t('telegram_desc')}</p>
                  </div>
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs text-blue-800 space-y-1">
                    <p className="font-medium">{t('how_to_get')}</p>
                    <p>1. {t('how_step_1')}</p>
                    <p>2. {t('how_step_2')}</p>
                    <p>3. {t('how_step_3')}</p>
                  </div>
                  <form onSubmit={saveTelegram} className="space-y-3">
                    <div className="flex gap-2">
                      <input
                        type="number"
                        value={telegramInput}
                        onChange={(e) => setTelegramInput(e.target.value)}
                        placeholder={t('chat_id_placeholder')}
                        className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[var(--color-rose)]"
                      />
                      <button
                        type="button"
                        onClick={handleTestTelegram}
                        disabled={testing || !telegramInput.trim()}
                        className="flex items-center gap-1.5 px-3 py-2 border border-blue-300 text-blue-600 rounded-lg text-sm hover:bg-blue-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                      >
                        <FlaskConical size={13} />
                        {testing ? t('testing') : t('test_btn')}
                      </button>
                    </div>
                    <div className="flex gap-2">
                      {profile?.telegramChatId && (
                        <button
                          type="button"
                          onClick={() => {
                            setTelegramInput('')
                            void apiFetch('/api/admin/user/profile', {
                              method: 'PATCH',
                              body: JSON.stringify({ telegramChatId: null }),
                            }).then(() => setProfile((p) => p ? { ...p, telegramChatId: null } : p))
                          }}
                          className="px-4 py-2 border border-gray-300 text-gray-600 rounded-lg text-sm hover:bg-gray-50 transition-colors"
                        >
                          {t('unlink_btn')}
                        </button>
                      )}
                      <button
                        type="submit"
                        disabled={saving}
                        className="flex-1 px-4 py-2 bg-[var(--color-rose)] text-white rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-50 transition-opacity"
                      >
                        {saving ? t('saving') : t('save_btn')}
                      </button>
                    </div>
                  </form>

                  {profile?.telegramChatId && (
                    <div className="flex items-center gap-2 text-xs text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2">
                      <CheckCircle size={13} />
                      {t('telegram_connected', { id: profile.telegramChatId })}
                    </div>
                  )}
                </div>
              )}

              {tab === 'language' && (
                <div className="space-y-4">
                  <div>
                    <h3 className="text-sm font-medium text-[var(--color-charcoal)] mb-1">{t('language_heading')}</h3>
                    <p className="text-xs text-gray-500">{t('language_desc')}</p>
                  </div>
                  <div className="space-y-2">
                    {LOCALES.map(({ code, label, flag }) => {
                      const isActive = locale === code
                      return (
                        <button
                          key={code}
                          onClick={() => {
                            if (isActive) return
                            startLocaleTransition(async () => {
                              await setLocaleCookie(code)
                              router.refresh()
                            })
                          }}
                          disabled={localePending || isActive}
                          className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border-2 transition-colors ${
                            isActive
                              ? 'border-[var(--color-rose)] bg-[var(--color-blush)]'
                              : 'border-gray-200 hover:border-[var(--color-rose)] hover:bg-gray-50'
                          } disabled:opacity-60`}
                        >
                          <span className="text-sm font-medium text-[var(--color-charcoal)]">{label}</span>
                          <span className={`text-xs font-semibold px-2 py-0.5 rounded ${
                            isActive ? 'bg-[var(--color-rose)] text-white' : 'bg-gray-100 text-gray-500'
                          }`}>{flag}</span>
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}

              {tab === 'security' && (
                <div className="space-y-4">
                  <div>
                    <h3 className="text-sm font-medium text-[var(--color-charcoal)] mb-1">{t('security_heading')}</h3>
                    <p className="text-xs text-gray-500">{t('security_desc')}</p>
                  </div>

                  {!profile?.telegramChatId && (
                    <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-800">
                      <AlertCircle size={14} className="flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="font-medium">{t('no_telegram_title')}</p>
                        <p>{t('no_telegram_desc')}</p>
                        <button
                          onClick={() => setTab('telegram')}
                          className="mt-1 underline font-medium"
                        >
                          {t('no_telegram_link')}
                        </button>
                      </div>
                    </div>
                  )}

                  <div className="flex items-center justify-between p-4 border border-gray-200 rounded-xl">
                    <div>
                      <p className="text-sm font-medium text-[var(--color-charcoal)]">{t('twofa_label')}</p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {profile?.twoFactorEnabled ? t('twofa_enabled') : t('twofa_disabled')}
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
                      {t('twofa_active_msg')}
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
