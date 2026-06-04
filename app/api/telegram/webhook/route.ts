import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import {
  isAllowedUser,
  answerCallbackQuery,
  editMessageText,
  sendMessage,
} from '@/lib/telegram'
import { isValidUUID } from '@/lib/validation'
import type { TelegramUpdate, BookingStatus } from '@/lib/types'

const LOG_PREFIX = '[api/telegram/webhook]'

// ---------------------------------------------------------------------------
// POST /api/telegram/webhook
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest): Promise<NextResponse> {
  // 1. Verify Telegram secret token
  const secret = request.headers.get('X-Telegram-Bot-Api-Secret-Token')
  if (secret !== process.env.TELEGRAM_WEBHOOK_SECRET) {
    console.error(`${LOG_PREFIX} Unauthorized request — invalid secret token`)
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // 2. Parse body
  let update: TelegramUpdate
  try {
    update = (await request.json()) as TelegramUpdate
  } catch {
    // Telegram will not retry a 200, so return 200 even on parse failure
    console.error(`${LOG_PREFIX} Failed to parse request body`)
    return NextResponse.json({ ok: true })
  }

  // 3. Route to the appropriate handler
  try {
    if (update.callback_query) {
      await handleCallbackQuery(update)
    } else if (update.message) {
      await handleMessage(update)
    }
  } catch (err) {
    // Always return 200 so Telegram does not retry the update
    console.error(`${LOG_PREFIX} Unhandled error processing update`, {
      update_id: update.update_id,
      error: err,
    })
  }

  // 5. Always return 200 OK
  return NextResponse.json({ ok: true })
}

// ---------------------------------------------------------------------------
// Callback query handler (inline keyboard button presses)
// ---------------------------------------------------------------------------

async function handleCallbackQuery(update: TelegramUpdate): Promise<void> {
  const cb = update.callback_query!
  const chatId = cb.from.id
  const callbackQueryId = cb.id
  const data = cb.data

  // Authorization check
  const allowed = await isAllowedUser(chatId)
  if (!allowed) {
    await answerCallbackQuery({
      callback_query_id: callbackQueryId,
      text: '⛔ У вас немає прав',
      show_alert: true,
    })
    return
  }

  // Parse callback data: "action:booking_id"
  const colonIndex = data.indexOf(':')
  if (colonIndex === -1) {
    console.error(`${LOG_PREFIX} Malformed callback_data`, { data })
    return
  }

  const action = data.slice(0, colonIndex)
  const bookingId = data.slice(colonIndex + 1)

  if (!isValidUUID(bookingId)) {
    console.error(`${LOG_PREFIX} Invalid booking UUID in callback_data`, { data })
    await answerCallbackQuery({
      callback_query_id: callbackQueryId,
      text: 'Некоректний ідентифікатор запису',
      show_alert: true,
    })
    return
  }

  if (action === 'confirm') {
    await handleConfirmAction({ callbackQueryId, bookingId, from: cb.from, message: cb.message })
  } else {
    console.error(`${LOG_PREFIX} Unknown callback action`, { action })
  }
}

// ---------------------------------------------------------------------------
// Confirm action
// ---------------------------------------------------------------------------

async function handleConfirmAction(params: {
  callbackQueryId: string
  bookingId: string
  from: TelegramUpdate['callback_query'] extends undefined ? never : NonNullable<TelegramUpdate['callback_query']>['from']
  message: NonNullable<TelegramUpdate['callback_query']>['message']
}): Promise<void> {
  const { callbackQueryId, bookingId, from, message } = params

  // a. Fetch booking — must exist and be PENDING
  const { data: bookingData, error: fetchError } = await supabaseAdmin
    .from('bookings')
    .select('id, status, client_first_name, client_last_name, telegram_message_id')
    .eq('id', bookingId)
    .maybeSingle()

  if (fetchError) {
    console.error(`${LOG_PREFIX} DB error fetching booking for confirm`, {
      booking_id: bookingId,
      error: fetchError,
    })
    await answerCallbackQuery({
      callback_query_id: callbackQueryId,
      text: 'Помилка при обробці запису',
      show_alert: true,
    })
    return
  }

  if (!bookingData) {
    await answerCallbackQuery({
      callback_query_id: callbackQueryId,
      text: 'Запис не знайдено',
      show_alert: true,
    })
    return
  }

  const booking = bookingData as {
    id: string
    status: BookingStatus
    client_first_name: string
    client_last_name: string
    telegram_message_id: number | null
  }

  // b. Guard: must still be PENDING
  if (booking.status !== 'PENDING') {
    await answerCallbackQuery({
      callback_query_id: callbackQueryId,
      text: 'Запис вже оброблено',
      show_alert: true,
    })
    return
  }

  // c. Update status to CONFIRMED
  const { error: updateError } = await supabaseAdmin
    .from('bookings')
    .update({ status: 'CONFIRMED', confirmed_at: new Date().toISOString() })
    .eq('id', bookingId)

  if (updateError) {
    console.error(`${LOG_PREFIX} DB error confirming booking`, {
      booking_id: bookingId,
      error: updateError,
    })
    await answerCallbackQuery({
      callback_query_id: callbackQueryId,
      text: 'Помилка при підтвердженні запису',
      show_alert: true,
    })
    return
  }

  // d. Edit the Telegram message: remove buttons, show confirmation
  const staffName = from.first_name ?? from.username ?? String(from.id)
  const confirmedText =
    `✅ <b>Запис підтверджено!</b>\n\n` +
    `👤 <b>Клієнт:</b> ${booking.client_first_name} ${booking.client_last_name}\n` +
    `✅ <b>Підтверджено:</b> ${staffName}`

  try {
    await editMessageText({
      chat_id: message.chat.id,
      message_id: message.message_id,
      text: confirmedText,
      parse_mode: 'HTML',
      // No reply_markup — removes the inline keyboard
    })
  } catch (editErr) {
    console.error(`${LOG_PREFIX} Failed to edit Telegram message after confirm`, {
      booking_id: bookingId,
      error: editErr,
    })
  }

  // e. Acknowledge the callback (removes the loading spinner)
  await answerCallbackQuery({
    callback_query_id: callbackQueryId,
    text: '✅ Запис підтверджено!',
  })

  // f. Trigger Google Calendar event creation (fire-and-forget)
  // The booking is already CONFIRMED in the DB; a Calendar failure must not
  // affect the Telegram response time or the booking status.
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
  fetch(`${appUrl}/api/internal/confirm-booking`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Internal-Secret': process.env.ADMIN_SECRET_KEY || '',
    },
    body: JSON.stringify({ booking_id: bookingId }),
  }).catch((err: unknown) =>
    console.error(`${LOG_PREFIX} confirm-booking call failed`, { booking_id: bookingId, err }),
  )
}

// ---------------------------------------------------------------------------
// Message/command handler
// ---------------------------------------------------------------------------

async function handleMessage(update: TelegramUpdate): Promise<void> {
  const msg = update.message!
  const chatId = msg.chat.id
  const text = msg.text?.trim() ?? ''

  if (!text.startsWith('/')) {
    // Ignore non-command messages
    return
  }

  const [rawCommand, ...args] = text.split(/\s+/)
  // Strip bot mention suffix: /start@BotName → /start
  const command = rawCommand.split('@')[0].toLowerCase()

  switch (command) {
    case '/start':
      await sendMessage({
        chat_id: chatId,
        text:
          `Вітаємо! Я бот для сповіщень про нові записи.\n\n` +
          `🪪 <b>Ваш Chat ID:</b> <code>${chatId}</code>\n\n` +
          `Надайте цей Chat ID адміністратору, щоб отримувати сповіщення про нові записи.`,
        parse_mode: 'HTML',
      })
      break

    case '/help':
      await sendMessage({
        chat_id: chatId,
        text:
          '<b>Доступні команди:</b>\n\n' +
          '/start — вітання\n' +
          '/help — список команд\n' +
          '/adduser {telegram_id} {Ім\'я} — додати співробітника\n' +
          '/removeuser {telegram_id} — деактивувати співробітника',
        parse_mode: 'HTML',
      })
      break

    case '/adduser':
      await handleAddUser({ chatId, args })
      break

    case '/removeuser':
      await handleRemoveUser({ chatId, args })
      break

    default:
      // Unknown commands — silently ignore
      break
  }
}

// ---------------------------------------------------------------------------
// /adduser command
// ---------------------------------------------------------------------------

async function handleAddUser(params: { chatId: number; args: string[] }): Promise<void> {
  const { chatId, args } = params

  const allowed = await isAllowedUser(chatId)
  if (!allowed) {
    await sendMessage({ chat_id: chatId, text: '⛔ У вас немає прав для цієї команди.' })
    return
  }

  if (args.length < 2) {
    await sendMessage({
      chat_id: chatId,
      text: 'Використання: /adduser {telegram_id} {Ім\'я}',
    })
    return
  }

  const newTelegramId = Number(args[0])
  if (!Number.isInteger(newTelegramId) || newTelegramId <= 0) {
    await sendMessage({ chat_id: chatId, text: 'Некоректний telegram_id.' })
    return
  }

  const name = args.slice(1).join(' ')

  // Upsert: re-activate if the user already exists
  const { error } = await supabaseAdmin
    .from('allowed_users')
    .upsert(
      { telegram_chat_id: newTelegramId, name, is_active: true },
      { onConflict: 'telegram_chat_id' },
    )

  if (error) {
    console.error('[api/telegram/webhook] /adduser DB error', { error })
    await sendMessage({ chat_id: chatId, text: 'Помилка при додаванні користувача.' })
    return
  }

  await sendMessage({
    chat_id: chatId,
    text: `✅ Користувач <b>${name}</b> (${newTelegramId}) додано.`,
    parse_mode: 'HTML',
  })
}

// ---------------------------------------------------------------------------
// /removeuser command
// ---------------------------------------------------------------------------

async function handleRemoveUser(params: { chatId: number; args: string[] }): Promise<void> {
  const { chatId, args } = params

  const allowed = await isAllowedUser(chatId)
  if (!allowed) {
    await sendMessage({ chat_id: chatId, text: '⛔ У вас немає прав для цієї команди.' })
    return
  }

  if (args.length < 1) {
    await sendMessage({
      chat_id: chatId,
      text: 'Використання: /removeuser {telegram_id}',
    })
    return
  }

  const targetId = Number(args[0])
  if (!Number.isInteger(targetId) || targetId <= 0) {
    await sendMessage({ chat_id: chatId, text: 'Некоректний telegram_id.' })
    return
  }

  const { error } = await supabaseAdmin
    .from('allowed_users')
    .update({ is_active: false })
    .eq('telegram_chat_id', targetId)

  if (error) {
    console.error('[api/telegram/webhook] /removeuser DB error', { error })
    await sendMessage({ chat_id: chatId, text: 'Помилка при деактивації користувача.' })
    return
  }

  await sendMessage({
    chat_id: chatId,
    text: `✅ Користувач ${targetId} деактивовано.`,
  })
}
