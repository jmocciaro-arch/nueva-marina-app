'use client'

import { useCallback, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/lib/auth-context'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Modal } from '@/components/ui/modal'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { useToast } from '@/components/ui/toast'
import { formatCurrency, formatDate, STATUS_LABELS } from '@/lib/utils'
import type { League, LeagueCategory, LeagueTeam } from '@/types'
import {
  Trophy,
  CalendarDays,
  Users,
  DollarSign,
  ShieldCheck,
  Layers,
  LayoutGrid,
  ListOrdered,
} from 'lucide-react'

// ─── tipos extendidos para joins ────────────────────────────────────────────

interface MyLeagueTeam extends LeagueTeam {
  nm_league_categories: LeagueCategory & {
    nm_leagues: League
  }
  group_name?: string
}

// ─── helpers ────────────────────────────────────────────────────────────────

function statusBadgeVariant(status: string): 'info' | 'success' | 'warning' | 'cyan' | 'default' {
  const map: Record<string, 'info' | 'success' | 'warning' | 'cyan' | 'default'> = {
    registration: 'info',
    active: 'success',
    playoffs: 'warning',
    finished: 'cyan',
  }
  return map[status] ?? 'default'
}

// ─── modal de inscripción ────────────────────────────────────────────────────

interface InscriptionModalProps {
  league: League
  userId: string
  userName: string
  onClose: () => void
  onSuccess: () => void
}

function InscriptionModal({ league, userId, userName, onClose, onSuccess }: InscriptionModalProps) {
  const { toast } = useToast()
  const [categories, setCategories] = useState<LeagueCategory[]>([])
  const [loadingCats, setLoadingCats] = useState(true)
  const [saving, setSaving] = useState(false)

  const [form, setForm] = useState({
    category_id: '',
    player1_position: 'drive',
    player2_name: '',
    player2_position: 'reves',
  })

  const loadCategories = useCallback(async () => {
    const supabase = createClient()
    const { data, error } = await supabase
      .from('nm_league_categories')
      .select('*')
      .eq('league_id', league.id)
      .in('status', ['registration', 'active'])
      .order('sort_order')

    if (error) {
      toast('error', 'No se pudieron cargar las categorías')
    } else {
      setCategories(data ?? [])
      if (data && data.length > 0) {
        setForm(prev => ({ ...prev, category_id: String(data[0].id) }))
      }
    }
    setLoadingCats(false)
  }, [league.id, toast])

  useEffect(() => {
    loadCategories()
  }, [loadCategories])

  const handleSubmit = useCallback(async () => {
    if (!form.category_id) {
      toast('warning', 'Seleccioná una categoría')
      return
    }
    if (!form.player2_name.trim()) {
      toast('warning', 'Ingresá el nombre del segundo jugador')
      return
    }

    setSaving(true)
    const supabase = createClient()
    const { error } = await supabase.from('nm_league_teams').insert({
      category_id: Number(form.category_id),
      player1_id: userId,
      player1_name: userName,
      player1_position: form.player1_position,
      player2_name: form.player2_name.trim(),
      player2_position: form.player2_position,
      is_active: true,
    })

    setSaving(false)

    if (error) {
      toast('error', error.message ?? 'Error al inscribirse')
    } else {
      toast('success', '¡Te inscribiste en la liga!')
      onSuccess()
    }
  }, [form, userId, userName, toast, onSuccess])

  const positionOptions = [
    { value: 'drive', label: 'Drive' },
    { value: 'reves', label: 'Revés' },
  ]

  const categoryOptions = categories.map(c => ({
    value: String(c.id),
    label: `${c.name} — ${c.gender}${c.level ? ` / ${c.level}` : ''}`,
  }))

  return (
    <Modal
      open
      onClose={onClose}
      title={`Inscribirse a ${league.name}`}
      size="md"
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} loading={saving} disabled={loadingCats}>
            Confirmar inscripción
          </Button>
        </>
      }
    >
      {loadingCats ? (
        <p className="text-slate-400 text-sm py-4 text-center">Cargando categorías...</p>
      ) : categories.length === 0 ? (
        <p className="text-slate-400 text-sm py-4 text-center">
          No hay categorías disponibles para inscripción.
        </p>
      ) : (
        <div className="space-y-4">
          <Select
            id="category"
            label="Categoría"
            options={categoryOptions}
            value={form.category_id}
            onChange={e => setForm(prev => ({ ...prev, category_id: e.target.value }))}
          />

          <Input
            id="player1_name"
            label="Tu nombre (Jugador 1)"
            value={userName}
            readOnly
            className="opacity-60 cursor-not-allowed"
          />

          <Select
            id="player1_position"
            label="Tu posición"
            options={positionOptions}
            value={form.player1_position}
            onChange={e => setForm(prev => ({ ...prev, player1_position: e.target.value }))}
          />

          <Input
            id="player2_name"
            label="Nombre del Jugador 2"
            placeholder="Nombre completo"
            value={form.player2_name}
            onChange={e => setForm(prev => ({ ...prev, player2_name: e.target.value }))}
          />

          <Select
            id="player2_position"
            label="Posición Jugador 2"
            options={positionOptions}
            value={form.player2_position}
            onChange={e => setForm(prev => ({ ...prev, player2_position: e.target.value }))}
          />

          {league.entry_fee > 0 && (
            <div className="rounded-lg bg-amber-500/10 border border-amber-500/20 px-4 py-3 text-sm text-amber-300">
              Cuota de inscripción: <strong>{formatCurrency(league.entry_fee)}</strong>. El pago se
              coordina con el club.
            </div>
          )}
        </div>
      )}
    </Modal>
  )
}

// ─── card liga disponible ────────────────────────────────────────────────────

interface AvailableLeagueCardProps {
  league: League
  onInscribirse: (league: League) => void
  alreadyIn: boolean
}

function AvailableLeagueCard({ league, onInscribirse, alreadyIn }: AvailableLeagueCardProps) {
  const statusInfo = STATUS_LABELS[league.status]

  return (
    <Card className="flex flex-col gap-4">
      {/* header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-white font-semibold text-base leading-tight">{league.name}</h3>
          {league.season && (
            <p className="text-slate-400 text-xs mt-0.5">{league.season}</p>
          )}
        </div>
        <Badge variant={statusBadgeVariant(league.status)}>
          {statusInfo?.label ?? league.status}
        </Badge>
      </div>

      {/* detalles */}
      <div className="grid grid-cols-2 gap-3 text-sm">
        {league.format && (
          <div className="flex items-center gap-2 text-slate-300">
            <LayoutGrid size={14} className="text-slate-500 shrink-0" />
            <span>{league.format}</span>
          </div>
        )}
        <div className="flex items-center gap-2 text-slate-300">
          <DollarSign size={14} className="text-slate-500 shrink-0" />
          <span>
            {league.entry_fee > 0 ? formatCurrency(league.entry_fee) : 'Gratuita'}
          </span>
        </div>
        {league.start_date && (
          <div className="flex items-center gap-2 text-slate-300">
            <CalendarDays size={14} className="text-slate-500 shrink-0" />
            <span>Inicio: {formatDate(league.start_date, { day: 'numeric', month: 'short', year: 'numeric' })}</span>
          </div>
        )}
        {league.end_date && (
          <div className="flex items-center gap-2 text-slate-300">
            <CalendarDays size={14} className="text-slate-500 shrink-0" />
            <span>Fin: {formatDate(league.end_date, { day: 'numeric', month: 'short', year: 'numeric' })}</span>
          </div>
        )}
        {league.registration_deadline && (
          <div className="flex items-center gap-2 text-slate-300">
            <CalendarDays size={14} className="text-amber-400 shrink-0" />
            <span className="text-amber-300">
              Cierre: {formatDate(league.registration_deadline, { day: 'numeric', month: 'short' })}
            </span>
          </div>
        )}
        {league.has_playoffs && (
          <div className="flex items-center gap-2 text-cyan-300">
            <Trophy size={14} className="shrink-0" />
            <span>Con playoffs</span>
          </div>
        )}
      </div>

      {/* footer */}
      <div className="flex items-center justify-between pt-1 border-t border-slate-700/50">
        {league.description && (
          <p className="text-slate-500 text-xs line-clamp-1 flex-1 mr-3">{league.description}</p>
        )}
        <div className="shrink-0 ml-auto">
          {alreadyIn ? (
            <Badge variant="success">Ya inscripto</Badge>
          ) : (
            <Button size="sm" onClick={() => onInscribirse(league)}>
              Inscribirse
            </Button>
          )}
        </div>
      </div>
    </Card>
  )
}

// ─── card mis ligas ──────────────────────────────────────────────────────────

interface MyLeagueCardProps {
  team: MyLeagueTeam
  userId: string
}

function MyLeagueCard({ team, userId }: MyLeagueCardProps) {
  const league = team.nm_league_categories?.nm_leagues
  const category = team.nm_league_categories
  const isPlayer1 = team.player1_id === userId

  return (
    <Card hover className="flex flex-col gap-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-white font-semibold text-base leading-tight">
            {league?.name ?? '—'}
          </h3>
          <p className="text-slate-400 text-xs mt-0.5">{league?.season}</p>
        </div>
        {league && (
          <Badge variant={statusBadgeVariant(league.status)}>
            {STATUS_LABELS[league.status]?.label ?? league.status}
          </Badge>
        )}
      </div>

      <div className="grid grid-cols-2 gap-2 text-sm">
        <div className="flex items-center gap-2 text-slate-300">
          <Layers size={14} className="text-slate-500 shrink-0" />
          <span>{category?.name ?? '—'}</span>
        </div>
        {team.group_name && (
          <div className="flex items-center gap-2 text-slate-300">
            <ListOrdered size={14} className="text-slate-500 shrink-0" />
            <span>Grupo {team.group_name}</span>
          </div>
        )}
        <div className="flex items-center gap-2 text-slate-300">
          <Users size={14} className="text-slate-500 shrink-0" />
          <span>
            {team.player1_name} / {team.player2_name}
          </span>
        </div>
        <div className="flex items-center gap-2 text-slate-300">
          <ShieldCheck size={14} className="text-slate-500 shrink-0" />
          <span className="capitalize">
            {isPlayer1 ? team.player1_position : team.player2_position}
          </span>
        </div>
      </div>

      {team.team_name && (
        <div className="pt-1 border-t border-slate-700/50">
          <p className="text-slate-400 text-xs">
            Equipo: <span className="text-slate-200 font-medium">{team.team_name}</span>
          </p>
        </div>
      )}
    </Card>
  )
}

// ─── página principal ────────────────────────────────────────────────────────

type TabKey = 'disponibles' | 'mis-ligas'

export default function MisLigasPage() {
  const { user, loading: authLoading } = useAuth()
  const { toast } = useToast()

  const [activeTab, setActiveTab] = useState<TabKey>('disponibles')
  const [availableLeagues, setAvailableLeagues] = useState<League[]>([])
  const [myTeams, setMyTeams] = useState<MyLeagueTeam[]>([])
  const [loadingAvailable, setLoadingAvailable] = useState(true)
  const [loadingMy, setLoadingMy] = useState(true)
  const [inscriptionLeague, setInscriptionLeague] = useState<League | null>(null)

  // ids de ligas en las que ya participa el usuario
  const myLeagueIds = new Set(
    myTeams.map(t => t.nm_league_categories?.nm_leagues?.id).filter(Boolean)
  )

  // ── carga ligas disponibles ──────────────────────────────────────────────
  const loadAvailable = useCallback(async () => {
    setLoadingAvailable(true)
    const supabase = createClient()
    const { data, error } = await supabase
      .from('nm_leagues')
      .select('*')
      .eq('club_id', 1)
      .in('status', ['registration', 'active'])
      .order('created_at', { ascending: false })

    if (error) {
      toast('error', 'No se pudieron cargar las ligas')
    } else {
      setAvailableLeagues(data ?? [])
    }
    setLoadingAvailable(false)
  }, [toast])

  // ── carga mis equipos ────────────────────────────────────────────────────
  const loadMyTeams = useCallback(async () => {
    if (!user) return
    setLoadingMy(true)
    const supabase = createClient()

    const [res1, res2] = await Promise.all([
      supabase
        .from('nm_league_teams')
        .select(`
          *,
          nm_league_categories (
            *,
            nm_leagues ( * )
          )
        `)
        .eq('player1_id', user.id),
      supabase
        .from('nm_league_teams')
        .select(`
          *,
          nm_league_categories (
            *,
            nm_leagues ( * )
          )
        `)
        .eq('player2_id', user.id),
    ])

    if (res1.error || res2.error) {
      toast('error', 'No se pudieron cargar tus inscripciones')
    } else {
      const combined = [...(res1.data ?? []), ...(res2.data ?? [])]
      // deduplicar por id
      const seen = new Set<number>()
      const unique = combined.filter(t => {
        if (seen.has(t.id)) return false
        seen.add(t.id)
        return true
      })
      setMyTeams(unique as MyLeagueTeam[])
    }
    setLoadingMy(false)
  }, [user, toast])

  useEffect(() => {
    if (!authLoading) {
      loadAvailable()
      loadMyTeams()
    }
  }, [authLoading, loadAvailable, loadMyTeams])

  // ── after successful inscription ─────────────────────────────────────────
  const handleInscriptionSuccess = useCallback(() => {
    setInscriptionLeague(null)
    loadMyTeams()
  }, [loadMyTeams])

  // ── tabs ──────────────────────────────────────────────────────────────────
  const tabs: { key: TabKey; label: string }[] = [
    { key: 'disponibles', label: 'Ligas Disponibles' },
    { key: 'mis-ligas', label: 'Mis Ligas' },
  ]

  // ── render ────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      {/* header */}
      <div>
        <h1 className="text-2xl font-bold text-white">Ligas</h1>
        <p className="text-sm text-slate-400 mt-1">
          Inscribite a una liga o seguí el estado de las tuyas
        </p>
      </div>

      {/* tabs */}
      <div className="flex gap-1 bg-slate-800/60 rounded-xl p-1 w-fit border border-slate-700/40">
        {tabs.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-5 py-2 rounded-lg text-sm font-medium transition-all ${
              activeTab === tab.key
                ? 'bg-cyan-600 text-white shadow'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            {tab.label}
            {tab.key === 'mis-ligas' && myTeams.length > 0 && (
              <span className="ml-2 inline-flex items-center justify-center w-4 h-4 rounded-full bg-white/10 text-xs">
                {myTeams.length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* contenido ── ligas disponibles */}
      {activeTab === 'disponibles' && (
        <>
          {loadingAvailable ? (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {[1, 2, 3].map(i => (
                <div
                  key={i}
                  className="h-48 rounded-xl bg-slate-800/50 border border-slate-700/50 animate-pulse"
                />
              ))}
            </div>
          ) : availableLeagues.length === 0 ? (
            <div className="rounded-xl border border-slate-700/50 bg-slate-800/50 p-12 text-center">
              <Trophy className="mx-auto mb-3 text-slate-600" size={36} />
              <p className="text-slate-400">No hay ligas abiertas en este momento</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {availableLeagues.map(league => (
                <AvailableLeagueCard
                  key={league.id}
                  league={league}
                  onInscribirse={setInscriptionLeague}
                  alreadyIn={myLeagueIds.has(league.id)}
                />
              ))}
            </div>
          )}
        </>
      )}

      {/* contenido ── mis ligas */}
      {activeTab === 'mis-ligas' && (
        <>
          {loadingMy ? (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {[1, 2].map(i => (
                <div
                  key={i}
                  className="h-40 rounded-xl bg-slate-800/50 border border-slate-700/50 animate-pulse"
                />
              ))}
            </div>
          ) : myTeams.length === 0 ? (
            <div className="rounded-xl border border-slate-700/50 bg-slate-800/50 p-12 text-center">
              <Users className="mx-auto mb-3 text-slate-600" size={36} />
              <p className="text-slate-400 mb-4">Todavía no estás inscripto en ninguna liga</p>
              <Button variant="outline" size="sm" onClick={() => setActiveTab('disponibles')}>
                Ver ligas disponibles
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {myTeams.map(team => (
                <MyLeagueCard key={team.id} team={team} userId={user?.id ?? ''} />
              ))}
            </div>
          )}
        </>
      )}

      {/* modal inscripción */}
      {inscriptionLeague && user && (
        <InscriptionModal
          league={inscriptionLeague}
          userId={user.id}
          userName={user.full_name ?? user.email}
          onClose={() => setInscriptionLeague(null)}
          onSuccess={handleInscriptionSuccess}
        />
      )}
    </div>
  )
}
