import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { resolveLocale } from '@/lib/locale-utils'
import type { PublicStudioDTO, StudioTranslations } from '@/lib/types'

// GET /api/studios?language=uk
// language param (uk|en|he, default uk) controls which locale is used for name.
export async function GET(request: NextRequest) {
  const language = resolveLocale(request.nextUrl.searchParams.get('language'))

  const { data: studios, error } = await supabaseAdmin
    .from('studios')
    .select('id, name, city, street, sort_order, translations')
    .order('sort_order', { ascending: true })

  if (error) {
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch studios.' } },
      { status: 500 },
    )
  }

  const result: PublicStudioDTO[] = (studios ?? []).map((row) => {
    const translations = (row.translations ?? {}) as StudioTranslations
    const tr = translations[language]
    return {
      id: row.id as string,
      name: tr?.name || (row.name as string),
      city: row.city as string,
      street: row.street as string,
      translations,
    }
  })

  return NextResponse.json({ studios: result })
}
