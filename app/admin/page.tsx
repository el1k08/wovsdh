'use client'

import React, { useState, useEffect, useCallback, useRef } from 'react'
import { Building2, Settings } from 'lucide-react'
import { Switch } from '@/components/ui/Switch'
import type {
  AdminSlotDTO,
  GenerateSlotsFromTemplateResponse,
  GetAdminSlotsResponse,
  ServiceDTO,
  Studio,
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

function generateTimeOptions(): string[] {
  const options: string[] = []
  for (let hour = 0; hour <= 24; hour++) {
    for (let minute = 0; minute < 60; minute += 15) {
      if (hour === 24 && minute > 0) break
      const timeStr = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`
      options.push(timeStr)
    }
  }
  return options
}

const TIME_OPTIONS = generateTimeOptions()

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

type AdminTab = 'bookings' | 'schedule' | 'services'

type SettingsSubTab = 'studios' | 'services'

interface InlineMessage {
  type: 'success' | 'error'
  text: string
}

// Day labels index 0=Sun..6=Sat
const DAY_LABELS = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб']

function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} мин`
  const hours = Math.floor(minutes / 60)
  const mins = minutes % 60
  if (mins === 0) return `${hours} ч`
  return `${hours} ч ${mins} мин`
}

const DURATION_OPTIONS: { value: number; label: string }[] = Array.from(
  { length: 300 / 15 },
  (_, i) => {
    const value = (i + 1) * 15
    return { value, label: formatDuration(value) }
  },
)

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
  studio: string
  apiFetch: (path: string, options?: RequestInit) => Promise<Response>
  onUnauth: () => void
}

function ServicesTab({ studio, apiFetch, onUnauth }: ServicesTabProps) {
  const [services, setServices] = useState<AdminServiceDTO[]>([])
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<InlineMessage | null>(null)
  const [showForm, setShowForm] = useState(false)

  // New service form state
  const [newIcon, setNewIcon] = useState('')
  const [newName, setNewName] = useState('')
  const [newDescription, setNewDescription] = useState('')
  const [newPrice, setNewPrice] = useState('')
  const [newDuration, setNewDuration] = useState(60)
  const [formLoading, setFormLoading] = useState(false)

  // Edit form state
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editIcon, setEditIcon] = useState('')
  const [editName, setEditName] = useState('')
  const [editDescription, setEditDescription] = useState('')
  const [editPrice, setEditPrice] = useState('')
  const [editDuration, setEditDuration] = useState(60)
  const [editLoading, setEditLoading] = useState(false)

  // Delete confirmation
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)

  // Drag-and-drop
  const dragItem = useRef<number | null>(null)
  const dragOverItem = useRef<number | null>(null)
  const [dragIndex, setDragIndex] = useState<number | null>(null)

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

  function startEdit(svc: AdminServiceDTO) {
    setEditingId(svc.id)
    setEditIcon(svc.icon ?? '')
    setEditName(svc.name)
    setEditDescription(svc.description ?? '')
    setEditPrice(String(svc.price))
    setEditDuration(svc.duration_minutes)
    setDeleteTarget(null)
    setShowForm(false)
  }

  async function handleEdit(e: React.FormEvent) {
    e.preventDefault()
    if (!editingId) return
    setEditLoading(true)
    setMessage(null)
    try {
      const res = await apiFetch(`/api/admin/services/${editingId}`, {
        method: 'PUT',
        body: JSON.stringify({
          icon: editIcon.trim() || null,
          name: editName.trim(),
          description: editDescription.trim() || null,
          price: Number(editPrice),
          duration_minutes: editDuration,
        }),
      })
      if (res.status === 401) { onUnauth(); return }
      if (!res.ok) {
        const body = await res.json() as { error?: { message?: string } }
        setMessage({ type: 'error', text: body.error?.message ?? 'Ошибка обновления услуги' })
        return
      }
      setMessage({ type: 'success', text: 'Услуга обновлена' })
      setEditingId(null)
      await loadServices()
    } catch {
      setMessage({ type: 'error', text: 'Сетевая ошибка при обновлении услуги' })
    } finally {
      setEditLoading(false)
    }
  }

  async function handleDelete(id: string) {
    setDeleting(true)
    setMessage(null)
    try {
      const res = await apiFetch(`/api/admin/services/${id}`, { method: 'DELETE' })
      if (res.status === 401) { onUnauth(); return }
      if (!res.ok) {
        const body = await res.json() as { error?: { message?: string } }
        setMessage({ type: 'error', text: body.error?.message ?? 'Ошибка удаления услуги' })
        setDeleteTarget(null)
        return
      }
      setMessage({ type: 'success', text: 'Услуга удалена' })
      setDeleteTarget(null)
      await loadServices()
    } catch {
      setMessage({ type: 'error', text: 'Сетевая ошибка при удалении услуги' })
    } finally {
      setDeleting(false)
    }
  }

  const handleDragStart = (index: number) => {
    dragItem.current = index
    setDragIndex(index)
  }

  const handleDragEnter = (index: number) => {
    dragOverItem.current = index
  }

  const handleDragEnd = async () => {
    if (
      dragItem.current === null ||
      dragOverItem.current === null ||
      dragItem.current === dragOverItem.current
    ) {
      dragItem.current = null
      dragOverItem.current = null
      setDragIndex(null)
      return
    }

    const reordered = [...services]
    const dragged = reordered.splice(dragItem.current, 1)[0]
    reordered.splice(dragOverItem.current, 0, dragged)

    dragItem.current = null
    dragOverItem.current = null
    setDragIndex(null)

    setServices(reordered)

    await apiFetch('/api/admin/services/reorder', {
      method: 'PUT',
      body: JSON.stringify({ ids: reordered.map((s) => s.id) }),
    })
  }

  const INPUT_CLS = 'border border-gray-300 rounded-lg px-3 py-2 text-sm text-[var(--color-charcoal)] focus:outline-none focus:border-[var(--color-rose)]'

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-[var(--color-charcoal)]">Услуги</h2>
        <button
          onClick={() => { setShowForm((v) => !v); setEditingId(null) }}
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
            <span className='flex'>Название <span className="text-red-500">*</span></span>
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
            <span className='flex'>Цена (₪) <span className="text-red-500">*</span></span>
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
              {DURATION_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
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

      {/* Edit form */}
      {editingId && (
        <form
          onSubmit={handleEdit}
          className="mb-6 border border-[var(--color-blush)] rounded-xl p-5 bg-white grid grid-cols-1 sm:grid-cols-2 gap-4"
        >
          <h3 className="sm:col-span-2 text-sm font-semibold text-[var(--color-charcoal)]">
            Редактировать услугу
          </h3>
          <label className="flex flex-col gap-1 text-sm text-gray-600">
            Иконка (emoji)
            <input
              type="text"
              value={editIcon}
              onChange={(e) => setEditIcon(e.target.value)}
              placeholder="💅"
              className={INPUT_CLS}
              disabled={editLoading}
            />
          </label>
          <label className="flex flex-col gap-1 text-sm text-gray-600">
            <span className='flex'>Название <span className="text-red-500">*</span></span>
            <input
              type="text"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              required
              className={INPUT_CLS}
              disabled={editLoading}
            />
          </label>
          <label className="flex flex-col gap-1 text-sm text-gray-600 sm:col-span-2">
            Описание
            <input
              type="text"
              value={editDescription}
              onChange={(e) => setEditDescription(e.target.value)}
              className={INPUT_CLS}
              disabled={editLoading}
            />
          </label>
          <label className="flex flex-col gap-1 text-sm text-gray-600">
            <span className='flex'>Цена (₪) <span className="text-red-500">*</span></span>
            <input
              type="number"
              min={0}
              value={editPrice}
              onChange={(e) => setEditPrice(e.target.value)}
              required
              className={INPUT_CLS}
              disabled={editLoading}
            />
          </label>
          <label className="flex flex-col gap-1 text-sm text-gray-600">
            Длительность
            <select
              value={editDuration}
              onChange={(e) => setEditDuration(Number(e.target.value))}
              className={INPUT_CLS}
              disabled={editLoading}
            >
              {DURATION_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </label>
          <div className="sm:col-span-2 flex gap-3">
            <button
              type="submit"
              disabled={editLoading}
              className="bg-[var(--color-rose)] text-white rounded-lg px-6 py-2 text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {editLoading ? 'Сохранение...' : 'Сохранить'}
            </button>
            <button
              type="button"
              onClick={() => setEditingId(null)}
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
                <th className="py-2 pr-2 w-6"></th>
                <th className="py-2 pr-4 font-medium">Иконка</th>
                <th className="py-2 pr-4 font-medium">Название</th>
                <th className="py-2 pr-4 font-medium">Длительность</th>
                <th className="py-2 pr-4 font-medium">Цена</th>
                <th className="py-2 pr-4 font-medium">Статус</th>
                <th className="py-2 font-medium text-right">Действия</th>
              </tr>
            </thead>
            <tbody>
              {services.map((svc, idx) => (
                <React.Fragment key={svc.id}>
                  <tr
                    draggable
                    onDragStart={() => handleDragStart(idx)}
                    onDragEnter={() => handleDragEnter(idx)}
                    onDragEnd={handleDragEnd}
                    onDragOver={(e) => e.preventDefault()}
                    className={`border-b border-gray-100 transition-opacity cursor-default ${
                      dragIndex === idx ? 'opacity-40' : 'hover:bg-gray-50'
                    }`}
                  >
                    <td className="py-3 pr-2 text-gray-300 cursor-grab active:cursor-grabbing select-none text-lg leading-none">
                      ⠿
                    </td>
                    <td className="py-3 pr-4 text-xl">{svc.icon ?? '—'}</td>
                    <td className="py-3 pr-4 text-[var(--color-charcoal)] font-medium">{svc.name}</td>
                    <td className="py-3 pr-4 text-[var(--color-charcoal)]">{formatDuration(svc.duration_minutes)}</td>
                    <td className="py-3 pr-4 text-[var(--color-charcoal)]">₪{svc.price}</td>
                    <td className="py-3 pr-4">
                      <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${
                        svc.is_active
                          ? 'bg-green-50 text-green-700 border border-green-200'
                          : 'bg-gray-100 text-gray-500 border border-gray-300'
                      }`}>
                        {svc.is_active ? 'Активна' : 'Неактивна'}
                      </span>
                    </td>
                    <td className="py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => startEdit(svc)}
                          className="px-3 py-1 rounded text-xs border border-gray-300 text-[var(--color-charcoal)] hover:bg-gray-50"
                        >
                          Изменить
                        </button>
                        <button
                          onClick={() => setDeleteTarget((prev) => prev === svc.id ? null : svc.id)}
                          className="px-3 py-1 rounded text-xs border border-red-200 text-red-600 bg-red-50 hover:bg-red-100"
                        >
                          Удалить
                        </button>
                      </div>
                    </td>
                  </tr>
                  {deleteTarget === svc.id && (
                    <tr className="bg-red-50">
                      <td colSpan={7} className="px-4 py-3">
                        <div className="flex items-center justify-between gap-4">
                          <p className="text-sm text-red-700">
                            Удалить услугу <strong>{svc.name}</strong>? Если к ней привязаны активные записи, она будет деактивирована.
                          </p>
                          <div className="flex gap-2 shrink-0">
                            <button
                              onClick={() => handleDelete(svc.id)}
                              disabled={deleting}
                              className="px-3 py-1 rounded text-xs bg-red-600 text-white hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              {deleting ? 'Удаление...' : 'Подтвердить'}
                            </button>
                            <button
                              onClick={() => setDeleteTarget(null)}
                              className="px-3 py-1 rounded text-xs border border-gray-300 text-gray-600 hover:bg-white"
                            >
                              Отмена
                            </button>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}

    </div>
  )
}

// ---------------------------------------------------------------------------
// Studio Services Assignment Tab
// ---------------------------------------------------------------------------

interface StudioServicesAssignmentTabProps {
  studio: string
  apiFetch: (path: string, options?: RequestInit) => Promise<Response>
  onUnauth: () => void
}

function StudioServicesAssignmentTab({ studio, apiFetch, onUnauth }: StudioServicesAssignmentTabProps) {
  const [services, setServices] = useState<AdminServiceDTO[]>([])
  const [assignedIds, setAssignedIds] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(false)
  const [savingId, setSavingId] = useState<string | null>(null)
  const [message, setMessage] = useState<InlineMessage | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setMessage(null)
    try {
      const [svcRes, assignRes] = await Promise.all([
        apiFetch('/api/admin/services'),
        apiFetch(`/api/admin/studio-services?studio_id=${studio}`),
      ])
      if (svcRes.status === 401 || assignRes.status === 401) { onUnauth(); return }
      if (!svcRes.ok) {
        setMessage({ type: 'error', text: 'Ошибка загрузки услуг' })
        return
      }
      const svcData = await svcRes.json() as { services: AdminServiceDTO[] }
      setServices(svcData.services ?? [])
      if (assignRes.ok) {
        const assignData = await assignRes.json() as { service_ids: string[] }
        setAssignedIds(new Set(assignData.service_ids))
      }
    } catch {
      setMessage({ type: 'error', text: 'Сетевая ошибка' })
    } finally {
      setLoading(false)
    }
  }, [studio, apiFetch, onUnauth])

  useEffect(() => { load() }, [load])

  async function toggleAssignment(serviceId: string) {
    const wasAssigned = assignedIds.has(serviceId)
    const nextIds = new Set(assignedIds)
    if (wasAssigned) nextIds.delete(serviceId)
    else nextIds.add(serviceId)
    setAssignedIds(nextIds)
    setMessage(null)

    setSavingId(serviceId)
    try {
      const res = await apiFetch('/api/admin/studio-services', {
        method: 'PUT',
        body: JSON.stringify({ studio_id: studio, service_ids: [...nextIds] }),
      })
      if (res.status === 401) { onUnauth(); return }
      if (!res.ok) {
        setAssignedIds(assignedIds)
        setMessage({ type: 'error', text: 'Ошибка сохранения' })
      }
    } catch {
      setAssignedIds(assignedIds)
      setMessage({ type: 'error', text: 'Сетевая ошибка при сохранении' })
    } finally {
      setSavingId(null)
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-semibold text-[var(--color-charcoal)]">Услуги студии</h2>
          <p className="text-xs text-gray-400 mt-0.5">
            Отметьте услуги, доступные в этой студии
          </p>
        </div>
        {message && (
          <p className={`text-sm ${message.type === 'success' ? 'text-green-600' : 'text-red-500'}`}>
            {message.text}
          </p>
        )}
      </div>

      {loading ? (
        <p className="text-sm text-gray-400 py-8 text-center">Загрузка...</p>
      ) : services.length === 0 ? (
        <p className="text-sm text-gray-400 py-8 text-center">Услуги не найдены</p>
      ) : (
        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3" role="list">
          {services.map((svc) => {
            const isAssigned = assignedIds.has(svc.id)
            const isSaving = savingId === svc.id
            return (
              <li
                key={svc.id}
                onClick={() => !isSaving && toggleAssignment(svc.id)}
                className={`group relative rounded-2xl border p-5 cursor-pointer transition-all duration-200 select-none ${
                  isAssigned
                    ? 'border-[var(--color-rose)] bg-white shadow-sm'
                    : 'border-[var(--color-blush)] bg-white hover:border-[var(--color-rose)] hover:shadow-sm'
                } ${isSaving ? 'opacity-60 cursor-wait' : ''}`}
              >
                {/* Checkbox */}
                <div className="absolute top-4 right-4">
                  <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                    isAssigned
                      ? 'bg-[var(--color-rose)] border-[var(--color-rose)]'
                      : 'border-gray-300 group-hover:border-[var(--color-rose)]'
                  }`}>
                    {isAssigned && (
                      <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </div>
                </div>

                {/* Icon */}
                {svc.icon && (
                  <div
                    className="mb-3 flex h-12 w-12 items-center justify-center rounded-full text-xl"
                    style={{ background: 'var(--color-blush)' }}
                  >
                    {svc.icon}
                  </div>
                )}

                {/* Name */}
                <h3
                  className="font-semibold text-[var(--color-charcoal)] mb-1 pr-7"
                  style={{ fontFamily: 'var(--font-cormorant), serif', fontSize: '1.2rem' }}
                >
                  {svc.name}
                </h3>

                {/* Description */}
                {svc.description && (
                  <p className="text-xs leading-relaxed text-[var(--color-charcoal)] opacity-60 mb-3 line-clamp-2">
                    {svc.description}
                  </p>
                )}

                {/* Price + duration */}
                <div className="flex items-center justify-between mt-auto">
                  <span className="text-sm font-semibold" style={{ color: 'var(--color-rose)' }}>
                    от {svc.price} ₪
                  </span>
                  <span className="text-xs text-gray-400">{formatDuration(svc.duration_minutes)}</span>
                </div>

                {/* Bottom accent line on assigned */}
                {isAssigned && (
                  <div
                    className="absolute bottom-0 left-5 right-5 h-0.5 rounded-full"
                    style={{ background: 'linear-gradient(to right, var(--color-rose), var(--color-gold))' }}
                  />
                )}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Schedule Tab
// ---------------------------------------------------------------------------

interface ScheduleTabProps {
  studio: string
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
              {/* Switch toggle */}
              <Switch
                checked={row.is_working}
                onChange={(checked) => updateRow(row.day_of_week, { is_working: checked })}
              />

              {/* Day label */}
              <span
                className="w-8 text-sm font-semibold text-center shrink-0"
                style={{ color: 'var(--color-charcoal)' }}
              >
                {DAY_LABELS[row.day_of_week]}
              </span>

              {/* Time selects */}
              <div className="flex items-center gap-2">
                <select
                  value={row.work_start}
                  onChange={(e) => updateRow(row.day_of_week, { work_start: e.target.value })}
                  disabled={!row.is_working}
                  className={INPUT_CLS}
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
                  onChange={(e) => updateRow(row.day_of_week, { work_end: e.target.value })}
                  disabled={!row.is_working}
                  className={INPUT_CLS}
                >
                  {TIME_OPTIONS.map((time) => (
                    <option key={time} value={time}>
                      {time}
                    </option>
                  ))}
                </select>
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
// Studios Tab
// ---------------------------------------------------------------------------

interface StudiosTabProps {
  apiFetch: (path: string, options?: RequestInit) => Promise<Response>
  onUnauth: () => void
  onStudiosChanged: () => void
  secret: string | null
}

function buildStudioDefaultSchedule(): ScheduleRow[] {
  return [
    { day_of_week: 0, is_working: true,  work_start: '09:00', work_end: '20:00' }, // Вс
    { day_of_week: 1, is_working: true,  work_start: '09:00', work_end: '20:00' }, // Пн
    { day_of_week: 2, is_working: true,  work_start: '09:00', work_end: '20:00' }, // Вт
    { day_of_week: 3, is_working: true,  work_start: '09:00', work_end: '20:00' }, // Ср
    { day_of_week: 4, is_working: true,  work_start: '09:00', work_end: '20:00' }, // Чт
    { day_of_week: 5, is_working: true,  work_start: '09:00', work_end: '14:00' }, // Пт
    { day_of_week: 6, is_working: false, work_start: '09:00', work_end: '20:00' }, // Сб
  ]
}

function ScheduleEditor({
  rows,
  onChange,
  disabled = false,
}: {
  rows: ScheduleRow[]
  onChange: (rows: ScheduleRow[]) => void
  disabled?: boolean
}) {
  const STUDIO_DAY_LABELS = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб']
  const updateRow = (index: number, patch: Partial<ScheduleRow>) => {
    const next = rows.map((r, i) => (i === index ? { ...r, ...patch } : r))
    onChange(next)
  }
  const SELECT_CLS = 'border border-gray-300 rounded-lg px-2 py-1 text-sm text-[var(--color-charcoal)] focus:outline-none focus:border-[var(--color-rose)] disabled:opacity-40'
  return (
    <div className="space-y-2">
      {rows.map((row, i) => (
        <div key={row.day_of_week} className="flex items-center gap-3">
          <Switch
            checked={row.is_working}
            disabled={disabled}
            onChange={checked => updateRow(i, { is_working: checked })}
          />
          <span className="w-6 text-sm text-[var(--color-charcoal)] font-medium">
            {STUDIO_DAY_LABELS[row.day_of_week]}
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
            <span className="text-xs text-gray-400">Выходной</span>
          )}
        </div>
      ))}
    </div>
  )
}

function StudiosTab({ apiFetch, onUnauth, onStudiosChanged, secret }: StudiosTabProps) {
  const [studiosList, setStudiosList] = useState<Studio[]>([])
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState<InlineMessage | null>(null)

  // Create form
  const [showCreate, setShowCreate] = useState(false)
  const [newId, setNewId] = useState('')
  const [newName, setNewName] = useState('')
  const [newStreet, setNewStreet] = useState('')
  const [newCity, setNewCity] = useState('')
  const [newTimezone, setNewTimezone] = useState('Asia/Jerusalem')
  const [newScheduleText, setNewScheduleText] = useState('')
  const [newSchedule, setNewSchedule] = useState<ScheduleRow[]>(buildStudioDefaultSchedule())
  const [formLoading, setFormLoading] = useState(false)

  // Edit form
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [editStreet, setEditStreet] = useState('')
  const [editCity, setEditCity] = useState('')
  const [editScheduleText, setEditScheduleText] = useState('')
  const [editLoading, setEditLoading] = useState(false)

  // Delete confirm
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)

  // Image upload/delete
  const [uploadingImage, setUploadingImage] = useState(false)
  const [imageError, setImageError] = useState<string | null>(null)

  // Drag-and-drop reorder
  const dragItem = useRef<number | null>(null)
  const dragOverItem = useRef<number | null>(null)
  const [dragIndex, setDragIndex] = useState<number | null>(null)

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    const res = await apiFetch('/api/admin/studios')
    if (res.status === 401) { onUnauth(); return }
    if (res.ok) {
      const data = await res.json() as { studios: Studio[] }
      setStudiosList(data.studios)
    }
    if (!silent) setLoading(false)
  }, [apiFetch, onUnauth])

  useEffect(() => { load() }, [load])

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    setFormLoading(true)
    setMessage(null)
    const res = await apiFetch('/api/admin/studios', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: newId.trim(),
        name: newName.trim(),
        street: newStreet.trim(),
        city: newCity.trim(),
        timezone: newTimezone.trim(),
        schedule_text: newScheduleText,
        schedule: newSchedule,
      }),
    })
    const data = await res.json() as { error?: { message?: string } }
    if (!res.ok) {
      setMessage({ type: 'error', text: data.error?.message ?? 'Ошибка создания студии' })
    } else {
      setMessage({ type: 'success', text: 'Студия создана' })
      setShowCreate(false)
      setNewId(''); setNewName(''); setNewStreet(''); setNewCity('')
      setNewTimezone('Asia/Jerusalem'); setNewScheduleText(''); setNewSchedule(buildStudioDefaultSchedule())
      await load(true)
      onStudiosChanged()
    }
    setFormLoading(false)
  }

  const startEdit = (s: Studio) => {
    setEditingId(s.id)
    setEditName(s.name)
    setEditStreet(s.street ?? '')
    setEditCity(s.city)
    setEditScheduleText(s.schedule_text ?? '')
    setDeleteTarget(null)
  }

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingId) return
    setEditLoading(true)
    setMessage(null)
    const res = await apiFetch(`/api/admin/studios/${editingId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: editName.trim(), street: (editStreet ?? '').trim(), city: editCity.trim(), schedule_text: (editScheduleText ?? '') }),
    })
    const data = await res.json() as { error?: { message?: string } }
    if (!res.ok) {
      setMessage({ type: 'error', text: data.error?.message ?? 'Ошибка обновления студии' })
    } else {
      setMessage({ type: 'success', text: 'Студия обновлена' })
      setEditingId(null)
      await load(true)
      onStudiosChanged()
    }
    setEditLoading(false)
  }

  const handleDelete = async (studioId: string) => {
    setDeleting(true)
    setMessage(null)
    const res = await apiFetch(`/api/admin/studios/${studioId}`, { method: 'DELETE' })
    const data = await res.json() as { error?: { message?: string } }
    if (!res.ok) {
      setMessage({ type: 'error', text: data.error?.message ?? 'Ошибка удаления студии' })
      setDeleteTarget(null)
    } else {
      setMessage({ type: 'success', text: 'Студия удалена' })
      setDeleteTarget(null)
      await load(true)
      onStudiosChanged()
    }
    setDeleting(false)
  }

  const handleImageUpload = async (studioId: string, file: File) => {
    setUploadingImage(true)
    setImageError(null)
    try {
      const form = new FormData()
      form.append('file', file)
      // Use raw fetch — apiFetch forces Content-Type: application/json which breaks multipart
      const res = await fetch(`/api/admin/studios/${studioId}/image`, {
        method: 'PUT',
        headers: { 'X-Admin-Secret': secret ?? '' },
        body: form,
      })
      const data = await res.json() as { image_url?: string; error?: { message?: string } }
      if (!res.ok) {
        setImageError(data.error?.message ?? 'Ошибка загрузки фото')
      } else {
        setImageError(null)
        await load(true)
        onStudiosChanged()
      }
    } catch {
      setImageError('Сетевая ошибка при загрузке фото')
    }
    setUploadingImage(false)
  }

  const handleImageDelete = async (studioId: string) => {
    setUploadingImage(true)
    setImageError(null)
    try {
      const res = await apiFetch(`/api/admin/studios/${studioId}/image`, { method: 'DELETE' })
      if (!res.ok) {
        const data = await res.json() as { error?: { message?: string } }
        setImageError(data.error?.message ?? 'Ошибка удаления фото')
      } else {
        setImageError(null)
        await load(true)
        onStudiosChanged()
      }
    } catch {
      setImageError('Сетевая ошибка при удалении фото')
    }
    setUploadingImage(false)
  }

  const handleDragStart = (index: number) => {
    dragItem.current = index
    setDragIndex(index)
  }

  const handleDragEnter = (index: number) => {
    dragOverItem.current = index
  }

  const handleDragEnd = async () => {
    if (dragItem.current === null || dragOverItem.current === null) {
      dragItem.current = null
      dragOverItem.current = null
      setDragIndex(null)
      return
    }
    if (dragItem.current === dragOverItem.current) {
      dragItem.current = null
      dragOverItem.current = null
      setDragIndex(null)
      return
    }

    // Reorder the local list immediately for instant feedback
    const reordered = [...studiosList]
    const dragged = reordered.splice(dragItem.current, 1)[0]
    reordered.splice(dragOverItem.current, 0, dragged)

    dragItem.current = null
    dragOverItem.current = null
    setDragIndex(null)

    // Optimistically update local state
    setStudiosList(reordered)

    // Persist to server — no need to notify parent, reorder doesn't change the studio list
    await apiFetch('/api/admin/studios/reorder', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids: reordered.map(s => s.id) }),
    })
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold text-[var(--color-charcoal)]">Студии</h2>
        <button
          onClick={() => { setShowCreate(v => !v); setEditingId(null); setDeleteTarget(null) }}
          className="px-4 py-2 rounded-lg text-sm font-medium bg-[var(--color-rose)] text-white hover:opacity-90 transition-opacity"
        >
          {showCreate ? 'Отмена' : '+ Добавить студию'}
        </button>
      </div>

      {message && (
        <div className={`mb-4 text-sm ${message.type === 'error' ? 'text-red-500' : 'text-green-600'}`}>
          {message.text}
        </div>
      )}

      {/* Create form */}
      {showCreate && (
        <form onSubmit={handleCreate} className="mb-6 p-4 border border-[var(--color-blush)] rounded-xl space-y-4">
          <h3 className="text-sm font-semibold text-[var(--color-charcoal)]">Новая студия</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-500 mb-1">ID (slug) *</label>
              <input
                value={newId} onChange={e => setNewId(e.target.value)}
                placeholder="tel-aviv"
                required
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-[var(--color-charcoal)] focus:outline-none focus:border-[var(--color-rose)]"
              />
              <p className="mt-1 text-xs text-gray-400">Строчные буквы, цифры и дефисы</p>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Название *</label>
              <input
                value={newName} onChange={e => setNewName(e.target.value)}
                placeholder="Студия маникюра Тель-Авив"
                required
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-[var(--color-charcoal)] focus:outline-none focus:border-[var(--color-rose)]"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Улица</label>
              <input
                value={newStreet} onChange={e => setNewStreet(e.target.value)}
                placeholder="ул. Дизенгоф, 99"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-[var(--color-charcoal)] focus:outline-none focus:border-[var(--color-rose)]"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Город *</label>
              <input
                value={newCity} onChange={e => setNewCity(e.target.value)}
                placeholder="Тель-Авив"
                required
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-[var(--color-charcoal)] focus:outline-none focus:border-[var(--color-rose)]"
              />
            </div>
          </div>
          <div className="sm:col-span-2">
            <label className="block text-xs text-gray-500 mb-1">Расписание (текст для сайта)</label>
            <textarea
              value={newScheduleText}
              onChange={e => setNewScheduleText(e.target.value)}
              placeholder={"Воскресенье — четверг: 9:00–20:00\nПятница: 9:00–15:00\nСуббота: выходной"}
              rows={3}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-[var(--color-charcoal)] focus:outline-none focus:border-[var(--color-rose)] resize-none"
            />
            <p className="mt-1 text-xs text-gray-400">Отображается на главной странице сайта. Каждая строка — отдельная строчка расписания.</p>
          </div>
          <div className="sm:col-span-2">
            <label className="block text-xs text-gray-500 mb-2">Расписание работы</label>
            <ScheduleEditor rows={newSchedule} onChange={setNewSchedule} disabled={formLoading} />
          </div>
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={formLoading}
              className="px-4 py-2 rounded-lg text-sm font-medium bg-[var(--color-rose)] text-white hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {formLoading ? 'Сохранение...' : 'Создать студию'}
            </button>
            <button
              type="button"
              onClick={() => setShowCreate(false)}
              className="px-4 py-2 rounded-lg text-sm font-medium border border-gray-300 text-[var(--color-charcoal)] hover:bg-gray-50"
            >
              Отмена
            </button>
          </div>
          <p className="text-xs text-gray-400">Фото можно добавить после создания студии.</p>
        </form>
      )}

      {/* Edit form */}
      {editingId && (
        <form onSubmit={handleEdit} className="mb-6 p-4 border border-[var(--color-blush)] rounded-xl space-y-4">
          <h3 className="text-sm font-semibold text-[var(--color-charcoal)]">Редактировать студию</h3>

          {/* Photo section */}
          <div className="sm:col-span-2">
            <label className="block text-xs text-gray-500 mb-2">Фото студии</label>
            {imageError && (
              <p className="text-xs text-red-500 mb-2">{imageError}</p>
            )}
            {(() => {
              const currentStudio = studiosList.find(s => s.id === editingId)
              const hasImage = !!currentStudio?.image_url
              return hasImage ? (
                <div className="flex items-center gap-3">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={currentStudio!.image_url!}
                    alt="Фото студии"
                    className="w-24 h-16 object-cover rounded-lg border border-[var(--color-blush)]"
                  />
                  <button
                    type="button"
                    onClick={() => handleImageDelete(editingId!)}
                    disabled={uploadingImage}
                    className="px-3 py-1.5 rounded text-xs border border-red-200 text-red-600 bg-red-50 hover:bg-red-100 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {uploadingImage ? 'Удаление...' : 'Удалить фото'}
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-3">
                  <label className={`cursor-pointer flex items-center gap-2 px-3 py-1.5 rounded text-xs border border-gray-300 text-[var(--color-charcoal)] hover:bg-gray-50 ${uploadingImage ? 'opacity-50 pointer-events-none' : ''}`}>
                    {uploadingImage ? 'Загрузка...' : '+ Загрузить фото'}
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      className="hidden"
                      disabled={uploadingImage}
                      onChange={e => {
                        const file = e.target.files?.[0]
                        if (file && editingId) handleImageUpload(editingId, file)
                        e.target.value = ''
                      }}
                    />
                  </label>
                  <span className="text-xs text-gray-400">PNG, JPG, WebP · до 2 МБ</span>
                </div>
              )
            })()}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Название *</label>
              <input
                value={editName} onChange={e => setEditName(e.target.value)}
                required
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-[var(--color-charcoal)] focus:outline-none focus:border-[var(--color-rose)]"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Улица</label>
              <input
                value={editStreet} onChange={e => setEditStreet(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-[var(--color-charcoal)] focus:outline-none focus:border-[var(--color-rose)]"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Город *</label>
              <input
                value={editCity} onChange={e => setEditCity(e.target.value)}
                required
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-[var(--color-charcoal)] focus:outline-none focus:border-[var(--color-rose)]"
              />
            </div>
          </div>
          <div className="sm:col-span-2">
            <label className="block text-xs text-gray-500 mb-1">Расписание (текст для сайта)</label>
            <textarea
              value={editScheduleText}
              onChange={e => setEditScheduleText(e.target.value)}
              rows={3}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-[var(--color-charcoal)] focus:outline-none focus:border-[var(--color-rose)] resize-none"
            />
            <p className="mt-1 text-xs text-gray-400">Отображается на главной странице сайта. Каждая строка — отдельная строчка расписания.</p>
          </div>
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={editLoading}
              className="px-4 py-2 rounded-lg text-sm font-medium bg-[var(--color-rose)] text-white hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {editLoading ? 'Сохранение...' : 'Сохранить'}
            </button>
            <button
              type="button"
              onClick={() => setEditingId(null)}
              className="px-4 py-2 rounded-lg text-sm font-medium border border-gray-300 text-[var(--color-charcoal)] hover:bg-gray-50"
            >
              Отмена
            </button>
          </div>
        </form>
      )}

      {/* Studios list */}
      {loading ? (
        <p className="text-sm text-gray-400">Загрузка студий...</p>
      ) : studiosList.length === 0 ? (
        <p className="text-sm text-gray-400">Студии не найдены.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--color-blush)]">
                <th className="py-2 pr-2 w-6"></th>
                <th className="text-left py-2 pr-4 text-xs font-medium text-gray-500">Название</th>
                <th className="text-left py-2 pr-4 text-xs font-medium text-gray-500">Улица</th>
                <th className="text-left py-2 pr-4 text-xs font-medium text-gray-500">Город</th>
                <th className="text-left py-2 pr-4 text-xs font-medium text-gray-500">ID</th>
                <th className="text-right py-2 text-xs font-medium text-gray-500">Действия</th>
              </tr>
            </thead>
            <tbody>
              {studiosList.map((s, idx) => (
                <React.Fragment key={s.id}>
                  <tr
                    draggable
                    onDragStart={() => handleDragStart(idx)}
                    onDragEnter={() => handleDragEnter(idx)}
                    onDragEnd={handleDragEnd}
                    onDragOver={e => e.preventDefault()}
                    className={`border-b border-gray-100 transition-opacity cursor-default ${
                      dragIndex === idx ? 'opacity-40' : 'hover:bg-gray-50'
                    }`}
                  >
                    <td className="py-3 pr-2 text-gray-300 cursor-grab active:cursor-grabbing select-none text-lg leading-none">
                      ⠿
                    </td>
                    <td className="py-3 pr-4 text-[var(--color-charcoal)] font-medium">{s.name}</td>
                    <td className="py-3 pr-4 text-gray-600">{s.street || '—'}</td>
                    <td className="py-3 pr-4 text-gray-600">{s.city}</td>
                    <td className="py-3 pr-4 text-gray-400 font-mono text-xs">{s.id}</td>
                    <td className="py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => startEdit(s)}
                          className="px-3 py-1 rounded text-xs border border-gray-300 text-[var(--color-charcoal)] hover:bg-gray-50"
                        >
                          Изменить
                        </button>
                        <button
                          onClick={() => setDeleteTarget(prev => prev === s.id ? null : s.id)}
                          className="px-3 py-1 rounded text-xs border border-red-200 text-red-600 bg-red-50 hover:bg-red-100"
                        >
                          Удалить
                        </button>
                      </div>
                    </td>
                  </tr>
                  {deleteTarget === s.id && (
                    <tr className="bg-red-50">
                      <td colSpan={6} className="px-4 py-3">
                        <div className="flex items-center justify-between gap-4">
                          <p className="text-sm text-red-700">
                            Удалить студию <strong>{s.name}</strong>? Будут удалены все связанные данные: расписание, слоты, услуги и отменённые записи. Активные записи блокируют удаление.
                          </p>
                          <div className="flex gap-2 shrink-0">
                            <button
                              onClick={() => handleDelete(s.id)}
                              disabled={deleting}
                              className="px-3 py-1 rounded text-xs bg-red-600 text-white hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              {deleting ? 'Удаление...' : 'Подтвердить'}
                            </button>
                            <button
                              onClick={() => setDeleteTarget(null)}
                              className="px-3 py-1 rounded text-xs border border-gray-300 text-gray-600 hover:bg-white"
                            >
                              Отмена
                            </button>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main Admin Page
// ---------------------------------------------------------------------------

export default function AdminPage() {
  const [secret, setSecret] = useState<string | null>(null)
  const [studio, setStudio] = useState<string>('rishon')
  const [studios, setStudios] = useState<Studio[]>([])
  const [activeTab, setActiveTab] = useState<AdminTab>('bookings')
  const [settingsSubTab, setSettingsSubTab] = useState<SettingsSubTab>('studios')
  const [topSection, setTopSection] = useState<'studios' | 'settings'>('studios')

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
  // Load studios
  // ---------------------------------------------------------------------------

  const loadStudios = useCallback(async () => {
    const res = await apiFetch('/api/admin/studios')
    if (!res.ok) return
    const data = await res.json() as { studios: Studio[] }
    setStudios(data.studios)
    setStudio(prev => {
      if (data.studios.length === 0) return ''
      return data.studios.find(s => s.id === prev) ? prev : data.studios[0].id
    })
  }, [apiFetch])

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
      loadStudios()
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
    { key: 'schedule', label: 'Расписание' },
    { key: 'services', label: 'Услуги' },
  ]

  return (
    <main className="min-h-screen bg-[var(--color-cream)] p-4 md:p-8">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
          <h1 className="text-2xl font-semibold text-[var(--color-charcoal)]">
            Управление — WOVSDH Nails
          </h1>
          <div className="flex items-center gap-4 self-start sm:self-auto">
            <button
              onClick={() => {
                localStorage.removeItem('admin_secret')
                setSecret(null)
              }}
              className="text-sm text-gray-500 underline"
            >
              Выйти
            </button>
          </div>
        </div>

        {/* Top-level navigation: Студии | Настройки */}
        <div className="flex gap-1 mb-8 p-1 bg-white border border-gray-200 rounded-xl w-fit">
          <button
            onClick={() => setTopSection('studios')}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium transition-colors ${
              topSection === 'studios'
                ? 'bg-[var(--color-rose)] text-white shadow-sm'
                : 'text-[var(--color-charcoal)] hover:bg-gray-50'
            }`}
          >
            <Building2 size={16} />
            Студии
          </button>
          <button
            onClick={() => setTopSection('settings')}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium transition-colors ${
              topSection === 'settings'
                ? 'bg-[var(--color-rose)] text-white shadow-sm'
                : 'text-[var(--color-charcoal)] hover:bg-gray-50'
            }`}
          >
            <Settings size={16} />
            Настройки
          </button>
        </div>

        {/* Settings panel */}
        {topSection === 'settings' && (
          <div>
            {/* Settings sub-tab navigation */}
            <div className="flex gap-2 mb-6 border-b border-gray-100 pb-1">
              {([
                { key: 'studios', label: 'Студии' },
                { key: 'services', label: 'Услуги' },
              ] as { key: SettingsSubTab; label: string }[]).map((sub) => (
                <button
                  key={sub.key}
                  onClick={() => setSettingsSubTab(sub.key)}
                  className={`px-4 py-2 rounded-t-lg text-sm font-medium transition-colors border-b-2 -mb-px ${
                    settingsSubTab === sub.key
                      ? 'border-[var(--color-rose)] text-[var(--color-rose)]'
                      : 'border-transparent text-gray-500 hover:text-[var(--color-charcoal)]'
                  }`}
                >
                  {sub.label}
                </button>
              ))}
            </div>

            {/* Settings sub-tab: Студии */}
            {settingsSubTab === 'studios' && (
              <section className="bg-white border border-[var(--color-blush)] rounded-xl p-6">
                <StudiosTab apiFetch={apiFetch} onUnauth={handleUnauth} onStudiosChanged={loadStudios} secret={secret} />
              </section>
            )}

            {/* Settings sub-tab: Услуги */}
            {settingsSubTab === 'services' && (
              <section className="bg-white border border-[var(--color-blush)] rounded-xl p-6">
                <ServicesTab studio={studio} apiFetch={apiFetch} onUnauth={handleUnauth} />
              </section>
            )}
          </div>
        )}

        {/* Studio switcher + tabs */}
        {topSection === 'studios' && (
          <>
            <div className="flex gap-2 mb-6">
              {studios.map((s) => (
                <button
                  key={s.id}
                  onClick={() => setStudio(s.id)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${
                    studio === s.id
                      ? 'bg-[var(--color-rose)] text-white border-[var(--color-rose)]'
                      : 'bg-white text-[var(--color-charcoal)] border-gray-300 hover:border-[var(--color-rose)]'
                  }`}
                >
                  {s.name}
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

            {/* Tab: Расписание */}
            {activeTab === 'schedule' && (
              <section className="bg-white border border-[var(--color-blush)] rounded-xl p-6">
                <ScheduleTab studio={studio} apiFetch={apiFetch} onUnauth={handleUnauth} />
              </section>
            )}

            {/* Tab: Услуги */}
            {activeTab === 'services' && (
              <section className="bg-white border border-[var(--color-blush)] rounded-xl p-6">
                <StudioServicesAssignmentTab studio={studio} apiFetch={apiFetch} onUnauth={handleUnauth} />
              </section>
            )}
          </>
        )}
      </div>
    </main>
  )
}
