'use client'

import { useCallback, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/lib/auth-context'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Modal } from '@/components/ui/modal'
import { useToast } from '@/components/ui/toast'
import { formatCurrency, formatDate, STATUS_LABELS } from '@/lib/utils'
import type { Tournament, TournamentTeam } from '@/types'
import {
  Trophy,
  Calendar,
  Users,
  DollarSign,
  ChevronRight,
  Loader2,
  ClipboardList,
  GitBranch,
} from 'lucide-react'
import Link from 'next/link'

// ─── Constantes ─────────────────────────────────────────────────────────────

const CLUB_ID = 1

const FORMAT_LABELS: Record<string, string> = {
  eliminacion_directa: 'Eliminación Directa',
  americano: 'Americano',
  mexicano: 'Mexicano',
  round_robin: 'Round Robin',
  premier: 'Premier',
}

const TEAM_STATUS_LABELS: Record<string, { label: string; variant: 'default' | 'success' | 'warning' | 'danger' | 'info' | 'cyan' }> = {
  registered: { label: 'Registrado', variant: 'info' },
  confirmed:  { label: 'Confirmado', variant: 'success' },
  eliminated: { label: 'Eliminado',  variant: 'danger' },
  winner:     { label: 'Ganador',    variant: 'cyan' },
}

// ─── Tipos extendidos ────────────────────────────────────────────────────────

interface TournamentWithCount extends Tournament {
  teams_count: number
}

interface MyTeam extends TournamentTeam {
  tournament: Tournament
}

// ─── Componente principal ────────────────────────────────────────────────────

export default function MisTorneosPage() {
  const { user } = useAuth()
  const { toast } = useToast()

  const [activeTab, setActiveTab] = useState<'disponibles' | 'inscripciones'>('disponibles')

  // Torneos disponibles
  const [tournaments, setTournaments] = useState<TournamentWithCount[]>([])
  const [loadingTournaments, setLoadingTournaments] = useState(true)

  // Mis inscripciones
  const [myTeams, setMyTeams] = useState<MyTeam[]>([])
  const [loadingMyTeams, setLoadingMyTeams] = useState(true)

  // Modal de inscripción
  const [selectedTournament, setSelectedTournament] = useState<TournamentWithCount | null>(null)
  const [player2Name, setPlayer2Name] = useState('')
  const [teamName, setTeamName] = useState('')
  const [saving, setSaving] = useState(false)

  // ── Carga de torneos disponibles ──────────────────────────────────────────

  const loadTournaments = useCallback(async () => {
    setLoadingTournaments(true)
    const supabase = createClient()

    const { data, error } = await supabase
      .from('nm_tournaments')
      .select('*')
      .eq('club_id', CLUB_ID)
      .in('status', ['registration', 'active'])
      .order('start_date', { ascending: true })

    if (error) {
      toast('error', 'No se pudieron cargar los torneos')
      setLoadingTournaments(false)
      return
    }

    // Para cada torneo, contar los equipos inscriptos
    const enriched: TournamentWithCount[] = await Promise.all(
      (data ?? []).map(async (t) => {
        const supabaseCount = createClient()
        const { count } = await supabaseCount
          .from('nm_tournament_teams')
          .select('*', { count: 'exact', head: true })
          .eq('tournament_id', t.id)
        return { ...t, teams_count: count ?? 0 }
      })
    )

    setTournaments(enriched)
    setLoadingTournaments(false)
  }, [toast])

  // ── Carga de mis inscripciones ────────────────────────────────────────────

  const loadMyTeams = useCallback(async () => {
    if (!user) return
    setLoadingMyTeams(true)
    const supabase = createClient()

    const { data: p1, error: e1 } = await supabase
      .from('nm_tournament_teams')
      .select('*, tournament:nm_tournaments(*)')
      .eq('player1_id', user.id)

    const { data: p2, error: e2 } = await supabase
      .from('nm_tournament_teams')
      .select('*, tournament:nm_tournaments(*)')
      .eq('player2_id', user.id)

    if (e1 || e2) {
      toast('error', 'No se pudieron cargar tus inscripciones')
      setLoadingMyTeams(false)
      return
    }

    // Unir y deduplicar por id
    const combined = [...(p1 ?? []), ...(p2 ?? [])]
    const seen = new Set<number>()
    const unique: MyTeam[] = []
    for (const row of combined) {
      if (!seen.has(row.id)) {
        seen.add(row.id)
        unique.push(row as MyTeam)
      }
    }

    unique.sort((a, b) =>
      new Date(b.registered_at).getTime() - new Date(a.registered_at).getTime()
    )

    setMyTeams(unique)
    setLoadingMyTeams(false)
  }, [user, toast])

  useEffect(() => {
    loadTournaments()
  }, [loadTournaments])

  useEffect(() => {
    if (activeTab === 'inscripciones') {
      loadMyTeams()
    }
  }, [activeTab, loadMyTeams])

  // ── Inscripción ───────────────────────────────────────────────────────────

  const handleInscribirse = useCallback(async () => {
    if (!user || !selectedTournament) return
    if (!player2Name.trim()) {
      toast('warning', 'Ingresá el nombre de tu compañero/a')
      return
    }

    setSaving(true)
    const supabase = createClient()

    const player1Name =
      user.full_name ||
      [user.first_name, user.last_name].filter(Boolean).join(' ') ||
      user.email

    const { error } = await supabase.from('nm_tournament_teams').insert({
      tournament_id: selectedTournament.id,
      team_name: teamName.trim() || `${player1Name} / ${player2Name.trim()}`,
      player1_id: user.id,
      player1_name: player1Name,
      player2_name: player2Name.trim(),
      status: 'registered',
      paid: false,
    })

    setSaving(false)

    if (error) {
      if (error.code === '23505') {
        toast('error', 'Ya estás inscripto en este torneo')
      } else {
        toast('error', 'Error al inscribirse. Intentá de nuevo.')
      }
      return
    }

    toast('success', `¡Te inscribiste en ${selectedTournament.name}!`)
    setSelectedTournament(null)
    setPlayer2Name('')
    setTeamName('')
    loadTournaments()
    loadMyTeams()
  }, [user, selectedTournament, player2Name, teamName, toast, loadTournaments, loadMyTeams])

  const openModal = useCallback((t: TournamentWithCount) => {
    setSelectedTournament(t)
    setPlayer2Name('')
    setTeamName('')
  }, [])

  const closeModal = useCallback(() => {
    setSelectedTournament(null)
    setPlayer2Name('')
    setTeamName('')
  }, [])

  // ── Helpers UI ────────────────────────────────────────────────────────────

  const player1DisplayName =
    user?.full_name ||
    [user?.first_name, user?.last_name].filter(Boolean).join(' ') ||
    user?.email ||
    ''

  function statusBadgeVariant(status: string): 'default' | 'success' | 'warning' | 'danger' | 'info' | 'cyan' {
    const map: Record<string, 'default' | 'success' | 'warning' | 'danger' | 'info' | 'cyan'> = {
      registration: 'info',
      active: 'success',
      playoffs: 'warning',
      finished: 'cyan',
      cancelled: 'danger',
      draft: 'default',
    }
    return map[status] ?? 'default'
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">Mis Torneos</h1>
        <p className="text-sm text-slate-400 mt-1">
          Inscribite en torneos y seguí tus participaciones
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-800/60 rounded-xl p-1 w-fit border border-slate-700/50">
        <button
          onClick={() => setActiveTab('disponibles')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            activeTab === 'disponibles'
              ? 'bg-cyan-600 text-white'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <Trophy size={15} />
          Torneos Disponibles
        </button>
        <button
          onClick={() => setActiveTab('inscripciones')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            activeTab === 'inscripciones'
              ? 'bg-cyan-600 text-white'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <ClipboardList size={15} />
          Mis Inscripciones
        </button>
      </div>

      {/* ── Tab: Torneos disponibles ── */}
      {activeTab === 'disponibles' && (
        <div>
          {loadingTournaments ? (
            <div className="flex items-center justify-center py-16 text-slate-400">
              <Loader2 size={24} className="animate-spin mr-2" />
              Cargando torneos...
            </div>
          ) : tournaments.length === 0 ? (
            <div className="rounded-xl border border-slate-700/50 bg-slate-800/50 p-12 text-center">
              <Trophy size={40} className="mx-auto mb-3 text-slate-600" />
              <p className="text-slate-400">No hay torneos disponibles por el momento</p>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {tournaments.map((t) => (
                <TournamentCard
                  key={t.id}
                  tournament={t}
                  onInscribirse={() => openModal(t)}
                  statusVariant={statusBadgeVariant(t.status)}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Tab: Mis inscripciones ── */}
      {activeTab === 'inscripciones' && (
        <div>
          {loadingMyTeams ? (
            <div className="flex items-center justify-center py-16 text-slate-400">
              <Loader2 size={24} className="animate-spin mr-2" />
              Cargando inscripciones...
            </div>
          ) : myTeams.length === 0 ? (
            <div className="rounded-xl border border-slate-700/50 bg-slate-800/50 p-12 text-center">
              <ClipboardList size={40} className="mx-auto mb-3 text-slate-600" />
              <p className="text-slate-400">Todavía no estás inscripto en ningún torneo</p>
              <p className="text-sm text-slate-500 mt-1">
                Explorá los torneos disponibles y anotate con tu compañero
              </p>
              <Button
                variant="outline"
                size="sm"
                className="mt-4"
                onClick={() => setActiveTab('disponibles')}
              >
                Ver torneos disponibles
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {myTeams.map((team) => (
                <MyTeamRow key={team.id} team={team} userId={user?.id ?? ''} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Modal de inscripción ── */}
      <Modal
        open={!!selectedTournament}
        onClose={closeModal}
        title="Inscribirse al torneo"
        size="sm"
        footer={
          <>
            <Button variant="outline" onClick={closeModal} disabled={saving}>
              Cancelar
            </Button>
            <Button onClick={handleInscribirse} loading={saving}>
              Confirmar inscripción
            </Button>
          </>
        }
      >
        {selectedTournament && (
          <div className="space-y-5">
            {/* Info del torneo */}
            <div className="rounded-lg bg-slate-700/40 border border-slate-600/40 p-4 space-y-1">
              <p className="font-semibold text-white">{selectedTournament.name}</p>
              <p className="text-sm text-slate-400">
                {FORMAT_LABELS[selectedTournament.format] ?? selectedTournament.format}
              </p>
              {selectedTournament.entry_fee > 0 && (
                <p className="text-sm text-cyan-400 font-medium">
                  Inscripción: {formatCurrency(selectedTournament.entry_fee)}
                </p>
              )}
            </div>

            {/* Jugador 1 (auto) */}
            <Input
              label="Tu nombre (Jugador 1)"
              value={player1DisplayName}
              readOnly
              className="opacity-60 cursor-not-allowed"
            />

            {/* Jugador 2 */}
            <Input
              label="Nombre del compañero/a (Jugador 2)"
              placeholder="Ej: María García"
              value={player2Name}
              onChange={(e) => setPlayer2Name(e.target.value)}
              autoFocus
            />

            {/* Nombre del equipo (opcional) */}
            <Input
              label="Nombre del equipo (opcional)"
              placeholder={
                player2Name
                  ? `${player1DisplayName} / ${player2Name}`
                  : 'Se generará automáticamente'
              }
              value={teamName}
              onChange={(e) => setTeamName(e.target.value)}
            />
          </div>
        )}
      </Modal>
    </div>
  )
}

// ─── Subcomponente: TournamentCard ───────────────────────────────────────────

interface TournamentCardProps {
  tournament: TournamentWithCount
  onInscribirse: () => void
  statusVariant: 'default' | 'success' | 'warning' | 'danger' | 'info' | 'cyan'
}

function TournamentCard({ tournament: t, onInscribirse, statusVariant }: TournamentCardProps) {
  const statusInfo = STATUS_LABELS[t.status]
  const formatLabel = FORMAT_LABELS[t.format] ?? t.format

  return (
    <Card className="flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-white truncate">{t.name}</h3>
          <p className="text-xs text-slate-400 mt-0.5">{formatLabel}</p>
        </div>
        <Badge variant={statusVariant}>
          {statusInfo?.label ?? t.status}
        </Badge>
      </div>

      {/* Detalles */}
      <div className="space-y-2 text-sm text-slate-400">
        {(t.start_date || t.end_date) && (
          <div className="flex items-center gap-2">
            <Calendar size={14} className="text-slate-500 shrink-0" />
            <span>
              {t.start_date ? formatDate(t.start_date) : '—'}
              {t.end_date && t.end_date !== t.start_date && (
                <> &rarr; {formatDate(t.end_date)}</>
              )}
            </span>
          </div>
        )}

        <div className="flex items-center gap-2">
          <Users size={14} className="text-slate-500 shrink-0" />
          <span>
            {t.teams_count} equipo{t.teams_count !== 1 ? 's' : ''} inscriptos
            {t.max_teams ? ` / ${t.max_teams} máx.` : ''}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <DollarSign size={14} className="text-slate-500 shrink-0" />
          <span>
            {t.entry_fee > 0 ? formatCurrency(t.entry_fee) : 'Gratis'}
            {t.prize_pool > 0 && (
              <span className="ml-2 text-amber-400">
                · Premio: {formatCurrency(t.prize_pool)}
              </span>
            )}
          </span>
        </div>
      </div>

      {/* Botones */}
      <div className="mt-auto pt-2 flex gap-2">
        <Link
          href={`/torneo/${t.id}`}
          className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-cyan-400 bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/20 transition-colors"
        >
          <GitBranch size={13} /> Bracket
        </Link>
        <Button
          size="sm"
          className="flex-1"
          onClick={onInscribirse}
          disabled={
            !!(t.max_teams && t.teams_count >= t.max_teams)
          }
        >
          {t.max_teams && t.teams_count >= t.max_teams
            ? 'Cupos completos'
            : 'Inscribirse'}
          {!(t.max_teams && t.teams_count >= t.max_teams) && (
            <ChevronRight size={14} />
          )}
        </Button>
      </div>
    </Card>
  )
}

// ─── Subcomponente: MyTeamRow ────────────────────────────────────────────────

interface MyTeamRowProps {
  team: MyTeam
  userId: string
}

function MyTeamRow({ team, userId }: MyTeamRowProps) {
  const isPlayer1 = team.player1_id === userId
  const partnerName = isPlayer1 ? team.player2_name : team.player1_name
  const teamStatusInfo = TEAM_STATUS_LABELS[team.status] ?? { label: team.status, variant: 'default' as const }
  const tournamentStatusInfo = STATUS_LABELS[team.tournament?.status ?? '']

  return (
    <Card className="flex flex-col sm:flex-row sm:items-center gap-4">
      {/* Ícono */}
      <div className="hidden sm:flex items-center justify-center w-10 h-10 rounded-lg bg-cyan-500/10 text-cyan-400 shrink-0">
        <Trophy size={18} />
      </div>

      {/* Info principal */}
      <div className="flex-1 min-w-0 space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-semibold text-white">
            {team.team_name || `${team.player1_name} / ${team.player2_name}`}
          </span>
          <Badge variant={teamStatusInfo.variant}>{teamStatusInfo.label}</Badge>
          {team.paid && (
            <Badge variant="success">Pagado</Badge>
          )}
        </div>
        <p className="text-sm text-slate-400 truncate">
          {team.tournament?.name ?? '—'}
          {tournamentStatusInfo && (
            <span className="ml-2 text-xs">· {tournamentStatusInfo.label}</span>
          )}
        </p>
        <p className="text-xs text-slate-500">
          Compañero/a: <span className="text-slate-300">{partnerName}</span>
          {team.tournament?.start_date && (
            <span className="ml-3">
              Inicio: {formatDate(team.tournament.start_date)}
            </span>
          )}
        </p>
      </div>
    </Card>
  )
}
