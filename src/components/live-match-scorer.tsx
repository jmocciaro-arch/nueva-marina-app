'use client'

import { useCallback, useEffect, useState } from 'react'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Modal } from '@/components/ui/modal'
import { useToast } from '@/components/ui/toast'
import {
  Trophy, Undo2, Pause, Play, Settings, Activity,
  Zap, Target, AlertTriangle, CheckCircle2, X, Volleyball,
  ArrowLeftRight,
} from 'lucide-react'

// ─── Types ───────────────────────────────────────────────────────────────────

export interface LiveMatchSession {
  id: number
  match_type: 'tournament' | 'league'
  match_id: number
  team1_id: number | null
  team2_id: number | null
  team1_player1_name: string
  team1_player2_name: string
  team2_player1_name: string
  team2_player2_name: string
  status: 'pending' | 'live' | 'paused' | 'completed' | 'cancelled'
  sets_to_win: number
  games_per_set: number
  golden_point: boolean
  tiebreak_at: number
  super_tiebreak_final: boolean
  current_set: number
  current_game_team1: number
  current_game_team2: number
  current_point_team1: string
  current_point_team2: string
  sets_team1: number
  sets_team2: number
  serving_team: 1 | 2
  serving_player: 1 | 2
  serving_side: 'right' | 'left'
  in_tiebreak: boolean
  tiebreak_team1: number
  tiebreak_team2: number
  started_at: string | null
  paused_at: string | null
  completed_at: string | null
  winner_team: number | null
}

export interface LiveMatchPoint {
  id: number
  session_id: number
  scoring_team: 1 | 2
  scoring_player_name: string | null
  scoring_player_number: number | null
  point_type: string
  set_number: number
  game_team1_before: number
  game_team2_before: number
  point_team1_before: string
  point_team2_before: string
  closed_game: boolean
  closed_set: boolean
  closed_match: boolean
  created_at: string
}

interface LiveMatchScorerProps {
  sessionId: number
  onMatchEnd?: (winner: number) => void
  readOnly?: boolean
}

// ─── Constantes ──────────────────────────────────────────────────────────────

const POINT_TYPES = [
  { value: 'normal', label: 'Punto', icon: <Volleyball size={18} />, color: 'text-slate-300' },
  { value: 'ace', label: 'Ace', icon: <Zap size={18} />, color: 'text-yellow-400' },
  { value: 'winner', label: 'Winner', icon: <Target size={18} />, color: 'text-cyan-300' },
  { value: 'volley_winner', label: 'Volea', icon: <Target size={18} />, color: 'text-emerald-400' },
  { value: 'smash', label: 'Remate', icon: <Zap size={18} />, color: 'text-orange-400' },
  { value: 'lob_winner', label: 'Globo', icon: <Target size={18} />, color: 'text-purple-400' },
  { value: 'unforced_error', label: 'Error rival', icon: <AlertTriangle size={18} />, color: 'text-red-400' },
  { value: 'forced_error', label: 'Error forzado', icon: <AlertTriangle size={18} />, color: 'text-orange-400' },
  { value: 'double_fault', label: 'Doble falta', icon: <X size={18} />, color: 'text-red-500' },
]

// ─── Componente principal ───────────────────────────────────────────────────

export function LiveMatchScorer({ sessionId, onMatchEnd, readOnly = false }: LiveMatchScorerProps) {
  const { toast } = useToast()
  const supabase = createClient()
  const [session, setSession] = useState<LiveMatchSession | null>(null)
  const [points, setPoints] = useState<LiveMatchPoint[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const [pointModal, setPointModal] = useState<{ team: 1 | 2; player?: 1 | 2 } | null>(null)
  const [selectedPointType, setSelectedPointType] = useState<string>('normal')
  const [showSettings, setShowSettings] = useState(false)
  const [showStats, setShowStats] = useState(false)
  const [swapped, setSwapped] = useState(false) // intercambiar lados

  // ─── Load + Realtime ──────────────────────────────────────────────────────

  const loadData = useCallback(async () => {
    setLoading(true)
    const [sessionRes, pointsRes] = await Promise.all([
      supabase.from('nm_live_match_sessions').select('*').eq('id', sessionId).single(),
      supabase.from('nm_live_match_points').select('*').eq('session_id', sessionId).order('id', { ascending: true }),
    ])
    if (sessionRes.data) setSession(sessionRes.data as LiveMatchSession)
    setPoints((pointsRes.data ?? []) as LiveMatchPoint[])
    setLoading(false)
  }, [sessionId, supabase])

  useEffect(() => {
    loadData()
    const channel = supabase
      .channel(`live-match-${sessionId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'nm_live_match_sessions', filter: `id=eq.${sessionId}` }, () => loadData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'nm_live_match_points', filter: `session_id=eq.${sessionId}` }, () => loadData())
      .subscribe()
    return () => { channel.unsubscribe() }
  }, [sessionId, loadData, supabase])

  // ─── Lógica de scoring ────────────────────────────────────────────────────

  const computeNextPoint = useCallback((current: string, opponent: string, goldenPoint: boolean): { newPoint: string; opponentNew: string; gameWon: boolean } => {
    if (current === '0') return { newPoint: '15', opponentNew: opponent, gameWon: false }
    if (current === '15') return { newPoint: '30', opponentNew: opponent, gameWon: false }
    if (current === '30') return { newPoint: '40', opponentNew: opponent, gameWon: false }
    if (current === '40') {
      if (opponent === '40') {
        if (goldenPoint) return { newPoint: '0', opponentNew: '0', gameWon: true }
        return { newPoint: 'ADV', opponentNew: '40', gameWon: false }
      }
      if (opponent === 'ADV') return { newPoint: '40', opponentNew: '40', gameWon: false }
      return { newPoint: '0', opponentNew: '0', gameWon: true }
    }
    if (current === 'ADV') return { newPoint: '0', opponentNew: '0', gameWon: true }
    return { newPoint: current, opponentNew: opponent, gameWon: false }
  }, [])

  const addPoint = useCallback(async (team: 1 | 2, playerNumber?: 1 | 2, pointType: string = 'normal') => {
    if (!session || readOnly || saving || session.status === 'completed') return
    setSaving(true)

    const isTeam1 = team === 1
    const newSession = { ...session }
    let closedGame = false
    let closedSet = false
    let closedMatch = false
    let winnerTeam: number | null = null

    if (session.in_tiebreak) {
      if (isTeam1) newSession.tiebreak_team1++
      else newSession.tiebreak_team2++

      const t1 = newSession.tiebreak_team1
      const t2 = newSession.tiebreak_team2
      const target = session.super_tiebreak_final && session.current_set === 3 ? 10 : 7

      if ((t1 >= target || t2 >= target) && Math.abs(t1 - t2) >= 2) {
        closedGame = true
        closedSet = true
        if (t1 > t2) { newSession.sets_team1++; newSession.current_game_team1++ }
        else { newSession.sets_team2++; newSession.current_game_team2++ }

        if (newSession.sets_team1 === session.sets_to_win || newSession.sets_team2 === session.sets_to_win) {
          closedMatch = true
          winnerTeam = newSession.sets_team1 > newSession.sets_team2 ? 1 : 2
          newSession.status = 'completed'
          newSession.winner_team = winnerTeam
          newSession.completed_at = new Date().toISOString()
        } else {
          newSession.current_set++
          newSession.current_game_team1 = 0
          newSession.current_game_team2 = 0
          newSession.in_tiebreak = false
          newSession.tiebreak_team1 = 0
          newSession.tiebreak_team2 = 0
        }
        newSession.current_point_team1 = '0'
        newSession.current_point_team2 = '0'
      }
    } else {
      const { newPoint, opponentNew, gameWon } = isTeam1
        ? computeNextPoint(session.current_point_team1, session.current_point_team2, session.golden_point)
        : computeNextPoint(session.current_point_team2, session.current_point_team1, session.golden_point)

      if (gameWon) {
        closedGame = true
        if (isTeam1) newSession.current_game_team1++
        else newSession.current_game_team2++
        newSession.current_point_team1 = '0'
        newSession.current_point_team2 = '0'

        const g1 = newSession.current_game_team1
        const g2 = newSession.current_game_team2
        if ((g1 >= session.games_per_set || g2 >= session.games_per_set) && Math.abs(g1 - g2) >= 2) {
          closedSet = true
          if (g1 > g2) newSession.sets_team1++
          else newSession.sets_team2++

          if (newSession.sets_team1 === session.sets_to_win || newSession.sets_team2 === session.sets_to_win) {
            closedMatch = true
            winnerTeam = newSession.sets_team1 > newSession.sets_team2 ? 1 : 2
            newSession.status = 'completed'
            newSession.winner_team = winnerTeam
            newSession.completed_at = new Date().toISOString()
          } else {
            newSession.current_set++
            newSession.current_game_team1 = 0
            newSession.current_game_team2 = 0
          }
        } else if (g1 === session.tiebreak_at && g2 === session.tiebreak_at) {
          newSession.in_tiebreak = true
          newSession.tiebreak_team1 = 0
          newSession.tiebreak_team2 = 0
        }

        newSession.serving_team = newSession.serving_team === 1 ? 2 : 1
      } else {
        if (isTeam1) {
          newSession.current_point_team1 = newPoint
          newSession.current_point_team2 = opponentNew
        } else {
          newSession.current_point_team1 = opponentNew
          newSession.current_point_team2 = newPoint
        }
      }
    }

    newSession.serving_side = newSession.serving_side === 'right' ? 'left' : 'right'

    const playerName = playerNumber
      ? (isTeam1
          ? (playerNumber === 1 ? session.team1_player1_name : session.team1_player2_name)
          : (playerNumber === 1 ? session.team2_player1_name : session.team2_player2_name))
      : null

    const pointInsert = await supabase.from('nm_live_match_points').insert({
      session_id: sessionId,
      scoring_team: team,
      scoring_player_name: playerName,
      scoring_player_number: playerNumber ?? null,
      point_type: pointType,
      set_number: session.current_set,
      game_team1_before: session.current_game_team1,
      game_team2_before: session.current_game_team2,
      point_team1_before: session.current_point_team1,
      point_team2_before: session.current_point_team2,
      serving_team: session.serving_team,
      serving_player: session.serving_player,
      serving_side: session.serving_side,
      is_tiebreak_point: session.in_tiebreak,
      tiebreak_team1_before: session.in_tiebreak ? session.tiebreak_team1 : null,
      tiebreak_team2_before: session.in_tiebreak ? session.tiebreak_team2 : null,
      closed_game: closedGame,
      closed_set: closedSet,
      closed_match: closedMatch,
    })

    if (pointInsert.error) {
      toast('error', pointInsert.error.message)
      setSaving(false)
      return
    }

    const { id, ...sessionUpdate } = newSession
    void id
    const sessionRes = await supabase.from('nm_live_match_sessions').update(sessionUpdate).eq('id', sessionId)
    if (sessionRes.error) toast('error', sessionRes.error.message)

    if (closedSet) {
      await supabase.from('nm_live_match_sets').upsert({
        session_id: sessionId,
        set_number: session.current_set,
        games_team1: newSession.current_game_team1 || (isTeam1 ? 7 : session.current_game_team1),
        games_team2: newSession.current_game_team2 || (!isTeam1 ? 7 : session.current_game_team2),
        tiebreak_team1: session.in_tiebreak ? newSession.tiebreak_team1 : null,
        tiebreak_team2: session.in_tiebreak ? newSession.tiebreak_team2 : null,
        winner_team: isTeam1 ? 1 : 2,
      }, { onConflict: 'session_id,set_number' })
    }

    if (closedMatch && winnerTeam && onMatchEnd) {
      onMatchEnd(winnerTeam)
      toast('success', `¡Equipo ${winnerTeam} ganó el partido!`)
    } else if (closedSet) {
      toast('info', `Set ${session.current_set} ganado`)
    } else if (closedGame) {
      toast('info', `Game para equipo ${isTeam1 ? 1 : 2}`)
    }

    setSaving(false)
  }, [session, sessionId, supabase, computeNextPoint, onMatchEnd, toast, readOnly, saving])

  const undoLastPoint = useCallback(async () => {
    if (!session || readOnly || points.length === 0) return
    if (!confirm('¿Deshacer el último punto?')) return

    const lastPoint = points[points.length - 1]
    setSaving(true)

    const restored = {
      current_set: lastPoint.set_number,
      current_game_team1: lastPoint.game_team1_before,
      current_game_team2: lastPoint.game_team2_before,
      current_point_team1: lastPoint.point_team1_before,
      current_point_team2: lastPoint.point_team2_before,
      sets_team1: session.sets_team1 - (lastPoint.closed_set && lastPoint.scoring_team === 1 ? 1 : 0),
      sets_team2: session.sets_team2 - (lastPoint.closed_set && lastPoint.scoring_team === 2 ? 1 : 0),
      status: session.status === 'completed' ? 'live' : session.status,
      winner_team: lastPoint.closed_match ? null : session.winner_team,
      completed_at: lastPoint.closed_match ? null : session.completed_at,
    }

    await supabase.from('nm_live_match_sessions').update(restored).eq('id', sessionId)
    await supabase.from('nm_live_match_points').delete().eq('id', lastPoint.id)
    if (lastPoint.closed_set) {
      await supabase.from('nm_live_match_sets').delete().eq('session_id', sessionId).eq('set_number', lastPoint.set_number)
    }
    toast('info', 'Punto deshecho')
    setSaving(false)
  }, [session, sessionId, points, supabase, toast, readOnly])

  const togglePause = useCallback(async () => {
    if (!session || readOnly) return
    const newStatus = session.status === 'paused' ? 'live' : 'paused'
    await supabase.from('nm_live_match_sessions').update({
      status: newStatus,
      paused_at: newStatus === 'paused' ? new Date().toISOString() : null,
      started_at: session.started_at || new Date().toISOString(),
    }).eq('id', sessionId)
    toast('info', newStatus === 'paused' ? 'Partido pausado' : 'Partido reanudado')
  }, [session, sessionId, supabase, toast, readOnly])

  // ─── Render ──────────────────────────────────────────────────────────────

  if (loading) return <div className="text-slate-400 text-center p-8">Cargando partido...</div>
  if (!session) return <div className="text-red-400 text-center p-8">Sesión no encontrada</div>

  const isLive = session.status === 'live'
  const isPaused = session.status === 'paused'
  const isCompleted = session.status === 'completed'
  const playerStats = computePlayerStats(points, session)

  // Determinar qué equipo va a la izquierda/derecha
  const leftTeamNum: 1 | 2 = swapped ? 2 : 1
  const rightTeamNum: 1 | 2 = swapped ? 1 : 2

  const team1Data = {
    num: 1 as const,
    p1: session.team1_player1_name,
    p2: session.team1_player2_name,
    point: session.in_tiebreak ? String(session.tiebreak_team1) : session.current_point_team1,
    games: session.current_game_team1,
    sets: session.sets_team1,
    isServing: session.serving_team === 1,
    isWinner: session.winner_team === 1,
  }
  const team2Data = {
    num: 2 as const,
    p1: session.team2_player1_name,
    p2: session.team2_player2_name,
    point: session.in_tiebreak ? String(session.tiebreak_team2) : session.current_point_team2,
    games: session.current_game_team2,
    sets: session.sets_team2,
    isServing: session.serving_team === 2,
    isWinner: session.winner_team === 2,
  }
  const leftData = leftTeamNum === 1 ? team1Data : team2Data
  const rightData = leftTeamNum === 1 ? team2Data : team1Data

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-white">
      {/* ── Header con logo ───────────────────────────────────────────── */}
      <div className="bg-slate-900/80 backdrop-blur border-b border-cyan-500/20 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-400 to-cyan-600 flex items-center justify-center text-white font-bold text-lg shadow-lg shadow-cyan-500/30">
            <Image
              src="/icons/icon-192.png"
              alt="Nueva Marina"
              width={40}
              height={40}
              className="rounded-xl"
              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
            />
          </div>
          <div>
            <p className="text-sm font-bold text-white leading-tight">Nueva Marina</p>
            <p className="text-[10px] text-cyan-400/80 uppercase tracking-wider">Pádel & Sport</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Badge variant={isCompleted ? 'success' : isPaused ? 'warning' : 'cyan'}>
            {isCompleted ? '✓ Final' : isPaused ? '⏸ Pausado' : isLive ? '● EN VIVO' : 'Por jugar'}
          </Badge>
          {session.in_tiebreak && <Badge variant="warning">TIEBREAK</Badge>}
        </div>

        <div className="flex items-center gap-1">
          {!readOnly && (
            <>
              <button onClick={() => setSwapped(!swapped)} className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800" title="Intercambiar lados">
                <ArrowLeftRight size={16} />
              </button>
              <button onClick={() => setShowStats(true)} className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800">
                <Activity size={16} />
              </button>
              <button onClick={() => setShowSettings(true)} className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800">
                <Settings size={16} />
              </button>
              {!isCompleted && (
                <button onClick={togglePause} className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800">
                  {isPaused ? <Play size={16} /> : <Pause size={16} />}
                </button>
              )}
              <button onClick={undoLastPoint} disabled={points.length === 0} className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 disabled:opacity-40">
                <Undo2 size={16} />
              </button>
            </>
          )}
        </div>
      </div>

      {/* ── Marcador de sets compacto arriba ────────────────────────── */}
      <div className="bg-slate-900/50 border-b border-slate-800/50 px-4 py-2">
        <div className="max-w-6xl mx-auto flex items-center justify-center gap-4 sm:gap-8 text-xs">
          <span className="text-slate-500">Set actual: <span className="text-white font-bold">{session.current_set}</span></span>
          <span className="text-slate-500">Sets ganados: <span className="text-cyan-300 font-bold">{leftData.sets}</span> - <span className="text-rose-300 font-bold">{rightData.sets}</span></span>
          {session.golden_point && <Badge variant="info">Punto oro</Badge>}
        </div>
      </div>

      {/* ── Cancha visual con dos lados ──────────────────────────────── */}
      <div className="relative max-w-7xl mx-auto p-3 sm:p-6">
        {/* Línea divisoria de la red */}
        <div className="hidden sm:block absolute top-0 bottom-0 left-1/2 w-px bg-gradient-to-b from-transparent via-cyan-500/30 to-transparent z-0" />
        <div className="hidden sm:block absolute top-1/2 left-0 right-0 -translate-y-1/2 text-center z-10 pointer-events-none">
          <span className="bg-slate-950 px-2 text-cyan-500/40 text-xs font-bold uppercase tracking-widest">Red</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-6 relative z-10">
          {/* ── LADO IZQUIERDO ──────────────────────────────────────── */}
          <TeamSide
            data={leftData}
            position="left"
            isLeft={true}
            servingSide={session.serving_side}
            servingPlayer={session.serving_player}
            onPlayerScore={(player) => setPointModal({ team: leftData.num, player })}
            onTeamScore={() => setPointModal({ team: leftData.num })}
            disabled={readOnly || isCompleted || isPaused || saving}
          />

          {/* ── LADO DERECHO ────────────────────────────────────────── */}
          <TeamSide
            data={rightData}
            position="right"
            isLeft={false}
            servingSide={session.serving_side}
            servingPlayer={session.serving_player}
            onPlayerScore={(player) => setPointModal({ team: rightData.num, player })}
            onTeamScore={() => setPointModal({ team: rightData.num })}
            disabled={readOnly || isCompleted || isPaused || saving}
          />
        </div>

        {/* ── Banner final ──────────────────────────────────────────── */}
        {isCompleted && session.winner_team && (
          <div className="mt-6 bg-gradient-to-r from-amber-500/20 via-emerald-500/20 to-amber-500/20 border-2 border-amber-500/40 rounded-3xl p-8 text-center shadow-2xl">
            <Trophy size={64} className="mx-auto text-amber-400 mb-3 drop-shadow-lg" />
            <p className="text-3xl sm:text-4xl font-black text-white">¡Partido finalizado!</p>
            <p className="text-xl text-amber-300 mt-2">
              Ganador: Equipo {session.winner_team}
            </p>
            <p className="text-base text-slate-300 mt-1">
              {session.winner_team === 1
                ? `${session.team1_player1_name} / ${session.team1_player2_name}`
                : `${session.team2_player1_name} / ${session.team2_player2_name}`}
            </p>
            <p className="text-3xl font-mono font-bold text-cyan-300 mt-4">
              {session.sets_team1} - {session.sets_team2}
            </p>
          </div>
        )}
      </div>

      {/* ── Modal: tipo de punto ───────────────────────────────────── */}
      {pointModal && (
        <Modal open onClose={() => setPointModal(null)} title={`Punto para ${pointModal.team === 1 ? 'Equipo CYAN' : 'Equipo ROSA'}`} size="md">
          <div className="space-y-4">
            {!pointModal.player && (
              <div>
                <p className="text-sm text-slate-400 mb-2">¿Quién metió el punto?</p>
                <div className="grid grid-cols-2 gap-2">
                  {[1, 2].map(n => (
                    <button
                      key={n}
                      onClick={() => setPointModal({ ...pointModal, player: n as 1 | 2 })}
                      className="bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl p-4 text-left"
                    >
                      <div className="text-xs text-slate-500">Jugador {n}</div>
                      <div className="font-bold text-white truncate">
                        {pointModal.team === 1
                          ? (n === 1 ? session.team1_player1_name : session.team1_player2_name)
                          : (n === 1 ? session.team2_player1_name : session.team2_player2_name)}
                      </div>
                    </button>
                  ))}
                </div>
                <button
                  onClick={() => { addPoint(pointModal.team, undefined, selectedPointType); setPointModal(null) }}
                  className="w-full mt-2 text-xs text-slate-400 hover:text-white py-2"
                >
                  Sin especificar jugador →
                </button>
              </div>
            )}

            {pointModal.player !== undefined && (
              <>
                <div>
                  <p className="text-sm text-slate-400 mb-2">
                    Punto de:{' '}
                    <span className="text-white font-bold">
                      {pointModal.team === 1
                        ? (pointModal.player === 1 ? session.team1_player1_name : session.team1_player2_name)
                        : (pointModal.player === 1 ? session.team2_player1_name : session.team2_player2_name)}
                    </span>
                  </p>
                  <p className="text-sm text-slate-400 mb-2">¿Cómo fue el punto?</p>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {POINT_TYPES.map(pt => (
                      <button
                        key={pt.value}
                        onClick={() => setSelectedPointType(pt.value)}
                        className={`flex flex-col items-center gap-1 p-3 rounded-xl border transition-colors ${
                          selectedPointType === pt.value
                            ? 'bg-cyan-500/20 border-cyan-500/50 text-white'
                            : 'bg-slate-800 border-slate-700 hover:border-slate-600 text-slate-300'
                        }`}
                      >
                        <span className={pt.color}>{pt.icon}</span>
                        <span className="text-xs font-medium text-center">{pt.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex gap-2 pt-2">
                  <Button variant="ghost" onClick={() => setPointModal(null)} className="flex-1">Cancelar</Button>
                  <Button
                    onClick={() => {
                      addPoint(pointModal.team, pointModal.player, selectedPointType)
                      setPointModal(null)
                      setSelectedPointType('normal')
                    }}
                    className="flex-1"
                  >
                    <CheckCircle2 size={16} className="mr-1" /> Confirmar
                  </Button>
                </div>
              </>
            )}
          </div>
        </Modal>
      )}

      {/* ── Modal: estadísticas ──────────────────────────────────── */}
      {showStats && (
        <Modal open onClose={() => setShowStats(false)} title="Estadísticas del partido" size="lg">
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-cyan-500/10 border border-cyan-500/30 rounded-xl p-4 text-center">
                <p className="text-xs text-slate-400">Equipo CYAN</p>
                <p className="text-3xl font-bold text-cyan-300 mt-1">{points.filter(p => p.scoring_team === 1).length}</p>
                <p className="text-xs text-slate-500 mt-1">puntos totales</p>
              </div>
              <div className="bg-rose-500/10 border border-rose-500/30 rounded-xl p-4 text-center">
                <p className="text-xs text-slate-400">Equipo ROSA</p>
                <p className="text-3xl font-bold text-rose-300 mt-1">{points.filter(p => p.scoring_team === 2).length}</p>
                <p className="text-xs text-slate-500 mt-1">puntos totales</p>
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-sm font-medium text-slate-300">Puntos por jugador</p>
              {Object.entries(playerStats).map(([name, stats]) => (
                <div key={name} className="bg-slate-800/50 rounded-lg p-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium text-white">{name}</span>
                    <Badge variant="cyan">{stats.total} puntos</Badge>
                  </div>
                  <div className="grid grid-cols-3 gap-1 text-xs">
                    <div className="text-yellow-400">⚡ {stats.aces} aces</div>
                    <div className="text-emerald-400">🎯 {stats.winners} winners</div>
                    <div className="text-red-400">✗ {stats.errors} errores</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </Modal>
      )}

      {showSettings && (
        <Modal open onClose={() => setShowSettings(false)} title="Configuración del partido" size="md">
          <div className="space-y-3 text-sm">
            <div className="flex items-center justify-between bg-slate-800/50 rounded-lg p-3">
              <span className="text-slate-300">Sets para ganar</span>
              <span className="font-bold text-white">{session.sets_to_win}</span>
            </div>
            <div className="flex items-center justify-between bg-slate-800/50 rounded-lg p-3">
              <span className="text-slate-300">Juegos por set</span>
              <span className="font-bold text-white">{session.games_per_set}</span>
            </div>
            <div className="flex items-center justify-between bg-slate-800/50 rounded-lg p-3">
              <span className="text-slate-300">Punto de oro</span>
              <Badge variant={session.golden_point ? 'success' : 'default'}>
                {session.golden_point ? 'Sí' : 'No'}
              </Badge>
            </div>
            <div className="flex items-center justify-between bg-slate-800/50 rounded-lg p-3">
              <span className="text-slate-300">Tiebreak en</span>
              <span className="font-bold text-white">{session.tiebreak_at}-{session.tiebreak_at}</span>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}

// ─── Subcomponente: lado del equipo (izquierda o derecha) ───────────────────

function TeamSide({
  data, position, isLeft, servingSide, servingPlayer, onPlayerScore, onTeamScore, disabled,
}: {
  data: { num: 1 | 2; p1: string; p2: string; point: string; games: number; sets: number; isServing: boolean; isWinner: boolean }
  position: 'left' | 'right'
  isLeft: boolean
  servingSide: 'right' | 'left'
  servingPlayer: 1 | 2
  onPlayerScore: (player: 1 | 2) => void
  onTeamScore: () => void
  disabled: boolean
}) {
  // Equipo 1 = CYAN, Equipo 2 = ROSA (siempre, sin importar el lado)
  const isCyan = data.num === 1
  const colorClasses = isCyan
    ? {
        gradient: 'from-cyan-500/30 via-cyan-600/10 to-cyan-900/20',
        border: 'border-cyan-500/40',
        accent: 'text-cyan-300',
        bg: 'bg-cyan-500/10',
        bgHover: 'hover:bg-cyan-500/20',
        bgActive: 'active:bg-cyan-500/30',
        bgServing: 'bg-cyan-500/30',
        borderServing: 'border-cyan-400',
        glow: 'shadow-cyan-500/30',
        scoreBg: 'from-cyan-400 to-cyan-600',
        label: 'CYAN',
      }
    : {
        gradient: 'from-rose-500/30 via-rose-600/10 to-rose-900/20',
        border: 'border-rose-500/40',
        accent: 'text-rose-300',
        bg: 'bg-rose-500/10',
        bgHover: 'hover:bg-rose-500/20',
        bgActive: 'active:bg-rose-500/30',
        bgServing: 'bg-rose-500/30',
        borderServing: 'border-rose-400',
        glow: 'shadow-rose-500/30',
        scoreBg: 'from-rose-400 to-rose-600',
        label: 'ROSA',
      }

  return (
    <div
      onClick={(e) => {
        if (disabled) return
        // Tap fuera de los botones de jugador → punto al equipo (sin elegir quién)
        if ((e.target as HTMLElement).closest('button')) return
        onTeamScore()
      }}
      className={`relative rounded-3xl border-2 ${colorClasses.border} bg-gradient-to-br ${colorClasses.gradient} backdrop-blur p-4 sm:p-6 ${
        data.isWinner ? `shadow-2xl ${colorClasses.glow} ring-2 ring-amber-400` : ''
      } ${disabled ? 'opacity-70' : 'cursor-pointer'} transition-all`}
    >
      {/* Banda superior con nombre de equipo */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className={`w-3 h-3 rounded-full ${isCyan ? 'bg-cyan-400' : 'bg-rose-400'} ${data.isServing ? 'animate-pulse' : ''}`} />
          <span className={`text-xs font-bold uppercase tracking-wider ${colorClasses.accent}`}>
            Equipo {colorClasses.label} {position === 'left' ? '←' : '→'}
          </span>
        </div>
        {data.isServing && (
          <div className="flex items-center gap-1 text-xs">
            <Volleyball size={12} className={`${colorClasses.accent} animate-bounce`} />
            <span className={colorClasses.accent}>Saca</span>
          </div>
        )}
      </div>

      {/* Marcador GIGANTE */}
      <div className={`relative rounded-2xl bg-slate-950/60 backdrop-blur border ${colorClasses.border} p-4 sm:p-6 mb-4 text-center`}>
        <div className={`text-7xl sm:text-9xl font-black font-mono ${colorClasses.accent} drop-shadow-2xl leading-none`}>
          {data.point}
        </div>

        {/* Games + Sets debajo del punto */}
        <div className="flex items-center justify-center gap-4 mt-3 text-sm">
          <div className="text-slate-400">
            Games: <span className="text-white font-bold text-lg">{data.games}</span>
          </div>
          <div className="text-slate-400">
            Sets: <span className={`${colorClasses.accent} font-bold text-lg`}>{data.sets}</span>
          </div>
        </div>
      </div>

      {/* Jugadores */}
      <div className="space-y-2">
        <PlayerCard
          name={data.p1}
          number={1}
          isCyan={isCyan}
          isServing={data.isServing && servingPlayer === 1}
          servingSide={servingSide}
          onClick={() => onPlayerScore(1)}
          disabled={disabled}
        />
        <PlayerCard
          name={data.p2}
          number={2}
          isCyan={isCyan}
          isServing={data.isServing && servingPlayer === 2}
          servingSide={servingSide}
          onClick={() => onPlayerScore(2)}
          disabled={disabled}
        />
      </div>

      {/* Botón grande de punto al equipo */}
      {!disabled && (
        <button
          onClick={(e) => { e.stopPropagation(); onTeamScore() }}
          className={`w-full mt-3 ${colorClasses.bg} ${colorClasses.bgHover} ${colorClasses.bgActive} border-2 ${colorClasses.border} rounded-xl py-4 font-bold text-base text-white transition-all active:scale-[0.98]`}
        >
          + PUNTO {colorClasses.label}
        </button>
      )}

      {/* Trofeo si ganó */}
      {data.isWinner && (
        <div className="absolute -top-3 -right-3 bg-amber-500 rounded-full p-2 shadow-lg">
          <Trophy size={20} className="text-white" />
        </div>
      )}
    </div>
  )
}

// ─── Subcomponente: tarjeta de jugador ──────────────────────────────────────

function PlayerCard({
  name, number, isCyan, isServing, servingSide, onClick, disabled,
}: {
  name: string
  number: 1 | 2
  isCyan: boolean
  isServing: boolean
  servingSide: 'right' | 'left'
  onClick: () => void
  disabled: boolean
}) {
  const colorClasses = isCyan
    ? {
        bg: isServing ? 'bg-cyan-500/30' : 'bg-slate-900/60',
        border: isServing ? 'border-cyan-400' : 'border-slate-700/50',
        accent: 'text-cyan-300',
      }
    : {
        bg: isServing ? 'bg-rose-500/30' : 'bg-slate-900/60',
        border: isServing ? 'border-rose-400' : 'border-slate-700/50',
        accent: 'text-rose-300',
      }

  return (
    <button
      onClick={(e) => { e.stopPropagation(); onClick() }}
      disabled={disabled}
      className={`w-full flex items-center gap-3 p-3 rounded-xl border-2 transition-all text-left ${colorClasses.bg} ${colorClasses.border} ${
        disabled ? 'opacity-60 cursor-not-allowed' : 'hover:bg-slate-800 active:scale-[0.98]'
      } ${isServing ? 'shadow-lg' : ''}`}
    >
      {/* Avatar circular con número */}
      <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm ${
        isCyan ? 'bg-cyan-500/30 text-cyan-200' : 'bg-rose-500/30 text-rose-200'
      } border-2 ${colorClasses.border}`}>
        J{number}
      </div>

      {/* Nombre y estado */}
      <div className="flex-1 min-w-0">
        <div className="text-sm sm:text-base font-bold text-white truncate">{name || `Jugador ${number}`}</div>
        {isServing ? (
          <div className={`text-xs ${colorClasses.accent} flex items-center gap-1`}>
            <Volleyball size={10} className="animate-pulse" />
            Saca {servingSide === 'right' ? '→ derecha' : '← izquierda'}
          </div>
        ) : (
          <div className="text-xs text-slate-500">Toca para sumarle un punto</div>
        )}
      </div>

      <div className={`text-2xl ${colorClasses.accent} font-bold`}>+</div>
    </button>
  )
}

function computePlayerStats(points: LiveMatchPoint[], session: LiveMatchSession) {
  const stats: Record<string, { total: number; aces: number; winners: number; errors: number }> = {}
  for (const p of points) {
    const name = p.scoring_player_name ?? `Equipo ${p.scoring_team}`
    if (!stats[name]) stats[name] = { total: 0, aces: 0, winners: 0, errors: 0 }
    stats[name].total++
    if (p.point_type === 'ace') stats[name].aces++
    if (['winner', 'volley_winner', 'smash', 'lob_winner'].includes(p.point_type)) stats[name].winners++
    if (['unforced_error', 'forced_error', 'double_fault'].includes(p.point_type)) stats[name].errors++
  }
  ;[session.team1_player1_name, session.team1_player2_name, session.team2_player1_name, session.team2_player2_name]
    .filter(Boolean)
    .forEach(n => {
      if (!stats[n]) stats[n] = { total: 0, aces: 0, winners: 0, errors: 0 }
    })
  return stats
}
