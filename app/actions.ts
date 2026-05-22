'use server'

import { cookies } from 'next/headers'

const VALID_LOCALES = ['uk', 'en', 'he'] as const

export async function setLocaleCookie(locale: string): Promise<void> {
  if (!(VALID_LOCALES as readonly string[]).includes(locale)) return
  const cookieStore = await cookies()
  cookieStore.set('locale', locale, {
    path: '/',
    maxAge: 60 * 60 * 24 * 365,
    sameSite: 'lax',
    httpOnly: false,
  })
}
