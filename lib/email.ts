/**
 * Email client using Nodemailer.
 * Transporter is created lazily on first use — not at import time.
 * This module is server-side only.
 */

import nodemailer from 'nodemailer'
import { supabaseAdmin } from '@/lib/supabase'
import { buildConfirmationEmail, buildCancellationEmail } from '@/lib/email-templates'
import { EmailType } from '@/lib/types'

const LOG_PREFIX = '[email]'

// ---------------------------------------------------------------------------
// Lazy transporter
// ---------------------------------------------------------------------------

let _transporter: nodemailer.Transporter | null = null

function getTransporter(): nodemailer.Transporter {
  if (_transporter) {
    return _transporter
  }

  _transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT) || 587,
    secure: false, // STARTTLS
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  })

  return _transporter
}

// ---------------------------------------------------------------------------
// logEmail — always write to DB (success and failure)
// ---------------------------------------------------------------------------

async function logEmail(params: {
  booking_id: string
  email_type: EmailType.Confirmation | EmailType.Cancellation
  recipient_email: string
  error?: string
}): Promise<void> {
  const { booking_id, email_type, recipient_email, error } = params

  const { error: dbError } = await supabaseAdmin
    .from('email_logs')
    .insert({
      booking_id,
      email_type,
      recipient_email,
      error: error ?? null,
    })

  if (dbError) {
    console.error(`${LOG_PREFIX} Failed to write email_log`, {
      booking_id,
      email_type,
      db_error: dbError,
    })
  }
}

// ---------------------------------------------------------------------------
// sendBookingConfirmation
// ---------------------------------------------------------------------------

export async function sendBookingConfirmation(params: {
  to: string
  clientName: string
  studioName: string
  startAt: string
  endAt: string
  cancellationToken: string
  bookingId: string
}): Promise<void> {
  const { to, clientName, studioName, startAt, endAt, cancellationToken, bookingId } = params

  const { subject, html, text } = buildConfirmationEmail({
    clientName,
    studioName,
    startAt,
    endAt,
    cancellationToken,
    bookingId,
  })

  let sendError: string | undefined

  try {
    await getTransporter().sendMail({
      from: process.env.SMTP_FROM,
      to,
      subject,
      html,
      text,
    })

    console.info(`${LOG_PREFIX} Confirmation email sent`, { booking_id: bookingId })
  } catch (err) {
    sendError = err instanceof Error ? err.message : String(err)
    console.error(`${LOG_PREFIX} Failed to send confirmation email`, {
      booking_id: bookingId,
      error: sendError,
    })
    // Re-throw so callers can handle the failure
    throw err
  } finally {
    await logEmail({
      booking_id: bookingId,
      email_type: EmailType.Confirmation,
      recipient_email: to,
      error: sendError,
    })
  }
}

// ---------------------------------------------------------------------------
// sendBookingCancellation
// ---------------------------------------------------------------------------

export async function sendBookingCancellation(params: {
  to: string
  clientName: string
  studioName: string
  startAt: string
  endAt: string
  bookingId: string
}): Promise<void> {
  const { to, clientName, studioName, startAt, endAt, bookingId } = params

  const { subject, html, text } = buildCancellationEmail({
    clientName,
    studioName,
    startAt,
    endAt,
  })

  let sendError: string | undefined

  try {
    await getTransporter().sendMail({
      from: process.env.SMTP_FROM,
      to,
      subject,
      html,
      text,
    })

    console.info(`${LOG_PREFIX} Cancellation email sent`, { booking_id: bookingId })
  } catch (err) {
    sendError = err instanceof Error ? err.message : String(err)
    console.error(`${LOG_PREFIX} Failed to send cancellation email`, {
      booking_id: bookingId,
      error: sendError,
    })
    throw err
  } finally {
    await logEmail({
      booking_id: bookingId,
      email_type: EmailType.Cancellation,
      recipient_email: to,
      error: sendError,
    })
  }
}
