import { getRequestConfig } from 'next-intl/server'
import { cookies, headers } from 'next/headers'

const validLocales = ['uk', 'en', 'he'] as const
type ValidLocale = typeof validLocales[number]

function isValidLocale(value: string): value is ValidLocale {
  return (validLocales as readonly string[]).includes(value)
}

function detectFromAcceptLanguage(acceptLang: string): ValidLocale | null {
  // Parse "he-IL,he;q=0.9,en;q=0.8,uk;q=0.7" → check each tag in order
  const tags = acceptLang.split(',').map((s) => s.split(';')[0]?.trim().toLowerCase()).filter(Boolean)
  for (const tag of tags) {
    const lang = tag.split('-')[0]
    if (lang && isValidLocale(lang)) return lang
  }
  return null
}

export default getRequestConfig(async () => {
  const cookieStore = await cookies()
  const cookieLocale = cookieStore.get('locale')?.value

  let locale: ValidLocale = 'uk'
  if (cookieLocale && isValidLocale(cookieLocale)) {
    locale = cookieLocale
  } else {
    const headersList = await headers()
    const acceptLang = headersList.get('accept-language') ?? ''
    locale = detectFromAcceptLanguage(acceptLang) ?? 'uk'
  }

  return {
    locale,
    messages: (await import(`../locales/${locale}.json`)).default,
  }
})
