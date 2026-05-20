import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import type { ApiError, GetServicesResponse, ServiceDTO } from '@/lib/types'

const LOG_PREFIX = '[api/services]'

// GET /api/services?studio_id=rishon  (studio_id optional)
export async function GET(request: NextRequest): Promise<NextResponse> {
  const studioId = request.nextUrl.searchParams.get('studio_id')

  let query = supabaseAdmin
    .from('services')
    .select('id, studio_id, icon, name, description, price, duration_minutes, sort_order')
    .eq('is_active', true)
    .order('sort_order', { ascending: true })

  if (studioId) {
    // Include services for this studio OR global services (studio_id IS NULL)
    query = query.or(`studio_id.eq.${studioId},studio_id.is.null`)
  }

  const { data, error } = await query

  if (error) {
    console.error(`${LOG_PREFIX} DB error fetching services`, { studio_id: studioId, error })
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
