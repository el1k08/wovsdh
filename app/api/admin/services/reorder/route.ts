import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import type { ApiError } from '@/lib/types'

function requireAdminAuth(request: NextRequest): boolean {
  return request.headers.get('X-Admin-Secret') === process.env.ADMIN_SECRET_KEY
}

// PUT /api/admin/services/reorder
// Body: { ids: string[] } — ordered array, index becomes new sort_order
export async function PUT(request: NextRequest) {
  if (!requireAdminAuth(request)) {
    return NextResponse.json<ApiError>(
      { error: { code: 'UNAUTHORIZED', message: 'Admin authentication required.' } },
      { status: 401 },
    )
  }

  let body: { ids: string[] }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json<ApiError>(
      { error: { code: 'INVALID_PARAMS', message: 'Invalid JSON body.' } },
      { status: 400 },
    )
  }

  if (!Array.isArray(body.ids) || body.ids.some((id) => typeof id !== 'string')) {
    return NextResponse.json<ApiError>(
      { error: { code: 'INVALID_PARAMS', message: "'ids' must be an array of strings." } },
      { status: 400 },
    )
  }

  await Promise.all(
    body.ids.map((id, index) =>
      supabaseAdmin.from('services').update({ sort_order: index }).eq('id', id),
    ),
  )

  return NextResponse.json({ ok: true })
}
