import { NextRequest, NextResponse } from 'next/server'
import { put, del } from '@vercel/blob'
import { supabaseAdmin } from '@/lib/supabase'
import type { ApiError } from '@/lib/types'

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp']
const MAX_BYTES = 2 * 1024 * 1024

function requireAdminAuth(request: NextRequest): boolean {
  return request.headers.get('X-Admin-Secret') === process.env.ADMIN_SECRET_KEY
}

// PUT /api/admin/studios/[id]/image — upload / replace photo
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!requireAdminAuth(request)) {
    return NextResponse.json<ApiError>(
      { error: { code: 'UNAUTHORIZED', message: 'Admin authentication required.' } },
      { status: 401 },
    )
  }
  const { id } = await params

  // Two separate queries: existence check (always works), then image_url (requires migration 003)
  const { data: exists } = await supabaseAdmin
    .from('studios')
    .select('id')
    .eq('id', id)
    .maybeSingle()
  if (!exists) {
    return NextResponse.json<ApiError>(
      { error: { code: 'STUDIO_NOT_FOUND', message: `Studio '${id}' not found.` } },
      { status: 404 },
    )
  }
  const { data: imgRow } = await supabaseAdmin
    .from('studios')
    .select('image_url')
    .eq('id', id)
    .maybeSingle()
  const currentImageUrl: string | null = imgRow?.image_url ?? null

  let formData: FormData
  try {
    formData = await request.formData()
  } catch {
    return NextResponse.json<ApiError>(
      { error: { code: 'INVALID_PARAMS', message: 'Expected multipart/form-data.' } },
      { status: 400 },
    )
  }

  const file = formData.get('file')
  if (!(file instanceof File)) {
    return NextResponse.json<ApiError>(
      { error: { code: 'INVALID_PARAMS', message: "'file' field is required." } },
      { status: 400 },
    )
  }
  if (!ALLOWED_TYPES.includes(file.type)) {
    return NextResponse.json<ApiError>(
      { error: { code: 'INVALID_PARAMS', message: 'Дозволені лише JPEG, PNG та WebP.' } },
      { status: 400 },
    )
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json<ApiError>(
      { error: { code: 'INVALID_PARAMS', message: 'Розмір файлу не повинен перевищувати 2 МБ.' } },
      { status: 400 },
    )
  }

  if (currentImageUrl) {
    try { await del(currentImageUrl) } catch { /* already gone */ }
  }

  const ext = file.type === 'image/webp' ? 'webp' : file.type === 'image/png' ? 'png' : 'jpg'
  const blob = await put(`studios/${id}/photo.${ext}`, file, {
    access: 'public',
    allowOverwrite: true,
  })

  const { data: updated, error } = await supabaseAdmin
    .from('studios')
    .update({ image_url: blob.url })
    .eq('id', id)
    .select()
    .maybeSingle()

  if (error || !updated) {
    try { await del(blob.url) } catch { /* ignore */ }
    return NextResponse.json<ApiError>(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to save image URL.' } },
      { status: 500 },
    )
  }

  return NextResponse.json({ studio: updated, image_url: blob.url })
}

// DELETE /api/admin/studios/[id]/image — remove photo
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!requireAdminAuth(request)) {
    return NextResponse.json<ApiError>(
      { error: { code: 'UNAUTHORIZED', message: 'Admin authentication required.' } },
      { status: 401 },
    )
  }
  const { id } = await params

  const { data: exists } = await supabaseAdmin
    .from('studios')
    .select('id')
    .eq('id', id)
    .maybeSingle()
  if (!exists) {
    return NextResponse.json<ApiError>(
      { error: { code: 'STUDIO_NOT_FOUND', message: `Studio '${id}' not found.` } },
      { status: 404 },
    )
  }
  const { data: imgRow } = await supabaseAdmin
    .from('studios')
    .select('image_url')
    .eq('id', id)
    .maybeSingle()
  const currentImageUrl: string | null = imgRow?.image_url ?? null

  if (currentImageUrl) {
    try { await del(currentImageUrl) } catch { /* already gone */ }
  }

  await supabaseAdmin.from('studios').update({ image_url: null }).eq('id', id)

  return NextResponse.json({ message: 'Фото видалено.', id })
}
