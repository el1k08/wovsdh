/**
 * WhatsApp notification helpers via Twilio.
 * Credentials are read from the `settings` DB table first, falling back to env vars.
 * This module is server-side only.
 */

import { supabaseAdmin } from './supabase'
import { decrypt } from './encryption'

const LOG_PREFIX = '[whatsapp]'

interface TwilioSettings {
  accountSid: string
  authToken: string
  from: string
}

async function getTwilioSettings(): Promise<TwilioSettings | null> {
  try {
    const { data } = await supabaseAdmin
      .from('settings')
      .select('key, value')
      .in('key', ['twilio_account_sid', 'twilio_auth_token', 'twilio_whatsapp_from', 'twilio_enabled'])

    if (data && data.length > 0) {
      const raw = Object.fromEntries((data as Array<{ key: string; value: string }>).map((r) => [r.key, r.value]))
      if (
        raw.twilio_enabled === 'true' &&
        raw.twilio_account_sid &&
        raw.twilio_auth_token &&
        raw.twilio_whatsapp_from
      ) {
        return {
          accountSid: decrypt(raw.twilio_account_sid),
          authToken: decrypt(raw.twilio_auth_token),
          from: decrypt(raw.twilio_whatsapp_from),
        }
      }
    }
  } catch {
    // fall through to env vars
  }

  // Fallback: env vars
  if (process.env.WHATSAPP_PROVIDER !== 'twilio') return null
  const sid = process.env.TWILIO_ACCOUNT_SID
  const token = process.env.TWILIO_AUTH_TOKEN
  const from = process.env.TWILIO_WHATSAPP_FROM
  if (!sid || !token || !from) return null
  return { accountSid: sid, authToken: token, from }
}

export async function sendWhatsAppMessage(params: {
  to: string
  body: string
}): Promise<void> {
  const settings = await getTwilioSettings()
  if (!settings) {
    console.warn(`${LOG_PREFIX} Twilio not configured — skipping WhatsApp notification`)
    return
  }

  const { accountSid, authToken, from } = settings
  const formattedFrom = from.startsWith('whatsapp:') ? from : `whatsapp:${from}`
  const formattedTo = params.to.startsWith('whatsapp:') ? params.to : `whatsapp:${params.to}`

  const formBody = new URLSearchParams({
    From: formattedFrom,
    To: formattedTo,
    Body: params.body,
  })

  try {
    const res = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
      {
        method: 'POST',
        headers: {
          Authorization: 'Basic ' + Buffer.from(`${accountSid}:${authToken}`).toString('base64'),
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: formBody.toString(),
      },
    )

    if (!res.ok) {
      const text = await res.text()
      console.error(`${LOG_PREFIX} Twilio API error`, { status: res.status, body: text })
    }
  } catch (err) {
    console.error(`${LOG_PREFIX} fetch failed`, { error: err })
  }
}
