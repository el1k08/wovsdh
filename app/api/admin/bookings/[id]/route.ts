import { NextRequest, NextResponse } from 'next/server'
import { verifyAdminRequest } from '@/lib/admin-auth'
import { supabaseAdmin } from '@/lib/supabase'
import { isValidUUID } from '@/lib/validation'
import type { ApiError, AdminBookingDTO } from '@/lib/types'

const LOG_PREFIX = '[api/admin/bookings/[id]]'

const PG_UNIQUE_VIOLATION = '23505'

// GET /api/admin/bookings/[id]
export async function GET(
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
      { error: { code: 'INVALID_PARAMS', message: "Booking 'id' must be a valid UUID." } },
      { status: 400 },
    )
  }

  const { data, error } = await supabaseAdmin
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
    .eq('id', id)
    .maybeSingle()

  if (error) {
    console.error(`${LOG_PREFIX} DB error fetching booking`, { id, error })
    return NextResponse.json<ApiError>(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch booking.' } },
      { status: 500 },
    )
  }

  if (!data) {
    return NextResponse.json<ApiError>(
      { error: { code: 'BOOKING_NOT_FOUND', message: 'Booking not found.' } },
      { status: 404 },
    )
  }

  const raw = data as unknown as {
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

  const slotsWithTimes = (raw.booking_slots ?? [])
    .map((bs) => ({ slot_id: bs.slot_id, start_at: bs.slot?.start_at ?? '' }))
    .sort((a, b) => a.start_at.localeCompare(b.start_at))

  const startAt = slotsWithTimes[0]?.start_at ?? ''
  const snapshot = raw.service_snapshot
  const durationMs = typeof snapshot.duration_minutes === 'number'
    ? snapshot.duration_minutes * 60 * 1000
    : 0
  const endAt = startAt
    ? new Date(new Date(startAt).getTime() + durationMs).toISOString()
    : ''

  const dto: AdminBookingDTO = {
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

  return NextResponse.json<{ booking: AdminBookingDTO }>({ booking: dto })
}

// PUT /api/admin/bookings/[id]
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
      { error: { code: 'INVALID_PARAMS', message: "Booking 'id' must be a valid UUID." } },
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

  const { action } = body as Record<string, unknown>

  if (action === 'cancel') {
    return handleCancel(id)
  }

  if (action === 'update_duration') {
    return handleUpdateDuration(id, body as Record<string, unknown>)
  }

  if (action === 'reschedule') {
    return handleReschedule(id, body as Record<string, unknown>)
  }

  return NextResponse.json<ApiError>(
    {
      error: {
        code: 'INVALID_PARAMS',
        message: "'action' must be 'cancel', 'update_duration', or 'reschedule'.",
      },
    },
    { status: 400 },
  )
}

// ---------------------------------------------------------------------------
// cancel action
// ---------------------------------------------------------------------------

async function handleCancel(bookingId: string): Promise<NextResponse> {
  const { data: bookingData, error: fetchError } = await supabaseAdmin
    .from('bookings')
    .select('id, status')
    .eq('id', bookingId)
    .maybeSingle()

  if (fetchError || !bookingData) {
    return NextResponse.json<ApiError>(
      { error: { code: 'BOOKING_NOT_FOUND', message: 'Booking not found.' } },
      { status: 404 },
    )
  }

  const booking = bookingData as { id: string; status: string }

  if (booking.status === 'CANCELLED') {
    return NextResponse.json<ApiError>(
      { error: { code: 'ALREADY_CANCELLED', message: 'Booking is already cancelled.' } },
      { status: 409 },
    )
  }

  const { error: updateError } = await supabaseAdmin
    .from('bookings')
    .update({ status: 'CANCELLED' })
    .eq('id', bookingId)

  if (updateError) {
    console.error(`${LOG_PREFIX} DB error cancelling booking`, { booking_id: bookingId, error: updateError })
    return NextResponse.json<ApiError>(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to cancel booking.' } },
      { status: 500 },
    )
  }

  return NextResponse.json({ message: 'Booking cancelled', booking_id: bookingId }, { status: 200 })
}

// ---------------------------------------------------------------------------
// update_duration action
// ---------------------------------------------------------------------------

async function handleUpdateDuration(
  bookingId: string,
  body: Record<string, unknown>,
): Promise<NextResponse> {
  const { new_duration_minutes } = body

  if (
    typeof new_duration_minutes !== 'number' ||
    !Number.isInteger(new_duration_minutes) ||
    new_duration_minutes < 15 ||
    new_duration_minutes % 15 !== 0
  ) {
    return NextResponse.json<ApiError>(
      {
        error: {
          code: 'INVALID_PARAMS',
          message: "'new_duration_minutes' must be a positive integer divisible by 15.",
        },
      },
      { status: 400 },
    )
  }

  const { data: bookingData, error: fetchError } = await supabaseAdmin
    .from('bookings')
    .select('id, studio_id, service_snapshot')
    .eq('id', bookingId)
    .maybeSingle()

  if (fetchError || !bookingData) {
    return NextResponse.json<ApiError>(
      { error: { code: 'BOOKING_NOT_FOUND', message: 'Booking not found.' } },
      { status: 404 },
    )
  }

  const booking = bookingData as { id: string; studio_id: string; service_snapshot: Record<string, unknown> }
  const newSlotsCount = new_duration_minutes / 15

  // Release excess slots, keeping only the first newSlotsCount
  const { error: releaseError } = await supabaseAdmin.client.rpc('release_booking_slots', {
    p_booking_id: bookingId,
    p_keep_slots: newSlotsCount,
  })

  if (releaseError) {
    console.error(`${LOG_PREFIX} RPC error release_booking_slots (update_duration)`, {
      booking_id: bookingId,
      error: releaseError,
    })
    return NextResponse.json<ApiError>(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to release excess slots.' } },
      { status: 500 },
    )
  }

  const updatedSnapshot = { ...booking.service_snapshot, duration_minutes: new_duration_minutes }

  const { error: updateError } = await supabaseAdmin
    .from('bookings')
    .update({ service_snapshot: updatedSnapshot })
    .eq('id', bookingId)

  if (updateError) {
    console.error(`${LOG_PREFIX} DB error updating service_snapshot`, { booking_id: bookingId, error: updateError })
    return NextResponse.json<ApiError>(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to update booking duration.' } },
      { status: 500 },
    )
  }

  return NextResponse.json({ message: 'Duration updated', booking_id: bookingId }, { status: 200 })
}

// ---------------------------------------------------------------------------
// reschedule action
// ---------------------------------------------------------------------------

async function handleReschedule(
  bookingId: string,
  body: Record<string, unknown>,
): Promise<NextResponse> {
  const { new_start_at, new_duration_minutes } = body

  if (typeof new_start_at !== 'string' || !new_start_at.trim()) {
    return NextResponse.json<ApiError>(
      { error: { code: 'INVALID_PARAMS', message: "'new_start_at' is required." } },
      { status: 400 },
    )
  }

  if (
    new_duration_minutes !== undefined &&
    (typeof new_duration_minutes !== 'number' ||
      !Number.isInteger(new_duration_minutes) ||
      new_duration_minutes < 15 ||
      new_duration_minutes % 15 !== 0)
  ) {
    return NextResponse.json<ApiError>(
      {
        error: {
          code: 'INVALID_PARAMS',
          message: "'new_duration_minutes' must be a positive integer divisible by 15.",
        },
      },
      { status: 400 },
    )
  }

  const { data: bookingData, error: fetchError } = await supabaseAdmin
    .from('bookings')
    .select('id, studio_id, service_snapshot')
    .eq('id', bookingId)
    .maybeSingle()

  if (fetchError || !bookingData) {
    return NextResponse.json<ApiError>(
      { error: { code: 'BOOKING_NOT_FOUND', message: 'Booking not found.' } },
      { status: 404 },
    )
  }

  const booking = bookingData as { id: string; studio_id: string; service_snapshot: Record<string, unknown> }
  const durationMinutes =
    typeof new_duration_minutes === 'number'
      ? new_duration_minutes
      : (booking.service_snapshot.duration_minutes as number)

  // Full release of all current slots
  const { error: releaseError } = await supabaseAdmin.client.rpc('release_booking_slots', {
    p_booking_id: bookingId,
    p_keep_slots: 0,
  })

  if (releaseError) {
    console.error(`${LOG_PREFIX} RPC error release_booking_slots (reschedule)`, {
      booking_id: bookingId,
      error: releaseError,
    })
    return NextResponse.json<ApiError>(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to release current slots.' } },
      { status: 500 },
    )
  }

  const { error: lockError } = await supabaseAdmin.client.rpc('lock_booking_slots', {
    p_booking_id: bookingId,
    p_studio_id: booking.studio_id,
    p_start_at: new_start_at.trim(),
    p_duration_minutes: durationMinutes,
  })

  if (lockError) {
    const isConflict =
      lockError.code === PG_UNIQUE_VIOLATION ||
      (lockError.message ?? '').includes('SLOT_UNAVAILABLE')

    if (isConflict) {
      return NextResponse.json<ApiError>(
        {
          error: {
            code: 'SLOT_UNAVAILABLE',
            message: 'One or more requested time slots are no longer available.',
          },
        },
        { status: 409 },
      )
    }

    console.error(`${LOG_PREFIX} RPC error lock_booking_slots (reschedule)`, {
      booking_id: bookingId,
      error: lockError,
    })
    return NextResponse.json<ApiError>(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to lock new slots.' } },
      { status: 500 },
    )
  }

  if (typeof new_duration_minutes === 'number') {
    const updatedSnapshot = { ...booking.service_snapshot, duration_minutes: new_duration_minutes }
    await supabaseAdmin
      .from('bookings')
      .update({ service_snapshot: updatedSnapshot })
      .eq('id', bookingId)
  }

  return NextResponse.json({ message: 'Booking rescheduled', booking_id: bookingId }, { status: 200 })
}
