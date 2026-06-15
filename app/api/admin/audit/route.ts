import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { getAdminSession, getRole } from '@/lib/admin-auth'
import { supabaseAdmin } from '@/lib/supabase'
import type { ApiError } from '@/lib/types'

const UNAUTH = NextResponse.json<ApiError>(
  { error: { code: 'UNAUTHORIZED', message: 'Authentication required.' } },
  { status: 401 },
)

// GET /api/admin/audit → { logs, sessions, currentSessionToken }
export async function GET(request: NextRequest) {
  const session = await getAdminSession(request)
  if (!session) return UNAUTH
  if (getRole(session) !== 'admin') {
    return NextResponse.json<ApiError>(
      { error: { code: 'UNAUTHORIZED', message: 'Admins only.' } },
      { status: 403 },
    )
  }

  const { data: logs, error } = await supabaseAdmin
    .from('admin_login_audit')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(100)

  if (error) {
    return NextResponse.json<ApiError>(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to load audit log.' } },
      { status: 500 },
    )
  }

  let sessions: unknown[] = []
  try {
    sessions = (await auth.api.listSessions({ headers: request.headers })) as unknown[]
  } catch {
    sessions = []
  }

  const currentSessionToken = (session as { session?: { token?: string } }).session?.token ?? null

  return NextResponse.json({ logs: logs ?? [], sessions, currentSessionToken })
}

// POST /api/admin/audit  body: { token } → revoke a session
export async function POST(request: NextRequest) {
  const session = await getAdminSession(request)
  if (!session) return UNAUTH
  if (getRole(session) !== 'admin') {
    return NextResponse.json<ApiError>(
      { error: { code: 'UNAUTHORIZED', message: 'Admins only.' } },
      { status: 403 },
    )
  }

  let body: { token?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json<ApiError>(
      { error: { code: 'INVALID_PARAMS', message: 'Invalid JSON.' } },
      { status: 400 },
    )
  }

  if (!body.token) {
    return NextResponse.json<ApiError>(
      { error: { code: 'INVALID_PARAMS', message: 'Token required.' } },
      { status: 400 },
    )
  }

  try {
    await auth.api.revokeSession({ headers: request.headers, body: { token: body.token } })
  } catch {
    return NextResponse.json<ApiError>(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to revoke session.' } },
      { status: 500 },
    )
  }

  return NextResponse.json({ ok: true })
}
