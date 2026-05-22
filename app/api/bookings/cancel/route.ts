import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { deleteCalendarEvent } from '@/lib/google-calendar'
import { notifyAllStaffCancellation } from '@/lib/telegram'
import { sendWhatsAppMessage } from '@/lib/whatsapp'
import { BookingStatus } from '@/lib/types'
import type { ApiError, CancelBookingResponse } from '@/lib/types'

const LOG_PREFIX = '[api/bookings/cancel]'

const TZ = 'Asia/Jerusalem'

// POST /api/bookings/cancel
export async function POST(request: NextRequest): Promise<NextResponse> {
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

  const { data: bookingData, error: fetchError } = await supabaseAdmin
    .from('bookings')
    .select(
      `
      id,
      studio_id,
      client_first_name,
      client_last_name,
      client_phone,
      status,
      google_calendar_event_id,
      studio:studios!bookings_studio_id_fkey (name),
      booking_slots (
        slot:slots!booking_slots_slot_id_fkey (start_at)
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

  if (!bookingData) {
    return NextResponse.json<ApiError>(
      { error: { code: 'BOOKING_NOT_FOUND', message: 'Booking not found.' } },
      { status: 404 },
    )
  }

  const raw = bookingData as unknown as {
    id: string
    studio_id: string
    client_first_name: string
    client_last_name: string
    client_phone: string
    status: string
    google_calendar_event_id: string | null
    studio: { name: string } | null
    booking_slots: Array<{ slot: { start_at: string } | null }>
  }

  if (raw.status === 'CANCELLED') {
    return NextResponse.json<ApiError>(
      { error: { code: 'ALREADY_CANCELLED', message: 'This booking has already been cancelled.' } },
      { status: 400 },
    )
  }

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
      // Cancellation must proceed even if the calendar event deletion fails
    }
  }

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

  // Release all atomic slots back to 'available'
  const { error: releaseError } = await supabaseAdmin.client.rpc('release_booking_slots', {
    p_booking_id: raw.id,
  })

  if (releaseError) {
    console.error(`${LOG_PREFIX} RPC error release_booking_slots`, {
      booking_id: raw.id,
      error: releaseError,
    })
    // Non-critical: slots will remain booked but no new booking can reference them
    // after the booking record is CANCELLED. Log for manual reconciliation.
  }

  const slotRows = raw.booking_slots ?? []
  const startAts = slotRows
    .map((bs) => bs.slot?.start_at)
    .filter((s): s is string => typeof s === 'string')
    .sort()

  const startAt = startAts[0] ?? null

  const dateTimeFormatter = new Intl.DateTimeFormat('uk-IL', {
    timeZone: TZ,
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })

  const startFormatted = startAt
    ? dateTimeFormatter.format(new Date(startAt))
    : 'невідомо'

  const studioName = raw.studio?.name ?? raw.studio_id
  const clientName = `${raw.client_first_name} ${raw.client_last_name}`

  const telegramMessage =
    `⚠️ Запис скасовано клієнтом!\n\n` +
    `👤 ${clientName}\n` +
    `📅 ${startFormatted}\n` +
    `🏢 ${studioName}`

  notifyAllStaffCancellation(telegramMessage).catch((err: unknown) =>
    console.error(`${LOG_PREFIX} Failed to notify staff of cancellation`, {
      booking_id: raw.id,
      error: err,
    }),
  )

  const whatsAppMessage =
    `⚠️ Ваш запис скасовано.\n` +
    `Клієнт: ${clientName}\n` +
    `Дата: ${startFormatted}\n` +
    `Студія: ${studioName}`

  sendWhatsAppMessage({ to: raw.client_phone, body: whatsAppMessage }).catch((err: unknown) =>
    console.error(`${LOG_PREFIX} WhatsApp notification failed`, {
      booking_id: raw.id,
      error: err,
    }),
  )

  return NextResponse.json<CancelBookingResponse>({
    message: 'Запис скасовано',
    booking: {
      id: raw.id,
      status: BookingStatus.Cancelled,
      cancelled_at: cancelledAt,
    },
  })
}
