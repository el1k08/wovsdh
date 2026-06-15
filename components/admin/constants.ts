import type { Locale } from '@/lib/types'

export const LOCALES: Locale[] = ['uk', 'ru', 'en', 'he']

function generateTimeOptions(): string[] {
  const options: string[] = []
  for (let hour = 0; hour <= 24; hour++) {
    for (let minute = 0; minute < 60; minute += 15) {
      if (hour === 24 && minute > 0) break
      const timeStr = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`
      options.push(timeStr)
    }
  }
  return options
}

export const TIME_OPTIONS: string[] = generateTimeOptions()

export function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} хв`
  const hours = Math.floor(minutes / 60)
  const mins = minutes % 60
  if (mins === 0) return `${hours} год`
  return `${hours} год ${mins} хв`
}

export const DURATION_OPTIONS: { value: number; label: string }[] = Array.from(
  { length: 300 / 15 },
  (_, i) => {
    const value = (i + 1) * 15
    return { value, label: formatDuration(value) }
  },
)
