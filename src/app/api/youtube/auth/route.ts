import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { getYouTubeAuthUrl } from '@/lib/youtube/client'

// GET /api/youtube/auth — inicia el flujo OAuth con Google
export async function GET(req: NextRequest) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const clientId = process.env.GOOGLE_CLIENT_ID
  if (!clientId) {
    return NextResponse.json({
      error: 'Falta configurar GOOGLE_CLIENT_ID en variables de entorno',
      setupGuide: '/admin/config/youtube/setup',
    }, { status: 500 })
  }

  const url = new URL(req.url)
  const redirectUri = `${url.origin}/api/youtube/callback`
  const state = user.id // identifica al usuario en el callback

  return NextResponse.redirect(getYouTubeAuthUrl(clientId, redirectUri, state))
}
