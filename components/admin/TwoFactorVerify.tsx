'use client'

import { useState, useEffect, useRef } from 'react'
import { Shield, RefreshCw } from 'lucide-react'
import { useTranslations } from 'next-intl'

interface TwoFactorVerifyProps {
  apiFetch: (path: string, options?: RequestInit) => Promise<Response>
  onVerified: () => void
  onSignOut: () => void
}

export function TwoFactorVerify({ apiFetch, onVerified, onSignOut }: TwoFactorVerifyProps) {
  const t = useTranslations('admin.two_factor_verify')
  const [code, setCode] = useState('')
  const [sending, setSending] = useState(true)
  const [sent, setSent] = useState(false)
  const [verifying, setVerifying] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    void sendCode()
  }, [])

  useEffect(() => {
    if (sent) inputRef.current?.focus()
  }, [sent])

  async function sendCode() {
    setSending(true)
    setError(null)
    try {
      const res = await apiFetch('/api/admin/auth/2fa', {
        method: 'POST',
        body: JSON.stringify({ action: 'send' }),
      })
      if (!res.ok) {
        const d = await res.json() as { error?: { message?: string } }
        setError(d.error?.message ?? t('error_send'))
        return
      }
      setSent(true)
    } catch {
      setError(t('error_network'))
    } finally {
      setSending(false)
    }
  }

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault()
    if (code.length < 6) return
    setVerifying(true)
    setError(null)
    try {
      const res = await apiFetch('/api/admin/auth/2fa', {
        method: 'POST',
        body: JSON.stringify({ action: 'verify', code }),
      })
      if (!res.ok) {
        const d = await res.json() as { error?: { message?: string } }
        setError(d.error?.message ?? t('error_code'))
        setCode('')
        return
      }
      onVerified()
    } catch {
      setError(t('error_network'))
    } finally {
      setVerifying(false)
    }
  }

  return (
    <main className="app-shell font-ios min-h-screen bg-[var(--color-cream)] flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-8 space-y-6">
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="w-14 h-14 rounded-full bg-[var(--color-blush)] flex items-center justify-center">
            <Shield size={26} className="text-[var(--color-rose)]" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-[var(--color-charcoal)]">{t('heading')}</h1>
            <p className="text-sm text-gray-500 mt-1">
              {sending ? t('sending') : t('sent')}
            </p>
          </div>
        </div>

        {error && (
          <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-center">
            {error}
          </p>
        )}

        <form onSubmit={handleVerify} className="space-y-4">
          <input
            ref={inputRef}
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={6}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
            placeholder="000000"
            disabled={sending || verifying}
            className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 text-center text-2xl font-mono tracking-[0.5em] focus:outline-none focus:border-[var(--color-rose)] disabled:opacity-50 transition-colors"
          />
          <button
            type="submit"
            disabled={code.length < 6 || verifying || sending}
            className="w-full py-3 bg-[var(--color-rose)] text-white rounded-xl font-medium hover:opacity-90 disabled:opacity-40 transition-opacity"
          >
            {verifying ? t('verifying') : t('verify_btn')}
          </button>
        </form>

        <div className="flex items-center justify-between text-sm">
          <button
            onClick={sendCode}
            disabled={sending || verifying}
            className="flex items-center gap-1.5 text-gray-500 hover:text-[var(--color-charcoal)] disabled:opacity-40 transition-colors"
          >
            <RefreshCw size={13} />
            {t('resend')}
          </button>
          <button
            onClick={onSignOut}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            {t('sign_out')}
          </button>
        </div>
      </div>
    </main>
  )
}
