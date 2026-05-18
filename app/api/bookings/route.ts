import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import {
  isValidUUID,
  isValidEmail,
  isValidStudioId,
  isNonEmptyString,
} from '@/lib/validation'
import { notifyStaffNewBooking } from '@/lib/notify'
import type {
  ApiError,
  CreateBookingResponse,
  BookingCreatedDTO,
  BookingStatus,
  SlotStatus,
} from '@/lib/types'

const LOG_PREFIX = '[api/bookings]'

/** PostgreSQL unique_violation error code. */
const PG_UNIQUE_VIOLATION = '23505'

// POST /api/bookings
export async function POST(request: NextRequest): Promise<NextResponse> {
  // --- Parse body -------------------------------------------------------
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
    slot_id,
    studio_id,
    client_first_name,
    client_last_name,
    client_phone,
    client_email,
  } = body as Record<string, unknown>

  // --- Validation -------------------------------------------------------
  const validationErrors: string[] = []

  if (!isNonEmptyString(slot_id) || !isValidUUID(slot_id)) {
    validationErrors.push("'slot_id' must be a valid UUID.")
  }
  if (!isNonEmptyString(studio_id) || !isValidStudioId(studio_id)) {
    validationErrors.push("'studio_id' must be 'rishon' or 'ashdod'.")
  }
  if (!isNonEmptyString(client_first_name)) {
    validationErrors.push("'client_first_name' is required.")
  }
  if (!isNonEmptyString(client_last_name)) {
    validationErrors.push("'client_last_name' is required.")
  }
  if (!isNonEmptyString(client_phone)) {
    validationErrors.push("'client_phone' is required.")
  }
  if (!isNonEmptyString(client_email) || !isValidEmail(client_email)) {
    validationErrors.push("'client_email' must be a valid email address.")
  }

  if (validationErrors.length > 0) {
    return NextResponse.json<ApiError>(
      {
        error: {
          code: 'INVALID_PARAMS',
          message: validationErrors.join(' '),
        },
      },
      { status: 400 },
    )
  }

  // At this point TypeScript does not yet narrow the types for us, so we
  // assert them explicitly after the guard above has confirmed the shapes.
  const validSlotId = slot_id as string
  const validStudioId = studio_id as string
  const validFirstName = (client_first_name as string).trim()
  const validLastName = (client_last_name as string).trim()
  const validPhone = (client_phone as string).trim()
  const validEmail = (client_email as string).trim()

  // --- Check slot exists and is available --------------------------------
  const { data: slotData, error: slotError } = await supabaseAdmin
    .from('slots')
    .select('id, studio_id, start_at, end_at, status')
    .eq('id', validSlotId)
    .maybeSingle()

  if (slotError) {
    console.error(`${LOG_PREFIX} DB error fetching slot`, {
      slot_id: validSlotId,
      error: slotError,
    })
    return NextResponse.json<ApiError>(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to verify slot.' } },
      { status: 500 },
    )
  }

  if (!slotData) {
    return NextResponse.json<ApiError>(
      { error: { code: 'SLOT_NOT_FOUND', message: 'The requested slot does not exist.' } },
      { status: 404 },
    )
  }

  const slot = slotData as {
    id: string
    studio_id: string
    start_at: string
    end_at: string
    status: SlotStatus
  }

  if (slot.status !== 'available') {
    return NextResponse.json<ApiError>(
      {
        error: {
          code: 'SLOT_UNAVAILABLE',
          message: 'This slot is no longer available.',
        },
      },
      { status: 409 },
    )
  }

  // --- Insert booking ---------------------------------------------------
  const { data: bookingData, error: insertError } = await supabaseAdmin
    .from('bookings')
    .insert({
      slot_id: validSlotId,
      studio_id: validStudioId,
      client_first_name: validFirstName,
      client_last_name: validLastName,
      client_phone: validPhone,
      client_email: validEmail,
      status: 'PENDING',
    })
    .select('id, slot_id, studio_id, status, created_at, cancellation_token')
    .single()

  if (insertError) {
    // Race condition: another request booked the same slot between our check
    // and our insert.  The partial unique index (uq_bookings_slot_active)
    // guarantees exactly one winner; the loser receives a 409.
    if (insertError.code === PG_UNIQUE_VIOLATION) {
      return NextResponse.json<ApiError>(
        {
          error: {
            code: 'SLOT_UNAVAILABLE',
            message: 'This slot was just booked by someone else.',
          },
        },
        { status: 409 },
      )
    }

    console.error(`${LOG_PREFIX} DB error inserting booking`, {
      slot_id: validSlotId,
      studio_id: validStudioId,
      error: insertError,
    })
    return NextResponse.json<ApiError>(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to create booking.' } },
      { status: 500 },
    )
  }

  const booking = bookingData as {
    id: string
    slot_id: string
    studio_id: string
    status: BookingStatus
    created_at: string
    cancellation_token: string
  }

  // --- Update slot status to 'booked' ------------------------------------
  // Non-critical: the partial unique index already prevents a second booking.
  // If this update fails the slot will remain as 'available' in the UI but
  // any subsequent insert will be blocked by the index — log and continue.
  const { error: slotUpdateError } = await supabaseAdmin
    .from('slots')
    .update({ status: 'booked' })
    .eq('id', validSlotId)

  if (slotUpdateError) {
    console.error(
      `${LOG_PREFIX} Failed to mark slot as booked after successful booking insert`,
      { slot_id: validSlotId, booking_id: booking.id, error: slotUpdateError },
    )
  }

  // --- Build response ---------------------------------------------------
  const responseBooking: BookingCreatedDTO = {
    id: booking.id,
    slot_id: booking.slot_id,
    studio_id: booking.studio_id,
    status: booking.status,
    start_at: slot.start_at,
    end_at: slot.end_at,
    created_at: booking.created_at,
  }

  // --- Notify staff via Telegram (fire-and-forget) ----------------------
  // Do NOT await: Telegram latency must not block the client response.
  notifyStaffNewBooking(booking.id).catch((err: unknown) =>
    console.error(`${LOG_PREFIX} Telegram notify failed`, { booking_id: booking.id, err }),
  )

  return NextResponse.json<CreateBookingResponse>(
    { booking: responseBooking },
    { status: 201 },
  )
}
