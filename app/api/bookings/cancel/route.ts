import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { deleteCalendarEvent } from '@/lib/google-calendar'
import { notifyAllStaffCancellation } from '@/lib/telegram'
import { BookingStatus } from '@/lib/types'
import type { ApiError, CancelBookingResponse } from '@/lib/types'

const LOG_PREFIX = '[api/bookings/cancel]'

// ---------------------------------------------------------------------------
// POST /api/bookings/cancel
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest): Promise<NextResponse> {
  // 1. Parse body
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json<ApiError>(
      { error: { code: 'INVALID_PARAMS', message: 'Request body must be valid JSON.' } },
      { status: 400 },
    )
  }

  if (typeof body !== 'object' || body === null) {
    return NextResponse.json<ApiError>(
      { error: { code: 'INVALID_PARAMS', message: 'Request body must be a JSON object.' } },
      { status: 400 },
    )
  }

  const { token } = body as Record<string, unknown>

  if (typeof token !== 'string' || !token.trim()) {
    return NextResponse.json<ApiError>(
      { error: { code: 'INVALID_PARAMS', message: "'token' is required." } },
      { status: 400 },
    )
  }

  // 2. Find booking by cancellation token (join slot and studio for notification message)
  const { data: bookingData, error: fetchError } = await supabaseAdmin
    .from('bookings')
    .select(
      `
      id,
      slot_id,
      studio_id,
      client_first_name,
      client_last_name,
      status,
      google_calendar_event_id,
      slot:slots!bookings_slot_id_fkey (
        start_at,
        end_at
      ),
      studio:studios!bookings_studio_id_fkey (
        name
      )
    `,
    )
    .eq('cancellation_token', token.trim())
    .maybeSingle()

  if (fetchError) {
    console.error(`${LOG_PREFIX} DB error fetching booking by cancellation token`, {
      error: fetchError,
    })
    return NextResponse.json<ApiError>(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to look up booking.' } },
      { status: 500 },
    )
  }

  // 3. Not found
  if (!bookingData) {
    return NextResponse.json<ApiError>(
      { error: { code: 'BOOKING_NOT_FOUND', message: 'Booking not found.' } },
      { status: 404 },
    )
  }

  const raw = bookingData as unknown as {
    id: string
    slot_id: string
    studio_id: string
    client_first_name: string
    client_last_name: string
    status: string
    google_calendar_event_id: string | null
    slot: { start_at: string; end_at: string } | null
    studio: { name: string } | null
  }

  // 4. Already cancelled
  if (raw.status === 'CANCELLED') {
    return NextResponse.json<ApiError>(
      { error: { code: 'ALREADY_CANCELLED', message: 'This booking has already been cancelled.' } },
      { status: 400 },
    )
  }

  // 5. Delete Google Calendar event if one was created
  if (raw.google_calendar_event_id) {
    try {
      await deleteCalendarEvent({
        studioId: raw.studio_id,
        eventId: raw.google_calendar_event_id,
      })
    } catch (calendarErr) {
      console.error(`${LOG_PREFIX} Failed to delete Google Calendar event`, {
        booking_id: raw.id,
        event_id: raw.google_calendar_event_id,
        error: calendarErr,
      })
      // Do not abort the cancellation — the booking must still be cancelled
      // even if the calendar event deletion fails.
    }
  }

  // 6. Mark booking as CANCELLED
  const cancelledAt = new Date().toISOString()

  const { error: cancelError } = await supabaseAdmin
    .from('bookings')
    .update({ status: 'CANCELLED', cancelled_at: cancelledAt })
    .eq('id', raw.id)

  if (cancelError) {
    console.error(`${LOG_PREFIX} DB error cancelling booking`, {
      booking_id: raw.id,
      error: cancelError,
    })
    return NextResponse.json<ApiError>(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to cancel booking.' } },
      { status: 500 },
    )
  }

  // 7. Free up the slot
  const { error: slotError } = await supabaseAdmin
    .from('slots')
    .update({ status: 'available' })
    .eq('id', raw.slot_id)

  if (slotError) {
    console.error(`${LOG_PREFIX} Failed to restore slot to available`, {
      booking_id: raw.id,
      slot_id: raw.slot_id,
      error: slotError,
    })
    // Non-critical: slot will remain 'booked' but the unique index prevents
    // double-booking. Log for manual reconciliation and continue.
  }

  // 8. Notify staff via Telegram (fire-and-forget)
  const tz = 'Asia/Jerusalem'

  const dateTimeFormatter = new Intl.DateTimeFormat('ru-IL', {
    timeZone: tz,
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })

  const startFormatted =
    raw.slot ? dateTimeFormatter.format(new Date(raw.slot.start_at)) : 'неизвестно'

  const studioName = raw.studio?.name ?? raw.studio_id
  const clientName = `${raw.client_first_name} ${raw.client_last_name}`

  const cancellationMessage =
    `⚠️ Запись отменена клиентом!\n\n` +
    `👤 ${clientName}\n` +
    `📅 ${startFormatted}\n` +
    `🏢 ${studioName}`

  notifyAllStaffCancellation(cancellationMessage).catch((err: unknown) =>
    console.error(`${LOG_PREFIX} Failed to notify staff of cancellation`, {
      booking_id: raw.id,
      error: err,
    }),
  )

  // 9. Return response
  return NextResponse.json<CancelBookingResponse>({
    message: 'Бронирование отменено',
    booking: {
      id: raw.id,
      status: BookingStatus.Cancelled,
      cancelled_at: cancelledAt,
    },
  })
}
