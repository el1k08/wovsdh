import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import type { ApiError, GetServicesResponse, ServiceDTO } from '@/lib/types'

const LOG_PREFIX = '[api/services]'

// GET /api/services?studio_id=rishon  (studio_id optional)
// When studio_id is provided, returns only services assigned to that studio via studio_services.
// When omitted, returns all active services (used by landing page).
export async function GET(request: NextRequest): Promise<NextResponse> {
  const studioId = request.nextUrl.searchParams.get('studio_id')

  if (studioId) {
    // Look up which service IDs are assigned to this studio
    const { data: assignments, error: assignError } = await supabaseAdmin
      .from('studio_services')
      .select('service_id')
      .eq('studio_id', studioId)

    if (assignError) {
      console.error(`${LOG_PREFIX} DB error fetching assignments`, { studio_id: studioId, error: assignError })
      return NextResponse.json<ApiError>(
        { error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch services.' } },
        { status: 500 },
      )
    }

    const serviceIds = (assignments ?? []).map((a) => a.service_id as string)

    if (serviceIds.length === 0) {
      return NextResponse.json<GetServicesResponse>({ services: [] })
    }

    const { data, error } = await supabaseAdmin
      .from('services')
      .select('id, studio_id, icon, name, description, price, duration_minutes, sort_order')
      .eq('is_active', true)
      .in('id', serviceIds)
      .order('sort_order', { ascending: true })

    if (error) {
      console.error(`${LOG_PREFIX} DB error fetching services by ids`, { studio_id: studioId, error })
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

  // No studio_id — return all active services (landing page)
  const { data, error } = await supabaseAdmin
    .from('services')
    .select('id, studio_id, icon, name, description, price, duration_minutes, sort_order')
    .eq('is_active', true)
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
