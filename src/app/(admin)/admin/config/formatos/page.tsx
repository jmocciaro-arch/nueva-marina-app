'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Modal } from '@/components/ui/modal'
import { useToast } from '@/components/ui/toast'
import { usePermissions } from '@/lib/use-permissions'
import { useGameFormats } from '@/hooks/use-game-formats'
import type { FormatDef, FormatScope, FormatGenerator } from '@/lib/tournament-formats'
import { AlertTriangle, Plus, Pencil, Trophy, Calendar, Layers, Power, PowerOff } from 'lucide-react'

const SCOPE_OPTIONS: { value: FormatScope; label: string }[] = [
  { value: 'tournament', label: 'Torneo' },
  { value: 'league', label: 'Liga' },
  { value: 'both', label: 'Torneo y liga' },
]

const GENERATOR_OPTIONS: { value: FormatGenerator; label: string }[] = [
  { value: 'manual', label: 'Manual (admin arma partidos)' },
  { value: 'round_robin', label: 'Round Robin' },
  { value: 'single_elimination', label: 'Eliminación directa' },
  { value: 'double_elimination', label: 'Doble eliminación' },
  { value: 'pool_bracket', label: 'Pool + Bracket' },
  { value: 'americano', label: 'Americano (rotación)' },
  { value: 'mexicano', label: 'Mexicano (pairing por puntos)' },
  { value: 'king_of_court', label: 'King of the Court' },
  { value: 'swiss', label: 'Suizo' },
  { value: 'box_league', label: 'Box League' },
  { value: 'league_playoffs', label: 'Liga + Playoffs' },
]

const FILTER_TABS: { value: 'all' | 'tournament' | 'league'; label: string }[] = [
  { value: 'all', label: 'Todos' },
  { value: 'tournament', label: 'Torneos' },
  { value: 'league', label: 'Ligas' },
]

type FormState = {
  id?: number
  slug: string
  label: string
  description: string
  applicable_to: FormatScope
  generator: FormatGenerator
  min_teams: string
  max_teams: string
  uses_groups: boolean
  default_group_size: string
  ready: boolean
  is_active: boolean
  sort_order: string
  is_system: boolean
}

const EMPTY_FORM: FormState = {
  slug: '',
  label: '',
  description: '',
  applicable_to: 'tournament',
  generator: 'manual',
  min_teams: '4',
  max_teams: '',
  uses_groups: false,
  default_group_size: '4',
  ready: false,
  is_active: true,
  sort_order: '500',
  is_system: false,
}

export default function FormatosPage() {
  const { toast } = useToast()
  const { can, loading: permsLoading } = usePermissions()
  const { formats, loading, reload } = useGameFormats('all', true)

  const [filter, setFilter] = useState<'all' | 'tournament' | 'league'>('all')
  const [modalOpen, setModalOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState<FormState>(EMPTY_FORM)

  if (permsLoading) {
    return <div className="p-8 text-slate-400">Cargando permisos…</div>
  }

  if (!can('config.manage_formats')) {
    return (
      <div className="p-8">
        <Card>
          <div className="flex items-center gap-3 text-amber-400">
            <AlertTriangle size={20} />
            <div>
              <h2 className="text-base font-semibold">Sin permisos</h2>
              <p className="text-sm text-slate-400 mt-1">
                Necesitás <code>config.manage_formats</code> para gestionar formatos de juego.
              </p>
            </div>
          </div>
        </Card>
      </div>
    )
  }

  const filtered = filter === 'all'
    ? formats
    : formats.filter(f => f.applicableTo === filter || f.applicableTo === 'both')

  const totalActive = formats.filter(f => f.isActive).length
  const totalReady = formats.filter(f => f.ready && f.isActive).length
  const totalTournament = formats.filter(f => (f.applicableTo === 'tournament' || f.applicableTo === 'both') && f.isActive).length
  const totalLeague = formats.filter(f => (f.applicableTo === 'league' || f.applicableTo === 'both') && f.isActive).length

  function openNewModal() {
    setForm(EMPTY_FORM)
    setModalOpen(true)
  }

  function openEditModal(fmt: FormatDef) {
    setForm({
      id: fmt.id,
      slug: fmt.value,
      label: fmt.label,
      description: fmt.description,
      applicable_to: fmt.applicableTo,
      generator: fmt.generator,
      min_teams: String(fmt.minTeams),
      max_teams: fmt.maxTeams ? String(fmt.maxTeams) : '',
      uses_groups: fmt.usesGroups ?? false,
      default_group_size: String(fmt.defaultGroupSize ?? 4),
      ready: fmt.ready,
      is_active: fmt.isActive ?? true,
      sort_order: String(fmt.sortOrder ?? 500),
      is_system: fmt.isSystem ?? false,
    })
    setModalOpen(true)
  }

  async function handleSave() {
    if (!form.label.trim()) {
      toast('error', 'El nombre es obligatorio')
      return
    }
    if (!form.slug.trim()) {
      toast('error', 'El identificador (slug) es obligatorio')
      return
    }
    if (!/^[a-z0-9_]+$/.test(form.slug)) {
      toast('error', 'El identificador solo admite minúsculas, números y guion bajo')
      return
    }

    setSaving(true)
    const supabase = createClient()
    const payload = {
      slug: form.slug.trim(),
      label: form.label.trim(),
      description: form.description.trim() || null,
      applicable_to: form.applicable_to,
      generator: form.generator,
      min_teams: Number(form.min_teams) || 2,
      max_teams: form.max_teams ? Number(form.max_teams) : null,
      uses_groups: form.uses_groups,
      default_group_size: Number(form.default_group_size) || 4,
      ready: form.ready,
      is_active: form.is_active,
      sort_order: Number(form.sort_order) || 500,
    }

    let error
    if (form.id) {
      ;({ error } = await supabase.from('nm_game_formats').update(payload).eq('id', form.id))
    } else {
      ;({ error } = await supabase.from('nm_game_formats').insert({ ...payload, club_id: 1 }))
    }

    setSaving(false)
    if (error) {
      toast('error', 'Error al guardar: ' + error.message)
      return
    }
    toast('success', form.id ? 'Formato actualizado' : 'Formato creado')
    setModalOpen(false)
    reload()
  }

  async function toggleActive(fmt: FormatDef) {
    const supabase = createClient()
    const { error } = await supabase
      .from('nm_game_formats')
      .update({ is_active: !fmt.isActive })
      .eq('id', fmt.id!)
    if (error) {
      toast('error', 'Error: ' + error.message)
    } else {
      toast('info', fmt.isActive ? 'Formato desactivado' : 'Formato reactivado')
      reload()
    }
  }

  async function handleDelete() {
    if (!form.id || form.is_system) return
    if (!confirm(`¿Eliminar el formato "${form.label}"? Esta acción no se puede deshacer.`)) return
    const supabase = createClient()
    const { error } = await supabase.from('nm_game_formats').delete().eq('id', form.id)
    if (error) {
      toast('error', 'Error al eliminar: ' + error.message)
    } else {
      toast('info', 'Formato eliminado')
      setModalOpen(false)
      reload()
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white">Formatos de juego</h1>
          <p className="text-sm text-slate-400 mt-1">Catálogo de formatos disponibles para torneos y ligas</p>
        </div>
        <Button onClick={openNewModal}>
          <Plus size={16} className="mr-1" />
          Nuevo formato
        </Button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card><div className="flex items-center justify-between"><span className="text-xs text-slate-400">Activos</span><Layers size={16} className="text-slate-500" /></div><div className="text-2xl font-bold text-white mt-1">{totalActive}</div></Card>
        <Card><div className="flex items-center justify-between"><span className="text-xs text-slate-400">Listos para usar</span><Power size={16} className="text-green-500" /></div><div className="text-2xl font-bold text-white mt-1">{totalReady}</div></Card>
        <Card><div className="flex items-center justify-between"><span className="text-xs text-slate-400">Para torneos</span><Trophy size={16} className="text-cyan-500" /></div><div className="text-2xl font-bold text-white mt-1">{totalTournament}</div></Card>
        <Card><div className="flex items-center justify-between"><span className="text-xs text-slate-400">Para ligas</span><Calendar size={16} className="text-violet-500" /></div><div className="text-2xl font-bold text-white mt-1">{totalLeague}</div></Card>
      </div>

      {/* Filtros */}
      <div className="inline-flex items-center bg-slate-800/60 border border-slate-700/50 rounded-lg p-1">
        {FILTER_TABS.map(t => (
          <button
            key={t.value}
            onClick={() => setFilter(t.value)}
            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
              filter === t.value ? 'bg-cyan-600 text-white' : 'text-slate-400 hover:text-white hover:bg-slate-700/50'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Lista de formatos */}
      {loading ? (
        <div className="text-center py-12 text-slate-500">Cargando formatos…</div>
      ) : filtered.length === 0 ? (
        <Card>
          <div className="text-center py-12 text-slate-500">No hay formatos en esta categoría.</div>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {filtered.map(fmt => (
            <FormatCard
              key={fmt.value}
              fmt={fmt}
              onEdit={() => openEditModal(fmt)}
              onToggleActive={() => toggleActive(fmt)}
            />
          ))}
        </div>
      )}

      {/* Modal crear/editar */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={form.id ? `Editar formato: ${form.label}` : 'Nuevo formato'}
        size="lg"
        footer={
          <div className="flex items-center justify-between w-full">
            <div>
              {form.id && !form.is_system && (
                <Button variant="danger" size="sm" onClick={handleDelete}>
                  Eliminar
                </Button>
              )}
              {form.id && form.is_system && (
                <span className="text-xs text-slate-500">Formato del sistema (no se puede eliminar)</span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Button variant="ghost" onClick={() => setModalOpen(false)} disabled={saving}>
                Cancelar
              </Button>
              <Button onClick={handleSave} loading={saving}>
                {form.id ? 'Guardar' : 'Crear formato'}
              </Button>
            </div>
          </div>
        }
      >
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input
              label="Nombre visible"
              value={form.label}
              onChange={e => setForm({ ...form, label: e.target.value })}
              placeholder="Ej: Torneo Express del Club"
            />
            <Input
              label="Identificador (slug)"
              value={form.slug}
              onChange={e => setForm({ ...form, slug: e.target.value })}
              placeholder="ej: torneo_express"
              disabled={!!form.id && form.is_system}
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">Descripción</label>
            <textarea
              value={form.description}
              onChange={e => setForm({ ...form, description: e.target.value })}
              rows={3}
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-cyan-500"
              placeholder="Cómo funciona este formato, para qué se usa, etc."
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Select
              label="Aplicable a"
              value={form.applicable_to}
              onChange={e => setForm({ ...form, applicable_to: e.target.value as FormatScope })}
              options={SCOPE_OPTIONS}
            />
            <Select
              label="Motor de fixture"
              value={form.generator}
              onChange={e => setForm({ ...form, generator: e.target.value as FormatGenerator })}
              options={GENERATOR_OPTIONS}
            />
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Input
              label="Mín. equipos"
              type="number"
              min="2"
              value={form.min_teams}
              onChange={e => setForm({ ...form, min_teams: e.target.value })}
            />
            <Input
              label="Máx. equipos"
              type="number"
              value={form.max_teams}
              onChange={e => setForm({ ...form, max_teams: e.target.value })}
              placeholder="Sin límite"
            />
            <Input
              label="Tamaño grupo"
              type="number"
              value={form.default_group_size}
              onChange={e => setForm({ ...form, default_group_size: e.target.value })}
              disabled={!form.uses_groups}
            />
            <Input
              label="Orden"
              type="number"
              value={form.sort_order}
              onChange={e => setForm({ ...form, sort_order: e.target.value })}
            />
          </div>

          <div className="space-y-2 pt-2 border-t border-slate-700/50">
            <Checkbox
              label="Usa fase de grupos"
              checked={form.uses_groups}
              onChange={v => setForm({ ...form, uses_groups: v })}
              hint="Si el formato divide a los equipos en pools antes de la eliminación"
            />
            <Checkbox
              label="Listo para usar (generador implementado)"
              checked={form.ready}
              onChange={v => setForm({ ...form, ready: v })}
              hint="Si está marcado, no aparece como Próximamente. Tildalo solo si el motor de fixture realmente funciona."
            />
            <Checkbox
              label="Activo en dropdowns"
              checked={form.is_active}
              onChange={v => setForm({ ...form, is_active: v })}
              hint="Si lo desactivás, deja de aparecer en los modales de crear torneo o liga (pero los torneos existentes que lo usan siguen funcionando)"
            />
          </div>
        </div>
      </Modal>
    </div>
  )
}

function FormatCard({ fmt, onEdit, onToggleActive }: {
  fmt: FormatDef
  onEdit: () => void
  onToggleActive: () => void
}) {
  const teamsRange = fmt.maxTeams
    ? `${fmt.minTeams}–${fmt.maxTeams} equipos`
    : `desde ${fmt.minTeams} equipos`

  const scopeLabel = fmt.applicableTo === 'both'
    ? 'Torneo · Liga'
    : fmt.applicableTo === 'tournament'
    ? 'Torneo'
    : 'Liga'

  return (
    <Card className={!fmt.isActive ? 'opacity-60' : ''}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-base font-semibold text-white truncate">{fmt.label}</h3>
            {fmt.isSystem && <Badge variant="info" className="text-[10px]">Sistema</Badge>}
            {!fmt.isActive && <Badge variant="default" className="text-[10px]">Desactivado</Badge>}
            {fmt.ready ? (
              <Badge variant="success" className="text-[10px]">Listo</Badge>
            ) : (
              <Badge variant="warning" className="text-[10px]">Próximamente</Badge>
            )}
          </div>
          <p className="text-xs text-slate-500 mt-0.5 mb-2">
            <code className="bg-slate-900 px-1 py-0.5 rounded text-[10px]">{fmt.value}</code>
            {' · '}{scopeLabel}{' · '}{teamsRange}
          </p>
          <p className="text-sm text-slate-300 leading-relaxed line-clamp-3">{fmt.description || '—'}</p>
        </div>
      </div>
      <div className="flex items-center justify-between mt-3 pt-3 border-t border-slate-800">
        <span className="text-xs text-slate-500">Motor: <code>{fmt.generator}</code></span>
        <div className="flex items-center gap-1">
          <button
            onClick={onToggleActive}
            className="p-2 rounded-md hover:bg-slate-700/50 text-slate-400 hover:text-white transition-colors"
            title={fmt.isActive ? 'Desactivar' : 'Activar'}
          >
            {fmt.isActive ? <PowerOff size={14} /> : <Power size={14} />}
          </button>
          <button
            onClick={onEdit}
            className="p-2 rounded-md hover:bg-slate-700/50 text-slate-400 hover:text-white transition-colors"
            title="Editar"
          >
            <Pencil size={14} />
          </button>
        </div>
      </div>
    </Card>
  )
}

function Checkbox({ label, checked, onChange, hint }: {
  label: string
  checked: boolean
  onChange: (v: boolean) => void
  hint?: string
}) {
  return (
    <label className="flex items-start gap-2 cursor-pointer py-1">
      <input
        type="checkbox"
        checked={checked}
        onChange={e => onChange(e.target.checked)}
        className="mt-0.5 w-4 h-4 rounded border-slate-600 bg-slate-900 text-cyan-500 focus:ring-cyan-500"
      />
      <div className="flex-1">
        <span className="text-sm text-white">{label}</span>
        {hint && <p className="text-xs text-slate-500 mt-0.5">{hint}</p>}
      </div>
    </label>
  )
}
