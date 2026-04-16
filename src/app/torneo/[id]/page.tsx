'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { TournamentBracket, BracketConfigPanel } from '@/components/tournament-bracket'
import type { BracketMatch, BracketConfig } from '@/components/tournament-bracket'
import {
  Trophy,
  CalendarDays,
  Loader2,
  Wifi,
  Tv2,
  Users,
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
  club_id: number
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
  started_at: string | null
  finished_at: string | null
  duration_seconds: number | null
  is_bye: boolean
  next_match_id: number | null
  team1: { id: number; team_name: string } | null
  team2: { id: number; team_name: string } | null
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

function formatDate(d: string | null) {
  if (!d) return null
  return new Date(d).toLocaleDateString('es-ES', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

function statusLabel(s: string) {
  switch (s) {
    case 'draft': return { label: 'Borrador', color: 'text-slate-400 bg-slate-800' }
    case 'registration_open': return { label: 'Inscripciones abiertas', color: 'text-blue-400 bg-blue-900/30' }
    case 'in_progress': return { label: 'En curso', color: 'text-emerald-400 bg-emerald-900/30' }
    case 'completed': return { label: 'Finalizado', color: 'text-slate-400 bg-slate-800' }
    default: return { label: s, color: 'text-slate-400 bg-slate-800' }
  }
}

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
    court_name: null,
    started_at: m.started_at,
    finished_at: m.finished_at,
    duration_seconds: m.duration_seconds,
    is_bye: m.is_bye,
    next_match_id: m.next_match_id,
  }
}

// ─── Page ──────────────────────────────────────────────────────────────────────

export default function TorneoPublicPage() {
  const params = useParams()
  const id = Number(params.id)

  const [tournament, setTournament] = useState<Tournament | null>(null)
  const [categories, setCategories] = useState<Category[]>([])
  const [matches, setMatches] = useState<RawMatch[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeCategory, setActiveCategory] = useState<number | null>(null)
  const [bracketConfig, setBracketConfig] = useState<BracketConfig>({
    viewMode: 'tree', theme: 'dark', cardSize: 'md',
    showScores: true, showTimers: true, showCourts: true,
    showRoundHeaders: true, showByes: true, animationsEnabled: true,
  })

  const supabase = createClient()

  const loadData = useCallback(async () => {
    const [{ data: t, error: tErr }, { data: c, error: cErr }, { data: m, error: mErr }] =
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

    if (tErr) { setError('No se pudo cargar el torneo.'); setLoading(false); return }

    setTournament(t as Tournament)

    const cats = (c as Category[]) ?? []
    setCategories(cats)
    if (cats.length > 0 && activeCategory === null) {
      setActiveCategory(cats[0].id)
    }

    setMatches((m as RawMatch[]) ?? [])
    setLoading(false)
  }, [id]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    loadData()

    const channel = supabase
      .channel(`torneo-public-${id}`)
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

  // ─── Derived ───────────────────────────────────────────────────────────────

  const filteredMatches = activeCategory
    ? matches.filter((m) => m.category_id === activeCategory)
    : matches

  const bracketMatches: BracketMatch[] = filteredMatches.map(toBracketMatch)

  const totalRounds = bracketMatches.length > 0
    ? Math.max(...bracketMatches.map((m) => m.round_number))
    : 0

  // ─── Render ────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0b1120]">
        <Loader2 className="w-8 h-8 animate-spin text-cyan-500" />
      </div>
    )
  }

  if (error || !tournament) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0b1120]">
        <p className="text-red-400 text-lg">{error ?? 'Torneo no encontrado.'}</p>
      </div>
    )
  }

  const status = statusLabel(tournament.status)

  return (
    <div className="min-h-screen bg-[#0b1120] text-slate-200">
      {/* Header */}
      <div className="border-b border-slate-800 bg-slate-900/60 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-cyan-500/10 text-cyan-400">
              <Trophy className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-white leading-tight">{tournament.name}</h1>
              <p className="text-xs text-slate-500 capitalize">{tournament.format}</p>
            </div>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            {(tournament.start_date || tournament.end_date) && (
              <span className="flex items-center gap-1.5 text-xs text-slate-400">
                <CalendarDays className="w-3.5 h-3.5" />
                {formatDate(tournament.start_date)}
                {tournament.end_date && tournament.end_date !== tournament.start_date && (
                  <> &ndash; {formatDate(tournament.end_date)}</>
                )}
              </span>
            )}
            <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${status.color}`}>
              {status.label}
            </span>
            <a
              href={`/torneo/${id}/live`}
              className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/20 transition-colors"
            >
              <Tv2 className="w-3.5 h-3.5" />
              Vista TV
            </a>
          </div>
        </div>
      </div>

      {/* Category tabs */}
      {categories.length > 1 && (
        <div className="max-w-7xl mx-auto px-4 pt-4">
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
            {categories.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setActiveCategory(cat.id)}
                className={`
                  flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors
                  ${activeCategory === cat.id
                    ? 'bg-cyan-500 text-white'
                    : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-slate-200'}
                `}
              >
                <Users className="w-3.5 h-3.5" />
                {cat.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Bracket */}
      <div className="max-w-7xl mx-auto px-4 py-6">
        {bracketMatches.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 gap-3 text-slate-500">
            <Trophy className="w-10 h-10 opacity-30" />
            <p className="text-sm">El cuadro todavia no tiene partidos.</p>
          </div>
        ) : (
          <div className="space-y-4">
            <BracketConfigPanel config={bracketConfig} onChange={setBracketConfig} />
            <TournamentBracket
              matches={bracketMatches}
              totalRounds={totalRounds}
              liveHighlight
              config={bracketConfig}
            />
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="border-t border-slate-800 py-4 px-4 text-center">
        <p className="text-xs text-slate-600">
          Nueva Marina Padel &amp; Sport &mdash; resultados en tiempo real
        </p>
      </div>
    </div>
  )
}
