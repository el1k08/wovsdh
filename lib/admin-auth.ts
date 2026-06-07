import { auth } from '@/lib/auth'
import type { NextRequest } from 'next/server'

export type UserRole = 'admin' | 'manager' | 'master'

export async function getAdminSession(request: NextRequest) {
  return await auth.api.getSession({ headers: request.headers })
}

export async function verifyAdminRequest(request: NextRequest): Promise<boolean> {
  const session = await getAdminSession(request)
  return session !== null
}

export function getRole(session: Awaited<ReturnType<typeof getAdminSession>>): UserRole {
  const role = (session?.user as { role?: string } | null)?.role
  if (role === 'manager') return 'manager'
  if (role === 'master') return 'master'
  return 'admin'
}
