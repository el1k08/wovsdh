'use client'

import { useTranslations } from 'next-intl'

export function BookingStatusBadge({ status }: { status: string }) {
  const t = useTranslations('admin.booking_status')
  const config: Record<string, { labelKey: string; className: string }> = {
    PENDING: {
      labelKey: 'pending',
      className: 'bg-yellow-50 text-yellow-700 border border-yellow-200',
    },
    CONFIRMED: {
      labelKey: 'confirmed',
      className: 'bg-green-50 text-green-700 border border-green-200',
    },
    CANCELLED: {
      labelKey: 'cancelled',
      className: 'bg-gray-100 text-gray-500 border border-gray-300',
    },
  }

  const found = config[status]
  const label = found ? t(found.labelKey as 'pending' | 'confirmed' | 'cancelled') : status
  const className = found?.className ?? 'bg-gray-100 text-gray-600 border border-gray-300'

  return (
    <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${className}`}>
      {label}
    </span>
  )
}
