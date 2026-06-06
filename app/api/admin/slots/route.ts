import { NextRequest, NextResponse } from 'next/server'
import { verifyAdminRequest } from '@/lib/admin-auth'
import { supabaseAdmin } from '@/lib/supabase'
import { isNonEmptyString, studioExists } from '@/lib/validation'
import type {
  ApiError,
  AdminSlotDTO,
  GetAdminSlotsResponse,
} from '@/lib/types'
import { BookingStatus, SlotStatus } from '@/lib/types'

const LOG_PREFIX = '[api/admin/slots]'

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

function requireAdminAuth(request: NextRequest): boolean {
  const secret = request.headers.get('X-Admin-Secret')
  return secret === process.env.ADMIN_SECRET_KEY
}

const TZ = 'Asia/Jerusalem'

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

// ---------------------------------------------------------------------------
// GET /api/admin/slots?studio_id=&date_from=&date_to=
// ---------------------------------------------------------------------------

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
      {
        error: {
          code: 'INVALID_PARAMS',
          message: "'date_to' must be >= 'date_from'.",
        },
      },
      { status: 400 },
    )
  }

  const { start } = localDayToUTCBounds(dateFrom)
  const { end } = localDayToUTCBounds(dateTo)

  const { data: slotsData, error: slotsError } = await supabaseAdmin
    .from('slots')
    .select('id, studio_id, start_at, status')
    .eq('studio_id', studioId)
    .gte('start_at', start.toISOString())
    .lt('start_at', end.toISOString())
    .order('start_at', { ascending: true })

  if (slotsError) {
    console.error(`${LOG_PREFIX} DB error fetching slots`, { studio_id: studioId, slotsError })
    return NextResponse.json<ApiError>(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch slots.' } },
      { status: 500 },
    )
  }

  const slots = (slotsData ?? []) as Array<{
    id: string
    studio_id: string
    start_at: string
    status: string
  }>

  if (slots.length === 0) {
    return NextResponse.json<GetAdminSlotsResponse>({ slots: [] })
  }

  const slotIds = slots.map((s) => s.id)

  // Fetch active bookings via the booking_slots junction table
  const { data: bookingSlotsData, error: bookingSlotsError } = await supabaseAdmin
    .from('booking_slots')
    .select(
      `
      slot_id,
      booking:bookings!booking_slots_booking_id_fkey (id, client_first_name, client_last_name, status)
    `,
    )
    .in('slot_id', slotIds)

  if (bookingSlotsError) {
    console.error(`${LOG_PREFIX} DB error fetching booking_slots`, { bookingSlotsError })
    return NextResponse.json<ApiError>(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch bookings.' } },
      { status: 500 },
    )
  }

  const bookingBySlotId = new Map<
    string,
    { id: string; client_first_name: string; client_last_name: string; status: BookingStatus }
  >()

  for (const bs of (bookingSlotsData ?? []) as unknown as Array<{
    slot_id: string
    booking: { id: string; client_first_name: string; client_last_name: string; status: string } | null
  }>) {
    if (!bs.booking || bs.booking.status === BookingStatus.Cancelled) continue
    if (!bookingBySlotId.has(bs.slot_id)) {
      bookingBySlotId.set(bs.slot_id, {
        id: bs.booking.id,
        client_first_name: bs.booking.client_first_name,
        client_last_name: bs.booking.client_last_name,
        status: bs.booking.status as BookingStatus,
      })
    }
  }

  const result: AdminSlotDTO[] = slots.map((s) => {
    const dto: AdminSlotDTO = {
      id: s.id,
      studio_id: s.studio_id,
      start_at: s.start_at,
      status: s.status as SlotStatus,
    }
    const booking = bookingBySlotId.get(s.id)
    if (booking) {
      dto.booking = booking
    }
    return dto
  })

  return NextResponse.json<GetAdminSlotsResponse>({ slots: result })
}
