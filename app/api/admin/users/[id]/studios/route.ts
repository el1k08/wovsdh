import { NextRequest, NextResponse } from 'next/server'
import { getAdminSession, getRole } from '@/lib/admin-auth'
import { supabaseAdmin } from '@/lib/supabase'
import type { ApiError } from '@/lib/types'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getAdminSession(request)
  if (!session) {
    return NextResponse.json<ApiError>(
      { error: { code: 'UNAUTHORIZED', message: 'Authentication required.' } },
      { status: 401 },
    )
  }
  const { id } = await params
  const { data, error } = await supabaseAdmin
    .from('user_studios')
    .select('studio_id')
    .eq('user_id', id)
  if (error) {
    return NextResponse.json<ApiError>(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch studios.' } },
      { status: 500 },
    )
  }
  return NextResponse.json({ studios: data.map((r) => r.studio_id) })
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getAdminSession(request)
  if (!session || getRole(session) !== 'admin') {
    return NextResponse.json<ApiError>(
      { error: { code: 'UNAUTHORIZED', message: 'Admin required.' } },
      { status: 401 },
    )
  }
  const { id } = await params
  let body: { studios: string[] }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json<ApiError>(
      { error: { code: 'INVALID_PARAMS', message: 'Invalid JSON.' } },
      { status: 400 },
    )
  }
  await supabaseAdmin.from('user_studios').delete().eq('user_id', id)
  if (body.studios.length > 0) {
    const rows = body.studios.map((studio_id) => ({ user_id: id, studio_id }))
    const { error } = await supabaseAdmin.from('user_studios').insert(rows)
    if (error) {
      return NextResponse.json<ApiError>(
        { error: { code: 'INTERNAL_ERROR', message: 'Failed to assign studios.' } },
        { status: 500 },
      )
    }
  }
  return NextResponse.json({ ok: true })
}
