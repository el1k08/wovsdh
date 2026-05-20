/**
 * Phone number normalization utilities.
 * All phone numbers in the system are stored in E.164-like format: +972XXXXXXXXX
 */

const STRIP_RE = /[\s\-().]/g

/**
 * Normalizes an Israeli phone number to the canonical +972 format.
 *
 * Rules (applied after stripping spaces, dashes, and parentheses):
 *   - Already starts with "+972" → returned as-is.
 *   - Starts with "0"           → leading "0" is replaced with "+972".
 *   - Anything else             → returned as-is (no mutation of unknown prefixes).
 *
 * The function is idempotent: normalizePhone(normalizePhone(x)) === normalizePhone(x).
 *
 * @param input Raw phone string from form input or database read.
 * @returns Normalized phone string.
 */
export function normalizePhone(input: string): string {
  const stripped = input.replace(STRIP_RE, '')

  if (stripped.startsWith('+972')) {
    return stripped
  }

  if (stripped.startsWith('0')) {
    return '+972' + stripped.slice(1)
  }

  return stripped
}
