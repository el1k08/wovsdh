import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { BookingStatus } from '@/lib/types'

const LOG_PREFIX = '[api/calendar/ics]'

// ---------------------------------------------------------------------------
// Date formatter: YYYYMMDDTHHmmssZ (UTC basic format for iCalendar)
// ---------------------------------------------------------------------------

function toIcsDate(isoUtc: string): string {
  return new Date(isoUtc)
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d{3}/, '')
}

// ---------------------------------------------------------------------------
// GET /api/calendar/ics?booking_id={uuid}
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest): Promise<NextResponse> {
  const bookingId = request.nextUrl.searchParams.get('booking_id')

  if (!bookingId) {
    return NextResponse.json(
      { error: { code: 'INVALID_PARAMS', message: "'booking_id' query param is required." } },
      { status: 400 },
    )
  }

  // 1. Fetch booking with slot and studio data
  const { data, error } = await supabaseAdmin
    .from('bookings')
    .select(
      `
      id,
      status,
      slot:slots!bookings_slot_id_fkey (
        start_at,
        end_at
      ),
      studio:studios!bookings_studio_id_fkey (
        name,
        city
      )
    `,
    )
    .eq('id', bookingId)
    .maybeSingle()

  if (error) {
    console.error(`${LOG_PREFIX} DB error fetching booking`, {
      booking_id: bookingId,
      error,
    })
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch booking.' } },
      { status: 500 },
    )
  }

  if (!data) {
    return NextResponse.json(
      { error: { code: 'BOOKING_NOT_FOUND', message: 'Booking not found.' } },
      { status: 404 },
    )
  }

  // 2. Type-cast joined rows
  const raw = data as unknown as {
    id: string
    status: BookingStatus
    slot: { start_at: string; end_at: string } | null
    studio: { name: string; city: string } | null
  }

  // 3. Only allow confirmed bookings to download .ics
  if (raw.status !== BookingStatus.Confirmed) {
    return NextResponse.json(
      { error: { code: 'BOOKING_NOT_FOUND', message: 'Booking not found or not confirmed.' } },
      { status: 404 },
    )
  }

  if (!raw.slot || !raw.studio) {
    console.error(`${LOG_PREFIX} Booking has no linked slot or studio`, { booking_id: bookingId })
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Booking data incomplete.' } },
      { status: 500 },
    )
  }

  // 4. Build .ics content
  const nowUtc = toIcsDate(new Date().toISOString())
  const startUtc = toIcsDate(raw.slot.start_at)
  const endUtc = toIcsDate(raw.slot.end_at)

  const icsContent = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//WOVSDH Nails//RU',
    'BEGIN:VEVENT',
    `UID:${raw.id}@wovsdh-nails`,
    `DTSTAMP:${nowUtc}`,
    `DTSTART:${startUtc}`,
    `DTEND:${endUtc}`,
    'SUMMARY:Запись в WOVSDH Nails',
    `DESCRIPTION:Студия: ${raw.studio.name}`,
    `LOCATION:${raw.studio.city}`,
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n')

  // 5. Return with calendar headers
  return new NextResponse(icsContent, {
    status: 200,
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': 'attachment; filename="booking.ics"',
    },
  })
}
