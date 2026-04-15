import { NextResponse } from 'next/server'
import { createServiceRoleClient, createServerSupabaseClient } from '@/lib/supabase/server'
import * as XLSX from 'xlsx'

/**
 * Import de Liga desde Excel (formato Christian / Nueva Marina).
 *
 * Estructura esperada del xlsx:
 *  - Hoja "EQUIPOS" (opcional) — roster maestro
 *  - Una hoja por categoría: '23', '3RA', '4TA', '5TA', '45 FEM GA', '45 FEM GB',
 *    'MIXTO A', 'MIXTO B', 'MIXTO B G2', etc.
 *
 * Cada hoja de categoría tiene bloques repetidos "JORNADA N" en columnas B y H
 * (dos jornadas lado a lado). Debajo de cada JORNADA hay 6 u 8 nombres de equipo
 * (parejas o tríos separados por "-"), que se aparean de a dos: fila 0 vs 1,
 * fila 2 vs 3, etc. "DESCANSA" / "DESCANSO" = bye.
 *
 * POST multipart:
 *   file: xlsx
 *   league_name: string (opcional, default "Liga importada")
 *   start_date: YYYY-MM-DD (opcional, default hoy)
 *   dry_run: 'true' para solo previsualizar
 */

const CLUB_ID = 1
const SPORT_ID = 1

// Mapeo de nombre de hoja → categoría legible + gender
const CATEGORY_MAP: Record<string, { name: string; gender: 'male' | 'female' | 'mixed'; level: string; sort: number }> = {
  '23':          { name: '2ª / 3ª Masculina',     gender: 'male',   level: '2-3', sort: 1 },
  '3RA':         { name: '3ª Masculina',           gender: 'male',   level: '3',   sort: 2 },
  '4TA':         { name: '4ª Masculina',           gender: 'male',   level: '4',   sort: 3 },
  '5TA':         { name: '5ª Masculina',           gender: 'male',   level: '5',   sort: 4 },
  '45 FEM GA':   { name: '4ª/5ª Femenina - Grupo A', gender: 'female', level: '4-5', sort: 5 },
  '45 FEM GB':   { name: '4ª/5ª Femenina - Grupo B', gender: 'female', level: '4-5', sort: 6 },
  'MIXTO A':     { name: 'Mixto A',                 gender: 'mixed',  level: 'A',   sort: 7 },
  'MIXTO B':     { name: 'Mixto B',                 gender: 'mixed',  level: 'B',   sort: 8 },
  'MIXTO B G2':  { name: 'Mixto B - Grupo 2',       gender: 'mixed',  level: 'B',   sort: 9 },
}

interface ParsedMatch { team1: string; team2: string; bye?: boolean }
interface ParsedRound  { round_number: number; matches: ParsedMatch[] }
interface ParsedCategory {
  sheet_name: string
  name: string
  gender: 'male' | 'female' | 'mixed'
  level: string
  sort_order: number
  teams: string[]
  rounds: ParsedRound[]
}

function normalizeSheetKey(raw: string): string {
  return raw.trim().toUpperCase().replace(/\s+/g, ' ')
}

function normalizeTeamName(raw: unknown): string {
  if (raw == null) return ''
  return String(raw).trim().replace(/\s+/g, ' ').toUpperCase()
}

function splitPlayers(teamName: string): { p1: string; p2: string; p3?: string } {
  // "ANTONIO-GIAN-ALAN" → 3 players. Admite " - " o "-".
  const parts = teamName.split(/\s*-\s*/).map(s => s.trim()).filter(Boolean)
  if (parts.length >= 3) return { p1: parts[0], p2: parts[1], p3: parts.slice(2).join(' - ') }
  if (parts.length === 2) return { p1: parts[0], p2: parts[1] }
  return { p1: teamName, p2: '??' }
}

/**
 * Parsea una hoja de categoría. El layout tiene dos jornadas por fila:
 * columnas B-F (índice 1-5) para JORNADA par/impar, G-L (índice 7-11) para la otra.
 */
function parseCategorySheet(ws: XLSX.WorkSheet, sheetName: string): ParsedCategory | null {
  // Forzamos que la grilla arranque siempre en A1 para que los índices de columna sean consistentes
  const range = ws['!ref'] ? XLSX.utils.decode_range(ws['!ref']) : { s: { r: 0, c: 0 }, e: { r: 200, c: 25 } }
  const maxRow = Math.min(range.e.r + 2, 500)
  const maxCol = Math.min(range.e.c + 2, 50)
  const grid: (string | number | null)[][] = []
  for (let r = 0; r <= maxRow; r++) {
    const row: (string | number | null)[] = []
    for (let c = 0; c <= maxCol; c++) {
      const addr = XLSX.utils.encode_cell({ r, c })
      const cell = ws[addr]
      row.push(cell ? (cell.v as string | number | null) : null)
    }
    grid.push(row)
  }

  const key = normalizeSheetKey(sheetName)
  const meta = CATEGORY_MAP[key] ?? {
    name: sheetName.trim(),
    gender: 'mixed' as const,
    level: '',
    sort: 99,
  }

  const rounds: ParsedRound[] = []
  const teamsSet = new Set<string>()

  // Escaneo: buscar cualquier celda con "JORNADA N" en toda la grilla
  for (let r = 0; r < grid.length; r++) {
    const row = grid[r] ?? []
    for (let col = 0; col < row.length; col++) {
      const cell = row[col]
      if (typeof cell !== 'string') continue
      const m = /JORNADA\s+(\d+)/i.exec(cell)
      if (!m) continue
      const roundNumber = parseInt(m[1], 10)

      // Recolectar equipos en las filas siguientes de la misma columna
      const labels: string[] = []
      for (let k = 1; k <= 12; k++) {
        const nextRow = grid[r + k] ?? []
        const val = nextRow[col]
        if (val == null) continue
        const asStr = String(val).trim()
        if (!asStr) continue
        if (/JORNADA\s+\d+/i.test(asStr)) break
        if (/^PTOS$|^1 SET$|^2 SET$|^3 SET$|^EQUIPOS/i.test(asStr)) continue
        labels.push(normalizeTeamName(asStr))
      }

      if (labels.length < 2) continue

      const matches: ParsedMatch[] = []
      for (let i = 0; i + 1 < labels.length; i += 2) {
        const t1 = labels[i]
        const t2 = labels[i + 1]
        const bye = /^DESCANSA|^DESCANSO/i.test(t1) || /^DESCANSA|^DESCANSO/i.test(t2)
        if (!bye) {
          teamsSet.add(t1); teamsSet.add(t2)
        } else {
          if (!/^DESCANSA|^DESCANSO/i.test(t1)) teamsSet.add(t1)
          if (!/^DESCANSA|^DESCANSO/i.test(t2)) teamsSet.add(t2)
        }
        matches.push({ team1: t1, team2: t2, bye })
      }

      if (!rounds.find(rd => rd.round_number === roundNumber)) {
        rounds.push({ round_number: roundNumber, matches })
      }
    }
  }

  if (teamsSet.size === 0 || rounds.length === 0) return null

  return {
    sheet_name: sheetName,
    name: meta.name,
    gender: meta.gender,
    level: meta.level,
    sort_order: meta.sort,
    teams: Array.from(teamsSet).sort(),
    rounds: rounds.sort((a, b) => a.round_number - b.round_number),
  }
}

export async function POST(request: Request) {
  // Auth: sólo admin/owner
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const { data: member } = await supabase
    .from('nm_club_members')
    .select('role')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .single()
  if (!member || !['owner', 'admin'].includes(member.role)) {
    return NextResponse.json({ error: 'Sin permisos de administrador' }, { status: 403 })
  }

  const form = await request.formData()
  const file = form.get('file') as File | null
  const leagueName = (form.get('league_name') as string | null)?.trim() || 'Liga importada'
  const startDate = (form.get('start_date') as string | null) || new Date().toISOString().slice(0, 10)
  const dryRun = (form.get('dry_run') as string | null) === 'true'
  const existingLeagueIdRaw = form.get('league_id') as string | null
  const existingLeagueId = existingLeagueIdRaw ? Number(existingLeagueIdRaw) : null

  if (!file) return NextResponse.json({ error: 'Falta archivo xlsx' }, { status: 400 })

  const buf = Buffer.from(await file.arrayBuffer())
  let wb: XLSX.WorkBook
  try {
    wb = XLSX.read(buf, { type: 'buffer' })
  } catch (e) {
    return NextResponse.json({ error: 'Archivo xlsx inválido: ' + (e as Error).message }, { status: 400 })
  }

  // Parseo
  const categories: ParsedCategory[] = []
  for (const sn of wb.SheetNames) {
    const key = normalizeSheetKey(sn)
    // Saltar la hoja EQUIPOS (roster global, no categoría)
    if (/^EQUIPOS/i.test(key)) continue
    const parsed = parseCategorySheet(wb.Sheets[sn], sn)
    if (parsed) categories.push(parsed)
  }

  categories.sort((a, b) => a.sort_order - b.sort_order)

  const preview = {
    league: { name: leagueName, start_date: startDate },
    categories: categories.map(c => ({
      sheet: c.sheet_name,
      name: c.name,
      gender: c.gender,
      teams_count: c.teams.length,
      rounds_count: c.rounds.length,
      matches_count: c.rounds.reduce((acc, r) => acc + r.matches.filter(m => !m.bye).length, 0),
      teams: c.teams,
    })),
  }

  if (dryRun) {
    return NextResponse.json({ success: true, dry_run: true, preview })
  }

  // ── Inserción / actualización ────────────────────────────────────────────
  const admin = createServiceRoleClient()
  let leagueId: number
  const stats = { league_id: 0, categories: 0, teams: 0, rounds: 0, matches: 0, byes: 0, updated: false }

  if (existingLeagueId) {
    // Re-import sobre liga existente: actualizamos metadatos, upsert en todo lo demás
    const { data: lg, error: lgErr } = await admin
      .from('nm_leagues')
      .update({
        name: leagueName,
        start_date: startDate,
        description: `Actualizada desde Excel (${file.name}).`,
      })
      .eq('id', existingLeagueId)
      .select('id')
      .single()
    if (lgErr || !lg) {
      return NextResponse.json({ error: 'Liga no encontrada: ' + (lgErr?.message ?? '?') }, { status: 404 })
    }
    leagueId = lg.id
    stats.updated = true
  } else {
    // Nueva liga
    const { data: league, error: leagueErr } = await admin
      .from('nm_leagues')
      .insert({
        club_id: CLUB_ID,
        sport_id: SPORT_ID,
        name: leagueName,
        format: 'round_robin',
        season: String(new Date(startDate).getFullYear()),
        start_date: startDate,
        status: 'active',
        has_playoffs: false,
        sets_to_win: 2,
        games_per_set: 6,
        golden_point: true,
        description: `Importada desde Excel (${file.name}) — duración promedio 1h30, zona Europe/Madrid.`,
      })
      .select('id')
      .single()
    if (leagueErr || !league) {
      return NextResponse.json({ error: 'No se pudo crear la liga: ' + (leagueErr?.message ?? 'unknown') }, { status: 500 })
    }
    leagueId = league.id
  }
  stats.league_id = leagueId

  // Pre-cargar categorías existentes si es update
  const existingCats = existingLeagueId
    ? (await admin.from('nm_league_categories').select('id,name,sort_order').eq('league_id', leagueId)).data ?? []
    : []
  const catByName = new Map<string, number>((existingCats as { id: number; name: string }[]).map(c => [c.name, c.id]))

  for (const cat of categories) {
    let catId: number
    const existing = catByName.get(cat.name)
    if (existing) {
      catId = existing
      await admin.from('nm_league_categories').update({
        gender: cat.gender,
        level: cat.level || null,
        sort_order: cat.sort_order,
      }).eq('id', catId)
    } else {
      const { data: catRow, error: catErr } = await admin
        .from('nm_league_categories')
        .insert({
          league_id: leagueId,
          name: cat.name,
          gender: cat.gender,
          level: cat.level || null,
          max_teams: Math.max(cat.teams.length, 8),
          num_groups: 1,
          status: 'active',
          sort_order: cat.sort_order,
        })
        .select('id')
        .single()
      if (catErr || !catRow) {
        return NextResponse.json({ error: `Error creando categoría ${cat.name}: ${catErr?.message}`, stats }, { status: 500 })
      }
      catId = catRow.id
    }
    stats.categories++

    // Teams: upsert por nombre dentro de la categoría
    const existingTeams = (await admin.from('nm_league_teams').select('id,team_name').eq('category_id', catId)).data ?? []
    const teamIdByName = new Map<string, number>((existingTeams as { id: number; team_name: string | null }[]).map(t => [t.team_name ?? '', t.id]))

    for (const teamName of cat.teams) {
      if (teamIdByName.has(teamName)) continue
      const players = splitPlayers(teamName)
      const { data: teamRow, error: teamErr } = await admin
        .from('nm_league_teams')
        .insert({
          category_id: catId,
          team_name: teamName,
          player1_name: players.p1,
          player2_name: players.p2,
          player3_name: players.p3 ?? null,
          is_active: true,
        })
        .select('id')
        .single()
      if (teamErr || !teamRow) {
        return NextResponse.json({ error: `Error creando equipo ${teamName}: ${teamErr?.message}`, stats }, { status: 500 })
      }
      teamIdByName.set(teamName, teamRow.id)
      stats.teams++
    }

    // Rounds + Matches: upsert por round_number
    const existingRounds = (await admin.from('nm_league_rounds').select('id,round_number').eq('category_id', catId)).data ?? []
    const roundIdByNumber = new Map<number, number>((existingRounds as { id: number; round_number: number }[]).map(r => [r.round_number, r.id]))

    for (const rd of cat.rounds) {
      let roundId: number
      if (roundIdByNumber.has(rd.round_number)) {
        roundId = roundIdByNumber.get(rd.round_number)!
      } else {
        const { data: roundRow, error: roundErr } = await admin
          .from('nm_league_rounds')
          .insert({
            category_id: catId,
            round_number: rd.round_number,
            status: 'pending',
            is_playoff: false,
          })
          .select('id')
          .single()
        if (roundErr || !roundRow) {
          return NextResponse.json({ error: `Error creando jornada ${rd.round_number} de ${cat.name}: ${roundErr?.message}`, stats }, { status: 500 })
        }
        roundId = roundRow.id
      }
      stats.rounds++

      // Partidos existentes en esa jornada (para evitar duplicados)
      const existingMatches = (await admin.from('nm_league_matches').select('team1_id,team2_id').eq('round_id', roundId)).data ?? []
      const existingPairs = new Set((existingMatches as { team1_id: number | null; team2_id: number | null }[]).map(m => `${m.team1_id}-${m.team2_id}`))

      for (const m of rd.matches) {
        if (m.bye) { stats.byes++; continue }
        const t1 = teamIdByName.get(m.team1)
        const t2 = teamIdByName.get(m.team2)
        if (!t1 || !t2) continue
        // Evitar duplicar si ya existe el mismo pairing (cualquier orden)
        if (existingPairs.has(`${t1}-${t2}`) || existingPairs.has(`${t2}-${t1}`)) continue
        const { error: matchErr } = await admin
          .from('nm_league_matches')
          .insert({
            round_id: roundId,
            category_id: catId,
            team1_id: t1,
            team2_id: t2,
            status: 'scheduled',
          })
        if (matchErr) {
          return NextResponse.json({ error: `Error creando partido ${m.team1} vs ${m.team2}: ${matchErr.message}`, stats }, { status: 500 })
        }
        existingPairs.add(`${t1}-${t2}`)
        stats.matches++
      }
    }
  }

  return NextResponse.json({ success: true, dry_run: false, stats, preview })
}
