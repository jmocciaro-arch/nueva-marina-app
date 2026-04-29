import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { exchangeCodeForTokens, getChannelInfo } from '@/lib/youtube/client'

// GET /api/youtube/callback — recibe el code de Google y guarda los tokens
export async function GET(req: NextRequest) {
  const url = new URL(req.url)
  const code = url.searchParams.get('code')
  const state = url.searchParams.get('state') // user_id
  const error = url.searchParams.get('error')

  if (error) {
    return NextResponse.redirect(`${url.origin}/admin/config/youtube?error=${encodeURIComponent(error)}`)
  }

  if (!code) {
    return NextResponse.redirect(`${url.origin}/admin/config/youtube?error=missing_code`)
  }

  const clientId = process.env.GOOGLE_CLIENT_ID
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET
  if (!clientId || !clientSecret) {
    return NextResponse.redirect(`${url.origin}/admin/config/youtube?error=missing_credentials`)
  }

  try {
    const redirectUri = `${url.origin}/api/youtube/callback`
    const tokens = await exchangeCodeForTokens(code, clientId, clientSecret, redirectUri)

    // Obtener info del canal
    const channel = await getChannelInfo(tokens.access_token)

    // Guardar en DB
    const supabase = await createServerSupabaseClient()
    const expiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString()

    await supabase.from('nm_youtube_credentials').upsert({
      club_id: 1,
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      token_expires_at: expiresAt,
      scope: tokens.scope,
      channel_id: channel?.id ?? null,
      channel_title: channel?.title ?? null,
      channel_thumbnail_url: channel?.thumbnail ?? null,
      authorized_by: state,
      authorized_at: new Date().toISOString(),
    }, { onConflict: 'club_id' })

    return NextResponse.redirect(`${url.origin}/admin/config/youtube?success=1`)
  } catch (e) {
    return NextResponse.redirect(`${url.origin}/admin/config/youtube?error=${encodeURIComponent((e as Error).message)}`)
  }
}
