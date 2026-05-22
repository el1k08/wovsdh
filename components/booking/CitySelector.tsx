'use client'

import { useTranslations } from 'next-intl'
import { MapPin } from 'lucide-react'
import type { PublicStudioDTO } from '@/lib/types'

interface CitySelectorProps {
  studios: PublicStudioDTO[]
  value: string | null
  onChange: (studioId: string) => void
  loading?: boolean
}

export default function CitySelector({ studios, value, onChange, loading = false }: CitySelectorProps) {
  const t = useTranslations('booking')

  if (loading) {
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {[0, 1].map(i => (
          <div
            key={i}
            className="flex flex-col items-center gap-3 rounded-2xl border-2 border-gray-200 bg-white px-6 py-8 animate-pulse"
          >
            <div className="h-7 w-7 rounded-full bg-gray-200" />
            <div className="h-5 w-32 rounded bg-gray-200" />
            <div className="h-4 w-24 rounded bg-gray-200" />
          </div>
        ))}
      </div>
    )
  }

  return (
    <fieldset>
      <legend className="sr-only">{t('city_selector_aria')}</legend>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {studios.map((studio) => {
          const isSelected = value === studio.id
          return (
            <button
              key={studio.id}
              type="button"
              onClick={() => onChange(studio.id)}
              aria-pressed={isSelected}
              className={[
                'flex flex-col items-center gap-3 rounded-2xl border-2 px-6 py-8 text-center transition-all duration-200',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
                'focus-visible:ring-[var(--color-rose)] cursor-pointer',
                isSelected
                  ? 'border-[var(--color-rose)] bg-[#F9EDEB] shadow-md'
                  : 'border-gray-200 bg-white hover:border-[var(--color-rose)] hover:bg-[#FDF6F5]',
              ].join(' ')}
            >
              <MapPin
                className="h-7 w-7 shrink-0"
                style={{ color: isSelected ? 'var(--color-rose)' : '#9CA3AF' }}
                aria-hidden="true"
              />
              <span
                className="text-lg font-semibold leading-snug"
                style={{ color: 'var(--color-charcoal)' }}
              >
                {studio.name}
              </span>
              {studio.street && (
                <span className="text-sm" style={{ color: 'var(--color-charcoal)', opacity: 0.6 }}>
                  {studio.street}
                </span>
              )}
            </button>
          )
        })}
      </div>
    </fieldset>
  )
}
