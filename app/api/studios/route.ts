import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET() {
  const { data: studios, error } = await supabaseAdmin
    .from('studios')
    .select('id, name, city, street')
    .order('created_at', { ascending: true })

  if (error) {
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch studios.' } },
      { status: 500 },
    )
  }

  return NextResponse.json({ studios: studios ?? [] })
}
