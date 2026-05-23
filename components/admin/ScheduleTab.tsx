'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import { useTranslations } from 'next-intl'
import { Switch } from '@/components/ui/Switch'
import type {
  AdminSlotDTO,
  GenerateSlotsFromTemplateResponse,
  GetAdminSlotsResponse,
  GetMasterScheduleResponse,
} from '@/lib/types'
import type { InlineMessage, ScheduleRow } from '@/components/admin/types'
import { TIME_OPTIONS } from '@/components/admin/constants'
import {
  buildDefaultSchedule,
  templateToRows,
  todayString,
  addDays,
  formatLocalTime,
} from '@/components/admin/utils'

interface ScheduleTabProps {
  studio: string
  apiFetch: (path: string, options?: RequestInit) => Promise<Response>
  onUnauth: () => void
  secret: string | null
}

export function ScheduleTab({ studio, apiFetch, onUnauth }: ScheduleTabProps) {
  const t = useTranslations('admin.schedule_panel')
  const tAdmin = useTranslations('admin')
  const tCommon = useTranslations('common')
  const dayLabels = Array.from({ length: 7 }, (_, i) => tAdmin(`day_labels.${i}` as 'day_labels.0'))
  const [rows, setRows] = useState<ScheduleRow[]>(buildDefaultSchedule())
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<InlineMessage | null>(null)

  const todayStr = todayString()
  const nowDate = new Date()

  const daySliderRef = useRef<HTMLDivElement>(null)
  const todayBtnRef = useRef<HTMLButtonElement>(null)

  // Slots state — today is always the default selection
  const [selectedMonth, setSelectedMonth] = useState<Date>(
    new Date(nowDate.getFullYear(), nowDate.getMonth(), 1)
  )
  const [selectedDay, setSelectedDay] = useState<string | null>(todayStr)
  const [studioSlots, setStudioSlots] = useState<AdminSlotDTO[]>([])
  const [slotsLoading, setSlotsLoading] = useState(false)

  // Dropdown + modals state
  const dropdownRef = useRef<HTMLDivElement>(null)
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [slotModal, setSlotModal] = useState<'day' | 'range' | null>(null)
  const [customRanges, setCustomRanges] = useState<Array<{ from: string; to: string }>>([{ from: '09:00', to: '18:00' }])
  const [rangeFrom, setRangeFrom] = useState('')
  const [rangeTo, setRangeTo] = useState('')
  const [generating, setGenerating] = useState(false)
  const [generateMsg, setGenerateMsg] = useState<InlineMessage | null>(null)
  const [pendingGenerate, setPendingGenerate] = useState<{ dateFrom: string; dateTo: string } | null>(null)

  // Days of the selected month for the horizontal slider
  const daysInMonth = (() => {
    const year = selectedMonth.getFullYear()
    const month = selectedMonth.getMonth()
    const totalDays = new Date(year, month + 1, 0).getDate()
    return Array.from({ length: totalDays }, (_, d) => {
      const day = d + 1
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
      return { dateStr, date: new Date(year, month, day, 12, 0, 0) }
    })
  })()

  const monthLabel = (() => {
    const label = selectedMonth.toLocaleDateString('uk-UA', { month: 'long', year: 'numeric' })
    return label.charAt(0).toUpperCase() + label.slice(1)
  })()

  function navigateMonth(direction: -1 | 1) {
    const next = new Date(selectedMonth.getFullYear(), selectedMonth.getMonth() + direction, 1)
    const nextYYYYMM = `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}`
    setSelectedMonth(next)
    setSelectedDay(todayStr.startsWith(nextYYYYMM) ? todayStr : null)
  }

  const slotsForDay = selectedDay
    ? studioSlots
        .filter(slot => new Date(slot.start_at).toLocaleDateString('en-CA', { timeZone: 'Asia/Jerusalem' }) === selectedDay)
        .sort((a, b) => a.start_at.localeCompare(b.start_at))
    : []

  const loadSchedule = useCallback(async () => {
    setLoading(true)
    setMessage(null)
    try {
      const res = await apiFetch(`/api/admin/master-schedule?studio_id=${studio}`)
      if (res.status === 401) { onUnauth(); return }
      if (!res.ok) {
        const body = await res.json() as { error?: { message?: string } }
        setMessage({ type: 'error', text: body.error?.message ?? t('error_load') })
        return
      }
      const data = await res.json() as GetMasterScheduleResponse
      setRows(templateToRows(data.schedule))
    } catch {
      setMessage({ type: 'error', text: t('error_network_load') })
    } finally {
      setLoading(false)
    }
  }, [studio, apiFetch, onUnauth, t])

  const loadSlots = useCallback(async () => {
    setSlotsLoading(true)
    const year = selectedMonth.getFullYear()
    const month = selectedMonth.getMonth()
    const dateFrom = `${year}-${String(month + 1).padStart(2, '0')}-01`
    const lastDay = new Date(year, month + 1, 0).getDate()
    const dateTo = `${year}-${String(month + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`
    try {
      const res = await apiFetch(`/api/admin/slots?studio_id=${studio}&date_from=${dateFrom}&date_to=${dateTo}`)
      if (res.status === 401) { onUnauth(); return }
      if (res.ok) {
        const data = await res.json() as GetAdminSlotsResponse
        setStudioSlots(data.slots ?? [])
      }
    } catch {
      // silently ignore
    } finally {
      setSlotsLoading(false)
    }
  }, [studio, selectedMonth, apiFetch, onUnauth])

  useEffect(() => { loadSchedule() }, [loadSchedule])
  useEffect(() => { loadSlots() }, [loadSlots])

  // Center today (or selected day) in the day slider after month change / mount
  useEffect(() => {
    const container = daySliderRef.current
    const btn = todayBtnRef.current
    if (!container || !btn) return
    const cr = container.getBoundingClientRect()
    const br = btn.getBoundingClientRect()
    container.scrollLeft += br.left + br.width / 2 - cr.left - cr.width / 2
  }, [selectedMonth])

  // Close dropdown on outside click
  useEffect(() => {
    function handleOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleOutside)
    return () => document.removeEventListener('mousedown', handleOutside)
  }, [])

  async function handleGenerateSlots(
    dateFrom: string,
    dateTo: string,
    ranges?: Array<{ from: string; to: string }>,
  ) {
    setGenerating(true)
    setGenerateMsg(null)
    try {
      const body: Record<string, unknown> = { studio_id: studio, date_from: dateFrom, date_to: dateTo }
      if (ranges) body.ranges = ranges
      const res = await apiFetch('/api/admin/generate-slots', { method: 'POST', body: JSON.stringify(body) })
      if (res.status === 401) { onUnauth(); return }
      const data = await res.json() as GenerateSlotsFromTemplateResponse & { error?: { message?: string } }
      if (!res.ok) {
        setGenerateMsg({ type: 'error', text: data.error?.message ?? t('error_generate') })
        return
      }
      setSlotModal(null)
      setPendingGenerate(null)
      setGenerateMsg({
        type: 'success',
        text: t('slots_created', { count: data.created }) + (data.skipped > 0 ? t('slots_skipped', { count: data.skipped }) : ''),
      })
      await loadSlots()
    } catch {
      setGenerateMsg({ type: 'error', text: t('error_network_generate') })
    } finally {
      setGenerating(false)
    }
  }

  function updateRow(dayOfWeek: number, patch: Partial<ScheduleRow>) {
    setRows(prev => prev.map(r => r.day_of_week === dayOfWeek ? { ...r, ...patch } : r))
    setMessage(null)
  }

  async function handleSave() {
    setSaving(true)
    setMessage(null)
    try {
      const res = await apiFetch('/api/admin/master-schedule', {
        method: 'PUT',
        body: JSON.stringify({
          studio_id: studio,
          days: rows.map(r => ({
            day_of_week: r.day_of_week,
            is_working: r.is_working,
            work_start: r.work_start,
            work_end: r.work_end,
          })),
        }),
      })
      if (res.status === 401) { onUnauth(); return }
      if (!res.ok) {
        const body = await res.json() as { error?: { message?: string } }
        setMessage({ type: 'error', text: body.error?.message ?? t('error_save') })
        return
      }
      setMessage({ type: 'success', text: t('success_save') })
    } catch {
      setMessage({ type: 'error', text: t('error_network_save') })
    } finally {
      setSaving(false)
    }
  }

  const INPUT_CLS = 'border border-gray-300 rounded-lg px-3 py-1.5 text-sm text-[var(--color-charcoal)] focus:outline-none focus:border-[var(--color-rose)] disabled:opacity-40 disabled:cursor-not-allowed'

  const SLOT_STATUS_CLS: Record<string, string> = {
    available: 'bg-green-50 border border-green-200 text-green-700',
    booked: 'bg-red-50 border border-red-200 text-red-700',
    blocked: 'bg-gray-100 border border-gray-300 text-gray-500',
  }

  return (
    <div className="flex gap-6 items-start">
      {/* Left: Schedule editor (1/3) */}
      <div className="w-1/3 shrink-0">
        <h2 className="text-lg font-semibold text-[var(--color-charcoal)] mb-4">
          {t('heading')}
        </h2>

        {loading ? (
          <p className="text-sm text-gray-400 py-4">{tCommon('loading')}</p>
        ) : (
          <div className="flex flex-col gap-2">
            {(() => {
              return rows.map((row) => (
              <div
                key={row.day_of_week}
                className="flex flex-wrap items-center gap-4 rounded-xl border border-gray-100 bg-white px-4 py-3"
              >
                <Switch
                  checked={row.is_working}
                  onChange={(checked) => updateRow(row.day_of_week, { is_working: checked })}
                />
                <span
                  className="w-8 text-sm font-semibold text-center shrink-0"
                  style={{ color: 'var(--color-charcoal)' }}
                >
                  {dayLabels[row.day_of_week]}
                </span>
                <div className="flex items-center gap-2">
                  <select
                    value={row.work_start}
                    onChange={(e) => updateRow(row.day_of_week, { work_start: e.target.value })}
                    disabled={!row.is_working}
                    className={INPUT_CLS}
                  >
                    {TIME_OPTIONS.map((time) => (
                      <option key={time} value={time}>{time}</option>
                    ))}
                  </select>
                  <span className="text-sm text-gray-400">—</span>
                  <select
                    value={row.work_end}
                    onChange={(e) => updateRow(row.day_of_week, { work_end: e.target.value })}
                    disabled={!row.is_working}
                    className={INPUT_CLS}
                  >
                    {TIME_OPTIONS.map((time) => (
                      <option key={time} value={time}>{time}</option>
                    ))}
                  </select>
                </div>
              </div>
              ))
            })()}
          </div>
        )}

        <div className="mt-6 flex items-center gap-4">
          <button
            onClick={handleSave}
            disabled={saving || loading}
            className="bg-[var(--color-rose)] text-white rounded-lg px-6 py-2 text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {saving ? tCommon('saving') : t('save_btn')}
          </button>
          {message && (
            <p className={`text-sm ${message.type === 'success' ? 'text-green-600' : 'text-red-500'}`}>
              {message.text}
            </p>
          )}
        </div>
      </div>

      {/* Vertical divider */}
      <div className="w-px bg-gray-100 self-stretch shrink-0" />

      {/* Right: Slots panel (2/3) */}
      <div className="flex-1 min-w-0">
        {/* Header with dropdown */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-[var(--color-charcoal)]">{t('add_slots_btn')}</h2>
          <div className="relative" ref={dropdownRef}>
            <button
              onClick={() => setDropdownOpen(v => !v)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 bg-white text-sm text-[var(--color-charcoal)] hover:border-[var(--color-rose)] transition-colors"
            >
              {t('add_slots_btn')}
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M2 4.5l5 5 5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>

            {dropdownOpen && (
              <div className="absolute right-0 top-full mt-1 z-20 bg-white border border-gray-100 rounded-xl shadow-lg py-1 min-w-[220px]">
                <button
                  onClick={() => {
                    setDropdownOpen(false)
                    setCustomRanges([{ from: '09:00', to: '18:00' }])
                    setSlotModal('day')
                  }}
                  className="w-full text-left px-4 py-2.5 text-sm text-[var(--color-charcoal)] hover:bg-gray-50 transition-colors"
                >
                  {t('add_slots_for')} ({t('selected_day')})
                </button>
                <button
                  onClick={() => {
                    setDropdownOpen(false)
                    const d = selectedDay ?? todayStr
                    setGenerateMsg(null)
                    setPendingGenerate({ dateFrom: d, dateTo: addDays(d, 6) })
                  }}
                  className="w-full text-left px-4 py-2.5 text-sm text-[var(--color-charcoal)] hover:bg-gray-50 transition-colors"
                >
                  {t('add_slots_for')} +7
                </button>
                <button
                  onClick={() => {
                    setDropdownOpen(false)
                    const d = selectedDay ?? todayStr
                    setGenerateMsg(null)
                    setPendingGenerate({ dateFrom: d, dateTo: addDays(d, 13) })
                  }}
                  className="w-full text-left px-4 py-2.5 text-sm text-[var(--color-charcoal)] hover:bg-gray-50 transition-colors"
                >
                  {t('add_slots_for')} +14
                </button>
                <div className="my-1 border-t border-gray-100" />
                <button
                  onClick={() => {
                    setDropdownOpen(false)
                    setRangeFrom(selectedDay ?? todayStr)
                    setRangeTo(selectedDay ?? todayStr)
                    setSlotModal('range')
                  }}
                  className="w-full text-left px-4 py-2.5 text-sm text-[var(--color-charcoal)] hover:bg-gray-50 transition-colors"
                >
                  {t('add_range_heading')}
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Month navigation */}
        <div className="flex items-center justify-between mb-4">
          <button
            onClick={() => navigateMonth(-1)}
            className="w-8 h-8 flex items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-500 hover:border-[var(--color-rose)] hover:text-[var(--color-rose)] transition-colors"
            aria-label={t('prev_month')}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M10 12L6 8l4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <span className="text-sm font-semibold text-[var(--color-charcoal)]">{monthLabel}</span>
          <button
            onClick={() => navigateMonth(1)}
            className="w-8 h-8 flex items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-500 hover:border-[var(--color-rose)] hover:text-[var(--color-rose)] transition-colors"
            aria-label={t('next_month')}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M6 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>

        {/* Day slider */}
        <div ref={daySliderRef} className="overflow-x-auto scrollbar-hide mb-4 -mx-1 py-1">
          <div className="flex gap-2 px-1 min-w-max">
            {daysInMonth.map(({ dateStr, date }) => {
              const isSelected = selectedDay === dateStr
              const isToday = dateStr === todayStr
              const weekday = new Intl.DateTimeFormat('uk-UA', { weekday: 'short', timeZone: 'Asia/Jerusalem' }).format(date)
              const dayNum = new Intl.DateTimeFormat('uk-UA', { day: 'numeric', timeZone: 'Asia/Jerusalem' }).format(date)
              const monthShort = new Intl.DateTimeFormat('uk-UA', { month: 'short', timeZone: 'Asia/Jerusalem' }).format(date)
              return (
                <button
                  key={dateStr}
                  ref={isToday ? todayBtnRef : undefined}
                  onClick={() => setSelectedDay(dateStr)}
                  className={[
                    'flex flex-col items-center justify-center rounded-xl px-3 py-3 min-w-[60px] transition-all duration-200',
                    isSelected
                      ? 'text-white shadow-md'
                      : isToday
                        ? 'ring-2 ring-[var(--color-rose)] bg-white text-[var(--color-charcoal)]'
                        : 'bg-white border border-gray-200 hover:border-[var(--color-rose)] text-[var(--color-charcoal)]',
                  ].join(' ')}
                  style={isSelected ? { background: 'var(--color-rose)' } : undefined}
                >
                  <span className="text-xs font-medium capitalize leading-tight">{weekday}</span>
                  <span className="text-xl font-bold leading-tight">{dayNum}</span>
                  <span className="text-xs leading-tight capitalize">{monthShort}</span>
                </button>
              )
            })}
          </div>
        </div>

        {/* Generate feedback */}
        {generateMsg && (
          <p className={`text-sm mb-3 ${generateMsg.type === 'success' ? 'text-green-600' : 'text-red-500'}`}>
            {generateMsg.text}
          </p>
        )}

        {/* Slot cubes */}
        {slotsLoading ? (
          <p className="text-sm text-gray-400 py-4">{tCommon('loading')}</p>
        ) : !selectedDay ? (
          <p className="text-sm text-gray-400 py-4 text-center">{t('selected_day')}</p>
        ) : slotsForDay.length === 0 ? (
          <p className="text-sm text-gray-400 py-4">{t('error_load')}</p>
        ) : (
          <div className="grid grid-cols-4 sm:grid-cols-6 lg:grid-cols-8 gap-2">
            {slotsForDay.map((slot) => (
              <div
                key={slot.id}
                className={`rounded-lg px-2 py-2 text-center text-xs font-medium ${SLOT_STATUS_CLS[slot.status] ?? SLOT_STATUS_CLS.blocked}`}
              >
                {formatLocalTime(slot.start_at)}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal: custom ranges for current day */}
      {slotModal === 'day' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-sm mx-4">
            <h3 className="text-base font-semibold text-[var(--color-charcoal)] mb-4">
              {t('add_slots_for')}{' '}
              {selectedDay
                ? new Date(selectedDay + 'T12:00:00').toLocaleDateString('uk-UA', { day: 'numeric', month: 'long' })
                : t('selected_day')}
            </h3>

            <div className="flex flex-col gap-3 mb-3">
              {customRanges.map((range, i) => (
                <div key={i} className="flex items-center gap-2">
                  <select
                    value={range.from}
                    onChange={e => setCustomRanges(prev => prev.map((r, j) => j === i ? { ...r, from: e.target.value } : r))}
                    className={INPUT_CLS}
                  >
                    {TIME_OPTIONS.map(time => <option key={time} value={time}>{time}</option>)}
                  </select>
                  <span className="text-sm text-gray-400 shrink-0">—</span>
                  <select
                    value={range.to}
                    onChange={e => setCustomRanges(prev => prev.map((r, j) => j === i ? { ...r, to: e.target.value } : r))}
                    className={INPUT_CLS}
                  >
                    {TIME_OPTIONS.map(time => <option key={time} value={time}>{time}</option>)}
                  </select>
                  {customRanges.length > 1 && (
                    <button
                      onClick={() => setCustomRanges(prev => prev.filter((_, j) => j !== i))}
                      className="text-gray-400 hover:text-red-500 transition-colors text-lg leading-none shrink-0"
                    >
                      ×
                    </button>
                  )}
                </div>
              ))}
            </div>

            <button
              onClick={() => setCustomRanges(prev => [...prev, { from: '09:00', to: '18:00' }])}
              className="text-sm text-[var(--color-rose)] hover:opacity-80 transition-opacity mb-5 flex items-center gap-1"
            >
              {t('add_interval_btn')}
            </button>

            {generateMsg && (
              <p className={`text-sm mb-3 ${generateMsg.type === 'success' ? 'text-green-600' : 'text-red-500'}`}>
                {generateMsg.text}
              </p>
            )}

            <div className="flex items-center justify-end gap-3">
              <button
                onClick={() => { setSlotModal(null); setGenerateMsg(null) }}
                className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700 transition-colors"
              >
                {tCommon('cancel')}
              </button>
              <button
                onClick={() => handleGenerateSlots(selectedDay ?? todayStr, selectedDay ?? todayStr, customRanges)}
                disabled={generating}
                className="px-4 py-2 bg-[var(--color-rose)] text-white rounded-lg text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                {generating ? t('generating') : tCommon('add')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation modal for schedule-based bulk generation */}
      {pendingGenerate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-sm mx-4">
            <h3 className="text-base font-semibold text-[var(--color-charcoal)] mb-2">
              {tCommon('confirm')}
            </h3>
            <p className="text-sm text-gray-500 mb-5">
              {t('add_slots_for')}{' '}
              <span className="font-medium text-[var(--color-charcoal)]">
                {new Date(pendingGenerate.dateFrom + 'T12:00:00').toLocaleDateString('uk-UA', { day: 'numeric', month: 'long' })}
              </span>
              {' — '}
              <span className="font-medium text-[var(--color-charcoal)]">
                {new Date(pendingGenerate.dateTo + 'T12:00:00').toLocaleDateString('uk-UA', { day: 'numeric', month: 'long', year: 'numeric' })}
              </span>
              {' '}
              <span className="text-gray-400">
                {'('}
                {Math.round(
                  (new Date(pendingGenerate.dateTo + 'T12:00:00').getTime() -
                    new Date(pendingGenerate.dateFrom + 'T12:00:00').getTime()) /
                    86400000,
                ) + 1}
                {')'}
              </span>
            </p>

            {generateMsg && (
              <p className={`text-sm mb-3 ${generateMsg.type === 'success' ? 'text-green-600' : 'text-red-500'}`}>
                {generateMsg.text}
              </p>
            )}

            <div className="flex items-center justify-end gap-3">
              <button
                onClick={() => { setPendingGenerate(null); setGenerateMsg(null) }}
                disabled={generating}
                className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700 transition-colors disabled:opacity-50"
              >
                {tCommon('cancel')}
              </button>
              <button
                onClick={() => handleGenerateSlots(pendingGenerate.dateFrom, pendingGenerate.dateTo)}
                disabled={generating}
                className="px-4 py-2 bg-[var(--color-rose)] text-white rounded-lg text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                {generating ? t('creating') : tCommon('create')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: date range (uses schedule) */}
      {slotModal === 'range' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-sm mx-4">
            <h3 className="text-base font-semibold text-[var(--color-charcoal)] mb-4">
              {t('add_range_heading')}
            </h3>

            <div className="flex flex-col gap-3 mb-5">
              <div className="flex items-center gap-3">
                <label className="text-sm text-gray-500 w-5 shrink-0">Z</label>
                <input
                  type="date"
                  value={rangeFrom}
                  onChange={e => setRangeFrom(e.target.value)}
                  className={INPUT_CLS + ' flex-1'}
                />
              </div>
              <div className="flex items-center gap-3">
                <label className="text-sm text-gray-500 w-5 shrink-0">—</label>
                <input
                  type="date"
                  value={rangeTo}
                  onChange={e => setRangeTo(e.target.value)}
                  className={INPUT_CLS + ' flex-1'}
                />
              </div>
            </div>

            {generateMsg && (
              <p className={`text-sm mb-3 ${generateMsg.type === 'success' ? 'text-green-600' : 'text-red-500'}`}>
                {generateMsg.text}
              </p>
            )}

            <div className="flex items-center justify-end gap-3">
              <button
                onClick={() => { setSlotModal(null); setGenerateMsg(null) }}
                className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700 transition-colors"
              >
                {tCommon('cancel')}
              </button>
              <button
                onClick={() => {
                  setSlotModal(null)
                  setGenerateMsg(null)
                  setPendingGenerate({ dateFrom: rangeFrom, dateTo: rangeTo })
                }}
                disabled={!rangeFrom || !rangeTo || rangeTo < rangeFrom}
                className="px-4 py-2 bg-[var(--color-rose)] text-white rounded-lg text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                {tCommon('confirm')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
