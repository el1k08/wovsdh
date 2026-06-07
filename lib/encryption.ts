/**
 * AES-256-GCM symmetric encryption for sensitive settings stored in the DB.
 * Key is read from SETTINGS_ENCRYPTION_KEY env var (64 hex chars = 32 bytes).
 * Encrypted values are prefixed with "enc:" so plain legacy values are
 * transparently passed through (backwards compatibility).
 */

import { createCipheriv, createDecipheriv, randomBytes } from 'crypto'

const ALGO = 'aes-256-gcm'
const PREFIX = 'enc:'

function getKey(): Buffer {
  const hex = process.env.SETTINGS_ENCRYPTION_KEY
  if (!hex) throw new Error('SETTINGS_ENCRYPTION_KEY env var is not set')
  const buf = Buffer.from(hex, 'hex')
  if (buf.length !== 32) throw new Error('SETTINGS_ENCRYPTION_KEY must be 64 hex chars (32 bytes)')
  return buf
}

export function encrypt(plaintext: string): string {
  const key = getKey()
  const iv = randomBytes(12) // 96-bit IV recommended for GCM
  const cipher = createCipheriv(ALGO, key, iv)
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return `${PREFIX}${iv.toString('hex')}:${tag.toString('hex')}:${ciphertext.toString('hex')}`
}

export function decrypt(value: string): string {
  if (!value.startsWith(PREFIX)) return value // plain text — backwards compat
  const inner = value.slice(PREFIX.length)
  const colon1 = inner.indexOf(':')
  const colon2 = inner.indexOf(':', colon1 + 1)
  if (colon1 === -1 || colon2 === -1) throw new Error('Invalid encrypted value format')
  const ivHex = inner.slice(0, colon1)
  const tagHex = inner.slice(colon1 + 1, colon2)
  const ctHex = inner.slice(colon2 + 1)
  const key = getKey()
  const decipher = createDecipheriv(ALGO, key, Buffer.from(ivHex, 'hex'))
  decipher.setAuthTag(Buffer.from(tagHex, 'hex'))
  return decipher.update(Buffer.from(ctHex, 'hex')).toString('utf8') + decipher.final('utf8')
}
