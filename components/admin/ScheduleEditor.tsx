'use client'

import { useTranslations } from 'next-intl'
import { Switch } from '@/components/ui/Switch'
import type { ScheduleRow } from '@/components/admin/types'
import { TIME_OPTIONS } from '@/components/admin/constants'

export function ScheduleEditor({
  rows,
  onChange,
  disabled = false,
}: {
  rows: ScheduleRow[]
  onChange: (rows: ScheduleRow[]) => void
  disabled?: boolean
}) {
  const tAdmin = useTranslations('admin')
  const updateRow = (index: number, patch: Partial<ScheduleRow>) => {
    const next = rows.map((r, i) => (i === index ? { ...r, ...patch } : r))
    onChange(next)
  }
  const SELECT_CLS = 'border border-gray-300 rounded-lg px-2 py-1 text-sm text-[var(--color-charcoal)] focus:outline-none focus:border-[var(--color-rose)] disabled:opacity-40'
  const dayLabels = Array.from({ length: 7 }, (_, i) => tAdmin(`day_labels.${i}` as 'day_labels.0'))
  return (
    <div className="space-y-2">
      {rows.map((row, i) => (
        <div key={row.day_of_week} className="flex items-center gap-3">
          <Switch
            checked={row.is_working}
            disabled={disabled}
            onChange={checked => updateRow(i, { is_working: checked })}
          />
          <span className="w-12 text-sm text-[var(--color-charcoal)] font-medium">
            {dayLabels[row.day_of_week]}
          </span>
          <select
            value={row.work_start}
            disabled={disabled || !row.is_working}
            onChange={e => updateRow(i, { work_start: e.target.value })}
            className={SELECT_CLS}
          >
            {TIME_OPTIONS.map((time) => (
              <option key={time} value={time}>
                {time}
              </option>
            ))}
          </select>
          <span className="text-sm text-gray-400">—</span>
          <select
            value={row.work_end}
            disabled={disabled || !row.is_working}
            onChange={e => updateRow(i, { work_end: e.target.value })}
            className={SELECT_CLS}
          >
            {TIME_OPTIONS.map((time) => (
              <option key={time} value={time}>
                {time}
              </option>
            ))}
          </select>
          {!row.is_working && (
            <span className="text-xs text-gray-400">{tAdmin('slot_status.blocked')}</span>
          )}
        </div>
      ))}
    </div>
  )
}
