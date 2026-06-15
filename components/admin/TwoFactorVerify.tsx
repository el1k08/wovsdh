'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { Shield, RefreshCw, ClipboardPaste } from 'lucide-react'
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
  const [detected, setDetected] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    void sendCode()
  }, [])

  useEffect(() => {
    if (sent) inputRef.current?.focus()
  }, [sent])

  // Best-effort: when the user returns to the app (after copying the code in
  // Telegram), peek at the clipboard and offer a one-tap "paste" chip.
  const peekClipboard = useCallback(async () => {
    try {
      const text = await navigator.clipboard.readText()
      const m = text.match(/\b(\d{6})\b/)
      if (m) setDetected(m[1])
    } catch {
      /* clipboard not readable without a gesture — ignore */
    }
  }, [])

  useEffect(() => {
    if (!sent) return
    const onVisible = () => { if (document.visibilityState === 'visible') void peekClipboard() }
    document.addEventListener('visibilitychange', onVisible)
    void peekClipboard()
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [sent, peekClipboard])

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

  const verifyCode = useCallback(async (value: string) => {
    if (value.length < 6 || verifying) return
    setVerifying(true)
    setError(null)
    try {
      const res = await apiFetch('/api/admin/auth/2fa', {
        method: 'POST',
        body: JSON.stringify({ action: 'verify', code: value }),
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
  }, [apiFetch, verifying, onVerified, t])

  function handleVerify(e: React.FormEvent) {
    e.preventDefault()
    void verifyCode(code)
  }

  // Explicit gesture → read clipboard, fill and submit in one tap.
  async function pasteAndVerify() {
    try {
      const text = await navigator.clipboard.readText()
      const m = text.match(/\b(\d{6})\b/)
      if (m) {
        setCode(m[1])
        setDetected(null)
        void verifyCode(m[1])
      }
    } catch {
      setError(t('error_network'))
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
            autoComplete="one-time-code"
            pattern="[0-9]*"
            maxLength={6}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
            placeholder="000000"
            disabled={sending || verifying}
            className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 text-center text-2xl font-mono tracking-[0.5em] focus:outline-none focus:border-[var(--color-rose)] disabled:opacity-50 transition-colors"
          />

          {detected && detected !== code && (
            <button
              type="button"
              onClick={() => { setCode(detected); setDetected(null); void verifyCode(detected) }}
              className="w-full flex items-center justify-center gap-2 rounded-xl border border-[var(--color-rose)]/40 bg-[var(--color-blush)]/50 py-2.5 text-sm font-medium text-[var(--color-rose)] active:opacity-80 transition-opacity"
            >
              <ClipboardPaste size={15} />
              {t('paste_detected', { code: detected })}
            </button>
          )}

          <button
            type="submit"
            disabled={code.length < 6 || verifying || sending}
            className="w-full py-3 bg-[var(--color-rose)] text-white rounded-xl font-medium hover:opacity-90 disabled:opacity-40 transition-opacity"
          >
            {verifying ? t('verifying') : t('verify_btn')}
          </button>

          <button
            type="button"
            onClick={pasteAndVerify}
            disabled={sending || verifying}
            className="w-full flex items-center justify-center gap-1.5 text-sm text-gray-500 hover:text-[var(--color-charcoal)] disabled:opacity-40 transition-colors"
          >
            <ClipboardPaste size={14} />
            {t('paste')}
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
