import { createClient, type SupabaseClient } from '@supabase/supabase-js'

let _supabase: SupabaseClient | null = null
let _supabaseAdmin: SupabaseClient | null = null

function getSupabaseClient(): SupabaseClient {
  if (_supabase) return _supabase

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!url || !anonKey) {
    throw new Error(
      'Missing Supabase env vars: NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY are required.',
    )
  }

  _supabase = createClient(url, anonKey)
  return _supabase
}

function getSupabaseAdminClient(): SupabaseClient {
  if (_supabaseAdmin) return _supabaseAdmin

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !serviceKey) {
    throw new Error(
      'Missing Supabase env vars: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.',
    )
  }

  _supabaseAdmin = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  return _supabaseAdmin
}

// Public client — used in client components (anon RLS only)
export const supabase = {
  get client(): SupabaseClient {
    return getSupabaseClient()
  },
  from: (...args: Parameters<SupabaseClient['from']>) =>
    getSupabaseClient().from(...args),
  auth: new Proxy({} as SupabaseClient['auth'], {
    get(_target, prop) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return (getSupabaseClient().auth as any)[prop]
    },
  }),
}

// Service client — used only in server-side API routes
export const supabaseAdmin = {
  get client(): SupabaseClient {
    return getSupabaseAdminClient()
  },
  from: (...args: Parameters<SupabaseClient['from']>) =>
    getSupabaseAdminClient().from(...args),
}
