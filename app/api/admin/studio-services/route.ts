import { NextRequest, NextResponse } from 'next/server'
import { verifyAdminRequest } from '@/lib/admin-auth'
import { supabaseAdmin } from '@/lib/supabase'
import type { ApiError } from '@/lib/types'

const LOG_PREFIX = '[api/admin/studio-services]'

// GET /api/admin/studio-services?studio_id=X
// Returns { service_ids: string[] } — service IDs assigned to the studio
export async function GET(request: NextRequest): Promise<NextResponse> {
  if (!(await verifyAdminRequest(request))) {
    return NextResponse.json<ApiError>(
      { error: { code: 'UNAUTHORIZED', message: 'Admin authentication required.' } },
      { status: 401 },
    )
  }

  const studioId = request.nextUrl.searchParams.get('studio_id')
  if (!studioId) {
    return NextResponse.json<ApiError>(
      { error: { code: 'INVALID_PARAMS', message: "'studio_id' query parameter is required." } },
      { status: 400 },
    )
  }

  const { data, error } = await supabaseAdmin
    .from('studio_services')
    .select('service_id')
    .eq('studio_id', studioId)

  if (error) {
    console.error(`${LOG_PREFIX} DB error fetching assignments`, { studioId, error })
    return NextResponse.json<ApiError>(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch studio service assignments.' } },
      { status: 500 },
    )
  }

  const service_ids = (data ?? []).map((row) => row.service_id as string)
  return NextResponse.json({ service_ids })
}

// PUT /api/admin/studio-services
// Body: { studio_id: string, service_ids: string[] }
// Replaces all assignments for that studio
export async function PUT(request: NextRequest): Promise<NextResponse> {
  if (!(await verifyAdminRequest(request))) {
    return NextResponse.json<ApiError>(
      { error: { code: 'UNAUTHORIZED', message: 'Admin authentication required.' } },
      { status: 401 },
    )
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json<ApiError>(
      { error: { code: 'INVALID_PARAMS', message: 'Invalid JSON body.' } },
      { status: 400 },
    )
  }

  const { studio_id, service_ids } = body as Record<string, unknown>

  if (typeof studio_id !== 'string' || !studio_id.trim()) {
    return NextResponse.json<ApiError>(
      { error: { code: 'INVALID_PARAMS', message: "'studio_id' must be a non-empty string." } },
      { status: 400 },
    )
  }

  if (!Array.isArray(service_ids) || service_ids.some((id) => typeof id !== 'string')) {
    return NextResponse.json<ApiError>(
      { error: { code: 'INVALID_PARAMS', message: "'service_ids' must be an array of strings." } },
      { status: 400 },
    )
  }

  // Delete all existing assignments for this studio
  const { error: deleteError } = await supabaseAdmin
    .from('studio_services')
    .delete()
    .eq('studio_id', studio_id)

  if (deleteError) {
    console.error(`${LOG_PREFIX} DB error deleting assignments`, { studio_id, deleteError })
    return NextResponse.json<ApiError>(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to update studio service assignments.' } },
      { status: 500 },
    )
  }

  // Insert new assignments if any
  if ((service_ids as string[]).length > 0) {
    const rows = (service_ids as string[]).map((service_id) => ({ studio_id, service_id }))
    const { error: insertError } = await supabaseAdmin.from('studio_services').insert(rows)

    if (insertError) {
      console.error(`${LOG_PREFIX} DB error inserting assignments`, { studio_id, insertError })
      return NextResponse.json<ApiError>(
        { error: { code: 'INTERNAL_ERROR', message: 'Failed to update studio service assignments.' } },
        { status: 500 },
      )
    }
  }

  return NextResponse.json({ ok: true })
}
