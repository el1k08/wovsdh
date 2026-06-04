import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { sendMessage } from '@/lib/telegram'
import type { ApiError } from '@/lib/types'

const LOG_PREFIX = '[api/admin/telegram/users/[id]]'

function requireAdminAuth(request: NextRequest): boolean {
  return request.headers.get('X-Admin-Secret') === process.env.ADMIN_SECRET_KEY
}

// PATCH /api/admin/telegram/users/[id] — toggle is_active
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  if (!requireAdminAuth(request)) {
    return NextResponse.json<ApiError>(
      { error: { code: 'UNAUTHORIZED', message: 'Invalid or missing X-Admin-Secret header.' } },
      { status: 401 },
    )
  }

  const { id } = await params

  let body: { is_active?: unknown }
  try {
    body = (await request.json()) as { is_active?: unknown }
  } catch {
    return NextResponse.json<ApiError>(
      { error: { code: 'INVALID_BODY', message: 'Invalid JSON body.' } },
      { status: 400 },
    )
  }

  if (typeof body.is_active !== 'boolean') {
    return NextResponse.json<ApiError>(
      { error: { code: 'VALIDATION_ERROR', message: 'is_active must be boolean.' } },
      { status: 400 },
    )
  }

  const { error } = await supabaseAdmin
    .from('allowed_users')
    .update({ is_active: body.is_active })
    .eq('id', id)

  if (error) {
    console.error(`${LOG_PREFIX} DB error updating user`, { id, error })
    return NextResponse.json<ApiError>(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to update user.' } },
      { status: 500 },
    )
  }

  return NextResponse.json({ ok: true })
}

// DELETE /api/admin/telegram/users/[id]
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  if (!requireAdminAuth(request)) {
    return NextResponse.json<ApiError>(
      { error: { code: 'UNAUTHORIZED', message: 'Invalid or missing X-Admin-Secret header.' } },
      { status: 401 },
    )
  }

  const { id } = await params

  const { error } = await supabaseAdmin
    .from('allowed_users')
    .delete()
    .eq('id', id)

  if (error) {
    console.error(`${LOG_PREFIX} DB error deleting user`, { id, error })
    return NextResponse.json<ApiError>(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to delete user.' } },
      { status: 500 },
    )
  }

  return NextResponse.json({ ok: true })
}

// POST /api/admin/telegram/users/[id] — send test message
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  if (!requireAdminAuth(request)) {
    return NextResponse.json<ApiError>(
      { error: { code: 'UNAUTHORIZED', message: 'Invalid or missing X-Admin-Secret header.' } },
      { status: 401 },
    )
  }

  const { id } = await params

  const { data, error } = await supabaseAdmin
    .from('allowed_users')
    .select('telegram_chat_id, name')
    .eq('id', id)
    .single()

  if (error || !data) {
    return NextResponse.json<ApiError>(
      { error: { code: 'CLIENT_NOT_FOUND', message: 'User not found.' } },
      { status: 404 },
    )
  }

  const user = data as { telegram_chat_id: number; name: string }

  const result = await sendMessage({
    chat_id: user.telegram_chat_id,
    text:
      `✅ <b>Тестове повідомлення</b>\n\n` +
      `Привіт, <b>${user.name}</b>! Сповіщення налаштовані правильно.\n` +
      `Ви будете отримувати повідомлення про нові записи.`,
    parse_mode: 'HTML',
  })

  if (!result.ok) {
    console.error(`${LOG_PREFIX} Telegram sendMessage failed`, { id, result })
    return NextResponse.json<ApiError>(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to send Telegram message. Check the bot token and chat ID.' } },
      { status: 500 },
    )
  }

  return NextResponse.json({ ok: true })
}
