'use client'

import { useState, useEffect } from 'react'
import { CheckCircle, AlertCircle, Trash2, FlaskConical } from 'lucide-react'
import { useTranslations } from 'next-intl'
import type { InlineMessage } from './types'

interface TwilioStatus {
  enabled: boolean
  from: string | null
  configured: boolean
}

interface TwilioTabProps {
  apiFetch: (path: string, options?: RequestInit) => Promise<Response>
}

export function TwilioTab({ apiFetch }: TwilioTabProps) {
  const t = useTranslations('admin.twilio_tab')
  const [status, setStatus] = useState<TwilioStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [msg, setMsg] = useState<InlineMessage | null>(null)
  const [saving, setSaving] = useState(false)
  const [removing, setRemoving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [toggling, setToggling] = useState(false)

  const [accountSid, setAccountSid] = useState('')
  const [authToken, setAuthToken] = useState('')
  const [from, setFrom] = useState('')
  const [testPhone, setTestPhone] = useState('')

  const showMsg = (m: InlineMessage) => {
    setMsg(m)
    setTimeout(() => setMsg(null), 5000)
  }

  useEffect(() => { void load() }, [])

  async function load() {
    setLoading(true)
    try {
      const res = await apiFetch('/api/admin/twilio')
      if (!res.ok) return
      const data = await res.json() as TwilioStatus
      setStatus(data)
    } catch { /* ignore */ } finally {
      setLoading(false)
    }
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!accountSid.trim() || !authToken.trim() || !from.trim()) return
    setSaving(true)
    try {
      const res = await apiFetch('/api/admin/twilio', {
        method: 'POST',
        body: JSON.stringify({ accountSid: accountSid.trim(), authToken: authToken.trim(), from: from.trim(), enabled: true }),
      })
      if (!res.ok) { showMsg({ type: 'error', text: t('error_save') }); return }
      setAccountSid('')
      setAuthToken('')
      setFrom('')
      showMsg({ type: 'success', text: t('success_saved') })
      void load()
    } catch {
      showMsg({ type: 'error', text: t('error_network') })
    } finally {
      setSaving(false)
    }
  }

  async function handleRemove() {
    if (!confirm(t('remove_confirm'))) return
    setRemoving(true)
    try {
      const res = await apiFetch('/api/admin/twilio', { method: 'DELETE' })
      if (!res.ok) { showMsg({ type: 'error', text: t('error_remove') }); return }
      setStatus(null)
      showMsg({ type: 'success', text: t('success_removed') })
    } catch {
      showMsg({ type: 'error', text: t('error_network') })
    } finally {
      setRemoving(false)
    }
  }

  async function handleToggle() {
    if (!status) return
    setToggling(true)
    try {
      const res = await apiFetch('/api/admin/twilio', {
        method: 'PATCH',
        body: JSON.stringify({ enabled: !status.enabled }),
      })
      if (!res.ok) { showMsg({ type: 'error', text: t('error_save') }); return }
      setStatus((s) => s ? { ...s, enabled: !s.enabled } : s)
    } catch {
      showMsg({ type: 'error', text: t('error_network') })
    } finally {
      setToggling(false)
    }
  }

  async function handleTest(e: React.FormEvent) {
    e.preventDefault()
    if (!testPhone.trim()) return
    setTesting(true)
    try {
      const res = await apiFetch('/api/admin/twilio', {
        method: 'POST',
        body: JSON.stringify({ action: 'test', testPhone: testPhone.trim() }),
      })
      if (!res.ok) { showMsg({ type: 'error', text: t('error_test') }); return }
      showMsg({ type: 'success', text: t('success_test') })
    } catch {
      showMsg({ type: 'error', text: t('error_network') })
    } finally {
      setTesting(false)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-[var(--color-charcoal)]">{t('heading')}</h2>
        <p className="text-sm text-gray-500 mt-0.5">{t('desc')}</p>
      </div>

      {msg && (
        <div className={`flex items-center gap-2 text-sm px-3 py-2 rounded-lg ${
          msg.type === 'success'
            ? 'bg-green-50 text-green-700 border border-green-200'
            : 'bg-red-50 text-red-700 border border-red-200'
        }`}>
          {msg.type === 'success' ? <CheckCircle size={14} /> : <AlertCircle size={14} />}
          {msg.text}
        </div>
      )}

      {loading ? (
        <p className="text-sm text-gray-400">{t('loading')}</p>
      ) : (
        <div className="space-y-6">
          {/* Credentials form */}
          <div className="border border-gray-200 rounded-xl p-5 space-y-4">
            <p className="text-sm font-medium text-[var(--color-charcoal)]">{t('credentials_heading')}</p>
            <form onSubmit={handleSave} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">{t('account_sid_label')}</label>
                <input
                  type="text"
                  value={accountSid}
                  onChange={(e) => setAccountSid(e.target.value)}
                  placeholder="ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:border-[var(--color-rose)]"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">{t('auth_token_label')}</label>
                <input
                  type="password"
                  value={authToken}
                  onChange={(e) => setAuthToken(e.target.value)}
                  placeholder="••••••••••••••••••••••••••••••••"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:border-[var(--color-rose)]"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">{t('from_label')}</label>
                <input
                  type="text"
                  value={from}
                  onChange={(e) => setFrom(e.target.value)}
                  placeholder="+14155238886"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:border-[var(--color-rose)]"
                  required
                />
                <p className="text-xs text-gray-400 mt-1">{t('from_hint')}</p>
              </div>
              <button
                type="submit"
                disabled={saving}
                className="w-full px-4 py-2.5 bg-[var(--color-rose)] text-white rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-50 transition-opacity"
              >
                {saving ? t('saving') : t('save_btn')}
              </button>
            </form>
          </div>

          {/* Status + controls */}
          {status?.configured && (
            <div className="border border-gray-200 rounded-xl p-5 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-[var(--color-charcoal)]">{t('status_heading')}</p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {t('from_saved')}: <span className="font-mono">{status.from}</span>
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-500">{status.enabled ? t('enabled') : t('disabled')}</span>
                  <button
                    onClick={handleToggle}
                    disabled={toggling}
                    className={`relative w-11 h-6 rounded-full transition-colors flex-shrink-0 ${
                      status.enabled ? 'bg-[var(--color-rose)]' : 'bg-gray-300'
                    } disabled:opacity-50`}
                  >
                    <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                      status.enabled ? 'translate-x-5' : 'translate-x-0'
                    }`} />
                  </button>
                </div>
              </div>

              {/* Test message */}
              <form onSubmit={handleTest} className="flex gap-2">
                <input
                  type="tel"
                  value={testPhone}
                  onChange={(e) => setTestPhone(e.target.value)}
                  placeholder="+972501234567"
                  className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[var(--color-rose)]"
                  required
                />
                <button
                  type="submit"
                  disabled={testing || !testPhone.trim()}
                  className="flex items-center gap-1.5 px-3 py-2 border border-blue-300 text-blue-600 rounded-lg text-sm hover:bg-blue-50 disabled:opacity-40 transition-colors"
                >
                  <FlaskConical size={13} />
                  {testing ? t('testing') : t('test_btn')}
                </button>
              </form>

              <button
                onClick={handleRemove}
                disabled={removing}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-red-500 hover:text-red-700 hover:bg-red-50 border border-red-200 rounded-lg transition-colors disabled:opacity-40"
              >
                <Trash2 size={13} />
                {removing ? t('removing') : t('remove_btn')}
              </button>
            </div>
          )}

          {/* Info box */}
          <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl text-sm text-blue-800 space-y-1">
            <p className="font-medium">{t('info_title')}</p>
            <p>• {t('info_on_booking')}</p>
            <p>• {t('info_on_confirm')}</p>
          </div>
        </div>
      )}
    </div>
  )
}
