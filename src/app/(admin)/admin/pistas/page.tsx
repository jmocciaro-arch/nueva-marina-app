'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  Plus, Edit2, Zap, ZapOff, CheckCircle, XCircle,
  Lightbulb, LightbulbOff, Grid3X3, ChevronDown
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Modal } from '@/components/ui/modal'
import { useToast } from '@/components/ui/toast'
import type { Court, CourtSchedule } from '@/types'

// ─── Constants ────────────────────────────────────────────────────────────────

const CLUB_ID = 1
const SPORT_ID = 1
const VENUE_ID = 1

const DAY_NAMES: Record<number, string> = {
  0: 'Dom',
  1: 'Lun',
  2: 'Mar',
  3: 'Mie',
  4: 'Jue',
  5: 'Vie',
  6: 'Sab',
}

const DAYS = [1, 2, 3, 4, 5, 6, 0] // Lun → Dom

const SURFACE_OPTIONS = [
  { value: '', label: '— Sin especificar —' },
  { value: 'cristal', label: 'Cristal' },
  { value: 'césped_artificial', label: 'Césped artificial' },
  { value: 'hormigon', label: 'Hormigón' },
  { value: 'moqueta', label: 'Moqueta' },
  { value: 'tierra', label: 'Tierra batida' },
]

const TYPE_OPTIONS = [
  { value: '', label: '— Sin especificar —' },
  { value: 'indoor', label: 'Indoor' },
  { value: 'outdoor', label: 'Outdoor' },
  { value: 'panoramica', label: 'Panorámica' },
]

const SLOT_DURATION_OPTIONS = [
  { value: '60', label: '60 min' },
  { value: '90', label: '90 min' },
  { value: '120', label: '120 min' },
]

const COLOR_PRESETS = [
  '#06b6d4', // cyan-500
  '#8b5cf6', // violet-500
  '#f59e0b', // amber-500
  '#10b981', // emerald-500
  '#ef4444', // red-500
  '#3b82f6', // blue-500
  '#ec4899', // pink-500
  '#f97316', // orange-500
]

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatPrice(val?: number | null) {
  if (val == null) return '—'
  return `${val.toFixed(2)} €`
}

function formatTime(t?: string | null) {
  if (!t) return '—'
  return t.slice(0, 5)
}

// ─── Court Form State ─────────────────────────────────────────────────────────

interface CourtFormState {
  name: string
  type: string
  surface: string
  has_lighting: boolean
  is_active: boolean
  color: string
}

const defaultCourtForm: CourtFormState = {
  name: '',
  type: '',
  surface: '',
  has_lighting: false,
  is_active: true,
  color: '#06b6d4',
}

// ─── Schedule Form State ───────────────────────────────────────────────────────

interface ScheduleFormState {
  open_time: string
  close_time: string
  slot_duration: string
  price_per_slot: string
  is_peak: boolean
  peak_price: string
  peak_start: string
  peak_end: string
}

const defaultScheduleForm: ScheduleFormState = {
  open_time: '08:00',
  close_time: '22:00',
  slot_duration: '90',
  price_per_slot: '',
  is_peak: false,
  peak_price: '',
  peak_start: '',
  peak_end: '',
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function ConfigurarPistasPage() {
  const { toast } = useToast()

  // Data
  const [courts, setCourts] = useState<Court[]>([])
  const [schedules, setSchedules] = useState<CourtSchedule[]>([])
  const [loading, setLoading] = useState(true)

  // Court modal
  const [courtModalOpen, setCourtModalOpen] = useState(false)
  const [editingCourt, setEditingCourt] = useState<Court | null>(null)
  const [courtForm, setCourtForm] = useState<CourtFormState>(defaultCourtForm)
  const [savingCourt, setSavingCourt] = useState(false)

  // Schedule modal
  const [scheduleModalOpen, setScheduleModalOpen] = useState(false)
  const [editingSchedule, setEditingSchedule] = useState<CourtSchedule | null>(null)
  const [scheduleTargetCourt, setScheduleTargetCourt] = useState<Court | null>(null)
  const [scheduleTargetDay, setScheduleTargetDay] = useState<number>(1)
  const [scheduleForm, setScheduleForm] = useState<ScheduleFormState>(defaultScheduleForm)
  const [savingSchedule, setSavingSchedule] = useState(false)

  // ── Load data ──────────────────────────────────────────────────────────────

  const loadCourts = useCallback(async () => {
    const supabase = createClient()
    const { data, error } = await supabase
      .from('nm_courts')
      .select('*')
      .eq('club_id', CLUB_ID)
      .order('sort_order', { ascending: true })

    if (error) {
      toast('error', 'Error cargando pistas')
      return
    }
    setCourts(data ?? [])
  }, [toast])

  const loadSchedules = useCallback(async () => {
    const supabase = createClient()
    const { data, error } = await supabase
      .from('nm_court_schedules')
      .select('*')
      .order('day_of_week', { ascending: true })

    if (error) {
      toast('error', 'Error cargando horarios')
      return
    }
    setSchedules(data ?? [])
  }, [toast])

  useEffect(() => {
    async function init() {
      setLoading(true)
      await Promise.all([loadCourts(), loadSchedules()])
      setLoading(false)
    }
    init()
  }, [loadCourts, loadSchedules])

  // ── Court modal handlers ───────────────────────────────────────────────────

  function openNewCourt() {
    setEditingCourt(null)
    setCourtForm(defaultCourtForm)
    setCourtModalOpen(true)
  }

  function openEditCourt(court: Court) {
    setEditingCourt(court)
    setCourtForm({
      name: court.name,
      type: court.type ?? '',
      surface: court.surface ?? '',
      has_lighting: court.has_lighting,
      is_active: court.is_active,
      color: court.color,
    })
    setCourtModalOpen(true)
  }

  function closeCourtModal() {
    setCourtModalOpen(false)
    setEditingCourt(null)
  }

  async function saveCourt() {
    if (!courtForm.name.trim()) {
      toast('warning', 'El nombre de la pista es obligatorio')
      return
    }

    setSavingCourt(true)
    const supabase = createClient()

    if (editingCourt) {
      const { error } = await supabase
        .from('nm_courts')
        .update({
          name: courtForm.name.trim(),
          type: courtForm.type || null,
          surface: courtForm.surface || null,
          has_lighting: courtForm.has_lighting,
          is_active: courtForm.is_active,
          color: courtForm.color,
        })
        .eq('id', editingCourt.id)

      if (error) {
        toast('error', 'Error guardando la pista')
      } else {
        toast('success', 'Pista actualizada correctamente')
        closeCourtModal()
        loadCourts()
      }
    } else {
      const maxOrder = courts.length > 0 ? Math.max(...courts.map(c => c.sort_order)) + 1 : 1
      const { error } = await supabase
        .from('nm_courts')
        .insert({
          club_id: CLUB_ID,
          venue_id: VENUE_ID,
          sport_id: SPORT_ID,
          name: courtForm.name.trim(),
          type: courtForm.type || null,
          surface: courtForm.surface || null,
          has_lighting: courtForm.has_lighting,
          is_active: courtForm.is_active,
          color: courtForm.color,
          sort_order: maxOrder,
          config: {},
        })

      if (error) {
        toast('error', 'Error creando la pista')
      } else {
        toast('success', 'Pista creada correctamente')
        closeCourtModal()
        loadCourts()
      }
    }

    setSavingCourt(false)
  }

  // ── Bulk pricing modal ──────────────────────────────────────────────────────

  const [bulkOpen, setBulkOpen] = useState(false)
  const [bulkSaving, setBulkSaving] = useState(false)
  const [bulkForm, setBulkForm] = useState({
    open_time: '08:00',
    close_time: '00:00',
    slot_duration: '90',
    price_per_slot: '24',
    is_peak: true,
    peak_price: '30',
    peak_start: '17:00',
    peak_end: '21:00',
    apply_to: 'all' as 'all' | 'selected',
    selected_courts: [] as number[],
    selected_days: [1, 2, 3, 4, 5, 6, 0] as number[],
  })

  function toggleBulkDay(day: number) {
    setBulkForm(f => ({
      ...f,
      selected_days: f.selected_days.includes(day)
        ? f.selected_days.filter(d => d !== day)
        : [...f.selected_days, day],
    }))
  }

  function toggleBulkCourt(courtId: number) {
    setBulkForm(f => ({
      ...f,
      selected_courts: f.selected_courts.includes(courtId)
        ? f.selected_courts.filter(id => id !== courtId)
        : [...f.selected_courts, courtId],
    }))
  }

  async function saveBulkPricing() {
    const targetCourts = bulkForm.apply_to === 'all'
      ? courts
      : courts.filter(c => bulkForm.selected_courts.includes(c.id))

    if (targetCourts.length === 0) {
      toast('warning', 'Seleccioná al menos una pista')
      return
    }
    if (bulkForm.selected_days.length === 0) {
      toast('warning', 'Seleccioná al menos un día')
      return
    }

    setBulkSaving(true)
    const supabase = createClient()
    let successCount = 0
    let errorCount = 0

    for (const court of targetCourts) {
      for (const day of bulkForm.selected_days) {
        const existing = schedules.find(
          s => s.court_id === court.id && s.day_of_week === day
        )

        const payload = {
          court_id: court.id,
          day_of_week: day,
          open_time: bulkForm.open_time,
          close_time: bulkForm.close_time,
          slot_duration: parseInt(bulkForm.slot_duration) || 90,
          price_per_slot: bulkForm.price_per_slot ? parseFloat(bulkForm.price_per_slot) : null,
          is_peak: bulkForm.is_peak,
          peak_price: bulkForm.is_peak && bulkForm.peak_price ? parseFloat(bulkForm.peak_price) : null,
          peak_start: bulkForm.is_peak ? bulkForm.peak_start || null : null,
          peak_end: bulkForm.is_peak ? bulkForm.peak_end || null : null,
        }

        const { error } = existing
          ? await supabase.from('nm_court_schedules').update(payload).eq('id', existing.id)
          : await supabase.from('nm_court_schedules').insert(payload)

        if (error) errorCount++
        else successCount++
      }
    }

    if (errorCount > 0) {
      toast('warning', `${successCount} horarios guardados, ${errorCount} con error`)
    } else {
      toast('success', `${successCount} horarios actualizados de una vez`)
    }

    setBulkOpen(false)
    loadSchedules()
    setBulkSaving(false)
  }

  // ── Schedule modal handlers ────────────────────────────────────────────────

  function openScheduleCell(court: Court, day: number) {
    const existing = schedules.find(
      s => s.court_id === court.id && s.day_of_week === day
    )
    setScheduleTargetCourt(court)
    setScheduleTargetDay(day)
    setEditingSchedule(existing ?? null)
    setScheduleForm(
      existing
        ? {
            open_time: existing.open_time.slice(0, 5),
            close_time: existing.close_time.slice(0, 5),
            slot_duration: String(existing.slot_duration),
            price_per_slot: existing.price_per_slot != null ? String(existing.price_per_slot) : '',
            is_peak: existing.is_peak,
            peak_price: existing.peak_price != null ? String(existing.peak_price) : '',
            peak_start: existing.peak_start ? existing.peak_start.slice(0, 5) : '',
            peak_end: existing.peak_end ? existing.peak_end.slice(0, 5) : '',
          }
        : defaultScheduleForm
    )
    setScheduleModalOpen(true)
  }

  function closeScheduleModal() {
    setScheduleModalOpen(false)
    setEditingSchedule(null)
    setScheduleTargetCourt(null)
  }

  async function saveSchedule() {
    if (!scheduleTargetCourt) return
    if (!scheduleForm.open_time || !scheduleForm.close_time) {
      toast('warning', 'Hora de apertura y cierre son obligatorias')
      return
    }

    setSavingSchedule(true)
    const supabase = createClient()

    const payload = {
      court_id: scheduleTargetCourt.id,
      day_of_week: scheduleTargetDay,
      open_time: scheduleForm.open_time,
      close_time: scheduleForm.close_time,
      slot_duration: parseInt(scheduleForm.slot_duration) || 90,
      price_per_slot: scheduleForm.price_per_slot ? parseFloat(scheduleForm.price_per_slot) : null,
      is_peak: scheduleForm.is_peak,
      peak_price: scheduleForm.peak_price ? parseFloat(scheduleForm.peak_price) : null,
      peak_start: scheduleForm.peak_start || null,
      peak_end: scheduleForm.peak_end || null,
    }

    if (editingSchedule) {
      const { error } = await supabase
        .from('nm_court_schedules')
        .update(payload)
        .eq('id', editingSchedule.id)

      if (error) {
        toast('error', 'Error guardando el horario')
      } else {
        toast('success', 'Horario actualizado')
        closeScheduleModal()
        loadSchedules()
      }
    } else {
      const { error } = await supabase
        .from('nm_court_schedules')
        .insert(payload)

      if (error) {
        toast('error', 'Error creando el horario')
      } else {
        toast('success', 'Horario creado')
        closeScheduleModal()
        loadSchedules()
      }
    }

    setSavingSchedule(false)
  }

  async function deleteSchedule() {
    if (!editingSchedule) return
    setSavingSchedule(true)
    const supabase = createClient()

    const { error } = await supabase
      .from('nm_court_schedules')
      .delete()
      .eq('id', editingSchedule.id)

    if (error) {
      toast('error', 'Error eliminando el horario')
    } else {
      toast('success', 'Horario eliminado')
      closeScheduleModal()
      loadSchedules()
    }
    setSavingSchedule(false)
  }

  // ─── Render ──────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Configurar Pistas</h1>
          <p className="text-sm text-slate-400 mt-1">Gestiona pistas, horarios y disponibilidad</p>
        </div>
        <div className="flex items-center justify-center py-24">
          <svg className="animate-spin h-8 w-8 text-cyan-500" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Configurar Pistas</h1>
          <p className="text-sm text-slate-400 mt-1">Gestiona pistas, horarios y disponibilidad</p>
        </div>
        <Button onClick={openNewCourt} size="md">
          <Plus size={16} />
          Nueva pista
        </Button>
      </div>

      {/* ── Courts Grid ────────────────────────────────────────────────────── */}
      <section>
        <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-2">
          <Grid3X3 size={14} />
          Pistas ({courts.length})
        </h2>

        {courts.length === 0 ? (
          <div className="rounded-xl border border-slate-700/50 bg-slate-800/50 p-12 text-center">
            <p className="text-slate-400">No hay pistas creadas todavía.</p>
            <Button onClick={openNewCourt} variant="outline" size="sm" className="mt-4">
              <Plus size={14} /> Crear primera pista
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            {courts.map(court => (
              <CourtCard
                key={court.id}
                court={court}
                onEdit={() => openEditCourt(court)}
              />
            ))}
          </div>
        )}
      </section>

      {/* ── Schedules Grid ─────────────────────────────────────────────────── */}
      {courts.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider">
              Horarios por pista y día
            </h2>
            <Button variant="secondary" size="sm" onClick={() => setBulkOpen(true)}>
              <Zap size={14} />
              Precios Masivos
            </Button>
          </div>
          <div className="rounded-xl border border-slate-700/50 bg-slate-800/50 overflow-x-auto">
            <table className="w-full text-sm min-w-[640px]">
              <thead>
                <tr className="border-b border-slate-700/60">
                  <th className="px-4 py-3 text-left text-slate-400 font-medium w-32">Pista</th>
                  {DAYS.map(d => (
                    <th key={d} className="px-3 py-3 text-center text-slate-400 font-medium">
                      {DAY_NAMES[d]}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {courts.map((court, idx) => (
                  <tr
                    key={court.id}
                    className={idx < courts.length - 1 ? 'border-b border-slate-700/40' : ''}
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span
                          className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                          style={{ backgroundColor: court.color }}
                        />
                        <span className="text-white font-medium truncate">{court.name}</span>
                      </div>
                    </td>
                    {DAYS.map(d => {
                      const sched = schedules.find(
                        s => s.court_id === court.id && s.day_of_week === d
                      )
                      return (
                        <td key={d} className="px-2 py-2 text-center">
                          <button
                            onClick={() => openScheduleCell(court, d)}
                            className={`
                              w-full rounded-lg px-2 py-2 text-xs transition-all
                              ${sched
                                ? 'bg-slate-700/60 hover:bg-slate-700 border border-slate-600/50 hover:border-cyan-500/50'
                                : 'border border-dashed border-slate-700 hover:border-slate-500 text-slate-600 hover:text-slate-400'
                              }
                            `}
                          >
                            {sched ? (
                              <div className="space-y-0.5">
                                <div className="text-white font-medium">
                                  {formatTime(sched.open_time)}–{formatTime(sched.close_time)}
                                </div>
                                <div className="text-slate-400">{formatPrice(sched.price_per_slot)}</div>
                                {sched.is_peak && (
                                  <div className="text-amber-400 text-[10px]">Pico: {formatPrice(sched.peak_price)}</div>
                                )}
                              </div>
                            ) : (
                              <span className="text-[10px]">+ Agregar</span>
                            )}
                          </button>
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* ── Court Modal ────────────────────────────────────────────────────── */}
      <Modal
        open={courtModalOpen}
        onClose={closeCourtModal}
        title={editingCourt ? `Editar: ${editingCourt.name}` : 'Nueva pista'}
        size="md"
        footer={
          <>
            <Button variant="secondary" onClick={closeCourtModal} disabled={savingCourt}>
              Cancelar
            </Button>
            <Button onClick={saveCourt} loading={savingCourt}>
              {editingCourt ? 'Guardar cambios' : 'Crear pista'}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Input
            id="court-name"
            label="Nombre de la pista"
            placeholder="Ej: Pista 1"
            value={courtForm.name}
            onChange={e => setCourtForm(f => ({ ...f, name: e.target.value }))}
          />

          <div className="grid grid-cols-2 gap-3">
            <Select
              id="court-type"
              label="Tipo"
              options={TYPE_OPTIONS}
              value={courtForm.type}
              onChange={e => setCourtForm(f => ({ ...f, type: e.target.value }))}
            />
            <Select
              id="court-surface"
              label="Superficie"
              options={SURFACE_OPTIONS}
              value={courtForm.surface}
              onChange={e => setCourtForm(f => ({ ...f, surface: e.target.value }))}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="block text-sm font-medium text-slate-300">Iluminación</label>
              <button
                type="button"
                onClick={() => setCourtForm(f => ({ ...f, has_lighting: !f.has_lighting }))}
                className={`
                  flex items-center gap-2 w-full rounded-lg border px-3 py-2 text-sm transition-colors
                  ${courtForm.has_lighting
                    ? 'border-cyan-500/50 bg-cyan-500/10 text-cyan-300'
                    : 'border-slate-600 bg-slate-800 text-slate-400'
                  }
                `}
              >
                {courtForm.has_lighting ? <Lightbulb size={15} /> : <LightbulbOff size={15} />}
                {courtForm.has_lighting ? 'Con iluminación' : 'Sin iluminación'}
              </button>
            </div>

            <div className="space-y-1">
              <label className="block text-sm font-medium text-slate-300">Estado</label>
              <button
                type="button"
                onClick={() => setCourtForm(f => ({ ...f, is_active: !f.is_active }))}
                className={`
                  flex items-center gap-2 w-full rounded-lg border px-3 py-2 text-sm transition-colors
                  ${courtForm.is_active
                    ? 'border-green-500/50 bg-green-500/10 text-green-300'
                    : 'border-slate-600 bg-slate-800 text-slate-400'
                  }
                `}
              >
                {courtForm.is_active ? <CheckCircle size={15} /> : <XCircle size={15} />}
                {courtForm.is_active ? 'Activa' : 'Inactiva'}
              </button>
            </div>
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-medium text-slate-300">Color de la pista</label>
            <div className="flex flex-wrap gap-2 items-center">
              {COLOR_PRESETS.map(c => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setCourtForm(f => ({ ...f, color: c }))}
                  className={`
                    w-7 h-7 rounded-full border-2 transition-all
                    ${courtForm.color === c ? 'border-white scale-110' : 'border-transparent hover:scale-105'}
                  `}
                  style={{ backgroundColor: c }}
                  title={c}
                />
              ))}
              <div className="flex items-center gap-1 ml-1">
                <input
                  type="color"
                  value={courtForm.color}
                  onChange={e => setCourtForm(f => ({ ...f, color: e.target.value }))}
                  className="w-7 h-7 rounded cursor-pointer border border-slate-600 bg-transparent"
                  title="Color personalizado"
                />
                <span className="text-xs text-slate-500 font-mono">{courtForm.color}</span>
              </div>
            </div>
          </div>
        </div>
      </Modal>

      {/* ── Bulk Pricing Modal ──────────────────────────────────────────────── */}
      <Modal
        open={bulkOpen}
        onClose={() => setBulkOpen(false)}
        title="Precios Masivos"
        size="md"
        footer={
          <>
            <Button variant="secondary" onClick={() => setBulkOpen(false)} disabled={bulkSaving}>Cancelar</Button>
            <Button onClick={saveBulkPricing} loading={bulkSaving}>
              <Zap size={14} /> Aplicar a {bulkForm.apply_to === 'all' ? 'todas las pistas' : `${bulkForm.selected_courts.length} pista(s)`}
            </Button>
          </>
        }
      >
        <div className="space-y-5">
          <p className="text-sm text-slate-400">
            Configurá horario y precios una vez y aplicalo a todas las pistas y días que quieras.
          </p>

          {/* Horario */}
          <div className="grid grid-cols-3 gap-3">
            <Input id="bulk-open" type="time" label="Apertura" value={bulkForm.open_time} onChange={e => setBulkForm(f => ({ ...f, open_time: e.target.value }))} />
            <Input id="bulk-close" type="time" label="Cierre" value={bulkForm.close_time} onChange={e => setBulkForm(f => ({ ...f, close_time: e.target.value }))} />
            <Select id="bulk-duration" label="Duración slot" options={SLOT_DURATION_OPTIONS} value={bulkForm.slot_duration} onChange={e => setBulkForm(f => ({ ...f, slot_duration: e.target.value }))} />
          </div>

          {/* Precios */}
          <div className="grid grid-cols-2 gap-3">
            <Input id="bulk-price" type="number" label="Precio normal (€)" placeholder="24.00" min="0" step="0.5" value={bulkForm.price_per_slot} onChange={e => setBulkForm(f => ({ ...f, price_per_slot: e.target.value }))} />
            <Input id="bulk-peak" type="number" label="Precio pico (€)" placeholder="30.00" min="0" step="0.5" value={bulkForm.peak_price} onChange={e => setBulkForm(f => ({ ...f, peak_price: e.target.value }))} />
          </div>

          {/* Horario pico */}
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 text-sm text-slate-300 cursor-pointer">
              <input type="checkbox" checked={bulkForm.is_peak} onChange={e => setBulkForm(f => ({ ...f, is_peak: e.target.checked }))} className="rounded border-slate-600 bg-slate-800 text-cyan-500 focus:ring-cyan-500" />
              <Zap size={14} className="text-amber-400" /> Horario pico
            </label>
            {bulkForm.is_peak && (
              <div className="flex items-center gap-2 text-sm">
                <input type="time" value={bulkForm.peak_start} onChange={e => setBulkForm(f => ({ ...f, peak_start: e.target.value }))} className="bg-slate-800 border border-slate-600 rounded px-2 py-1 text-white text-sm w-24" />
                <span className="text-slate-500">a</span>
                <input type="time" value={bulkForm.peak_end} onChange={e => setBulkForm(f => ({ ...f, peak_end: e.target.value }))} className="bg-slate-800 border border-slate-600 rounded px-2 py-1 text-white text-sm w-24" />
              </div>
            )}
          </div>

          {/* Seleccionar días */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Días</label>
            <div className="flex gap-2">
              {DAYS.map(d => (
                <button
                  key={d}
                  type="button"
                  onClick={() => toggleBulkDay(d)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${bulkForm.selected_days.includes(d) ? 'bg-cyan-600 text-white' : 'bg-slate-700/50 text-slate-400 hover:text-white'}`}
                >
                  {DAY_NAMES[d]}
                </button>
              ))}
              <button
                type="button"
                onClick={() => setBulkForm(f => ({ ...f, selected_days: f.selected_days.length === 7 ? [] : [1, 2, 3, 4, 5, 6, 0] }))}
                className="px-2 py-1.5 rounded-lg text-[10px] font-medium bg-slate-700/30 text-slate-500 hover:text-white"
              >
                {bulkForm.selected_days.length === 7 ? 'Ninguno' : 'Todos'}
              </button>
            </div>
          </div>

          {/* Seleccionar pistas */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Pistas</label>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setBulkForm(f => ({ ...f, apply_to: 'all', selected_courts: [] }))}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${bulkForm.apply_to === 'all' ? 'bg-cyan-600 text-white' : 'bg-slate-700/50 text-slate-400 hover:text-white'}`}
              >
                Todas
              </button>
              {courts.map(c => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => { setBulkForm(f => ({ ...f, apply_to: 'selected' })); toggleBulkCourt(c.id) }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5 ${bulkForm.apply_to === 'selected' && bulkForm.selected_courts.includes(c.id) ? 'bg-cyan-600 text-white' : 'bg-slate-700/50 text-slate-400 hover:text-white'}`}
                >
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: c.color }} />
                  {c.name}
                </button>
              ))}
            </div>
          </div>

          {/* Preview */}
          <div className="bg-slate-700/20 rounded-lg p-3 text-xs text-slate-400">
            Se actualizarán <span className="text-white font-medium">{(bulkForm.apply_to === 'all' ? courts.length : bulkForm.selected_courts.length) * bulkForm.selected_days.length}</span> horarios:
            {' '}{bulkForm.apply_to === 'all' ? 'todas las pistas' : `${bulkForm.selected_courts.length} pista(s)`} × {bulkForm.selected_days.length} día(s)
          </div>
        </div>
      </Modal>

      {/* ── Schedule Modal ─────────────────────────────────────────────────── */}
      <Modal
        open={scheduleModalOpen}
        onClose={closeScheduleModal}
        title={
          scheduleTargetCourt
            ? `Horario — ${scheduleTargetCourt.name} — ${DAY_NAMES[scheduleTargetDay]}`
            : 'Editar horario'
        }
        size="md"
        footer={
          <div className="flex items-center justify-between w-full">
            <div>
              {editingSchedule && (
                <Button variant="danger" onClick={deleteSchedule} disabled={savingSchedule}>
                  Eliminar horario
                </Button>
              )}
            </div>
            <div className="flex gap-2">
              <Button variant="secondary" onClick={closeScheduleModal} disabled={savingSchedule}>
                Cancelar
              </Button>
              <Button onClick={saveSchedule} loading={savingSchedule}>
                {editingSchedule ? 'Guardar cambios' : 'Crear horario'}
              </Button>
            </div>
          </div>
        }
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Input
              id="sched-open"
              type="time"
              label="Hora de apertura"
              value={scheduleForm.open_time}
              onChange={e => setScheduleForm(f => ({ ...f, open_time: e.target.value }))}
            />
            <Input
              id="sched-close"
              type="time"
              label="Hora de cierre"
              value={scheduleForm.close_time}
              onChange={e => setScheduleForm(f => ({ ...f, close_time: e.target.value }))}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Select
              id="sched-duration"
              label="Duración del slot"
              options={SLOT_DURATION_OPTIONS}
              value={scheduleForm.slot_duration}
              onChange={e => setScheduleForm(f => ({ ...f, slot_duration: e.target.value }))}
            />
            <Input
              id="sched-price"
              type="number"
              label="Precio por slot (€)"
              placeholder="Ej: 12.00"
              min="0"
              step="0.5"
              value={scheduleForm.price_per_slot}
              onChange={e => setScheduleForm(f => ({ ...f, price_per_slot: e.target.value }))}
            />
          </div>

          <div className="space-y-3 rounded-lg border border-slate-700 p-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-slate-300 flex items-center gap-1.5">
                <Zap size={14} className="text-amber-400" />
                Horario pico
              </span>
              <button
                type="button"
                onClick={() => setScheduleForm(f => ({ ...f, is_peak: !f.is_peak }))}
                className={`
                  relative inline-flex h-5 w-9 items-center rounded-full transition-colors
                  ${scheduleForm.is_peak ? 'bg-amber-500' : 'bg-slate-600'}
                `}
              >
                <span
                  className={`
                    inline-block h-4 w-4 rounded-full bg-white shadow transition-transform
                    ${scheduleForm.is_peak ? 'translate-x-4.5' : 'translate-x-0.5'}
                  `}
                />
              </button>
            </div>

            {scheduleForm.is_peak && (
              <div className="grid grid-cols-3 gap-3">
                <Input
                  id="peak-start"
                  type="time"
                  label="Inicio pico"
                  value={scheduleForm.peak_start}
                  onChange={e => setScheduleForm(f => ({ ...f, peak_start: e.target.value }))}
                />
                <Input
                  id="peak-end"
                  type="time"
                  label="Fin pico"
                  value={scheduleForm.peak_end}
                  onChange={e => setScheduleForm(f => ({ ...f, peak_end: e.target.value }))}
                />
                <Input
                  id="peak-price"
                  type="number"
                  label="Precio pico (€)"
                  placeholder="Ej: 16.00"
                  min="0"
                  step="0.5"
                  value={scheduleForm.peak_price}
                  onChange={e => setScheduleForm(f => ({ ...f, peak_price: e.target.value }))}
                />
              </div>
            )}
          </div>
        </div>
      </Modal>
    </div>
  )
}

// ─── Court Card Sub-component ─────────────────────────────────────────────────

function CourtCard({ court, onEdit }: { court: Court; onEdit: () => void }) {
  return (
    <div
      className="relative rounded-xl border border-slate-700/50 bg-slate-800/60 overflow-hidden cursor-pointer group hover:border-slate-600 transition-all"
      onClick={onEdit}
    >
      {/* Color accent bar */}
      <div
        className="absolute top-0 left-0 right-0 h-1"
        style={{ backgroundColor: court.color }}
      />

      <div className="p-5 pt-6">
        {/* Header row */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-2">
            <span
              className="w-3 h-3 rounded-full flex-shrink-0"
              style={{ backgroundColor: court.color }}
            />
            <h3 className="text-white font-semibold text-base leading-tight">{court.name}</h3>
          </div>
          <button
            onClick={e => { e.stopPropagation(); onEdit() }}
            className="opacity-0 group-hover:opacity-100 transition-opacity text-slate-400 hover:text-white p-1 rounded"
            title="Editar pista"
          >
            <Edit2 size={14} />
          </button>
        </div>

        {/* Attributes */}
        <div className="space-y-1.5 text-xs">
          {court.type && (
            <div className="flex items-center justify-between">
              <span className="text-slate-500">Tipo</span>
              <span className="text-slate-300 capitalize">{court.type}</span>
            </div>
          )}
          {court.surface && (
            <div className="flex items-center justify-between">
              <span className="text-slate-500">Superficie</span>
              <span className="text-slate-300 capitalize">{court.surface.replace(/_/g, ' ')}</span>
            </div>
          )}
          <div className="flex items-center justify-between">
            <span className="text-slate-500">Iluminación</span>
            <span className={`flex items-center gap-1 ${court.has_lighting ? 'text-cyan-400' : 'text-slate-500'}`}>
              {court.has_lighting ? <Lightbulb size={12} /> : <LightbulbOff size={12} />}
              {court.has_lighting ? 'Sí' : 'No'}
            </span>
          </div>
        </div>

        {/* Status badge */}
        <div className="mt-4 pt-3 border-t border-slate-700/50 flex items-center justify-between">
          <span
            className={`
              inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium
              ${court.is_active
                ? 'bg-green-500/15 text-green-400 border border-green-500/20'
                : 'bg-slate-700/50 text-slate-500 border border-slate-600/30'
              }
            `}
          >
            {court.is_active ? <CheckCircle size={10} /> : <XCircle size={10} />}
            {court.is_active ? 'Activa' : 'Inactiva'}
          </span>
          <span className="text-[10px] text-slate-600">#{court.sort_order}</span>
        </div>
      </div>
    </div>
  )
}
