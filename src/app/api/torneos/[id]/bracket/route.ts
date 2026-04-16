import { createServiceRoleClient, createServerSupabaseClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

/**
 * POST /api/torneos/:id/bracket
 * Genera el cuadro/bracket de eliminación directa para un torneo+categoría.
 * Body: { category: string }
 *
 * Lógica:
 *  1. Lee equipos inscriptos (confirmed) de esa categoría
 *  2. Calcula la potencia de 2 más cercana (BYEs si hace falta)
 *  3. Genera partidos de todas las rondas con next_match_id + slot_in_next
 *  4. Asigna equipos a la primera ronda (con BYEs)
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: tournamentId } = await params
  const tid = Number(tournamentId)

  // Auth: solo admin/owner
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const { data: membership } = await supabase
    .from('nm_club_members')
    .select('role')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .in('role', ['owner', 'admin'])
    .single()
  if (!membership) return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

  const body = await request.json()
  const { category } = body
  if (!category) return NextResponse.json({ error: 'Falta category' }, { status: 400 })

  const admin = createServiceRoleClient()

  // Verificar torneo existe
  const { data: tournament } = await admin
    .from('nm_tournaments')
    .select('id, name, status')
    .eq('id', tid)
    .single()
  if (!tournament) return NextResponse.json({ error: 'Torneo no encontrado' }, { status: 404 })

  // Verificar que no existan partidos previos para esta categoría
  const { count: existing } = await admin
    .from('nm_tournament_matches')
    .select('id', { count: 'exact', head: true })
    .eq('tournament_id', tid)
    .eq('category', category)
  if (existing && existing > 0) {
    return NextResponse.json({ error: 'Ya existe bracket para esta categoría. Eliminá los partidos existentes primero.' }, { status: 400 })
  }

  // Leer equipos inscriptos
  const { data: teams } = await admin
    .from('nm_tournament_teams')
    .select('id, name, seed')
    .eq('tournament_id', tid)
    .eq('category', category)
    .eq('status', 'confirmed')
    .order('seed', { ascending: true, nullsFirst: false })
    .order('created_at', { ascending: true })

  if (!teams || teams.length < 2) {
    return NextResponse.json({ error: 'Se necesitan al menos 2 equipos confirmados' }, { status: 400 })
  }

  const numTeams = teams.length
  // Potencia de 2 superior o igual
  const bracketSize = Math.pow(2, Math.ceil(Math.log2(numTeams)))
  const totalRounds = Math.log2(bracketSize)
  const numByes = bracketSize - numTeams

  const ROUND_NAMES: Record<number, string> = {
    1: bracketSize >= 16 ? 'Dieciseisavos' : bracketSize >= 8 ? 'Octavos' : bracketSize >= 4 ? 'Cuartos' : 'Semifinal',
    2: totalRounds === 2 ? 'Final' : totalRounds === 3 ? 'Semifinal' : totalRounds === 4 ? 'Cuartos' : `Ronda ${2}`,
    3: totalRounds === 3 ? 'Final' : totalRounds === 4 ? 'Semifinal' : `Ronda ${3}`,
    4: totalRounds === 4 ? 'Final' : `Ronda ${4}`,
    5: 'Final',
  }

  // Generar todos los partidos (de final hacia atrás para tener los IDs de next_match)
  // Ronda N (final) tiene 1 partido, ronda N-1 tiene 2, etc.
  // Pero necesitamos insertar desde la final primero para tener el next_match_id

  type MatchInsert = {
    tournament_id: number
    category: string
    round: string
    round_number: number
    match_number: number
    bracket_position: number
    status: string
    next_match_id: number | null
    slot_in_next: number | null
    is_bye: boolean
    team1_id: number | null
    team2_id: number | null
  }

  // Build structure: rounds[roundNum] = array of match placeholders
  const matchIds: number[][] = [] // matchIds[roundIdx][matchIdx] = DB id

  // Insert round by round from final (last round) to first
  for (let r = totalRounds; r >= 1; r--) {
    const matchesInRound = Math.pow(2, totalRounds - r)
    const roundName = ROUND_NAMES[r] || `Ronda ${r}`
    const inserts: MatchInsert[] = []

    for (let m = 0; m < matchesInRound; m++) {
      const nextRoundIdx = r // next round in our array = r (because we index from totalRounds downward)
      let nextMatchId: number | null = null
      let slotInNext: number | null = null

      if (r < totalRounds) {
        // This match feeds into round r+1, match floor(m/2)
        const nextMatchLocalIdx = Math.floor(m / 2)
        const nextRoundMatches = matchIds[r] // matchIds indexed by round_number
        if (nextRoundMatches && nextRoundMatches[nextMatchLocalIdx]) {
          nextMatchId = nextRoundMatches[nextMatchLocalIdx]
          slotInNext = (m % 2) + 1 // 1 or 2
        }
      }

      inserts.push({
        tournament_id: tid,
        category,
        round: roundName,
        round_number: r,
        match_number: m + 1,
        bracket_position: m,
        status: 'pending',
        next_match_id: nextMatchId,
        slot_in_next: slotInNext,
        is_bye: false,
        team1_id: null,
        team2_id: null,
      })
    }

    const { data: inserted, error } = await admin
      .from('nm_tournament_matches')
      .insert(inserts)
      .select('id, match_number')
      .order('match_number')

    if (error) {
      return NextResponse.json({ error: 'Error generando ronda: ' + error.message }, { status: 500 })
    }

    // Store IDs indexed by round_number for linking
    matchIds[r] = (inserted || []).map((m: { id: number }) => m.id)
  }

  // Now assign teams to first round using standard seeding
  // Seed order for elimination: 1v16, 8v9, 5v12, 4v13, 3v14, 6v11, 7v10, 2v15
  const seedOrder = generateSeedOrder(bracketSize)

  // Pad teams with nulls for BYEs
  const seededTeams: (typeof teams[0] | null)[] = new Array(bracketSize).fill(null)
  for (let i = 0; i < teams.length; i++) {
    seededTeams[i] = teams[i]
  }

  const firstRoundIds = matchIds[1] || []
  const updates: { id: number; team1_id: number | null; team2_id: number | null; is_bye: boolean; winner_team_id: number | null; status: string }[] = []

  for (let m = 0; m < firstRoundIds.length; m++) {
    const seedIdx1 = seedOrder[m * 2]
    const seedIdx2 = seedOrder[m * 2 + 1]
    const t1 = seededTeams[seedIdx1] ?? null
    const t2 = seededTeams[seedIdx2] ?? null

    const isBye = !t1 || !t2
    const winnerId = isBye ? (t1?.id ?? t2?.id ?? null) : null

    updates.push({
      id: firstRoundIds[m],
      team1_id: t1?.id ?? null,
      team2_id: t2?.id ?? null,
      is_bye: isBye,
      winner_team_id: winnerId,
      status: isBye ? 'completed' : 'pending',
    })
  }

  // Apply team assignments
  for (const u of updates) {
    await admin.from('nm_tournament_matches').update({
      team1_id: u.team1_id,
      team2_id: u.team2_id,
      is_bye: u.is_bye,
      winner_team_id: u.winner_team_id,
      status: u.status,
    }).eq('id', u.id)
  }

  // Update tournament status to active/playoffs
  if (tournament.status === 'registration' || tournament.status === 'active') {
    await admin.from('nm_tournaments').update({ status: 'playoffs' }).eq('id', tid)
  }

  return NextResponse.json({
    success: true,
    bracket_size: bracketSize,
    teams: numTeams,
    byes: numByes,
    rounds: totalRounds,
    matches: firstRoundIds.length * 2 - 1, // total matches in single elimination
  })
}

/**
 * Genera el orden de seeds para eliminación directa.
 * Para 8 equipos: [0,7, 3,4, 1,6, 2,5] → 1v8, 4v5, 2v7, 3v6
 */
function generateSeedOrder(size: number): number[] {
  if (size === 1) return [0]
  if (size === 2) return [0, 1]

  const result: number[] = []
  const half = size / 2
  const upper = generateSeedOrder(half)

  for (const s of upper) {
    result.push(s)
    result.push(size - 1 - s)
  }
  return result
}
