'use client'

import React, { useState, useCallback, useEffect, useRef } from 'react'
import { useTranslations } from 'next-intl'
import { BookingStatusBadge } from '@/components/admin/BookingStatusBadge'
import type { AdminClientDTO, ClientBookingDTO } from '@/components/admin/types'
import type { AdminBookingDTO } from '@/lib/types'

interface ClientsSectionProps {
  apiFetch: (path: string, options?: RequestInit) => Promise<Response>
  onUnauth: () => void
  onEditBooking: (booking: AdminBookingDTO) => void
  hideBookingsModal?: boolean
}

export function ClientsSection({ apiFetch, onUnauth, onEditBooking, hideBookingsModal }: ClientsSectionProps) {
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
  }, [apiFetch, t])

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
