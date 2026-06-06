import { NextRequest, NextResponse } from 'next/server'
import { verifyAdminRequest } from '@/lib/admin-auth'
import { supabaseAdmin } from '@/lib/supabase'
import { isValidUUID } from '@/lib/validation'
import { BookingStatus } from '@/lib/types'
import type { ApiError, ServiceDTO, ServiceTranslations, UpdateServiceRequest } from '@/lib/types'

const LOG_PREFIX = '[api/admin/services/[id]]'

// PUT /api/admin/services/[id]
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  if (!(await verifyAdminRequest(request))) {
    return NextResponse.json<ApiError>(
      { error: { code: 'UNAUTHORIZED', message: 'Invalid or missing X-Admin-Secret header.' } },
      { status: 401 },
    )
  }

  const { id } = await params

  if (!isValidUUID(id)) {
    return NextResponse.json<ApiError>(
      { error: { code: 'INVALID_PARAMS', message: "Service 'id' must be a valid UUID." } },
      { status: 400 },
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

  const updates = body as UpdateServiceRequest

  if (
    updates.duration_minutes !== undefined &&
    (typeof updates.duration_minutes !== 'number' ||
      !Number.isInteger(updates.duration_minutes) ||
      updates.duration_minutes < 15 ||
      updates.duration_minutes % 15 !== 0)
  ) {
    return NextResponse.json<ApiError>(
      {
        error: {
          code: 'INVALID_PARAMS',
          message: "'duration_minutes' must be a positive integer divisible by 15.",
        },
      },
      { status: 400 },
    )
  }

  if (updates.price !== undefined && (typeof updates.price !== 'number' || updates.price < 0)) {
    return NextResponse.json<ApiError>(
      { error: { code: 'INVALID_PARAMS', message: "'price' must be a non-negative number." } },
      { status: 400 },
    )
  }

  const patch: Record<string, unknown> = {}
  if (updates.name !== undefined) patch.name = updates.name
  if (updates.description !== undefined) patch.description = updates.description
  if (updates.icon !== undefined) patch.icon = updates.icon
  if (updates.price !== undefined) patch.price = updates.price
  if (updates.duration_minutes !== undefined) patch.duration_minutes = updates.duration_minutes
  if (updates.sort_order !== undefined) patch.sort_order = updates.sort_order
  if (updates.studio_id !== undefined) patch.studio_id = updates.studio_id
  if (updates.is_active !== undefined) patch.is_active = updates.is_active

  if (updates.translations !== undefined) {
    patch.translations = updates.translations
  } else if (updates.name !== undefined || updates.description !== undefined) {
    // Sync uk locale in translations when name/description changes without explicit translations
    const { data: current } = await supabaseAdmin
      .from('services').select('translations').eq('id', id).maybeSingle()
    const existing = (current?.translations ?? {}) as ServiceTranslations
    patch.translations = {
      ...existing,
      uk: {
        name: updates.name ?? existing.uk?.name ?? '',
        description: updates.description ?? existing.uk?.description ?? '',
      },
    }
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json<ApiError>(
      { error: { code: 'INVALID_PARAMS', message: 'No valid fields to update.' } },
      { status: 400 },
    )
  }

  const { data, error } = await supabaseAdmin
    .from('services')
    .update(patch)
    .eq('id', id)
    .select('id, studio_id, icon, name, description, price, duration_minutes, sort_order, translations')
    .maybeSingle()

  if (error) {
    console.error(`${LOG_PREFIX} DB error updating service`, { id, error })
    return NextResponse.json<ApiError>(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to update service.' } },
      { status: 500 },
    )
  }

  if (!data) {
    return NextResponse.json<ApiError>(
      { error: { code: 'SERVICE_NOT_FOUND', message: 'Service not found.' } },
      { status: 404 },
    )
  }

  return NextResponse.json<{ service: ServiceDTO }>({ service: data as ServiceDTO })
}

// DELETE /api/admin/services/[id]
// Soft-deletes if the service has any bookings referencing it; hard-deletes otherwise.
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  if (!(await verifyAdminRequest(request))) {
    return NextResponse.json<ApiError>(
      { error: { code: 'UNAUTHORIZED', message: 'Invalid or missing X-Admin-Secret header.' } },
      { status: 401 },
    )
  }

  const { id } = await params

  if (!isValidUUID(id)) {
    return NextResponse.json<ApiError>(
      { error: { code: 'INVALID_PARAMS', message: "Service 'id' must be a valid UUID." } },
      { status: 400 },
    )
  }

  const { data: existingData, error: existingError } = await supabaseAdmin
    .from('services')
    .select('id')
    .eq('id', id)
    .maybeSingle()

  if (existingError) {
    console.error(`${LOG_PREFIX} DB error checking service`, { id, error: existingError })
    return NextResponse.json<ApiError>(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch service.' } },
      { status: 500 },
    )
  }

  if (!existingData) {
    return NextResponse.json<ApiError>(
      { error: { code: 'SERVICE_NOT_FOUND', message: 'Service not found.' } },
      { status: 404 },
    )
  }

  const { data: bookingData, error: bookingError } = await supabaseAdmin
    .from('bookings')
    .select('id')
    .eq('service_id', id)
    .neq('status', BookingStatus.Cancelled)
    .limit(1)
    .maybeSingle()

  if (bookingError) {
    console.error(`${LOG_PREFIX} DB error checking bookings for service`, { id, error: bookingError })
    return NextResponse.json<ApiError>(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to check service bookings.' } },
      { status: 500 },
    )
  }

  if (bookingData) {
    // Soft delete — there are active bookings referencing this service
    const { error: updateError } = await supabaseAdmin
      .from('services')
      .update({ is_active: false })
      .eq('id', id)

    if (updateError) {
      console.error(`${LOG_PREFIX} DB error soft-deleting service`, { id, error: updateError })
      return NextResponse.json<ApiError>(
        { error: { code: 'INTERNAL_ERROR', message: 'Failed to deactivate service.' } },
        { status: 500 },
      )
    }

    return NextResponse.json({ message: 'Service deactivated', id }, { status: 200 })
  }

  const { error: deleteError } = await supabaseAdmin.from('services').delete().eq('id', id)

  if (deleteError) {
    console.error(`${LOG_PREFIX} DB error deleting service`, { id, error: deleteError })
    return NextResponse.json<ApiError>(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to delete service.' } },
      { status: 500 },
    )
  }

  return NextResponse.json({ message: 'Service deleted', id }, { status: 200 })
}
