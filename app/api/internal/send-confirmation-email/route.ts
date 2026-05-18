import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { sendBookingConfirmation } from '@/lib/email'
import { BookingStatus } from '@/lib/types'

const LOG_PREFIX = '[api/internal/send-confirmation-email]'

// ---------------------------------------------------------------------------
// POST /api/internal/send-confirmation-email
// Internal endpoint — called from confirm-booking after Google Calendar event
// creation. Protected by X-Internal-Secret header.
//
// Request body: { booking_id: string }
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

  // 3. Fetch booking with slot and studio data
  const { data: bookingData, error: fetchError } = await supabaseAdmin
    .from('bookings')
    .select(
      `
      id,
      status,
      client_first_name,
      client_email,
      cancellation_token,
      slot:slots!bookings_slot_id_fkey (
        start_at,
        end_at
      ),
      studio:studios!bookings_studio_id_fkey (
        name
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
    return NextResponse.json({ error: 'Booking not found.' }, { status: 404 })
  }

  const raw = bookingData as unknown as {
    id: string
    status: BookingStatus
    client_first_name: string
    client_email: string
    cancellation_token: string
    slot: { start_at: string; end_at: string } | null
    studio: { name: string } | null
  }

  // 4. Guard: must be CONFIRMED
  if (raw.status !== BookingStatus.Confirmed) {
    return NextResponse.json(
      { error: `Booking is not in CONFIRMED state (current: ${raw.status}).` },
      { status: 400 },
    )
  }

  if (!raw.slot || !raw.studio) {
    console.error(`${LOG_PREFIX} Booking has no linked slot or studio`, { booking_id })
    return NextResponse.json({ error: 'Booking data incomplete.' }, { status: 500 })
  }

  // 5. Send confirmation email
  try {
    await sendBookingConfirmation({
      to: raw.client_email,
      clientName: raw.client_first_name,
      studioName: raw.studio.name,
      startAt: raw.slot.start_at,
      endAt: raw.slot.end_at,
      cancellationToken: raw.cancellation_token,
      bookingId: raw.id,
    })
  } catch (emailErr) {
    // Error is already logged and persisted to email_logs inside sendBookingConfirmation.
    // We still return an error status so callers can retry or alert.
    console.error(`${LOG_PREFIX} Email send failed`, { booking_id })
    return NextResponse.json({ error: 'Failed to send confirmation email.' }, { status: 500 })
  }

  return NextResponse.json({ success: true }, { status: 200 })
}
