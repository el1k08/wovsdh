import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { isNonEmptyString, studioExists } from '@/lib/validation'
import { SlotStatus } from '@/lib/types'
import type { ApiError, GenerateSlotsFromTemplateResponse, StudioScheduleTemplate } from '@/lib/types'

const LOG_PREFIX = '[api/admin/generate-slots]'

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
const TZ = 'Asia/Jerusalem'

function requireAdminAuth(request: NextRequest): boolean {
  return request.headers.get('X-Admin-Secret') === process.env.ADMIN_SECRET_KEY
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

function localToUTC(localISOLike: string): Date {
  const anchor = new Date(localISOLike + 'Z')
  const wallClock = new Date(anchor.toLocaleString('en-US', { timeZone: TZ }))
  return new Date(anchor.getTime() + (anchor.getTime() - wallClock.getTime()))
}

function parseMinutes(hhmmss: string): number {
  const [h, m] = hhmmss.split(':').map(Number)
  return h * 60 + m
}

function padTwo(n: number): string {
  return String(n).padStart(2, '0')
}

// POST /api/admin/generate-slots
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

  const { studio_id, date_from, date_to } = body as Record<string, unknown>

  const validationErrors: string[] = []

  if (!isNonEmptyString(studio_id) || !(await studioExists(studio_id as string))) {
    validationErrors.push("'studio_id' must be a valid studio ID.")
  }
  if (typeof date_from !== 'string' || !isValidDateParam(date_from)) {
    validationErrors.push("'date_from' must be a valid YYYY-MM-DD date.")
  }
  if (typeof date_to !== 'string' || !isValidDateParam(date_to)) {
    validationErrors.push("'date_to' must be a valid YYYY-MM-DD date.")
  }
  if (
    typeof date_from === 'string' &&
    typeof date_to === 'string' &&
    isValidDateParam(date_from) &&
    isValidDateParam(date_to) &&
    date_to < date_from
  ) {
    validationErrors.push("'date_to' must be >= 'date_from'.")
  }

  if (validationErrors.length > 0) {
    return NextResponse.json<ApiError>(
      { error: { code: 'INVALID_PARAMS', message: validationErrors.join(' ') } },
      { status: 400 },
    )
  }

  const validStudioId = studio_id as string
  const validDateFrom = date_from as string
  const validDateTo = date_to as string

  const { data: templates, error: templateError } = await supabaseAdmin
    .from('studio_schedule_templates')
    .select('day_of_week, is_working, work_start, work_end')
    .eq('studio_id', validStudioId)

  if (templateError) {
    console.error(`${LOG_PREFIX} DB error fetching templates`, { studio_id: validStudioId, error: templateError })
    return NextResponse.json<ApiError>(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch schedule templates.' } },
      { status: 500 },
    )
  }

  const templatesByDay = new Map<number, StudioScheduleTemplate>()
  for (const t of (templates ?? []) as StudioScheduleTemplate[]) {
    templatesByDay.set(t.day_of_week, t)
  }

  // Iterate over each date in the range and generate 15-minute slots
  const candidateRows: Array<{ studio_id: string; start_at: string; status: SlotStatus }> = []

  const cursor = new Date(validDateFrom + 'T00:00:00Z')
  const end = new Date(validDateTo + 'T00:00:00Z')

  while (cursor <= end) {
    const dateStr = cursor.toISOString().slice(0, 10)
    // getUTCDay returns 0=Sun..6=Sat which matches our schema
    const dayOfWeek = cursor.getUTCDay()

    const template = templatesByDay.get(dayOfWeek)

    if (template && template.is_working) {
      const startMinutes = parseMinutes(template.work_start)
      const endMinutes = parseMinutes(template.work_end)

      for (let slotStart = startMinutes; slotStart + 15 <= endMinutes; slotStart += 15) {
        const hh = padTwo(Math.floor(slotStart / 60))
        const mm = padTwo(slotStart % 60)
        const utcDate = localToUTC(`${dateStr}T${hh}:${mm}:00`)
        candidateRows.push({
          studio_id: validStudioId,
          start_at: utcDate.toISOString(),
          status: SlotStatus.Available,
        })
      }
    }

    cursor.setUTCDate(cursor.getUTCDate() + 1)
  }

  if (candidateRows.length === 0) {
    return NextResponse.json<GenerateSlotsFromTemplateResponse>({ created: 0, skipped: 0 })
  }

  // Idempotent upsert: onConflict on the UNIQUE(studio_id, start_at) index
  // skips rows that already exist rather than erroring.
  const { data: upserted, error: upsertError } = await supabaseAdmin
    .from('slots')
    .upsert(candidateRows, { onConflict: 'studio_id,start_at', ignoreDuplicates: true })
    .select('id')

  if (upsertError) {
    console.error(`${LOG_PREFIX} DB error upserting slots`, { studio_id: validStudioId, error: upsertError })
    return NextResponse.json<ApiError>(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to generate slots.' } },
      { status: 500 },
    )
  }

  const created = (upserted ?? []).length
  const skipped = candidateRows.length - created

  return NextResponse.json<GenerateSlotsFromTemplateResponse>({ created, skipped }, { status: 201 })
}
