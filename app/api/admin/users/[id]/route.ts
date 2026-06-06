import { NextRequest, NextResponse } from 'next/server'
import { verifyAdminRequest } from '@/lib/admin-auth'
import { supabaseAdmin } from '@/lib/supabase'
import type { ApiError } from '@/lib/types'

const LOG_PREFIX = '[api/admin/users/[id]]'

// DELETE /api/admin/users/:id — delete a user
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  if (!(await verifyAdminRequest(request))) {
    return NextResponse.json<ApiError>(
      { error: { code: 'UNAUTHORIZED', message: 'Admin authentication required.' } },
      { status: 401 },
    )
  }

  const { id } = await params
  if (!id) {
    return NextResponse.json<ApiError>(
      { error: { code: 'INVALID_PARAMS', message: 'User ID is required.' } },
      { status: 400 },
    )
  }

  const { error } = await supabaseAdmin.client.auth.admin.deleteUser(id)
  if (error) {
    console.error(`${LOG_PREFIX} Failed to delete user`, { id, error })
    return NextResponse.json<ApiError>(
      { error: { code: 'INTERNAL_ERROR', message: error.message } },
      { status: 500 },
    )
  }

  return NextResponse.json({ ok: true })
}
