import { NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/server'

/**
 * Endpoint público de solo lectura para mostrar la liga en una URL pública.
 * Anonimiza nombres de jugadores que NO autorizaron datos públicos.
 *
 * GET /api/public/liga/[id] → { league, categories, teams[], rounds[], matches[] }
 */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const leagueId = Number(id)
  if (!Number.isFinite(leagueId)) {
    return NextResponse.json({ error: 'ID inválido' }, { status: 400 })
  }

  const admin = createServiceRoleClient()

  const { data: league } = await admin
    .from('nm_leagues')
    .select('id, name, season, format, start_date, end_date, status, description, cover_image_url')
    .eq('id', leagueId)
    .single()
  if (!league) return NextResponse.json({ error: 'Liga no encontrada' }, { status: 404 })

  const { data: categories } = await admin
    .from('nm_league_categories')
    .select('id, name, gender, level, status, sort_order')
    .eq('league_id', leagueId)
    .order('sort_order')

  const catIds = (categories ?? []).map((c: { id: number }) => c.id)
  if (catIds.length === 0) {
    return NextResponse.json({ league, categories: [], teams: [], rounds: [], matches: [] })
  }

  const [teamsRes, roundsRes, matchesRes] = await Promise.all([
    admin.from('nm_league_teams')
      .select('id, category_id, team_name, player1_name, player2_name, player3_name, player1_id, player2_id, player3_id')
      .in('category_id', catIds),
    admin.from('nm_league_rounds')
      .select('id, category_id, round_number, scheduled_date, status')
      .in('category_id', catIds)
      .order('round_number'),
    admin.from('nm_league_matches')
      .select('id, round_id, category_id, team1_id, team2_id, team1_set1, team2_set1, team1_set2, team2_set2, team1_set3, team2_set3, sets_team1, sets_team2, winner_team_id, status, played_date')
      .in('category_id', catIds),
  ])

  type RawTeam = {
    id: number; category_id: number; team_name: string | null
    player1_name: string; player2_name: string; player3_name: string | null
    player1_id: string | null; player2_id: string | null; player3_id: string | null
  }
  const teamsRaw = (teamsRes.data ?? []) as RawTeam[]

  // Cargar consent_data_public de los usuarios vinculados
  const linkedIds = new Set<string>()
  for (const t of teamsRaw) {
    if (t.player1_id) linkedIds.add(t.player1_id)
    if (t.player2_id) linkedIds.add(t.player2_id)
    if (t.player3_id) linkedIds.add(t.player3_id)
  }
  const consentMap = new Map<string, { consent: boolean; fullName: string | null; avatar: string | null }>()
  if (linkedIds.size > 0) {
    const { data: us } = await admin
      .from('nm_users')
      .select('id, full_name, avatar_url, consent_data_public, consent_image_use')
      .in('id', Array.from(linkedIds))
    for (const u of (us ?? []) as { id: string; full_name: string | null; avatar_url: string | null; consent_data_public: boolean | null; consent_image_use: boolean | null }[]) {
      consentMap.set(u.id, {
        consent: u.consent_data_public === true,
        fullName: u.consent_data_public === true ? u.full_name : null,
        avatar: u.consent_image_use === true ? u.avatar_url : null,
      })
    }
  }

  // Helper: decide nombre público del slot
  function publicName(slotName: string | null, slotUserId: string | null, teamIdx: number, slotIdx: 1 | 2 | 3): { name: string; avatar: string | null; anonymized: boolean } {
    if (!slotName) return { name: '', avatar: null, anonymized: false }
    if (slotUserId) {
      const info = consentMap.get(slotUserId)
      if (info && info.consent) {
        return { name: info.fullName ?? slotName, avatar: info.avatar, anonymized: false }
      }
      // Vinculado pero sin consentimiento público → anonimizar
      return { name: `Jugador ${teamIdx}.${slotIdx}`, avatar: null, anonymized: true }
    }
    // Sin vincular → no hay usuario al que pedir consentimiento; usamos el nombre del Excel tal cual
    return { name: slotName, avatar: null, anonymized: false }
  }

  const teams = teamsRaw.map((t, idx) => {
    const teamIdx = idx + 1
    const p1 = publicName(t.player1_name, t.player1_id, teamIdx, 1)
    const p2 = publicName(t.player2_name, t.player2_id, teamIdx, 2)
    const p3 = publicName(t.player3_name, t.player3_id, teamIdx, 3)
    // Si cualquier slot quedó anonimizado, también ocultamos el team_name original
    const anyAnon = p1.anonymized || p2.anonymized || p3.anonymized
    const displayTeamName = anyAnon ? `Equipo ${teamIdx}` : (t.team_name ?? `Equipo ${teamIdx}`)
    return {
      id: t.id,
      category_id: t.category_id,
      team_name: displayTeamName,
      players: [p1, p2, p3.name ? p3 : null].filter(Boolean) as { name: string; avatar: string | null; anonymized: boolean }[],
    }
  })

  return NextResponse.json({
    league,
    categories: categories ?? [],
    teams,
    rounds: roundsRes.data ?? [],
    matches: matchesRes.data ?? [],
  })
}
