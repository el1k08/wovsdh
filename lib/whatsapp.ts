/**
 * WhatsApp notification helpers via Twilio.
 * All HTTP calls use native fetch — no third-party SDKs.
 * This module is server-side only.
 */

const LOG_PREFIX = '[whatsapp]'

export async function sendWhatsAppMessage(params: {
  to: string;
  body: string;
}): Promise<void> {
  if (process.env.WHATSAPP_PROVIDER !== 'twilio') {
    return
  }

  const sid = process.env.TWILIO_ACCOUNT_SID
  const token = process.env.TWILIO_AUTH_TOKEN
  const from = process.env.TWILIO_WHATSAPP_FROM

  if (!sid || !token || !from) {
    console.warn(`${LOG_PREFIX} Twilio env vars missing — skipping WhatsApp notification`)
    return
  }

  const formBody = new URLSearchParams({
    From: from,
    To: `whatsapp:${params.to}`,
    Body: params.body,
  })

  try {
    const res = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`,
      {
        method: 'POST',
        headers: {
          'Authorization': 'Basic ' + Buffer.from(`${sid}:${token}`).toString('base64'),
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
