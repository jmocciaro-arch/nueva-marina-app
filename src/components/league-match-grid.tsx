'use client'

import { useState, useMemo } from 'react'
import { Grid3X3, Columns, BarChart3 } from 'lucide-react'
import { Card } from '@/components/ui/card'

// ─── Types ────────────────────────────────────────────────────────────────────

export type LeagueMatchGridViewMode = 'matrix' | 'rounds' | 'timeline'

interface TeamData {
  id: number
  team_name: string | null
  category_id: number
}

interface RoundData {
  id: number
  round_number: number
  scheduled_date: string | null
  status: string
}

interface MatchData {
  id: number
  round_id: number
  team1_id: number | null
  team2_id: number | null
  team1_set1: number | null
  team2_set1: number | null
  team1_set2: number | null
  team2_set2: number | null
  team1_set3: number | null
  team2_set3: number | null
  sets_team1: number
  sets_team2: number
  winner_team_id: number | null
  status: string
}

export interface LeagueMatchGridProps {
  teams: TeamData[]
  rounds: RoundData[]
  matches: MatchData[]
  onMatchClick?: (matchId: number) => void
  viewMode?: LeagueMatchGridViewMode
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function setsLabel(m: MatchData): string {
  return `${m.sets_team1}-${m.sets_team2}`
}

function shortName(name: string | null, maxLen = 14): string {
  if (!name) return '?'
  return name.length > maxLen ? name.slice(0, maxLen - 1) + '…' : name
}

// ─── View Mode Toggle ─────────────────────────────────────────────────────────

function ViewToggle({
  mode,
  onChange,
}: {
  mode: LeagueMatchGridViewMode
  onChange: (m: LeagueMatchGridViewMode) => void
}) {
  const modes: { key: LeagueMatchGridViewMode; label: string; Icon: typeof Grid3X3 }[] = [
    { key: 'matrix', label: 'Cuadro cruzado', Icon: Grid3X3 },
    { key: 'rounds', label: 'Por jornada', Icon: Columns },
    { key: 'timeline', label: 'Resultados', Icon: BarChart3 },
  ]
  return (
    <div className="flex gap-1">
      {modes.map(({ key, label, Icon }) => (
        <button
          key={key}
          title={label}
          onClick={() => onChange(key)}
          className={`p-2 rounded-lg text-xs flex items-center gap-1.5 transition-colors ${
            mode === key
              ? 'bg-cyan-600/30 text-cyan-400 border border-cyan-500/40'
              : 'bg-slate-800 text-slate-400 border border-slate-700/50 hover:text-slate-200'
          }`}
        >
          <Icon size={14} />
          <span className="hidden sm:inline">{label}</span>
        </button>
      ))}
    </div>
  )
}

// ─── Matrix View (Cuadro cruzado) ─────────────────────────────────────────────

function MatrixView({
  teams,
  matches,
  onMatchClick,
}: {
  teams: TeamData[]
  matches: MatchData[]
  onMatchClick?: (matchId: number) => void
}) {
  // Build lookup: key = `${team1_id}-${team2_id}` => match
  const matchMap = useMemo(() => {
    const map = new Map<string, MatchData>()
    for (const m of matches) {
      if (m.team1_id != null && m.team2_id != null) {
        map.set(`${m.team1_id}-${m.team2_id}`, m)
      }
    }
    return map
  }, [matches])

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-xs">
        <thead>
          <tr>
            <th className="sticky left-0 z-10 bg-slate-900 px-3 py-2 text-left text-slate-500 font-medium border-b border-slate-700/50">
              Equipo
            </th>
            {teams.map(t => (
              <th
                key={t.id}
                className="px-2 py-2 text-center text-slate-400 font-medium border-b border-slate-700/50 whitespace-nowrap"
              >
                {shortName(t.team_name, 10)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {teams.map(row => (
            <tr key={row.id}>
              <td className="sticky left-0 z-10 bg-slate-900 px-3 py-2 text-slate-300 font-medium border-b border-slate-700/30 whitespace-nowrap">
                {shortName(row.team_name)}
              </td>
              {teams.map(col => {
                if (row.id === col.id) {
                  return (
                    <td
                      key={col.id}
                      className="px-2 py-2 text-center border-b border-slate-700/30 bg-slate-800/80"
                    >
                      <span className="text-slate-600">—</span>
                    </td>
                  )
                }
                // row is team1, col is team2
                const m = matchMap.get(`${row.id}-${col.id}`)
                if (!m) {
                  // Check reverse
                  const mRev = matchMap.get(`${col.id}-${row.id}`)
                  if (!mRev || mRev.status !== 'completed') {
                    return (
                      <td
                        key={col.id}
                        className="px-2 py-2 text-center border-b border-slate-700/30 cursor-default"
                        onClick={() => mRev && onMatchClick?.(mRev.id)}
                      >
                        <span className="text-slate-600">—</span>
                      </td>
                    )
                  }
                  // mRev completed, show from row's perspective (row was team2)
                  const rowWon = mRev.winner_team_id === row.id
                  return (
                    <td
                      key={col.id}
                      className={`px-2 py-2 text-center border-b border-slate-700/30 ${
                        onMatchClick ? 'cursor-pointer hover:bg-slate-700/50' : ''
                      }`}
                      onClick={() => onMatchClick?.(mRev.id)}
                    >
                      <span
                        className={`font-semibold ${rowWon ? 'text-emerald-400' : 'text-red-400'}`}
                      >
                        {mRev.sets_team2}-{mRev.sets_team1}
                      </span>
                    </td>
                  )
                }
                if (m.status !== 'completed') {
                  return (
                    <td
                      key={col.id}
                      className={`px-2 py-2 text-center border-b border-slate-700/30 ${
                        onMatchClick ? 'cursor-pointer hover:bg-slate-700/50' : ''
                      }`}
                      onClick={() => onMatchClick?.(m.id)}
                    >
                      <span className="text-slate-600">—</span>
                    </td>
                  )
                }
                const rowWon = m.winner_team_id === row.id
                return (
                  <td
                    key={col.id}
                    className={`px-2 py-2 text-center border-b border-slate-700/30 ${
                      onMatchClick ? 'cursor-pointer hover:bg-slate-700/50' : ''
                    }`}
                    onClick={() => onMatchClick?.(m.id)}
                  >
                    <span
                      className={`font-semibold ${rowWon ? 'text-emerald-400' : 'text-red-400'}`}
                    >
                      {setsLabel(m)}
                    </span>
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ─── Rounds View (Por jornada) ────────────────────────────────────────────────

function RoundsView({
  teams,
  rounds,
  matches,
  onMatchClick,
}: {
  teams: TeamData[]
  rounds: RoundData[]
  matches: MatchData[]
  onMatchClick?: (matchId: number) => void
}) {
  const teamMap = useMemo(() => new Map(teams.map(t => [t.id, t])), [teams])

  return (
    <div className="overflow-x-auto">
      <div className="flex gap-4 min-w-max pb-2">
        {rounds.map(r => {
          const roundMatches = matches.filter(m => m.round_id === r.id)
          return (
            <div key={r.id} className="flex-shrink-0 w-56">
              {/* Round header */}
              <div className="text-center mb-3">
                <div className="text-xs font-bold text-cyan-400">J{r.round_number}</div>
                {r.scheduled_date && (
                  <div className="text-[10px] text-slate-500">
                    {new Date(r.scheduled_date).toLocaleDateString('es-ES', {
                      day: '2-digit',
                      month: 'short',
                    })}
                  </div>
                )}
              </div>
              {/* Match cards */}
              <div className="space-y-2">
                {roundMatches.map(m => {
                  const t1 = teamMap.get(m.team1_id ?? -1)
                  const t2 = teamMap.get(m.team2_id ?? -1)
                  const completed = m.status === 'completed'
                  return (
                    <div
                      key={m.id}
                      onClick={() => onMatchClick?.(m.id)}
                      className={`rounded-lg border bg-slate-800/60 p-2.5 ${
                        completed ? 'border-slate-700/50' : 'border-slate-700/30 border-dashed'
                      } ${onMatchClick ? 'cursor-pointer hover:border-cyan-500/40 transition-colors' : ''}`}
                    >
                      {/* Team 1 */}
                      <div className="flex items-center justify-between gap-1">
                        <span
                          className={`text-xs truncate flex-1 ${
                            completed && m.winner_team_id === m.team1_id
                              ? 'text-emerald-400 font-semibold'
                              : completed
                                ? 'text-slate-400'
                                : 'text-slate-300'
                          }`}
                        >
                          {shortName(t1?.team_name ?? null, 18)}
                        </span>
                        {completed && (
                          <span className="text-[11px] font-mono text-slate-300">
                            {m.sets_team1}
                          </span>
                        )}
                      </div>
                      {/* Divider */}
                      <div className="border-t border-slate-700/40 my-1" />
                      {/* Team 2 */}
                      <div className="flex items-center justify-between gap-1">
                        <span
                          className={`text-xs truncate flex-1 ${
                            completed && m.winner_team_id === m.team2_id
                              ? 'text-emerald-400 font-semibold'
                              : completed
                                ? 'text-slate-400'
                                : 'text-slate-300'
                          }`}
                        >
                          {shortName(t2?.team_name ?? null, 18)}
                        </span>
                        {completed && (
                          <span className="text-[11px] font-mono text-slate-300">
                            {m.sets_team2}
                          </span>
                        )}
                      </div>
                      {/* Status pill */}
                      {!completed && (
                        <div className="mt-1.5 text-center">
                          <span className="text-[10px] text-slate-500 bg-slate-700/40 px-2 py-0.5 rounded-full">
                            Pendiente
                          </span>
                        </div>
                      )}
                    </div>
                  )
                })}
                {roundMatches.length === 0 && (
                  <div className="text-center text-[10px] text-slate-600 py-4">
                    Sin partidos
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Timeline View (Matriz de resultados) ─────────────────────────────────────

function TimelineView({
  teams,
  rounds,
  matches,
  onMatchClick,
}: {
  teams: TeamData[]
  rounds: RoundData[]
  matches: MatchData[]
  onMatchClick?: (matchId: number) => void
}) {
  const [tooltip, setTooltip] = useState<{
    matchId: number
    t1Name: string
    t2Name: string
    score: string
    x: number
    y: number
  } | null>(null)

  const teamMap = useMemo(() => new Map(teams.map(t => [t.id, t])), [teams])

  // Build lookup: roundId + teamId => match + result
  const cellData = useMemo(() => {
    const map = new Map<string, { match: MatchData; result: 'win' | 'loss' | 'pending' }>()
    for (const m of matches) {
      if (m.team1_id != null) {
        const roundId = m.round_id
        const result: 'win' | 'loss' | 'pending' =
          m.status !== 'completed' ? 'pending' : m.winner_team_id === m.team1_id ? 'win' : 'loss'
        map.set(`${roundId}-${m.team1_id}`, { match: m, result })
      }
      if (m.team2_id != null) {
        const roundId = m.round_id
        const result: 'win' | 'loss' | 'pending' =
          m.status !== 'completed' ? 'pending' : m.winner_team_id === m.team2_id ? 'win' : 'loss'
        map.set(`${roundId}-${m.team2_id}`, { match: m, result })
      }
    }
    return map
  }, [matches])

  // Compute streaks
  const streaks = useMemo(() => {
    const result = new Map<number, string>()
    for (const team of teams) {
      const last5: string[] = []
      for (const r of rounds) {
        const cell = cellData.get(`${r.id}-${team.id}`)
        if (cell && cell.result !== 'pending') {
          last5.push(cell.result === 'win' ? 'V' : 'D')
        }
      }
      result.set(team.id, last5.slice(-5).join(''))
    }
    return result
  }, [teams, rounds, cellData])

  function handleCellHover(
    e: React.MouseEvent,
    m: MatchData,
  ) {
    const t1 = teamMap.get(m.team1_id ?? -1)
    const t2 = teamMap.get(m.team2_id ?? -1)
    const rect = (e.target as HTMLElement).getBoundingClientRect()
    setTooltip({
      matchId: m.id,
      t1Name: t1?.team_name ?? '?',
      t2Name: t2?.team_name ?? '?',
      score: m.status === 'completed' ? setsLabel(m) : 'Pendiente',
      x: rect.left + rect.width / 2,
      y: rect.top - 8,
    })
  }

  return (
    <div className="relative overflow-x-auto">
      <table className="min-w-full text-xs">
        <thead>
          <tr>
            <th className="sticky left-0 z-10 bg-slate-900 px-3 py-2 text-left text-slate-500 font-medium border-b border-slate-700/50">
              Equipo
            </th>
            {rounds.map(r => (
              <th
                key={r.id}
                className="px-2 py-2 text-center text-slate-400 font-medium border-b border-slate-700/50"
              >
                J{r.round_number}
              </th>
            ))}
            <th className="px-3 py-2 text-center text-slate-500 font-medium border-b border-slate-700/50">
              Racha
            </th>
          </tr>
        </thead>
        <tbody>
          {teams.map(team => (
            <tr key={team.id}>
              <td className="sticky left-0 z-10 bg-slate-900 px-3 py-2 text-slate-300 font-medium border-b border-slate-700/30 whitespace-nowrap">
                {shortName(team.team_name)}
              </td>
              {rounds.map(r => {
                const cell = cellData.get(`${r.id}-${team.id}`)
                if (!cell) {
                  return (
                    <td
                      key={r.id}
                      className="px-2 py-2 text-center border-b border-slate-700/30"
                    >
                      <span className="text-slate-700">·</span>
                    </td>
                  )
                }
                const { match, result } = cell
                return (
                  <td
                    key={r.id}
                    className={`px-2 py-2 text-center border-b border-slate-700/30 ${
                      onMatchClick ? 'cursor-pointer' : ''
                    }`}
                    onClick={() => onMatchClick?.(match.id)}
                    onMouseEnter={e => handleCellHover(e, match)}
                    onMouseLeave={() => setTooltip(null)}
                  >
                    {result === 'win' && (
                      <span className="inline-flex items-center justify-center w-6 h-6 rounded bg-emerald-500/20 text-emerald-400 font-bold text-[11px]">
                        V
                      </span>
                    )}
                    {result === 'loss' && (
                      <span className="inline-flex items-center justify-center w-6 h-6 rounded bg-red-500/20 text-red-400 font-bold text-[11px]">
                        D
                      </span>
                    )}
                    {result === 'pending' && (
                      <span className="inline-flex items-center justify-center w-6 h-6 rounded bg-slate-700/40 text-slate-500 text-[11px]">
                        —
                      </span>
                    )}
                  </td>
                )
              })}
              <td className="px-3 py-2 text-center border-b border-slate-700/30 whitespace-nowrap">
                <span className="font-mono text-[10px] tracking-wider">
                  {(streaks.get(team.id) ?? '').split('').map((ch, i) => (
                    <span
                      key={i}
                      className={ch === 'V' ? 'text-emerald-400' : 'text-red-400'}
                    >
                      {ch}
                    </span>
                  ))}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Tooltip */}
      {tooltip && (
        <div
          className="fixed z-50 px-3 py-2 rounded-lg bg-slate-800 border border-slate-600 shadow-xl text-xs pointer-events-none"
          style={{
            left: tooltip.x,
            top: tooltip.y,
            transform: 'translate(-50%, -100%)',
          }}
        >
          <div className="text-slate-200 font-medium">{tooltip.t1Name}</div>
          <div className="text-slate-500 text-[10px]">vs</div>
          <div className="text-slate-200 font-medium">{tooltip.t2Name}</div>
          <div className="mt-1 text-center text-cyan-400 font-bold">{tooltip.score}</div>
        </div>
      )}
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function LeagueMatchGrid({
  teams,
  rounds,
  matches,
  onMatchClick,
  viewMode: initialViewMode = 'matrix',
}: LeagueMatchGridProps) {
  const [viewMode, setViewMode] = useState<LeagueMatchGridViewMode>(initialViewMode)

  if (teams.length === 0 || matches.length === 0) return null

  return (
    <Card className="overflow-hidden">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <h3 className="text-sm font-semibold text-white flex items-center gap-2">
          <Grid3X3 size={14} className="text-cyan-400" />
          Vista de partidos
        </h3>
        <ViewToggle mode={viewMode} onChange={setViewMode} />
      </div>

      {viewMode === 'matrix' && (
        <MatrixView teams={teams} matches={matches} onMatchClick={onMatchClick} />
      )}
      {viewMode === 'rounds' && (
        <RoundsView
          teams={teams}
          rounds={rounds}
          matches={matches}
          onMatchClick={onMatchClick}
        />
      )}
      {viewMode === 'timeline' && (
        <TimelineView
          teams={teams}
          rounds={rounds}
          matches={matches}
          onMatchClick={onMatchClick}
        />
      )}
    </Card>
  )
}
