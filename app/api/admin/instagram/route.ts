import { NextRequest, NextResponse } from 'next/server'
import { verifyAdminRequest } from '@/lib/admin-auth'
import { getInstagramToken, setInstagramToken, deleteInstagramToken, refreshInstagramToken, getInstagramFeed } from '@/lib/instagram'
import type { ApiError } from '@/lib/types'

export async function GET(request: NextRequest) {
  if (!(await verifyAdminRequest(request))) {
    return NextResponse.json<ApiError>(
      { error: { code: 'UNAUTHORIZED', message: 'Admin authentication required.' } },
      { status: 401 },
    )
  }
  const token = await getInstagramToken()
  return NextResponse.json({ connected: !!token })
}

export async function POST(request: NextRequest) {
  if (!(await verifyAdminRequest(request))) {
    return NextResponse.json<ApiError>(
      { error: { code: 'UNAUTHORIZED', message: 'Admin authentication required.' } },
      { status: 401 },
    )
  }
  const body = await request.json() as { token?: string }
  const token = body.token?.trim()
  if (!token) {
    return NextResponse.json<ApiError>(
      { error: { code: 'VALIDATION_ERROR', message: 'Token is required.' } },
      { status: 400 },
    )
  }

  // Try refreshing first (long-lived tokens support this); fall back to validating via feed
  try {
    const refreshed = await refreshInstagramToken(token)
    await setInstagramToken(refreshed)
  } catch {
    try {
      await getInstagramFeed(token, 1)
      await setInstagramToken(token)
    } catch {
      return NextResponse.json<ApiError>(
        { error: { code: 'VALIDATION_ERROR', message: 'Invalid Instagram token.' } },
        { status: 400 },
      )
    }
  }

  return NextResponse.json({ ok: true })
}

export async function DELETE(request: NextRequest) {
  if (!(await verifyAdminRequest(request))) {
    return NextResponse.json<ApiError>(
      { error: { code: 'UNAUTHORIZED', message: 'Admin authentication required.' } },
      { status: 401 },
    )
  }
  await deleteInstagramToken()
  return NextResponse.json({ ok: true })
}
