'use client'

import { useState, useEffect, useCallback } from 'react'
import { useTranslations } from 'next-intl'
import { ShieldAlert, LogOut, History, MonitorSmartphone } from 'lucide-react'
import { prettyUserAgent } from '@/lib/user-agent'
import type { InlineMessage } from './types'

interface AuditRow {
  id: string
  event: string
  email: string | null
  ip_address: string | null
  user_agent: string | null
  country: string | null
  city: string | null
  is_new_location: boolean
  created_at: string
}

interface SessionRow {
  id?: string
  token: string
  ipAddress?: string | null
  userAgent?: string | null
  createdAt?: string
  expiresAt?: string
}

interface SecurityTabProps {
  apiFetch: (path: string, options?: RequestInit) => Promise<Response>
  onUnauth: () => void
}

const EVENT_STYLE: Record<string, string> = {
  LOGIN_SUCCESS: 'bg-green-100 text-green-700',
  TWO_FACTOR_SUCCESS: 'bg-green-100 text-green-700',
  LOGIN_FAILED: 'bg-red-100 text-red-700',
  TWO_FACTOR_FAILED: 'bg-red-100 text-red-700',
  OTP_SENT: 'bg-gray-100 text-gray-600',
  LOGOUT: 'bg-gray-100 text-gray-600',
}

function fmt(iso: string | null | undefined): string {
  if (!iso) return '—'
  return new Date(iso).toISOString().replace('T', ' ').slice(0, 16) + ' UTC'
}

export function SecurityTab({ apiFetch, onUnauth }: SecurityTabProps) {
  const t = useTranslations('admin.security_panel')

  const [logs, setLogs] = useState<AuditRow[]>([])
  const [sessions, setSessions] = useState<SessionRow[]>([])
  const [currentToken, setCurrentToken] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [revoking, setRevoking] = useState<string | null>(null)
  const [msg, setMsg] = useState<InlineMessage | null>(null)

  const showMsg = (m: InlineMessage) => {
    setMsg(m)
    setTimeout(() => setMsg(null), 3000)
  }

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await apiFetch('/api/admin/audit')
      if (res.status === 401) { onUnauth(); return }
      if (!res.ok) { showMsg({ type: 'error', text: t('error_load') }); return }
      const data = await res.json() as { logs: AuditRow[]; sessions: SessionRow[]; currentSessionToken: string | null }
      setLogs(data.logs ?? [])
      setSessions(data.sessions ?? [])
      setCurrentToken(data.currentSessionToken ?? null)
    } catch {
      showMsg({ type: 'error', text: t('error_load') })
    } finally {
      setLoading(false)
    }
  }, [apiFetch, onUnauth, t])

  useEffect(() => { load() }, [load])

  async function handleRevoke(token: string) {
    setRevoking(token)
    try {
      const res = await apiFetch('/api/admin/audit', {
        method: 'POST',
        body: JSON.stringify({ token }),
      })
      if (res.status === 401) { onUnauth(); return }
      if (!res.ok) { showMsg({ type: 'error', text: t('error_revoke') }); return }
      setSessions((prev) => prev.filter((s) => s.token !== token))
      showMsg({ type: 'success', text: t('success_revoke') })
    } catch {
      showMsg({ type: 'error', text: t('error_revoke') })
    } finally {
      setRevoking(null)
    }
  }

  const now = Date.now()
  const activeSessions = sessions.filter((s) => !s.expiresAt || new Date(s.expiresAt).getTime() > now)

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-lg font-semibold text-[var(--color-charcoal)]">{t('heading')}</h2>
        <p className="text-sm text-gray-500 mt-0.5">{t('subtitle')}</p>
      </div>

      {msg && (
        <p
          className={`text-sm px-3 py-2 rounded-lg ${
            msg.type === 'success'
              ? 'bg-green-50 text-green-700 border border-green-200'
              : 'bg-red-50 text-red-700 border border-red-200'
          }`}
        >
          {msg.text}
        </p>
      )}

      {/* Active sessions */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <MonitorSmartphone size={16} className="text-gray-400" />
          <h3 className="text-sm font-semibold text-[var(--color-charcoal)]">{t('sessions_heading')}</h3>
        </div>

        {loading ? (
          <p className="text-sm text-gray-400">{t('loading')}</p>
        ) : activeSessions.length === 0 ? (
          <p className="text-sm text-gray-400">{t('sessions_empty')}</p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-[var(--color-blush)]">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-[var(--color-blush)]">
                  <th className="px-4 py-3 text-left font-medium text-gray-600">{t('col_device')}</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">{t('col_ip')}</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">{t('col_signed_in')}</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">{t('col_expires')}</th>
                  <th className="px-4 py-3 text-right font-medium text-gray-600">{t('col_action')}</th>
                </tr>
              </thead>
              <tbody>
                {activeSessions.map((s) => (
                  <tr key={s.token} className="border-b border-[var(--color-blush)] last:border-0 hover:bg-gray-50/50">
                    <td className="px-4 py-3 text-[var(--color-charcoal)]">{prettyUserAgent(s.userAgent)}</td>
                    <td className="px-4 py-3 text-gray-500 font-mono">{s.ipAddress ?? '—'}</td>
                    <td className="px-4 py-3 text-gray-500">{fmt(s.createdAt)}</td>
                    <td className="px-4 py-3 text-gray-500">{fmt(s.expiresAt)}</td>
                    <td className="px-4 py-3 text-right">
                      {s.token === currentToken ? (
                        <span className="text-xs text-green-600">{t('this_device')}</span>
                      ) : (
                        <button
                          onClick={() => handleRevoke(s.token)}
                          disabled={revoking === s.token}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 border border-gray-300 text-gray-600 rounded-lg text-xs font-medium hover:border-red-300 hover:text-red-600 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          <LogOut size={12} />
                          {revoking === s.token ? t('revoking') : t('revoke')}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Audit log */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <History size={16} className="text-gray-400" />
          <h3 className="text-sm font-semibold text-[var(--color-charcoal)]">{t('audit_heading')}</h3>
        </div>

        {loading ? (
          <p className="text-sm text-gray-400">{t('loading')}</p>
        ) : logs.length === 0 ? (
          <p className="text-sm text-gray-400">{t('audit_empty')}</p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-[var(--color-blush)]">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-[var(--color-blush)]">
                  <th className="px-4 py-3 text-left font-medium text-gray-600">{t('col_event')}</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">{t('col_account')}</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">{t('col_location')}</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">{t('col_ip')}</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">{t('col_device')}</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">{t('col_when')}</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((l) => {
                  const location = [l.city, l.country].filter(Boolean).join(', ') || '—'
                  return (
                    <tr key={l.id} className="border-b border-[var(--color-blush)] last:border-0 hover:bg-gray-50/50">
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${EVENT_STYLE[l.event] ?? 'bg-gray-100 text-gray-600'}`}>
                          {t(`event_${l.event}`)}
                        </span>
                        {l.is_new_location && (
                          <span className="ml-1.5 inline-flex items-center gap-0.5 align-middle text-[11px] text-[var(--color-rose)]" title={t('new_location')}>
                            <ShieldAlert size={11} />
                            {t('new_location_badge')}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-gray-500">{l.email ?? '—'}</td>
                      <td className="px-4 py-3 text-gray-500">{location}</td>
                      <td className="px-4 py-3 text-gray-500 font-mono">{l.ip_address ?? '—'}</td>
                      <td className="px-4 py-3 text-gray-500">{prettyUserAgent(l.user_agent)}</td>
                      <td className="px-4 py-3 text-gray-500 whitespace-nowrap">{fmt(l.created_at)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
