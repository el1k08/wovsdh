/**
 * Staff notification helpers.
 * Called from API routes after successful database mutations.
 * Errors are intentionally swallowed so a Telegram outage never breaks bookings.
 */

import { supabaseAdmin } from '@/lib/supabase'
import {
  sendMessage,
  buildNewBookingMessage,
  buildConfirmKeyboard,
} from '@/lib/telegram'

const LOG_PREFIX = '[notify]'

// ---------------------------------------------------------------------------
// getRecipientsForStudio
// Fetches Telegram chat IDs from Better Auth user table.
// Admins and managers always receive notifications.
// Masters only receive notifications for their assigned studios.
// ---------------------------------------------------------------------------

async function getRecipientsForStudio(studioId: string): Promise<number[]> {
  const { data: users, error } = await supabaseAdmin
    .from('user')
    .select('id, role, telegram_chat_id')
    .not('telegram_chat_id', 'is', null)

  if (error || !users || users.length === 0) return []

  const typed = users as Array<{ id: string; role: string; telegram_chat_id: string }>

  const masterIds = typed.filter((u) => u.role === 'master').map((u) => u.id)

  let masterStudios: Record<string, string[]> = {}
  if (masterIds.length > 0) {
    const { data: assignments } = await supabaseAdmin
      .from('user_studios')
      .select('user_id, studio_id')
      .in('user_id', masterIds)
    if (assignments) {
      for (const a of assignments as Array<{ user_id: string; studio_id: string }>) {
        masterStudios[a.user_id] = [...(masterStudios[a.user_id] ?? []), a.studio_id]
      }
    }
  }

  return typed
    .filter((u) => {
      if (u.role === 'admin' || u.role === 'manager') return true
      if (u.role === 'master') return (masterStudios[u.id] ?? []).includes(studioId)
      return false
    })
    .map((u) => Number(u.telegram_chat_id))
    .filter((id) => id > 0)
}

// ---------------------------------------------------------------------------
// notifyStaffNewBooking
// ---------------------------------------------------------------------------

export async function notifyStaffNewBooking(bookingId: string): Promise<void> {
  try {
    const { data: bookingData, error: bookingError } = await supabaseAdmin
      .from('bookings')
      .select(
        `
        id,
        studio_id,
        client_first_name,
        client_last_name,
        client_phone,
        service_snapshot,
        studio:studios!bookings_studio_id_fkey (name),
        booking_slots (
          slot:slots!booking_slots_slot_id_fkey (start_at)
        )
      `,
      )
      .eq('id', bookingId)
      .single()

    if (bookingError || !bookingData) {
      console.error(`${LOG_PREFIX} Failed to fetch booking for notification`, {
        booking_id: bookingId,
        error: bookingError,
      })
      return
    }

    const raw = bookingData as unknown as {
      id: string
      studio_id: string
      client_first_name: string
      client_last_name: string
      client_phone: string
      service_snapshot: Record<string, unknown>
      studio: { name: string } | null
      booking_slots: Array<{ slot: { start_at: string } | null }>
    }

    if (!raw.studio) {
      console.error(`${LOG_PREFIX} Booking has no linked studio`, { booking_id: bookingId })
      return
    }

    const slotRows = raw.booking_slots ?? []
    if (slotRows.length === 0) {
      console.error(`${LOG_PREFIX} Booking has no linked slots`, { booking_id: bookingId })
      return
    }

    const startAts = slotRows
      .map((bs) => bs.slot?.start_at)
      .filter((s): s is string => typeof s === 'string')
      .sort()

    const startAt = startAts[0]
    if (!startAt) {
      console.error(`${LOG_PREFIX} Could not resolve start_at from slots`, { booking_id: bookingId })
      return
    }

    const snapshot = raw.service_snapshot
    const durationMs = (snapshot.duration_minutes as number) * 60 * 1000
    const endAt = new Date(new Date(startAt).getTime() + durationMs).toISOString()

    const text = buildNewBookingMessage({
      id: raw.id,
      client_first_name: raw.client_first_name,
      client_last_name: raw.client_last_name,
      client_phone: raw.client_phone,
      studio_name: raw.studio.name,
      start_at: startAt,
      end_at: endAt,
    })

    const reply_markup = buildConfirmKeyboard(raw.id)

    const recipients = await getRecipientsForStudio(raw.studio_id)

    if (recipients.length === 0) {
      console.error(`${LOG_PREFIX} No recipients for studio ${raw.studio_id}`, { booking_id: bookingId })
      return
    }

    let lastMessageId: number | null = null

    for (const chatId of recipients) {
      try {
        const result = await sendMessage({
          chat_id: chatId,
          text,
          parse_mode: 'HTML',
          reply_markup,
        })

        if (result.ok && result.result?.message_id) {
          lastMessageId = result.result.message_id
        } else {
          console.error(`${LOG_PREFIX} sendMessage returned not-ok`, {
            booking_id: bookingId,
            chat_id: chatId,
          })
        }
      } catch (sendErr) {
        console.error(`${LOG_PREFIX} sendMessage threw`, {
          booking_id: bookingId,
          chat_id: chatId,
          error: sendErr,
        })
      }
    }

    if (lastMessageId !== null) {
      const { error: updateError } = await supabaseAdmin
        .from('bookings')
        .update({ telegram_message_id: lastMessageId })
        .eq('id', bookingId)

      if (updateError) {
        console.error(`${LOG_PREFIX} Failed to save telegram_message_id`, {
          booking_id: bookingId,
          error: updateError,
        })
      }
    }
  } catch (err) {
    console.error(`${LOG_PREFIX} Unexpected error in notifyStaffNewBooking`, {
      booking_id: bookingId,
      error: err,
    })
  }
}

// ---------------------------------------------------------------------------
// notifyStaffCancellation
// ---------------------------------------------------------------------------

export async function notifyStaffCancellation(message: string, studioId: string): Promise<void> {
  try {
    const recipients = await getRecipientsForStudio(studioId)
    if (recipients.length === 0) return

    const sends = recipients.map((chatId) =>
      sendMessage({ chat_id: chatId, text: message, parse_mode: 'HTML' }).catch((err: unknown) => {
        console.error('[notify] notifyStaffCancellation: sendMessage failed', { chat_id: chatId, err })
      }),
    )
    await Promise.allSettled(sends)
  } catch (err) {
    console.error('[notify] Unexpected error in notifyStaffCancellation', { error: err })
  }
}
