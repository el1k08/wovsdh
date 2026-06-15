import { supabaseAdmin } from '@/lib/supabase'
import { sendMessage } from '@/lib/telegram'
import { prettyUserAgent } from '@/lib/user-agent'

export type AuditEvent =
  | 'LOGIN_SUCCESS'
  | 'LOGIN_FAILED'
  | 'OTP_SENT'
  | 'TWO_FACTOR_SUCCESS'
  | 'TWO_FACTOR_FAILED'
  | 'LOGOUT'

type RecordInput = {
  event: AuditEvent
  email?: string | null
  userId?: string | null
  ipAddress?: string | null
  userAgent?: string | null
}

/** Pull client IP + UA from a Headers object. */
export function extractRequestMeta(headers: Headers): {
  ipAddress: string | null
  userAgent: string | null
} {
  const fwd = headers.get('x-forwarded-for')
  const ipAddress = fwd?.split(',')[0]?.trim() || headers.get('x-real-ip') || null
  const userAgent = headers.get('user-agent') || null
  return { ipAddress, userAgent }
}

function isPublicIp(ip: string | null | undefined): ip is string {
  if (!ip) return false
  if (ip === 'unknown' || ip === '::1' || ip === '127.0.0.1') return false
  if (/^10\./.test(ip)) return false
  if (/^192\.168\./.test(ip)) return false
  if (/^172\.(1[6-9]|2\d|3[01])\./.test(ip)) return false
  if (/^fc|^fd|^fe80/i.test(ip)) return false
  return true
}

type Geo = { country?: string; region?: string; city?: string }

/** Best-effort geo lookup via ipapi.co. Returns {} on any failure — never throws. */
async function geoLookup(ip: string | null): Promise<Geo> {
  if (!isPublicIp(ip)) return {}
  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 2500)
    const res = await fetch(`https://ipapi.co/${ip}/json/`, {
      signal: controller.signal,
      headers: { 'User-Agent': 'wovsdh-audit' },
    })
    clearTimeout(timer)
    if (!res.ok) return {}
    const data = (await res.json()) as {
      error?: boolean
      country_name?: string
      country?: string
      region?: string
      city?: string
    }
    if (data?.error) return {}
    return {
      country: data.country_name || data.country || undefined,
      region: data.region || undefined,
      city: data.city || undefined,
    }
  } catch {
    return {}
  }
}

/**
 * Resolve geo for an IP, reusing a previous lookup for the same IP from the
 * audit table when available. Keeps every event located while making at most
 * one external API call per distinct IP (and zero latency on follow-up events
 * like OTP_SENT / TWO_FACTOR_* that share the login's IP).
 */
async function resolveGeo(ip: string | null): Promise<Geo> {
  if (!isPublicIp(ip)) return {}
  const { data } = await supabaseAdmin
    .from('admin_login_audit')
    .select('country, region, city')
    .eq('ip_address', ip)
    .not('country', 'is', null)
    .order('created_at', { ascending: false })
    .limit(1)
  if (data && data.length > 0) {
    const r = data[0] as Geo
    return { country: r.country ?? undefined, region: r.region ?? undefined, city: r.city ?? undefined }
  }
  return geoLookup(ip)
}

async function sendNewLocationAlert(input: {
  userId: string | null
  email: string | null
  ipAddress: string | null
  userAgent: string | null
  country?: string
  region?: string
  city?: string
}) {
  if (!input.userId) return
  const { data } = await supabaseAdmin
    .from('user')
    .select('telegram_chat_id')
    .eq('id', input.userId)
    .single()
  const chatId = (data as { telegram_chat_id: string | null } | null)?.telegram_chat_id
  if (!chatId) return

  const where = [input.city, input.region, input.country].filter(Boolean).join(', ') || input.ipAddress || 'unknown location'
  const lines = [
    '🛡️ <b>Новий вхід в адмінку</b>',
    '⚠️ <i>З місця, якого раніше не було.</i>',
    '',
  ]
  if (input.email) lines.push(`👤 <b>Акаунт:</b> ${input.email}`)
  lines.push(`📍 <b>Місце:</b> ${where}`)
  if (input.ipAddress) lines.push(`🌐 <b>IP:</b> <code>${input.ipAddress}</code>`)
  lines.push(`💻 <b>Пристрій:</b> ${prettyUserAgent(input.userAgent)}`)

  await sendMessage({ chat_id: Number(chatId), text: lines.join('\n'), parse_mode: 'HTML' })
}

/**
 * Record one audit event. Enriches successful logins with geo + new-location
 * detection and fires a Telegram alert when a login comes from a new place.
 * Fully defensive: any failure is swallowed so auth flows are never broken.
 */
export async function recordAuditEvent(input: RecordInput): Promise<void> {
  try {
    const { event, email = null, userId = null, ipAddress = null, userAgent = null } = input

    // Resolve country/region/city for every event (cached per IP).
    const geo = await resolveGeo(ipAddress)
    const { country, region, city } = geo
    let isNewLocation = false

    if (event === 'LOGIN_SUCCESS') {
      // "New location" = no prior successful login from this country (or IP,
      // if geo is unavailable) for this admin.
      let q = supabaseAdmin
        .from('admin_login_audit')
        .select('id')
        .eq('event', 'LOGIN_SUCCESS')
        .limit(1)
      if (userId) q = q.eq('user_id', userId)
      else if (email) q = q.eq('email', email)
      if (country) q = q.eq('country', country)
      else if (ipAddress) q = q.eq('ip_address', ipAddress)

      const { data: prior } = await q
      isNewLocation = !prior || prior.length === 0
    }

    await supabaseAdmin.from('admin_login_audit').insert({
      event,
      email,
      user_id: userId,
      ip_address: ipAddress,
      user_agent: userAgent,
      country: country ?? null,
      region: region ?? null,
      city: city ?? null,
      is_new_location: isNewLocation,
    })

    if (event === 'LOGIN_SUCCESS' && isNewLocation) {
      sendNewLocationAlert({ userId, email, ipAddress, userAgent, country, region, city }).catch((err) =>
        console.error('[audit] new-location alert failed', err),
      )
    }
  } catch (err) {
    console.error('[audit] recordAuditEvent failed', err)
  }
}
