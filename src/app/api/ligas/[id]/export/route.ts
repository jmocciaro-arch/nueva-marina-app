import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import * as XLSX from 'xlsx'

/**
 * Exporta una liga a xlsx con el mismo formato del Excel de Christian:
 *   - Una hoja por categoría con bloques "JORNADA N"
 *   - Resultados completados aparecen en las columnas 1 SET / 2 SET / 3 SET / PTOS
 *
 * GET /api/ligas/[id]/export
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const { id } = await params
  const leagueId = Number(id)

  const [lRes, cRes, tRes, rRes, mRes] = await Promise.all([
    supabase.from('nm_leagues').select('*').eq('id', leagueId).single(),
    supabase.from('nm_league_categories').select('*').eq('league_id', leagueId).order('sort_order'),
    supabase.from('nm_league_teams').select('*'),
    supabase.from('nm_league_rounds').select('*').order('round_number'),
    supabase.from('nm_league_matches').select('*'),
  ])
  if (lRes.error || !lRes.data) return NextResponse.json({ error: 'Liga no encontrada' }, { status: 404 })

  const league = lRes.data
  const categories = (cRes.data ?? []) as { id: number; name: string; sort_order: number; level: string | null; gender: string }[]
  const catIds = new Set(categories.map(c => c.id))
  const teams = (tRes.data ?? []).filter((t: { category_id: number }) => catIds.has(t.category_id)) as {
    id: number; category_id: number; team_name: string | null
    player1_name: string; player2_name: string; player3_name: string | null
  }[]
  const rounds = (rRes.data ?? []).filter((r: { category_id: number }) => catIds.has(r.category_id)) as {
    id: number; category_id: number; round_number: number; scheduled_date: string | null
  }[]
  const matches = (mRes.data ?? []).filter((m: { category_id: number }) => catIds.has(m.category_id)) as {
    id: number; round_id: number; category_id: number
    team1_id: number | null; team2_id: number | null
    team1_set1: number | null; team2_set1: number | null
    team1_set2: number | null; team2_set2: number | null
    team1_set3: number | null; team2_set3: number | null
    sets_team1: number; sets_team2: number; winner_team_id: number | null; status: string
  }[]

  const teamById = new Map(teams.map(t => [t.id, t]))
  const wb = XLSX.utils.book_new()

  // Hoja EQUIPOS (resumen)
  const equiposRows: (string | number)[][] = [
    ['', `LIGA: ${league.name}`],
    ['', `Estado: ${league.status} · Inicio: ${league.start_date ?? ''}`],
    [],
    ['', 'CATEGORIA', 'EQUIPO', 'JUGADOR 1', 'JUGADOR 2', 'JUGADOR 3'],
  ]
  for (const cat of categories) {
    const cts = teams.filter(t => t.category_id === cat.id)
    for (const t of cts) {
      equiposRows.push(['', cat.name, t.team_name ?? '', t.player1_name, t.player2_name, t.player3_name ?? ''])
    }
  }
  const wsEq = XLSX.utils.aoa_to_sheet(equiposRows)
  wsEq['!cols'] = [{ wch: 2 }, { wch: 22 }, { wch: 26 }, { wch: 20 }, { wch: 20 }, { wch: 20 }]
  XLSX.utils.book_append_sheet(wb, wsEq, 'EQUIPOS')

  // Hoja por categoría con layout 2-jornadas-lado-a-lado
  for (const cat of categories) {
    const sheetName = truncateSheetName(cat.name)
    const catRounds = rounds.filter(r => r.category_id === cat.id).sort((a, b) => a.round_number - b.round_number)

    const aoa: (string | number | null)[][] = []
    aoa.push([null, cat.name, null, null, null, null, null, cat.name])
    // Recorre de a dos jornadas
    for (let i = 0; i < catRounds.length; i += 2) {
      const left = catRounds[i]
      const right = catRounds[i + 1]
      // Header row
      const leftHdr = [null, `JORNADA ${left.round_number}`, '1 SET', '2 SET', '3 SET', 'PTOS']
      const rightHdr = right ? [null, `JORNADA ${right.round_number}`, '1 SET', '2 SET', '3 SET', 'PTOS'] : [null, null, null, null, null, null]
      aoa.push([...leftHdr, ...rightHdr])

      const leftMatches = matches.filter(m => m.round_id === left.id)
      const rightMatches = right ? matches.filter(m => m.round_id === right.id) : []
      // Construir labels y scores por jornada
      const leftBlock = buildRoundBlock(leftMatches, teamById)
      const rightBlock = right ? buildRoundBlock(rightMatches, teamById) : []
      const maxLines = Math.max(leftBlock.length, rightBlock.length)
      for (let k = 0; k < maxLines; k++) {
        const L = leftBlock[k] ?? [null, null, null, null, null]
        const R = rightBlock[k] ?? [null, null, null, null, null]
        aoa.push([null, ...L, null, ...R])
      }
      aoa.push([]) // separador
    }
    const ws = XLSX.utils.aoa_to_sheet(aoa)
    ws['!cols'] = [{ wch: 2 }, { wch: 26 }, { wch: 8 }, { wch: 8 }, { wch: 8 }, { wch: 6 }, { wch: 2 }, { wch: 26 }, { wch: 8 }, { wch: 8 }, { wch: 8 }, { wch: 6 }]
    XLSX.utils.book_append_sheet(wb, ws, sheetName)
  }

  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer
  const safeName = league.name.replace(/[^\w\s-]/g, '').replace(/\s+/g, '_')
  return new NextResponse(new Uint8Array(buf), {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${safeName}.xlsx"`,
      'Cache-Control': 'no-store',
    },
  })
}

/** Retorna filas de [team_name, 1set, 2set, 3set, pts] para una jornada.
 *  Cada partido genera 2 filas (equipo 1 y equipo 2). */
function buildRoundBlock(
  roundMatches: {
    team1_id: number | null; team2_id: number | null
    team1_set1: number | null; team2_set1: number | null
    team1_set2: number | null; team2_set2: number | null
    team1_set3: number | null; team2_set3: number | null
    sets_team1: number; sets_team2: number; winner_team_id: number | null; status: string
  }[],
  teamById: Map<number, { team_name: string | null }>,
): (string | number | null)[][] {
  const out: (string | number | null)[][] = []
  for (const m of roundMatches) {
    const t1 = m.team1_id != null ? teamById.get(m.team1_id)?.team_name ?? '' : ''
    const t2 = m.team2_id != null ? teamById.get(m.team2_id)?.team_name ?? '' : ''
    const pts1 = m.status === 'completed' ? (m.winner_team_id === m.team1_id ? (m.sets_team2 === 0 ? 3 : 2) : (m.sets_team1 === 1 ? 1 : 0)) : null
    const pts2 = m.status === 'completed' ? (m.winner_team_id === m.team2_id ? (m.sets_team1 === 0 ? 3 : 2) : (m.sets_team2 === 1 ? 1 : 0)) : null
    out.push([
      t1,
      fmtSet(m.team1_set1, m.team2_set1),
      fmtSet(m.team1_set2, m.team2_set2),
      fmtSet(m.team1_set3, m.team2_set3),
      pts1,
    ])
    out.push([
      t2,
      fmtSet(m.team2_set1, m.team1_set1),
      fmtSet(m.team2_set2, m.team1_set2),
      fmtSet(m.team2_set3, m.team1_set3),
      pts2,
    ])
  }
  return out
}

function fmtSet(a: number | null, b: number | null): string | null {
  if (a == null || b == null) return null
  return `${a}-${b}`
}

function truncateSheetName(name: string): string {
  // Excel limita nombres de hoja a 31 chars y prohíbe ciertos caracteres
  return name.replace(/[\\/:*?"<>|]/g, '').slice(0, 31)
}
