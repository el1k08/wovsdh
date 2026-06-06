import { NextRequest, NextResponse } from 'next/server'
import { verifyAdminRequest } from '@/lib/admin-auth'
import { supabaseAdmin } from '@/lib/supabase'
import { isNonEmptyString, studioExists } from '@/lib/validation'
import type {
  ApiError,
  GetMasterScheduleResponse,
  StudioScheduleTemplate,
  UpsertMasterScheduleRequest,
} from '@/lib/types'

const LOG_PREFIX = '[api/admin/master-schedule]'

const TIME_RE = /^\d{2}:\d{2}$/

function isValidTimeParam(str: string): boolean {
  if (!TIME_RE.test(str)) return false
  const [h, m] = str.split(':').map(Number)
  return h >= 0 && h <= 23 && m >= 0 && m <= 59
}

// GET /api/admin/master-schedule?studio_id=rishon
export async function GET(request: NextRequest): Promise<NextResponse> {
  if (!(await verifyAdminRequest(request))) {
    return NextResponse.json<ApiError>(
      { error: { code: 'UNAUTHORIZED', message: 'Invalid or missing X-Admin-Secret header.' } },
      { status: 401 },
    )
  }

  const studioId = request.nextUrl.searchParams.get('studio_id') ?? ''

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

  const { data, error } = await supabaseAdmin
    .from('studio_schedule_templates')
    .select('id, studio_id, day_of_week, is_working, work_start, work_end')
    .eq('studio_id', studioId)
    .order('day_of_week', { ascending: true })

  if (error) {
    console.error(`${LOG_PREFIX} DB error fetching schedule`, { studio_id: studioId, error })
    return NextResponse.json<ApiError>(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch schedule.' } },
      { status: 500 },
    )
  }

  return NextResponse.json<GetMasterScheduleResponse>({
    schedule: (data ?? []) as StudioScheduleTemplate[],
  })
}

// PUT /api/admin/master-schedule
export async function PUT(request: NextRequest): Promise<NextResponse> {
  if (!(await verifyAdminRequest(request))) {
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

  const { studio_id, days } = body as Record<string, unknown>

  if (!isNonEmptyString(studio_id) || !(await studioExists(studio_id))) {
    return NextResponse.json<ApiError>(
      { error: { code: 'INVALID_PARAMS', message: "'studio_id' must be a valid studio ID." } },
      { status: 400 },
    )
  }

  if (!Array.isArray(days) || days.length === 0) {
    return NextResponse.json<ApiError>(
      { error: { code: 'INVALID_PARAMS', message: "'days' must be a non-empty array." } },
      { status: 400 },
    )
  }

  const req = body as UpsertMasterScheduleRequest
  const validationErrors: string[] = []

  for (const day of req.days) {
    if (
      typeof day.day_of_week !== 'number' ||
      !Number.isInteger(day.day_of_week) ||
      day.day_of_week < 0 ||
      day.day_of_week > 6
    ) {
      validationErrors.push(`'day_of_week' must be an integer 0–6, got ${day.day_of_week}.`)
    }

    if (day.is_working) {
      if (!isValidTimeParam(day.work_start)) {
        validationErrors.push(`'work_start' must be HH:mm for day ${day.day_of_week}.`)
      }
      if (!isValidTimeParam(day.work_end)) {
        validationErrors.push(`'work_end' must be HH:mm for day ${day.day_of_week}.`)
      }
      if (
        isValidTimeParam(day.work_start) &&
        isValidTimeParam(day.work_end) &&
        day.work_start >= day.work_end
      ) {
        validationErrors.push(`'work_start' must be before 'work_end' for day ${day.day_of_week}.`)
      }
    }
  }

  if (validationErrors.length > 0) {
    return NextResponse.json<ApiError>(
      { error: { code: 'INVALID_PARAMS', message: validationErrors.join(' ') } },
      { status: 400 },
    )
  }

  const rows = req.days.map((day) => ({
    studio_id: req.studio_id,
    day_of_week: day.day_of_week,
    is_working: day.is_working,
    work_start: `${day.work_start}:00`,
    work_end: `${day.work_end}:00`,
  }))

  const { error } = await supabaseAdmin
    .from('studio_schedule_templates')
    .upsert(rows, { onConflict: 'studio_id,day_of_week' })

  if (error) {
    console.error(`${LOG_PREFIX} DB error upserting schedule`, { studio_id, error })
    return NextResponse.json<ApiError>(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to save schedule.' } },
      { status: 500 },
    )
  }

  return NextResponse.json({ message: 'Schedule saved' }, { status: 200 })
}
