import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { createCalendarEvent } from '@/lib/google-calendar'

const LOG_PREFIX = '[api/internal/confirm-booking]'

// ---------------------------------------------------------------------------
// POST /api/internal/confirm-booking
// Internal endpoint — must only be called from the Telegram webhook handler.
// Protected by X-Internal-Secret header.
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest): Promise<NextResponse> {
  // 1. Verify internal secret
  const internalSecret = request.headers.get('X-Internal-Secret')
  if (internalSecret !== process.env.ADMIN_SECRET_KEY) {
    console.error(`${LOG_PREFIX} Unauthorized request — invalid internal secret`)
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // 2. Parse body
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

  // 3. Fetch booking with slot times and studio info
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
      google_calendar_event_id,
      slot:slots!bookings_slot_id_fkey (
        start_at,
        end_at
      )
    `,
    )
    .eq('id', booking_id)
    .maybeSingle()

  if (fetchError) {
    console.error(`${LOG_PREFIX} DB error fetching booking`, {
      booking_id,
      error: fetchError,
    })
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
    google_calendar_event_id: string | null
    slot: { start_at: string; end_at: string } | null
  }

  // 4. Guard: booking must be CONFIRMED
  if (raw.status !== 'CONFIRMED') {
    return NextResponse.json(
      { error: `Booking is not in CONFIRMED state (current: ${raw.status}).` },
      { status: 400 },
    )
  }

  if (!raw.slot) {
    console.error(`${LOG_PREFIX} Booking has no linked slot`, { booking_id })
    return NextResponse.json({ error: 'Booking has no linked slot.' }, { status: 500 })
  }

  // 5. Idempotency: skip if Google Calendar event already created
  if (raw.google_calendar_event_id) {
    return NextResponse.json(
      { success: true, event_id: raw.google_calendar_event_id },
      { status: 200 },
    )
  }

  // 6. Create Google Calendar event
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
        start_at: raw.slot.start_at,
        end_at: raw.slot.end_at,
      },
    })
  } catch (calendarErr) {
    // Calendar failure must NOT roll back the booking confirmation
    console.error(`${LOG_PREFIX} Google Calendar API error`, {
      booking_id,
      error: calendarErr,
    })
    return NextResponse.json(
      { error: 'Failed to create Google Calendar event.' },
      { status: 500 },
    )
  }

  // 7. Persist the calendar event ID
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
    // Return success anyway — the event was created and booking is confirmed.
    // The missing event_id will be visible in logs for manual reconciliation.
  }

  return NextResponse.json({ success: true, event_id: eventId }, { status: 200 })
}
