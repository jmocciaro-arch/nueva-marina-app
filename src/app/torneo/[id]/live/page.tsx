'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { TournamentBracket } from '@/components/tournament-bracket'
import type { BracketMatch } from '@/components/tournament-bracket'
import {
  Trophy,
  Loader2,
  RefreshCw,
  Tv2,
  Clock,
  Users,
  Repeat2,
  Play,
} from 'lucide-react'

// ─── Types ─────────────────────────────────────────────────────────────────────

interface Tournament {
  id: number
  name: string
  format: string
  start_date: string | null
  end_date: string | null
  status: string
  description: string | null
}

interface Category {
  id: number
  name: string
  gender: string | null
  sort_order: number
}

interface RawMatch {
  id: number
  tournament_id: number
  category_id: number
  round_number: number
  round: string
  bracket_position: number
  match_number: number
  team1_id: number | null
  team2_id: number | null
  team1_set1: number | null
  team1_set2: number | null
  team1_set3: number | null
  team2_set1: number | null
  team2_set2: number | null
  team2_set3: number | null
  sets_team1: number
  sets_team2: number
  winner_team_id: number | null
  status: string
  court_name: string | null
  started_at: string | null
  finished_at: string | null
  duration_seconds: number | null
  is_bye: boolean
  next_match_id: number | null
  team1: { id: number; team_name: string } | null
  team2: { id: number; team_name: string } | null
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

function toBracketMatch(m: RawMatch): BracketMatch {
  return {
    id: m.id,
    round_number: m.round_number,
    round: m.round,
    bracket_position: m.bracket_position,
    match_number: m.match_number,
    team1_id: m.team1_id,
    team2_id: m.team2_id,
    team1_name: m.team1?.team_name ?? null,
    team2_name: m.team2?.team_name ?? null,
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
    court_name: m.court_name,
    started_at: m.started_at,
    finished_at: m.finished_at,
    duration_seconds: m.duration_seconds,
    is_bye: m.is_bye,
    next_match_id: m.next_match_id,
  }
}

function formatElapsed(startedAt: string): string {
  const start = new Date(startedAt).getTime()
  const elapsed = Math.max(0, Math.floor((Date.now() - start) / 1000))
  const mm = Math.floor(elapsed / 60).toString().padStart(2, '0')
  const ss = (elapsed % 60).toString().padStart(2, '0')
  return `${mm}:${ss}`
}

function buildScore(
  s1: number | null,
  s2: number | null,
  s3: number | null
): string {
  return [s1, s2, s3]
    .filter((s) => s !== null)
    .join('  ')
}

// ─── LiveMatchCard ─────────────────────────────────────────────────────────────

function LiveMatchCard({ match }: { match: RawMatch }) {
  const [elapsed, setElapsed] = useState<string>('')

  useEffect(() => {
    if (!match.started_at) return
    const tick = () => setElapsed(formatElapsed(match.started_at!))
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [match.started_at])

  const t1Won = match.winner_team_id !== null && match.winner_team_id === match.team1_id
  const t2Won = match.winner_team_id !== null && match.winner_team_id === match.team2_id

  return (
    <div className="bg-slate-800/70 border border-emerald-500/40 rounded-2xl overflow-hidden min-w-[260px] max-w-[320px] flex-shrink-0 shadow-xl shadow-emerald-900/20">
      {/* Live badge */}
      <div className="flex items-center justify-between px-4 py-2 bg-emerald-500/10 border-b border-emerald-500/20">
        <span className="flex items-center gap-1.5 text-emerald-400 text-xs font-bold uppercase tracking-wider">
          <span className="inline-block w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          En vivo
        </span>
        {elapsed && (
          <span className="text-emerald-400/80 text-xs font-mono">{elapsed}</span>
        )}
      </div>

      {/* Court */}
      {match.court_name && (
        <div className="px-4 pt-2 text-[11px] text-slate-500 uppercase tracking-widest font-medium">
          {match.court_name}
        </div>
      )}

      {/* Teams + score */}
      <div className="px-4 py-3 space-y-2">
        {/* Team 1 */}
        <div className="flex items-center justify-between gap-3">
          <span className={`text-base font-semibold truncate ${t1Won ? 'text-white' : 'text-slate-300'}`}>
            {match.team1?.team_name ?? 'Por definir'}
          </span>
          <span className={`font-mono text-lg font-bold tabular-nums shrink-0 ${t1Won ? 'text-emerald-400' : 'text-slate-400'}`}>
            {buildScore(match.team1_set1, match.team1_set2, match.team1_set3) || '-'}
          </span>
        </div>

        <div className="h-px bg-slate-700/60" />

        {/* Team 2 */}
        <div className="flex items-center justify-between gap-3">
          <span className={`text-base font-semibold truncate ${t2Won ? 'text-white' : 'text-slate-300'}`}>
            {match.team2?.team_name ?? 'Por definir'}
          </span>
          <span className={`font-mono text-lg font-bold tabular-nums shrink-0 ${t2Won ? 'text-emerald-400' : 'text-slate-400'}`}>
            {buildScore(match.team2_set1, match.team2_set2, match.team2_set3) || '-'}
          </span>
        </div>
      </div>

      {/* Round label */}
      <div className="px-4 pb-3">
        <span className="text-[10px] uppercase tracking-widest text-slate-600">{match.round}</span>
      </div>
    </div>
  )
}

// ─── NextMatchCard ─────────────────────────────────────────────────────────────

function NextMatchCard({ match }: { match: RawMatch }) {
  return (
    <div className="bg-slate-900/70 border border-slate-700/60 rounded-2xl overflow-hidden min-w-[220px] max-w-[280px] flex-shrink-0 opacity-80">
      <div className="flex items-center gap-1.5 px-4 py-2 bg-slate-800/60 border-b border-slate-700/40">
        <Play className="w-3 h-3 text-slate-500" />
        <span className="text-slate-500 text-xs font-medium uppercase tracking-wider">Proximo</span>
      </div>
      {match.court_name && (
        <div className="px-4 pt-2 text-[11px] text-slate-600 uppercase tracking-widest font-medium">
          {match.court_name}
        </div>
      )}
      <div className="px-4 py-3 space-y-1.5">
        <p className="text-sm text-slate-300 truncate font-medium">
          {match.team1?.team_name ?? 'Por definir'}
        </p>
        <p className="text-xs text-slate-600">vs</p>
        <p className="text-sm text-slate-300 truncate font-medium">
          {match.team2?.team_name ?? 'Por definir'}
        </p>
      </div>
      <div className="px-4 pb-3">
        <span className="text-[10px] uppercase tracking-widest text-slate-600">{match.round}</span>
      </div>
    </div>
  )
}

// ─── Clock ─────────────────────────────────────────────────────────────────────

function LiveClock() {
  const [time, setTime] = useState('')

  useEffect(() => {
    const tick = () =>
      setTime(
        new Date().toLocaleTimeString('es-ES', {
          hour: '2-digit',
          minute: '2-digit',
        })
      )
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [])

  return (
    <span className="flex items-center gap-1.5 text-slate-400 text-sm font-mono tabular-nums">
      <Clock className="w-4 h-4 opacity-60" />
      {time}
    </span>
  )
}

// ─── Page ──────────────────────────────────────────────────────────────────────

const AUTO_CYCLE_INTERVAL = 30_000 // ms

export default function TorneoLivePage() {
  const params = useParams()
  const id = Number(params.id)

  const [tournament, setTournament] = useState<Tournament | null>(null)
  const [categories, setCategories] = useState<Category[]>([])
  const [matches, setMatches] = useState<RawMatch[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeCategory, setActiveCategory] = useState<number | null>(null)
  const [autoCycle, setAutoCycle] = useState(false)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)

  const activeCategoryRef = useRef(activeCategory)
  const categoriesRef = useRef(categories)
  activeCategoryRef.current = activeCategory
  categoriesRef.current = categories

  const supabase = createClient()

  const loadData = useCallback(async () => {
    const [{ data: t, error: tErr }, { data: c }, { data: m }] =
      await Promise.all([
        supabase.from('nm_tournaments').select('*').eq('id', id).single(),
        supabase
          .from('nm_tournament_categories')
          .select('id, name, gender, sort_order')
          .eq('tournament_id', id)
          .order('sort_order'),
        supabase
          .from('nm_tournament_matches')
          .select(
            '*, team1:nm_tournament_teams!team1_id(id, team_name), team2:nm_tournament_teams!team2_id(id, team_name)'
          )
          .eq('tournament_id', id)
          .order('round_number')
          .order('bracket_position'),
      ])

    if (tErr) {
      setError('No se pudo cargar el torneo.')
      setLoading(false)
      return
    }

    setTournament(t as Tournament)

    const cats = (c as Category[]) ?? []
    setCategories(cats)
    setMatches((m as RawMatch[]) ?? [])
    setLastUpdated(new Date())

    if (cats.length > 0 && activeCategoryRef.current === null) {
      setActiveCategory(cats[0].id)
    }

    setLoading(false)
  }, [id]) // eslint-disable-line react-hooks/exhaustive-deps

  // Initial load + realtime subscription
  useEffect(() => {
    loadData()

    const channel = supabase
      .channel(`torneo-live-${id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'nm_tournament_matches',
          filter: `tournament_id=eq.${id}`,
        },
        () => { loadData() }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [id]) // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-cycle through categories
  useEffect(() => {
    if (!autoCycle) return
    const interval = setInterval(() => {
      const cats = categoriesRef.current
      if (cats.length < 2) return
      const current = activeCategoryRef.current
      const idx = cats.findIndex((c) => c.id === current)
      const next = cats[(idx + 1) % cats.length]
      setActiveCategory(next.id)
    }, AUTO_CYCLE_INTERVAL)
    return () => clearInterval(interval)
  }, [autoCycle])

  // ─── Derived ─────────────────────────────────────────────────────────────────

  const filteredMatches = activeCategory
    ? matches.filter((m) => m.category_id === activeCategory)
    : matches

  const liveMatches = filteredMatches.filter((m) => m.status === 'in_progress')
  const nextMatches = filteredMatches
    .filter((m) => m.status === 'pending' && !m.is_bye && (m.team1_id || m.team2_id))
    .slice(0, 3)

  const bracketMatches: BracketMatch[] = filteredMatches.map(toBracketMatch)

  const totalRounds = bracketMatches.length > 0
    ? Math.max(...bracketMatches.map((m) => m.round_number))
    : 0

  // ─── Render ──────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#060d1a]">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-10 h-10 animate-spin text-cyan-500" />
          <p className="text-slate-500 text-sm">Cargando torneo...</p>
        </div>
      </div>
    )
  }

  if (error || !tournament) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#060d1a]">
        <p className="text-red-400 text-xl">{error ?? 'Torneo no encontrado.'}</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col bg-[#060d1a] text-slate-200 overflow-hidden">

      {/* ── Top bar ─────────────────────────────────────────────────────────── */}
      <header className="flex-shrink-0 flex items-center justify-between gap-4 px-6 py-3 bg-slate-900/80 border-b border-slate-800 backdrop-blur-sm">
        {/* Club + title */}
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex items-center justify-center w-9 h-9 rounded-full bg-cyan-500/15 text-cyan-400 flex-shrink-0">
            <Trophy className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] text-slate-500 uppercase tracking-widest font-medium leading-none mb-0.5">
              Nueva Marina Padel &amp; Sport
            </p>
            <h1 className="text-xl font-bold text-white leading-tight truncate">
              {tournament.name}
            </h1>
          </div>
        </div>

        {/* Right controls */}
        <div className="flex items-center gap-4 flex-shrink-0">
          <LiveClock />

          {/* Last updated indicator */}
          {lastUpdated && (
            <span className="hidden md:flex items-center gap-1 text-[11px] text-slate-600">
              <RefreshCw className="w-3 h-3" />
              {lastUpdated.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </span>
          )}

          {/* Auto-cycle toggle */}
          {categories.length > 1 && (
            <button
              onClick={() => setAutoCycle((v) => !v)}
              title={autoCycle ? 'Desactivar rotacion automatica' : 'Activar rotacion automatica (30s)'}
              className={`
                flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors
                ${autoCycle
                  ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/40'
                  : 'bg-slate-800 text-slate-500 border border-slate-700 hover:text-slate-300'}
              `}
            >
              <Repeat2 className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Auto</span>
            </button>
          )}

          {/* TV / live indicator */}
          <span className="flex items-center gap-1.5 text-xs text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-full border border-emerald-500/20">
            <Tv2 className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">En vivo</span>
          </span>
        </div>
      </header>

      {/* ── Category tabs ────────────────────────────────────────────────────── */}
      {categories.length > 1 && (
        <div className="flex-shrink-0 flex items-center gap-2 px-6 py-3 bg-slate-900/40 border-b border-slate-800/60 overflow-x-auto scrollbar-none">
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => { setActiveCategory(cat.id); setAutoCycle(false) }}
              className={`
                flex items-center gap-1.5 px-5 py-2 rounded-full text-sm font-semibold whitespace-nowrap transition-all
                ${activeCategory === cat.id
                  ? 'bg-cyan-500 text-white shadow-lg shadow-cyan-500/20'
                  : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white'}
              `}
            >
              <Users className="w-3.5 h-3.5" />
              {cat.name}
            </button>
          ))}
        </div>
      )}

      {/* ── Live matches strip ───────────────────────────────────────────────── */}
      {(liveMatches.length > 0 || nextMatches.length > 0) && (
        <div className="flex-shrink-0 px-6 py-4 border-b border-slate-800/60 bg-slate-950/40">
          <div className="flex gap-4 overflow-x-auto scrollbar-none pb-1">
            {liveMatches.map((m) => (
              <LiveMatchCard key={m.id} match={m} />
            ))}
            {liveMatches.length === 0 && nextMatches.length > 0 && nextMatches.map((m) => (
              <NextMatchCard key={m.id} match={m} />
            ))}
            {liveMatches.length > 0 && nextMatches.length > 0 && (
              <div className="flex items-center">
                <div className="h-full w-px bg-slate-800 mx-2" />
              </div>
            )}
            {liveMatches.length > 0 && nextMatches.map((m) => (
              <NextMatchCard key={m.id} match={m} />
            ))}
          </div>
        </div>
      )}

      {/* ── Bracket ─────────────────────────────────────────────────────────── */}
      <main className="flex-1 overflow-auto px-4 py-6">
        {bracketMatches.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-4 text-slate-600 py-24">
            <Trophy className="w-16 h-16 opacity-20" />
            <p className="text-lg">El cuadro todavia no tiene partidos.</p>
          </div>
        ) : (
          <TournamentBracket
            matches={bracketMatches}
            totalRounds={totalRounds}
            compact
            liveHighlight
          />
        )}
      </main>

    </div>
  )
}
