import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient as createClient } from '@/lib/supabase/server'

// POST /api/live-match — crear sesión de marcador para un partido
// Body: { match_type: 'tournament' | 'league', match_id: number, options?: { sets_to_win, golden_point, super_tiebreak_final } }
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const body = await req.json()
  const { match_type, match_id, options = {} } = body

  if (!match_type || !match_id) {
    return NextResponse.json({ error: 'match_type y match_id requeridos' }, { status: 400 })
  }

  // ¿Ya existe una sesión para este match?
  const { data: existing } = await supabase
    .from('nm_live_match_sessions')
    .select('*')
    .eq('match_type', match_type)
    .eq('match_id', match_id)
    .maybeSingle()

  if (existing) {
    return NextResponse.json({ session: existing, existed: true })
  }

  // Buscar datos del partido para denormalizar nombres de jugadores
  const tableName = match_type === 'tournament' ? 'nm_tournament_matches' : 'nm_league_matches'
  const teamTableName = match_type === 'tournament' ? 'nm_tournament_teams' : 'nm_league_teams'

  const { data: match } = await supabase
    .from(tableName)
    .select('*')
    .eq('id', match_id)
    .single()

  if (!match) return NextResponse.json({ error: 'Partido no encontrado' }, { status: 404 })

  const [team1Res, team2Res] = await Promise.all([
    match.team1_id ? supabase.from(teamTableName).select('*').eq('id', match.team1_id).single() : Promise.resolve({ data: null }),
    match.team2_id ? supabase.from(teamTableName).select('*').eq('id', match.team2_id).single() : Promise.resolve({ data: null }),
  ])

  const team1: Record<string, unknown> | null = team1Res.data as Record<string, unknown> | null
  const team2: Record<string, unknown> | null = team2Res.data as Record<string, unknown> | null

  // Crear sesión
  const insertData = {
    match_type,
    match_id,
    team1_id: match.team1_id,
    team2_id: match.team2_id,
    team1_player1_name: (team1?.player1_name as string) ?? `Jugador 1 (E1)`,
    team1_player2_name: (team1?.player2_name as string) ?? `Jugador 2 (E1)`,
    team2_player1_name: (team2?.player1_name as string) ?? `Jugador 1 (E2)`,
    team2_player2_name: (team2?.player2_name as string) ?? `Jugador 2 (E2)`,
    status: 'live',
    sets_to_win: options.sets_to_win ?? 2,
    games_per_set: options.games_per_set ?? 6,
    golden_point: options.golden_point ?? false,
    super_tiebreak_final: options.super_tiebreak_final ?? false,
    started_at: new Date().toISOString(),
    created_by: user.id,
  }

  const { data: session, error } = await supabase
    .from('nm_live_match_sessions')
    .insert(insertData)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ session, existed: false })
}

// GET /api/live-match?match_type=tournament&match_id=123 — obtener sesión existente
export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const url = new URL(req.url)
  const match_type = url.searchParams.get('match_type')
  const match_id = url.searchParams.get('match_id')

  if (!match_type || !match_id) {
    return NextResponse.json({ error: 'match_type y match_id requeridos' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('nm_live_match_sessions')
    .select('*')
    .eq('match_type', match_type)
    .eq('match_id', match_id)
    .maybeSingle()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ session: data })
}

// PATCH /api/live-match/[id] — al finalizar, sincronizar resultado al match original
export async function PATCH(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const body = await req.json()
  const { session_id } = body

  const { data: session } = await supabase
    .from('nm_live_match_sessions')
    .select('*')
    .eq('id', session_id)
    .single()

  if (!session || session.status !== 'completed') {
    return NextResponse.json({ error: 'Partido no finalizado' }, { status: 400 })
  }

  // Sincronizar al match original
  const tableName = session.match_type === 'tournament' ? 'nm_tournament_matches' : 'nm_league_matches'

  // Cargar sets para reconstruir scores
  const { data: sets } = await supabase
    .from('nm_live_match_sets')
    .select('*')
    .eq('session_id', session_id)
    .order('set_number')

  const updateMatch: Record<string, unknown> = {
    status: 'completed',
    sets_team1: session.sets_team1,
    sets_team2: session.sets_team2,
    winner_team_id: session.winner_team === 1 ? session.team1_id : session.team2_id,
    played_date: session.completed_at,
  }

  if (sets && sets.length > 0) {
    sets.forEach((s: { games_team1: number; games_team2: number }, idx: number) => {
      const n = idx + 1
      updateMatch[`team1_set${n}`] = s.games_team1
      updateMatch[`team2_set${n}`] = s.games_team2
    })
  }

  await supabase.from(tableName).update(updateMatch).eq('id', session.match_id)

  return NextResponse.json({ ok: true })
}
