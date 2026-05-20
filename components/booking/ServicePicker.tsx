'use client'

import type { ServiceDTO } from '@/lib/types'

interface ServicePickerProps {
  services: ServiceDTO[]
  value: string | null
  onChange: (id: string, service: ServiceDTO) => void
  loading: boolean
}

function SkeletonCard() {
  return (
    <div
      className="animate-pulse rounded-xl border border-gray-200 bg-white p-4"
      aria-hidden="true"
    >
      <div className="mb-3 h-8 w-8 rounded-md bg-gray-200" />
      <div className="mb-2 h-4 w-3/4 rounded bg-gray-200" />
      <div className="mb-4 h-3 w-full rounded bg-gray-200" />
      <div className="flex justify-between">
        <div className="h-4 w-12 rounded bg-gray-200" />
        <div className="h-4 w-16 rounded bg-gray-200" />
      </div>
    </div>
  )
}

export default function ServicePicker({
  services,
  value,
  onChange,
  loading,
}: ServicePickerProps) {
  if (loading) {
    return (
      <div
        role="status"
        aria-label="Загрузка услуг"
        className="grid grid-cols-1 gap-4 sm:grid-cols-2"
      >
        {Array.from({ length: 4 }).map((_, i) => (
          <SkeletonCard key={i} />
        ))}
        <span className="sr-only">Загрузка...</span>
      </div>
    )
  }

  if (services.length === 0) {
    return (
      <p
        className="py-4 text-sm"
        style={{ color: 'var(--color-charcoal)', opacity: 0.6 }}
      >
        Услуги не найдены
      </p>
    )
  }

  return (
    <div
      role="group"
      aria-label="Выберите услугу"
      className="grid grid-cols-1 gap-4 sm:grid-cols-2"
    >
      {services.map((service) => {
        const isSelected = value === service.id

        return (
          <button
            key={service.id}
            type="button"
            onClick={() => onChange(service.id, service)}
            aria-pressed={isSelected}
            aria-label={`${service.name}, ${service.price} шекелей, ${service.duration_minutes} минут`}
            className={[
              'flex flex-col gap-2 rounded-xl border-2 p-4 text-left transition-all duration-200',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1',
              'focus-visible:ring-[var(--color-rose)] cursor-pointer',
              isSelected
                ? 'border-[var(--color-rose)] bg-[#F9EDEB] shadow-md'
                : 'border-gray-200 bg-white hover:border-[var(--color-rose)]',
            ].join(' ')}
          >
            {/* Icon */}
            <span className="text-3xl leading-none" aria-hidden="true">
              {service.icon ?? '💅'}
            </span>

            {/* Name & description */}
            <div className="flex flex-col gap-0.5">
              <span
                className="text-base font-semibold leading-snug"
                style={{ color: 'var(--color-charcoal)' }}
              >
                {service.name}
              </span>
              {service.description && (
                <span
                  className="text-sm leading-snug"
                  style={{ color: 'var(--color-charcoal)', opacity: 0.7 }}
                >
                  {service.description}
                </span>
              )}
            </div>

            {/* Price & duration row */}
            <div className="mt-auto flex items-center justify-between pt-1">
              <span
                className="text-sm font-bold"
                style={{ color: 'var(--color-charcoal)' }}
              >
                ₪{service.price}
              </span>
              <span
                className="text-sm"
                style={{ color: 'var(--color-charcoal)', opacity: 0.6 }}
              >
                {service.duration_minutes} мин
              </span>
            </div>
          </button>
        )
      })}
    </div>
  )
}
