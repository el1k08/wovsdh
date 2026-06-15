import type { Locale } from './types'

export function resolveLocale(value: string | null | undefined): Locale {
  if (value === 'en' || value === 'he' || value === 'ru') return value
  return 'uk'
}
