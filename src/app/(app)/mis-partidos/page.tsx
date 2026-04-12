'use client'

import { useState, useCallback, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/lib/auth-context'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Trophy, Calendar, Users, TrendingUp, Swords } from 'lucide-react'

interface Match {
  id: string
  date: string
  start_time: string
  status: 'scheduled' | 'completed' | 'cancelled'
  match_type: string
  team1_player1: string
  team1_player2: string | null
  team2_player1: string
  team2_player2: string | null
  score_set1_team1: number | null
  score_set1_team2: number | null
  score_set2_team1: number | null
  score_set2_team2: number | null
  score_set3_team1: number | null
  score_set3_team2: number | null
  players?: Record<string, { full_name: string }>
}

function getResult(match: Match, userId: string): 'win' | 'loss' | null {
  if (match.status !== 'completed') return null
  const inTeam1 = match.team1_player1 === userId || match.team1_player2 === userId
  const sets = [
    [match.score_set1_team1, match.score_set1_team2],
    [match.score_set2_team1, match.score_set2_team2],
    [match.score_set3_team1, match.score_set3_team2],
  ].filter(([a, b]) => a !== null && b !== null) as [number, number][]
  let t1 = 0, t2 = 0
  for (const [a, b] of sets) { if (a > b) t1++; else t2++ }
  const winnerTeam1 = t1 > t2
  return inTeam1 ? (winnerTeam1 ? 'win' : 'loss') : (winnerTeam1 ? 'loss' : 'win')
}

function ScoreDisplay({ match }: { match: Match }) {
  const sets = [
    [match.score_set1_team1, match.score_set1_team2],
    [match.score_set2_team1, match.score_set2_team2],
    [match.score_set3_team1, match.score_set3_team2],
  ].filter(([a, b]) => a !== null && b !== null)
  if (sets.length === 0) return <span className="text-slate-500 text-sm">Sin marcador</span>
  return (
    <div className="flex gap-2">
      {sets.map(([a, b], i) => (
        <span key={i} className="text-white text-sm font-mono bg-slate-700/60 px-2 py-0.5 rounded">
          {a}-{b}
        </span>
      ))}
    </div>
  )
}

export default function MisPartidosPage() {
  const { user } = useAuth()
  const [matches, setMatches] = useState<Match[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<'proximos' | 'historial'>('proximos')

  const loadMatches = useCallback(async () => {
    const supabase = createClient()
    if (!user) return
    setLoading(true)

    const { data, error } = await supabase
      .from('nm_matches')
      .select('*')
      .or(
        `team1_player1.eq.${user.id},team1_player2.eq.${user.id},team2_player1.eq.${user.id},team2_player2.eq.${user.id}`
      )
      .order('date', { ascending: false })
      .order('start_time', { ascending: false })

    if (error || !data) { setLoading(false); return }

    const playerIds = Array.from(new Set(
      data.flatMap(m => [m.team1_player1, m.team1_player2, m.team2_player1, m.team2_player2].filter(Boolean))
    ))

    const { data: players } = await supabase
      .from('nm_users')
      .select('id, full_name')
      .in('id', playerIds)

    const playerMap: Record<string, { full_name: string }> = {}
    for (const p of players || []) playerMap[p.id] = { full_name: p.full_name }

    setMatches(data.map(m => ({ ...m, players: playerMap })))
    setLoading(false)
  }, [user])

  useEffect(() => { loadMatches() }, [loadMatches])

  const scheduled = matches.filter(m => m.status === 'scheduled')
  const completed = matches.filter(m => m.status === 'completed')
  const wins = completed.filter(m => getResult(m, user?.id || '') === 'win').length
  const losses = completed.filter(m => getResult(m, user?.id || '') === 'loss').length
  const winRate = completed.length > 0 ? Math.round((wins / completed.length) * 100) : 0
  const displayed = tab === 'proximos' ? scheduled : completed

  function playerName(id: string | null, players?: Record<string, { full_name: string }>) {
    if (!id) return ''
    return players?.[id]?.full_name || 'Jugador'
  }

  function getOpponents(match: Match, userId: string) {
    const inTeam1 = match.team1_player1 === userId || match.team1_player2 === userId
    if (inTeam1) return [match.team2_player1, match.team2_player2].filter(Boolean) as string[]
    return [match.team1_player1, match.team1_player2].filter(Boolean) as string[]
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Mis Partidos</h1>
        <p className="text-sm text-slate-400 mt-1">Historial y proximos partidos programados</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="text-center py-4">
          <p className="text-2xl font-bold text-white">{matches.length}</p>
          <p className="text-xs text-slate-400 mt-1">Total partidos</p>
        </Card>
        <Card className="text-center py-4">
          <p className="text-2xl font-bold text-green-400">{wins}</p>
          <p className="text-xs text-slate-400 mt-1">Victorias</p>
        </Card>
        <Card className="text-center py-4">
          <p className="text-2xl font-bold text-red-400">{losses}</p>
          <p className="text-xs text-slate-400 mt-1">Derrotas</p>
        </Card>
        <Card className="text-center py-4">
          <p className="text-2xl font-bold text-cyan-400">{winRate}%</p>
          <p className="text-xs text-slate-400 mt-1">% victorias</p>
        </Card>
      </div>

      {/* Tabs */}
      <div className="flex bg-slate-800 rounded-lg p-0.5 w-fit">
        <button
          onClick={() => setTab('proximos')}
          className={`px-4 py-1.5 rounded-md text-xs font-medium transition-colors ${tab === 'proximos' ? 'bg-cyan-600 text-white' : 'text-slate-400 hover:text-white'}`}
        >
          <Calendar size={13} className="inline mr-1" />
          Proximos ({scheduled.length})
        </button>
        <button
          onClick={() => setTab('historial')}
          className={`px-4 py-1.5 rounded-md text-xs font-medium transition-colors ${tab === 'historial' ? 'bg-cyan-600 text-white' : 'text-slate-400 hover:text-white'}`}
        >
          <Trophy size={13} className="inline mr-1" />
          Historial ({completed.length})
        </button>
      </div>

      {/* Lista */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-24 rounded-xl bg-slate-800/50 border border-slate-700/50 animate-pulse" />
          ))}
        </div>
      ) : displayed.length === 0 ? (
        <Card>
          <div className="text-center py-12">
            <Swords size={40} className="mx-auto text-slate-600 mb-3" />
            <p className="text-slate-400">
              {tab === 'proximos' ? 'No tenes partidos programados' : 'No tenes partidos en el historial'}
            </p>
          </div>
        </Card>
      ) : (
        <div className="space-y-3">
          {displayed.map(match => {
            const result = getResult(match, user?.id || '')
            const opponents = getOpponents(match, user?.id || '')
            const inTeam1 = match.team1_player1 === user?.id || match.team1_player2 === user?.id
            const myTeamPlayers = inTeam1
              ? [match.team1_player1, match.team1_player2].filter(Boolean) as string[]
              : [match.team2_player1, match.team2_player2].filter(Boolean) as string[]

            return (
              <Card key={match.id} hover>
                <div className="flex items-center justify-between gap-4">
                  <div className="flex-shrink-0 w-12 text-center">
                    {result === 'win' && (
                      <div className="w-10 h-10 rounded-full bg-green-500/20 flex items-center justify-center mx-auto">
                        <Trophy size={18} className="text-green-400" />
                      </div>
                    )}
                    {result === 'loss' && (
                      <div className="w-10 h-10 rounded-full bg-red-500/20 flex items-center justify-center mx-auto">
                        <TrendingUp size={18} className="text-red-400 rotate-180" />
                      </div>
                    )}
                    {!result && (
                      <div className="w-10 h-10 rounded-full bg-cyan-500/20 flex items-center justify-center mx-auto">
                        <Calendar size={18} className="text-cyan-400" />
                      </div>
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-white text-sm font-medium truncate">
                        vs {opponents.map(id => playerName(id, match.players)).join(' / ')}
                      </span>
                      <Badge variant={match.match_type === 'tournament' ? 'warning' : match.match_type === 'league' ? 'info' : 'default'}>
                        {match.match_type || 'amistoso'}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-slate-400">
                      <span className="flex items-center gap-1">
                        <Calendar size={11} />
                        {new Date(match.date).toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: 'numeric' })}
                        {match.start_time && ` · ${match.start_time.slice(0, 5)}`}
                      </span>
                      <span className="flex items-center gap-1">
                        <Users size={11} />
                        {myTeamPlayers.map(id => playerName(id, match.players)).join(' / ')}
                      </span>
                    </div>
                  </div>

                  <div className="flex-shrink-0 flex flex-col items-end gap-1.5">
                    {match.status === 'completed' ? (
                      <>
                        <ScoreDisplay match={match} />
                        {result && (
                          <Badge variant={result === 'win' ? 'success' : 'danger'}>
                            {result === 'win' ? 'Victoria' : 'Derrota'}
                          </Badge>
                        )}
                      </>
                    ) : (
                      <Badge variant="cyan">Programado</Badge>
                    )}
                  </div>
                </div>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
