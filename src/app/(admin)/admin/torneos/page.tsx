'use client'

import { useCallback, useEffect, useState } from 'react'
import { Trophy, Plus, Users, CalendarDays, DollarSign, Loader2, Pencil, Trash2, ChevronRight, GitBranch } from 'lucide-react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Modal } from '@/components/ui/modal'
import { KpiCard } from '@/components/ui/kpi-card'
import { useToast } from '@/components/ui/toast'
import { formatCurrency, formatDate, STATUS_LABELS } from '@/lib/utils'
import { CompetitionCoverField } from '@/components/competition-cover-field'
import type { Tournament } from '@/types'

// ─── constantes ──────────────────────────────────────────────
const CLUB_ID = 1
const SPORT_ID = 1

const FORMAT_OPTIONS = [
  { value: 'eliminacion_directa', label: 'Eliminación Directa' },
  { value: 'doble_eliminacion', label: 'Doble Eliminación' },
  { value: 'americano', label: 'Americano' },
  { value: 'mexicano', label: 'Mexicano' },
  { value: 'round_robin', label: 'Round Robin' },
  { value: 'premier', label: 'Premier' },
]

const STATUS_OPTIONS = [
  { value: 'draft', label: 'Borrador' },
  { value: 'registration', label: 'Inscripción' },
  { value: 'active', label: 'En Curso' },
  { value: 'playoffs', label: 'Playoffs' },
  { value: 'finished', label: 'Finalizado' },
  { value: 'cancelled', label: 'Cancelado' },
]

const FILTER_TABS = [
  { value: 'all', label: 'Todos' },
  { value: 'draft', label: 'Borrador' },
  { value: 'registration', label: 'Inscripción' },
  { value: 'active', label: 'En Curso' },
  { value: 'finished', label: 'Finalizado' },
]

// badge variant según status
function statusBadgeVariant(status: string): 'default' | 'success' | 'warning' | 'danger' | 'info' | 'cyan' {
  const map: Record<string, 'default' | 'success' | 'warning' | 'danger' | 'info' | 'cyan'> = {
    draft: 'default',
    registration: 'info',
    active: 'success',
    playoffs: 'warning',
    finished: 'cyan',
    cancelled: 'danger',
  }
  return map[status] ?? 'default'
}

function formatLabel(status: string): string {
  return STATUS_LABELS[status]?.label ?? status
}

function formatLabel2(format: string): string {
  return FORMAT_OPTIONS.find(f => f.value === format)?.label ?? format
}

// ─── form state ──────────────────────────────────────────────
interface TournamentForm {
  name: string
  format: string
  start_date: string
  end_date: string
  registration_deadline: string
  max_teams: string
  min_teams: string
  entry_fee: string
  prize_pool: string
  prize_description: string
  description: string
  status: string
  cover_image_url: string
}

const EMPTY_FORM: TournamentForm = {
  name: '',
  format: 'eliminacion_directa',
  start_date: '',
  end_date: '',
  registration_deadline: '',
  max_teams: '16',
  min_teams: '4',
  entry_fee: '0',
  prize_pool: '0',
  prize_description: '',
  description: '',
  status: 'draft',
  cover_image_url: '',
}

function tournamentToForm(t: Tournament): TournamentForm {
  return {
    name: t.name,
    format: t.format,
    start_date: t.start_date?.slice(0, 10) ?? '',
    end_date: t.end_date?.slice(0, 10) ?? '',
    registration_deadline: t.registration_deadline?.slice(0, 10) ?? '',
    max_teams: String(t.max_teams ?? 16),
    min_teams: String((t as unknown as Record<string, unknown>).min_teams ?? 4),
    entry_fee: String(t.entry_fee ?? 0),
    prize_pool: String(t.prize_pool ?? 0),
    prize_description: t.prize_description ?? '',
    description: t.description ?? '',
    status: t.status,
    cover_image_url: (t as unknown as Record<string, unknown>).cover_image_url as string ?? '',
  }
}

// ─── componente principal ─────────────────────────────────────
export default function GestionTorneosPage() {
  const { toast } = useToast()
  const supabase = createClient()

  const [tournaments, setTournaments] = useState<Tournament[]>([])
  const [teamCounts, setTeamCounts] = useState<Record<number, number>>({})
  const [loading, setLoading] = useState(true)
  const [filterTab, setFilterTab] = useState('all')

  // modales
  const [newOpen, setNewOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [selectedTournament, setSelectedTournament] = useState<Tournament | null>(null)

  // forms
  const [newForm, setNewForm] = useState<TournamentForm>(EMPTY_FORM)
  const [editForm, setEditForm] = useState<TournamentForm>(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  // ─── carga de datos ──────────────────────────────────
  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const { data: torneos, error } = await supabase
        .from('nm_tournaments')
        .select('*')
        .eq('club_id', CLUB_ID)
        .order('created_at', { ascending: false })

      if (error) throw error

      setTournaments((torneos as Tournament[]) ?? [])

      // conteo de equipos por torneo
      if (torneos && torneos.length > 0) {
        const ids = torneos.map((t: Tournament) => t.id)
        const { data: counts } = await supabase
          .from('nm_tournament_teams')
          .select('tournament_id')
          .in('tournament_id', ids)

        if (counts) {
          const map: Record<number, number> = {}
          for (const row of counts as { tournament_id: number }[]) {
            map[row.tournament_id] = (map[row.tournament_id] ?? 0) + 1
          }
          setTeamCounts(map)
        }
      }
    } catch (err) {
      console.error(err)
      toast('error', 'Error al cargar los torneos')
    } finally {
      setLoading(false)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => { loadData() }, [loadData])

  // ─── KPIs ────────────────────────────────────────────
  const totalTorneos = tournaments.length
  const activos = tournaments.filter(t => t.status === 'active').length
  const inscripcionAbierta = tournaments.filter(t => t.status === 'registration').length
  const totalEquipos = Object.values(teamCounts).reduce((a, b) => a + b, 0)

  // ─── filtrado ────────────────────────────────────────
  const filtered = filterTab === 'all'
    ? tournaments
    : tournaments.filter(t => t.status === filterTab)

  // ─── handlers nuevo torneo ───────────────────────────
  function openNew() {
    setNewForm(EMPTY_FORM)
    setNewOpen(true)
  }

  async function handleCreate() {
    if (!newForm.name.trim()) { toast('warning', 'El nombre es requerido'); return }
    setSaving(true)
    try {
      const slug = newForm.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
      const payload = {
        club_id: CLUB_ID,
        sport_id: SPORT_ID,
        name: newForm.name.trim(),
        slug: `${slug}-${Date.now()}`,
        format: newForm.format,
        start_date: newForm.start_date || null,
        end_date: newForm.end_date || null,
        registration_deadline: newForm.registration_deadline || null,
        max_teams: parseInt(newForm.max_teams) || null,
        min_teams: parseInt(newForm.min_teams) || null,
        entry_fee: parseFloat(newForm.entry_fee) || 0,
        prize_pool: parseFloat(newForm.prize_pool) || 0,
        prize_description: newForm.prize_description || null,
        description: newForm.description || null,
        status: newForm.status,
        cover_image_url: newForm.cover_image_url.trim() || null,
        sets_to_win: 2,
        games_per_set: 6,
        golden_point: true,
        third_place_match: false,
        categories: [],
      }

      const { error } = await supabase.from('nm_tournaments').insert(payload)
      if (error) throw error

      toast('success', 'Torneo creado correctamente')
      setNewOpen(false)
      loadData()
    } catch (err) {
      console.error(err)
      toast('error', 'Error al crear el torneo')
    } finally {
      setSaving(false)
    }
  }

  // ─── handlers editar torneo ──────────────────────────
  function openEdit(t: Tournament) {
    setSelectedTournament(t)
    setEditForm(tournamentToForm(t))
    setConfirmDelete(false)
    setEditOpen(true)
  }

  async function handleUpdate() {
    if (!selectedTournament) return
    if (!editForm.name.trim()) { toast('warning', 'El nombre es requerido'); return }
    setSaving(true)
    try {
      const payload = {
        name: editForm.name.trim(),
        format: editForm.format,
        start_date: editForm.start_date || null,
        end_date: editForm.end_date || null,
        registration_deadline: editForm.registration_deadline || null,
        max_teams: parseInt(editForm.max_teams) || null,
        min_teams: parseInt(editForm.min_teams) || null,
        entry_fee: parseFloat(editForm.entry_fee) || 0,
        prize_pool: parseFloat(editForm.prize_pool) || 0,
        prize_description: editForm.prize_description || null,
        description: editForm.description || null,
        status: editForm.status,
        cover_image_url: editForm.cover_image_url.trim() || null,
      }

      const { error } = await supabase
        .from('nm_tournaments')
        .update(payload)
        .eq('id', selectedTournament.id)

      if (error) throw error

      toast('success', 'Torneo actualizado correctamente')
      setEditOpen(false)
      setSelectedTournament(null)
      loadData()
    } catch (err) {
      console.error(err)
      toast('error', 'Error al actualizar el torneo')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!selectedTournament) return
    if (!confirmDelete) { setConfirmDelete(true); return }
    setDeleting(true)
    try {
      // borrar equipos primero
      await supabase.from('nm_tournament_teams').delete().eq('tournament_id', selectedTournament.id)
      const { error } = await supabase.from('nm_tournaments').delete().eq('id', selectedTournament.id)
      if (error) throw error

      toast('success', 'Torneo eliminado')
      setEditOpen(false)
      setSelectedTournament(null)
      loadData()
    } catch (err) {
      console.error(err)
      toast('error', 'Error al eliminar el torneo')
    } finally {
      setDeleting(false)
    }
  }

  // ─── form helpers ────────────────────────────────────
  function setField<K extends keyof TournamentForm>(
    setter: React.Dispatch<React.SetStateAction<TournamentForm>>,
    key: K,
    val: string
  ) {
    setter(prev => ({ ...prev, [key]: val }))
  }

  // ─── render formulario ───────────────────────────────
  function TournamentFormFields({
    form,
    onChange,
    showStatus,
  }: {
    form: TournamentForm
    onChange: (key: keyof TournamentForm, val: string) => void
    showStatus: boolean
  }) {
    return (
      <div className="space-y-4">
        <Input
          id="t-name"
          label="Nombre del torneo"
          value={form.name}
          onChange={e => onChange('name', e.target.value)}
          placeholder="Ej: Copa Nueva Marina 2026"
        />

        <div className="grid grid-cols-2 gap-3">
          <Select
            id="t-format"
            label="Formato"
            options={FORMAT_OPTIONS}
            value={form.format}
            onChange={e => onChange('format', e.target.value)}
          />
          {showStatus && (
            <Select
              id="t-status"
              label="Estado"
              options={STATUS_OPTIONS}
              value={form.status}
              onChange={e => onChange('status', e.target.value)}
            />
          )}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Input
            id="t-start"
            label="Fecha de inicio"
            type="date"
            value={form.start_date}
            onChange={e => onChange('start_date', e.target.value)}
          />
          <Input
            id="t-end"
            label="Fecha de fin"
            type="date"
            value={form.end_date}
            onChange={e => onChange('end_date', e.target.value)}
          />
        </div>

        <Input
          id="t-reg-deadline"
          label="Fecha límite de inscripción"
          type="date"
          value={form.registration_deadline}
          onChange={e => onChange('registration_deadline', e.target.value)}
        />

        <div className="grid grid-cols-2 gap-3">
          <Input
            id="t-max"
            label="Máx. equipos"
            type="number"
            min="2"
            value={form.max_teams}
            onChange={e => onChange('max_teams', e.target.value)}
          />
          <Input
            id="t-min"
            label="Mín. equipos"
            type="number"
            min="2"
            value={form.min_teams}
            onChange={e => onChange('min_teams', e.target.value)}
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Input
            id="t-fee"
            label="Inscripción (€)"
            type="number"
            min="0"
            step="0.01"
            value={form.entry_fee}
            onChange={e => onChange('entry_fee', e.target.value)}
          />
          <Input
            id="t-prize"
            label="Premio total (€)"
            type="number"
            min="0"
            step="0.01"
            value={form.prize_pool}
            onChange={e => onChange('prize_pool', e.target.value)}
          />
        </div>

        <Input
          id="t-prize-desc"
          label="Descripción del premio"
          value={form.prize_description}
          onChange={e => onChange('prize_description', e.target.value)}
          placeholder="Ej: Trofeos + vouchers de material"
        />

        <div className="space-y-1">
          <label className="block text-sm font-medium text-slate-300">Descripción</label>
          <textarea
            value={form.description}
            onChange={e => onChange('description', e.target.value)}
            rows={3}
            placeholder="Descripción del torneo, reglas generales..."
            className="w-full rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-white placeholder-slate-500 transition-colors focus:outline-none focus:ring-2 focus:ring-cyan-500/40 focus:border-cyan-500 resize-none"
          />
        </div>

        <CompetitionCoverField
          value={form.cover_image_url}
          onChange={val => onChange('cover_image_url', val)}
        />
      </div>
    )
  }

  // ─── render principal ────────────────────────────────
  return (
    <div className="space-y-6">
      {/* header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Gestión de Torneos</h1>
          <p className="text-sm text-slate-400 mt-1">Creá y administrá torneos, cuadros y resultados</p>
        </div>
        <Button onClick={openNew}>
          <Plus size={16} />
          Nuevo Torneo
        </Button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          title="Total torneos"
          value={totalTorneos}
          icon={<Trophy size={20} />}
          color="#06b6d4"
        />
        <KpiCard
          title="En curso"
          value={activos}
          icon={<ChevronRight size={20} />}
          color="#10b981"
        />
        <KpiCard
          title="Inscripción abierta"
          value={inscripcionAbierta}
          icon={<CalendarDays size={20} />}
          color="#8b5cf6"
        />
        <KpiCard
          title="Equipos inscriptos"
          value={totalEquipos}
          icon={<Users size={20} />}
          color="#f59e0b"
        />
      </div>

      {/* tabs de filtro */}
      <div className="flex gap-1 border-b border-slate-700/50 pb-0">
        {FILTER_TABS.map(tab => (
          <button
            key={tab.value}
            onClick={() => setFilterTab(tab.value)}
            className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors ${
              filterTab === tab.value
                ? 'bg-slate-800 text-cyan-400 border border-b-0 border-slate-700'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* lista de torneos */}
      {loading ? (
        <div className="flex items-center justify-center py-20 text-slate-400">
          <Loader2 size={24} className="animate-spin mr-2" />
          Cargando torneos...
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-slate-700/50 bg-slate-800/50 p-12 text-center">
          <Trophy size={40} className="mx-auto mb-3 text-slate-600" />
          <p className="text-slate-400">No hay torneos en esta categoría</p>
          <Button variant="secondary" className="mt-4" onClick={openNew}>
            <Plus size={14} />
            Crear primer torneo
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map(t => {
            const teamsCount = teamCounts[t.id] ?? 0
            const cover = (t as unknown as Record<string, unknown>).cover_image_url as string | null | undefined
            return (
              <button
                key={t.id}
                onClick={() => openEdit(t)}
                className="text-left rounded-xl border border-slate-700/50 bg-slate-800/50 overflow-hidden hover:border-slate-600 hover:bg-slate-800 transition-all group"
              >
                {cover && (
                  <div className="relative h-28 w-full overflow-hidden border-b border-slate-700/50"
                    style={{ backgroundImage: `url(${cover})`, backgroundSize: 'cover', backgroundPosition: 'center' }}>
                    <div className="absolute inset-0 bg-gradient-to-t from-slate-800 via-slate-800/30 to-transparent" />
                  </div>
                )}
                <div className="p-5">
                {/* header card */}
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-white truncate group-hover:text-cyan-400 transition-colors">
                      {t.name}
                    </p>
                    <p className="text-xs text-slate-500 mt-0.5">{formatLabel2(t.format)}</p>
                  </div>
                  <Badge variant={statusBadgeVariant(t.status)} className="ml-2 shrink-0">
                    {formatLabel(t.status)}
                  </Badge>
                </div>

                {/* info rows */}
                <div className="space-y-1.5 text-xs text-slate-400">
                  {t.start_date && (
                    <div className="flex items-center gap-1.5">
                      <CalendarDays size={12} className="text-slate-500 shrink-0" />
                      <span>
                        {formatDate(t.start_date, { day: 'numeric', month: 'short' })}
                        {t.end_date && ` → ${formatDate(t.end_date, { day: 'numeric', month: 'short' })}`}
                      </span>
                    </div>
                  )}
                  <div className="flex items-center gap-1.5">
                    <Users size={12} className="text-slate-500 shrink-0" />
                    <span>
                      {teamsCount} equipos
                      {t.max_teams ? ` / ${t.max_teams} máx` : ''}
                    </span>
                  </div>
                  {t.entry_fee > 0 && (
                    <div className="flex items-center gap-1.5">
                      <DollarSign size={12} className="text-slate-500 shrink-0" />
                      <span>{formatCurrency(t.entry_fee)} por equipo</span>
                    </div>
                  )}
                </div>

                {/* footer */}
                <div className="mt-3 pt-3 border-t border-slate-700/50 flex items-center justify-between">
                  <span className="text-xs text-slate-500">
                    {t.prize_pool > 0 ? `Premio: ${formatCurrency(t.prize_pool)}` : 'Sin premio en metálico'}
                  </span>
                  <div className="flex items-center gap-2">
                    <Link
                      href={`/admin/torneos/${t.id}`}
                      onClick={e => e.stopPropagation()}
                      className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium text-cyan-400 bg-cyan-500/10 hover:bg-cyan-500/20 transition-colors"
                    >
                      <GitBranch size={12} /> Bracket
                    </Link>
                    <Pencil size={13} className="text-slate-600 group-hover:text-cyan-400 transition-colors" />
                  </div>
                </div>
                </div>
              </button>
            )
          })}
        </div>
      )}

      {/* ─── modal nuevo torneo ─── */}
      <Modal
        open={newOpen}
        onClose={() => setNewOpen(false)}
        title="Nuevo Torneo"
        size="lg"
        footer={
          <>
            <Button variant="secondary" onClick={() => setNewOpen(false)} disabled={saving}>
              Cancelar
            </Button>
            <Button onClick={handleCreate} loading={saving}>
              Crear Torneo
            </Button>
          </>
        }
      >
        <TournamentFormFields
          form={newForm}
          onChange={(key, val) => setField(setNewForm, key, val)}
          showStatus={false}
        />
      </Modal>

      {/* ─── modal editar torneo ─── */}
      <Modal
        open={editOpen}
        onClose={() => { setEditOpen(false); setConfirmDelete(false) }}
        title={selectedTournament?.name ?? 'Editar Torneo'}
        size="lg"
        footer={
          <div className="flex items-center justify-between w-full">
            {/* lado izquierdo: eliminar */}
            <div>
              {confirmDelete ? (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-red-400">¿Seguro? Esta acción no se puede deshacer</span>
                  <Button variant="danger" size="sm" onClick={handleDelete} loading={deleting}>
                    Sí, eliminar
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setConfirmDelete(false)}>
                    No
                  </Button>
                </div>
              ) : (
                <Button variant="danger" size="sm" onClick={handleDelete} disabled={saving}>
                  <Trash2 size={13} />
                  Eliminar
                </Button>
              )}
            </div>
            {/* lado derecho: guardar */}
            <div className="flex gap-2">
              <Button variant="secondary" onClick={() => setEditOpen(false)} disabled={saving}>
                Cancelar
              </Button>
              <Button onClick={handleUpdate} loading={saving}>
                Guardar Cambios
              </Button>
            </div>
          </div>
        }
      >
        <TournamentFormFields
          form={editForm}
          onChange={(key, val) => setField(setEditForm, key, val)}
          showStatus={true}
        />
      </Modal>
    </div>
  )
}
