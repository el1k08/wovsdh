'use client'

import type { Locale } from '@/lib/types'

const LOCALES: Locale[] = ['uk', 'en', 'he']

export function LangTabs({ value, onChange }: { value: Locale; onChange: (l: Locale) => void }) {
  return (
    <div className="flex gap-1 mb-3">
      {LOCALES.map((lang) => (
        <button
          key={lang}
          type="button"
          onClick={() => onChange(lang)}
          className={`px-3 py-1 text-xs rounded-md font-medium transition-colors ${
            value === lang
              ? 'bg-[var(--color-rose)] text-white'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          {lang.toUpperCase()}
        </button>
      ))}
    </div>
  )
}
