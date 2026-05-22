import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import type { ApiError, UpdateStudioRequest, StudioTranslations } from '@/lib/types'
import { isNonEmptyString } from '@/lib/validation'

function requireAdminAuth(request: NextRequest): boolean {
  return request.headers.get('X-Admin-Secret') === process.env.ADMIN_SECRET_KEY
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!requireAdminAuth(request)) {
    return NextResponse.json<ApiError>(
      { error: { code: 'UNAUTHORIZED', message: 'Admin authentication required.' } },
      { status: 401 },
    )
  }
  const { id } = await params
  const { data: studio, error } = await supabaseAdmin
    .from('studios').select('*').eq('id', id).maybeSingle()
  if (error || !studio) {
    return NextResponse.json<ApiError>(
      { error: { code: 'STUDIO_NOT_FOUND', message: `Studio '${id}' not found.` } },
      { status: 404 },
    )
  }
  const { data: schedule } = await supabaseAdmin
    .from('studio_schedule_templates')
    .select('*')
    .eq('studio_id', id)
    .order('day_of_week')
  return NextResponse.json({ studio, schedule: schedule ?? [] })
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!requireAdminAuth(request)) {
    return NextResponse.json<ApiError>(
      { error: { code: 'UNAUTHORIZED', message: 'Admin authentication required.' } },
      { status: 401 },
    )
  }
  const { id } = await params
  let body: UpdateStudioRequest
  try {
    body = await request.json()
  } catch {
    return NextResponse.json<ApiError>(
      { error: { code: 'INVALID_PARAMS', message: 'Invalid JSON body.' } },
      { status: 400 },
    )
  }

  const updates: Record<string, unknown> = {}
  if (body.name !== undefined) {
    if (!isNonEmptyString(body.name)) {
      return NextResponse.json<ApiError>(
        { error: { code: 'INVALID_PARAMS', message: "'name' must be a non-empty string." } },
        { status: 400 },
      )
    }
    updates.name = body.name.trim()
  }
  if (body.city !== undefined) {
    if (!isNonEmptyString(body.city)) {
      return NextResponse.json<ApiError>(
        { error: { code: 'INVALID_PARAMS', message: "'city' must be a non-empty string." } },
        { status: 400 },
      )
    }
    updates.city = body.city.trim()
  }
  if (body.street !== undefined) updates.street = body.street
  if (body.timezone !== undefined) updates.timezone = body.timezone
  if (body.schedule_text !== undefined) updates.schedule_text = body.schedule_text

  if (body.translations !== undefined) {
    updates.translations = body.translations
  } else if (body.name !== undefined || body.schedule_text !== undefined) {
    // Sync uk locale in translations when name/schedule_text changes without explicit translations
    const { data: current } = await supabaseAdmin
      .from('studios').select('translations').eq('id', id).maybeSingle()
    const existing = (current?.translations ?? {}) as StudioTranslations
    updates.translations = {
      ...existing,
      uk: {
        name: body.name ?? existing.uk?.name ?? '',
        schedule_text: body.schedule_text ?? existing.uk?.schedule_text ?? '',
      },
    }
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json<ApiError>(
      { error: { code: 'INVALID_PARAMS', message: 'No updatable fields provided.' } },
      { status: 400 },
    )
  }

  const { data: studio, error } = await supabaseAdmin
    .from('studios')
    .update(updates)
    .eq('id', id)
    .select()
    .maybeSingle()
  if (error || !studio) {
    return NextResponse.json<ApiError>(
      { error: { code: 'STUDIO_NOT_FOUND', message: `Studio '${id}' not found.` } },
      { status: 404 },
    )
  }
  return NextResponse.json({ studio })
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!requireAdminAuth(request)) {
    return NextResponse.json<ApiError>(
      { error: { code: 'UNAUTHORIZED', message: 'Admin authentication required.' } },
      { status: 401 },
    )
  }
  const { id } = await params

  const { data: studio } = await supabaseAdmin
    .from('studios').select('id').eq('id', id).maybeSingle()
  if (!studio) {
    return NextResponse.json<ApiError>(
      { error: { code: 'STUDIO_NOT_FOUND', message: `Studio '${id}' not found.` } },
      { status: 404 },
    )
  }

  const { data: activeBooking } = await supabaseAdmin
    .from('bookings')
    .select('id')
    .eq('studio_id', id)
    .in('status', ['PENDING', 'CONFIRMED'])
    .limit(1)
    .maybeSingle()
  if (activeBooking) {
    return NextResponse.json<ApiError>(
      { error: { code: 'STUDIO_HAS_ACTIVE_BOOKINGS', message: 'Cannot delete studio with active bookings. Cancel all pending and confirmed bookings first.' } },
      { status: 409 },
    )
  }

  // Delete cancelled bookings (bookings.studio_id has no CASCADE)
  // This cascades to booking_slots, freeing the slots
  await supabaseAdmin
    .from('bookings')
    .delete()
    .eq('studio_id', id)
    .eq('status', 'CANCELLED')

  // Delete studio — cascades to services, slots, studio_schedule_templates
  const { error } = await supabaseAdmin.from('studios').delete().eq('id', id)
  if (error) {
    return NextResponse.json<ApiError>(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to delete studio.' } },
      { status: 500 },
    )
  }

  return NextResponse.json({ message: 'Studio deleted successfully.', id })
}
