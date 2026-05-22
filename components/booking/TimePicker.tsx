'use client'

import { useLocale, useTranslations } from 'next-intl'
import type { AvailableStartTime } from '@/lib/types'

interface TimePickerProps {
  startTimes: AvailableStartTime[]
  value: string | null
  onChange: (startAt: string) => void
  loading: boolean
  disabled?: boolean
}

const LOCALE_MAP: Record<string, string> = {
  uk: 'uk-IL',
  en: 'en-IL',
  he: 'he-IL',
}

function SkeletonBlock() {
  return (
    <div className="h-10 w-20 animate-pulse rounded-xl bg-gray-200" aria-hidden="true" />
  )
}

export default function TimePicker({
  startTimes,
  value,
  onChange,
  loading,
  disabled = false,
}: TimePickerProps) {
  const t = useTranslations('booking')
  const locale = useLocale()
  const intlLocale = LOCALE_MAP[locale] ?? 'uk-IL'

  const timeFormatter = new Intl.DateTimeFormat(intlLocale, {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Asia/Jerusalem',
  })

  if (loading) {
    return (
      <div
        role="status"
        aria-label={t('slot_loading_aria')}
        className="flex flex-wrap gap-3 pt-1"
      >
        {Array.from({ length: 4 }).map((_, i) => (
          <SkeletonBlock key={i} />
        ))}
        <span className="sr-only">{t('common_loading', { defaultValue: '...' })}</span>
      </div>
    )
  }

  if (startTimes.length === 0) {
    return (
      <p className="text-sm py-2" style={{ color: 'var(--color-charcoal)', opacity: 0.6 }}>
        {t('no_slots')}
      </p>
    )
  }

  return (
    <div
      role="group"
      aria-label={t('time_picker_aria')}
      className="flex flex-wrap gap-3 pt-1"
    >
      {startTimes.map((item) => {
        const isSelected = value === item.start_at
        const timeLabel = timeFormatter.format(new Date(item.start_at))

        return (
          <button
            key={item.start_at}
            type="button"
            onClick={() => !disabled && onChange(item.start_at)}
            disabled={disabled}
            aria-pressed={isSelected}
            aria-label={`${t('step_time_heading')} ${timeLabel}`}
            className={[
              'rounded-xl px-4 py-2 text-sm font-medium transition-all duration-200',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1',
              'focus-visible:ring-[var(--color-rose)]',
              disabled ? 'cursor-not-allowed opacity-40' : 'cursor-pointer',
              isSelected
                ? 'text-white shadow-md'
                : 'bg-white border border-gray-200 hover:border-[var(--color-rose)] text-[var(--color-charcoal)]',
            ].join(' ')}
            style={isSelected ? { background: 'var(--color-rose)' } : undefined}
          >
            {timeLabel}
          </button>
        )
      })}
    </div>
  )
}
