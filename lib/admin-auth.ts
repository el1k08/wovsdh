import { auth } from '@/lib/auth'
import type { NextRequest } from 'next/server'

/**
 * Verify that the incoming request carries a valid Better Auth session (cookie-based).
 */
export async function verifyAdminRequest(request: NextRequest): Promise<boolean> {
  const session = await auth.api.getSession({ headers: request.headers })
  return session !== null
}
