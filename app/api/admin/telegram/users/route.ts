import { NextRequest, NextResponse } from 'next/server'
import { verifyAdminRequest } from '@/lib/admin-auth'
import { supabaseAdmin } from '@/lib/supabase'
import type { ApiError } from '@/lib/types'

export const dynamic = 'force-dynamic'

const LOG_PREFIX = '[api/admin/telegram/users]'

// GET /api/admin/telegram/users
export async function GET(request: NextRequest): Promise<NextResponse> {
  if (!(await verifyAdminRequest(request))) {
    return NextResponse.json<ApiError>(
      { error: { code: 'UNAUTHORIZED', message: 'Invalid or missing X-Admin-Secret header.' } },
      { status: 401 },
    )
  }

  const { data, error } = await supabaseAdmin
    .from('allowed_users')
    .select('id, telegram_chat_id, name, is_active, added_at')
    .order('added_at', { ascending: false })

  if (error) {
    console.error(`${LOG_PREFIX} DB error fetching users`, { error })
    return NextResponse.json<ApiError>(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch users.' } },
      { status: 500 },
    )
  }

  return NextResponse.json({ users: data ?? [] })
}

// POST /api/admin/telegram/users
export async function POST(request: NextRequest): Promise<NextResponse> {
  if (!(await verifyAdminRequest(request))) {
    return NextResponse.json<ApiError>(
      { error: { code: 'UNAUTHORIZED', message: 'Invalid or missing X-Admin-Secret header.' } },
      { status: 401 },
    )
  }

  let body: { name?: unknown; telegram_chat_id?: unknown }
  try {
    body = (await request.json()) as { name?: unknown; telegram_chat_id?: unknown }
  } catch {
    return NextResponse.json<ApiError>(
      { error: { code: 'INVALID_BODY', message: 'Invalid JSON body.' } },
      { status: 400 },
    )
  }

  const name = typeof body.name === 'string' ? body.name.trim() : ''
  const rawId = body.telegram_chat_id
  const chatId = Number(rawId)

  if (!name) {
    return NextResponse.json<ApiError>(
      { error: { code: 'VALIDATION_ERROR', message: 'name is required.' } },
      { status: 400 },
    )
  }

  if (!Number.isInteger(chatId) || chatId <= 0) {
    return NextResponse.json<ApiError>(
      { error: { code: 'VALIDATION_ERROR', message: 'telegram_chat_id must be a positive integer.' } },
      { status: 400 },
    )
  }

  const { data, error } = await supabaseAdmin
    .from('allowed_users')
    .upsert(
      { telegram_chat_id: chatId, name, is_active: true },
      { onConflict: 'telegram_chat_id' },
    )
    .select('id, telegram_chat_id, name, is_active, added_at')
    .single()

  if (error) {
    console.error(`${LOG_PREFIX} DB error upserting user`, { error })
    return NextResponse.json<ApiError>(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to save user.' } },
      { status: 500 },
    )
  }

  return NextResponse.json({ user: data }, { status: 201 })
}
