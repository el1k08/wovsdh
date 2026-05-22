import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { BookingStatus } from '@/lib/types'

const LOG_PREFIX = '[api/calendar/ics]'

function toIcsDate(isoUtc: string): string {
  return new Date(isoUtc)
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d{3}/, '')
}

// GET /api/calendar/ics?booking_id={uuid}
export async function GET(request: NextRequest): Promise<NextResponse> {
  const bookingId = request.nextUrl.searchParams.get('booking_id')

  if (!bookingId) {
    return NextResponse.json(
      { error: { code: 'INVALID_PARAMS', message: "'booking_id' query param is required." } },
      { status: 400 },
    )
  }

  const { data, error } = await supabaseAdmin
    .from('bookings')
    .select(
      `
      id,
      status,
      service_snapshot,
      studio:studios!bookings_studio_id_fkey (name, city),
      booking_slots (
        slot:slots!booking_slots_slot_id_fkey (start_at)
      )
    `,
    )
    .eq('id', bookingId)
    .maybeSingle()

  if (error) {
    console.error(`${LOG_PREFIX} DB error fetching booking`, { booking_id: bookingId, error })
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

  const raw = data as unknown as {
    id: string
    status: BookingStatus
    service_snapshot: Record<string, unknown>
    studio: { name: string; city: string } | null
    booking_slots: Array<{ slot: { start_at: string } | null }>
  }

  if (raw.status !== BookingStatus.Confirmed) {
    return NextResponse.json(
      { error: { code: 'BOOKING_NOT_FOUND', message: 'Booking not found or not confirmed.' } },
      { status: 404 },
    )
  }

  if (!raw.studio) {
    console.error(`${LOG_PREFIX} Booking has no linked studio`, { booking_id: bookingId })
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Booking data incomplete.' } },
      { status: 500 },
    )
  }

  const slotRows = raw.booking_slots ?? []
  const startAts = slotRows
    .map((bs) => bs.slot?.start_at)
    .filter((s): s is string => typeof s === 'string')
    .sort()

  const startAt = startAts[0] ?? null

  if (!startAt) {
    console.error(`${LOG_PREFIX} Booking has no linked slots`, { booking_id: bookingId })
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Booking data incomplete.' } },
      { status: 500 },
    )
  }

  const snapshot = raw.service_snapshot
  const durationMs = (snapshot.duration_minutes as number) * 60 * 1000
  const endAt = new Date(new Date(startAt).getTime() + durationMs).toISOString()

  const nowUtc = toIcsDate(new Date().toISOString())
  const startUtc = toIcsDate(startAt)
  const endUtc = toIcsDate(endAt)

  const icsContent = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//WOVSDH Nails//UK',
    'BEGIN:VEVENT',
    `UID:${raw.id}@wovsdh-nails`,
    `DTSTAMP:${nowUtc}`,
    `DTSTART:${startUtc}`,
    `DTEND:${endUtc}`,
    'SUMMARY:Запис у WOVSDH Nails',
    `DESCRIPTION:Студія: ${raw.studio.name}`,
    `LOCATION:${raw.studio.city}`,
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n')

  return new NextResponse(icsContent, {
    status: 200,
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': 'attachment; filename="booking.ics"',
    },
  })
}
