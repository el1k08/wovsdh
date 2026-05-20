/**
 * Pure validation helpers used across API routes.
 * No external dependencies — native JS/TS only.
 */

import { supabaseAdmin } from '@/lib/supabase'

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

/** Returns true when `str` is a well-formed RFC 4122 UUID (case-insensitive). */
export function isValidUUID(str: string): boolean {
  return UUID_RE.test(str)
}

/**
 * Returns true for a plausibly valid e-mail address.
 * Intentionally simple — full RFC 5321 compliance is not required here.
 */
export function isValidEmail(str: string): boolean {
  return EMAIL_RE.test(str.trim())
}

/**
 * Returns true when `str` matches YYYY-MM-DD format and represents a
 * calendar day that is today or in the future (compared in Asia/Jerusalem
 * local time so that a date that has already passed locally is rejected
 * even if it is still "today" in UTC).
 */
export function isValidDateString(str: string): boolean {
  if (!DATE_RE.test(str)) return false

  // Validate the actual calendar date (rejects e.g. 2024-02-30)
  const [yearStr, monthStr, dayStr] = str.split('-')
  const year = Number(yearStr)
  const month = Number(monthStr)
  const day = Number(dayStr)
  const probeDate = new Date(Date.UTC(year, month - 1, day))
  if (
    probeDate.getUTCFullYear() !== year ||
    probeDate.getUTCMonth() + 1 !== month ||
    probeDate.getUTCDate() !== day
  ) {
    return false
  }

  // Compare against today in Asia/Jerusalem local time
  const todayLocal = new Date().toLocaleDateString('en-CA', {
    timeZone: 'Asia/Jerusalem',
  }) // → 'YYYY-MM-DD'

  return str >= todayLocal
}

/** Narrows `unknown` to a non-empty string (trims before checking). */
export function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

const STUDIO_SLUG_RE = /^[a-z][a-z0-9-]{0,29}$/

/** Returns true when `str` is a valid studio URL slug (lowercase letters, digits, hyphens, 1–30 chars). */
export function isValidStudioSlug(str: string): boolean {
  return STUDIO_SLUG_RE.test(str)
}

/** Returns true when a studio with the given ID exists in the database. */
export async function studioExists(id: string): Promise<boolean> {
  const { data } = await supabaseAdmin
    .from('studios')
    .select('id')
    .eq('id', id)
    .maybeSingle()
  return data !== null
}
