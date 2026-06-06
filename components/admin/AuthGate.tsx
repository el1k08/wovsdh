'use client'

import React, { useState } from 'react'
import { useTranslations } from 'next-intl'
import { createClient } from '@supabase/supabase-js'

function getSupabaseClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  )
}

export function AuthGate({ onAuth }: { onAuth: (token: string) => void }) {
  const t = useTranslations('admin.login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!email.trim() || !password) {
      setError(t('error_empty'))
      return
    }

    setLoading(true)
    setError('')

    const supabase = getSupabaseClient()
    const { data, error: authError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    })

    setLoading(false)

    if (authError || !data.session) {
      setError(t('error_invalid'))
      return
    }

    onAuth(data.session.access_token)
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-[var(--color-cream)]">
      <div className="bg-white border border-[var(--color-blush)] rounded-xl p-8 w-full max-w-sm shadow-sm">
        <h1 className="text-xl font-semibold text-[var(--color-charcoal)] mb-6 text-center">
          {t('heading')}
        </h1>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <input
            type="email"
            placeholder={t('email_placeholder')}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="border border-gray-300 rounded-lg px-4 py-2 text-sm focus:outline-none focus:border-[var(--color-rose)]"
            autoFocus
            required
          />
          <input
            type="password"
            placeholder={t('password_placeholder')}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="border border-gray-300 rounded-lg px-4 py-2 text-sm focus:outline-none focus:border-[var(--color-rose)]"
            required
          />
          {error && <p className="text-red-500 text-xs">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="bg-[var(--color-rose)] text-white rounded-lg px-4 py-2 text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {loading ? t('loading') : t('submit')}
          </button>
        </form>
      </div>
    </main>
  )
}
