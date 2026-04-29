import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { uploadVideoToYouTube, refreshAccessToken } from '@/lib/youtube/client'

// POST /api/youtube/upload — sube un highlight a YouTube
// Body: { highlight_id: number, title?: string, description?: string, privacy?: string }
export async function POST(req: NextRequest) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const body = await req.json()
  const { highlight_id, title, description, privacy = 'unlisted', tags = [] } = body

  if (!highlight_id) {
    return NextResponse.json({ error: 'highlight_id requerido' }, { status: 400 })
  }

  // Cargar highlight
  const { data: highlight, error: hErr } = await supabase
    .from('nm_match_highlights')
    .select('*, session:nm_live_match_sessions(team1_player1_name, team1_player2_name, team2_player1_name, team2_player2_name, match_type, match_id)')
    .eq('id', highlight_id)
    .single()

  if (hErr || !highlight) {
    return NextResponse.json({ error: 'Highlight no encontrado' }, { status: 404 })
  }

  // Cargar credenciales de YouTube
  const { data: creds } = await supabase
    .from('nm_youtube_credentials')
    .select('*')
    .eq('club_id', 1)
    .single()

  if (!creds) {
    return NextResponse.json({
      error: 'YouTube no autorizado. Andá a /admin/config/youtube para conectar el canal.',
    }, { status: 400 })
  }

  // Refrescar token si expiró
  let accessToken = creds.access_token
  if (creds.token_expires_at && new Date(creds.token_expires_at) < new Date()) {
    const clientId = process.env.GOOGLE_CLIENT_ID!
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET!
    try {
      const refreshed = await refreshAccessToken(creds.refresh_token, clientId, clientSecret)
      accessToken = refreshed.access_token
      const newExpiresAt = new Date(Date.now() + refreshed.expires_in * 1000).toISOString()
      await supabase.from('nm_youtube_credentials').update({
        access_token: refreshed.access_token,
        token_expires_at: newExpiresAt,
      }).eq('id', creds.id)
    } catch (e) {
      return NextResponse.json({ error: `Token expirado: ${(e as Error).message}` }, { status: 401 })
    }
  }

  // Marcar como uploading
  await supabase.from('nm_match_highlights').update({
    youtube_status: 'uploading',
  }).eq('id', highlight_id)

  try {
    // Descargar el video desde Supabase Storage
    const videoRes = await fetch(highlight.video_url)
    if (!videoRes.ok) throw new Error('No se pudo descargar el video desde Supabase')
    const videoBuffer = await videoRes.arrayBuffer()

    // Generar título y descripción si no vienen
    const session = highlight.session
    const team1 = session ? `${session.team1_player1_name} / ${session.team1_player2_name}` : 'Equipo 1'
    const team2 = session ? `${session.team2_player1_name} / ${session.team2_player2_name}` : 'Equipo 2'

    const finalTitle = title || `${highlight.scoring_player_name ?? 'Punto'} - ${team1} vs ${team2} - Nueva Marina Pádel`
    const finalDescription = description || [
      `Highlight de partido en Nueva Marina Pádel & Sport`,
      ``,
      `Equipo CYAN: ${team1}`,
      `Equipo ROSA: ${team2}`,
      session?.match_type ? `Tipo: ${session.match_type === 'tournament' ? 'Torneo' : 'Liga'}` : '',
      highlight.point_type ? `Tipo de punto: ${highlight.point_type.replace('_', ' ')}` : '',
      ``,
      `🎾 Más en: nuevamarina.es`,
    ].filter(Boolean).join('\n')

    // Subir a YouTube
    const result = await uploadVideoToYouTube({
      accessToken,
      videoBlob: videoBuffer,
      title: finalTitle.slice(0, 100), // YouTube max 100 chars
      description: finalDescription.slice(0, 5000),
      tags: [...tags, 'padel', 'nueva-marina', 'highlight'],
      categoryId: '17', // Sports
      privacy,
    })

    // Actualizar highlight con datos de YouTube
    await supabase.from('nm_match_highlights').update({
      youtube_video_id: result.id,
      youtube_url: result.url,
      youtube_uploaded_at: new Date().toISOString(),
      youtube_status: 'uploaded',
    }).eq('id', highlight_id)

    // Actualizar last_used del credential
    await supabase.from('nm_youtube_credentials').update({
      last_used_at: new Date().toISOString(),
    }).eq('id', creds.id)

    return NextResponse.json({ ok: true, video_id: result.id, url: result.url })
  } catch (e) {
    await supabase.from('nm_match_highlights').update({
      youtube_status: 'failed',
    }).eq('id', highlight_id)
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
