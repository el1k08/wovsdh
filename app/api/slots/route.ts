import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { isNonEmptyString, isValidDateString, isValidUUID, studioExists } from '@/lib/validation'
import type { ApiError, GetAvailableSlotsResponse, AvailableStartTime } from '@/lib/types'

const LOG_PREFIX = '[api/slots]'

// GET /api/slots?studio_id=rishon&date=2025-05-25&service_id=<uuid>
export async function GET(request: NextRequest): Promise<NextResponse> {
  const { searchParams } = request.nextUrl
  const studioId = searchParams.get('studio_id') ?? ''
  const date = searchParams.get('date') ?? ''
  const serviceId = searchParams.get('service_id') ?? ''

  if (!isNonEmptyString(studioId) || !(await studioExists(studioId))) {
    return NextResponse.json<ApiError>(
      {
        error: {
          code: 'INVALID_PARAMS',
          message: "Query param 'studio_id' must be a valid studio ID.",
        },
      },
      { status: 400 },
    )
  }

  if (!isValidDateString(date)) {
    return NextResponse.json<ApiError>(
      {
        error: {
          code: 'INVALID_PARAMS',
          message:
            "Query param 'date' must be a valid YYYY-MM-DD date that is today or in the future.",
        },
      },
      { status: 400 },
    )
  }

  if (!isValidUUID(serviceId)) {
    return NextResponse.json<ApiError>(
      {
        error: {
          code: 'INVALID_PARAMS',
          message: "Query param 'service_id' must be a valid UUID.",
        },
      },
      { status: 400 },
    )
  }

  const { data: service, error: serviceError } = await supabaseAdmin
    .from('services')
    .select('duration_minutes')
    .eq('id', serviceId)
    .eq('is_active', true)
    .maybeSingle()

  if (serviceError) {
    console.error(`${LOG_PREFIX} DB error fetching service`, { service_id: serviceId, error: serviceError })
    return NextResponse.json<ApiError>(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch service.' } },
      { status: 500 },
    )
  }

  if (!service) {
    return NextResponse.json<ApiError>(
      { error: { code: 'SERVICE_NOT_FOUND', message: 'Service not found or inactive.' } },
      { status: 404 },
    )
  }

  const { data, error } = await supabaseAdmin.client.rpc('find_available_start_times', {
    p_studio_id: studioId,
    p_date: date,
    p_duration_minutes: (service as { duration_minutes: number }).duration_minutes,
  })

  if (error) {
    console.error(`${LOG_PREFIX} RPC error find_available_start_times`, {
      studio_id: studioId,
      date,
      service_id: serviceId,
      error,
    })
    return NextResponse.json<ApiError>(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch available slots.' } },
      { status: 500 },
    )
  }

  const available_start_times: AvailableStartTime[] = (data ?? []).map(
    (row: { start_at: string }) => ({ start_at: row.start_at }),
  )

  return NextResponse.json<GetAvailableSlotsResponse>({ available_start_times })
}
