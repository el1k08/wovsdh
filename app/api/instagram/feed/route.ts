import { NextResponse } from 'next/server'
import { getInstagramToken, getInstagramFeed } from '@/lib/instagram'

export const revalidate = 3600

export async function GET() {
  const token = await getInstagramToken()
  if (!token) {
    return NextResponse.json({ images: [] })
  }
  try {
    const media = await getInstagramFeed(token, 9)
    const images = media.map((m) => ({
      id: m.id,
      url: m.media_url,
      permalink: m.permalink,
    }))
    return NextResponse.json({ images })
  } catch {
    return NextResponse.json({ images: [] })
  }
}
