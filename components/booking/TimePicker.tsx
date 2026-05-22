'use client'

import type { AvailableStartTime } from '@/lib/types'

interface TimePickerProps {
  startTimes: AvailableStartTime[]
  value: string | null       // ISO UTC string of selected start_at
  onChange: (startAt: string) => void
  loading: boolean
  disabled?: boolean
}

const TIME_FORMATTER = new Intl.DateTimeFormat('uk-IL', {
  hour: '2-digit',
  minute: '2-digit',
  timeZone: 'Asia/Jerusalem',
})

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
  if (loading) {
    return (
      <div
        role="status"
        aria-label="Завантаження доступних слотів"
        className="flex flex-wrap gap-3 pt-1"
      >
        {Array.from({ length: 4 }).map((_, i) => (
          <SkeletonBlock key={i} />
        ))}
        <span className="sr-only">Завантаження...</span>
      </div>
    )
  }

  if (startTimes.length === 0) {
    return (
      <p className="text-sm py-2" style={{ color: 'var(--color-charcoal)', opacity: 0.6 }}>
        На вибрану дату немає вільних слотів
      </p>
    )
  }

  return (
    <div
      role="group"
      aria-label="Виберіть час"
      className="flex flex-wrap gap-3 pt-1"
    >
      {startTimes.map((item) => {
        const isSelected = value === item.start_at
        const timeLabel = TIME_FORMATTER.format(new Date(item.start_at))

        return (
          <button
            key={item.start_at}
            type="button"
            onClick={() => !disabled && onChange(item.start_at)}
            disabled={disabled}
            aria-pressed={isSelected}
            aria-label={`Час ${timeLabel}`}
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
