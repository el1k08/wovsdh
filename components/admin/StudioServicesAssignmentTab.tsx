'use client'

import { useState, useCallback, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import type { AdminServiceDTO, InlineMessage } from '@/components/admin/types'
import { formatDuration } from '@/components/admin/constants'

interface StudioServicesAssignmentTabProps {
  studio: string
  apiFetch: (path: string, options?: RequestInit) => Promise<Response>
  onUnauth: () => void
}

export function StudioServicesAssignmentTab({ studio, apiFetch, onUnauth }: StudioServicesAssignmentTabProps) {
  const t = useTranslations('admin.services_panel')
  const tCommon = useTranslations('common')
  const [services, setServices] = useState<AdminServiceDTO[]>([])
  const [assignedIds, setAssignedIds] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(false)
  const [savingId, setSavingId] = useState<string | null>(null)
  const [message, setMessage] = useState<InlineMessage | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setMessage(null)
    try {
      const [svcRes, assignRes] = await Promise.all([
        apiFetch('/api/admin/services'),
        apiFetch(`/api/admin/studio-services?studio_id=${studio}`),
      ])
      if (svcRes.status === 401 || assignRes.status === 401) { onUnauth(); return }
      if (!svcRes.ok) {
        setMessage({ type: 'error', text: t('error_load') })
        return
      }
      const svcData = await svcRes.json() as { services: AdminServiceDTO[] }
      setServices(svcData.services ?? [])
      if (assignRes.ok) {
        const assignData = await assignRes.json() as { service_ids: string[] }
        setAssignedIds(new Set(assignData.service_ids))
      }
    } catch {
      setMessage({ type: 'error', text: tCommon('network_error') })
    } finally {
      setLoading(false)
    }
  }, [studio, apiFetch, onUnauth, t, tCommon])

  useEffect(() => { load() }, [load])

  async function toggleAssignment(serviceId: string) {
    const wasAssigned = assignedIds.has(serviceId)
    const nextIds = new Set(assignedIds)
    if (wasAssigned) nextIds.delete(serviceId)
    else nextIds.add(serviceId)
    setAssignedIds(nextIds)
    setMessage(null)

    setSavingId(serviceId)
    try {
      const res = await apiFetch('/api/admin/studio-services', {
        method: 'PUT',
        body: JSON.stringify({ studio_id: studio, service_ids: [...nextIds] }),
      })
      if (res.status === 401) { onUnauth(); return }
      if (!res.ok) {
        setAssignedIds(assignedIds)
        setMessage({ type: 'error', text: t('error_update') })
      }
    } catch {
      setAssignedIds(assignedIds)
      setMessage({ type: 'error', text: tCommon('network_error') })
    } finally {
      setSavingId(null)
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-semibold text-[var(--color-charcoal)]">{t('assignment_heading')}</h2>
          <p className="text-xs text-gray-400 mt-0.5">
            {t('assignment_subtitle')}
          </p>
        </div>
        {message && (
          <p className={`text-sm ${message.type === 'success' ? 'text-green-600' : 'text-red-500'}`}>
            {message.text}
          </p>
        )}
      </div>

      {loading ? (
        <p className="text-sm text-gray-400 py-8 text-center">{tCommon('loading')}</p>
      ) : services.length === 0 ? (
        <p className="text-sm text-gray-400 py-8 text-center">{t('error_load')}</p>
      ) : (
        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3" role="list">
          {services.map((svc) => {
            const isAssigned = assignedIds.has(svc.id)
            const isSaving = savingId === svc.id
            return (
              <li
                key={svc.id}
                onClick={() => !isSaving && toggleAssignment(svc.id)}
                className={`group relative rounded-2xl border p-5 cursor-pointer transition-all duration-200 select-none ${
                  isAssigned
                    ? 'border-[var(--color-rose)] bg-white shadow-sm'
                    : 'border-[var(--color-blush)] bg-white hover:border-[var(--color-rose)] hover:shadow-sm'
                } ${isSaving ? 'opacity-60 cursor-wait' : ''}`}
              >
                {/* Checkbox */}
                <div className="absolute top-4 right-4">
                  <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                    isAssigned
                      ? 'bg-[var(--color-rose)] border-[var(--color-rose)]'
                      : 'border-gray-300 group-hover:border-[var(--color-rose)]'
                  }`}>
                    {isAssigned && (
                      <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </div>
                </div>

                {/* Icon */}
                {svc.icon && (
                  <div
                    className="mb-3 flex h-12 w-12 items-center justify-center rounded-full text-xl"
                    style={{ background: 'var(--color-blush)' }}
                  >
                    {svc.icon}
                  </div>
                )}

                {/* Name */}
                <h3
                  className="font-semibold text-[var(--color-charcoal)] mb-1 pr-7"
                  style={{ fontFamily: 'var(--font-cormorant), serif', fontSize: '1.2rem' }}
                >
                  {svc.name}
                </h3>

                {/* Description */}
                {svc.description && (
                  <p className="text-xs leading-relaxed text-[var(--color-charcoal)] opacity-60 mb-3 line-clamp-2">
                    {svc.description}
                  </p>
                )}

                {/* Price + duration */}
                <div className="flex items-center justify-between mt-auto">
                  <span className="text-sm font-semibold" style={{ color: 'var(--color-rose)' }}>
                    {t('price_from', { price: svc.price })}
                  </span>
                  <span className="text-xs text-gray-400">{formatDuration(svc.duration_minutes)}</span>
                </div>

                {/* Bottom accent line on assigned */}
                {isAssigned && (
                  <div
                    className="absolute bottom-0 left-5 right-5 h-0.5 rounded-full"
                    style={{ background: 'linear-gradient(to right, var(--color-rose), var(--color-gold))' }}
                  />
                )}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
