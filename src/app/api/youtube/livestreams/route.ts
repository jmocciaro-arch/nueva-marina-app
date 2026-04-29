import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { getLiveBroadcasts, refreshAccessToken } from '@/lib/youtube/client'

// GET /api/youtube/livestreams — lista los livestreams activos del canal
export async function GET() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const { data: creds } = await supabase
    .from('nm_youtube_credentials')
    .select('*')
    .eq('club_id', 1)
    .single()

  if (!creds) return NextResponse.json({ broadcasts: [] })

  let accessToken = creds.access_token
  if (creds.token_expires_at && new Date(creds.token_expires_at) < new Date()) {
    const clientId = process.env.GOOGLE_CLIENT_ID!
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET!
    const refreshed = await refreshAccessToken(creds.refresh_token, clientId, clientSecret)
    accessToken = refreshed.access_token
    const newExpiresAt = new Date(Date.now() + refreshed.expires_in * 1000).toISOString()
    await supabase.from('nm_youtube_credentials').update({
      access_token: refreshed.access_token,
      token_expires_at: newExpiresAt,
    }).eq('id', creds.id)
  }

  try {
    const broadcasts = await getLiveBroadcasts(accessToken)
    return NextResponse.json({ broadcasts, channel: creds.channel_title })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
