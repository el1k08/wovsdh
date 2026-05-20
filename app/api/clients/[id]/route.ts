import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { isNonEmptyString, isValidEmail } from '@/lib/validation'
import type { ApiError, Client, UpdateClientRequest } from '@/lib/types'

const LOG_PREFIX = '[api/clients/[id]]'

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
// PUT /api/clients/[id]
// Allowed updates: firstName, lastName, email, consent.
// phone is immutable and silently ignored if provided.
// ---------------------------------------------------------------------------

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id } = await params

  if (!isNonEmptyString(id)) {
    return NextResponse.json<ApiError>(
      { error: { code: 'INVALID_PARAMS', message: "Client 'id' is required." } },
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

  const { firstName, lastName, email, consent } = body as UpdateClientRequest

  const updates: Record<string, unknown> = {}

  if (firstName !== undefined) {
    if (!isNonEmptyString(firstName)) {
      return NextResponse.json<ApiError>(
        { error: { code: 'INVALID_PARAMS', message: "'firstName' must be a non-empty string." } },
        { status: 400 },
      )
    }
    updates.first_name = firstName.trim()
  }

  if (lastName !== undefined) {
    if (!isNonEmptyString(lastName)) {
      return NextResponse.json<ApiError>(
        { error: { code: 'INVALID_PARAMS', message: "'lastName' must be a non-empty string." } },
        { status: 400 },
      )
    }
    updates.last_name = lastName.trim()
  }

  if (email !== undefined) {
    if (email === null || (email as unknown) === '') {
      // Allow clearing the email field
      updates.email = null
    } else if (!isValidEmail(email)) {
      return NextResponse.json<ApiError>(
        { error: { code: 'INVALID_PARAMS', message: "'email' must be a valid email address." } },
        { status: 400 },
      )
    } else {
      updates.email = email.trim()
    }
  }

  if (consent !== undefined) {
    if (typeof consent !== 'boolean') {
      return NextResponse.json<ApiError>(
        { error: { code: 'INVALID_PARAMS', message: "'consent' must be a boolean." } },
        { status: 400 },
      )
    }
    updates.consent = consent
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json<ApiError>(
      { error: { code: 'INVALID_PARAMS', message: 'No updatable fields provided.' } },
      { status: 400 },
    )
  }

  const { data, error } = await supabaseAdmin
    .from('clients')
    .update(updates)
    .eq('id', id)
    .select('id, first_name, last_name, phone, email, city, consent, created_at, updated_at')
    .maybeSingle()

  if (error) {
    console.error(`${LOG_PREFIX} DB error updating client`, { id, error })
    return NextResponse.json<ApiError>(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to update client.' } },
      { status: 500 },
    )
  }

  if (!data) {
    return NextResponse.json<ApiError>(
      { error: { code: 'CLIENT_NOT_FOUND', message: 'Client not found.' } },
      { status: 404 },
    )
  }

  return NextResponse.json<{ client: Client }>(
    { client: toClientDTO(data as ClientRow) },
    { status: 200 },
  )
}
