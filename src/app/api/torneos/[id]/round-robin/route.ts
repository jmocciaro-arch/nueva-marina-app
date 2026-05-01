import { createServiceRoleClient, createServerSupabaseClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

/**
 * POST /api/torneos/:id/round-robin
 *
 * Genera el calendario de un torneo Round Robin (todos contra todos)
 * para una categoría dada.
 *
 * Body: { category: string, group_size?: number }
 *
 * Si se pasa `group_size`, divide a los equipos en grupos de ese tamaño
 * y arma un RR dentro de cada grupo (modo Pool + Bracket fase 1).
 * Si no se pasa, hace un solo RR con todos los equipos.
 *
 * Algoritmo (método del círculo):
 *  - Si N es impar agrega un BYE virtual.
 *  - El equipo 0 se mantiene fijo, los demás rotan en cada ronda.
 *  - Para N equipos resultan N-1 rondas (o N si N es impar).
 *  - En cada ronda hay floor(N/2) partidos.
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

  const body = await request.json().catch(() => ({}))
  const { category, group_size } = body as { category?: string; group_size?: number }
  if (!category) return NextResponse.json({ error: 'Falta category' }, { status: 400 })

  const admin = createServiceRoleClient()

  const { data: tournament } = await admin
    .from('nm_tournaments')
    .select('id, name, status, format')
    .eq('id', tid)
    .single()
  if (!tournament) return NextResponse.json({ error: 'Torneo no encontrado' }, { status: 404 })

  const { count: existing } = await admin
    .from('nm_tournament_matches')
    .select('id', { count: 'exact', head: true })
    .eq('tournament_id', tid)
    .eq('category', category)
  if (existing && existing > 0) {
    return NextResponse.json({
      error: 'Ya existe un calendario para esta categoría. Eliminá los partidos existentes primero.',
    }, { status: 400 })
  }

  const { data: teams } = await admin
    .from('nm_tournament_teams')
    .select('id, team_name, seed')
    .eq('tournament_id', tid)
    .eq('category', category)
    .eq('status', 'confirmed')
    .order('seed', { ascending: true, nullsFirst: false })
    .order('created_at', { ascending: true })

  if (!teams || teams.length < 3) {
    return NextResponse.json({
      error: 'Se necesitan al menos 3 equipos confirmados para Round Robin',
    }, { status: 400 })
  }

  type TeamRow = { id: number; team_name: string | null; seed: number | null }
  const allTeams = teams as TeamRow[]

  // Si hay group_size, dividir en grupos. Si no, todo un grupo.
  const groups: { name: string; teams: TeamRow[] }[] = []
  if (group_size && group_size > 1 && group_size < allTeams.length) {
    const numGroups = Math.ceil(allTeams.length / group_size)
    // Distribución serpentina por seed para balancear los grupos
    for (let g = 0; g < numGroups; g++) {
      groups.push({ name: `Grupo ${String.fromCharCode(65 + g)}`, teams: [] })
    }
    allTeams.forEach((team: TeamRow, idx: number) => {
      const round = Math.floor(idx / numGroups)
      const groupIdx = round % 2 === 0 ? idx % numGroups : numGroups - 1 - (idx % numGroups)
      groups[groupIdx].teams.push(team)
    })
  } else {
    groups.push({ name: 'Round Robin', teams: allTeams })
  }

  type MatchInsert = {
    tournament_id: number
    category: string
    round: string
    match_number: number
    status: string
    team1_id: number | null
    team2_id: number | null
  }

  const allInserts: MatchInsert[] = []
  let matchCounter = 0

  for (const group of groups) {
    const groupTeams = group.teams.slice()
    if (groupTeams.length < 2) continue

    // Si impar, agregar BYE virtual (id = -1)
    const isOdd = groupTeams.length % 2 === 1
    const teamsForRound: ({ id: number } | { id: -1 })[] =
      isOdd ? [...groupTeams, { id: -1 }] : groupTeams

    const N = teamsForRound.length
    const totalRounds = N - 1
    const matchesPerRound = N / 2

    // Método del círculo: el equipo 0 fijo, los demás rotan
    for (let r = 0; r < totalRounds; r++) {
      const roundLabel = groups.length > 1
        ? `${group.name} · J${r + 1}`
        : `Jornada ${r + 1}`

      for (let m = 0; m < matchesPerRound; m++) {
        // Posición del equipo en el círculo
        let i1: number
        let i2: number
        if (m === 0) {
          i1 = 0
          i2 = N - 1 - r
          if (i2 < 1) i2 = N - 1
        } else {
          i1 = ((m + r) % (N - 1)) + 1
          i2 = ((N - 1 - m + r) % (N - 1)) + 1
        }

        const t1 = teamsForRound[i1]
        const t2 = teamsForRound[i2]

        // Skip si alguno es BYE
        if (t1.id === -1 || t2.id === -1) continue

        matchCounter++
        allInserts.push({
          tournament_id: tid,
          category,
          round: roundLabel,
          match_number: matchCounter,
          status: 'pending',
          team1_id: t1.id,
          team2_id: t2.id,
        })
      }
    }
  }

  if (allInserts.length === 0) {
    return NextResponse.json({ error: 'No se pudieron generar partidos' }, { status: 500 })
  }

  const { error: insertError } = await admin
    .from('nm_tournament_matches')
    .insert(allInserts)

  if (insertError) {
    return NextResponse.json({
      error: 'Error generando partidos: ' + insertError.message,
    }, { status: 500 })
  }

  // Actualizar estado del torneo si está en registration
  if (tournament.status === 'registration' || tournament.status === 'draft') {
    await admin.from('nm_tournaments').update({ status: 'active' }).eq('id', tid)
  }

  return NextResponse.json({
    success: true,
    teams: teams.length,
    groups: groups.length,
    matches: allInserts.length,
  })
}
