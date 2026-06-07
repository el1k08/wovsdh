import { NextRequest, NextResponse } from 'next/server'
import { getInstagramToken, refreshInstagramToken, setInstagramToken } from '@/lib/instagram'

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const token = await getInstagramToken()
  if (!token) {
    return NextResponse.json({ ok: true, skipped: true })
  }

  try {
    const newToken = await refreshInstagramToken(token)
    await setInstagramToken(newToken)
    return NextResponse.json({ ok: true })
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 })
  }
}
