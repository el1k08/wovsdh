import type { Locale } from './types'

export function resolveLocale(value: string | null | undefined): Locale {
  if (value === 'en' || value === 'he') return value
  return 'uk'
}
