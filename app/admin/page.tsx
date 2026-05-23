'use client'

import React, { useState, useEffect, useCallback, useRef } from 'react'
import { useTranslations } from 'next-intl'
import { Building2, Settings, Users, Pencil, CalendarDays } from 'lucide-react'
import { Switch } from '@/components/ui/Switch'
import type {
  AdminSlotDTO,
  AdminBookingDTO,
  GenerateSlotsFromTemplateResponse,
  GetAdminSlotsResponse,
  GetAdminBookingsResponse,
  ServiceDTO,
  Studio,
  StudioScheduleTemplate,
  GetMasterScheduleResponse,
  Locale,
  ServiceTranslations,
  ServiceTranslation,
  StudioTranslations,
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
  return new Date(isoStr).toLocaleTimeString('uk-UA', {
    timeZone: 'Asia/Jerusalem',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function formatLocalDate(isoStr: string): string {
  return new Date(isoStr).toLocaleDateString('uk-UA', {
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

// ---------------------------------------------------------------------------
// LangTabs component
// ---------------------------------------------------------------------------

const LOCALES: Locale[] = ['uk', 'en', 'he']

function LangTabs({ value, onChange }: { value: Locale; onChange: (l: Locale) => void }) {
  return (
    <div className="flex gap-1 mb-3">
      {LOCALES.map((lang) => (
        <button
          key={lang}
          type="button"
          onClick={() => onChange(lang)}
          className={`px-3 py-1 text-xs rounded-md font-medium transition-colors ${
            value === lang
              ? 'bg-[var(--color-rose)] text-white'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          {lang.toUpperCase()}
        </button>
      ))}
    </div>
  )
}

function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} хв`
  const hours = Math.floor(minutes / 60)
  const mins = minutes % 60
  if (mins === 0) return `${hours} год`
  return `${hours} год ${mins} хв`
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
  const t = useTranslations('admin.login')
  const [input, setInput] = useState('')
  const [error, setError] = useState('')

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!input.trim()) {
      setError(t('error_empty'))
      return
    }
    localStorage.setItem('admin_secret', input.trim())
    onAuth(input.trim())
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-[var(--color-cream)]">
      <div className="bg-white border border-[var(--color-blush)] rounded-xl p-8 w-full max-w-sm shadow-sm">
        <h1 className="text-xl font-semibold text-[var(--color-charcoal)] mb-6 text-center">
          {t('heading')}
        </h1>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <input
            type="password"
            placeholder={t('password_placeholder')}
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
            {t('submit')}
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

// ---------------------------------------------------------------------------
// Booking status badge
// ---------------------------------------------------------------------------

function BookingStatusBadge({ status }: { status: string }) {
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

// ---------------------------------------------------------------------------
// Services Tab
// ---------------------------------------------------------------------------

interface ServicesTabProps {
  studio: string
  apiFetch: (path: string, options?: RequestInit) => Promise<Response>
  onUnauth: () => void
}

function ServicesTab({ studio, apiFetch, onUnauth }: ServicesTabProps) {
  const t = useTranslations('admin.services_panel')
  const tCommon = useTranslations('common')

  const [services, setServices] = useState<AdminServiceDTO[]>([])
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<InlineMessage | null>(null)
  const [showForm, setShowForm] = useState(false)

  // Translation helpers
  const emptyServiceTranslations = (): ServiceTranslations => ({
    uk: { name: '', description: '' },
    en: { name: '', description: '' },
    he: { name: '', description: '' },
  })

  // New service form state
  const [newIcon, setNewIcon] = useState('')
  const [newPrice, setNewPrice] = useState('')
  const [newDuration, setNewDuration] = useState(60)
  const [formLoading, setFormLoading] = useState(false)
  const [formLang, setFormLang] = useState<Locale>('uk')
  const [newTranslations, setNewTranslations] = useState<ServiceTranslations>(emptyServiceTranslations())

  // Edit form state
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editIcon, setEditIcon] = useState('')
  const [editPrice, setEditPrice] = useState('')
  const [editDuration, setEditDuration] = useState(60)
  const [editLoading, setEditLoading] = useState(false)
  const [editLang, setEditLang] = useState<Locale>('uk')
  const [editTranslations, setEditTranslations] = useState<ServiceTranslations>(emptyServiceTranslations())

  // Delete confirmation
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)

  function updateNewTr(field: keyof ServiceTranslation, value: string) {
    setNewTranslations(prev => ({ ...prev, [formLang]: { ...prev[formLang], [field]: value } }))
  }
  function updateEditTr(field: keyof ServiceTranslation, value: string) {
    setEditTranslations(prev => ({ ...prev, [editLang]: { ...prev[editLang], [field]: value } }))
  }

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
        setMessage({ type: 'error', text: body.error?.message ?? t('error_load') })
        return
      }
      const data = await res.json() as { services: AdminServiceDTO[] }
      setServices(data.services ?? [])
    } catch {
      setMessage({ type: 'error', text: t('error_network_load') })
    } finally {
      setLoading(false)
    }
  }, [studio, apiFetch, onUnauth, t])

  useEffect(() => {
    loadServices()
  }, [loadServices])

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    const ukName = newTranslations.uk.name.trim() || newTranslations.en.name.trim() || newTranslations.he.name.trim()
    if (!ukName || !newPrice) return
    setFormLoading(true)
    setMessage(null)
    try {
      const res = await apiFetch('/api/admin/services', {
        method: 'POST',
        body: JSON.stringify({
          studio_id: studio,
          icon: newIcon.trim() || undefined,
          name: ukName,
          description: newTranslations.uk.description.trim() || undefined,
          price: Number(newPrice),
          duration_minutes: newDuration,
          translations: {
            uk: { name: newTranslations.uk.name.trim(), description: newTranslations.uk.description.trim() },
            en: { name: newTranslations.en.name.trim(), description: newTranslations.en.description.trim() },
            he: { name: newTranslations.he.name.trim(), description: newTranslations.he.description.trim() },
          },
        }),
      })
      if (res.status === 401) { onUnauth(); return }
      if (!res.ok) {
        const body = await res.json() as { error?: { message?: string } }
        setMessage({ type: 'error', text: body.error?.message ?? t('error_create') })
        return
      }
      setMessage({ type: 'success', text: t('success_create') })
      setShowForm(false)
      setNewIcon(''); setNewPrice(''); setNewDuration(60)
      setNewTranslations(emptyServiceTranslations()); setFormLang('uk')
      await loadServices()
    } catch {
      setMessage({ type: 'error', text: t('error_network_create') })
    } finally {
      setFormLoading(false)
    }
  }

  function startEdit(svc: AdminServiceDTO) {
    setEditingId(svc.id)
    setEditIcon(svc.icon ?? '')
    setEditPrice(String(svc.price))
    setEditDuration(svc.duration_minutes)
    setDeleteTarget(null)
    setShowForm(false)
    setEditLang('uk')
    setEditTranslations({
      uk: { name: svc.translations?.uk?.name ?? svc.name, description: svc.translations?.uk?.description ?? svc.description ?? '' },
      en: { name: svc.translations?.en?.name ?? svc.name, description: svc.translations?.en?.description ?? svc.description ?? '' },
      he: { name: svc.translations?.he?.name ?? svc.name, description: svc.translations?.he?.description ?? svc.description ?? '' },
    })
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
          name: editTranslations.uk.name.trim(),
          description: editTranslations.uk.description.trim() || null,
          price: Number(editPrice),
          duration_minutes: editDuration,
          translations: editTranslations,
        }),
      })
      if (res.status === 401) { onUnauth(); return }
      if (!res.ok) {
        const body = await res.json() as { error?: { message?: string } }
        setMessage({ type: 'error', text: body.error?.message ?? t('error_update') })
        return
      }
      setMessage({ type: 'success', text: t('success_update') })
      setEditingId(null)
      await loadServices()
    } catch {
      setMessage({ type: 'error', text: t('error_network_update') })
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
        setMessage({ type: 'error', text: body.error?.message ?? t('error_delete') })
        setDeleteTarget(null)
        return
      }
      setMessage({ type: 'success', text: t('success_delete') })
      setDeleteTarget(null)
      await loadServices()
    } catch {
      setMessage({ type: 'error', text: t('error_network_delete') })
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
        <h2 className="text-lg font-semibold text-[var(--color-charcoal)]">{t('add_heading')}</h2>
        <button
          onClick={() => { setShowForm((v) => !v); setEditingId(null) }}
          className="bg-[var(--color-rose)] text-white rounded-lg px-4 py-2 text-sm font-medium hover:opacity-90 transition-opacity"
        >
          {showForm ? t('hide_form_btn') : t('add_btn')}
        </button>
      </div>

      {/* Create form */}
      {showForm && (
        <form
          onSubmit={handleCreate}
          className="mb-6 border border-[var(--color-blush)] rounded-xl p-5 bg-white grid grid-cols-1 sm:grid-cols-2 gap-4"
        >
          <div className="sm:col-span-2">
            <LangTabs value={formLang} onChange={setFormLang} />
          </div>
          <label className="flex flex-col gap-1 text-sm text-gray-600">
            {t('icon_label')} (emoji)
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
            <span className="flex">{t('name_label')} <span className="text-red-500">*</span></span>
            <input
              key={formLang}
              type="text"
              value={newTranslations[formLang].name}
              onChange={(e) => updateNewTr('name', e.target.value)}
              className={INPUT_CLS}
              disabled={formLoading}
            />
          </label>
          <label className="flex flex-col gap-1 text-sm text-gray-600 sm:col-span-2">
            {t('description_label')}
            <input
              key={formLang}
              type="text"
              value={newTranslations[formLang].description}
              onChange={(e) => updateNewTr('description', e.target.value)}
              className={INPUT_CLS}
              disabled={formLoading}
            />
          </label>
          <label className="flex flex-col gap-1 text-sm text-gray-600">
            <span className="flex">{t('price_label')} <span className="text-red-500">*</span></span>
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
            {t('duration_label')}
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
              {formLoading ? tCommon('saving') : tCommon('save')}
            </button>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="border border-gray-300 text-gray-600 rounded-lg px-4 py-2 text-sm font-medium hover:bg-gray-50 transition-colors"
            >
              {tCommon('cancel')}
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
            {t('edit_heading')}
          </h3>
          <div className="sm:col-span-2">
            <LangTabs value={editLang} onChange={setEditLang} />
          </div>
          <label className="flex flex-col gap-1 text-sm text-gray-600">
            {t('icon_label')} (emoji)
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
            <span className="flex">{t('name_label')} <span className="text-red-500">*</span></span>
            <input
              key={editLang}
              type="text"
              value={editTranslations[editLang].name}
              onChange={(e) => updateEditTr('name', e.target.value)}
              required={editLang === 'uk'}
              className={INPUT_CLS}
              disabled={editLoading}
            />
          </label>
          <label className="flex flex-col gap-1 text-sm text-gray-600 sm:col-span-2">
            {t('description_label')}
            <input
              key={editLang}
              type="text"
              value={editTranslations[editLang].description}
              onChange={(e) => updateEditTr('description', e.target.value)}
              className={INPUT_CLS}
              disabled={editLoading}
            />
          </label>
          <label className="flex flex-col gap-1 text-sm text-gray-600">
            <span className="flex">{t('price_label')} <span className="text-red-500">*</span></span>
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
            {t('duration_label')}
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
              {editLoading ? tCommon('saving') : tCommon('save')}
            </button>
            <button
              type="button"
              onClick={() => setEditingId(null)}
              className="border border-gray-300 text-gray-600 rounded-lg px-4 py-2 text-sm font-medium hover:bg-gray-50 transition-colors"
            >
              {tCommon('cancel')}
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
        <p className="text-sm text-gray-400 py-4">{tCommon('loading')}</p>
      ) : services.length === 0 ? (
        <p className="text-sm text-gray-400 py-4">{t('error_load')}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b border-gray-200 text-left text-gray-500">
                <th className="py-2 pr-2 w-6"></th>
                <th className="py-2 pr-4 font-medium">{t('icon_label')}</th>
                <th className="py-2 pr-4 font-medium">{t('name_label')}</th>
                <th className="py-2 pr-4 font-medium">{t('duration_label')}</th>
                <th className="py-2 pr-4 font-medium">{t('price_label')}</th>
                <th className="py-2 pr-4 font-medium">{t('active_label')}</th>
                <th className="py-2 font-medium text-right">{tCommon('edit')}</th>
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
                        {svc.is_active ? t('active_label') : t('inactive_label')}
                      </span>
                    </td>
                    <td className="py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => startEdit(svc)}
                          className="px-3 py-1 rounded text-xs border border-gray-300 text-[var(--color-charcoal)] hover:bg-gray-50"
                        >
                          {tCommon('edit')}
                        </button>
                        <button
                          onClick={() => setDeleteTarget((prev) => prev === svc.id ? null : svc.id)}
                          className="px-3 py-1 rounded text-xs border border-red-200 text-red-600 bg-red-50 hover:bg-red-100"
                        >
                          {tCommon('delete')}
                        </button>
                      </div>
                    </td>
                  </tr>
                  {deleteTarget === svc.id && (
                    <tr className="bg-red-50">
                      <td colSpan={7} className="px-4 py-3">
                        <div className="flex items-center justify-between gap-4">
                          <p className="text-sm text-red-700">
                            {t('delete_confirm', { name: svc.name })}
                          </p>
                          <div className="flex gap-2 shrink-0">
                            <button
                              onClick={() => handleDelete(svc.id)}
                              disabled={deleting}
                              className="px-3 py-1 rounded text-xs bg-red-600 text-white hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              {deleting ? tCommon('deleting') : tCommon('confirm')}
                            </button>
                            <button
                              onClick={() => setDeleteTarget(null)}
                              className="px-3 py-1 rounded text-xs border border-gray-300 text-gray-600 hover:bg-white"
                            >
                              {tCommon('cancel')}
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
  const t = useTranslations('admin.services_panel')
  const tCommon = useTranslations('common')
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
        setMessage({ type: 'error', text: t('error_load') })
        return
      }
      const svcData = await svcRes.json() as { services: AdminServiceDTO[] }
      setServices(svcData.services ?? [])
      if (assignRes.ok) {
        const assignData = await assignRes.json() as { service_ids: string[] }
        setAssignedIds(new Set(assignData.service_ids))
      }
    } catch {
      setMessage({ type: 'error', text: tCommon('network_error') })
    } finally {
      setLoading(false)
    }
  }, [studio, apiFetch, onUnauth, t, tCommon])

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
        setMessage({ type: 'error', text: t('error_update') })
      }
    } catch {
      setAssignedIds(assignedIds)
      setMessage({ type: 'error', text: tCommon('network_error') })
    } finally {
      setSavingId(null)
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-semibold text-[var(--color-charcoal)]">{t('assignment_heading')}</h2>
          <p className="text-xs text-gray-400 mt-0.5">
            {t('assignment_subtitle')}
          </p>
        </div>
        {message && (
          <p className={`text-sm ${message.type === 'success' ? 'text-green-600' : 'text-red-500'}`}>
            {message.text}
          </p>
        )}
      </div>

      {loading ? (
        <p className="text-sm text-gray-400 py-8 text-center">{tCommon('loading')}</p>
      ) : services.length === 0 ? (
        <p className="text-sm text-gray-400 py-8 text-center">{t('error_load')}</p>
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
                    {t('price_from', { price: svc.price })}
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
  const t = useTranslations('admin.schedule_panel')
  const tCommon = useTranslations('common')
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
              const dayLabels = t.raw('day_labels') as string[]
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
  const tAdmin = useTranslations('admin')
  const updateRow = (index: number, patch: Partial<ScheduleRow>) => {
    const next = rows.map((r, i) => (i === index ? { ...r, ...patch } : r))
    onChange(next)
  }
  const SELECT_CLS = 'border border-gray-300 rounded-lg px-2 py-1 text-sm text-[var(--color-charcoal)] focus:outline-none focus:border-[var(--color-rose)] disabled:opacity-40'
  const dayLabels = tAdmin.raw('day_labels') as string[]
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

function StudiosTab({ apiFetch, onUnauth, onStudiosChanged, secret }: StudiosTabProps) {
  const t = useTranslations('admin.studios_panel')
  const tCommon = useTranslations('common')

  const [studiosList, setStudiosList] = useState<Studio[]>([])
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState<InlineMessage | null>(null)

  // Translation helpers
  const emptyStudioTranslations = (): StudioTranslations => ({
    uk: { name: '', schedule_text: '' },
    en: { name: '', schedule_text: '' },
    he: { name: '', schedule_text: '' },
  })

  // Create form
  const [showCreate, setShowCreate] = useState(false)
  const [newId, setNewId] = useState('')
  const [newStreet, setNewStreet] = useState('')
  const [newCity, setNewCity] = useState('')
  const [newTimezone, setNewTimezone] = useState('Asia/Jerusalem')
  const [newSchedule, setNewSchedule] = useState<ScheduleRow[]>(buildStudioDefaultSchedule())
  const [formLoading, setFormLoading] = useState(false)
  const [createLang, setCreateLang] = useState<Locale>('uk')
  const [createTranslations, setCreateTranslations] = useState<StudioTranslations>(emptyStudioTranslations())

  // Edit form
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editStreet, setEditStreet] = useState('')
  const [editCity, setEditCity] = useState('')
  const [editLoading, setEditLoading] = useState(false)
  const [editLang, setEditLang] = useState<Locale>('uk')
  const [editTranslations, setEditTranslations] = useState<StudioTranslations>(emptyStudioTranslations())

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
        name: createTranslations.uk.name.trim(),
        street: newStreet.trim(),
        city: newCity.trim(),
        timezone: newTimezone.trim(),
        schedule: newSchedule,
        translations: createTranslations,
      }),
    })
    const data = await res.json() as { error?: { message?: string } }
    if (!res.ok) {
      setMessage({ type: 'error', text: data.error?.message ?? t('error_create') })
    } else {
      setMessage({ type: 'success', text: t('success_create') })
      setShowCreate(false)
      setNewId(''); setNewStreet(''); setNewCity('')
      setNewTimezone('Asia/Jerusalem'); setNewSchedule(buildStudioDefaultSchedule())
      setCreateTranslations(emptyStudioTranslations()); setCreateLang('uk')
      await load(true)
      onStudiosChanged()
    }
    setFormLoading(false)
  }

  const startEdit = (s: Studio) => {
    setEditingId(s.id)
    setEditStreet(s.street ?? '')
    setEditCity(s.city)
    setDeleteTarget(null)
    setEditLang('uk')
    setEditTranslations({
      uk: { name: s.translations?.uk?.name ?? s.name, schedule_text: s.translations?.uk?.schedule_text ?? s.schedule_text ?? '' },
      en: { name: s.translations?.en?.name ?? s.name, schedule_text: s.translations?.en?.schedule_text ?? s.schedule_text ?? '' },
      he: { name: s.translations?.he?.name ?? s.name, schedule_text: s.translations?.he?.schedule_text ?? s.schedule_text ?? '' },
    })
  }

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingId) return
    setEditLoading(true)
    setMessage(null)
    const res = await apiFetch(`/api/admin/studios/${editingId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: editTranslations.uk.name.trim(),
        street: (editStreet ?? '').trim(),
        city: editCity.trim(),
        schedule_text: editTranslations.uk.schedule_text,
        translations: editTranslations,
      }),
    })
    const data = await res.json() as { error?: { message?: string } }
    if (!res.ok) {
      setMessage({ type: 'error', text: data.error?.message ?? t('error_update') })
    } else {
      setMessage({ type: 'success', text: t('success_update') })
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
      setMessage({ type: 'error', text: data.error?.message ?? t('error_delete') })
      setDeleteTarget(null)
    } else {
      setMessage({ type: 'success', text: t('success_delete') })
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
        setImageError(data.error?.message ?? t('error_upload_photo'))
      } else {
        setImageError(null)
        await load(true)
        onStudiosChanged()
      }
    } catch {
      setImageError(t('error_network_upload'))
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
        setImageError(data.error?.message ?? t('error_delete_photo'))
      } else {
        setImageError(null)
        await load(true)
        onStudiosChanged()
      }
    } catch {
      setImageError(t('error_network_delete_photo'))
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
        <h2 className="text-xl font-semibold text-[var(--color-charcoal)]">{t('edit_heading')}</h2>
        <button
          onClick={() => { setShowCreate(v => !v); setEditingId(null); setDeleteTarget(null) }}
          className="px-4 py-2 rounded-lg text-sm font-medium bg-[var(--color-rose)] text-white hover:opacity-90 transition-opacity"
        >
          {showCreate ? t('cancel_btn') : t('add_btn')}
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
          <h3 className="text-sm font-semibold text-[var(--color-charcoal)]">Нова студія</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-500 mb-1">ID (slug) *</label>
              <input
                value={newId} onChange={e => setNewId(e.target.value)}
                placeholder="tel-aviv"
                required
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-[var(--color-charcoal)] focus:outline-none focus:border-[var(--color-rose)]"
              />
              <p className="mt-1 text-xs text-gray-400">Малі літери, цифри та дефіси</p>
            </div>
            <div className="sm:col-span-2">
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs text-gray-500">{t('name_label')} *</label>
                <LangTabs value={createLang} onChange={setCreateLang} />
              </div>
              <input
                key={createLang}
                value={createTranslations[createLang].name}
                onChange={e => setCreateTranslations(prev => ({ ...prev, [createLang]: { ...prev[createLang], name: e.target.value } }))}
                placeholder={t('name_placeholder')}
                required={createLang === 'uk'}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-[var(--color-charcoal)] focus:outline-none focus:border-[var(--color-rose)]"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">{t('street_label')}</label>
              <input
                value={newStreet} onChange={e => setNewStreet(e.target.value)}
                placeholder={t('street_placeholder')}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-[var(--color-charcoal)] focus:outline-none focus:border-[var(--color-rose)]"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">{t('city_label')} *</label>
              <input
                value={newCity} onChange={e => setNewCity(e.target.value)}
                placeholder={t('city_placeholder')}
                required
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-[var(--color-charcoal)] focus:outline-none focus:border-[var(--color-rose)]"
              />
            </div>
          </div>
          <div className="sm:col-span-2">
            <label className="block text-xs text-gray-500 mb-1">{t('schedule_label')} [{createLang.toUpperCase()}]</label>
            <textarea
              key={createLang}
              value={createTranslations[createLang].schedule_text}
              onChange={e => setCreateTranslations(prev => ({ ...prev, [createLang]: { ...prev[createLang], schedule_text: e.target.value } }))}
              placeholder={t('schedule_placeholder')}
              rows={3}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-[var(--color-charcoal)] focus:outline-none focus:border-[var(--color-rose)] resize-none"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-xs text-gray-500 mb-2">Розклад роботи</label>
            <ScheduleEditor rows={newSchedule} onChange={setNewSchedule} disabled={formLoading} />
          </div>
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={formLoading}
              className="px-4 py-2 rounded-lg text-sm font-medium bg-[var(--color-rose)] text-white hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {formLoading ? tCommon('saving') : t('create_heading')}
            </button>
            <button
              type="button"
              onClick={() => setShowCreate(false)}
              className="px-4 py-2 rounded-lg text-sm font-medium border border-gray-300 text-[var(--color-charcoal)] hover:bg-gray-50"
            >
              {t('cancel_btn')}
            </button>
          </div>
        </form>
      )}

      {/* Edit form */}
      {editingId && (
        <form onSubmit={handleEdit} className="mb-6 p-4 border border-[var(--color-blush)] rounded-xl space-y-4">
          <h3 className="text-sm font-semibold text-[var(--color-charcoal)]">Редагувати студію</h3>

          {/* Photo section */}
          <div className="sm:col-span-2">
            <label className="block text-xs text-gray-500 mb-2">Фото студії</label>
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
                    alt={t('photo_alt')}
                    className="w-24 h-16 object-cover rounded-lg border border-[var(--color-blush)]"
                  />
                  <button
                    type="button"
                    onClick={() => handleImageDelete(editingId!)}
                    disabled={uploadingImage}
                    className="px-3 py-1.5 rounded text-xs border border-red-200 text-red-600 bg-red-50 hover:bg-red-100 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {uploadingImage ? t('deleting_photo') : t('delete_photo')}
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-3">
                  <label className={`cursor-pointer flex items-center gap-2 px-3 py-1.5 rounded text-xs border border-gray-300 text-[var(--color-charcoal)] hover:bg-gray-50 ${uploadingImage ? 'opacity-50 pointer-events-none' : ''}`}>
                    {uploadingImage ? t('uploading_photo') : t('upload_photo')}
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
            <div className="sm:col-span-2">
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs text-gray-500">{t('name_label')} *</label>
                <LangTabs value={editLang} onChange={setEditLang} />
              </div>
              <input
                key={editLang}
                value={editTranslations[editLang].name}
                onChange={e => setEditTranslations(prev => ({ ...prev, [editLang]: { ...prev[editLang], name: e.target.value } }))}
                required={editLang === 'uk'}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-[var(--color-charcoal)] focus:outline-none focus:border-[var(--color-rose)]"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">{t('street_label')}</label>
              <input
                value={editStreet} onChange={e => setEditStreet(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-[var(--color-charcoal)] focus:outline-none focus:border-[var(--color-rose)]"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">{t('city_label')} *</label>
              <input
                value={editCity} onChange={e => setEditCity(e.target.value)}
                required
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-[var(--color-charcoal)] focus:outline-none focus:border-[var(--color-rose)]"
              />
            </div>
          </div>
          <div className="sm:col-span-2">
            <label className="block text-xs text-gray-500 mb-1">{t('schedule_label')} [{editLang.toUpperCase()}]</label>
            <textarea
              key={editLang}
              value={editTranslations[editLang].schedule_text}
              onChange={e => setEditTranslations(prev => ({ ...prev, [editLang]: { ...prev[editLang], schedule_text: e.target.value } }))}
              rows={3}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-[var(--color-charcoal)] focus:outline-none focus:border-[var(--color-rose)] resize-none"
            />
          </div>
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={editLoading}
              className="px-4 py-2 rounded-lg text-sm font-medium bg-[var(--color-rose)] text-white hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {editLoading ? tCommon('saving') : tCommon('save')}
            </button>
            <button
              type="button"
              onClick={() => setEditingId(null)}
              className="px-4 py-2 rounded-lg text-sm font-medium border border-gray-300 text-[var(--color-charcoal)] hover:bg-gray-50"
            >
              {t('cancel_btn')}
            </button>
          </div>
        </form>
      )}

      {/* Studios list */}
      {loading ? (
        <p className="text-sm text-gray-400">{tCommon('loading')}</p>
      ) : studiosList.length === 0 ? (
        <p className="text-sm text-gray-400">{t('edit_heading')}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--color-blush)]">
                <th className="py-2 pr-2 w-6"></th>
                <th className="text-left py-2 pr-4 text-xs font-medium text-gray-500">{t('name_label')}</th>
                <th className="text-left py-2 pr-4 text-xs font-medium text-gray-500">{t('street_label')}</th>
                <th className="text-left py-2 pr-4 text-xs font-medium text-gray-500">{t('city_label')}</th>
                <th className="text-left py-2 pr-4 text-xs font-medium text-gray-500">{t('id_label')}</th>
                <th className="text-right py-2 text-xs font-medium text-gray-500"></th>
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
                          {tCommon('edit')}
                        </button>
                        <button
                          onClick={() => setDeleteTarget(prev => prev === s.id ? null : s.id)}
                          className="px-3 py-1 rounded text-xs border border-red-200 text-red-600 bg-red-50 hover:bg-red-100"
                        >
                          {tCommon('delete')}
                        </button>
                      </div>
                    </td>
                  </tr>
                  {deleteTarget === s.id && (
                    <tr className="bg-red-50">
                      <td colSpan={6} className="px-4 py-3">
                        <div className="flex items-center justify-between gap-4">
                          <p className="text-sm text-red-700">
                            {t('delete_confirm', { name: s.name })}
                          </p>
                          <div className="flex gap-2 shrink-0">
                            <button
                              onClick={() => handleDelete(s.id)}
                              disabled={deleting}
                              className="px-3 py-1 rounded text-xs bg-red-600 text-white hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              {deleting ? tCommon('deleting') : tCommon('confirm')}
                            </button>
                            <button
                              onClick={() => setDeleteTarget(null)}
                              className="px-3 py-1 rounded text-xs border border-gray-300 text-gray-600 hover:bg-white"
                            >
                              {tCommon('cancel')}
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
// Clients Section
// ---------------------------------------------------------------------------

interface AdminClientDTO {
  id: string
  first_name: string
  last_name: string
  phone: string
  email: string | null
  city: string
  consent: boolean
  created_at: string
}

interface ClientBookingDTO {
  id: string
  status: string
  start_at: string
  end_at: string
  service_snapshot: Record<string, unknown>
  studio_id: string
  created_at: string
}

interface ClientsSectionProps {
  apiFetch: (path: string, options?: RequestInit) => Promise<Response>
  onUnauth: () => void
  onEditBooking: (booking: AdminBookingDTO) => void
  hideBookingsModal?: boolean
}

function ClientsSection({ apiFetch, onUnauth, onEditBooking, hideBookingsModal }: ClientsSectionProps) {
  const t = useTranslations('admin.clients_panel')
  const tCommon = useTranslations('common')
  const [clients, setClients] = useState<AdminClientDTO[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Edit modal state
  const [editingClient, setEditingClient] = useState<AdminClientDTO | null>(null)
  const [editForm, setEditForm] = useState({ first_name: '', last_name: '', email: '', city: '' })
  const [editSaving, setEditSaving] = useState(false)
  const [editError, setEditError] = useState<string | null>(null)

  // Bookings modal state
  const [viewingClientId, setViewingClientId] = useState<string | null>(null)
  const [clientDetail, setClientDetail] = useState<{ client: AdminClientDTO; bookings: ClientBookingDTO[] } | null>(null)
  const [bookingsLoading, setBookingsLoading] = useState(false)
  const [bookingsError, setBookingsError] = useState<string | null>(null)

  // Edit booking from client modal
  const [fetchingBookingId, setFetchingBookingId] = useState<string | null>(null)
  const [fetchBookingError, setFetchBookingError] = useState<string | null>(null)

  // Delete state
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  const INPUT_CLS = 'border border-gray-300 rounded-lg px-3 py-2 text-sm text-[var(--color-charcoal)] focus:outline-none focus:border-[var(--color-rose)]'

  const loadClients = useCallback(async (searchTerm: string) => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams({ limit: '50', page: '1' })
      if (searchTerm) params.set('search', searchTerm)
      const res = await apiFetch(`/api/admin/clients?${params.toString()}`)
      if (!res.ok) {
        const body = await res.json() as { error?: { message?: string } }
        setError(body.error?.message ?? t('error_load'))
        return
      }
      const data = await res.json() as { clients: AdminClientDTO[]; total: number }
      setClients(data.clients ?? [])
      setTotal(data.total ?? 0)
    } catch {
      setError(t('error_network_load'))
    } finally {
      setLoading(false)
    }
  }, [apiFetch])

  useEffect(() => {
    void loadClients(search)
  }, [loadClients, search])

  function handleSearchChange(e: React.ChangeEvent<HTMLInputElement>) {
    const value = e.target.value
    setSearchInput(value)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      setSearch(value)
    }, 300)
  }

  function formatDate(isoStr: string): string {
    return new Date(isoStr).toLocaleDateString('uk-UA', {
      timeZone: 'Asia/Jerusalem',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    })
  }

  function formatBookingDateTime(isoStr: string): string {
    if (!isoStr) return '—'
    return new Date(isoStr).toLocaleString('uk-UA', {
      timeZone: 'Asia/Jerusalem',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  function openEditModal(client: AdminClientDTO) {
    setEditingClient(client)
    setEditForm({
      first_name: client.first_name,
      last_name: client.last_name,
      email: client.email ?? '',
      city: client.city,
    })
    setEditError(null)
    setDeleteTarget(null)
  }

  async function handleEditSave() {
    if (!editingClient) return
    setEditSaving(true)
    setEditError(null)
    try {
      const res = await apiFetch(`/api/admin/clients/${editingClient.id}`, {
        method: 'PUT',
        body: JSON.stringify(editForm),
      })
      if (!res.ok) {
        const body = await res.json() as { error?: { message?: string } }
        setEditError(body.error?.message ?? t('error_save'))
        return
      }
      setEditingClient(null)
      void loadClients(search)
    } catch {
      setEditError(t('error_network_save'))
    } finally {
      setEditSaving(false)
    }
  }

  async function handleDelete(clientId: string) {
    setDeleting(true)
    setDeleteError(null)
    try {
      const res = await apiFetch(`/api/admin/clients/${clientId}`, { method: 'DELETE' })
      if (!res.ok) {
        const body = await res.json() as { error?: { message?: string } }
        setDeleteError(body.error?.message ?? t('error_delete'))
        setDeleteTarget(null)
        return
      }
      setDeleteTarget(null)
      void loadClients(search)
    } catch {
      setDeleteError(t('error_network_delete'))
    } finally {
      setDeleting(false)
    }
  }

  async function openBookingsModal(client: AdminClientDTO) {
    setViewingClientId(client.id)
    setClientDetail(null)
    setBookingsLoading(true)
    setBookingsError(null)
    try {
      const res = await apiFetch(`/api/admin/clients/${client.id}`)
      if (res.status === 401) {
        onUnauth()
        setViewingClientId(null)
        return
      }
      if (!res.ok) {
        const body = await res.json() as { error?: { message?: string } }
        setBookingsError(body.error?.message ?? t('error_load_bookings'))
        return
      }
      const data = await res.json() as { client: AdminClientDTO; bookings: ClientBookingDTO[] }
      setClientDetail(data)
    } catch {
      setBookingsError(t('error_network_load_bookings'))
    } finally {
      setBookingsLoading(false)
    }
  }

  async function handleEditClientBooking(bookingId: string) {
    setFetchingBookingId(bookingId)
    setFetchBookingError(null)
    try {
      const res = await apiFetch(`/api/admin/bookings/${bookingId}`)
      if (res.status === 401) {
        onUnauth()
        return
      }
      if (!res.ok) {
        const body = await res.json() as { error?: { message?: string } }
        setFetchBookingError(body.error?.message ?? t('error_load_booking'))
        return
      }
      const data = await res.json() as { booking: AdminBookingDTO }
      onEditBooking(data.booking)
    } catch {
      setFetchBookingError(t('error_network_load_booking'))
    } finally {
      setFetchingBookingId(null)
    }
  }

  return (
    <section className="bg-white border border-[var(--color-blush)] rounded-xl p-6">
      {/* Section header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-semibold text-[var(--color-charcoal)]">{t('heading')}</h2>
          {!loading && (
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600 border border-gray-200">
              {total}
            </span>
          )}
        </div>
        <button
          onClick={() => void loadClients(search)}
          disabled={loading}
          className="border border-[var(--color-rose)] text-[var(--color-rose)] rounded-lg px-4 py-2 text-sm font-medium hover:bg-[var(--color-blush)] transition-colors disabled:opacity-50 self-start sm:self-auto"
        >
          {loading ? tCommon('loading') : t('refresh_btn')}
        </button>
      </div>

      {/* Search / filter bar */}
      <div className="flex flex-wrap gap-4 mb-4">
        <div className="flex flex-col gap-1 text-sm text-gray-600 w-full sm:w-auto">
          <label htmlFor="clients-search" className="sr-only">{t('search_label')}</label>
          <input
            id="clients-search"
            type="text"
            placeholder={t('search_placeholder')}
            value={searchInput}
            onChange={handleSearchChange}
            className={INPUT_CLS + ' w-full sm:w-80'}
          />
        </div>
      </div>

      {error && (
        <p className="mb-4 text-sm text-red-500">{error}</p>
      )}

      {deleteError && (
        <p className="mb-4 text-sm text-red-500">{deleteError}</p>
      )}

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="border-b border-gray-200 text-left text-gray-500">
              <th className="py-2 pr-4 font-medium">{t('col_name')}</th>
              <th className="py-2 pr-4 font-medium">{t('col_phone')}</th>
              <th className="py-2 pr-4 font-medium">Email</th>
              <th className="py-2 pr-4 font-medium">{t('col_city')}</th>
              <th className="py-2 pr-4 font-medium">{t('col_reg_date')}</th>
              <th className="py-2 font-medium">{t('col_actions')}</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <>
                {[1, 2, 3, 4, 5].map((n) => (
                  <tr key={n} className="border-b border-gray-100">
                    {[1, 2, 3, 4, 5, 6].map((c) => (
                      <td key={c} className="py-3 pr-4">
                        <div className="h-4 bg-gray-100 rounded animate-pulse w-24" />
                      </td>
                    ))}
                  </tr>
                ))}
              </>
            )}
            {!loading && clients.length === 0 && (
              <tr>
                <td colSpan={6} className="py-10 text-center text-gray-400">
                  {search ? t('no_clients_search') : t('no_clients')}
                </td>
              </tr>
            )}
            {!loading && clients.map((client) => (
              <React.Fragment key={client.id}>
                <tr className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                  <td className="py-2 pr-4 text-[var(--color-charcoal)] font-medium whitespace-nowrap">
                    {client.first_name} {client.last_name}
                  </td>
                  <td className="py-2 pr-4 text-[var(--color-charcoal)] whitespace-nowrap">
                    {client.phone}
                  </td>
                  <td className="py-2 pr-4 text-[var(--color-charcoal)]">
                    {client.email || '—'}
                  </td>
                  <td className="py-2 pr-4 text-[var(--color-charcoal)]">
                    {client.city}
                  </td>
                  <td className="py-2 pr-4 text-[var(--color-charcoal)] whitespace-nowrap">
                    {formatDate(client.created_at)}
                  </td>
                  <td className="py-2">
                    <div className="flex gap-2">
                      <button
                        onClick={() => openEditModal(client)}
                        className="px-3 py-1 rounded text-xs font-medium bg-blue-50 text-blue-600 border border-blue-200 hover:bg-blue-100 transition-colors"
                      >
                        {t('change_btn')}
                      </button>
                      <button
                        onClick={() => void openBookingsModal(client)}
                        className="px-3 py-1 rounded text-xs font-medium border border-gray-300 text-[var(--color-charcoal)] hover:bg-gray-50 transition-colors"
                      >
                        {t('view_bookings')}
                      </button>
                      <button
                        onClick={() => setDeleteTarget((prev) => prev === client.id ? null : client.id)}
                        className="px-3 py-1 rounded text-xs font-medium border border-red-200 text-red-600 bg-red-50 hover:bg-red-100 transition-colors"
                      >
                        {t('delete_btn')}
                      </button>
                    </div>
                  </td>
                </tr>
                {deleteTarget === client.id && (
                  <tr className="bg-red-50">
                    <td colSpan={6} className="px-4 py-3">
                      <div className="flex items-center justify-between gap-4">
                        <p className="text-sm text-red-700">
                          {t('delete_confirm', { name: `${client.first_name} ${client.last_name}` })}
                        </p>
                        <div className="flex gap-2 shrink-0">
                          <button
                            onClick={() => void handleDelete(client.id)}
                            disabled={deleting}
                            className="px-3 py-1 rounded text-xs bg-red-600 text-white hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {deleting ? tCommon('deleting') : tCommon('confirm')}
                          </button>
                          <button
                            onClick={() => setDeleteTarget(null)}
                            className="px-3 py-1 rounded text-xs border border-gray-300 text-gray-600 hover:bg-white"
                          >
                            {tCommon('cancel')}
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

      {/* Edit client modal */}
      {editingClient !== null && (
        <div
          className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center"
          onClick={() => setEditingClient(null)}
        >
          <div
            className="bg-white rounded-2xl p-6 w-full max-w-md mx-4 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-semibold text-[var(--color-charcoal)] mb-1">
              {t('edit_heading')}
            </h3>
            <p className="text-sm text-gray-500 mb-4">{t('phone_label')}: {editingClient.phone}</p>

            <div className="flex flex-col gap-3 mb-4">
              <label className="flex flex-col gap-1 text-sm text-gray-600">
                {t('first_name_label')}
                <input
                  type="text"
                  value={editForm.first_name}
                  onChange={(e) => setEditForm((f) => ({ ...f, first_name: e.target.value }))}
                  className={INPUT_CLS}
                />
              </label>
              <label className="flex flex-col gap-1 text-sm text-gray-600">
                {t('last_name_label')}
                <input
                  type="text"
                  value={editForm.last_name}
                  onChange={(e) => setEditForm((f) => ({ ...f, last_name: e.target.value }))}
                  className={INPUT_CLS}
                />
              </label>
              <label className="flex flex-col gap-1 text-sm text-gray-600">
                Email
                <input
                  type="email"
                  value={editForm.email}
                  onChange={(e) => setEditForm((f) => ({ ...f, email: e.target.value }))}
                  className={INPUT_CLS}
                />
              </label>
              <label className="flex flex-col gap-1 text-sm text-gray-600">
                {t('city_label')}
                <input
                  type="text"
                  value={editForm.city}
                  onChange={(e) => setEditForm((f) => ({ ...f, city: e.target.value }))}
                  className={INPUT_CLS}
                />
              </label>
            </div>

            {editError && (
              <p className="text-sm text-red-500 mb-3">{editError}</p>
            )}

            <div className="flex items-center justify-end gap-3">
              <button
                onClick={() => setEditingClient(null)}
                className="px-4 py-2 text-sm border border-gray-300 text-gray-600 rounded-lg hover:bg-gray-50 transition-colors"
              >
                {tCommon('cancel')}
              </button>
              <button
                onClick={() => void handleEditSave()}
                disabled={editSaving}
                className="px-4 py-2 text-sm bg-[var(--color-rose)] text-white rounded-lg font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                {editSaving ? tCommon('saving') : tCommon('save')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Client bookings modal */}
      {viewingClientId !== null && !hideBookingsModal && (
        <div
          className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center"
          onClick={() => { setViewingClientId(null); setBookingsError(null) }}
        >
          <div
            className="bg-white rounded-2xl p-6 w-full max-w-md mx-4 shadow-xl max-h-[80vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {bookingsLoading ? (
              <div className="flex-1 flex items-center justify-center py-8">
                <p className="text-sm text-gray-400">{tCommon('loading')}</p>
              </div>
            ) : bookingsError ? (
              <div className="flex-1 flex flex-col items-center justify-center py-8 gap-4">
                <p className="text-sm text-red-500 text-center">{bookingsError}</p>
                <button
                  onClick={() => { setViewingClientId(null); setBookingsError(null) }}
                  className="px-4 py-2 rounded-lg text-sm border border-gray-300 text-gray-600 hover:bg-gray-50 transition-colors"
                >
                  {tCommon('close')}
                </button>
              </div>
            ) : !clientDetail ? (
              <div className="flex-1 flex items-center justify-center py-8">
                <p className="text-sm text-gray-400">{t('error_no_data')}</p>
              </div>
            ) : (
              <>
                <div className="mb-4 shrink-0">
                  <h3 className="text-lg font-semibold text-[var(--color-charcoal)]">
                    {t('client_bookings_heading')}
                  </h3>
                  <p className="text-sm text-gray-500 mt-0.5">
                    {clientDetail.client.first_name} {clientDetail.client.last_name} · {clientDetail.client.phone}
                  </p>
                </div>

                <div className="flex-1 overflow-y-auto -mx-1 px-1">
                  {clientDetail.bookings.length === 0 ? (
                    <p className="text-sm text-gray-400 text-center py-6">{t('no_bookings')}</p>
                  ) : (
                    <>
                    {fetchBookingError && (
                      <p className="text-xs text-red-500 mb-2">{fetchBookingError}</p>
                    )}
                    <ul className="flex flex-col gap-2">
                      {clientDetail.bookings.map((booking) => (
                        <li
                          key={booking.id}
                          className="flex items-center justify-between gap-3 rounded-lg border border-gray-100 px-3 py-2.5 bg-gray-50"
                        >
                          <div className="flex flex-col gap-0.5 min-w-0">
                            <span className="text-sm font-medium text-[var(--color-charcoal)] truncate">
                              {typeof (booking.service_snapshot as { name?: string }).name === 'string'
                                ? (booking.service_snapshot as { name?: string }).name
                                : '—'}
                            </span>
                            <span className="text-xs text-gray-500">
                              {formatBookingDateTime(booking.start_at)}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <BookingStatusBadge status={booking.status} />
                            <button
                              onClick={() => void handleEditClientBooking(booking.id)}
                              disabled={fetchingBookingId === booking.id}
                              className="px-3 py-1 rounded text-xs font-medium bg-blue-50 text-blue-600 border border-blue-200 hover:bg-blue-100 transition-colors disabled:opacity-50"
                            >
                              {fetchingBookingId === booking.id ? '...' : t('change_btn')}
                            </button>
                          </div>
                        </li>
                      ))}
                    </ul>
                    </>
                  )}
                </div>

                <div className="flex justify-end mt-4 shrink-0">
                  <button
                    onClick={() => { setViewingClientId(null); setBookingsError(null) }}
                    className="px-4 py-2 rounded-lg text-sm border border-gray-300 text-gray-600 hover:bg-gray-50 transition-colors"
                  >
                    {tCommon('close')}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </section>
  )
}

// ---------------------------------------------------------------------------
// Main Admin Page
// ---------------------------------------------------------------------------

export default function AdminPage() {
  const t = useTranslations('admin')
  const tCommon = useTranslations('common')
  const [secret, setSecret] = useState<string | null>(null)
  const [studio, setStudio] = useState<string>('rishon')
  const [studios, setStudios] = useState<Studio[]>([])
  const [activeTab, setActiveTab] = useState<AdminTab>('bookings')
  const [settingsSubTab, setSettingsSubTab] = useState<SettingsSubTab>('studios')
  const [topSection, setTopSection] = useState<'studios' | 'settings' | 'clients'>('studios')

  // Generate form state
  const [genDateFrom, setGenDateFrom] = useState(todayString())
  const [genDateTo, setGenDateTo] = useState(addDays(todayString(), 7))
  const [genMessage, setGenMessage] = useState<InlineMessage | null>(null)
  const [genLoading, setGenLoading] = useState(false)

  // Bookings list state
  const [listDateFrom, setListDateFrom] = useState(todayString())
  const [listDateTo, setListDateTo] = useState(addDays(todayString(), 7))
  const [bookings, setBookings] = useState<AdminBookingDTO[]>([])
  const [bookingsMessage, setBookingsMessage] = useState<InlineMessage | null>(null)
  const [bookingsLoading, setBookingsLoading] = useState(false)
  const [cancellingId, setCancellingId] = useState<string | null>(null)
  const [editingBooking, setEditingBooking] = useState<AdminBookingDTO | null>(null)

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
  // Load bookings
  // ---------------------------------------------------------------------------

  const loadBookings = useCallback(async () => {
    if (!secret) return
    setBookingsLoading(true)
    setBookingsMessage(null)
    try {
      const params = new URLSearchParams({
        studio_id: studio,
        date_from: listDateFrom,
        date_to: listDateTo,
      })
      const res = await apiFetch(`/api/admin/bookings?${params.toString()}`)
      if (res.status === 401) {
        handleUnauth()
        return
      }
      if (!res.ok) {
        const body = await res.json() as { error?: { message?: string } }
        setBookingsMessage({ type: 'error', text: body.error?.message ?? t('bookings_panel.error_load') })
        return
      }
      const data = await res.json() as GetAdminBookingsResponse
      setBookings(data.bookings)
    } catch {
      setBookingsMessage({ type: 'error', text: t('bookings_panel.error_network_load') })
    } finally {
      setBookingsLoading(false)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [secret, studio, listDateFrom, listDateTo, apiFetch])

  // Reload when studio or secret changes
  useEffect(() => {
    if (secret) {
      loadStudios()
      loadBookings()
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
        setGenMessage({ type: 'error', text: body.error?.message ?? t('bookings_panel.error_generate') })
        return
      }
      const data = await res.json() as GenerateSlotsFromTemplateResponse
      setGenMessage({
        type: 'success',
        text: t('bookings_panel.slots_created', { created: data.created }) + (data.skipped > 0 ? t('bookings_panel.slots_skipped', { skipped: data.skipped }) : ''),
      })
      // Refresh bookings list if date ranges overlap
      if (genDateFrom <= listDateTo && genDateTo >= listDateFrom) {
        await loadBookings()
      }
    } catch {
      setGenMessage({ type: 'error', text: t('bookings_panel.error_network_generate') })
    } finally {
      setGenLoading(false)
    }
  }

  // ---------------------------------------------------------------------------
  // Cancel booking
  // ---------------------------------------------------------------------------

  async function handleCancelBooking(id: string) {
    if (!secret) return
    setCancellingId(id)
    setBookingsMessage(null)
    try {
      const res = await apiFetch(`/api/admin/bookings/${id}`, {
        method: 'PUT',
        body: JSON.stringify({ action: 'cancel' }),
      })
      if (res.status === 401) {
        handleUnauth()
        return
      }
      if (!res.ok) {
        const body = await res.json() as { error?: { message?: string } }
        setBookingsMessage({ type: 'error', text: body.error?.message ?? t('bookings_panel.error_cancel') })
        return
      }
      setBookings((prev) =>
        prev.map((b) => b.id === id ? { ...b, status: 'CANCELLED' as AdminBookingDTO['status'] } : b),
      )
    } catch {
      setBookingsMessage({ type: 'error', text: t('bookings_panel.error_network_cancel') })
    } finally {
      setCancellingId(null)
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
    { key: 'bookings', label: t('tabs.bookings') },
    { key: 'schedule', label: t('tabs.schedule') },
    { key: 'services', label: t('tabs.services') },
  ]

  return (
    <main className="min-h-screen bg-[var(--color-cream)] p-4 md:p-8">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
          <h1 className="text-2xl font-semibold text-[var(--color-charcoal)]">
            {t('page_title')}
          </h1>
          <div className="flex items-center gap-4 self-start sm:self-auto">
            <button
              onClick={() => {
                localStorage.removeItem('admin_secret')
                setSecret(null)
              }}
              className="text-sm text-gray-500 underline"
            >
              {t('logout_btn')}
            </button>
          </div>
        </div>

        {/* Top-level navigation: Студії | Налаштування */}
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
            {t('tabs.studios')}
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
            {t('tabs.settings')}
          </button>
          <button
            onClick={() => setTopSection('clients')}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium transition-colors ${
              topSection === 'clients'
                ? 'bg-[var(--color-rose)] text-white shadow-sm'
                : 'text-[var(--color-charcoal)] hover:bg-gray-50'
            }`}
          >
            <Users size={16} />
            {t('tabs.clients')}
          </button>
        </div>

        {/* Settings panel */}
        {topSection === 'settings' && (
          <div>
            {/* Settings sub-tab navigation */}
            <div className="flex gap-2 mb-6 border-b border-gray-100 pb-1">
              {([
                { key: 'studios', label: t('tabs.studios') },
                { key: 'services', label: t('tabs.services') },
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

            {/* Settings sub-tab: Студії */}
            {settingsSubTab === 'studios' && (
              <section className="bg-white border border-[var(--color-blush)] rounded-xl p-6">
                <StudiosTab apiFetch={apiFetch} onUnauth={handleUnauth} onStudiosChanged={loadStudios} secret={secret} />
              </section>
            )}

            {/* Settings sub-tab: Послуги */}
            {settingsSubTab === 'services' && (
              <section className="bg-white border border-[var(--color-blush)] rounded-xl p-6">
                <ServicesTab studio={studio} apiFetch={apiFetch} onUnauth={handleUnauth} />
              </section>
            )}
          </div>
        )}

        {/* Clients section */}
        {topSection === 'clients' && (
          <ClientsSection apiFetch={apiFetch} onUnauth={handleUnauth} onEditBooking={setEditingBooking} hideBookingsModal={!!editingBooking} />
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


            {/* Bookings list */}
            <section className="bg-white border border-[var(--color-blush)] rounded-xl p-6">
              <h2 className="text-lg font-semibold text-[var(--color-charcoal)] mb-4">
                {t('bookings_panel.list_heading')}
              </h2>

              {/* Date range filters */}
              <div className="flex flex-wrap gap-4 mb-4">
                <label className="flex flex-col gap-1 text-sm text-gray-600">
                  {t('bookings_panel.date_from')}
                  <input
                    type="date"
                    value={listDateFrom}
                    onChange={(e) => setListDateFrom(e.target.value)}
                    className={INPUT_CLS}
                  />
                </label>
                <label className="flex flex-col gap-1 text-sm text-gray-600">
                  {t('bookings_panel.date_to')}
                  <input
                    type="date"
                    value={listDateTo}
                    onChange={(e) => setListDateTo(e.target.value)}
                    className={INPUT_CLS}
                  />
                </label>
                <div className="flex items-end">
                  <button
                    onClick={loadBookings}
                    disabled={bookingsLoading}
                    className="border border-[var(--color-rose)] text-[var(--color-rose)] rounded-lg px-4 py-2 text-sm font-medium hover:bg-[var(--color-blush)] transition-colors disabled:opacity-50"
                  >
                    {bookingsLoading ? tCommon('loading') : t('bookings_panel.refresh_btn')}
                  </button>
                </div>
              </div>

              {bookingsMessage && (
                <p className={`mb-4 text-sm ${bookingsMessage.type === 'success' ? 'text-green-600' : 'text-red-500'}`}>
                  {bookingsMessage.text}
                </p>
              )}

              {/* Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr className="border-b border-gray-200 text-left text-gray-500">
                      <th className="py-2 pr-4 font-medium">{t('bookings_panel.col_date')}</th>
                      <th className="py-2 pr-4 font-medium">{t('bookings_panel.col_time')}</th>
                      <th className="py-2 pr-4 font-medium">{t('bookings_panel.col_status')}</th>
                      <th className="py-2 pr-4 font-medium">{t('bookings_panel.col_client')}</th>
                      <th className="py-2 pr-4 font-medium">{t('bookings_panel.col_service')}</th>
                      <th className="py-2 font-medium">{t('bookings_panel.col_actions')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {bookings.length === 0 && !bookingsLoading && (
                      <tr>
                        <td colSpan={6} className="py-8 text-center text-gray-400">
                          {t('bookings_panel.no_bookings')}
                        </td>
                      </tr>
                    )}
                    {bookingsLoading && (
                      <tr>
                        <td colSpan={6} className="py-8 text-center text-gray-400">
                          {tCommon('loading')}
                        </td>
                      </tr>
                    )}
                    {!bookingsLoading && bookings.map((booking) => {
                      const serviceName =
                        typeof (booking.service_snapshot as { name?: string }).name === 'string'
                          ? (booking.service_snapshot as { name?: string }).name
                          : '—'
                      const isCancelling = cancellingId === booking.id
                      const isCancelled = booking.status === 'CANCELLED'

                      return (
                        <tr
                          key={booking.id}
                          className="border-b border-gray-100 hover:bg-gray-50 transition-colors"
                        >
                          <td className="py-2 pr-4 text-[var(--color-charcoal)]">
                            {booking.start_at ? formatLocalDate(booking.start_at) : '—'}
                          </td>
                          <td className="py-2 pr-4 text-[var(--color-charcoal)] whitespace-nowrap">
                            {booking.start_at && booking.end_at
                              ? `${formatLocalTime(booking.start_at)}–${formatLocalTime(booking.end_at)}`
                              : '—'}
                          </td>
                          <td className="py-2 pr-4">
                            <BookingStatusBadge status={booking.status} />
                          </td>
                          <td className="py-2 pr-4 text-[var(--color-charcoal)]">
                            {booking.client_first_name} {booking.client_last_name}
                          </td>
                          <td className="py-2 pr-4 text-[var(--color-charcoal)]">
                            {serviceName}
                          </td>
                          <td className="py-2">
                            <div className="flex gap-2">
                              <button
                                onClick={() => setEditingBooking(booking)}
                                className="px-3 py-1 rounded text-xs font-medium bg-blue-50 text-blue-600 border border-blue-200 hover:bg-blue-100 transition-colors"
                              >
                                {t('bookings_panel.edit_btn')}
                              </button>
                              <button
                                onClick={() => handleCancelBooking(booking.id)}
                                disabled={isCancelled || isCancelling}
                                title={isCancelled ? t('bookings_panel.already_cancelled') : t('bookings_panel.cancel_booking')}
                                className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                                  !isCancelled && !isCancelling
                                    ? 'bg-red-50 text-red-600 border border-red-200 hover:bg-red-100'
                                    : 'bg-gray-100 text-gray-400 border border-gray-200 cursor-not-allowed'
                                }`}
                              >
                                {isCancelling ? t('bookings_panel.cancelling') : t('bookings_panel.cancel_booking')}
                              </button>
                            </div>
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

            {/* Tab: Розклад */}
            {activeTab === 'schedule' && (
              <section className="bg-white border border-[var(--color-blush)] rounded-xl p-6">
                <ScheduleTab studio={studio} apiFetch={apiFetch} onUnauth={handleUnauth} />
              </section>
            )}

            {/* Tab: Послуги */}
            {activeTab === 'services' && (
              <section className="bg-white border border-[var(--color-blush)] rounded-xl p-6">
                <StudioServicesAssignmentTab studio={studio} apiFetch={apiFetch} onUnauth={handleUnauth} />
              </section>
            )}
          </>
        )}
      </div>

      {/* Edit booking modal — rendered at root level so it works from any section */}
      {editingBooking && (
        <div
          className="fixed inset-0 bg-black/40 flex items-center justify-center z-50"
          onClick={() => setEditingBooking(null)}
        >
          <div
            className="bg-white rounded-xl p-6 max-w-md w-full mx-4 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-semibold text-[var(--color-charcoal)] mb-4">
              {t('bookings_panel.detail_heading')}
            </h3>
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm mb-6">
              <dt className="text-gray-500 self-center">{t('bookings_panel.detail_client')}</dt>
              <dd className="text-[var(--color-charcoal)]">
                {editingBooking.client_first_name} {editingBooking.client_last_name}
              </dd>
              <dt className="text-gray-500 self-center">{t('bookings_panel.detail_phone')}</dt>
              <dd className="text-[var(--color-charcoal)]">{editingBooking.client_phone}</dd>
              <dt className="text-gray-500 self-center">Email</dt>
              <dd className="text-[var(--color-charcoal)]">{editingBooking.client_email}</dd>
              <dt className="text-gray-500 self-center">{t('bookings_panel.detail_date')}</dt>
              <dd className="text-[var(--color-charcoal)]">
                {editingBooking.start_at ? formatLocalDate(editingBooking.start_at) : '—'}
              </dd>
              <dt className="text-gray-500 self-center">{t('bookings_panel.detail_time')}</dt>
              <dd className="text-[var(--color-charcoal)]">
                {editingBooking.start_at && editingBooking.end_at
                  ? `${formatLocalTime(editingBooking.start_at)}–${formatLocalTime(editingBooking.end_at)}`
                  : '—'}
              </dd>
              <dt className="text-gray-500 self-center">{t('bookings_panel.detail_service')}</dt>
              <dd className="text-[var(--color-charcoal)]">
                {typeof (editingBooking.service_snapshot as { name?: string }).name === 'string'
                  ? (editingBooking.service_snapshot as { name?: string }).name
                  : '—'}
              </dd>
              <dt className="text-gray-500 self-center">{t('bookings_panel.detail_status')}</dt>
              <dd><BookingStatusBadge status={editingBooking.status} /></dd>
              {editingBooking.comment && (
                <>
                  <dt className="text-gray-500 self-start pt-0.5">{t('bookings_panel.detail_comment')}</dt>
                  <dd className="text-[var(--color-charcoal)]">{editingBooking.comment}</dd>
                </>
              )}
            </dl>
            <div className="flex justify-end">
              <button
                onClick={() => setEditingBooking(null)}
                className="px-4 py-2 rounded-lg text-sm border border-gray-300 text-gray-600 hover:bg-gray-50 transition-colors"
              >
                {tCommon('close')}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}
