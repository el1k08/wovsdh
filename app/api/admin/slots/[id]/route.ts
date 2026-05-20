import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { isValidUUID } from '@/lib/validation'
import type { ApiError, DeleteSlotResponse } from '@/lib/types'
import { BookingStatus } from '@/lib/types'

const LOG_PREFIX = '[api/admin/slots/[id]]'

function requireAdminAuth(request: NextRequest): boolean {
  const secret = request.headers.get('X-Admin-Secret')
  return secret === process.env.ADMIN_SECRET_KEY
}

// DELETE /api/admin/slots/[id]
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  if (!requireAdminAuth(request)) {
    return NextResponse.json<ApiError>(
      { error: { code: 'UNAUTHORIZED', message: 'Invalid or missing X-Admin-Secret header.' } },
      { status: 401 },
    )
  }

  const { id } = await params

  if (!isValidUUID(id)) {
    return NextResponse.json<ApiError>(
      { error: { code: 'INVALID_PARAMS', message: "Slot 'id' must be a valid UUID." } },
      { status: 400 },
    )
  }

  const { data: slotData, error: slotError } = await supabaseAdmin
    .from('slots')
    .select('id, status')
    .eq('id', id)
    .maybeSingle()

  if (slotError) {
    console.error(`${LOG_PREFIX} DB error fetching slot`, { id, slotError })
    return NextResponse.json<ApiError>(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch slot.' } },
      { status: 500 },
    )
  }

  if (!slotData) {
    return NextResponse.json<ApiError>(
      { error: { code: 'SLOT_NOT_FOUND', message: 'Slot not found.' } },
      { status: 404 },
    )
  }

  const slot = slotData as { id: string; status: string }

  // Check whether the slot is claimed by an active booking via booking_slots junction
  const { data: bookingSlotData, error: bookingSlotError } = await supabaseAdmin
    .from('booking_slots')
    .select('booking_id, booking:bookings!booking_slots_booking_id_fkey (id, status)')
    .eq('slot_id', id)
    .limit(1)
    .maybeSingle()

  if (bookingSlotError) {
    console.error(`${LOG_PREFIX} DB error checking booking_slots`, { id, bookingSlotError })
    return NextResponse.json<ApiError>(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to verify slot bookings.' } },
      { status: 500 },
    )
  }

  if (bookingSlotData) {
    const bs = bookingSlotData as unknown as {
      booking_id: string
      booking: { id: string; status: string } | null
    }
    if (bs.booking && bs.booking.status !== BookingStatus.Cancelled) {
      return NextResponse.json<ApiError>(
        {
          error: {
            code: 'SLOT_HAS_ACTIVE_BOOKING',
            message: 'Нельзя удалить слот с активной бронью.',
          },
        },
        { status: 409 },
      )
    }
  }

  const { error: deleteError } = await supabaseAdmin
    .from('slots')
    .delete()
    .eq('id', slot.id)

  if (deleteError) {
    console.error(`${LOG_PREFIX} DB error deleting slot`, { id, deleteError })
    return NextResponse.json<ApiError>(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to delete slot.' } },
      { status: 500 },
    )
  }

  return NextResponse.json<DeleteSlotResponse>(
    { message: 'Слот удалён', id: slot.id },
    { status: 200 },
  )
}
