'use client'

import { useLocale, useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'
import { useTransition } from 'react'
import { setLocaleCookie } from '@/app/actions'

const LOCALES = [
  { code: 'uk', label: 'UA' },
  { code: 'en', label: 'EN' },
  { code: 'he', label: 'HE' },
] as const

interface Props {
  className?: string
}

export function LanguageSwitcher({ className }: Props) {
  const locale = useLocale()
  const t = useTranslations('header')
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  function handleSwitch(code: string) {
    if (code === locale) return
    startTransition(async () => {
      await setLocaleCookie(code)
      router.refresh()
    })
  }

  return (
    <div
      role="group"
      aria-label={t('lang_switcher_aria')}
      className={`flex items-center gap-0.5 ${className ?? ''}`}
    >
      {LOCALES.map(({ code, label }) => {
        const isActive = locale === code
        return (
          <button
            key={code}
            type="button"
            onClick={() => handleSwitch(code)}
            disabled={isPending || isActive}
            aria-pressed={isActive}
            className={[
              'px-2 py-1 text-xs font-semibold rounded transition-colors',
              isActive
                ? 'bg-[var(--color-rose)] text-white cursor-default'
                : 'text-gray-500 hover:text-[var(--color-rose)] hover:bg-[var(--color-blush)]',
              isPending && !isActive ? 'opacity-50 cursor-wait' : '',
            ].join(' ')}
          >
            {label}
          </button>
        )
      })}
    </div>
  )
}
