'use client'

import { useState, useEffect, useCallback } from 'react'
import type { AdminSlotDTO, GenerateSlotsResponse, GetAdminSlotsResponse } from '@/lib/types'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function todayString(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Jerusalem' })
}

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

function formatLocalTime(isoStr: string): string {
  return new Date(isoStr).toLocaleTimeString('ru-RU', {
    timeZone: 'Asia/Jerusalem',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function formatLocalDate(isoStr: string): string {
  return new Date(isoStr).toLocaleDateString('ru-RU', {
    timeZone: 'Asia/Jerusalem',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Studio = 'rishon' | 'ashdod'

interface InlineMessage {
  type: 'success' | 'error'
  text: string
}

// ---------------------------------------------------------------------------
// Auth Gate
// ---------------------------------------------------------------------------

function AuthGate({ onAuth }: { onAuth: (secret: string) => void }) {
  const [input, setInput] = useState('')
  const [error, setError] = useState('')

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!input.trim()) {
      setError('Введите пароль')
      return
    }
    localStorage.setItem('admin_secret', input.trim())
    onAuth(input.trim())
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-[var(--color-cream)]">
      <div className="bg-white border border-[var(--color-blush)] rounded-xl p-8 w-full max-w-sm shadow-sm">
        <h1 className="text-xl font-semibold text-[var(--color-charcoal)] mb-6 text-center">
          Вход в панель управления
        </h1>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <input
            type="password"
            placeholder="Пароль администратора"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            className="border border-gray-300 rounded-lg px-4 py-2 text-sm focus:outline-none focus:border-[var(--color-rose)]"
            autoFocus
          />
          {error && <p className="text-red-500 text-xs">{error}</p>}
          <button
            type="submit"
            className="bg-[var(--color-rose)] text-white rounded-lg px-4 py-2 text-sm font-medium hover:opacity-90 transition-opacity"
          >
            Войти
          </button>
        </form>
      </div>
    </main>
  )
}

// ---------------------------------------------------------------------------
// Main Admin Page
// ---------------------------------------------------------------------------

export default function AdminPage() {
  const [secret, setSecret] = useState<string | null>(null)
  const [studio, setStudio] = useState<Studio>('rishon')

  // Generate form state
  const [genDate, setGenDate] = useState(todayString())
  const [genStartTime, setGenStartTime] = useState('10:00')
  const [genEndTime, setGenEndTime] = useState('18:00')
  const [genDuration, setGenDuration] = useState(60)
  const [genMessage, setGenMessage] = useState<InlineMessage | null>(null)
  const [genLoading, setGenLoading] = useState(false)

  // Slots list state
  const [listDateFrom, setListDateFrom] = useState(todayString())
  const [listDateTo, setListDateTo] = useState(addDays(todayString(), 7))
  const [slots, setSlots] = useState<AdminSlotDTO[]>([])
  const [listMessage, setListMessage] = useState<InlineMessage | null>(null)
  const [listLoading, setListLoading] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  // Bootstrap secret from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem('admin_secret')
    if (stored) setSecret(stored)
  }, [])

  // ---------------------------------------------------------------------------
  // API helpers
  // ---------------------------------------------------------------------------

  const apiFetch = useCallback(
    async (path: string, options: RequestInit = {}): Promise<Response> => {
      return fetch(path, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          'X-Admin-Secret': secret ?? '',
          ...(options.headers ?? {}),
        },
      })
    },
    [secret],
  )

  // ---------------------------------------------------------------------------
  // Load slots
  // ---------------------------------------------------------------------------

  const loadSlots = useCallback(async () => {
    if (!secret) return
    setListLoading(true)
    setListMessage(null)
    try {
      const params = new URLSearchParams({
        studio_id: studio,
        date_from: listDateFrom,
        date_to: listDateTo,
      })
      const res = await apiFetch(`/api/admin/slots?${params.toString()}`)
      if (res.status === 401) {
        localStorage.removeItem('admin_secret')
        setSecret(null)
        return
      }
      if (!res.ok) {
        const body = await res.json() as { error?: { message?: string } }
        setListMessage({ type: 'error', text: body.error?.message ?? 'Ошибка загрузки слотов' })
        return
      }
      const data = await res.json() as GetAdminSlotsResponse
      setSlots(data.slots)
    } catch {
      setListMessage({ type: 'error', text: 'Сетевая ошибка при загрузке слотов' })
    } finally {
      setListLoading(false)
    }
  }, [secret, studio, listDateFrom, listDateTo, apiFetch])

  // Reload when studio or secret changes
  useEffect(() => {
    if (secret) {
      loadSlots()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [secret, studio])

  // ---------------------------------------------------------------------------
  // Generate slots
  // ---------------------------------------------------------------------------

  async function handleGenerate(e: React.FormEvent) {
    e.preventDefault()
    if (!secret) return
    setGenLoading(true)
    setGenMessage(null)
    try {
      const res = await apiFetch('/api/admin/slots', {
        method: 'POST',
        body: JSON.stringify({
          studio_id: studio,
          date: genDate,
          slot_duration_minutes: genDuration,
          start_time: genStartTime,
          end_time: genEndTime,
        }),
      })
      if (res.status === 401) {
        localStorage.removeItem('admin_secret')
        setSecret(null)
        return
      }
      if (!res.ok) {
        const body = await res.json() as { error?: { message?: string } }
        setGenMessage({ type: 'error', text: body.error?.message ?? 'Ошибка создания слотов' })
        return
      }
      const data = await res.json() as GenerateSlotsResponse
      setGenMessage({
        type: 'success',
        text: `Создано ${data.created} слотов${data.skipped > 0 ? `, пропущено ${data.skipped} (уже существуют)` : ''}`,
      })
      // Refresh list if the generated date falls in the current view range
      if (genDate >= listDateFrom && genDate <= listDateTo) {
        await loadSlots()
      }
    } catch {
      setGenMessage({ type: 'error', text: 'Сетевая ошибка при создании слотов' })
    } finally {
      setGenLoading(false)
    }
  }

  // ---------------------------------------------------------------------------
  // Delete slot
  // ---------------------------------------------------------------------------

  async function handleDelete(id: string) {
    if (!secret) return
    setDeletingId(id)
    setListMessage(null)
    try {
      const res = await apiFetch(`/api/admin/slots/${id}`, { method: 'DELETE' })
      if (res.status === 401) {
        localStorage.removeItem('admin_secret')
        setSecret(null)
        return
      }
      if (!res.ok) {
        const body = await res.json() as { error?: { message?: string } }
        setListMessage({ type: 'error', text: body.error?.message ?? 'Ошибка удаления слота' })
        return
      }
      setSlots((prev) => prev.filter((s) => s.id !== id))
    } catch {
      setListMessage({ type: 'error', text: 'Сетевая ошибка при удалении слота' })
    } finally {
      setDeletingId(null)
    }
  }

  // ---------------------------------------------------------------------------
  // Render: auth gate
  // ---------------------------------------------------------------------------

  if (!secret) {
    return <AuthGate onAuth={setSecret} />
  }

  // ---------------------------------------------------------------------------
  // Render: main UI
  // ---------------------------------------------------------------------------

  return (
    <main className="min-h-screen bg-[var(--color-cream)] p-4 md:p-8">
      {/* Header */}
      <div className="max-w-5xl mx-auto">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
          <h1 className="text-2xl font-semibold text-[var(--color-charcoal)]">
            Управление записями — WOVSDH Nails
          </h1>
          <button
            onClick={() => {
              localStorage.removeItem('admin_secret')
              setSecret(null)
            }}
            className="text-sm text-gray-500 underline self-start sm:self-auto"
          >
            Выйти
          </button>
        </div>

        {/* Studio switcher */}
        <div className="flex gap-2 mb-8">
          {(['rishon', 'ashdod'] as Studio[]).map((s) => (
            <button
              key={s}
              onClick={() => setStudio(s)}
              className={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${
                studio === s
                  ? 'bg-[var(--color-rose)] text-white border-[var(--color-rose)]'
                  : 'bg-white text-[var(--color-charcoal)] border-gray-300 hover:border-[var(--color-rose)]'
              }`}
            >
              {s === 'rishon' ? 'Ришон-ле-Цион' : 'Ашдод'}
            </button>
          ))}
        </div>

        {/* Generate slots form */}
        <section className="bg-white border border-[var(--color-blush)] rounded-xl p-6 mb-8">
          <h2 className="text-lg font-semibold text-[var(--color-charcoal)] mb-4">
            Генерация слотов
          </h2>
          <form onSubmit={handleGenerate} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <label className="flex flex-col gap-1 text-sm text-gray-600">
              Дата
              <input
                type="date"
                value={genDate}
                onChange={(e) => setGenDate(e.target.value)}
                required
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm text-[var(--color-charcoal)] focus:outline-none focus:border-[var(--color-rose)]"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm text-gray-600">
              Время начала
              <input
                type="time"
                value={genStartTime}
                onChange={(e) => setGenStartTime(e.target.value)}
                required
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm text-[var(--color-charcoal)] focus:outline-none focus:border-[var(--color-rose)]"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm text-gray-600">
              Время окончания
              <input
                type="time"
                value={genEndTime}
                onChange={(e) => setGenEndTime(e.target.value)}
                required
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm text-[var(--color-charcoal)] focus:outline-none focus:border-[var(--color-rose)]"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm text-gray-600">
              Длительность слота
              <select
                value={genDuration}
                onChange={(e) => setGenDuration(Number(e.target.value))}
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm text-[var(--color-charcoal)] focus:outline-none focus:border-[var(--color-rose)]"
              >
                <option value={30}>30 мин</option>
                <option value={45}>45 мин</option>
                <option value={60}>60 мин</option>
                <option value={90}>90 мин</option>
              </select>
            </label>
            <div className="flex items-end sm:col-span-2 lg:col-span-2">
              <button
                type="submit"
                disabled={genLoading}
                className="bg-[var(--color-rose)] text-white rounded-lg px-6 py-2 text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                {genLoading ? 'Создание...' : 'Создать слоты'}
              </button>
            </div>
          </form>

          {genMessage && (
            <p
              className={`mt-4 text-sm ${
                genMessage.type === 'success' ? 'text-green-600' : 'text-red-500'
              }`}
            >
              {genMessage.text}
            </p>
          )}
        </section>

        {/* Slots list */}
        <section className="bg-white border border-[var(--color-blush)] rounded-xl p-6">
          <h2 className="text-lg font-semibold text-[var(--color-charcoal)] mb-4">
            Список слотов
          </h2>

          {/* Date range filters */}
          <div className="flex flex-wrap gap-4 mb-4">
            <label className="flex flex-col gap-1 text-sm text-gray-600">
              Дата с
              <input
                type="date"
                value={listDateFrom}
                onChange={(e) => setListDateFrom(e.target.value)}
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm text-[var(--color-charcoal)] focus:outline-none focus:border-[var(--color-rose)]"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm text-gray-600">
              Дата по
              <input
                type="date"
                value={listDateTo}
                onChange={(e) => setListDateTo(e.target.value)}
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm text-[var(--color-charcoal)] focus:outline-none focus:border-[var(--color-rose)]"
              />
            </label>
            <div className="flex items-end">
              <button
                onClick={loadSlots}
                disabled={listLoading}
                className="border border-[var(--color-rose)] text-[var(--color-rose)] rounded-lg px-4 py-2 text-sm font-medium hover:bg-[var(--color-blush)] transition-colors disabled:opacity-50"
              >
                {listLoading ? 'Загрузка...' : 'Обновить список'}
              </button>
            </div>
          </div>

          {listMessage && (
            <p
              className={`mb-4 text-sm ${
                listMessage.type === 'success' ? 'text-green-600' : 'text-red-500'
              }`}
            >
              {listMessage.text}
            </p>
          )}

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="border-b border-gray-200 text-left text-gray-500">
                  <th className="py-2 pr-4 font-medium">Дата</th>
                  <th className="py-2 pr-4 font-medium">Время</th>
                  <th className="py-2 pr-4 font-medium">Статус</th>
                  <th className="py-2 pr-4 font-medium">Клиент</th>
                  <th className="py-2 font-medium">Действие</th>
                </tr>
              </thead>
              <tbody>
                {slots.length === 0 && !listLoading && (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-gray-400">
                      Слоты не найдены
                    </td>
                  </tr>
                )}
                {listLoading && (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-gray-400">
                      Загрузка...
                    </td>
                  </tr>
                )}
                {!listLoading &&
                  slots.map((slot) => {
                    const canDelete = slot.status !== 'booked'
                    const isDeleting = deletingId === slot.id
                    return (
                      <tr
                        key={slot.id}
                        className="border-b border-gray-100 hover:bg-gray-50 transition-colors"
                      >
                        <td className="py-2 pr-4 text-[var(--color-charcoal)]">
                          {formatLocalDate(slot.start_at)}
                        </td>
                        <td className="py-2 pr-4 text-[var(--color-charcoal)]">
                          {formatLocalTime(slot.start_at)}–{formatLocalTime(slot.end_at)}
                        </td>
                        <td className="py-2 pr-4">
                          <StatusBadge status={slot.status} />
                        </td>
                        <td className="py-2 pr-4 text-[var(--color-charcoal)]">
                          {slot.booking
                            ? `${slot.booking.client_first_name} ${slot.booking.client_last_name}`
                            : '—'}
                        </td>
                        <td className="py-2">
                          <button
                            onClick={() => handleDelete(slot.id)}
                            disabled={!canDelete || isDeleting}
                            title={
                              !canDelete
                                ? 'Нельзя удалить слот с активной бронью'
                                : 'Удалить слот'
                            }
                            className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                              canDelete && !isDeleting
                                ? 'bg-red-50 text-red-600 border border-red-200 hover:bg-red-100'
                                : 'bg-gray-100 text-gray-400 border border-gray-200 cursor-not-allowed'
                            }`}
                          >
                            {isDeleting ? '...' : 'Удалить'}
                          </button>
                        </td>
                      </tr>
                    )
                  })}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </main>
  )
}

// ---------------------------------------------------------------------------
// Status badge component
// ---------------------------------------------------------------------------

function StatusBadge({ status }: { status: string }) {
  const config: Record<string, { label: string; className: string }> = {
    available: {
      label: 'Свободен',
      className: 'bg-green-50 text-green-700 border border-green-200',
    },
    booked: {
      label: 'Забронирован',
      className: 'bg-red-50 text-red-700 border border-red-200',
    },
    blocked: {
      label: 'Заблокирован',
      className: 'bg-gray-100 text-gray-600 border border-gray-300',
    },
  }

  const { label, className } = config[status] ?? {
    label: status,
    className: 'bg-gray-100 text-gray-600 border border-gray-300',
  }

  return (
    <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${className}`}>
      {label}
    </span>
  )
}
