/**
 * Telegram Bot API helpers.
 * All communication is done via the native fetch API — no third-party libraries.
 * This module is server-side only: it reads TELEGRAM_BOT_TOKEN from env at call-time.
 */

import { supabaseAdmin } from '@/lib/supabase'

// ---------------------------------------------------------------------------
// Base URL — resolved lazily at call-time so the module can be imported in
// environments where the env var may not yet be set (e.g. during type-check).
// ---------------------------------------------------------------------------

function baseUrl(): string {
  return `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}`
}

// ---------------------------------------------------------------------------
// Inline keyboard types
// ---------------------------------------------------------------------------

export interface InlineKeyboardButton {
  text: string
  callback_data: string
}

export interface InlineKeyboardMarkup {
  inline_keyboard: InlineKeyboardButton[][]
}

// ---------------------------------------------------------------------------
// sendMessage
// ---------------------------------------------------------------------------

export async function sendMessage(params: {
  chat_id: number
  text: string
  parse_mode?: 'HTML' | 'Markdown'
  reply_markup?: InlineKeyboardMarkup
}): Promise<{ ok: boolean; result?: { message_id: number } }> {
  const res = await fetch(`${baseUrl()}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  })

  const data = (await res.json()) as { ok: boolean; result?: { message_id: number } }
  return data
}

// ---------------------------------------------------------------------------
// answerCallbackQuery
// ---------------------------------------------------------------------------

export async function answerCallbackQuery(params: {
  callback_query_id: string
  text?: string
  show_alert?: boolean
}): Promise<void> {
  await fetch(`${baseUrl()}/answerCallbackQuery`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  })
}

// ---------------------------------------------------------------------------
// editMessageText
// ---------------------------------------------------------------------------

export async function editMessageText(params: {
  chat_id: number
  message_id: number
  text: string
  parse_mode?: 'HTML' | 'Markdown'
  reply_markup?: InlineKeyboardMarkup
}): Promise<void> {
  await fetch(`${baseUrl()}/editMessageText`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  })
}

// ---------------------------------------------------------------------------
// buildNewBookingMessage
// ---------------------------------------------------------------------------

export function buildNewBookingMessage(booking: {
  id: string
  client_first_name: string
  client_last_name: string
  client_phone: string
  studio_name: string
  start_at: string  // ISO string UTC
  end_at: string    // ISO string UTC
}): string {
  const tz = 'Asia/Jerusalem'

  const dateFormatter = new Intl.DateTimeFormat('ru-IL', {
    timeZone: tz,
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })

  const timeFormatter = new Intl.DateTimeFormat('ru-IL', {
    timeZone: tz,
    hour: '2-digit',
    minute: '2-digit',
  })

  const start = new Date(booking.start_at)
  const end = new Date(booking.end_at)

  const dateStr = dateFormatter.format(start)
  const timeStr = `${timeFormatter.format(start)} – ${timeFormatter.format(end)}`

  const fullName = `${booking.client_first_name} ${booking.client_last_name}`

  return (
    `🔔 <b>Новая заявка!</b>\n\n` +
    `👤 <b>Клиент:</b> ${fullName}\n` +
    `📞 <b>Телефон:</b> ${booking.client_phone}\n` +
    `🏢 <b>Студия:</b> ${booking.studio_name}\n` +
    `📅 <b>Дата:</b> ${dateStr}\n` +
    `⏰ <b>Время:</b> ${timeStr}\n\n` +
    `Статус: ожидает подтверждения`
  )
}

// ---------------------------------------------------------------------------
// buildConfirmKeyboard
// ---------------------------------------------------------------------------

export function buildConfirmKeyboard(booking_id: string): InlineKeyboardMarkup {
  return {
    inline_keyboard: [
      [{ text: '✅ Подтвердить', callback_data: `confirm:${booking_id}` }],
    ],
  }
}

// ---------------------------------------------------------------------------
// isAllowedUser
// ---------------------------------------------------------------------------

export async function isAllowedUser(telegram_chat_id: number): Promise<boolean> {
  const { data, error } = await supabaseAdmin
    .from('allowed_users')
    .select('id')
    .eq('telegram_chat_id', telegram_chat_id)
    .eq('is_active', true)
    .maybeSingle()

  if (error) {
    console.error('[telegram] isAllowedUser DB error', { error })
    return false
  }

  return data !== null
}

// ---------------------------------------------------------------------------
// notifyAllStaffCancellation
// ---------------------------------------------------------------------------

export async function notifyAllStaffCancellation(message: string): Promise<void> {
  const { data, error } = await supabaseAdmin
    .from('allowed_users')
    .select('telegram_chat_id')
    .eq('is_active', true)

  if (error) {
    console.error('[telegram] notifyAllStaffCancellation: failed to fetch staff', { error })
    return
  }

  if (!data || data.length === 0) {
    return
  }

  const sends = data.map((user: { telegram_chat_id: number }) =>
    sendMessage({
      chat_id: user.telegram_chat_id,
      text: message,
      parse_mode: 'HTML',
    }).catch((err: unknown) => {
      console.error('[telegram] notifyAllStaffCancellation: sendMessage failed', {
        chat_id: user.telegram_chat_id,
        err,
      })
    }),
  )

  await Promise.allSettled(sends)
}
