'use client'

import { MapPin } from 'lucide-react'

interface CitySelectorProps {
  value: 'rishon' | 'ashdod' | null
  onChange: (city: 'rishon' | 'ashdod') => void
}

const CITIES: { id: 'rishon' | 'ashdod'; label: string; subtitle: string }[] = [
  { id: 'rishon', label: 'Ришон-ле-Цион', subtitle: 'Студия на юге города' },
  { id: 'ashdod', label: 'Ашдод', subtitle: 'Студия в центре' },
]

export default function CitySelector({ value, onChange }: CitySelectorProps) {
  return (
    <fieldset>
      <legend className="sr-only">Выберите студию</legend>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {CITIES.map((city) => {
          const isSelected = value === city.id
          return (
            <button
              key={city.id}
              type="button"
              onClick={() => onChange(city.id)}
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
                {city.label}
              </span>
              <span className="text-sm" style={{ color: 'var(--color-charcoal)', opacity: 0.6 }}>
                {city.subtitle}
              </span>
            </button>
          )
        })}
      </div>
    </fieldset>
  )
}
