import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { isValidStudioId } from '@/lib/validation'
import type {
  ApiError,
  AdminSlotDTO,
  SlotDTO,
  GetAdminSlotsResponse,
  GenerateSlotsResponse,
  GenerateSlotsRequest,
} from '@/lib/types'
import { BookingStatus, SlotStatus } from '@/lib/types'

const LOG_PREFIX = '[api/admin/slots]'

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
const TIME_RE = /^\d{2}:\d{2}$/

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------

function requireAdminAuth(request: NextRequest): boolean {
  const secret = request.headers.get('X-Admin-Secret')
  return secret === process.env.ADMIN_SECRET_KEY
}

// ---------------------------------------------------------------------------
// Timezone helpers (same strategy as /api/slots)
// ---------------------------------------------------------------------------

const TZ = 'Asia/Jerusalem'

/**
 * Converts a local date+time string (YYYY-MM-DDTHH:mm) expressed in
 * Asia/Jerusalem into a UTC Date object.
 */
function localToUTC(localISOLike: string): Date {
  const anchor = new Date(localISOLike + 'Z')
  const wallClock = new Date(anchor.toLocaleString('en-US', { timeZone: TZ }))
  const offsetMs = anchor.getTime() - wallClock.getTime()
  return new Date(anchor.getTime() + offsetMs)
}

/**
 * Returns UTC start and end boundaries for a full local day
 * (start = 00:00:00, end = next day 00:00:00 so we can use < end).
 */
function localDayToUTCBounds(dateStr: string): { start: Date; end: Date } {
  return {
    start: localToUTC(`${dateStr}T00:00:00`),
    end: localToUTC(`${dateStr}T23:59:59`),
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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

function isValidTimeParam(str: string): boolean {
  if (!TIME_RE.test(str)) return false
  const [h, min] = str.split(':').map(Number)
  return h >= 0 && h <= 23 && min >= 0 && min <= 59
}

// ---------------------------------------------------------------------------
// GET /api/admin/slots?studio_id=&date_from=&date_to=
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest): Promise<NextResponse> {
  if (!requireAdminAuth(request)) {
    return NextResponse.json<ApiError>(
      { error: { code: 'UNAUTHORIZED', message: 'Invalid or missing X-Admin-Secret header.' } },
      { status: 401 },
    )
  }

  const { searchParams } = request.nextUrl
  const studioId = searchParams.get('studio_id') ?? ''
  const dateFrom = searchParams.get('date_from') ?? ''
  const dateTo = searchParams.get('date_to') ?? ''

  if (!isValidStudioId(studioId)) {
    return NextResponse.json<ApiError>(
      {
        error: {
          code: 'INVALID_PARAMS',
          message: "Query param 'studio_id' must be 'rishon' or 'ashdod'.",
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

  // Supabase does not support arbitrary JOIN syntax, so we use .select() with
  // a foreign-table embed and filter afterwards.
  // Strategy: fetch slots, then fetch active bookings for those slots in one
  // additional query, and merge in memory.
  const { data: slotsData, error: slotsError } = await supabaseAdmin
    .from('slots')
    .select('id, studio_id, start_at, end_at, status')
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
    end_at: string
    status: string
  }>

  if (slots.length === 0) {
    return NextResponse.json<GetAdminSlotsResponse>({ slots: [] })
  }

  const slotIds = slots.map((s) => s.id)

  const { data: bookingsData, error: bookingsError } = await supabaseAdmin
    .from('bookings')
    .select('id, slot_id, client_first_name, client_last_name, status')
    .in('slot_id', slotIds)
    .neq('status', BookingStatus.Cancelled)

  if (bookingsError) {
    console.error(`${LOG_PREFIX} DB error fetching bookings`, { bookingsError })
    return NextResponse.json<ApiError>(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch bookings.' } },
      { status: 500 },
    )
  }

  const bookingBySlotId = new Map<
    string,
    { id: string; client_first_name: string; client_last_name: string; status: BookingStatus }
  >()

  for (const b of bookingsData ?? []) {
    const row = b as {
      id: string
      slot_id: string
      client_first_name: string
      client_last_name: string
      status: string
    }
    bookingBySlotId.set(row.slot_id, {
      id: row.id,
      client_first_name: row.client_first_name,
      client_last_name: row.client_last_name,
      status: row.status as BookingStatus,
    })
  }

  const result: AdminSlotDTO[] = slots.map((s) => {
    const dto: AdminSlotDTO = {
      id: s.id,
      studio_id: s.studio_id,
      start_at: s.start_at,
      end_at: s.end_at,
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

// ---------------------------------------------------------------------------
// POST /api/admin/slots — generate slots
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest): Promise<NextResponse> {
  if (!requireAdminAuth(request)) {
    return NextResponse.json<ApiError>(
      { error: { code: 'UNAUTHORIZED', message: 'Invalid or missing X-Admin-Secret header.' } },
      { status: 401 },
    )
  }

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

  const {
    studio_id,
    date,
    slot_duration_minutes,
    start_time,
    end_time,
  } = body as Record<string, unknown>

  const validationErrors: string[] = []

  if (typeof studio_id !== 'string' || !isValidStudioId(studio_id)) {
    validationErrors.push("'studio_id' must be 'rishon' or 'ashdod'.")
  }
  if (typeof date !== 'string' || !isValidDateParam(date)) {
    validationErrors.push("'date' must be a valid YYYY-MM-DD date.")
  }
  if (
    typeof slot_duration_minutes !== 'number' ||
    !Number.isInteger(slot_duration_minutes) ||
    slot_duration_minutes < 15 ||
    slot_duration_minutes > 240
  ) {
    validationErrors.push("'slot_duration_minutes' must be an integer between 15 and 240.")
  }
  if (typeof start_time !== 'string' || !isValidTimeParam(start_time)) {
    validationErrors.push("'start_time' must be a valid HH:mm time string.")
  }
  if (typeof end_time !== 'string' || !isValidTimeParam(end_time)) {
    validationErrors.push("'end_time' must be a valid HH:mm time string.")
  }

  if (validationErrors.length > 0) {
    return NextResponse.json<ApiError>(
      { error: { code: 'INVALID_PARAMS', message: validationErrors.join(' ') } },
      { status: 400 },
    )
  }

  // All validated — narrow types
  const req = body as GenerateSlotsRequest

  if (req.start_time >= req.end_time) {
    return NextResponse.json<ApiError>(
      {
        error: {
          code: 'INVALID_PARAMS',
          message: "'start_time' must be earlier than 'end_time'.",
        },
      },
      { status: 400 },
    )
  }

  // --- Generate time slots ------------------------------------------------
  //
  // Parse start/end as minutes-since-midnight, then iterate by duration.

  const parseMinutes = (hhmm: string): number => {
    const [h, m] = hhmm.split(':').map(Number)
    return h * 60 + m
  }

  const startMinutes = parseMinutes(req.start_time)
  const endMinutes = parseMinutes(req.end_time)
  const duration = req.slot_duration_minutes

  type SlotCandidate = { start_at: Date; end_at: Date }
  const candidates: SlotCandidate[] = []

  for (let cursor = startMinutes; cursor + duration <= endMinutes; cursor += duration) {
    const slotEndCursor = cursor + duration
    const hh = String(Math.floor(cursor / 60)).padStart(2, '0')
    const mm = String(cursor % 60).padStart(2, '0')
    const endHH = String(Math.floor(slotEndCursor / 60)).padStart(2, '0')
    const endMM = String(slotEndCursor % 60).padStart(2, '0')

    candidates.push({
      start_at: localToUTC(`${req.date}T${hh}:${mm}:00`),
      end_at: localToUTC(`${req.date}T${endHH}:${endMM}:00`),
    })
  }

  if (candidates.length === 0) {
    return NextResponse.json<ApiError>(
      {
        error: {
          code: 'INVALID_PARAMS',
          message: 'No slots can be generated for the given time range and duration.',
        },
      },
      { status: 400 },
    )
  }

  // --- Check for existing slots to avoid duplicates -----------------------
  const startUTC = candidates[0].start_at.toISOString()
  const endUTC = candidates[candidates.length - 1].end_at.toISOString()

  const { data: existingData, error: existingError } = await supabaseAdmin
    .from('slots')
    .select('start_at')
    .eq('studio_id', req.studio_id)
    .gte('start_at', startUTC)
    .lte('start_at', endUTC)

  if (existingError) {
    console.error(`${LOG_PREFIX} DB error checking existing slots`, { existingError })
    return NextResponse.json<ApiError>(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to check existing slots.' } },
      { status: 500 },
    )
  }

  const existingStartAts = new Set(
    (existingData ?? []).map((r) => new Date(r.start_at as string).getTime()),
  )

  const toInsert = candidates.filter(
    (c) => !existingStartAts.has(c.start_at.getTime()),
  )
  const skipped = candidates.length - toInsert.length

  const createdSlots: SlotDTO[] = []

  if (toInsert.length > 0) {
    const rows = toInsert.map((c) => ({
      studio_id: req.studio_id,
      start_at: c.start_at.toISOString(),
      end_at: c.end_at.toISOString(),
      status: SlotStatus.Available,
    }))

    const { data: insertedData, error: insertError } = await supabaseAdmin
      .from('slots')
      .insert(rows)
      .select('id, studio_id, start_at, end_at, status')

    if (insertError) {
      console.error(`${LOG_PREFIX} DB error inserting slots`, { insertError })
      return NextResponse.json<ApiError>(
        { error: { code: 'INTERNAL_ERROR', message: 'Failed to create slots.' } },
        { status: 500 },
      )
    }

    for (const row of insertedData ?? []) {
      const r = row as {
        id: string
        studio_id: string
        start_at: string
        end_at: string
        status: string
      }
      createdSlots.push({
        id: r.id,
        studio_id: r.studio_id,
        start_at: r.start_at,
        end_at: r.end_at,
        status: r.status as SlotStatus,
      })
    }
  }

  return NextResponse.json<GenerateSlotsResponse>(
    { created: createdSlots.length, skipped, slots: createdSlots },
    { status: 201 },
  )
}
