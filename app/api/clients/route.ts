import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { isNonEmptyString, isValidEmail } from '@/lib/validation'
import { normalizePhone } from '@/lib/phone-utils'
import type {
  ApiError,
  Client,
  CreateClientRequest,
  ClientLookupResponse,
} from '@/lib/types'

const LOG_PREFIX = '[api/clients]'

// Postgres unique-violation error code
const PG_UNIQUE_VIOLATION = '23505'

// ---------------------------------------------------------------------------
// DB row → Client DTO mapping
// ---------------------------------------------------------------------------

type ClientRow = {
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

function toClientDTO(row: ClientRow): Client {
  return {
    id: row.id,
    firstName: row.first_name,
    lastName: row.last_name,
    phone: row.phone,
    email: row.email ?? undefined,
    city: row.city,
    consent: row.consent,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

// ---------------------------------------------------------------------------
// GET /api/clients?phone=+972526262272
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest): Promise<NextResponse> {
  const rawPhone = request.nextUrl.searchParams.get('phone')

  if (!rawPhone || !rawPhone.trim()) {
    return NextResponse.json<ApiError>(
      { error: { code: 'INVALID_PARAMS', message: "'phone' query parameter is required." } },
      { status: 400 },
    )
  }

  const phone = normalizePhone(rawPhone.trim())

  const { data, error } = await supabaseAdmin
    .from('clients')
    .select('id, first_name, last_name, phone, email, city, consent, created_at, updated_at')
    .eq('phone', phone)
    .maybeSingle()

  if (error) {
    console.error(`${LOG_PREFIX} DB error looking up client by phone`, { phone, error })
    return NextResponse.json<ApiError>(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to look up client.' } },
      { status: 500 },
    )
  }

  if (!data) {
    return NextResponse.json<ClientLookupResponse>({ found: false }, { status: 404 })
  }

  return NextResponse.json<ClientLookupResponse>(
    { found: true, client: toClientDTO(data as ClientRow) },
    { status: 200 },
  )
}

// ---------------------------------------------------------------------------
// POST /api/clients
// ---------------------------------------------------------------------------

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

  const { firstName, lastName, phone, email, city, consent } =
    body as Partial<CreateClientRequest>

  const validationErrors: string[] = []

  if (!isNonEmptyString(firstName)) {
    validationErrors.push("'firstName' is required.")
  }
  if (!isNonEmptyString(lastName)) {
    validationErrors.push("'lastName' is required.")
  }
  if (!isNonEmptyString(phone)) {
    validationErrors.push("'phone' is required.")
  }
  if (!isNonEmptyString(city)) {
    validationErrors.push("'city' is required.")
  }
  if (consent !== true) {
    validationErrors.push("'consent' must be true.")
  }
  if (email !== undefined && email !== null && email !== '' && !isValidEmail(email)) {
    validationErrors.push("'email' must be a valid email address when provided.")
  }

  if (validationErrors.length > 0) {
    return NextResponse.json<ApiError>(
      { error: { code: 'INVALID_PARAMS', message: validationErrors.join(' ') } },
      { status: 400 },
    )
  }

  const normalizedPhone = normalizePhone((phone as string).trim())
  const cleanEmail =
    typeof email === 'string' && email.trim().length > 0 ? email.trim() : null

  const { data, error } = await supabaseAdmin
    .from('clients')
    .insert({
      first_name: (firstName as string).trim(),
      last_name: (lastName as string).trim(),
      phone: normalizedPhone,
      email: cleanEmail,
      city: (city as string).trim(),
      consent: true,
    })
    .select('id, first_name, last_name, phone, email, city, consent, created_at, updated_at')
    .single()

  if (error) {
    if (error.code === PG_UNIQUE_VIOLATION) {
      return NextResponse.json<ApiError>(
        {
          error: {
            code: 'PHONE_ALREADY_EXISTS',
            message: 'A client with this phone number already exists.',
          },
        },
        { status: 409 },
      )
    }

    console.error(`${LOG_PREFIX} DB error inserting client`, {
      phone: normalizedPhone,
      error,
    })
    return NextResponse.json<ApiError>(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to create client.' } },
      { status: 500 },
    )
  }

  return NextResponse.json<{ client: Client }>(
    { client: toClientDTO(data as ClientRow) },
    { status: 201 },
  )
}
