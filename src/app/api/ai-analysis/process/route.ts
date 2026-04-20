import { NextResponse } from 'next/server'
import { createServerSupabaseClient, createServiceRoleClient } from '@/lib/supabase/server'

/**
 * POST /api/ai-analysis/process
 * Body: { video_id }
 *
 * MVP: pipeline mock. Simula el análisis y genera un informe plausible con
 * heatmap, highlights, golpes y 3 recomendaciones. En producción este endpoint
 * debería encolar el job en un pipeline real (OpenAI Vision, SportAI, etc.)
 * y mover el status a 'processing' hasta que termine.
 *
 * Devuelve: { report_id, overall_score, highlights_count }
 */
export async function POST(request: Request) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const body = await request.json().catch(() => ({}))
  const { video_id } = body
  if (!video_id) return NextResponse.json({ error: 'Falta video_id' }, { status: 400 })

  const { data: video, error: vErr } = await supabase
    .from('nm_ai_videos')
    .select('id, user_id, duration_seconds, court_side, match_type')
    .eq('id', video_id)
    .single()
  if (vErr || !video) {
    return NextResponse.json({ error: 'Video no encontrado' }, { status: 404 })
  }

  // usamos service role porque vamos a escribir en reports + highlights
  // y a actualizar el status del video
  const admin = createServiceRoleClient()

  await admin
    .from('nm_ai_videos')
    .update({ status: 'processing', processing_started_at: new Date().toISOString() })
    .eq('id', video_id)

  // ──────────────────────────────────────────────────────────────
  // MOCK: generación determinística-ish de métricas plausibles
  // ──────────────────────────────────────────────────────────────
  const duration = video.duration_seconds && video.duration_seconds > 0
    ? video.duration_seconds
    : 3600

  const rnd = mulberry32(hashString(video.id))

  const shots_forehand = 40 + Math.floor(rnd() * 50)
  const shots_backhand = 25 + Math.floor(rnd() * 35)
  const shots_volley = 15 + Math.floor(rnd() * 30)
  const shots_smash = 3 + Math.floor(rnd() * 8)
  const shots_serve = 20 + Math.floor(rnd() * 30)
  const shots_bandeja = 8 + Math.floor(rnd() * 12)
  const shots_vibora = 2 + Math.floor(rnd() * 6)
  const shots_total =
    shots_forehand + shots_backhand + shots_volley + shots_smash +
    shots_serve + shots_bandeja + shots_vibora

  const winners_count = Math.floor(shots_total * (0.06 + rnd() * 0.06))
  const unforced_errors = Math.floor(shots_total * (0.08 + rnd() * 0.07))
  const errors_count = unforced_errors + Math.floor(shots_total * 0.04)

  const skill_score = 55 + Math.floor(rnd() * 35)
  const positioning_score = 50 + Math.floor(rnd() * 40)
  const consistency_score = 55 + Math.floor(rnd() * 35)
  const overall_score = Math.round((skill_score + positioning_score + consistency_score) / 3)

  const distance_meters = Math.round((duration / 60) * (140 + rnd() * 60) * 10) / 10
  const avg_speed_kmh = Math.round((7 + rnd() * 3) * 10) / 10
  const max_speed_kmh = Math.round((avg_speed_kmh + 6 + rnd() * 5) * 10) / 10

  // Heatmap simplificado: grilla 6x10 con pesos
  const heatmap_data = []
  for (let y = 0; y < 6; y++) {
    for (let x = 0; x < 10; x++) {
      const weight = Math.round(rnd() * 100) / 100
      if (weight > 0.15) heatmap_data.push({ x, y, weight })
    }
  }

  // Mejoras — priorizadas según los puntos débiles
  const improvements = buildImprovements({
    positioning_score,
    consistency_score,
    unforced_errors,
    shots_volley,
    shots_total,
    court_side: video.court_side,
  })

  const summary = `Partido de ${video.match_type} con ${shots_total} golpes registrados. ` +
    `Score global ${overall_score}/100. ` +
    `Destaca tu ${overall_score >= 75 ? 'buena técnica y posicionamiento' : 'volea y saque, mejorá la consistencia en resto'}.`

  const { data: report, error: rErr } = await admin
    .from('nm_ai_reports')
    .insert({
      video_id,
      overall_score,
      skill_score,
      positioning_score,
      consistency_score,
      shots_total,
      shots_forehand,
      shots_backhand,
      shots_volley,
      shots_smash,
      shots_serve,
      shots_bandeja,
      shots_vibora,
      winners_count,
      errors_count,
      unforced_errors,
      distance_meters,
      avg_speed_kmh,
      max_speed_kmh,
      heatmap_data,
      improvements,
      summary,
    })
    .select('id')
    .single()

  if (rErr || !report) {
    await admin
      .from('nm_ai_videos')
      .update({ status: 'failed', error_message: rErr?.message ?? 'unknown' })
      .eq('id', video_id)
    return NextResponse.json(
      { error: 'No se pudo generar el informe: ' + (rErr?.message ?? '?') },
      { status: 500 }
    )
  }

  // Highlights: 6–10 momentos repartidos por la duración
  const highlights_count = 6 + Math.floor(rnd() * 5)
  const shotTypes = ['forehand', 'backhand', 'volley', 'smash', 'serve', 'bandeja', 'vibora']
  const qualities = ['excellent', 'good', 'regular', 'poor']
  const outcomes = ['winner', 'error', 'neutral']
  const highlights = []
  for (let i = 0; i < highlights_count; i++) {
    const ts = Math.floor((duration / highlights_count) * i + rnd() * 30)
    const shot = shotTypes[Math.floor(rnd() * shotTypes.length)]
    const quality = qualities[Math.floor(rnd() * qualities.length)]
    const outcome = outcomes[Math.floor(rnd() * outcomes.length)]
    highlights.push({
      video_id,
      timestamp_sec: ts,
      duration_sec: 5,
      shot_type: shot,
      outcome,
      quality,
      note: highlightNote(shot, outcome, quality),
    })
  }
  await admin.from('nm_ai_highlights').insert(highlights)

  await admin
    .from('nm_ai_videos')
    .update({
      status: 'completed',
      processing_completed_at: new Date().toISOString(),
    })
    .eq('id', video_id)

  return NextResponse.json({
    success: true,
    report_id: report.id,
    overall_score,
    highlights_count,
  })
}

// ──────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────
function hashString(s: string): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

function mulberry32(seed: number): () => number {
  let t = seed
  return function () {
    t |= 0; t = (t + 0x6D2B79F5) | 0
    let r = Math.imul(t ^ (t >>> 15), 1 | t)
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296
  }
}

interface ImprovementInput {
  positioning_score: number
  consistency_score: number
  unforced_errors: number
  shots_volley: number
  shots_total: number
  court_side: string | null
}

function buildImprovements(x: ImprovementInput) {
  const out: Array<{ title: string; description: string; priority: 'high' | 'med' | 'low'; shot_type?: string }> = []

  if (x.positioning_score < 65) {
    out.push({
      title: 'Mejorá tu posicionamiento en red',
      description: 'Detectamos que bajás demasiado al fondo tras la volea. Intentá mantener la línea de los 3 metros después de cada golpe ofensivo.',
      priority: 'high',
    })
  }
  if (x.unforced_errors / Math.max(x.shots_total, 1) > 0.12) {
    out.push({
      title: 'Reducí errores no forzados',
      description: `${x.unforced_errors} errores no forzados en el partido. La mayoría ocurren en el segundo bote del ${x.court_side === 'reves' ? 'revés' : 'derecha'}. Entrená salidas de pared con más margen.`,
      priority: 'high',
      shot_type: 'backhand',
    })
  }
  if (x.shots_volley < 20) {
    out.push({
      title: 'Subí más a la red',
      description: 'Pocas voleas registradas. En pádel el 70% de los puntos se gana desde la red. Trabajá las transiciones ofensivas.',
      priority: 'med',
      shot_type: 'volley',
    })
  }
  if (x.consistency_score < 70) {
    out.push({
      title: 'Trabajá la consistencia del saque',
      description: 'El segundo saque cae frecuentemente corto. Practicá 10 minutos diarios de saque al lado del revés del rival.',
      priority: 'med',
      shot_type: 'serve',
    })
  }

  // siempre devolvemos al menos 3
  if (out.length < 3) {
    out.push({
      title: 'Seguí con la rutina de bandeja',
      description: 'Tu bandeja está sólida. Próximo paso: mezclarla con víbora para desarmar al rival del fondo.',
      priority: 'low',
      shot_type: 'bandeja',
    })
  }

  return out.slice(0, 4)
}

function highlightNote(shot: string, outcome: string, quality: string): string {
  const shotLabel: Record<string, string> = {
    forehand: 'Derecha',
    backhand: 'Revés',
    volley: 'Volea',
    smash: 'Remate',
    serve: 'Saque',
    bandeja: 'Bandeja',
    vibora: 'Víbora',
  }
  const qualityLabel: Record<string, string> = {
    excellent: 'excelente',
    good: 'buena',
    regular: 'regular',
    poor: 'mal ejecutada',
  }
  const outcomeLabel: Record<string, string> = {
    winner: 'ganadora',
    error: 'con error',
    neutral: 'en juego',
  }
  return `${shotLabel[shot] ?? shot} ${qualityLabel[quality] ?? ''} ${outcomeLabel[outcome] ?? ''}`.trim()
}
