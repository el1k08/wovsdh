/**
 * Utility helpers shared across the application.
 */

/**
 * Formats a date string or Date object to 'YYYY-MM-DD' in the given IANA timezone.
 * Defaults to 'Asia/Jerusalem'.
 */
export function formatDateLocal(
  date: Date | string,
  timeZone = 'Asia/Jerusalem',
): string {
  const d = typeof date === 'string' ? new Date(date) : date
  return d.toLocaleDateString('en-CA', { timeZone }) // en-CA gives YYYY-MM-DD
}

/**
 * Formats a date/time string as a human-readable local time string.
 */
export function formatTimeLocal(
  date: Date | string,
  timeZone = 'Asia/Jerusalem',
): string {
  const d = typeof date === 'string' ? new Date(date) : date
  return d.toLocaleTimeString('he-IL', {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
  })
}

/**
 * Type-safe version of Object.entries.
 */
export function typedEntries<T extends object>(obj: T): [keyof T, T[keyof T]][] {
  return Object.entries(obj) as [keyof T, T[keyof T]][]
}

/**
 * Returns true when a value is not null or undefined.
 */
export function isDefined<T>(value: T | null | undefined): value is T {
  return value !== null && value !== undefined
}
