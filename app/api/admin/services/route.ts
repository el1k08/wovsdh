import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { isNonEmptyString } from '@/lib/validation'
import type { ApiError, GetServicesResponse, ServiceDTO, CreateServiceRequest } from '@/lib/types'

const LOG_PREFIX = '[api/admin/services]'

function requireAdminAuth(request: NextRequest): boolean {
  return request.headers.get('X-Admin-Secret') === process.env.ADMIN_SECRET_KEY
}

// GET /api/admin/services — all services including inactive
export async function GET(request: NextRequest): Promise<NextResponse> {
  if (!requireAdminAuth(request)) {
    return NextResponse.json<ApiError>(
      { error: { code: 'UNAUTHORIZED', message: 'Invalid or missing X-Admin-Secret header.' } },
      { status: 401 },
    )
  }

  const { data, error } = await supabaseAdmin
    .from('services')
    .select('id, studio_id, icon, name, description, price, duration_minutes, sort_order, is_active, created_at')
    .order('sort_order', { ascending: true })

  if (error) {
    console.error(`${LOG_PREFIX} DB error fetching services`, { error })
    return NextResponse.json<ApiError>(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch services.' } },
      { status: 500 },
    )
  }

  const services: ServiceDTO[] = (data ?? []).map((row) => ({
    id: row.id as string,
    studio_id: row.studio_id as string | null,
    icon: row.icon as string | null,
    name: row.name as string,
    description: row.description as string | null,
    price: row.price as number,
    duration_minutes: row.duration_minutes as number,
    sort_order: row.sort_order as number,
  }))

  return NextResponse.json<GetServicesResponse>({ services })
}

// POST /api/admin/services — create a new service
export async function POST(request: NextRequest): Promise<NextResponse> {
  if (!requireAdminAuth(request)) {
    return NextResponse.json<ApiError>(
      { error: { code: 'UNAUTHORIZED', message: 'Invalid or missing X-Admin-Secret header.' } },
      { status: 401 },
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

  const { name, price, duration_minutes, description, icon, studio_id, sort_order } =
    body as Record<string, unknown>

  const validationErrors: string[] = []

  if (!isNonEmptyString(name)) {
    validationErrors.push("'name' is required.")
  }
  if (typeof price !== 'number' || price < 0) {
    validationErrors.push("'price' must be a non-negative number.")
  }
  if (
    typeof duration_minutes !== 'number' ||
    !Number.isInteger(duration_minutes) ||
    duration_minutes < 15 ||
    duration_minutes % 15 !== 0
  ) {
    validationErrors.push("'duration_minutes' must be a positive integer divisible by 15.")
  }

  if (validationErrors.length > 0) {
    return NextResponse.json<ApiError>(
      { error: { code: 'INVALID_PARAMS', message: validationErrors.join(' ') } },
      { status: 400 },
    )
  }

  const req = body as CreateServiceRequest

  const { data, error } = await supabaseAdmin
    .from('services')
    .insert({
      name: (req.name as string).trim(),
      price: req.price,
      duration_minutes: req.duration_minutes,
      description: typeof description === 'string' && description.trim() ? description.trim() : null,
      icon: typeof icon === 'string' && icon.trim() ? icon.trim() : null,
      studio_id: typeof studio_id === 'string' && studio_id.trim() ? studio_id.trim() : null,
      sort_order: typeof sort_order === 'number' ? sort_order : 0,
      is_active: true,
    })
    .select('id, studio_id, icon, name, description, price, duration_minutes, sort_order')
    .single()

  if (error) {
    console.error(`${LOG_PREFIX} DB error creating service`, { error })
    return NextResponse.json<ApiError>(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to create service.' } },
      { status: 500 },
    )
  }

  const service = data as ServiceDTO

  // Also assign to the studio via junction table when studio_id is provided
  if (service.id && typeof studio_id === 'string' && studio_id.trim()) {
    await supabaseAdmin
      .from('studio_services')
      .insert({ studio_id: studio_id.trim(), service_id: service.id })
      .select()
  }

  return NextResponse.json<{ service: ServiceDTO }>({ service }, { status: 201 })
}
