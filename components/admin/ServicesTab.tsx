'use client'

import React, { useState, useCallback, useEffect, useRef } from 'react'
import { useTranslations } from 'next-intl'
import type { Locale, ServiceTranslations, ServiceTranslation } from '@/lib/types'
import type { AdminServiceDTO, InlineMessage } from '@/components/admin/types'
import { DURATION_OPTIONS, formatDuration } from '@/components/admin/constants'
import { LangTabs } from '@/components/admin/LangTabs'

interface ServicesTabProps {
  studio: string
  apiFetch: (path: string, options?: RequestInit) => Promise<Response>
  onUnauth: () => void
}

export function ServicesTab({ studio, apiFetch, onUnauth }: ServicesTabProps) {
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
