'use client'

import { useState, useEffect, useCallback } from 'react'
import type {
  AdminSlotDTO,
  GenerateSlotsFromTemplateResponse,
  GetAdminSlotsResponse,
  ServiceDTO,
  StudioScheduleTemplate,
  GetMasterScheduleResponse,
} from '@/lib/types'

// Admin services endpoint returns ServiceDTO + is_active field
interface AdminServiceDTO extends ServiceDTO {
  is_active: boolean
}

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
type AdminTab = 'bookings' | 'services' | 'schedule'

interface InlineMessage {
  type: 'success' | 'error'
  text: string
}

// Day labels index 0=Sun..6=Sat
const DAY_LABELS = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб']

const DURATION_OPTIONS = [15, 30, 45, 60, 75, 90, 105, 120]

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

// ---------------------------------------------------------------------------
// Services Tab
// ---------------------------------------------------------------------------

interface ServicesTabProps {
  studio: Studio
  apiFetch: (path: string, options?: RequestInit) => Promise<Response>
  onUnauth: () => void
}

function ServicesTab({ studio, apiFetch, onUnauth }: ServicesTabProps) {
  const [services, setServices] = useState<AdminServiceDTO[]>([])
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<InlineMessage | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [togglingId, setTogglingId] = useState<string | null>(null)

  // New service form state
  const [newIcon, setNewIcon] = useState('')
  const [newName, setNewName] = useState('')
  const [newDescription, setNewDescription] = useState('')
  const [newPrice, setNewPrice] = useState('')
  const [newDuration, setNewDuration] = useState(60)
  const [formLoading, setFormLoading] = useState(false)

  const loadServices = useCallback(async () => {
    setLoading(true)
    setMessage(null)
    try {
      const res = await apiFetch(`/api/admin/services?studio_id=${studio}`)
      if (res.status === 401) { onUnauth(); return }
      if (!res.ok) {
        const body = await res.json() as { error?: { message?: string } }
        setMessage({ type: 'error', text: body.error?.message ?? 'Ошибка загрузки услуг' })
        return
      }
      const data = await res.json() as { services: AdminServiceDTO[] }
      setServices(data.services ?? [])
    } catch {
      setMessage({ type: 'error', text: 'Сетевая ошибка при загрузке услуг' })
    } finally {
      setLoading(false)
    }
  }, [studio, apiFetch, onUnauth])

  useEffect(() => {
    loadServices()
  }, [loadServices])

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!newName.trim() || !newPrice) return
    setFormLoading(true)
    setMessage(null)
    try {
      const res = await apiFetch('/api/admin/services', {
        method: 'POST',
        body: JSON.stringify({
          studio_id: studio,
          icon: newIcon.trim() || undefined,
          name: newName.trim(),
          description: newDescription.trim() || undefined,
          price: Number(newPrice),
          duration_minutes: newDuration,
        }),
      })
      if (res.status === 401) { onUnauth(); return }
      if (!res.ok) {
        const body = await res.json() as { error?: { message?: string } }
        setMessage({ type: 'error', text: body.error?.message ?? 'Ошибка создания услуги' })
        return
      }
      setMessage({ type: 'success', text: 'Услуга создана' })
      setShowForm(false)
      setNewIcon(''); setNewName(''); setNewDescription(''); setNewPrice(''); setNewDuration(60)
      await loadServices()
    } catch {
      setMessage({ type: 'error', text: 'Сетевая ошибка при создании услуги' })
    } finally {
      setFormLoading(false)
    }
  }

  async function handleToggle(service: AdminServiceDTO) {
    setTogglingId(service.id)
    setMessage(null)
    try {
      const res = await apiFetch(`/api/admin/services/${service.id}`, {
        method: 'PUT',
        body: JSON.stringify({ is_active: !service.is_active }),
      })
      if (res.status === 401) { onUnauth(); return }
      if (!res.ok) {
        const body = await res.json() as { error?: { message?: string } }
        setMessage({ type: 'error', text: body.error?.message ?? 'Ошибка обновления услуги' })
        return
      }
      await loadServices()
    } catch {
      setMessage({ type: 'error', text: 'Сетевая ошибка при обновлении услуги' })
    } finally {
      setTogglingId(null)
    }
  }

  const INPUT_CLS = 'border border-gray-300 rounded-lg px-3 py-2 text-sm text-[var(--color-charcoal)] focus:outline-none focus:border-[var(--color-rose)]'

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-[var(--color-charcoal)]">Услуги</h2>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="bg-[var(--color-rose)] text-white rounded-lg px-4 py-2 text-sm font-medium hover:opacity-90 transition-opacity"
        >
          {showForm ? 'Скрыть форму' : 'Добавить услугу'}
        </button>
      </div>

      {/* Create form */}
      {showForm && (
        <form
          onSubmit={handleCreate}
          className="mb-6 border border-[var(--color-blush)] rounded-xl p-5 bg-white grid grid-cols-1 sm:grid-cols-2 gap-4"
        >
          <label className="flex flex-col gap-1 text-sm text-gray-600">
            Иконка (emoji)
            <input
              type="text"
              value={newIcon}
              onChange={(e) => setNewIcon(e.target.value)}
              placeholder="💅"
              className={INPUT_CLS}
              disabled={formLoading}
            />
          </label>
          <label className="flex flex-col gap-1 text-sm text-gray-600">
            Название <span className="text-red-500">*</span>
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Маникюр"
              required
              className={INPUT_CLS}
              disabled={formLoading}
            />
          </label>
          <label className="flex flex-col gap-1 text-sm text-gray-600 sm:col-span-2">
            Описание
            <input
              type="text"
              value={newDescription}
              onChange={(e) => setNewDescription(e.target.value)}
              placeholder="Краткое описание услуги"
              className={INPUT_CLS}
              disabled={formLoading}
            />
          </label>
          <label className="flex flex-col gap-1 text-sm text-gray-600">
            Цена (₪) <span className="text-red-500">*</span>
            <input
              type="number"
              min={0}
              value={newPrice}
              onChange={(e) => setNewPrice(e.target.value)}
              placeholder="150"
              required
              className={INPUT_CLS}
              disabled={formLoading}
            />
          </label>
          <label className="flex flex-col gap-1 text-sm text-gray-600">
            Длительность
            <select
              value={newDuration}
              onChange={(e) => setNewDuration(Number(e.target.value))}
              className={INPUT_CLS}
              disabled={formLoading}
            >
              {DURATION_OPTIONS.map((d) => (
                <option key={d} value={d}>{d} мин</option>
              ))}
            </select>
          </label>
          <div className="sm:col-span-2 flex gap-3">
            <button
              type="submit"
              disabled={formLoading}
              className="bg-[var(--color-rose)] text-white rounded-lg px-6 py-2 text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {formLoading ? 'Сохранение...' : 'Сохранить'}
            </button>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="border border-gray-300 text-gray-600 rounded-lg px-4 py-2 text-sm font-medium hover:bg-gray-50 transition-colors"
            >
              Отмена
            </button>
          </div>
        </form>
      )}

      {message && (
        <p className={`mb-4 text-sm ${message.type === 'success' ? 'text-green-600' : 'text-red-500'}`}>
          {message.text}
        </p>
      )}

      {loading ? (
        <p className="text-sm text-gray-400 py-4">Загрузка...</p>
      ) : services.length === 0 ? (
        <p className="text-sm text-gray-400 py-4">Услуги не найдены</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b border-gray-200 text-left text-gray-500">
                <th className="py-2 pr-4 font-medium">Иконка</th>
                <th className="py-2 pr-4 font-medium">Название</th>
                <th className="py-2 pr-4 font-medium">Длительность</th>
                <th className="py-2 pr-4 font-medium">Цена</th>
                <th className="py-2 pr-4 font-medium">Статус</th>
                <th className="py-2 font-medium">Действие</th>
              </tr>
            </thead>
            <tbody>
              {services.map((svc) => (
                <tr key={svc.id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                  <td className="py-2 pr-4 text-xl">{svc.icon ?? '—'}</td>
                  <td className="py-2 pr-4 text-[var(--color-charcoal)] font-medium">{svc.name}</td>
                  <td className="py-2 pr-4 text-[var(--color-charcoal)]">{svc.duration_minutes} мин</td>
                  <td className="py-2 pr-4 text-[var(--color-charcoal)]">₪{svc.price}</td>
                  <td className="py-2 pr-4">
                    <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${
                      svc.is_active
                        ? 'bg-green-50 text-green-700 border border-green-200'
                        : 'bg-gray-100 text-gray-500 border border-gray-300'
                    }`}>
                      {svc.is_active ? 'Активна' : 'Неактивна'}
                    </span>
                  </td>
                  <td className="py-2">
                    <button
                      onClick={() => handleToggle(svc)}
                      disabled={togglingId === svc.id}
                      className={`px-3 py-1 rounded text-xs font-medium transition-colors disabled:opacity-50 ${
                        svc.is_active
                          ? 'bg-gray-100 text-gray-600 border border-gray-200 hover:bg-gray-200'
                          : 'bg-green-50 text-green-700 border border-green-200 hover:bg-green-100'
                      }`}
                    >
                      {togglingId === svc.id ? '...' : svc.is_active ? 'Деактивировать' : 'Активировать'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Schedule Tab
// ---------------------------------------------------------------------------

interface ScheduleTabProps {
  studio: Studio
  apiFetch: (path: string, options?: RequestInit) => Promise<Response>
  onUnauth: () => void
}

// Local row state for editing
interface ScheduleRow {
  day_of_week: number
  is_working: boolean
  work_start: string
  work_end: string
}

function buildDefaultSchedule(): ScheduleRow[] {
  return Array.from({ length: 7 }, (_, i) => ({
    day_of_week: i,
    is_working: i >= 1 && i <= 5, // Mon–Fri on by default
    work_start: '10:00',
    work_end: '18:00',
  }))
}

function templateToRows(templates: StudioScheduleTemplate[]): ScheduleRow[] {
  const defaults = buildDefaultSchedule()
  templates.forEach((t) => {
    const row = defaults.find((r) => r.day_of_week === t.day_of_week)
    if (row) {
      row.is_working = t.is_working
      // work_start/work_end come as 'HH:mm:ss' — strip seconds
      row.work_start = t.work_start.slice(0, 5)
      row.work_end = t.work_end.slice(0, 5)
    }
  })
  return defaults
}

function ScheduleTab({ studio, apiFetch, onUnauth }: ScheduleTabProps) {
  const [rows, setRows] = useState<ScheduleRow[]>(buildDefaultSchedule())
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<InlineMessage | null>(null)

  const loadSchedule = useCallback(async () => {
    setLoading(true)
    setMessage(null)
    try {
      const res = await apiFetch(`/api/admin/master-schedule?studio_id=${studio}`)
      if (res.status === 401) { onUnauth(); return }
      if (!res.ok) {
        const body = await res.json() as { error?: { message?: string } }
        setMessage({ type: 'error', text: body.error?.message ?? 'Ошибка загрузки расписания' })
        return
      }
      const data = await res.json() as GetMasterScheduleResponse
      setRows(templateToRows(data.schedule))
    } catch {
      setMessage({ type: 'error', text: 'Сетевая ошибка при загрузке расписания' })
    } finally {
      setLoading(false)
    }
  }, [studio, apiFetch, onUnauth])

  useEffect(() => {
    loadSchedule()
  }, [loadSchedule])

  function updateRow(dayOfWeek: number, patch: Partial<ScheduleRow>) {
    setRows((prev) =>
      prev.map((r) => (r.day_of_week === dayOfWeek ? { ...r, ...patch } : r)),
    )
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
          days: rows.map((r) => ({
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
        setMessage({ type: 'error', text: body.error?.message ?? 'Ошибка сохранения расписания' })
        return
      }
      setMessage({ type: 'success', text: 'Сохранено!' })
    } catch {
      setMessage({ type: 'error', text: 'Сетевая ошибка при сохранении расписания' })
    } finally {
      setSaving(false)
    }
  }

  const INPUT_CLS = 'border border-gray-300 rounded-lg px-3 py-1.5 text-sm text-[var(--color-charcoal)] focus:outline-none focus:border-[var(--color-rose)] disabled:opacity-40 disabled:cursor-not-allowed'

  return (
    <div>
      <h2 className="text-lg font-semibold text-[var(--color-charcoal)] mb-4">
        Расписание работы
      </h2>

      {loading ? (
        <p className="text-sm text-gray-400 py-4">Загрузка...</p>
      ) : (
        <div className="flex flex-col gap-2">
          {rows.map((row) => (
            <div
              key={row.day_of_week}
              className="flex flex-wrap items-center gap-4 rounded-xl border border-gray-100 bg-white px-4 py-3"
            >
              {/* Day label */}
              <span
                className="w-8 text-sm font-semibold text-center shrink-0"
                style={{ color: 'var(--color-charcoal)' }}
              >
                {DAY_LABELS[row.day_of_week]}
              </span>

              {/* Toggle */}
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={row.is_working}
                  onChange={(e) => updateRow(row.day_of_week, { is_working: e.target.checked })}
                  className="h-4 w-4 accent-[var(--color-rose)]"
                />
                <span className="text-sm" style={{ color: 'var(--color-charcoal)', opacity: 0.8 }}>
                  {row.is_working ? 'Вкл' : 'Выкл'}
                </span>
              </label>

              {/* Time inputs */}
              <div className="flex items-center gap-2">
                <input
                  type="time"
                  value={row.work_start}
                  onChange={(e) => updateRow(row.day_of_week, { work_start: e.target.value })}
                  disabled={!row.is_working}
                  className={INPUT_CLS}
                />
                <span className="text-sm text-gray-400">—</span>
                <input
                  type="time"
                  value={row.work_end}
                  onChange={(e) => updateRow(row.day_of_week, { work_end: e.target.value })}
                  disabled={!row.is_working}
                  className={INPUT_CLS}
                />
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="mt-6 flex items-center gap-4">
        <button
          onClick={handleSave}
          disabled={saving || loading}
          className="bg-[var(--color-rose)] text-white rounded-lg px-6 py-2 text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
        >
          {saving ? 'Сохранение...' : 'Сохранить расписание'}
        </button>
        {message && (
          <p className={`text-sm ${message.type === 'success' ? 'text-green-600' : 'text-red-500'}`}>
            {message.text}
          </p>
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main Admin Page
// ---------------------------------------------------------------------------

export default function AdminPage() {
  const [secret, setSecret] = useState<string | null>(null)
  const [studio, setStudio] = useState<Studio>('rishon')
  const [activeTab, setActiveTab] = useState<AdminTab>('bookings')

  // Generate form state
  const [genDateFrom, setGenDateFrom] = useState(todayString())
  const [genDateTo, setGenDateTo] = useState(addDays(todayString(), 7))
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

  function handleUnauth() {
    localStorage.removeItem('admin_secret')
    setSecret(null)
  }

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
        handleUnauth()
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
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
      const res = await apiFetch('/api/admin/generate-slots', {
        method: 'POST',
        body: JSON.stringify({
          studio_id: studio,
          date_from: genDateFrom,
          date_to: genDateTo,
        }),
      })
      if (res.status === 401) {
        handleUnauth()
        return
      }
      if (!res.ok) {
        const body = await res.json() as { error?: { message?: string } }
        setGenMessage({ type: 'error', text: body.error?.message ?? 'Ошибка генерации слотов' })
        return
      }
      const data = await res.json() as GenerateSlotsFromTemplateResponse
      setGenMessage({
        type: 'success',
        text: `Создано ${data.created} слотов${data.skipped > 0 ? `, пропущено ${data.skipped} (уже существуют)` : ''}`,
      })
      // Refresh list if the range overlaps
      if (genDateFrom <= listDateTo && genDateTo >= listDateFrom) {
        await loadSlots()
      }
    } catch {
      setGenMessage({ type: 'error', text: 'Сетевая ошибка при генерации слотов' })
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
        handleUnauth()
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

  const INPUT_CLS = 'border border-gray-300 rounded-lg px-3 py-2 text-sm text-[var(--color-charcoal)] focus:outline-none focus:border-[var(--color-rose)]'

  const TABS: { key: AdminTab; label: string }[] = [
    { key: 'bookings', label: 'Записи' },
    { key: 'services', label: 'Услуги' },
    { key: 'schedule', label: 'Расписание' },
  ]

  return (
    <main className="min-h-screen bg-[var(--color-cream)] p-4 md:p-8">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
          <h1 className="text-2xl font-semibold text-[var(--color-charcoal)]">
            Управление — WOVSDH Nails
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
        <div className="flex gap-2 mb-6">
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

        {/* Tab bar */}
        <div className="flex gap-1 mb-8 border-b border-gray-200">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px ${
                activeTab === tab.key
                  ? 'border-[var(--color-rose)] text-[var(--color-rose)]'
                  : 'border-transparent text-gray-500 hover:text-[var(--color-charcoal)]'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab: Записи */}
        {activeTab === 'bookings' && (
          <>
            {/* Generate slots form */}
            <section className="bg-white border border-[var(--color-blush)] rounded-xl p-6 mb-8">
              <h2 className="text-lg font-semibold text-[var(--color-charcoal)] mb-4">
                Генерация слотов из расписания
              </h2>
              <form onSubmit={handleGenerate} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <label className="flex flex-col gap-1 text-sm text-gray-600">
                  Дата с
                  <input
                    type="date"
                    value={genDateFrom}
                    onChange={(e) => setGenDateFrom(e.target.value)}
                    required
                    className={INPUT_CLS}
                  />
                </label>
                <label className="flex flex-col gap-1 text-sm text-gray-600">
                  Дата по
                  <input
                    type="date"
                    value={genDateTo}
                    onChange={(e) => setGenDateTo(e.target.value)}
                    required
                    className={INPUT_CLS}
                  />
                </label>
                <div className="flex items-end">
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
                    className={INPUT_CLS}
                  />
                </label>
                <label className="flex flex-col gap-1 text-sm text-gray-600">
                  Дата по
                  <input
                    type="date"
                    value={listDateTo}
                    onChange={(e) => setListDateTo(e.target.value)}
                    className={INPUT_CLS}
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
                      <th className="py-2 pr-4 font-medium">Клиент / Услуга</th>
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
                        const endAt = new Date(
                          new Date(slot.start_at).getTime() + 15 * 60 * 1000,
                        ).toISOString()

                        // Show service name from snapshot if available
                        const serviceName =
                          slot.booking &&
                          typeof (slot.booking as { service_snapshot?: { name?: string } }).service_snapshot?.name === 'string'
                            ? (slot.booking as { service_snapshot?: { name?: string } }).service_snapshot?.name
                            : null

                        return (
                          <tr
                            key={slot.id}
                            className="border-b border-gray-100 hover:bg-gray-50 transition-colors"
                          >
                            <td className="py-2 pr-4 text-[var(--color-charcoal)]">
                              {formatLocalDate(slot.start_at)}
                            </td>
                            <td className="py-2 pr-4 text-[var(--color-charcoal)]">
                              {formatLocalTime(slot.start_at)}–{formatLocalTime(endAt)}
                            </td>
                            <td className="py-2 pr-4">
                              <StatusBadge status={slot.status} />
                            </td>
                            <td className="py-2 pr-4 text-[var(--color-charcoal)]">
                              {slot.booking ? (
                                <div>
                                  <span>{slot.booking.client_first_name} {slot.booking.client_last_name}</span>
                                  {serviceName && (
                                    <span className="ml-2 text-xs text-gray-500">({serviceName})</span>
                                  )}
                                </div>
                              ) : '—'}
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
          </>
        )}

        {/* Tab: Услуги */}
        {activeTab === 'services' && (
          <section className="bg-white border border-[var(--color-blush)] rounded-xl p-6">
            <ServicesTab studio={studio} apiFetch={apiFetch} onUnauth={handleUnauth} />
          </section>
        )}

        {/* Tab: Расписание */}
        {activeTab === 'schedule' && (
          <section className="bg-white border border-[var(--color-blush)] rounded-xl p-6">
            <ScheduleTab studio={studio} apiFetch={apiFetch} onUnauth={handleUnauth} />
          </section>
        )}
      </div>
    </main>
  )
}
