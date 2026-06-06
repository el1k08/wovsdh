import { createClient } from '@supabase/supabase-js'
import type { NextRequest } from 'next/server'

/**
 * Verify that the incoming request carries a valid Supabase session token.
 * Expects: Authorization: Bearer <access_token>
 */
export async function verifyAdminRequest(request: NextRequest): Promise<boolean> {
  const auth = request.headers.get('Authorization')
  if (!auth?.startsWith('Bearer ')) return false
  const token = auth.slice(7)

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !anonKey) return false

  const client = createClient(url, anonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { autoRefreshToken: false, persistSession: false },
  })
  const { data: { user }, error } = await client.auth.getUser()
  return !error && user !== null
}
