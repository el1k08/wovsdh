'use client'

import { useMemo } from 'react'

interface DatePickerProps {
  value: string | null
  onChange: (date: string) => void
  disabled?: boolean
}

const TZ = 'Asia/Jerusalem'
const LOCALE = 'ru-IL'

function toLocalDateString(date: Date): string {
  // Returns YYYY-MM-DD in Asia/Jerusalem timezone
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date)

  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? ''
  return `${get('year')}-${get('month')}-${get('day')}`
}

function buildDateList(count = 14): { dateStr: string; date: Date }[] {
  const result: { dateStr: string; date: Date }[] = []
  // Get today's date in Jerusalem timezone
  const nowStr = toLocalDateString(new Date())
  const [y, m, d] = nowStr.split('-').map(Number)
  // Build dates starting from today in local calendar
  for (let i = 0; i < count; i++) {
    const candidate = new Date(y, m - 1, d + i, 12, 0, 0) // noon avoids DST edge cases
    result.push({ dateStr: toLocalDateString(candidate), date: candidate })
  }
  return result
}

const DAY_FORMATTER = new Intl.DateTimeFormat(LOCALE, { weekday: 'short', timeZone: TZ })
const DAY_NUM_FORMATTER = new Intl.DateTimeFormat(LOCALE, { day: 'numeric', timeZone: TZ })
const MONTH_FORMATTER = new Intl.DateTimeFormat(LOCALE, { month: 'short', timeZone: TZ })

export default function DatePicker({ value, onChange, disabled = false }: DatePickerProps) {
  const dates = useMemo(() => buildDateList(14), [])

  return (
    <div
      className="overflow-x-auto pb-2 -mx-1"
      role="group"
      aria-label="Выберите дату"
    >
      <div className="flex gap-2 px-1 min-w-max">
        {dates.map(({ dateStr, date }) => {
          const isSelected = value === dateStr
          const weekday = DAY_FORMATTER.format(date)
          const dayNum = DAY_NUM_FORMATTER.format(date)
          const month = MONTH_FORMATTER.format(date)

          return (
            <button
              key={dateStr}
              type="button"
              onClick={() => !disabled && onChange(dateStr)}
              disabled={disabled}
              aria-pressed={isSelected}
              aria-label={`${weekday}, ${dayNum} ${month}`}
              className={[
                'flex flex-col items-center justify-center rounded-xl px-3 py-3 min-w-[60px] transition-all duration-200',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1',
                'focus-visible:ring-[var(--color-rose)]',
                disabled ? 'cursor-not-allowed opacity-40' : 'cursor-pointer',
                isSelected
                  ? 'text-white shadow-md'
                  : 'bg-white border border-gray-200 hover:border-[var(--color-rose)] text-[var(--color-charcoal)]',
              ].join(' ')}
              style={
                isSelected
                  ? { background: 'var(--color-rose)' }
                  : undefined
              }
            >
              <span className="text-xs font-medium capitalize leading-tight">{weekday}</span>
              <span className="text-xl font-bold leading-tight">{dayNum}</span>
              <span className="text-xs leading-tight capitalize">{month}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
