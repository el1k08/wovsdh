import { NextRequest, NextResponse } from 'next/server'
import { verifyAdminRequest } from '@/lib/admin-auth'
import { supabaseAdmin } from '@/lib/supabase'
import type { ApiError } from '@/lib/types'

const LOG_PREFIX = '[api/admin/users]'

// GET /api/admin/users — list all auth users
export async function GET(request: NextRequest): Promise<NextResponse> {
  if (!(await verifyAdminRequest(request))) {
    return NextResponse.json<ApiError>(
      { error: { code: 'UNAUTHORIZED', message: 'Admin authentication required.' } },
      { status: 401 },
    )
  }

  const { data, error } = await supabaseAdmin.client.auth.admin.listUsers()
  if (error) {
    console.error(`${LOG_PREFIX} Failed to list users`, { error })
    return NextResponse.json<ApiError>(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to list users.' } },
      { status: 500 },
    )
  }

  const users = data.users.map((u) => ({
    id: u.id,
    email: u.email ?? '',
    created_at: u.created_at,
  }))

  return NextResponse.json({ users })
}

// POST /api/admin/users — create a new user
export async function POST(request: NextRequest): Promise<NextResponse> {
  if (!(await verifyAdminRequest(request))) {
    return NextResponse.json<ApiError>(
      { error: { code: 'UNAUTHORIZED', message: 'Admin authentication required.' } },
      { status: 401 },
    )
  }

  let body: { email?: unknown; password?: unknown }
  try {
    body = (await request.json()) as { email?: unknown; password?: unknown }
  } catch {
    return NextResponse.json<ApiError>(
      { error: { code: 'INVALID_BODY', message: 'Invalid JSON body.' } },
      { status: 400 },
    )
  }

  const email = typeof body.email === 'string' ? body.email.trim() : ''
  const password = typeof body.password === 'string' ? body.password : ''

  if (!email || !password || password.length < 8) {
    return NextResponse.json<ApiError>(
      { error: { code: 'VALIDATION_ERROR', message: 'email and password (min 8 chars) are required.' } },
      { status: 400 },
    )
  }

  const { data, error } = await supabaseAdmin.client.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  })

  if (error) {
    console.error(`${LOG_PREFIX} Failed to create user`, { email, error })
    return NextResponse.json<ApiError>(
      { error: { code: 'INTERNAL_ERROR', message: error.message } },
      { status: 500 },
    )
  }

  return NextResponse.json({
    user: { id: data.user.id, email: data.user.email ?? email, created_at: data.user.created_at },
  }, { status: 201 })
}
