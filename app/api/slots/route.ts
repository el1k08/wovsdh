import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { isValidStudioId, isValidDateString } from '@/lib/validation'
import type { ApiError, GetSlotsResponse, SlotDTO } from '@/lib/types'

const LOG_PREFIX = '[api/slots]'

/**
 * Converts a calendar date string (YYYY-MM-DD) expressed in a given IANA
 * timezone into the equivalent UTC start and end boundary for that day.
 *
 * Strategy: construct a temporary Date that treats the local midnight as if
 * it were UTC, then measure the timezone offset at that instant via
 * toLocaleString, and apply the inverse correction to arrive at the true UTC
 * time.  This handles both summer (UTC+3) and winter (UTC+2) for
 * Asia/Jerusalem without requiring any external library.
 */
function localDayToUTCRange(
  dateStr: string,
  tz = 'Asia/Jerusalem',
): { start: Date; end: Date } {
  const toUTC = (localISOLike: string): Date => {
    // Step 1: parse as if the local time were UTC (just a numeric anchor).
    const anchor = new Date(localISOLike + 'Z')

    // Step 2: ask the engine what wall-clock time it shows in `tz` for that anchor.
    const wallClock = new Date(
      anchor.toLocaleString('en-US', { timeZone: tz }),
    )

    // Step 3: the difference is the tz offset at that instant.
    const offsetMs = anchor.getTime() - wallClock.getTime()

    // Step 4: the real UTC moment for `localISOLike` in `tz`.
    return new Date(anchor.getTime() + offsetMs)
  }

  return {
    start: toUTC(`${dateStr}T00:00:00`),
    end: toUTC(`${dateStr}T23:59:59`),
  }
}

// GET /api/slots?studio_id=&date=
export async function GET(request: NextRequest): Promise<NextResponse> {
  const { searchParams } = request.nextUrl
  const studioId = searchParams.get('studio_id') ?? ''
  const date = searchParams.get('date') ?? ''

  // --- Validation -------------------------------------------------------
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

  if (!isValidDateString(date)) {
    return NextResponse.json<ApiError>(
      {
        error: {
          code: 'INVALID_PARAMS',
          message:
            "Query param 'date' must be a valid YYYY-MM-DD date that is today or in the future.",
        },
      },
      { status: 400 },
    )
  }

  // --- UTC range for the requested local day ----------------------------
  const { start, end } = localDayToUTCRange(date)

  // --- Database query ---------------------------------------------------
  const { data, error } = await supabaseAdmin
    .from('slots')
    .select('id, studio_id, start_at, end_at, status')
    .eq('studio_id', studioId)
    .eq('status', 'available')
    .gte('start_at', start.toISOString())
    .lt('start_at', end.toISOString())
    .order('start_at', { ascending: true })

  if (error) {
    console.error(`${LOG_PREFIX} DB error fetching slots`, {
      studio_id: studioId,
      date,
      error,
    })
    return NextResponse.json<ApiError>(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch slots.' } },
      { status: 500 },
    )
  }

  const slots: SlotDTO[] = (data ?? []).map((row) => ({
    id: row.id as string,
    studio_id: row.studio_id as string,
    start_at: row.start_at as string,
    end_at: row.end_at as string,
    status: row.status as SlotDTO['status'],
  }))

  return NextResponse.json<GetSlotsResponse>({ slots })
}
