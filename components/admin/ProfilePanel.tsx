'use client'

import { useState, useEffect, useTransition } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'
import { CheckCircle, AlertCircle, FlaskConical, Shield, LogOut } from 'lucide-react'
import { setLocaleCookie } from '@/app/actions'
import type { InlineMessage } from './types'

const LOCALES = [
  { code: 'uk', label: 'Українська', flag: 'UA' },
  { code: 'ru', label: 'Русский', flag: 'RU' },
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

interface ProfilePanelProps {
  apiFetch: (path: string, options?: RequestInit) => Promise<Response>
  onSignOut: () => void
}

/** iOS-Settings-style profile page (mobile). Telegram, Security (2FA), Language, Sign out. */
export function ProfilePanel({ apiFetch, onSignOut }: ProfilePanelProps) {
  const t = useTranslations('admin.user_settings')
  const tAdmin = useTranslations('admin')
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
    void (async () => {
      setLoading(true)
      try {
        const res = await apiFetch('/api/admin/user/profile')
        if (!res.ok) return
        const data = (await res.json()) as UserProfile
        setProfile(data)
        setTelegramInput(data.telegramChatId ?? '')
      } catch {
        /* ignore */
      } finally {
        setLoading(false)
      }
    })()
  }, [apiFetch])

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
      setProfile((p) => (p ? { ...p, telegramChatId: chatId } : p))
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
      setProfile((p) => (p ? { ...p, twoFactorEnabled: next } : p))
      showMsg({ type: 'success', text: next ? t('success_2fa_on') : t('success_2fa_off') })
    } catch {
      showMsg({ type: 'error', text: t('error_network') })
    } finally {
      setSaving(false)
    }
  }

  const groupCls = 'rounded-2xl bg-white border border-black/5 overflow-hidden'
  const sectionLabelCls = 'px-1 pb-1.5 pt-1 text-[13px] font-medium uppercase tracking-wide text-gray-400'

  if (loading) {
    return <p className="text-sm text-gray-400 text-center py-10">{t('loading')}</p>
  }

  return (
    <div className="space-y-7 pb-4">
      {profile && (
        <div className="flex items-center gap-3 px-1">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--color-rose)] text-white text-lg font-semibold">
            {(profile.name || profile.email).charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0">
            <p className="truncate text-base font-semibold text-[var(--color-charcoal)]">{profile.name || profile.email}</p>
            <p className="truncate text-xs text-gray-500">{profile.email}</p>
          </div>
        </div>
      )}

      {msg && (
        <div className={`flex items-center gap-2 text-sm px-3 py-2 rounded-xl ${
          msg.type === 'success'
            ? 'bg-green-50 text-green-700 border border-green-200'
            : 'bg-red-50 text-red-700 border border-red-200'
        }`}>
          {msg.type === 'success' ? <CheckCircle size={15} /> : <AlertCircle size={15} />}
          {msg.text}
        </div>
      )}

      {/* Telegram */}
      <section>
        <p className={sectionLabelCls}>Telegram</p>
        <div className={`${groupCls} p-4 space-y-3`}>
          <p className="text-xs text-gray-500">{t('telegram_desc')}</p>
          <form onSubmit={saveTelegram} className="space-y-3">
            <div className="flex gap-2">
              <input
                type="number"
                value={telegramInput}
                onChange={(e) => setTelegramInput(e.target.value)}
                placeholder={t('chat_id_placeholder')}
                className="flex-1 border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-[var(--color-rose)]"
              />
              <button
                type="button"
                onClick={handleTestTelegram}
                disabled={testing || !telegramInput.trim()}
                className="flex items-center gap-1.5 px-3 py-2.5 border border-blue-300 text-blue-600 rounded-xl text-sm hover:bg-blue-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <FlaskConical size={13} />
                {testing ? t('testing') : t('test_btn')}
              </button>
            </div>
            <button
              type="submit"
              disabled={saving}
              className="w-full px-4 py-2.5 bg-[var(--color-rose)] text-white rounded-xl text-sm font-medium hover:opacity-90 disabled:opacity-50 transition-opacity"
            >
              {saving ? t('saving') : t('save_btn')}
            </button>
          </form>
          {profile?.telegramChatId && (
            <div className="flex items-center gap-2 text-xs text-green-700 bg-green-50 border border-green-200 rounded-xl px-3 py-2">
              <CheckCircle size={13} />
              {t('telegram_connected', { id: profile.telegramChatId })}
            </div>
          )}
        </div>
      </section>

      {/* Security */}
      <section>
        <p className={sectionLabelCls}>{t('tab_security')}</p>
        <div className={`${groupCls}`}>
          {!profile?.telegramChatId && (
            <div className="flex items-start gap-2 bg-amber-50 border-b border-amber-200 p-3 text-xs text-amber-800">
              <AlertCircle size={14} className="flex-shrink-0 mt-0.5" />
              <p>{t('no_telegram_desc')}</p>
            </div>
          )}
          <div className="flex items-center justify-between p-4">
            <div className="pr-3">
              <p className="text-sm font-medium text-[var(--color-charcoal)]">{t('twofa_label')}</p>
              <p className="text-xs text-gray-500 mt-0.5">
                {profile?.twoFactorEnabled ? t('twofa_enabled') : t('twofa_disabled')}
              </p>
            </div>
            <button
              onClick={toggle2FA}
              disabled={saving}
              aria-label={t('twofa_label')}
              className={`relative w-12 h-7 rounded-full transition-colors flex-shrink-0 ${
                profile?.twoFactorEnabled ? 'bg-[var(--color-rose)]' : 'bg-gray-300'
              } disabled:opacity-50`}
            >
              <span className={`absolute top-0.5 left-0.5 w-6 h-6 bg-white rounded-full shadow transition-transform ${
                profile?.twoFactorEnabled ? 'translate-x-5' : 'translate-x-0'
              }`} />
            </button>
          </div>
          {profile?.twoFactorEnabled && (
            <div className="flex items-center gap-2 text-xs text-green-700 bg-green-50 border-t border-green-200 px-4 py-2">
              <Shield size={13} />
              {t('twofa_active_msg')}
            </div>
          )}
        </div>
      </section>

      {/* Language */}
      <section>
        <p className={sectionLabelCls}>{t('tab_language')}</p>
        <div className={`${groupCls} divide-y divide-black/5`}>
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
                className="w-full flex items-center justify-between px-4 py-3.5 text-left transition-colors active:bg-black/5 disabled:opacity-100"
              >
                <span className="text-sm font-medium text-[var(--color-charcoal)]">{label}</span>
                {isActive ? (
                  <CheckCircle size={18} className="text-[var(--color-rose)]" />
                ) : (
                  <span className="text-xs font-semibold px-2 py-0.5 rounded bg-gray-100 text-gray-500">{flag}</span>
                )}
              </button>
            )
          })}
        </div>
      </section>

      {/* Sign out */}
      <section>
        <button
          onClick={onSignOut}
          className="w-full flex items-center justify-center gap-2 rounded-2xl bg-white border border-black/5 px-4 py-3.5 text-sm font-medium text-red-600 active:bg-red-50 transition-colors"
        >
          <LogOut size={16} />
          {tAdmin('logout_btn')}
        </button>
      </section>
    </div>
  )
}
