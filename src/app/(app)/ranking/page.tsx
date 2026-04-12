'use client'

import { useAuth } from '@/lib/auth-context'
import { Card } from '@/components/ui/card'
import { createClient } from '@/lib/supabase/client'
import { useCallback, useEffect, useState } from 'react'
import { Trophy, Medal, TrendingUp, Swords } from 'lucide-react'

const CLUB_ID = 1

interface PlayerRanking {
  id: string
  user_id: string
  preferred_position: string | null
  level: number | null
  matches_played: number
  matches_won: number
  win_rate: number
  ranking_points: number
  ranking_position: number | null
  reputation_score: number
  full_name: string | null
  avatar_url: string | null
  email: string | null
}

function getLevelLabel(level: number | null): string {
  if (!level) return '-'
  if (level <= 2) return 'Iniciación'
  if (level <= 4) return 'Básico'
  if (level <= 6) return 'Intermedio'
  if (level <= 8) return 'Avanzado'
  return 'Élite'
}

function getLevelColor(level: number | null): string {
  if (!level) return 'text-slate-400'
  if (level <= 2) return 'text-slate-300'
  if (level <= 4) return 'text-green-400'
  if (level <= 6) return 'text-cyan-400'
  if (level <= 8) return 'text-amber-400'
  return 'text-rose-400'
}

function getInitials(name: string | null): string {
  if (!name) return '?'
  return name
    .split(' ')
    .slice(0, 2)
    .map((n) => n[0])
    .join('')
    .toUpperCase()
}

function Avatar({ player }: { player: PlayerRanking }) {
  if (player.avatar_url) {
    return (
      <img
        src={player.avatar_url}
        alt={player.full_name || 'Jugador'}
        className="w-10 h-10 rounded-full object-cover"
      />
    )
  }
  return (
    <div className="w-10 h-10 rounded-full bg-cyan-500/20 flex items-center justify-center text-cyan-400 font-bold text-sm">
      {getInitials(player.full_name)}
    </div>
  )
}

interface PodiumCardProps {
  player: PlayerRanking
  position: 1 | 2 | 3
  isCurrentUser: boolean
}

function PodiumCard({ player, position, isCurrentUser }: PodiumCardProps) {
  const configs = {
    1: {
      icon: <Trophy size={28} className="text-amber-400" />,
      ring: 'ring-2 ring-amber-400/60',
      label: '1.° Lugar',
      labelColor: 'text-amber-400',
      bgGlow: 'bg-amber-500/10',
      order: 'order-2',
      scale: 'scale-105',
      avatarSize: 'w-16 h-16',
    },
    2: {
      icon: <Medal size={24} className="text-slate-300" />,
      ring: 'ring-2 ring-slate-400/40',
      label: '2.° Lugar',
      labelColor: 'text-slate-300',
      bgGlow: 'bg-slate-500/10',
      order: 'order-1',
      scale: '',
      avatarSize: 'w-14 h-14',
    },
    3: {
      icon: <Medal size={24} className="text-amber-600" />,
      ring: 'ring-2 ring-amber-700/40',
      label: '3.° Lugar',
      labelColor: 'text-amber-600',
      bgGlow: 'bg-amber-900/10',
      order: 'order-3',
      scale: '',
      avatarSize: 'w-14 h-14',
    },
  }

  const c = configs[position]

  return (
    <div
      className={`flex flex-col items-center gap-3 p-5 rounded-2xl border border-slate-700/50 ${c.bgGlow} ${c.order} ${c.scale} transition-transform ${isCurrentUser ? 'ring-2 ring-cyan-500/70' : ''}`}
    >
      <div className="mb-1">{c.icon}</div>
      {player.avatar_url ? (
        <img
          src={player.avatar_url}
          alt={player.full_name || 'Jugador'}
          className={`${c.avatarSize} rounded-full object-cover ${c.ring}`}
        />
      ) : (
        <div
          className={`${c.avatarSize} rounded-full bg-cyan-500/20 flex items-center justify-center text-cyan-400 font-bold text-lg ${c.ring}`}
        >
          {getInitials(player.full_name)}
        </div>
      )}
      <div className="text-center">
        <p className="text-white font-semibold text-sm leading-tight">
          {player.full_name || player.email || 'Jugador'}
          {isCurrentUser && (
            <span className="ml-1 text-cyan-400 text-xs">(vos)</span>
          )}
        </p>
        <p className={`text-xs font-medium mt-0.5 ${c.labelColor}`}>{c.label}</p>
        <p className={`text-xs mt-1 ${getLevelColor(player.level)}`}>
          {getLevelLabel(player.level)}
        </p>
      </div>
      <div className="flex flex-col items-center">
        <p className="text-2xl font-bold text-white">{player.ranking_points.toLocaleString('es-ES')}</p>
        <p className="text-xs text-slate-400">puntos</p>
      </div>
      <div className="grid grid-cols-2 gap-x-4 text-center text-xs text-slate-400 w-full border-t border-slate-700/50 pt-3">
        <div>
          <p className="text-white font-medium">{player.matches_played}</p>
          <p>partidos</p>
        </div>
        <div>
          <p className="text-white font-medium">{player.win_rate}%</p>
          <p>victorias</p>
        </div>
      </div>
    </div>
  )
}

export default function RankingPage() {
  const { user } = useAuth()
  const [players, setPlayers] = useState<PlayerRanking[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadRanking = useCallback(async () => {
    setLoading(true)
    setError(null)
    const supabase = createClient()

    const { data, error: queryError } = await supabase
      .from('nm_player_profiles')
      .select(`
        id,
        user_id,
        preferred_position,
        level,
        matches_played,
        matches_won,
        win_rate,
        ranking_points,
        ranking_position,
        reputation_score,
        nm_users!inner (
          full_name,
          avatar_url,
          email
        )
      `)
      .eq('club_id', CLUB_ID)
      .order('ranking_points', { ascending: false })

    if (queryError) {
      setError('No se pudo cargar el ranking. Intentá de nuevo.')
      setLoading(false)
      return
    }

    const mapped: PlayerRanking[] = (data || []).map((row: any) => ({
      id: row.id,
      user_id: row.user_id,
      preferred_position: row.preferred_position,
      level: row.level,
      matches_played: row.matches_played ?? 0,
      matches_won: row.matches_won ?? 0,
      win_rate: row.win_rate ?? 0,
      ranking_points: row.ranking_points ?? 0,
      ranking_position: row.ranking_position,
      reputation_score: row.reputation_score ?? 0,
      full_name: row.nm_users?.full_name ?? null,
      avatar_url: row.nm_users?.avatar_url ?? null,
      email: row.nm_users?.email ?? null,
    }))

    setPlayers(mapped)
    setLoading(false)
  }, [])

  useEffect(() => {
    loadRanking()
  }, [loadRanking])

  const top3 = players.slice(0, 3)
  const rest = players.slice(3)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <TrendingUp size={24} className="text-cyan-400" />
            Ranking
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Clasificación general de jugadores del club
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs text-slate-400 bg-slate-800/60 border border-slate-700/50 rounded-lg px-3 py-2">
          <Swords size={14} className="text-cyan-400" />
          <span>{players.length} jugadores</span>
        </div>
      </div>

      {/* Estado de carga */}
      {loading && (
        <div className="rounded-xl border border-slate-700/50 bg-slate-800/50 p-12 text-center">
          <div className="w-8 h-8 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-slate-400 text-sm">Cargando ranking...</p>
        </div>
      )}

      {/* Error */}
      {!loading && error && (
        <div className="rounded-xl border border-rose-700/40 bg-rose-900/10 p-6 text-center">
          <p className="text-rose-400 text-sm">{error}</p>
          <button
            onClick={loadRanking}
            className="mt-3 text-xs text-cyan-400 underline hover:text-cyan-300 transition-colors"
          >
            Reintentar
          </button>
        </div>
      )}

      {/* Sin datos */}
      {!loading && !error && players.length === 0 && (
        <div className="rounded-xl border border-slate-700/50 bg-slate-800/50 p-12 text-center">
          <Trophy size={40} className="mx-auto text-slate-600 mb-3" />
          <p className="text-slate-400 text-sm">Todavía no hay jugadores en el ranking.</p>
        </div>
      )}

      {/* Podio top 3 */}
      {!loading && !error && top3.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-2">
            <Trophy size={14} className="text-amber-400" />
            Podio
          </h2>
          <div className="grid grid-cols-3 gap-3 items-end">
            {top3[1] && (
              <PodiumCard
                player={top3[1]}
                position={2}
                isCurrentUser={user?.id === top3[1].user_id}
              />
            )}
            {top3[0] && (
              <PodiumCard
                player={top3[0]}
                position={1}
                isCurrentUser={user?.id === top3[0].user_id}
              />
            )}
            {top3[2] && (
              <PodiumCard
                player={top3[2]}
                position={3}
                isCurrentUser={user?.id === top3[2].user_id}
              />
            )}
          </div>
        </div>
      )}

      {/* Tabla completa */}
      {!loading && !error && players.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-2">
            <Medal size={14} className="text-cyan-400" />
            Clasificación completa
          </h2>
          <div className="rounded-xl border border-slate-700/50 bg-slate-800/50 overflow-hidden">
            {/* Header tabla */}
            <div className="hidden sm:grid grid-cols-[3rem_1fr_7rem_5rem_5rem_6rem_7rem] gap-2 px-4 py-3 border-b border-slate-700/50 text-xs font-semibold text-slate-400 uppercase tracking-wider">
              <span className="text-center">#</span>
              <span>Jugador</span>
              <span className="text-center">Nivel</span>
              <span className="text-center">Partidos</span>
              <span className="text-center">Victorias</span>
              <span className="text-center">Win Rate</span>
              <span className="text-right">Puntos</span>
            </div>

            {/* Filas */}
            {players.map((player, index) => {
              const isCurrentUser = user?.id === player.user_id
              const position = index + 1

              return (
                <div
                  key={player.id}
                  className={`
                    flex sm:grid grid-cols-1 sm:grid-cols-[3rem_1fr_7rem_5rem_5rem_6rem_7rem]
                    gap-2 px-4 py-3 items-center
                    border-b border-slate-700/30 last:border-0
                    transition-colors
                    ${isCurrentUser
                      ? 'bg-cyan-500/10 border-l-2 border-l-cyan-500'
                      : 'hover:bg-slate-700/20'
                    }
                  `}
                >
                  {/* Posición */}
                  <div className="hidden sm:flex items-center justify-center">
                    {position === 1 ? (
                      <Trophy size={16} className="text-amber-400" />
                    ) : position === 2 ? (
                      <Medal size={16} className="text-slate-300" />
                    ) : position === 3 ? (
                      <Medal size={16} className="text-amber-600" />
                    ) : (
                      <span className="text-sm text-slate-400 font-mono w-6 text-center">{position}</span>
                    )}
                  </div>

                  {/* Nombre — en mobile muestra todo en una fila */}
                  <div className="flex items-center gap-3 min-w-0 w-full sm:w-auto">
                    {/* Posición visible en mobile */}
                    <span className="sm:hidden text-xs text-slate-400 font-mono w-6 flex-shrink-0 text-center">
                      {position}
                    </span>
                    <Avatar player={player} />
                    <div className="min-w-0">
                      <p className={`text-sm font-medium truncate ${isCurrentUser ? 'text-cyan-300' : 'text-white'}`}>
                        {player.full_name || player.email || 'Jugador'}
                        {isCurrentUser && (
                          <span className="ml-1 text-xs text-cyan-400">(vos)</span>
                        )}
                      </p>
                      {player.preferred_position && (
                        <p className="text-xs text-slate-500 truncate">{player.preferred_position}</p>
                      )}
                    </div>
                    {/* Stats en mobile */}
                    <div className="ml-auto sm:hidden flex items-center gap-3 flex-shrink-0">
                      <div className="text-right">
                        <p className="text-xs text-cyan-400 font-bold">{player.ranking_points.toLocaleString('es-ES')}</p>
                        <p className="text-xs text-slate-500">pts</p>
                      </div>
                    </div>
                  </div>

                  {/* Nivel */}
                  <div className="hidden sm:flex justify-center">
                    <span className={`text-xs font-medium ${getLevelColor(player.level)}`}>
                      {getLevelLabel(player.level)}
                    </span>
                  </div>

                  {/* Partidos */}
                  <div className="hidden sm:flex justify-center">
                    <span className="text-sm text-slate-300">{player.matches_played}</span>
                  </div>

                  {/* Victorias */}
                  <div className="hidden sm:flex justify-center">
                    <span className="text-sm text-slate-300">{player.matches_won}</span>
                  </div>

                  {/* Win Rate */}
                  <div className="hidden sm:flex flex-col items-center gap-1">
                    <span className="text-sm text-slate-300">{player.win_rate}%</span>
                    <div className="w-16 h-1 rounded-full bg-slate-700 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-green-400"
                        style={{ width: `${Math.min(player.win_rate, 100)}%` }}
                      />
                    </div>
                  </div>

                  {/* Puntos */}
                  <div className="hidden sm:flex justify-end">
                    <span className="text-sm font-bold text-cyan-400">
                      {player.ranking_points.toLocaleString('es-ES')}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Leyenda */}
          <p className="text-xs text-slate-500 text-right mt-2">
            Ordenado por puntos de ranking · Club ID {CLUB_ID}
          </p>
        </div>
      )}
    </div>
  )
}
