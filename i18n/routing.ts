export const locales = ['uk', 'en', 'he'] as const
export type Locale = typeof locales[number]
export const defaultLocale: Locale = 'uk'
