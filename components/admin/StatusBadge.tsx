'use client'

import { useTranslations } from 'next-intl'

export function StatusBadge({ status }: { status: string }) {
  const t = useTranslations('admin.slot_status')
  const config: Record<string, { labelKey: string; className: string }> = {
    available: {
      labelKey: 'available',
      className: 'bg-green-50 text-green-700 border border-green-200',
    },
    booked: {
      labelKey: 'booked',
      className: 'bg-red-50 text-red-700 border border-red-200',
    },
    blocked: {
      labelKey: 'blocked',
      className: 'bg-gray-100 text-gray-600 border border-gray-300',
    },
  }

  const found = config[status]
  const label = found ? t(found.labelKey as 'available' | 'booked' | 'blocked') : status
  const className = found?.className ?? 'bg-gray-100 text-gray-600 border border-gray-300'

  return (
    <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${className}`}>
      {label}
    </span>
  )
}
