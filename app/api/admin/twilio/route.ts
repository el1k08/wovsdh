import { NextRequest, NextResponse } from 'next/server'
import { verifyAdminRequest } from '@/lib/admin-auth'
import { supabaseAdmin } from '@/lib/supabase'
import { encrypt, decrypt } from '@/lib/encryption'
import { sendWhatsAppMessage } from '@/lib/whatsapp'
import type { ApiError } from '@/lib/types'

const KEYS = ['twilio_account_sid', 'twilio_auth_token', 'twilio_whatsapp_from', 'twilio_enabled'] as const

const SENSITIVE_KEYS = ['twilio_account_sid', 'twilio_auth_token', 'twilio_whatsapp_from']

async function getSettings() {
  const { data } = await supabaseAdmin
    .from('settings')
    .select('key, value')
    .in('key', [...KEYS])
  const raw = Object.fromEntries((data ?? []).map((r: { key: string; value: string }) => [r.key, r.value]))
  // Decrypt sensitive fields for internal use
  const map: Record<string, string> = {}
  for (const [k, v] of Object.entries(raw)) {
    map[k] = SENSITIVE_KEYS.includes(k) ? (() => { try { return decrypt(v) } catch { return v } })() : v
  }
  return map
}

async function upsert(key: string, value: string) {
  await supabaseAdmin
    .from('settings')
    .upsert({ key, value, updated_at: new Date().toISOString() }, { onConflict: 'key' })
}

export async function GET(request: NextRequest) {
  if (!(await verifyAdminRequest(request))) {
    return NextResponse.json<ApiError>(
      { error: { code: 'UNAUTHORIZED', message: 'Admin authentication required.' } },
      { status: 401 },
    )
  }
  const map = await getSettings()
  return NextResponse.json({
    enabled: map.twilio_enabled === 'true',
    from: map.twilio_whatsapp_from ?? null,
    configured: !!(map.twilio_account_sid && map.twilio_auth_token && map.twilio_whatsapp_from),
  })
}

export async function POST(request: NextRequest) {
  if (!(await verifyAdminRequest(request))) {
    return NextResponse.json<ApiError>(
      { error: { code: 'UNAUTHORIZED', message: 'Admin authentication required.' } },
      { status: 401 },
    )
  }
  const body = await request.json() as {
    accountSid?: string
    authToken?: string
    from?: string
    enabled?: boolean
    action?: 'test'
    testPhone?: string
  }

  if (body.action === 'test') {
    const phone = body.testPhone?.trim()
    if (!phone) {
      return NextResponse.json<ApiError>(
        { error: { code: 'VALIDATION_ERROR', message: 'testPhone is required.' } },
        { status: 400 },
      )
    }
    try {
      await sendWhatsAppMessage({ to: phone, body: '✅ Тест WhatsApp-уведомлений работает!' })
      return NextResponse.json({ ok: true })
    } catch {
      return NextResponse.json<ApiError>(
        { error: { code: 'INTERNAL_ERROR', message: 'Failed to send test message.' } },
        { status: 500 },
      )
    }
  }

  const sid = body.accountSid?.trim()
  const token = body.authToken?.trim()
  const from = body.from?.trim()

  if (!sid || !token || !from) {
    return NextResponse.json<ApiError>(
      { error: { code: 'VALIDATION_ERROR', message: 'accountSid, authToken and from are required.' } },
      { status: 400 },
    )
  }

  await Promise.all([
    upsert('twilio_account_sid', encrypt(sid)),
    upsert('twilio_auth_token', encrypt(token)),
    upsert('twilio_whatsapp_from', encrypt(from)),
    upsert('twilio_enabled', body.enabled !== false ? 'true' : 'false'),
  ])

  return NextResponse.json({ ok: true })
}

export async function PATCH(request: NextRequest) {
  if (!(await verifyAdminRequest(request))) {
    return NextResponse.json<ApiError>(
      { error: { code: 'UNAUTHORIZED', message: 'Admin authentication required.' } },
      { status: 401 },
    )
  }
  const body = await request.json() as { enabled?: boolean }
  if (typeof body.enabled === 'boolean') {
    await upsert('twilio_enabled', body.enabled ? 'true' : 'false')
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
  await supabaseAdmin.from('settings').delete().in('key', [...KEYS])
  return NextResponse.json({ ok: true })
}
