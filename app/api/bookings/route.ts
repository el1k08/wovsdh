import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import {
  isValidUUID,
  isValidEmail,
  isNonEmptyString,
  studioExists,
} from '@/lib/validation'
import { notifyStaffNewBooking } from '@/lib/notify'
import type {
  ApiError,
  CreateBookingResponse,
  BookingCreatedDTO,
} from '@/lib/types'
import { BookingStatus } from '@/lib/types'

const LOG_PREFIX = '[api/bookings]'

const PG_UNIQUE_VIOLATION = '23505'

// POST /api/bookings
export async function POST(request: NextRequest): Promise<NextResponse> {
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
    service_id,
    start_at,
    client_first_name,
    client_last_name,
    client_phone,
    client_email,
    comment,
    marketing_consent,
    client_id,
    language,
  } = body as Record<string, unknown>

  const validationErrors: string[] = []

  if (!isNonEmptyString(studio_id) || !(await studioExists(studio_id))) {
    validationErrors.push("'studio_id' must be a valid studio ID.")
  }
  if (!isNonEmptyString(service_id) || !isValidUUID(service_id)) {
    validationErrors.push("'service_id' must be a valid UUID.")
  }
  if (!isNonEmptyString(start_at)) {
    validationErrors.push("'start_at' is required.")
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
  if (typeof marketing_consent !== 'boolean') {
    validationErrors.push("'marketing_consent' must be a boolean.")
  }

  if (validationErrors.length > 0) {
    return NextResponse.json<ApiError>(
      { error: { code: 'INVALID_PARAMS', message: validationErrors.join(' ') } },
      { status: 400 },
    )
  }

  const validStudioId = studio_id as string
  const validServiceId = service_id as string
  const validStartAt = (start_at as string).trim()
  const validFirstName = (client_first_name as string).trim()
  const validLastName = (client_last_name as string).trim()
  const validPhone = (client_phone as string).trim()
  const validEmail = (client_email as string).trim()
  const validComment = typeof comment === 'string' && comment.trim() ? comment.trim() : null
  const validConsent = marketing_consent as boolean

  // Fetch service to verify it's active and build the snapshot
  const { data: serviceData, error: serviceError } = await supabaseAdmin
    .from('services')
    .select('id, name, description, price, duration_minutes, icon')
    .eq('id', validServiceId)
    .eq('is_active', true)
    .maybeSingle()

  if (serviceError) {
    console.error(`${LOG_PREFIX} DB error fetching service`, { service_id: validServiceId, error: serviceError })
    return NextResponse.json<ApiError>(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to verify service.' } },
      { status: 500 },
    )
  }

  if (!serviceData) {
    return NextResponse.json<ApiError>(
      { error: { code: 'SERVICE_NOT_FOUND', message: 'Service not found or inactive.' } },
      { status: 404 },
    )
  }

  const service = serviceData as {
    id: string
    name: string
    description: string | null
    price: number
    duration_minutes: number
    icon: string | null
  }

  const serviceSnapshot = {
    id: service.id,
    name: service.name,
    description: service.description,
    price: service.price,
    duration_minutes: service.duration_minutes,
    icon: service.icon,
  }

  const validClientId = typeof client_id === 'string' && client_id.trim() ? client_id.trim() : null
  const validLanguage = language === 'en' || language === 'he' ? language : 'uk'

  // Insert the booking as PENDING first
  const { data: bookingData, error: insertError } = await supabaseAdmin
    .from('bookings')
    .insert({
      studio_id: validStudioId,
      service_id: validServiceId,
      service_snapshot: serviceSnapshot,
      client_first_name: validFirstName,
      client_last_name: validLastName,
      client_phone: validPhone,
      client_email: validEmail,
      comment: validComment,
      marketing_consent: validConsent,
      status: BookingStatus.Pending,
      language: validLanguage,
      ...(validClientId && { client_id: validClientId }),
    })
    .select('id, studio_id, service_id, status, created_at')
    .single()

  if (insertError) {
    console.error(`${LOG_PREFIX} DB error inserting booking`, {
      studio_id: validStudioId,
      service_id: validServiceId,
      error: insertError,
    })
    return NextResponse.json<ApiError>(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to create booking.' } },
      { status: 500 },
    )
  }

  const booking = bookingData as {
    id: string
    studio_id: string
    service_id: string
    status: BookingStatus
    created_at: string
  }

  // Lock the atomic slots via PL/pgSQL. The function uses SELECT FOR UPDATE SKIP LOCKED
  // internally, so concurrent requests for the same window are serialized without
  // application-level locking.
  const { error: lockError } = await supabaseAdmin.client.rpc('lock_booking_slots', {
    p_booking_id: booking.id,
    p_studio_id: validStudioId,
    p_start_at: validStartAt,
    p_duration_minutes: service.duration_minutes,
  })

  if (lockError) {
    // Mark booking CANCELLED before returning 409 — keeps the bookings table consistent.
    await supabaseAdmin
      .from('bookings')
      .update({ status: BookingStatus.Cancelled, cancelled_at: new Date().toISOString() })
      .eq('id', booking.id)

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

    console.error(`${LOG_PREFIX} RPC error lock_booking_slots`, {
      booking_id: booking.id,
      error: lockError,
    })
    return NextResponse.json<ApiError>(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to reserve time slots.' } },
      { status: 500 },
    )
  }

  const durationMs = service.duration_minutes * 60 * 1000
  const endAt = new Date(new Date(validStartAt).getTime() + durationMs).toISOString()

  const responseBooking: BookingCreatedDTO = {
    id: booking.id,
    studio_id: booking.studio_id,
    service_id: booking.service_id,
    status: booking.status,
    start_at: validStartAt,
    end_at: endAt,
    created_at: booking.created_at,
  }

  // Fire-and-forget: Telegram notification must not block the client response
  notifyStaffNewBooking(booking.id).catch((err: unknown) =>
    console.error(`${LOG_PREFIX} Telegram notify failed`, { booking_id: booking.id, err }),
  )

  return NextResponse.json<CreateBookingResponse>({ booking: responseBooking }, { status: 201 })
}
