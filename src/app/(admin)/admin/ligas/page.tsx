'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import {
  Trophy,
  Plus,
  Pencil,
  Trash2,
  CalendarDays,
  CircleDollarSign,
  Award,
  Users,
  ChevronRight,
  FileSpreadsheet,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useRealtimeRefresh } from '@/hooks/use-realtime-refresh'
import { KpiCard } from '@/components/ui/kpi-card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Modal } from '@/components/ui/modal'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { useToast } from '@/components/ui/toast'
import { formatCurrency, formatDate, STATUS_LABELS } from '@/lib/utils'
import { CompetitionCoverField } from '@/components/competition-cover-field'
import { formatsForScope, getFormat } from '@/lib/tournament-formats'
import type { League } from '@/types'

// ─── Constantes ─────────────────────────────────────────────────────────────

const CLUB_ID = 1
const SPORT_ID = 1

type LeagueStatus = League['status']

const STATUS_TABS: { value: LeagueStatus | 'all'; label: string }[] = [
  { value: 'all', label: 'Todos' },
  { value: 'draft', label: 'Borrador' },
  { value: 'registration', label: 'Inscripción' },
  { value: 'active', label: 'En Curso' },
  { value: 'playoffs', label: 'Playoffs' },
  { value: 'finished', label: 'Finalizado' },
]

const FORMAT_OPTIONS = formatsForScope('league').map(f => ({
  value: f.value,
  label: f.ready ? f.label : `${f.label} (próximamente)`,
}))

const STATUS_OPTIONS: { value: LeagueStatus; label: string }[] = [
  { value: 'draft', label: 'Borrador' },
  { value: 'registration', label: 'Inscripción' },
  { value: 'active', label: 'En Curso' },
  { value: 'playoffs', label: 'Playoffs' },
  { value: 'finished', label: 'Finalizado' },
]

const SETS_OPTIONS = [
  { value: '1', label: '1 set' },
  { value: '2', label: '2 sets' },
  { value: '3', label: '3 sets' },
]

const GAMES_OPTIONS = [
  { value: '4', label: '4 juegos' },
  { value: '6', label: '6 juegos' },
  { value: '7', label: '7 juegos' },
]

// ─── Tipos del formulario ───────────────────────────────────────────────────

interface LeagueForm {
  name: string
  format: string
  season: string
  start_date: string
  end_date: string
  registration_deadline: string
  entry_fee: string
  description: string
  sets_to_win: string
  games_per_set: string
  golden_point: boolean
  has_playoffs: boolean
  status: LeagueStatus
  cover_image_url: string
}

const DEFAULT_FORM: LeagueForm = {
  name: '',
  format: 'round_robin',
  season: '',
  start_date: '',
  end_date: '',
  registration_deadline: '',
  entry_fee: '0',
  description: '',
  sets_to_win: '2',
  games_per_set: '6',
  golden_point: false,
  has_playoffs: false,
  status: 'draft',
  cover_image_url: '',
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function statusBadgeVariant(status: LeagueStatus) {
  const map: Record<LeagueStatus, 'default' | 'info' | 'success' | 'warning' | 'cyan'> = {
    draft: 'default',
    registration: 'info',
    active: 'success',
    playoffs: 'warning',
    finished: 'cyan',
  }
  return map[status] ?? 'default'
}

function leagueToForm(league: League): LeagueForm {
  return {
    name: league.name,
    format: league.format,
    season: league.season ?? '',
    start_date: league.start_date ?? '',
    end_date: league.end_date ?? '',
    registration_deadline: league.registration_deadline ?? '',
    entry_fee: String(league.entry_fee),
    description: league.description ?? '',
    sets_to_win: String(league.sets_to_win),
    games_per_set: String(league.games_per_set),
    golden_point: league.golden_point,
    has_playoffs: league.has_playoffs,
    status: league.status,
    cover_image_url: (league as unknown as Record<string, unknown>).cover_image_url as string ?? '',
  }
}

// ─── Componente principal ────────────────────────────────────────────────────

export default function GestionLigasPage() {
  const { toast } = useToast()
  const [leagues, setLeagues] = useState<League[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<LeagueStatus | 'all'>('all')

  // Modales
  const [showCreate, setShowCreate] = useState(false)
  const [editingLeague, setEditingLeague] = useState<League | null>(null)
  const [deletingLeague, setDeletingLeague] = useState<League | null>(null)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)

  // Form
  const [form, setForm] = useState<LeagueForm>(DEFAULT_FORM)

  // ─── Carga de datos ──────────────────────────────────────────────────────

  const loadLeagues = useCallback(async () => {
    const supabase = createClient()
    setLoading(true)
    const { data, error } = await supabase
      .from('nm_leagues')
      .select('*')
      .eq('club_id', CLUB_ID)
      .order('created_at', { ascending: false })

    if (error) {
      toast('error', 'Error al cargar las ligas')
    } else {
      setLeagues((data ?? []) as League[])
    }
    setLoading(false)
  }, [toast])

  useEffect(() => {
    loadLeagues()
  }, [loadLeagues])

  // Auto-refresh: Realtime + focus
  useRealtimeRefresh(['nm_leagues'], loadLeagues)

  // ─── KPIs ────────────────────────────────────────────────────────────────

  const total = leagues.length
  const activas = leagues.filter(l => l.status === 'active').length
  const enInscripcion = leagues.filter(l => l.status === 'registration').length

  // ─── Filtro por tab ──────────────────────────────────────────────────────

  const filtradas = activeTab === 'all'
    ? leagues
    : leagues.filter(l => l.status === activeTab)

  // ─── Handlers form ───────────────────────────────────────────────────────

  function setField<K extends keyof LeagueForm>(key: K, value: LeagueForm[K]) {
    setForm(prev => ({ ...prev, [key]: value }))
  }

  function openCreate() {
    setForm(DEFAULT_FORM)
    setShowCreate(true)
  }

  function openEdit(league: League) {
    setForm(leagueToForm(league))
    setEditingLeague(league)
  }

  function closeModals() {
    setShowCreate(false)
    setEditingLeague(null)
    setDeletingLeague(null)
  }

  // ─── Crear ───────────────────────────────────────────────────────────────

  async function handleCreate() {
    if (!form.name.trim()) {
      toast('warning', 'El nombre de la liga es obligatorio')
      return
    }
    const supabase = createClient()
    setSaving(true)

    const payload = {
      club_id: CLUB_ID,
      sport_id: SPORT_ID,
      name: form.name.trim(),
      slug: form.name.trim().toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, ''),
      format: form.format,
      season: form.season || null,
      start_date: form.start_date || null,
      end_date: form.end_date || null,
      registration_deadline: form.registration_deadline || null,
      entry_fee: parseFloat(form.entry_fee) || 0,
      description: form.description || null,
      sets_to_win: parseInt(form.sets_to_win),
      games_per_set: parseInt(form.games_per_set),
      golden_point: form.golden_point,
      has_playoffs: form.has_playoffs,
      playoff_format: form.has_playoffs ? 'bracket' : null,
      status: form.status,
      cover_image_url: form.cover_image_url.trim() || null,
      scoring_rules: {
        win_2_0: 3,
        win_2_1: 2,
        loss_1_2: 1,
        loss_0_2: 0,
        walkover_win: 3,
        walkover_loss: 0,
        punctuality_bonus: 1,
        max_pending_for_bonus: 0,
        tiebreakers: ['points', 'set_diff', 'game_diff'],
      },
    }

    const { error } = await supabase.from('nm_leagues').insert(payload)
    setSaving(false)

    if (error) {
      toast('error', 'No se pudo crear la liga')
    } else {
      toast('success', 'Liga creada correctamente')
      closeModals()
      loadLeagues()
    }
  }

  // ─── Editar ──────────────────────────────────────────────────────────────

  async function handleEdit() {
    if (!editingLeague) return
    if (!form.name.trim()) {
      toast('warning', 'El nombre de la liga es obligatorio')
      return
    }
    const supabase = createClient()
    setSaving(true)

    const payload = {
      name: form.name.trim(),
      format: form.format,
      season: form.season || null,
      start_date: form.start_date || null,
      end_date: form.end_date || null,
      registration_deadline: form.registration_deadline || null,
      entry_fee: parseFloat(form.entry_fee) || 0,
      description: form.description || null,
      sets_to_win: parseInt(form.sets_to_win),
      games_per_set: parseInt(form.games_per_set),
      golden_point: form.golden_point,
      has_playoffs: form.has_playoffs,
      playoff_format: form.has_playoffs ? 'bracket' : null,
      status: form.status,
      cover_image_url: form.cover_image_url.trim() || null,
    }

    const { error } = await supabase
      .from('nm_leagues')
      .update(payload)
      .eq('id', editingLeague.id)

    setSaving(false)

    if (error) {
      toast('error', 'No se pudo guardar los cambios')
    } else {
      toast('success', 'Liga actualizada correctamente')
      closeModals()
      loadLeagues()
    }
  }

  // ─── Eliminar ────────────────────────────────────────────────────────────

  async function handleDelete() {
    if (!deletingLeague) return
    const supabase = createClient()
    setDeleting(true)

    const { error } = await supabase
      .from('nm_leagues')
      .delete()
      .eq('id', deletingLeague.id)

    setDeleting(false)

    if (error) {
      toast('error', 'No se pudo eliminar la liga')
    } else {
      toast('success', 'Liga eliminada')
      closeModals()
      loadLeagues()
    }
  }

  // ─── Formulario compartido (crear y editar) ───────────────────────────────

  function LeagueFormFields({ showStatus }: { showStatus?: boolean }) {
    return (
      <div className="space-y-4">
        <Input
          id="liga-nombre"
          label="Nombre de la liga *"
          placeholder="Ej: Liga Primavera 2026"
          value={form.name}
          onChange={e => setField('name', e.target.value)}
        />

        <div className="grid grid-cols-2 gap-3">
          <Select
            id="liga-formato"
            label="Formato"
            options={FORMAT_OPTIONS}
            value={form.format}
            onChange={e => setField('format', e.target.value)}
          />
          <Input
            id="liga-temporada"
            label="Temporada"
            placeholder="Ej: 2026"
            value={form.season}
            onChange={e => setField('season', e.target.value)}
          />
        </div>

        {/* Descripción del formato seleccionado */}
        <FormatHint formatValue={form.format} />

        <div className="grid grid-cols-2 gap-3">
          <Input
            id="liga-inicio"
            label="Fecha de inicio"
            type="date"
            value={form.start_date}
            onChange={e => setField('start_date', e.target.value)}
          />
          <Input
            id="liga-fin"
            label="Fecha de fin"
            type="date"
            value={form.end_date}
            onChange={e => setField('end_date', e.target.value)}
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Input
            id="liga-inscripcion-deadline"
            label="Cierre de inscripción"
            type="date"
            value={form.registration_deadline}
            onChange={e => setField('registration_deadline', e.target.value)}
          />
          <Input
            id="liga-arancel"
            label="Arancel de inscripción (€)"
            type="number"
            min="0"
            step="0.01"
            value={form.entry_fee}
            onChange={e => setField('entry_fee', e.target.value)}
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Select
            id="liga-sets"
            label="Sets para ganar"
            options={SETS_OPTIONS}
            value={form.sets_to_win}
            onChange={e => setField('sets_to_win', e.target.value)}
          />
          <Select
            id="liga-games"
            label="Juegos por set"
            options={GAMES_OPTIONS}
            value={form.games_per_set}
            onChange={e => setField('games_per_set', e.target.value)}
          />
        </div>

        {showStatus && (
          <Select
            id="liga-estado"
            label="Estado"
            options={STATUS_OPTIONS}
            value={form.status}
            onChange={e => setField('status', e.target.value as LeagueStatus)}
          />
        )}

        <div>
          <label className="block text-sm font-medium text-slate-300 mb-2">
            Descripción
          </label>
          <textarea
            className="w-full rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-white placeholder-slate-500 resize-none focus:outline-none focus:ring-2 focus:ring-cyan-500/40 focus:border-cyan-500"
            rows={3}
            placeholder="Descripción de la liga (opcional)"
            value={form.description}
            onChange={e => setField('description', e.target.value)}
          />
        </div>

        <CompetitionCoverField
          value={form.cover_image_url}
          onChange={val => setField('cover_image_url', val)}
        />

        {/* Toggles */}
        <div className="space-y-3 pt-1">
          <label className="flex items-center justify-between cursor-pointer group">
            <div>
              <p className="text-sm font-medium text-slate-300 group-hover:text-white transition-colors">
                Golden point
              </p>
              <p className="text-xs text-slate-500">Último juego con punto de oro</p>
            </div>
            <button
              type="button"
              onClick={() => setField('golden_point', !form.golden_point)}
              className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                form.golden_point ? 'bg-cyan-500' : 'bg-slate-600'
              }`}
            >
              <span
                className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${
                  form.golden_point ? 'translate-x-4' : 'translate-x-1'
                }`}
              />
            </button>
          </label>

          <label className="flex items-center justify-between cursor-pointer group">
            <div>
              <p className="text-sm font-medium text-slate-300 group-hover:text-white transition-colors">
                Tiene playoffs
              </p>
              <p className="text-xs text-slate-500">Fase final eliminatoria</p>
            </div>
            <button
              type="button"
              onClick={() => setField('has_playoffs', !form.has_playoffs)}
              className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                form.has_playoffs ? 'bg-cyan-500' : 'bg-slate-600'
              }`}
            >
              <span
                className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${
                  form.has_playoffs ? 'translate-x-4' : 'translate-x-1'
                }`}
              />
            </button>
          </label>
        </div>
      </div>
    )
  }

  // ─── Render ──────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Gestión de Ligas</h1>
          <p className="text-sm text-slate-400 mt-1">
            Administrá ligas, formatos y clasificaciones
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/admin/ligas/importar">
            <Button variant="outline" className="flex items-center gap-2">
              <FileSpreadsheet size={16} />
              Importar Excel
            </Button>
          </Link>
          <Button onClick={openCreate} className="flex items-center gap-2">
            <Plus size={16} />
            Nueva Liga
          </Button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <KpiCard
          title="Total de ligas"
          value={total}
          icon={<Trophy size={20} />}
          color="#06b6d4"
        />
        <KpiCard
          title="En curso"
          value={activas}
          icon={<Users size={20} />}
          color="#10b981"
        />
        <KpiCard
          title="En inscripción"
          value={enInscripcion}
          icon={<ChevronRight size={20} />}
          color="#3b82f6"
        />
      </div>

      {/* Tabs de estado */}
      <div className="flex gap-1 overflow-x-auto border-b border-slate-700/50 pb-0">
        {STATUS_TABS.map(tab => (
          <button
            key={tab.value}
            onClick={() => setActiveTab(tab.value)}
            className={`px-4 py-2 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
              activeTab === tab.value
                ? 'border-cyan-500 text-cyan-400'
                : 'border-transparent text-slate-400 hover:text-white'
            }`}
          >
            {tab.label}
            {tab.value !== 'all' && (
              <span className="ml-1.5 text-xs text-slate-500">
                ({leagues.filter(l => l.status === tab.value).length})
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Listado */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => (
            <div
              key={i}
              className="h-52 rounded-xl border border-slate-700/50 bg-slate-800/30 animate-pulse"
            />
          ))}
        </div>
      ) : filtradas.length === 0 ? (
        <div className="rounded-xl border border-slate-700/50 bg-slate-800/50 p-12 text-center">
          <Trophy size={40} className="mx-auto mb-3 text-slate-600" />
          <p className="text-slate-400">
            {activeTab === 'all'
              ? 'No hay ligas creadas todavía'
              : `No hay ligas en estado "${STATUS_TABS.find(t => t.value === activeTab)?.label}"`}
          </p>
          {activeTab === 'all' && (
            <Button onClick={openCreate} variant="outline" className="mt-4">
              Crear primera liga
            </Button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtradas.map(league => (
            <LeagueCard
              key={league.id}
              league={league}
              onEdit={() => openEdit(league)}
              onDelete={() => setDeletingLeague(league)}
            />
          ))}
        </div>
      )}

      {/* Modal: Nueva Liga */}
      <Modal
        open={showCreate}
        onClose={closeModals}
        title="Nueva Liga"
        size="lg"
        footer={
          <>
            <Button variant="ghost" onClick={closeModals} disabled={saving}>
              Cancelar
            </Button>
            <Button onClick={handleCreate} disabled={saving}>
              {saving ? 'Guardando...' : 'Crear Liga'}
            </Button>
          </>
        }
      >
        <LeagueFormFields showStatus={false} />
      </Modal>

      {/* Modal: Editar Liga */}
      <Modal
        open={!!editingLeague}
        onClose={closeModals}
        title={`Editar — ${editingLeague?.name ?? ''}`}
        size="lg"
        footer={
          <>
            <Button variant="ghost" onClick={closeModals} disabled={saving}>
              Cancelar
            </Button>
            <Button onClick={handleEdit} disabled={saving}>
              {saving ? 'Guardando...' : 'Guardar cambios'}
            </Button>
          </>
        }
      >
        <LeagueFormFields showStatus={true} />
      </Modal>

      {/* Modal: Confirmar eliminación */}
      <Modal
        open={!!deletingLeague}
        onClose={closeModals}
        title="Eliminar liga"
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={closeModals} disabled={deleting}>
              Cancelar
            </Button>
            <Button
              onClick={handleDelete}
              disabled={deleting}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              {deleting ? 'Eliminando...' : 'Sí, eliminar'}
            </Button>
          </>
        }
      >
        <p className="text-slate-300 text-sm">
          ¿Estás seguro que querés eliminar la liga{' '}
          <span className="text-white font-semibold">{deletingLeague?.name}</span>?
          Esta acción no se puede deshacer.
        </p>
      </Modal>
    </div>
  )
}

// ─── Tarjeta de liga ─────────────────────────────────────────────────────────

interface LeagueCardProps {
  league: League
  onEdit: () => void
  onDelete: () => void
}

function LeagueCard({ league, onEdit, onDelete }: LeagueCardProps) {
  const statusInfo = STATUS_LABELS[league.status]
  const cover = (league as unknown as Record<string, unknown>).cover_image_url as string | null | undefined

  const formatLabel = getFormat(league.format)?.label ?? league.format

  return (
    <Link
      href={`/admin/ligas/${league.id}`}
      className="group relative rounded-xl border border-slate-700/50 bg-slate-800/50 overflow-hidden hover:border-cyan-500/50 hover:bg-slate-800/80 transition-all cursor-pointer block"
    >
      {cover && (
        <div className="relative h-28 w-full overflow-hidden border-b border-slate-700/50"
          style={{ backgroundImage: `url(${cover})`, backgroundSize: 'cover', backgroundPosition: 'center' }}>
          <div className="absolute inset-0 bg-gradient-to-t from-slate-800 via-slate-800/30 to-transparent" />
        </div>
      )}
      <div className="p-5">
      {/* Acciones */}
      <div
        className="absolute top-3 right-3 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity z-10"
        onClick={e => { e.preventDefault(); e.stopPropagation() }}
      >
        <button
          onClick={e => { e.preventDefault(); e.stopPropagation(); onEdit() }}
          className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700 transition-colors"
          title="Editar"
        >
          <Pencil size={14} />
        </button>
        <button
          onClick={e => { e.preventDefault(); e.stopPropagation(); onDelete() }}
          className="p-1.5 rounded-lg text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-colors"
          title="Eliminar"
        >
          <Trash2 size={14} />
        </button>
      </div>

      {/* Encabezado */}
      <div className="flex items-start gap-3 mb-3 pr-16">
        <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-cyan-500/10 flex items-center justify-center">
          <Trophy size={20} className="text-cyan-400" />
        </div>
        <div className="min-w-0">
          <h3 className="text-white font-semibold truncate leading-tight">{league.name}</h3>
          {league.season && (
            <p className="text-xs text-slate-500 mt-0.5">Temporada {league.season}</p>
          )}
        </div>
      </div>

      {/* Estado + formato */}
      <div className="flex flex-wrap gap-2 mb-3">
        <span
          className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${statusInfo?.class ?? 'bg-gray-500/20 text-gray-400'}`}
        >
          {statusInfo?.label ?? league.status}
        </span>
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-slate-700/60 text-slate-300">
          {formatLabel}
        </span>
        {league.has_playoffs && (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-500/10 text-amber-400">
            <Award size={10} />
            Playoffs
          </span>
        )}
      </div>

      {/* Fechas */}
      {(league.start_date || league.end_date) && (
        <div className="flex items-center gap-1.5 text-xs text-slate-400 mb-2">
          <CalendarDays size={12} className="text-slate-500 flex-shrink-0" />
          <span>
            {league.start_date ? formatDate(league.start_date, { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}
            {league.end_date && (
              <>
                {' → '}
                {formatDate(league.end_date, { day: 'numeric', month: 'short', year: 'numeric' })}
              </>
            )}
          </span>
        </div>
      )}

      {/* Inscripción deadline */}
      {league.registration_deadline && (
        <div className="flex items-center gap-1.5 text-xs text-slate-400 mb-2">
          <Users size={12} className="text-slate-500 flex-shrink-0" />
          <span>
            Inscripción hasta{' '}
            {formatDate(league.registration_deadline, { day: 'numeric', month: 'short', year: 'numeric' })}
          </span>
        </div>
      )}

      {/* Arancel */}
      <div className="flex items-center justify-between mt-3 pt-3 border-t border-slate-700/50">
        <div className="flex items-center gap-1.5 text-sm">
          <CircleDollarSign size={14} className="text-cyan-500" />
          <span className="text-white font-medium">
            {league.entry_fee > 0 ? formatCurrency(league.entry_fee) : 'Gratuita'}
          </span>
        </div>
        <span className="text-xs text-slate-500">
          {league.sets_to_win} sets · {league.games_per_set} juegos
          {league.golden_point && ' · GP'}
        </span>
      </div>
      </div>
    </Link>
  )
}

function FormatHint({ formatValue }: { formatValue: string }) {
  const fmt = getFormat(formatValue)
  if (!fmt) return null

  const teamsRange = fmt.maxTeams
    ? `${fmt.minTeams}–${fmt.maxTeams} equipos`
    : `desde ${fmt.minTeams} equipos`

  return (
    <div className={`rounded-lg p-3 text-xs border ${fmt.ready
      ? 'bg-cyan-500/5 border-cyan-500/20 text-slate-300'
      : 'bg-amber-500/5 border-amber-500/30 text-slate-300'}`}
    >
      <div className="flex items-center justify-between gap-2 mb-1">
        <span className="font-semibold text-white">{fmt.label}</span>
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-slate-500">{teamsRange}</span>
          {!fmt.ready && (
            <Badge variant="warning" className="text-[10px]">Próximamente</Badge>
          )}
        </div>
      </div>
      <p className="leading-relaxed">{fmt.description}</p>
      {!fmt.ready && (
        <p className="mt-2 text-amber-300/80 text-[11px]">
          Podés crear la liga con este formato y gestionar los partidos manualmente. El generador automático todavía no está implementado.
        </p>
      )}
    </div>
  )
}
