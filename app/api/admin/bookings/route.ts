import { NextRequest, NextResponse } from 'next/server'
import { verifyAdminRequest } from '@/lib/admin-auth'
import { supabaseAdmin } from '@/lib/supabase'
import { isNonEmptyString, studioExists } from '@/lib/validation'
import type { ApiError, AdminBookingDTO } from '@/lib/types'

const LOG_PREFIX = '[api/admin/bookings]'
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
const TZ = 'Asia/Jerusalem'

function isValidDateParam(str: string): boolean {
  if (!DATE_RE.test(str)) return false
  const [y, m, d] = str.split('-').map(Number)
  const probe = new Date(Date.UTC(y, m - 1, d))
  return (
    probe.getUTCFullYear() === y &&
    probe.getUTCMonth() + 1 === m &&
    probe.getUTCDate() === d
  )
}

function localToUTC(localISOLike: string): Date {
  const anchor = new Date(localISOLike + 'Z')
  const wallClock = new Date(anchor.toLocaleString('en-US', { timeZone: TZ }))
  const offsetMs = anchor.getTime() - wallClock.getTime()
  return new Date(anchor.getTime() + offsetMs)
}

function localDayToUTCBounds(dateStr: string): { start: Date; end: Date } {
  return {
    start: localToUTC(`${dateStr}T00:00:00`),
    end: localToUTC(`${dateStr}T23:59:59`),
  }
}

type RawBooking = {
  id: string
  studio_id: string
  service_id: string | null
  service_snapshot: Record<string, unknown>
  client_first_name: string
  client_last_name: string
  client_phone: string
  client_email: string
  comment: string | null
  marketing_consent: boolean
  status: string
  cancellation_token: string
  created_at: string
  updated_at: string
  booking_slots: Array<{ slot_id: string; slot: { start_at: string } | null }>
}

function rawToDTO(raw: RawBooking): AdminBookingDTO {
  const slotsWithTimes = (raw.booking_slots ?? [])
    .map((bs) => ({ slot_id: bs.slot_id, start_at: bs.slot?.start_at ?? '' }))
    .filter((s) => s.start_at)
    .sort((a, b) => a.start_at.localeCompare(b.start_at))

  const startAt = slotsWithTimes[0]?.start_at ?? ''
  const durationMs =
    typeof raw.service_snapshot.duration_minutes === 'number'
      ? raw.service_snapshot.duration_minutes * 60 * 1000
      : 0
  const endAt = startAt
    ? new Date(new Date(startAt).getTime() + durationMs).toISOString()
    : ''

  return {
    id: raw.id,
    studio_id: raw.studio_id,
    service_id: raw.service_id,
    service_snapshot: raw.service_snapshot,
    client_first_name: raw.client_first_name,
    client_last_name: raw.client_last_name,
    client_phone: raw.client_phone,
    client_email: raw.client_email,
    comment: raw.comment,
    marketing_consent: raw.marketing_consent,
    status: raw.status as AdminBookingDTO['status'],
    cancellation_token: raw.cancellation_token,
    slots: slotsWithTimes,
    start_at: startAt,
    end_at: endAt,
    created_at: raw.created_at,
    updated_at: raw.updated_at,
  }
}

// GET /api/admin/bookings?studio_id=&date_from=&date_to=
export async function GET(request: NextRequest): Promise<NextResponse> {
  if (!(await verifyAdminRequest(request))) {
    return NextResponse.json<ApiError>(
      { error: { code: 'UNAUTHORIZED', message: 'Invalid or missing X-Admin-Secret header.' } },
      { status: 401 },
    )
  }

  const { searchParams } = request.nextUrl
  const studioId = searchParams.get('studio_id') ?? ''
  const dateFrom = searchParams.get('date_from') ?? ''
  const dateTo = searchParams.get('date_to') ?? ''

  if (!isNonEmptyString(studioId) || !(await studioExists(studioId))) {
    return NextResponse.json<ApiError>(
      {
        error: {
          code: 'INVALID_PARAMS',
          message: "Query param 'studio_id' must be a valid studio ID.",
        },
      },
      { status: 400 },
    )
  }

  if (!isValidDateParam(dateFrom)) {
    return NextResponse.json<ApiError>(
      {
        error: {
          code: 'INVALID_PARAMS',
          message: "Query param 'date_from' must be a valid YYYY-MM-DD date.",
        },
      },
      { status: 400 },
    )
  }

  if (!isValidDateParam(dateTo)) {
    return NextResponse.json<ApiError>(
      {
        error: {
          code: 'INVALID_PARAMS',
          message: "Query param 'date_to' must be a valid YYYY-MM-DD date.",
        },
      },
      { status: 400 },
    )
  }

  if (dateTo < dateFrom) {
    return NextResponse.json<ApiError>(
      { error: { code: 'INVALID_PARAMS', message: "'date_to' must be >= 'date_from'." } },
      { status: 400 },
    )
  }

  const { start } = localDayToUTCBounds(dateFrom)
  const { end } = localDayToUTCBounds(dateTo)

  // Find slot IDs in the date range for this studio
  const { data: slotsData, error: slotsError } = await supabaseAdmin
    .from('slots')
    .select('id')
    .eq('studio_id', studioId)
    .gte('start_at', start.toISOString())
    .lte('start_at', end.toISOString())

  if (slotsError) {
    console.error(`${LOG_PREFIX} DB error fetching slots`, { slotsError })
    return NextResponse.json<ApiError>(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch slots.' } },
      { status: 500 },
    )
  }

  const slotIds = ((slotsData ?? []) as Array<{ id: string }>).map((s) => s.id)

  if (slotIds.length === 0) {
    return NextResponse.json<{ bookings: AdminBookingDTO[] }>({ bookings: [] })
  }

  // Find distinct booking IDs linked to those slots
  const { data: bookingSlotsData, error: bsError } = await supabaseAdmin
    .from('booking_slots')
    .select('booking_id')
    .in('slot_id', slotIds)

  if (bsError) {
    console.error(`${LOG_PREFIX} DB error fetching booking_slots`, { bsError })
    return NextResponse.json<ApiError>(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch booking slots.' } },
      { status: 500 },
    )
  }

  const bookingIds = [
    ...new Set(
      ((bookingSlotsData ?? []) as Array<{ booking_id: string }>).map((bs) => bs.booking_id),
    ),
  ]

  if (bookingIds.length === 0) {
    return NextResponse.json<{ bookings: AdminBookingDTO[] }>({ bookings: [] })
  }

  // Fetch full bookings with their slots
  const { data: bookingsData, error: bookingsError } = await supabaseAdmin
    .from('bookings')
    .select(
      `
      id, studio_id, service_id, service_snapshot,
      client_first_name, client_last_name, client_phone, client_email,
      comment, marketing_consent, status, cancellation_token,
      created_at, updated_at,
      booking_slots (
        slot_id,
        slot:slots!booking_slots_slot_id_fkey (start_at)
      )
    `,
    )
    .in('id', bookingIds)

  if (bookingsError) {
    console.error(`${LOG_PREFIX} DB error fetching bookings`, { bookingsError })
    return NextResponse.json<ApiError>(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch bookings.' } },
      { status: 500 },
    )
  }

  const bookings = ((bookingsData ?? []) as unknown as RawBooking[])
    .map(rawToDTO)
    .sort((a, b) => a.start_at.localeCompare(b.start_at))

  return NextResponse.json<{ bookings: AdminBookingDTO[] }>({ bookings })
}
