import { supabaseAdmin } from './supabase'

export interface InstagramMedia {
  id: string
  media_url: string
  thumbnail_url?: string
  permalink: string
  media_type: 'IMAGE' | 'VIDEO' | 'CAROUSEL_ALBUM'
  timestamp: string
}

const SETTINGS_KEY = 'instagram_token'
const INSTAGRAM_API = 'https://graph.instagram.com/v22.0'

export async function getInstagramToken(): Promise<string | null> {
  const { data } = await supabaseAdmin
    .from('settings')
    .select('value')
    .eq('key', SETTINGS_KEY)
    .single()
  return data?.value ?? null
}

export async function setInstagramToken(token: string): Promise<void> {
  await supabaseAdmin
    .from('settings')
    .upsert({ key: SETTINGS_KEY, value: token, updated_at: new Date().toISOString() }, { onConflict: 'key' })
}

export async function deleteInstagramToken(): Promise<void> {
  await supabaseAdmin.from('settings').delete().eq('key', SETTINGS_KEY)
}

export async function refreshInstagramToken(token: string): Promise<string> {
  const url = `${INSTAGRAM_API}/refresh_access_token?grant_type=ig_refresh_token&access_token=${encodeURIComponent(token)}`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Instagram refresh failed: ${res.status}`)
  const data = await res.json() as { access_token: string }
  return data.access_token
}

export async function getInstagramFeed(token: string, limit = 9): Promise<InstagramMedia[]> {
  const fields = 'id,media_type,media_url,thumbnail_url,permalink,timestamp'
  const url = `${INSTAGRAM_API}/me/media?fields=${fields}&limit=${limit}&access_token=${encodeURIComponent(token)}`
  const res = await fetch(url, { next: { revalidate: 3600 } })
  if (!res.ok) throw new Error(`Instagram feed failed: ${res.status}`)
  const data = await res.json() as { data: InstagramMedia[] }
  return data.data.filter((m) => m.media_type === 'IMAGE' || m.media_type === 'CAROUSEL_ALBUM')
}
