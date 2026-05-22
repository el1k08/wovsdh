'use client'

import { useTranslations, useLocale } from 'next-intl'
import { CheckCircle } from 'lucide-react'
import type { BookingCreatedDTO } from '@/lib/types'

interface BookingSuccessProps {
  booking: BookingCreatedDTO
  studioName: string
  serviceName: string
  serviceDuration: number
  onReset: () => void
}

const LOCALE_MAP: Record<string, string> = {
  uk: 'uk-IL',
  en: 'en-IL',
  he: 'he-IL',
}

export default function BookingSuccess({ booking, studioName, serviceName, serviceDuration: _serviceDuration, onReset }: BookingSuccessProps) {
  const t = useTranslations('booking_success')
  const locale = useLocale()
  const intlLocale = LOCALE_MAP[locale] ?? 'uk-IL'

  const dateFormatter = new Intl.DateTimeFormat(intlLocale, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'Asia/Jerusalem',
  })
  const timeFormatter = new Intl.DateTimeFormat(intlLocale, {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Asia/Jerusalem',
  })

  const startDate = new Date(booking.start_at)
  const endDate = new Date(booking.end_at)

  const formattedDate = dateFormatter.format(startDate)
  const formattedTime = `${timeFormatter.format(startDate)} — ${timeFormatter.format(endDate)}`

  return (
    <div
      className="flex flex-col items-center gap-6 py-4 text-center"
      role="status"
      aria-live="polite"
      aria-label={t('success_aria')}
    >
      <CheckCircle
        className="h-16 w-16 shrink-0"
        style={{ color: '#22C55E' }}
        aria-hidden="true"
      />

      <div className="flex flex-col gap-2">
        <h3
          className="text-2xl font-semibold"
          style={{
            fontFamily: 'var(--font-cormorant), serif',
            color: 'var(--color-charcoal)',
          }}
        >
          {t('title')}
        </h3>
        <p className="text-sm leading-relaxed" style={{ color: 'var(--color-charcoal)', opacity: 0.7 }}>
          {t('subtitle').split('\n').map((line, i) => (
            <span key={i}>{line}{i === 0 && <br />}</span>
          ))}
        </p>
      </div>

      <div
        className="w-full rounded-2xl border border-gray-100 bg-[var(--color-blush)] px-6 py-5 text-left"
        aria-label={t('details_aria')}
      >
        <dl className="flex flex-col gap-3">
          <div className="flex items-start justify-between gap-4">
            <dt className="text-sm font-medium" style={{ color: 'var(--color-charcoal)', opacity: 0.6 }}>
              {t('studio_label')}
            </dt>
            <dd className="text-sm font-semibold text-right" style={{ color: 'var(--color-charcoal)' }}>
              {studioName}
            </dd>
          </div>
          <div className="flex items-start justify-between gap-4">
            <dt className="flex items-center gap-1.5 text-sm font-medium" style={{ color: 'var(--color-charcoal)', opacity: 0.6 }}>
              {t('service_label')}
            </dt>
            <dd className="text-sm font-semibold text-right" style={{ color: 'var(--color-charcoal)' }}>
              {serviceName}
            </dd>
          </div>
          <div className="flex items-start justify-between gap-4">
            <dt className="text-sm font-medium" style={{ color: 'var(--color-charcoal)', opacity: 0.6 }}>
              {t('date_label')}
            </dt>
            <dd className="text-sm font-semibold text-right capitalize" style={{ color: 'var(--color-charcoal)' }}>
              {formattedDate}
            </dd>
          </div>
          <div className="flex items-start justify-between gap-4">
            <dt className="text-sm font-medium" style={{ color: 'var(--color-charcoal)', opacity: 0.6 }}>
              {t('time_label')}
            </dt>
            <dd className="text-sm font-semibold text-right" style={{ color: 'var(--color-charcoal)' }}>
              {formattedTime}
            </dd>
          </div>
        </dl>
      </div>
    </div>
  )
}
