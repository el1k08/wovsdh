/**
 * Pure validation helpers used across API routes.
 * No external dependencies — native JS/TS only.
 */

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

const VALID_STUDIO_IDS = ['rishon', 'ashdod'] as const
export type ValidStudioId = (typeof VALID_STUDIO_IDS)[number]

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

/** Returns true and narrows the type when `str` is a known studio slug. */
export function isValidStudioId(str: string): str is ValidStudioId {
  return (VALID_STUDIO_IDS as readonly string[]).includes(str)
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
