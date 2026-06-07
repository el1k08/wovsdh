'use client'

import { useState, useEffect } from 'react'
import { Trash2, CheckCircle, AlertCircle, Link2Off } from 'lucide-react'
import { useTranslations } from 'next-intl'
import type { InlineMessage } from './types'

interface InstagramTabProps {
  apiFetch: (path: string, options?: RequestInit) => Promise<Response>
}

export function InstagramTab({ apiFetch }: InstagramTabProps) {
  const t = useTranslations('admin.instagram_tab')
  const [connected, setConnected] = useState(false)
  const [loading, setLoading] = useState(true)
  const [tokenInput, setTokenInput] = useState('')
  const [saving, setSaving] = useState(false)
  const [removing, setRemoving] = useState(false)
  const [msg, setMsg] = useState<InlineMessage | null>(null)

  const showMsg = (m: InlineMessage) => {
    setMsg(m)
    setTimeout(() => setMsg(null), 5000)
  }

  useEffect(() => {
    void load()
  }, [])

  async function load() {
    setLoading(true)
    try {
      const res = await apiFetch('/api/admin/instagram')
      if (!res.ok) return
      const data = await res.json() as { connected: boolean }
      setConnected(data.connected)
    } catch {
      /* ignore */
    } finally {
      setLoading(false)
    }
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    const token = tokenInput.trim()
    if (!token) return
    setSaving(true)
    try {
      const res = await apiFetch('/api/admin/instagram', {
        method: 'POST',
        body: JSON.stringify({ token }),
      })
      if (!res.ok) {
        const d = await res.json() as { error?: { message?: string } }
        showMsg({ type: 'error', text: d.error?.message ?? t('error_save') })
        return
      }
      setConnected(true)
      setTokenInput('')
      showMsg({ type: 'success', text: t('success_connected') })
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
      const res = await apiFetch('/api/admin/instagram', { method: 'DELETE' })
      if (!res.ok) { showMsg({ type: 'error', text: t('error_remove') }); return }
      setConnected(false)
      showMsg({ type: 'success', text: t('success_removed') })
    } catch {
      showMsg({ type: 'error', text: t('error_network') })
    } finally {
      setRemoving(false)
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
        <>
          {connected ? (
            <div className="space-y-4">
              <div className="flex items-center gap-3 p-4 bg-green-50 border border-green-200 rounded-xl">
                <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-green-600" aria-hidden="true"><rect x="2" y="2" width="20" height="20" rx="5" ry="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none"/></svg>
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-green-800">{t('connected_title')}</p>
                  <p className="text-xs text-green-600 mt-0.5">{t('connected_desc')}</p>
                </div>
                <button
                  onClick={handleRemove}
                  disabled={removing}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-red-500 hover:text-red-700 hover:bg-red-50 border border-red-200 rounded-lg transition-colors disabled:opacity-40"
                >
                  <Link2Off size={13} />
                  {removing ? t('removing') : t('remove_btn')}
                </button>
              </div>
              <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl text-sm text-blue-800 space-y-1">
                <p className="font-medium">{t('auto_refresh_title')}</p>
                <p>{t('auto_refresh_desc')}</p>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-800 space-y-2">
                <p className="font-medium">{t('how_title')}</p>
                <p>1. {t('how_step_1')}</p>
                <p>2. {t('how_step_2')}</p>
                <p>3. {t('how_step_3')}</p>
              </div>
              <form onSubmit={handleSave} className="space-y-3">
                <textarea
                  value={tokenInput}
                  onChange={(e) => setTokenInput(e.target.value)}
                  placeholder={t('token_placeholder')}
                  rows={3}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:border-[var(--color-rose)] resize-none"
                  required
                />
                <button
                  type="submit"
                  disabled={saving || !tokenInput.trim()}
                  className="w-full px-4 py-2.5 bg-[var(--color-rose)] text-white rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-50 transition-opacity"
                >
                  {saving ? t('saving') : t('save_btn')}
                </button>
              </form>
            </div>
          )}
        </>
      )}
    </div>
  )
}
