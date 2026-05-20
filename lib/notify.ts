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
// notifyStaffNewBooking
// ---------------------------------------------------------------------------

/**
 * Fetches the full booking record (joining booking_slots → slots and studio),
 * sends a Telegram notification to all active staff members, and stores the
 * last successful telegram_message_id back onto the booking row.
 *
 * This function must never throw — call it fire-and-forget from API handlers.
 */
export async function notifyStaffNewBooking(bookingId: string): Promise<void> {
  try {
    const { data: bookingData, error: bookingError } = await supabaseAdmin
      .from('bookings')
      .select(
        `
        id,
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

    // Pick the earliest slot as the booking start
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

    const { data: staffData, error: staffError } = await supabaseAdmin
      .from('allowed_users')
      .select('telegram_chat_id')
      .eq('is_active', true)

    if (staffError) {
      console.error(`${LOG_PREFIX} Failed to fetch staff list`, { error: staffError })
      return
    }

    if (!staffData || staffData.length === 0) {
      console.error(`${LOG_PREFIX} No active staff to notify`, { booking_id: bookingId })
      return
    }

    let lastMessageId: number | null = null

    for (const member of staffData as Array<{ telegram_chat_id: number }>) {
      try {
        const result = await sendMessage({
          chat_id: member.telegram_chat_id,
          text,
          parse_mode: 'HTML',
          reply_markup,
        })

        if (result.ok && result.result?.message_id) {
          lastMessageId = result.result.message_id
        } else {
          console.error(`${LOG_PREFIX} sendMessage returned not-ok`, {
            booking_id: bookingId,
            chat_id: member.telegram_chat_id,
          })
        }
      } catch (sendErr) {
        console.error(`${LOG_PREFIX} sendMessage threw`, {
          booking_id: bookingId,
          chat_id: member.telegram_chat_id,
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
    // Top-level guard: notification must never crash the booking flow
    console.error(`${LOG_PREFIX} Unexpected error in notifyStaffNewBooking`, {
      booking_id: bookingId,
      error: err,
    })
  }
}
