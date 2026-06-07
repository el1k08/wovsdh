import { NextRequest, NextResponse } from 'next/server'
import { getAdminSession } from '@/lib/admin-auth'
import { auth } from '@/lib/auth'
import type { ApiError } from '@/lib/types'

export async function GET(request: NextRequest) {
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
    name: string
    role?: string
    telegramChatId?: string | null
    twoFactorEnabled?: boolean
  }
  return NextResponse.json({
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role ?? 'admin',
    telegramChatId: user.telegramChatId ?? null,
    twoFactorEnabled: user.twoFactorEnabled ?? false,
  })
}

export async function PATCH(request: NextRequest) {
  const session = await getAdminSession(request)
  if (!session) {
    return NextResponse.json<ApiError>(
      { error: { code: 'UNAUTHORIZED', message: 'Authentication required.' } },
      { status: 401 },
    )
  }

  let body: { telegramChatId?: string | null; twoFactorEnabled?: boolean; name?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json<ApiError>(
      { error: { code: 'INVALID_PARAMS', message: 'Invalid JSON.' } },
      { status: 400 },
    )
  }

  const updateData: Record<string, unknown> = {}
  if ('telegramChatId' in body) updateData.telegramChatId = body.telegramChatId ?? null
  if ('twoFactorEnabled' in body) updateData.twoFactorEnabled = body.twoFactorEnabled
  if ('name' in body && body.name) updateData.name = body.name

  if (Object.keys(updateData).length === 0) {
    return NextResponse.json({ ok: true })
  }

  try {
    await auth.api.updateUser({
      body: updateData,
      headers: request.headers,
    })
    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('updateUser error:', e)
    return NextResponse.json<ApiError>(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to update profile.' } },
      { status: 500 },
    )
  }
}
