'use client'

import { useState, useCallback, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import type { AdminBookingDTO, GetAdminBookingsResponse } from '@/lib/types'
import type { InlineMessage } from '@/components/admin/types'
import { BookingStatusBadge } from '@/components/admin/BookingStatusBadge'
import { todayString, addDays, formatLocalTime, formatLocalDate } from '@/components/admin/utils'

const INPUT_CLS =
  'border border-gray-300 rounded-lg px-3 py-2 text-sm text-[var(--color-charcoal)] focus:outline-none focus:border-[var(--color-rose)]'

interface BookingsPanelProps {
  studio: string
  secret: string
  apiFetch: (path: string, options?: RequestInit) => Promise<Response>
  onUnauth: () => void
  onEditBooking: (booking: AdminBookingDTO) => void
}

export function BookingsPanel({
  studio,
  secret,
  apiFetch,
  onUnauth,
  onEditBooking,
}: BookingsPanelProps) {
  const t = useTranslations('admin')
  const tCommon = useTranslations('common')

  const [listDateFrom, setListDateFrom] = useState(todayString())
  const [listDateTo, setListDateTo] = useState(addDays(todayString(), 7))
  const [bookings, setBookings] = useState<AdminBookingDTO[]>([])
  const [bookingsMessage, setBookingsMessage] = useState<InlineMessage | null>(null)
  const [bookingsLoading, setBookingsLoading] = useState(false)
  const [cancellingId, setCancellingId] = useState<string | null>(null)

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
        onUnauth()
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

  useEffect(() => {
    loadBookings()
  }, [studio])

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
        onUnauth()
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

  return (
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
                        onClick={() => onEditBooking(booking)}
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
  )
}
