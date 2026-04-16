'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import {
  ArrowLeft, Trophy, Users, CalendarDays, Loader2, Save,
  Play, Square, RotateCcw, Clock, Swords, Monitor, ExternalLink, Settings,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useRealtimeRefresh } from '@/hooks/use-realtime-refresh'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Modal } from '@/components/ui/modal'
import { useToast } from '@/components/ui/toast'
import { TournamentBracket, BracketConfigPanel } from '@/components/tournament-bracket'
import type { BracketMatch, BracketConfig } from '@/components/tournament-bracket'
import { formatDate, STATUS_LABELS } from '@/lib/utils'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Tournament {
  id: number
  name: string
  format: string
  start_date: string | null
  end_date: string | null
  registration_deadline: string | null
  max_teams: number | null
  entry_fee: number
  prize_description: string | null
  status: string
  categories: string[]
  sets_to_win: number
  games_per_set: number
  description: string | null
}

interface TournamentTeam {
  id: number
  tournament_id: number
  category: string | null
  team_name: string | null
  player1_id: string | null
  player1_name: string
  player2_id: string | null
  player2_name: string
  seed: number | null
  status: string
  paid: boolean
}

interface TournamentMatch {
  id: number
  tournament_id: number
  category: string | null
  round: string | null
  round_number: number
  match_number: number
  bracket_position: number
  court_id: number | null
  team1_id: number | null
  team2_id: number | null
  team1_set1: number | null; team2_set1: number | null
  team1_set2: number | null; team2_set2: number | null
  team1_set3: number | null; team2_set3: number | null
  sets_team1: number; sets_team2: number
  games_team1: number; games_team2: number
  winner_team_id: number | null
  status: string
  started_at: string | null
  finished_at: string | null
  duration_seconds: number | null
  is_bye: boolean
  next_match_id: number | null
  // joined
  team1?: { id: number; team_name: string | null } | null
  team2?: { id: number; team_name: string | null } | null
}

interface Court {
  id: number
  name: string
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function statusBadge(status: string) {
  const s = STATUS_LABELS[status]
  if (s) return <Badge className={s.class}>{s.label}</Badge>
  return <Badge>{status}</Badge>
}

function formatElapsedTimer(startedAt: string): string {
  const start = new Date(startedAt).getTime()
  const now = Date.now()
  const sec = Math.max(0, Math.floor((now - start) / 1000))
  const mm = Math.floor(sec / 60).toString().padStart(2, '0')
  const ss = (sec % 60).toString().padStart(2, '0')
  return `${mm}:${ss}`
}

function formatDuration(seconds: number): string {
  const mm = Math.floor(seconds / 60)
  const ss = seconds % 60
  return `${mm}m ${ss.toString().padStart(2, '0')}s`
}

// ─── Page ─────────────────────────────────────────────────────────────────────

type Tab = 'equipos' | 'bracket' | 'partidos'

export default function TorneoDetallePage() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const { toast } = useToast()
  const tournamentId = Number(params.id)

  const [tournament, setTournament] = useState<Tournament | null>(null)
  const [teams, setTeams] = useState<TournamentTeam[]>([])
  const [matches, setMatches] = useState<TournamentMatch[]>([])
  const [courts, setCourts] = useState<Court[]>([])
  const [loading, setLoading] = useState(true)

  const [activeTab, setActiveTab] = useState<Tab>('equipos')
  const [activeCategory, setActiveCategory] = useState<string | null>(null)

  // Score modal state
  const [selectedMatch, setSelectedMatch] = useState<TournamentMatch | null>(null)
  const [scoreForm, setScoreForm] = useState({
    t1s1: '', t2s1: '', t1s2: '', t2s2: '', t1s3: '', t2s3: '',
    courtId: '',
  })
  const [saving, setSaving] = useState(false)

  // Generating bracket
  const [generatingBracket, setGeneratingBracket] = useState(false)
  const [bracketConfig, setBracketConfig] = useState<BracketConfig>({ viewMode: 'tree', theme: 'dark', cardSize: 'md', showScores: true, showTimers: true, showCourts: true, showRoundHeaders: true, showByes: true, animationsEnabled: true })

  // ─── Data loading ──────────────────────────────────────────────────────────

  const load = useCallback(async () => {
    setLoading(true)
    const supabase = createClient()
    const [tRes, teamsRes, matchesRes, courtsRes] = await Promise.all([
      supabase
        .from('nm_tournaments')
        .select('*')
        .eq('id', tournamentId)
        .single(),
      supabase
        .from('nm_tournament_teams')
        .select('*')
        .eq('tournament_id', tournamentId)
        .order('seed', { ascending: true, nullsFirst: false }),
      supabase
        .from('nm_tournament_matches')
        .select('*, team1:nm_tournament_teams!team1_id(id, team_name), team2:nm_tournament_teams!team2_id(id, team_name)')
        .eq('tournament_id', tournamentId)
        .order('round_number')
        .order('bracket_position'),
      supabase
        .from('nm_courts')
        .select('id, name')
        .order('sort_order'),
    ])

    if (tRes.error || !tRes.data) {
      toast('error', 'Torneo no encontrado')
      router.push('/admin/torneos')
      return
    }
    const t = tRes.data as Tournament
    setTournament(t)
    setTeams((teamsRes.data ?? []) as TournamentTeam[])
    setMatches((matchesRes.data ?? []) as TournamentMatch[])
    setCourts((courtsRes.data ?? []) as Court[])

    // Set default active category
    const cats = (t.categories as string[]) ?? []
    if (cats.length > 0 && activeCategory === null) {
      setActiveCategory(cats[0])
    }
    setLoading(false)
  }, [tournamentId, toast, router, activeCategory])

  useEffect(() => { load() }, [load])

  // Realtime subscription
  useRealtimeRefresh(['nm_tournament_matches', 'nm_tournament_teams'], load)

  // ─── Derived data ──────────────────────────────────────────────────────────

  const categories = useMemo(() => {
    if (!tournament) return []
    return (tournament.categories ?? []) as string[]
  }, [tournament])

  const catTeams = useMemo(() => {
    if (!activeCategory) return teams
    return teams.filter(t => t.category === activeCategory)
  }, [teams, activeCategory])

  const catMatches = useMemo(() => {
    if (!activeCategory) return matches
    return matches.filter(m => m.category === activeCategory)
  }, [matches, activeCategory])

  const teamById = useMemo(() => {
    const map = new Map<number, TournamentTeam>()
    for (const t of teams) map.set(t.id, t)
    return map
  }, [teams])

  // Convert matches to BracketMatch format
  const bracketMatches: BracketMatch[] = useMemo(() => {
    return catMatches.map(m => ({
      id: m.id,
      round_number: m.round_number ?? 1,
      round: m.round ?? `Ronda ${m.round_number}`,
      bracket_position: m.bracket_position ?? 0,
      match_number: m.match_number ?? 0,
      team1_id: m.team1_id,
      team2_id: m.team2_id,
      team1_name: m.team1?.team_name ?? (m.team1_id ? teamById.get(m.team1_id)?.team_name ?? null : null),
      team2_name: m.team2?.team_name ?? (m.team2_id ? teamById.get(m.team2_id)?.team_name ?? null : null),
      team1_set1: m.team1_set1,
      team1_set2: m.team1_set2,
      team1_set3: m.team1_set3,
      team2_set1: m.team2_set1,
      team2_set2: m.team2_set2,
      team2_set3: m.team2_set3,
      sets_team1: m.sets_team1,
      sets_team2: m.sets_team2,
      winner_team_id: m.winner_team_id,
      status: m.status,
      court_name: m.court_id ? courts.find(c => c.id === m.court_id)?.name ?? null : null,
      started_at: m.started_at,
      finished_at: m.finished_at,
      duration_seconds: m.duration_seconds,
      is_bye: m.is_bye ?? false,
      next_match_id: m.next_match_id,
    }))
  }, [catMatches, teamById, courts])

  const totalRounds = useMemo(() => {
    if (bracketMatches.length === 0) return 0
    return Math.max(...bracketMatches.map(m => m.round_number))
  }, [bracketMatches])

  // ─── Actions ───────────────────────────────────────────────────────────────

  async function handleTeamStatus(teamId: number, status: 'confirmed' | 'rejected') {
    const supabase = createClient()
    const { error } = await supabase
      .from('nm_tournament_teams')
      .update({ status })
      .eq('id', teamId)
    if (error) { toast('error', error.message); return }
    toast('success', status === 'confirmed' ? 'Equipo confirmado' : 'Equipo rechazado')
    load()
  }

  async function generateBracket() {
    if (!activeCategory) {
      toast('error', 'Selecciona una categoria primero')
      return
    }
    setGeneratingBracket(true)
    try {
      const res = await fetch(`/api/torneos/${tournamentId}/bracket`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ category: activeCategory }),
      })
      const json = await res.json()
      if (!res.ok) {
        toast('error', json.error ?? 'Error generando bracket')
      } else {
        toast('success', `Bracket generado: ${json.teams} equipos, ${json.rounds} rondas`)
        setActiveTab('bracket')
        load()
      }
    } catch {
      toast('error', 'Error de red')
    }
    setGeneratingBracket(false)
  }

  // ─── Score modal ───────────────────────────────────────────────────────────

  function openScoreModal(match: BracketMatch) {
    const m = matches.find(x => x.id === match.id)
    if (!m) return
    setSelectedMatch(m)
    setScoreForm({
      t1s1: m.team1_set1?.toString() ?? '',
      t2s1: m.team2_set1?.toString() ?? '',
      t1s2: m.team1_set2?.toString() ?? '',
      t2s2: m.team2_set2?.toString() ?? '',
      t1s3: m.team1_set3?.toString() ?? '',
      t2s3: m.team2_set3?.toString() ?? '',
      courtId: m.court_id?.toString() ?? '',
    })
  }

  async function startMatch() {
    if (!selectedMatch) return
    setSaving(true)
    const supabase = createClient()
    const { error } = await supabase
      .from('nm_tournament_matches')
      .update({
        status: 'in_progress',
        started_at: new Date().toISOString(),
      })
      .eq('id', selectedMatch.id)
    if (error) { toast('error', error.message); setSaving(false); return }
    toast('success', 'Partido iniciado')
    setSaving(false)
    load()
  }

  async function finishMatch() {
    if (!selectedMatch) return
    setSaving(true)
    const supabase = createClient()

    const n = (v: string) => v === '' ? null : Number(v)
    const t1s1 = n(scoreForm.t1s1), t2s1 = n(scoreForm.t2s1)
    const t1s2 = n(scoreForm.t1s2), t2s2 = n(scoreForm.t2s2)
    const t1s3 = n(scoreForm.t1s3), t2s3 = n(scoreForm.t2s3)

    let sets1 = 0, sets2 = 0, games1 = 0, games2 = 0
    const pairs: [number | null, number | null][] = [[t1s1, t2s1], [t1s2, t2s2], [t1s3, t2s3]]
    for (const [a, b] of pairs) {
      if (a == null || b == null) continue
      games1 += a; games2 += b
      if (a > b) sets1++
      else if (b > a) sets2++
    }

    if (sets1 === 0 && sets2 === 0) {
      toast('error', 'Carga al menos un set con resultado')
      setSaving(false)
      return
    }

    const winner = sets1 > sets2
      ? selectedMatch.team1_id
      : sets2 > sets1
        ? selectedMatch.team2_id
        : null

    if (!winner) {
      toast('error', 'No se puede determinar ganador: los sets estan empatados. En padel se juega a 3 sets.')
      setSaving(false)
      return
    }

    const { error } = await supabase
      .from('nm_tournament_matches')
      .update({
        team1_set1: t1s1, team2_set1: t2s1,
        team1_set2: t1s2, team2_set2: t2s2,
        team1_set3: t1s3, team2_set3: t2s3,
        sets_team1: sets1,
        sets_team2: sets2,
        games_team1: games1,
        games_team2: games2,
        winner_team_id: winner,
        status: 'completed',
        finished_at: new Date().toISOString(),
        court_id: scoreForm.courtId ? Number(scoreForm.courtId) : null,
      })
      .eq('id', selectedMatch.id)

    if (error) { toast('error', error.message); setSaving(false); return }
    toast('success', 'Partido finalizado')
    setSaving(false)
    setSelectedMatch(null)
    load()
  }

  async function reopenMatch() {
    if (!selectedMatch) return
    setSaving(true)
    const supabase = createClient()
    const { error } = await supabase
      .from('nm_tournament_matches')
      .update({
        status: 'in_progress',
        finished_at: null,
        winner_team_id: null,
      })
      .eq('id', selectedMatch.id)
    if (error) { toast('error', error.message); setSaving(false); return }
    toast('info', 'Partido reabierto')
    setSaving(false)
    load()
  }

  async function updateCourt() {
    if (!selectedMatch) return
    const supabase = createClient()
    const { error } = await supabase
      .from('nm_tournament_matches')
      .update({ court_id: scoreForm.courtId ? Number(scoreForm.courtId) : null })
      .eq('id', selectedMatch.id)
    if (error) toast('error', error.message)
    else toast('success', 'Pista asignada')
    load()
  }

  // ─── Render ────────────────────────────────────────────────────────────────

  if (loading) return <div className="p-8 text-slate-400">Cargando torneo...</div>
  if (!tournament) return null

  const confirmedTeams = catTeams.filter(t => t.status === 'confirmed')
  const hasBracket = catMatches.length > 0

  return (
    <div className="space-y-6">
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3">
        <Link href="/admin/torneos" className="text-slate-400 hover:text-white">
          <ArrowLeft size={20} />
        </Link>
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-bold text-white flex items-center gap-2 flex-wrap">
            <Trophy className="text-cyan-400" /> {tournament.name}
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            {tournament.format}
            {tournament.start_date && ` · ${formatDate(tournament.start_date)}`}
            {tournament.end_date && ` → ${formatDate(tournament.end_date)}`}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {statusBadge(tournament.status)}
          <Link
            href={`/torneo/${tournament.id}`}
            target="_blank"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-300 bg-slate-700/50 hover:bg-slate-700 hover:text-white border border-slate-600/50 transition-colors"
          >
            <ExternalLink size={13} /> Público
          </Link>
          <Link
            href={`/torneo/${tournament.id}/live`}
            target="_blank"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-green-400 bg-green-500/10 hover:bg-green-500/20 border border-green-500/20 transition-colors"
          >
            <Monitor size={13} /> TV en Vivo
          </Link>
          <Link
            href={`/admin/torneos/${tournament.id}/pantalla`}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-amber-400 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/20 transition-colors"
          >
            <Settings size={13} /> Configurar
          </Link>
        </div>
      </div>

      {/* ── KPIs ───────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-cyan-500/10 text-cyan-400 flex items-center justify-center">
              <Users size={18} />
            </div>
            <div>
              <div className="text-xs text-slate-400">Equipos</div>
              <div className="text-xl font-bold text-white">{teams.length}</div>
            </div>
          </div>
        </Card>
        <Card>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-green-500/10 text-green-400 flex items-center justify-center">
              <Users size={18} />
            </div>
            <div>
              <div className="text-xs text-slate-400">Confirmados</div>
              <div className="text-xl font-bold text-white">{teams.filter(t => t.status === 'confirmed').length}</div>
            </div>
          </div>
        </Card>
        <Card>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-amber-500/10 text-amber-400 flex items-center justify-center">
              <Swords size={18} />
            </div>
            <div>
              <div className="text-xs text-slate-400">Partidos</div>
              <div className="text-xl font-bold text-white">{matches.length}</div>
            </div>
          </div>
        </Card>
        <Card>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
              <CalendarDays size={18} />
            </div>
            <div>
              <div className="text-xs text-slate-400">Completados</div>
              <div className="text-xl font-bold text-white">
                {matches.filter(m => m.status === 'completed' && !m.is_bye).length}
              </div>
            </div>
          </div>
        </Card>
      </div>

      {/* ── Category tabs ──────────────────────────────────────────────────── */}
      {categories.length > 1 && (
        <div className="flex gap-1 overflow-x-auto border-b border-slate-700/50 pb-px">
          {categories.map(cat => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={[
                'px-3 py-2 text-sm whitespace-nowrap transition-colors',
                activeCategory === cat
                  ? 'text-cyan-400 border-b-2 border-cyan-400'
                  : 'text-slate-400 hover:text-slate-200',
              ].join(' ')}
            >
              {cat}
              <span className="ml-1.5 text-xs text-slate-500">
                ({teams.filter(t => t.category === cat).length})
              </span>
            </button>
          ))}
        </div>
      )}

      {/* ── Main tabs ──────────────────────────────────────────────────────── */}
      <div className="flex gap-1 overflow-x-auto">
        {(['equipos', 'bracket', 'partidos'] as Tab[]).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={[
              'px-4 py-2 text-sm font-medium rounded-lg transition-colors',
              activeTab === tab
                ? 'bg-cyan-500/20 text-cyan-400'
                : 'text-slate-400 hover:text-white hover:bg-slate-800',
            ].join(' ')}
          >
            {tab === 'equipos' && 'Equipos'}
            {tab === 'bracket' && 'Bracket'}
            {tab === 'partidos' && 'Partidos'}
          </button>
        ))}
      </div>

      {/* ── Tab: Equipos ───────────────────────────────────────────────────── */}
      {activeTab === 'equipos' && (
        <Card>
          <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
            <h2 className="text-sm font-semibold text-white flex items-center gap-2">
              <Users size={16} className="text-cyan-400" />
              Equipos inscriptos
              {activeCategory && <Badge variant="cyan">{activeCategory}</Badge>}
            </h2>
          </div>

          {catTeams.length === 0 ? (
            <p className="text-sm text-slate-500 text-center py-8">No hay equipos inscriptos en esta categoria.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-slate-500 border-b border-slate-700/50 text-xs">
                    <th className="text-left py-2 pl-2">Equipo</th>
                    <th className="text-left py-2">Jugador 1</th>
                    <th className="text-left py-2">Jugador 2</th>
                    <th className="text-center py-2">Seed</th>
                    <th className="text-center py-2">Estado</th>
                    <th className="text-center py-2">Pagado</th>
                    <th className="text-right py-2 pr-2">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {catTeams.map(t => (
                    <tr key={t.id} className="border-b border-slate-800 hover:bg-slate-800/30">
                      <td className="py-2 pl-2 text-white font-medium">{t.team_name ?? '(sin nombre)'}</td>
                      <td className="py-2 text-slate-300">{t.player1_name}</td>
                      <td className="py-2 text-slate-300">{t.player2_name}</td>
                      <td className="py-2 text-center text-slate-400">{t.seed ?? '-'}</td>
                      <td className="py-2 text-center">{statusBadge(t.status)}</td>
                      <td className="py-2 text-center">
                        {t.paid
                          ? <Badge variant="success">Si</Badge>
                          : <Badge variant="warning">No</Badge>
                        }
                      </td>
                      <td className="py-2 pr-2 text-right">
                        <div className="flex items-center justify-end gap-1">
                          {t.status === 'registered' && (
                            <>
                              <Button
                                variant="ghost"
                                onClick={() => handleTeamStatus(t.id, 'confirmed')}
                                className="text-xs text-green-400 hover:text-green-300"
                              >
                                Confirmar
                              </Button>
                              <Button
                                variant="ghost"
                                onClick={() => handleTeamStatus(t.id, 'rejected')}
                                className="text-xs text-red-400 hover:text-red-300"
                              >
                                Rechazar
                              </Button>
                            </>
                          )}
                          {t.status === 'confirmed' && (
                            <Badge variant="success">Confirmado</Badge>
                          )}
                          {t.status === 'rejected' && (
                            <Button
                              variant="ghost"
                              onClick={() => handleTeamStatus(t.id, 'confirmed')}
                              className="text-xs text-green-400"
                            >
                              Re-confirmar
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      {/* ── Tab: Bracket ───────────────────────────────────────────────────── */}
      {activeTab === 'bracket' && (
        <div className="space-y-4">
          {/* Generate bracket button */}
          {!hasBracket && (
            <Card>
              <div className="flex flex-col items-center gap-4 py-8">
                <p className="text-sm text-slate-400 text-center">
                  No hay bracket generado para{' '}
                  <strong className="text-white">{activeCategory ?? 'esta categoria'}</strong>.
                  <br />
                  Hay {confirmedTeams.length} equipo(s) confirmado(s).
                </p>
                <Button
                  onClick={generateBracket}
                  disabled={generatingBracket || confirmedTeams.length < 2}
                  className="flex items-center gap-2"
                >
                  {generatingBracket
                    ? <Loader2 size={16} className="animate-spin" />
                    : <Swords size={16} />
                  }
                  Generar Bracket
                </Button>
                {confirmedTeams.length < 2 && (
                  <p className="text-xs text-amber-400">Se necesitan al menos 2 equipos confirmados.</p>
                )}
              </div>
            </Card>
          )}

          {/* Bracket display */}
          {hasBracket && (
            <div className="space-y-3">
              <BracketConfigPanel config={bracketConfig} onChange={setBracketConfig} />
              <Card>
                <TournamentBracket
                  matches={bracketMatches}
                  totalRounds={totalRounds}
                  onMatchClick={openScoreModal}
                  liveHighlight
                  config={bracketConfig}
                />
              </Card>
            </div>
          )}
        </div>
      )}

      {/* ── Tab: Partidos ──────────────────────────────────────────────────── */}
      {activeTab === 'partidos' && (
        <Card>
          <h2 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
            <Swords size={16} className="text-cyan-400" />
            Todos los partidos
            {activeCategory && <Badge variant="cyan">{activeCategory}</Badge>}
          </h2>
          {catMatches.length === 0 ? (
            <p className="text-sm text-slate-500 text-center py-8">No hay partidos. Genera el bracket primero.</p>
          ) : (
            <div className="space-y-2">
              {catMatches
                .filter(m => !m.is_bye)
                .map(m => {
                  const t1Name = m.team1?.team_name ?? teamById.get(m.team1_id ?? -1)?.team_name ?? 'Por definir'
                  const t2Name = m.team2?.team_name ?? teamById.get(m.team2_id ?? -1)?.team_name ?? 'Por definir'
                  const isLive = m.status === 'in_progress'
                  const isCompleted = m.status === 'completed'
                  const courtName = m.court_id ? courts.find(c => c.id === m.court_id)?.name : null

                  return (
                    <button
                      key={m.id}
                      onClick={() => {
                        const bm = bracketMatches.find(x => x.id === m.id)
                        if (bm) openScoreModal(bm)
                      }}
                      className={[
                        'w-full text-left rounded-lg border p-3 transition-colors',
                        isLive
                          ? 'border-emerald-500/40 bg-slate-800/70 hover:border-emerald-400'
                          : 'border-slate-700/50 bg-slate-800/30 hover:bg-slate-800/70 hover:border-cyan-500/30',
                      ].join(' ')}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs text-slate-500">{m.round ?? `R${m.round_number}`}</span>
                            {isLive && (
                              <span className="flex items-center gap-1 text-xs text-emerald-400">
                                <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                                En vivo
                              </span>
                            )}
                            {courtName && (
                              <span className="text-[10px] text-slate-500 bg-slate-700 rounded px-1.5 py-0.5">
                                {courtName}
                              </span>
                            )}
                          </div>
                          <div className="mt-1 flex items-center gap-2">
                            <span className={`text-sm ${m.winner_team_id === m.team1_id ? 'text-white font-bold' : 'text-slate-300'}`}>
                              {t1Name}
                            </span>
                            <span className="text-xs text-slate-500">vs</span>
                            <span className={`text-sm ${m.winner_team_id === m.team2_id ? 'text-white font-bold' : 'text-slate-300'}`}>
                              {t2Name}
                            </span>
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          {isCompleted && (
                            <div className="text-xs font-mono space-y-0.5">
                              <div className={m.winner_team_id === m.team1_id ? 'text-green-400 font-bold' : 'text-slate-400'}>
                                {[m.team1_set1, m.team1_set2, m.team1_set3].filter(v => v !== null).join(' - ')}
                              </div>
                              <div className={m.winner_team_id === m.team2_id ? 'text-green-400 font-bold' : 'text-slate-400'}>
                                {[m.team2_set1, m.team2_set2, m.team2_set3].filter(v => v !== null).join(' - ')}
                              </div>
                              {m.duration_seconds != null && (
                                <div className="text-[10px] text-slate-500">{formatDuration(m.duration_seconds)}</div>
                              )}
                            </div>
                          )}
                          {isLive && m.started_at && (
                            <LiveTimer startedAt={m.started_at} />
                          )}
                          {m.status === 'pending' && (
                            <Badge>Pendiente</Badge>
                          )}
                        </div>
                      </div>
                    </button>
                  )
                })}
            </div>
          )}
        </Card>
      )}

      {/* ── Score Entry Modal ──────────────────────────────────────────────── */}
      {selectedMatch && (
        <ScoreModal
          match={selectedMatch}
          teamById={teamById}
          courts={courts}
          scoreForm={scoreForm}
          setScoreForm={setScoreForm}
          saving={saving}
          onClose={() => setSelectedMatch(null)}
          onStart={startMatch}
          onFinish={finishMatch}
          onReopen={reopenMatch}
          onUpdateCourt={updateCourt}
        />
      )}
    </div>
  )
}

// ─── LiveTimer ────────────────────────────────────────────────────────────────

function LiveTimer({ startedAt }: { startedAt: string }) {
  const [elapsed, setElapsed] = useState('')
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    const tick = () => setElapsed(formatElapsedTimer(startedAt))
    tick()
    intervalRef.current = setInterval(tick, 1000)
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [startedAt])

  return (
    <span className="flex items-center gap-1 text-sm text-emerald-400 font-mono">
      <Clock size={14} />
      {elapsed}
    </span>
  )
}

// ─── ScoreModal ───────────────────────────────────────────────────────────────

interface ScoreModalProps {
  match: TournamentMatch
  teamById: Map<number, TournamentTeam>
  courts: Court[]
  scoreForm: { t1s1: string; t2s1: string; t1s2: string; t2s2: string; t1s3: string; t2s3: string; courtId: string }
  setScoreForm: React.Dispatch<React.SetStateAction<ScoreModalProps['scoreForm']>>
  saving: boolean
  onClose: () => void
  onStart: () => void
  onFinish: () => void
  onReopen: () => void
  onUpdateCourt: () => void
}

function ScoreModal({
  match, teamById, courts, scoreForm, setScoreForm,
  saving, onClose, onStart, onFinish, onReopen, onUpdateCourt,
}: ScoreModalProps) {
  const t1 = match.team1_id ? teamById.get(match.team1_id) : null
  const t2 = match.team2_id ? teamById.get(match.team2_id) : null
  const t1Name = match.team1?.team_name ?? t1?.team_name ?? 'Por definir'
  const t2Name = match.team2?.team_name ?? t2?.team_name ?? 'Por definir'

  const isPending = match.status === 'pending'
  const isLive = match.status === 'in_progress'
  const isCompleted = match.status === 'completed'

  const courtOptions = [
    { value: '', label: 'Sin pista' },
    ...courts.map(c => ({ value: c.id.toString(), label: c.name })),
  ]

  return (
    <Modal
      open
      onClose={onClose}
      title={`${t1Name} vs ${t2Name}`}
      size="md"
    >
      <div className="space-y-5">
        {/* Match info */}
        <div className="flex items-center gap-3 flex-wrap">
          <Badge variant="cyan">{match.round ?? `Ronda ${match.round_number}`}</Badge>
          {isPending && <Badge>Pendiente</Badge>}
          {isLive && (
            <Badge variant="success" className="flex items-center gap-1">
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
              En vivo
            </Badge>
          )}
          {isCompleted && <Badge variant="cyan">Completado</Badge>}
        </div>

        {/* ── Pending state ───────────────────────────────────────────────── */}
        {isPending && (
          <div className="flex flex-col items-center gap-4 py-6">
            <div className="text-center">
              <p className="text-lg text-white font-semibold">{t1Name}</p>
              <p className="text-slate-500 text-sm my-1">vs</p>
              <p className="text-lg text-white font-semibold">{t2Name}</p>
            </div>
            {!match.team1_id || !match.team2_id ? (
              <p className="text-sm text-slate-500">Esperando que se definan los equipos.</p>
            ) : (
              <Button
                onClick={onStart}
                disabled={saving}
                className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500"
              >
                {saving ? <Loader2 size={16} className="animate-spin" /> : <Play size={16} />}
                Iniciar Partido
              </Button>
            )}
            {/* Court selector */}
            <div className="w-full max-w-xs">
              <Select
                label="Pista"
                options={courtOptions}
                value={scoreForm.courtId}
                onChange={e => {
                  setScoreForm(f => ({ ...f, courtId: e.target.value }))
                  // auto-save court
                  setTimeout(onUpdateCourt, 100)
                }}
              />
            </div>
          </div>
        )}

        {/* ── In progress state ───────────────────────────────────────────── */}
        {isLive && (
          <>
            {/* Live timer */}
            {match.started_at && (
              <div className="flex items-center justify-center gap-2 py-3">
                <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl px-6 py-3 text-center">
                  <LiveTimer startedAt={match.started_at} />
                  <p className="text-[10px] text-slate-500 mt-1">Tiempo transcurrido</p>
                </div>
              </div>
            )}

            {/* Teams header */}
            <div className="grid grid-cols-3 gap-2 text-center text-xs text-slate-500">
              <div className="text-left text-white font-medium">{t1Name}</div>
              <div>Set</div>
              <div className="text-right text-white font-medium">{t2Name}</div>
            </div>

            {/* Score inputs */}
            {[1, 2, 3].map(setNum => (
              <div key={setNum} className="grid grid-cols-3 gap-2 items-center">
                <Input
                  type="number"
                  min="0"
                  max="9"
                  placeholder="-"
                  value={scoreForm[`t1s${setNum}` as keyof typeof scoreForm]}
                  onChange={e => setScoreForm(f => ({ ...f, [`t1s${setNum}`]: e.target.value }))}
                />
                <div className="text-center text-xs text-slate-400">
                  Set {setNum}
                  {setNum === 3 && <span className="block text-[10px] text-slate-600">(opcional)</span>}
                </div>
                <Input
                  type="number"
                  min="0"
                  max="9"
                  placeholder="-"
                  value={scoreForm[`t2s${setNum}` as keyof typeof scoreForm]}
                  onChange={e => setScoreForm(f => ({ ...f, [`t2s${setNum}`]: e.target.value }))}
                />
              </div>
            ))}

            {/* Court selector */}
            <div>
              <Select
                label="Pista"
                options={courtOptions}
                value={scoreForm.courtId}
                onChange={e => {
                  setScoreForm(f => ({ ...f, courtId: e.target.value }))
                  setTimeout(onUpdateCourt, 100)
                }}
              />
            </div>

            {/* Actions */}
            <div className="flex gap-2 justify-end pt-2">
              <Button variant="ghost" onClick={onClose} disabled={saving}>
                Cerrar
              </Button>
              <Button
                onClick={onFinish}
                disabled={saving}
                className="flex items-center gap-2 bg-red-600 hover:bg-red-500"
              >
                {saving ? <Loader2 size={16} className="animate-spin" /> : <Square size={16} />}
                Finalizar Partido
              </Button>
            </div>
          </>
        )}

        {/* ── Completed state ─────────────────────────────────────────────── */}
        {isCompleted && (
          <>
            {/* Final score display */}
            <div className="bg-slate-900/50 rounded-xl p-4">
              <div className="grid grid-cols-3 gap-2 text-center mb-3">
                <div className={`text-sm font-medium ${match.winner_team_id === match.team1_id ? 'text-green-400' : 'text-slate-400'}`}>
                  {t1Name}
                  {match.winner_team_id === match.team1_id && <span className="ml-1">&#10003;</span>}
                </div>
                <div className="text-xs text-slate-500">Resultado</div>
                <div className={`text-sm font-medium ${match.winner_team_id === match.team2_id ? 'text-green-400' : 'text-slate-400'}`}>
                  {t2Name}
                  {match.winner_team_id === match.team2_id && <span className="ml-1">&#10003;</span>}
                </div>
              </div>
              {[1, 2, 3].map(setNum => {
                const v1 = match[`team1_set${setNum}` as keyof TournamentMatch] as number | null
                const v2 = match[`team2_set${setNum}` as keyof TournamentMatch] as number | null
                if (v1 === null && v2 === null) return null
                return (
                  <div key={setNum} className="grid grid-cols-3 gap-2 text-center py-1">
                    <div className={`font-mono text-sm ${v1 !== null && v2 !== null && v1 > v2 ? 'text-white font-bold' : 'text-slate-500'}`}>
                      {v1 ?? '-'}
                    </div>
                    <div className="text-xs text-slate-600">Set {setNum}</div>
                    <div className={`font-mono text-sm ${v1 !== null && v2 !== null && v2 > v1 ? 'text-white font-bold' : 'text-slate-500'}`}>
                      {v2 ?? '-'}
                    </div>
                  </div>
                )
              })}

              {/* Duration */}
              {match.duration_seconds != null && (
                <div className="text-center mt-3 pt-3 border-t border-slate-700/50">
                  <span className="text-xs text-slate-500 flex items-center justify-center gap-1">
                    <Clock size={12} /> Duracion: {formatDuration(match.duration_seconds)}
                  </span>
                </div>
              )}

              {/* Sets summary */}
              <div className="text-center mt-2">
                <span className="text-xs text-slate-500">
                  Sets: {match.sets_team1} - {match.sets_team2} | Games: {match.games_team1} - {match.games_team2}
                </span>
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-2 justify-end pt-2">
              <Button variant="ghost" onClick={onClose}>
                Cerrar
              </Button>
              <Button
                variant="ghost"
                onClick={onReopen}
                disabled={saving}
                className="flex items-center gap-2 text-amber-400"
              >
                {saving ? <Loader2 size={14} className="animate-spin" /> : <RotateCcw size={14} />}
                Reabrir
              </Button>
            </div>
          </>
        )}
      </div>
    </Modal>
  )
}
