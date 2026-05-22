'use client'

import { CheckCircle } from 'lucide-react'
import Button from '@/components/ui/Button'
import type { BookingCreatedDTO } from '@/lib/types'

interface BookingSuccessProps {
  booking: BookingCreatedDTO
  studioName: string
  serviceName: string
  serviceDuration: number
  onReset: () => void
}


const DATE_FORMATTER = new Intl.DateTimeFormat('uk-IL', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  timeZone: 'Asia/Jerusalem',
})

const TIME_FORMATTER = new Intl.DateTimeFormat('uk-IL', {
  hour: '2-digit',
  minute: '2-digit',
  timeZone: 'Asia/Jerusalem',
})

export default function BookingSuccess({ booking, studioName, serviceName, serviceDuration: _serviceDuration, onReset }: BookingSuccessProps) {
  const startDate = new Date(booking.start_at)
  const endDate = new Date(booking.end_at)

  const formattedDate = DATE_FORMATTER.format(startDate)
  const formattedTime = `${TIME_FORMATTER.format(startDate)} — ${TIME_FORMATTER.format(endDate)}`

  return (
    <div
      className="flex flex-col items-center gap-6 py-4 text-center"
      role="status"
      aria-live="polite"
      aria-label="Бронювання успішно створено"
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
          Заявку прийнято!
        </h3>
        <p className="text-sm leading-relaxed" style={{ color: 'var(--color-charcoal)', opacity: 0.7 }}>
          Ми зв'яжемося з вами для підтвердження.
          <br />
          Деталі запису надіслано на email.
        </p>
      </div>

      <div
        className="w-full rounded-2xl border border-gray-100 bg-[var(--color-blush)] px-6 py-5 text-left"
        aria-label="Деталі запису"
      >
        <dl className="flex flex-col gap-3">
          <div className="flex items-start justify-between gap-4">
            <dt className="text-sm font-medium" style={{ color: 'var(--color-charcoal)', opacity: 0.6 }}>
              Студія
            </dt>
            <dd className="text-sm font-semibold text-right" style={{ color: 'var(--color-charcoal)' }}>
              {studioName}
            </dd>
          </div>
          <div className="flex items-start justify-between gap-4">
            <dt className="flex items-center gap-1.5 text-sm font-medium" style={{ color: 'var(--color-charcoal)', opacity: 0.6 }}>
              Послуга
            </dt>
            <dd className="text-sm font-semibold text-right" style={{ color: 'var(--color-charcoal)' }}>
              {serviceName}
            </dd>
          </div>
          <div className="flex items-start justify-between gap-4">
            <dt className="text-sm font-medium" style={{ color: 'var(--color-charcoal)', opacity: 0.6 }}>
              Дата
            </dt>
            <dd className="text-sm font-semibold text-right capitalize" style={{ color: 'var(--color-charcoal)' }}>
              {formattedDate}
            </dd>
          </div>
          <div className="flex items-start justify-between gap-4">
            <dt className="text-sm font-medium" style={{ color: 'var(--color-charcoal)', opacity: 0.6 }}>
              Час
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
