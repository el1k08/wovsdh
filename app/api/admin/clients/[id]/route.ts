import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { isValidUUID } from '@/lib/validation'
import type { ApiError } from '@/lib/types'

const LOG_PREFIX = '[api/admin/clients/[id]]'

function requireAdminAuth(request: NextRequest): boolean {
  return request.headers.get('X-Admin-Secret') === process.env.ADMIN_SECRET_KEY
}

interface ClientRow {
  id: string
  first_name: string
  last_name: string
  phone: string
  email: string | null
  city: string
  consent: boolean
  created_at: string
  updated_at: string
}

interface ClientBookingRow {
  id: string
  status: string
  service_snapshot: Record<string, unknown>
  studio_id: string
  created_at: string
  booking_slots: Array<{ slot_id: string; slot: { start_at: string } | null }>
}

export interface ClientBookingDTO {
  id: string
  status: string
  start_at: string
  end_at: string
  service_snapshot: Record<string, unknown>
  studio_id: string
  created_at: string
}

// GET /api/admin/clients/[id]
export async function GET(
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
      { error: { code: 'INVALID_PARAMS', message: "Client 'id' must be a valid UUID." } },
      { status: 400 },
    )
  }

  const { data: clientData, error: clientError } = await supabaseAdmin
    .from('clients')
    .select('id, first_name, last_name, phone, email, city, consent, created_at, updated_at')
    .eq('id', id)
    .maybeSingle()

  if (clientError) {
    console.error(`${LOG_PREFIX} DB error fetching client`, { id, error: clientError })
    return NextResponse.json<ApiError>(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch client.' } },
      { status: 500 },
    )
  }

  if (!clientData) {
    return NextResponse.json<ApiError>(
      { error: { code: 'CLIENT_NOT_FOUND', message: 'Client not found.' } },
      { status: 404 },
    )
  }

  const client = clientData as ClientRow

  const { data: bookingsData, error: bookingsError } = await supabaseAdmin
    .from('bookings')
    .select(
      `id, status, service_snapshot, studio_id, created_at,
      booking_slots (
        slot_id,
        slot:slots!booking_slots_slot_id_fkey (start_at)
      )`,
    )
    .eq('client_id', id)

  if (bookingsError) {
    console.error(`${LOG_PREFIX} DB error fetching bookings for client`, { id, error: bookingsError })
    return NextResponse.json<ApiError>(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch bookings.' } },
      { status: 500 },
    )
  }

  const bookings: ClientBookingDTO[] = ((bookingsData ?? []) as unknown as ClientBookingRow[])
    .map((b) => {
      const slotsWithTimes = (b.booking_slots ?? [])
        .map((bs) => bs.slot?.start_at ?? '')
        .filter(Boolean)
        .sort()
      return {
        id: b.id,
        status: b.status,
        start_at: slotsWithTimes[0] ?? '',
        end_at: slotsWithTimes[slotsWithTimes.length - 1] ?? '',
        service_snapshot: b.service_snapshot,
        studio_id: b.studio_id,
        created_at: b.created_at,
      }
    })
    .sort((a, b) => b.start_at.localeCompare(a.start_at))

  return NextResponse.json<{ client: ClientRow; bookings: ClientBookingDTO[] }>({
    client,
    bookings,
  })
}

// PUT /api/admin/clients/[id]
export async function PUT(
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
      { error: { code: 'INVALID_PARAMS', message: "Client 'id' must be a valid UUID." } },
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

  const raw = body as Record<string, unknown>

  // Only allow updating these four fields
  const patch: Partial<{ first_name: string; last_name: string; email: string; city: string }> = {}

  if (typeof raw.first_name === 'string') patch.first_name = raw.first_name.trim()
  if (typeof raw.last_name === 'string') patch.last_name = raw.last_name.trim()
  if (typeof raw.email === 'string') patch.email = raw.email.trim()
  if (typeof raw.city === 'string') patch.city = raw.city.trim()

  if (Object.keys(patch).length === 0) {
    return NextResponse.json<ApiError>(
      {
        error: {
          code: 'INVALID_PARAMS',
          message: 'No updatable fields provided. Allowed: first_name, last_name, email, city.',
        },
      },
      { status: 400 },
    )
  }

  // Check client exists first
  const { data: existingData, error: existingError } = await supabaseAdmin
    .from('clients')
    .select('id')
    .eq('id', id)
    .maybeSingle()

  if (existingError) {
    console.error(`${LOG_PREFIX} DB error checking client existence`, { id, error: existingError })
    return NextResponse.json<ApiError>(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to verify client.' } },
      { status: 500 },
    )
  }

  if (!existingData) {
    return NextResponse.json<ApiError>(
      { error: { code: 'CLIENT_NOT_FOUND', message: 'Client not found.' } },
      { status: 404 },
    )
  }

  const { data: updatedData, error: updateError } = await supabaseAdmin
    .from('clients')
    .update(patch)
    .eq('id', id)
    .select('id, first_name, last_name, phone, email, city, consent, created_at, updated_at')
    .maybeSingle()

  if (updateError) {
    console.error(`${LOG_PREFIX} DB error updating client`, { id, error: updateError })
    return NextResponse.json<ApiError>(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to update client.' } },
      { status: 500 },
    )
  }

  return NextResponse.json<{ client: ClientRow }>({ client: updatedData as ClientRow })
}
