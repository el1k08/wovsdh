import { NextRequest, NextResponse } from 'next/server'
import { getAdminSession } from '@/lib/admin-auth'
import { supabaseAdmin } from '@/lib/supabase'
import { sendMessage } from '@/lib/telegram'
import type { ApiError } from '@/lib/types'

const CODE_TTL_MS = 5 * 60 * 1000 // 5 minutes
const COOKIE_NAME = '2fa_verified'
const COOKIE_TTL_S = 8 * 60 * 60 // 8 hours

function generateCode(): string {
  return String(Math.floor(100000 + Math.random() * 900000))
}

function get2faCookie(request: NextRequest): string | null {
  return request.cookies.get(COOKIE_NAME)?.value ?? null
}

/** Returns whether the session has a valid 2FA cookie */
export function is2faVerified(request: NextRequest, sessionId: string): boolean {
  const cookie = get2faCookie(request)
  return cookie === sessionId
}

// POST /api/admin/auth/2fa
// body: { action: 'send' | 'verify', code?: string }
export async function POST(request: NextRequest) {
  const session = await getAdminSession(request)
  if (!session) {
    return NextResponse.json<ApiError>(
      { error: { code: 'UNAUTHORIZED', message: 'Authentication required.' } },
      { status: 401 },
    )
  }

  const user = session.user as {
    id: string
    email: string
    twoFactorEnabled?: boolean
    telegramChatId?: string | null
  }

  let body: { action: string; code?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json<ApiError>(
      { error: { code: 'INVALID_PARAMS', message: 'Invalid JSON.' } },
      { status: 400 },
    )
  }

  if (body.action === 'send') {
    if (!user.twoFactorEnabled) {
      return NextResponse.json({ required: false })
    }
    if (!user.telegramChatId) {
      return NextResponse.json<ApiError>(
        { error: { code: 'NO_TELEGRAM', message: 'Telegram not configured for 2FA.' } },
        { status: 400 },
      )
    }
    const code = generateCode()
    const expiresAt = new Date(Date.now() + CODE_TTL_MS).toISOString()

    await supabaseAdmin
      .from('user')
      .update({ two_factor_code: code, two_factor_expires_at: expiresAt })
      .eq('id', user.id)

    await sendMessage({
      chat_id: Number(user.telegramChatId),
      text: `🔐 <b>Код підтвердження входу</b>\n\n<code>${code}</code>\n\nДійсний 5 хвилин. Не передавайте нікому.`,
      parse_mode: 'HTML',
    })

    return NextResponse.json({ required: true, sent: true })
  }

  if (body.action === 'verify') {
    if (!body.code) {
      return NextResponse.json<ApiError>(
        { error: { code: 'INVALID_PARAMS', message: 'Code required.' } },
        { status: 400 },
      )
    }

    const { data: userData } = await supabaseAdmin
      .from('user')
      .select('two_factor_code, two_factor_expires_at')
      .eq('id', user.id)
      .single()

    const row = userData as { two_factor_code: string | null; two_factor_expires_at: string | null } | null

    if (!row?.two_factor_code || !row.two_factor_expires_at) {
      return NextResponse.json<ApiError>(
        { error: { code: 'NO_CODE', message: 'No pending code. Request a new one.' } },
        { status: 400 },
      )
    }

    if (new Date(row.two_factor_expires_at) < new Date()) {
      return NextResponse.json<ApiError>(
        { error: { code: 'CODE_EXPIRED', message: 'Code expired. Request a new one.' } },
        { status: 400 },
      )
    }

    if (row.two_factor_code !== body.code.trim()) {
      return NextResponse.json<ApiError>(
        { error: { code: 'INVALID_CODE', message: 'Incorrect code.' } },
        { status: 400 },
      )
    }

    // Clear code and set verified cookie
    await supabaseAdmin
      .from('user')
      .update({ two_factor_code: null, two_factor_expires_at: null })
      .eq('id', user.id)

    const sessionId = (session as { session?: { id?: string } }).session?.id ?? user.id
    const res = NextResponse.json({ ok: true })
    res.cookies.set(COOKIE_NAME, sessionId, {
      httpOnly: true,
      sameSite: 'strict',
      secure: process.env.NODE_ENV === 'production',
      maxAge: COOKIE_TTL_S,
      path: '/',
    })
    return res
  }

  return NextResponse.json<ApiError>(
    { error: { code: 'INVALID_PARAMS', message: 'Unknown action.' } },
    { status: 400 },
  )
}
