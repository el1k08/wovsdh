import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { resolveLocale } from '@/lib/locale-utils'
import type { ApiError, GetServicesResponse, ServiceDTO, ServiceTranslations } from '@/lib/types'

const LOG_PREFIX = '[api/services]'

function mapRow(row: Record<string, unknown>, language: ReturnType<typeof resolveLocale>): ServiceDTO {
  const translations = (row.translations ?? {}) as ServiceTranslations
  const tr = translations[language]
  return {
    id: row.id as string,
    studio_id: row.studio_id as string | null,
    icon: row.icon as string | null,
    name: tr?.name || (row.name as string),
    description: tr?.description || (row.description as string | null),
    price: row.price as number,
    duration_minutes: row.duration_minutes as number,
    sort_order: row.sort_order as number,
    translations,
  }
}

// GET /api/services?studio_id=rishon&language=uk
// When studio_id is provided, returns only services assigned to that studio via studio_services.
// When omitted, returns all active services (used by landing page).
// language param (uk|en|he, default uk) controls which locale is used for name/description.
export async function GET(request: NextRequest): Promise<NextResponse> {
  const studioId = request.nextUrl.searchParams.get('studio_id')
  const language = resolveLocale(request.nextUrl.searchParams.get('language'))

  if (studioId) {
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
      .select('id, studio_id, icon, name, description, price, duration_minutes, sort_order, translations')
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

    return NextResponse.json<GetServicesResponse>({
      services: (data ?? []).map((row) => mapRow(row as Record<string, unknown>, language)),
    })
  }

  const { data, error } = await supabaseAdmin
    .from('services')
    .select('id, studio_id, icon, name, description, price, duration_minutes, sort_order, translations')
    .eq('is_active', true)
    .order('sort_order', { ascending: true })

  if (error) {
    console.error(`${LOG_PREFIX} DB error fetching services`, { error })
    return NextResponse.json<ApiError>(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch services.' } },
      { status: 500 },
    )
  }

  return NextResponse.json<GetServicesResponse>({
    services: (data ?? []).map((row) => mapRow(row as Record<string, unknown>, language)),
  })
}
