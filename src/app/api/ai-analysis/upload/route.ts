import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'

/**
 * POST /api/ai-analysis/upload
 * Body: { title, description?, video_url?, duration_seconds?, file_size_mb?,
 *         match_type?, court_side?, match_context?, opponents?, partner?,
 *         court_id?, source? }
 *
 * Crea un registro nm_ai_videos en estado pending. El video real puede estar
 * en Supabase Storage (video_url firmada) o ser una URL externa temporal.
 * Devuelve: { video_id } — con el cual el cliente puede llamar a /process.
 */
export async function POST(request: Request) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const body = await request.json().catch(() => ({}))
  const {
    title,
    description = null,
    video_url = null,
    thumbnail_url = null,
    duration_seconds = null,
    file_size_mb = null,
    match_type = 'dobles',
    court_side = 'derecha',
    match_context = null,
    opponents = null,
    partner = null,
    court_id = null,
    source = 'upload',
    shared_with_coach = false,
    coach_id = null,
  } = body

  if (!title || typeof title !== 'string' || title.trim().length === 0) {
    return NextResponse.json({ error: 'Falta title' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('nm_ai_videos')
    .insert({
      user_id: user.id,
      title: title.trim(),
      description,
      video_url,
      thumbnail_url,
      duration_seconds,
      file_size_mb,
      match_type,
      court_side,
      match_context,
      opponents,
      partner,
      court_id,
      source,
      shared_with_coach,
      coach_id,
      status: 'pending',
      ai_provider: 'mock_v1',
    })
    .select('id')
    .single()

  if (error || !data) {
    return NextResponse.json(
      { error: 'No se pudo crear el análisis: ' + (error?.message ?? '?') },
      { status: 500 }
    )
  }

  return NextResponse.json({ success: true, video_id: data.id })
}
