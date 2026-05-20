import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import type { ApiError, Studio, CreateStudioRequest } from '@/lib/types'
import { isNonEmptyString, isValidStudioSlug } from '@/lib/validation'

function requireAdminAuth(request: NextRequest): boolean {
  return request.headers.get('X-Admin-Secret') === process.env.ADMIN_SECRET_KEY
}

export async function GET(request: NextRequest) {
  if (!requireAdminAuth(request)) {
    return NextResponse.json<ApiError>(
      { error: { code: 'UNAUTHORIZED', message: 'Admin authentication required.' } },
      { status: 401 },
    )
  }
  const { data: studios, error } = await supabaseAdmin
    .from('studios')
    .select('*')
    .order('sort_order', { ascending: true })
  if (error) {
    return NextResponse.json<ApiError>(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch studios.' } },
      { status: 500 },
    )
  }
  return NextResponse.json({ studios })
}

export async function POST(request: NextRequest) {
  if (!requireAdminAuth(request)) {
    return NextResponse.json<ApiError>(
      { error: { code: 'UNAUTHORIZED', message: 'Admin authentication required.' } },
      { status: 401 },
    )
  }
  let body: CreateStudioRequest
  try {
    body = await request.json()
  } catch {
    return NextResponse.json<ApiError>(
      { error: { code: 'INVALID_PARAMS', message: 'Invalid JSON body.' } },
      { status: 400 },
    )
  }
  const { id, name, street, city, timezone = 'Asia/Jerusalem', schedule } = body

  if (!isNonEmptyString(id) || !isValidStudioSlug(id)) {
    return NextResponse.json<ApiError>(
      { error: { code: 'INVALID_PARAMS', message: "'id' must be a lowercase slug (letters, digits, hyphens), 1–30 chars." } },
      { status: 400 },
    )
  }
  if (!isNonEmptyString(name)) {
    return NextResponse.json<ApiError>(
      { error: { code: 'INVALID_PARAMS', message: "'name' is required." } },
      { status: 400 },
    )
  }
  if (!isNonEmptyString(city)) {
    return NextResponse.json<ApiError>(
      { error: { code: 'INVALID_PARAMS', message: "'city' is required." } },
      { status: 400 },
    )
  }
  if (!Array.isArray(schedule) || schedule.length !== 7) {
    return NextResponse.json<ApiError>(
      { error: { code: 'INVALID_PARAMS', message: "'schedule' must have exactly 7 entries (one per day of week)." } },
      { status: 400 },
    )
  }
  const dayOfWeeks = schedule.map(r => r.day_of_week)
  if (new Set(dayOfWeeks).size !== 7 || !dayOfWeeks.every(d => d >= 0 && d <= 6)) {
    return NextResponse.json<ApiError>(
      { error: { code: 'INVALID_PARAMS', message: "'schedule' must have unique day_of_week values 0–6." } },
      { status: 400 },
    )
  }

  const { data: existing } = await supabaseAdmin
    .from('studios').select('id').eq('id', id).maybeSingle()
  if (existing) {
    return NextResponse.json<ApiError>(
      { error: { code: 'STUDIO_ID_TAKEN', message: `Studio ID '${id}' is already taken.` } },
      { status: 409 },
    )
  }

  const { data: studio, error: studioErr } = await supabaseAdmin
    .from('studios')
    .insert({ id, name, street: street ?? '', city, timezone })
    .select()
    .single()
  if (studioErr || !studio) {
    return NextResponse.json<ApiError>(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to create studio.' } },
      { status: 500 },
    )
  }

  const scheduleRows = schedule.map(row => ({
    studio_id: id,
    day_of_week: row.day_of_week,
    is_working: row.is_working,
    work_start: row.work_start,
    work_end: row.work_end,
  }))
  const { error: schedErr } = await supabaseAdmin
    .from('studio_schedule_templates')
    .insert(scheduleRows)
  if (schedErr) {
    await supabaseAdmin.from('studios').delete().eq('id', id)
    return NextResponse.json<ApiError>(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to create schedule template.' } },
      { status: 500 },
    )
  }

  return NextResponse.json({ studio }, { status: 201 })
}
