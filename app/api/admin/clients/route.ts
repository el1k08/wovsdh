import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import type { ApiError } from '@/lib/types'

const LOG_PREFIX = '[api/admin/clients]'

function requireAdminAuth(request: NextRequest): boolean {
  return request.headers.get('X-Admin-Secret') === process.env.ADMIN_SECRET_KEY
}

export interface AdminClientDTO {
  id: string
  first_name: string
  last_name: string
  phone: string
  email: string | null
  city: string
  consent: boolean
  created_at: string
}

export interface GetAdminClientsResponse {
  clients: AdminClientDTO[]
  total: number
  page: number
  limit: number
}

// GET /api/admin/clients?search=&page=1&limit=50
export async function GET(request: NextRequest): Promise<NextResponse> {
  if (!requireAdminAuth(request)) {
    return NextResponse.json<ApiError>(
      { error: { code: 'UNAUTHORIZED', message: 'Invalid or missing X-Admin-Secret header.' } },
      { status: 401 },
    )
  }

  const { searchParams } = request.nextUrl
  const search = searchParams.get('search')?.trim() ?? ''
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10) || 1)
  const limit = Math.min(200, Math.max(1, parseInt(searchParams.get('limit') ?? '50', 10) || 50))
  const offset = (page - 1) * limit

  // Build query
  let countQuery = supabaseAdmin
    .from('clients')
    .select('id', { count: 'exact', head: true })

  let dataQuery = supabaseAdmin
    .from('clients')
    .select('id, first_name, last_name, phone, email, city, consent, created_at')
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (search) {
    const pattern = `%${search}%`
    const filter = `first_name.ilike.${pattern},last_name.ilike.${pattern},phone.ilike.${pattern}`
    countQuery = countQuery.or(filter)
    dataQuery = dataQuery.or(filter)
  }

  const [countResult, dataResult] = await Promise.all([countQuery, dataQuery])

  if (countResult.error) {
    console.error(`${LOG_PREFIX} DB error counting clients`, { error: countResult.error })
    return NextResponse.json<ApiError>(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to count clients.' } },
      { status: 500 },
    )
  }

  if (dataResult.error) {
    console.error(`${LOG_PREFIX} DB error fetching clients`, { error: dataResult.error })
    return NextResponse.json<ApiError>(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch clients.' } },
      { status: 500 },
    )
  }

  const clients = (dataResult.data ?? []) as AdminClientDTO[]
  const total = countResult.count ?? 0

  return NextResponse.json<GetAdminClientsResponse>({ clients, total, page, limit })
}
