import { getRequestConfig } from 'next-intl/server'
import { cookies, headers } from 'next/headers'

const validLocales = ['uk', 'ru', 'en', 'he'] as const
type ValidLocale = typeof validLocales[number]

function isValidLocale(value: string): value is ValidLocale {
  return (validLocales as readonly string[]).includes(value)
}

// Maps browser language codes to our supported locales.
// Everything else falls back to Hebrew (primary market).
const LANG_MAP: Record<string, ValidLocale> = {
  uk: 'uk',
  ru: 'ru',
  en: 'en',
  he: 'he',
  iw: 'he', // legacy Hebrew code used by some browsers
}

function detectFromAcceptLanguage(acceptLang: string): ValidLocale | null {
  const tags = acceptLang.split(',').map((s) => s.split(';')[0]?.trim().toLowerCase()).filter(Boolean)
  for (const tag of tags) {
    const lang = tag.split('-')[0]
    if (lang && LANG_MAP[lang]) return LANG_MAP[lang]!
  }
  return null
}

export default getRequestConfig(async () => {
  const cookieStore = await cookies()
  const cookieLocale = cookieStore.get('locale')?.value

  let locale: ValidLocale = 'he'
  if (cookieLocale && isValidLocale(cookieLocale)) {
    locale = cookieLocale
  } else {
    const headersList = await headers()
    const acceptLang = headersList.get('accept-language') ?? ''
    locale = detectFromAcceptLanguage(acceptLang) ?? 'he'
  }

  return {
    locale,
    messages: (await import(`../locales/${locale}.json`)).default,
  }
})
