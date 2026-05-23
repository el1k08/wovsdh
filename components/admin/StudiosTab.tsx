'use client'

import React, { useState, useCallback, useEffect, useRef } from 'react'
import { useTranslations } from 'next-intl'
import type { Studio, StudioTranslations, Locale } from '@/lib/types'
import type { InlineMessage, ScheduleRow } from '@/components/admin/types'
import { LOCALES } from '@/components/admin/constants'
import { buildStudioDefaultSchedule } from '@/components/admin/utils'
import { ScheduleEditor } from '@/components/admin/ScheduleEditor'
import { LangTabs } from '@/components/admin/LangTabs'

interface StudiosTabProps {
  apiFetch: (path: string, options?: RequestInit) => Promise<Response>
  onUnauth: () => void
  onStudiosChanged: () => void
  secret: string | null
}

export function StudiosTab({ apiFetch, onUnauth, onStudiosChanged, secret }: StudiosTabProps) {
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
