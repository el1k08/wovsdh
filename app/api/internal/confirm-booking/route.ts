import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { createCalendarEvent } from '@/lib/google-calendar'
import { sendWhatsAppMessage } from '@/lib/whatsapp'

const LOG_PREFIX = '[api/internal/confirm-booking]'

const TZ = 'Asia/Jerusalem'

// POST /api/internal/confirm-booking
// Internal endpoint — must only be called from the Telegram webhook handler.
// Protected by X-Internal-Secret header.
export async function POST(request: NextRequest): Promise<NextResponse> {
  const internalSecret = request.headers.get('X-Internal-Secret')
  if (internalSecret !== process.env.ADMIN_SECRET_KEY) {
    console.error(`${LOG_PREFIX} Unauthorized request — invalid internal secret`)
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Request body must be valid JSON.' }, { status: 400 })
  }

  if (typeof body !== 'object' || body === null) {
    return NextResponse.json({ error: 'Request body must be a JSON object.' }, { status: 400 })
  }

  const { booking_id } = body as Record<string, unknown>

  if (typeof booking_id !== 'string' || !booking_id.trim()) {
    return NextResponse.json({ error: "'booking_id' is required." }, { status: 400 })
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
      client_email,
      status,
      cancellation_token,
      google_calendar_event_id,
      service_snapshot,
      studio:studios!bookings_studio_id_fkey (name),
      booking_slots (
        slot:slots!booking_slots_slot_id_fkey (start_at)
      )
    `,
    )
    .eq('id', booking_id)
    .maybeSingle()

  if (fetchError) {
    console.error(`${LOG_PREFIX} DB error fetching booking`, { booking_id, error: fetchError })
    return NextResponse.json({ error: 'Failed to fetch booking.' }, { status: 500 })
  }

  if (!bookingData) {
    return NextResponse.json({ error: 'Booking not found.' }, { status: 400 })
  }

  const raw = bookingData as unknown as {
    id: string
    studio_id: string
    client_first_name: string
    client_last_name: string
    client_phone: string
    client_email: string
    status: string
    cancellation_token: string
    google_calendar_event_id: string | null
    service_snapshot: Record<string, unknown>
    studio: { name: string } | null
    booking_slots: Array<{ slot: { start_at: string } | null }>
  }

  if (raw.status !== 'CONFIRMED') {
    return NextResponse.json(
      { error: `Booking is not in CONFIRMED state (current: ${raw.status}).` },
      { status: 400 },
    )
  }

  const slotRows = raw.booking_slots ?? []
  const startAts = slotRows
    .map((bs) => bs.slot?.start_at)
    .filter((s): s is string => typeof s === 'string')
    .sort()

  const startAt = startAts[0] ?? null

  if (!startAt) {
    console.error(`${LOG_PREFIX} Booking has no linked slots`, { booking_id })
    return NextResponse.json({ error: 'Booking has no linked slots.' }, { status: 500 })
  }

  const snapshot = raw.service_snapshot
  const durationMs = (snapshot.duration_minutes as number) * 60 * 1000
  const endAt = new Date(new Date(startAt).getTime() + durationMs).toISOString()

  // Idempotency: skip if Google Calendar event already created
  if (raw.google_calendar_event_id) {
    return NextResponse.json(
      { success: true, event_id: raw.google_calendar_event_id },
      { status: 200 },
    )
  }

  let eventId: string
  try {
    eventId = await createCalendarEvent({
      studioId: raw.studio_id,
      booking: {
        id: raw.id,
        client_first_name: raw.client_first_name,
        client_last_name: raw.client_last_name,
        client_phone: raw.client_phone,
        client_email: raw.client_email,
        start_at: startAt,
        end_at: endAt,
      },
    })
  } catch (calendarErr) {
    // Calendar failure must NOT roll back the booking confirmation
    console.error(`${LOG_PREFIX} Google Calendar API error`, { booking_id, error: calendarErr })
    return NextResponse.json({ error: 'Failed to create Google Calendar event.' }, { status: 500 })
  }

  const { error: updateError } = await supabaseAdmin
    .from('bookings')
    .update({ google_calendar_event_id: eventId })
    .eq('id', booking_id)

  if (updateError) {
    console.error(`${LOG_PREFIX} Failed to save google_calendar_event_id`, {
      booking_id,
      event_id: eventId,
      error: updateError,
    })
    // Return success — event was created and booking is confirmed.
    // Missing event_id visible in logs for manual reconciliation.
  }

  // Send WhatsApp confirmation (fire-and-forget)
  const studioName = raw.studio?.name ?? raw.studio_id
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

  const dateFormatter = new Intl.DateTimeFormat('ru-IL', {
    timeZone: TZ,
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
  const timeFormatter = new Intl.DateTimeFormat('ru-IL', {
    timeZone: TZ,
    hour: '2-digit',
    minute: '2-digit',
  })

  const startDate = new Date(startAt)
  const dateStr = dateFormatter.format(startDate)
  const timeStr = timeFormatter.format(startDate)

  const whatsAppMessage =
    `✅ Ваша запись подтверждена!\n` +
    `Студия: ${studioName}\n` +
    `Дата: ${dateStr} ${timeStr}\n` +
    `До встречи!\n` +
    `Отменить запись: ${appUrl}/cancel?token=${raw.cancellation_token}`

  sendWhatsAppMessage({ to: raw.client_phone, body: whatsAppMessage }).catch((err: unknown) =>
    console.error(`${LOG_PREFIX} WhatsApp confirmation failed`, { booking_id, error: err }),
  )

  // Trigger confirmation email (fire-and-forget via internal endpoint)
  fetch(`${appUrl}/api/internal/send-confirmation-email`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Internal-Secret': process.env.ADMIN_SECRET_KEY ?? '',
    },
    body: JSON.stringify({ booking_id }),
  }).catch((err: unknown) =>
    console.error(`${LOG_PREFIX} send-confirmation-email call failed`, { booking_id, err }),
  )

  return NextResponse.json({ success: true, event_id: eventId }, { status: 200 })
}
