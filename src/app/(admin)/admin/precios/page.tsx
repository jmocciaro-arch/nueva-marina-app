'use client'

import { useCallback, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Modal } from '@/components/ui/modal'
import { Badge } from '@/components/ui/badge'
import { KpiCard } from '@/components/ui/kpi-card'
import { useToast } from '@/components/ui/toast'
import {
  DollarSign, Plus, Edit2, Trash2, Zap, Sun, Moon,
  Clock, Users, Trophy, Medal, CreditCard, Settings2,
  Lightbulb, Save, RefreshCw
} from 'lucide-react'

const CLUB_ID = 1

const BOOKING_TYPES: Record<string, { label: string; color: 'default' | 'info' | 'success' | 'warning' | 'danger'; icon: React.ReactNode }> = {
  normal: { label: 'Normal', color: 'default', icon: <Clock size={12} /> },
  abono: { label: 'Abono', color: 'success', icon: <CreditCard size={12} /> },
  liga: { label: 'Liga', color: 'info', icon: <Medal size={12} /> },
  torneo: { label: 'Torneo', color: 'warning', icon: <Trophy size={12} /> },
  clase: { label: 'Clase', color: 'default', icon: <Users size={12} /> },
  evento: { label: 'Evento', color: 'danger', icon: <Zap size={12} /> },
}

const DURATION_OPTIONS = [
  { value: '60', label: '1 hora' },
  { value: '90', label: '1 hora y media' },
  { value: '120', label: '2 horas' },
  { value: '30', label: '30 minutos' },
  { value: '45', label: '45 minutos' },
]

const DAY_NAMES: Record<number, string> = { 0: 'Dom', 1: 'Lun', 2: 'Mar', 3: 'Mie', 4: 'Jue', 5: 'Vie', 6: 'Sab' }

interface PricingRule {
  id: number
  name: string
  duration_minutes: number
  base_price: number
  lighting_surcharge: number
  booking_type: string
  discount_pct: number
  fixed_price: number | null
  peak_surcharge: number
  is_active: boolean
  priority: number
  notes: string | null
}

interface PricingConfig {
  id: number
  peak_start: string
  peak_end: string
  peak_days: number[]
  weekend_surcharge: number
  holiday_surcharge: number
  min_advance_hours: number
  max_advance_days: number
  cancellation_hours: number
}

export default function PreciosPage() {
  const { toast } = useToast()

  const [rules, setRules] = useState<PricingRule[]>([])
  const [config, setConfig] = useState<PricingConfig | null>(null)
  const [loading, setLoading] = useState(true)

  // Rule modal
  const [ruleOpen, setRuleOpen] = useState(false)
  const [editRule, setEditRule] = useState<PricingRule | null>(null)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    name: '', duration_minutes: '90', base_price: '', lighting_surcharge: '4',
    booking_type: 'normal', discount_pct: '0', fixed_price: '',
    peak_surcharge: '0', is_active: true, priority: '0', notes: '',
  })

  // Config saving
  const [savingConfig, setSavingConfig] = useState(false)
  const [configForm, setConfigForm] = useState({
    peak_start: '17:00', peak_end: '21:00', peak_days: [1, 2, 3, 4, 5] as number[],
    weekend_surcharge: '0', holiday_surcharge: '0',
    min_advance_hours: '2', max_advance_days: '14', cancellation_hours: '12',
  })

  // Load data
  const loadData = useCallback(async () => {
    setLoading(true)
    const supabase = createClient()
    const [rulesRes, configRes] = await Promise.all([
      supabase.from('nm_pricing_rules').select('*').eq('club_id', CLUB_ID).order('booking_type').order('duration_minutes'),
      supabase.from('nm_pricing_config').select('*').eq('club_id', CLUB_ID).single(),
    ])
    setRules((rulesRes.data ?? []) as PricingRule[])
    if (configRes.data) {
      const c = configRes.data as PricingConfig
      setConfig(c)
      setConfigForm({
        peak_start: c.peak_start?.slice(0, 5) || '17:00',
        peak_end: c.peak_end?.slice(0, 5) || '21:00',
        peak_days: c.peak_days || [1, 2, 3, 4, 5],
        weekend_surcharge: String(c.weekend_surcharge || 0),
        holiday_surcharge: String(c.holiday_surcharge || 0),
        min_advance_hours: String(c.min_advance_hours || 2),
        max_advance_days: String(c.max_advance_days || 14),
        cancellation_hours: String(c.cancellation_hours || 12),
      })
    }
    setLoading(false)
  }, [])

  useEffect(() => { loadData() }, [loadData])

  // Group rules by booking type
  const groupedRules = rules.reduce<Record<string, PricingRule[]>>((acc, r) => {
    if (!acc[r.booking_type]) acc[r.booking_type] = []
    acc[r.booking_type].push(r)
    return acc
  }, {})

  // Open new rule
  function openNewRule(type: string = 'normal') {
    setEditRule(null)
    setForm({
      name: '', duration_minutes: '90', base_price: '', lighting_surcharge: '4',
      booking_type: type, discount_pct: '0', fixed_price: '',
      peak_surcharge: '0', is_active: true, priority: '0', notes: '',
    })
    setRuleOpen(true)
  }

  function openEditRule(r: PricingRule) {
    setEditRule(r)
    setForm({
      name: r.name, duration_minutes: String(r.duration_minutes),
      base_price: String(r.base_price), lighting_surcharge: String(r.lighting_surcharge),
      booking_type: r.booking_type, discount_pct: String(r.discount_pct),
      fixed_price: r.fixed_price != null ? String(r.fixed_price) : '',
      peak_surcharge: String(r.peak_surcharge), is_active: r.is_active,
      priority: String(r.priority), notes: r.notes || '',
    })
    setRuleOpen(true)
  }

  async function saveRule() {
    if (!form.name || !form.base_price) {
      toast('warning', 'Nombre y precio base son obligatorios')
      return
    }
    setSaving(true)
    const supabase = createClient()
    const payload = {
      club_id: CLUB_ID,
      name: form.name,
      duration_minutes: parseInt(form.duration_minutes),
      base_price: parseFloat(form.base_price),
      lighting_surcharge: parseFloat(form.lighting_surcharge) || 0,
      booking_type: form.booking_type,
      discount_pct: parseFloat(form.discount_pct) || 0,
      fixed_price: form.fixed_price ? parseFloat(form.fixed_price) : null,
      peak_surcharge: parseFloat(form.peak_surcharge) || 0,
      is_active: form.is_active,
      priority: parseInt(form.priority) || 0,
      notes: form.notes || null,
    }

    const { error } = editRule
      ? await supabase.from('nm_pricing_rules').update(payload).eq('id', editRule.id)
      : await supabase.from('nm_pricing_rules').insert(payload)

    if (error) toast('error', 'Error guardando regla')
    else {
      toast('success', editRule ? 'Regla actualizada' : 'Regla creada')
      setRuleOpen(false)
      loadData()
    }
    setSaving(false)
  }

  async function deleteRule() {
    if (!editRule) return
    setSaving(true)
    const supabase = createClient()
    const { error } = await supabase.from('nm_pricing_rules').delete().eq('id', editRule.id)
    if (error) toast('error', 'Error eliminando')
    else {
      toast('success', 'Regla eliminada')
      setRuleOpen(false)
      loadData()
    }
    setSaving(false)
  }

  // Save config
  async function saveConfig() {
    setSavingConfig(true)
    const supabase = createClient()
    const payload = {
      peak_start: configForm.peak_start,
      peak_end: configForm.peak_end,
      peak_days: configForm.peak_days,
      weekend_surcharge: parseFloat(configForm.weekend_surcharge) || 0,
      holiday_surcharge: parseFloat(configForm.holiday_surcharge) || 0,
      min_advance_hours: parseInt(configForm.min_advance_hours) || 2,
      max_advance_days: parseInt(configForm.max_advance_days) || 14,
      cancellation_hours: parseInt(configForm.cancellation_hours) || 12,
      updated_at: new Date().toISOString(),
    }

    const { error } = config
      ? await supabase.from('nm_pricing_config').update(payload).eq('id', config.id)
      : await supabase.from('nm_pricing_config').insert({ ...payload, club_id: CLUB_ID })

    if (error) toast('error', 'Error guardando configuración')
    else {
      toast('success', 'Configuración guardada')
      loadData()
    }
    setSavingConfig(false)
  }

  function togglePeakDay(day: number) {
    setConfigForm(f => ({
      ...f,
      peak_days: f.peak_days.includes(day) ? f.peak_days.filter(d => d !== day) : [...f.peak_days, day],
    }))
  }

  function formatDuration(min: number) {
    if (min === 60) return '1h'
    if (min === 90) return '1h30'
    if (min === 120) return '2h'
    if (min === 30) return '30min'
    if (min === 45) return '45min'
    return `${min}min`
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-white">Configuración de Precios</h1>
        <div className="flex items-center justify-center py-24">
          <div className="w-8 h-8 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin" />
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Configuración de Precios</h1>
          <p className="text-sm text-slate-400 mt-1">Tarifas por duración, tipo de reserva, luz y horario pico</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" onClick={loadData}><RefreshCw size={14} /></Button>
          <Button size="sm" onClick={() => openNewRule('normal')}><Plus size={14} /> Nueva Tarifa</Button>
        </div>
      </div>

      {/* KPIs - Resumen rápido */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <KpiCard title="Tarifas" value={rules.length} subtitle="reglas de precio" icon={<DollarSign size={20} />} color="#06b6d4" />
        <KpiCard title="Activas" value={rules.filter(r => r.is_active).length} subtitle="en uso" icon={<Zap size={20} />} color="#22c55e" />
        <KpiCard title="Tipos" value={Object.keys(groupedRules).length} subtitle="categorías" icon={<Settings2 size={20} />} color="#f59e0b" />
        <KpiCard title="Pico" value={config ? `${config.peak_start?.slice(0, 5)}-${config.peak_end?.slice(0, 5)}` : '—'} subtitle="horario pico" icon={<Sun size={20} />} color="#ef4444" />
      </div>

      {/* ── Tabla de precios visual ─────────────────────────────────────────── */}
      <section>
        <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-4">Tarifas por tipo de reserva</h2>

        {Object.entries(BOOKING_TYPES).map(([type, meta]) => {
          const typeRules = groupedRules[type]
          if (!typeRules && type !== 'normal') return null

          return (
            <div key={type} className="mb-6">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className="text-slate-400">{meta.icon}</span>
                  <h3 className="text-white font-medium">{meta.label}</h3>
                  <Badge variant={meta.color}>{typeRules?.length || 0} tarifas</Badge>
                </div>
                <Button variant="ghost" size="sm" onClick={() => openNewRule(type)}>
                  <Plus size={12} /> Agregar
                </Button>
              </div>

              {typeRules && typeRules.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                  {typeRules.map(r => (
                    <div
                      key={r.id}
                      onClick={() => openEditRule(r)}
                      className={`rounded-xl border p-4 cursor-pointer transition-all hover:border-cyan-500/50 ${r.is_active ? 'border-slate-700/50 bg-slate-800/60' : 'border-slate-700/30 bg-slate-800/30 opacity-60'}`}
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <p className="text-white font-semibold text-sm">{r.name}</p>
                          <p className="text-xs text-slate-500">{formatDuration(r.duration_minutes)}</p>
                        </div>
                        <Edit2 size={12} className="text-slate-500" />
                      </div>

                      <div className="space-y-1.5">
                        <div className="flex justify-between text-sm">
                          <span className="text-slate-400">Precio base</span>
                          <span className="text-white font-medium">{r.base_price.toFixed(2)} €</span>
                        </div>
                        {r.lighting_surcharge > 0 && (
                          <div className="flex justify-between text-sm">
                            <span className="text-slate-400 flex items-center gap-1"><Lightbulb size={10} className="text-amber-400" /> Con luz</span>
                            <span className="text-amber-400">+{r.lighting_surcharge.toFixed(2)} €</span>
                          </div>
                        )}
                        {r.peak_surcharge > 0 && (
                          <div className="flex justify-between text-sm">
                            <span className="text-slate-400 flex items-center gap-1"><Sun size={10} className="text-orange-400" /> Pico</span>
                            <span className="text-orange-400">+{r.peak_surcharge.toFixed(2)} €</span>
                          </div>
                        )}
                        {r.discount_pct > 0 && (
                          <div className="flex justify-between text-sm">
                            <span className="text-slate-400">Descuento</span>
                            <span className="text-green-400">-{r.discount_pct}%</span>
                          </div>
                        )}
                        {r.fixed_price != null && (
                          <div className="flex justify-between text-sm">
                            <span className="text-slate-400">Precio fijo</span>
                            <span className="text-cyan-400 font-medium">{r.fixed_price.toFixed(2)} €</span>
                          </div>
                        )}
                      </div>

                      {/* Total preview */}
                      <div className="mt-3 pt-2 border-t border-slate-700/40 flex justify-between text-xs">
                        <span className="text-slate-500">Sin luz</span>
                        <span className="text-white">{r.fixed_price != null ? r.fixed_price.toFixed(2) : r.base_price.toFixed(2)} €</span>
                      </div>
                      <div className="flex justify-between text-xs">
                        <span className="text-slate-500">Con luz</span>
                        <span className="text-white">{r.fixed_price != null ? (r.fixed_price + r.lighting_surcharge).toFixed(2) : (r.base_price + r.lighting_surcharge).toFixed(2)} €</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="rounded-xl border border-dashed border-slate-700 p-6 text-center text-sm text-slate-500">
                  No hay tarifas para {meta.label.toLowerCase()}
                </div>
              )}
            </div>
          )
        })}
      </section>

      {/* ── Configuración general ──────────────────────────────────────────── */}
      <section className="rounded-xl border border-slate-700/50 bg-slate-800/50 p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-white font-semibold flex items-center gap-2">
            <Settings2 size={16} /> Configuración General
          </h2>
          <Button size="sm" onClick={saveConfig} loading={savingConfig}>
            <Save size={14} /> Guardar Config
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Horario pico */}
          <div className="space-y-3">
            <h3 className="text-sm font-medium text-slate-300 flex items-center gap-1.5">
              <Sun size={14} className="text-orange-400" /> Horario Pico
            </h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-slate-400 mb-1">Inicio</label>
                <input type="time" value={configForm.peak_start} onChange={e => setConfigForm(f => ({ ...f, peak_start: e.target.value }))} className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white" />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Fin</label>
                <input type="time" value={configForm.peak_end} onChange={e => setConfigForm(f => ({ ...f, peak_end: e.target.value }))} className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white" />
              </div>
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1.5">Días con horario pico</label>
              <div className="flex gap-1.5">
                {[1, 2, 3, 4, 5, 6, 0].map(d => (
                  <button key={d} type="button" onClick={() => togglePeakDay(d)} className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${configForm.peak_days.includes(d) ? 'bg-orange-500/20 text-orange-400 border border-orange-500/30' : 'bg-slate-700/50 text-slate-500 border border-transparent'}`}>
                    {DAY_NAMES[d]}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Recargos */}
          <div className="space-y-3">
            <h3 className="text-sm font-medium text-slate-300 flex items-center gap-1.5">
              <DollarSign size={14} className="text-cyan-400" /> Recargos adicionales
            </h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-slate-400 mb-1">Recargo fin de semana (€)</label>
                <input type="number" min="0" step="0.5" value={configForm.weekend_surcharge} onChange={e => setConfigForm(f => ({ ...f, weekend_surcharge: e.target.value }))} className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white" />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Recargo festivos (€)</label>
                <input type="number" min="0" step="0.5" value={configForm.holiday_surcharge} onChange={e => setConfigForm(f => ({ ...f, holiday_surcharge: e.target.value }))} className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white" />
              </div>
            </div>
          </div>

          {/* Reservas */}
          <div className="space-y-3">
            <h3 className="text-sm font-medium text-slate-300 flex items-center gap-1.5">
              <Clock size={14} className="text-cyan-400" /> Reservas
            </h3>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-xs text-slate-400 mb-1">Antelación mín. (hs)</label>
                <input type="number" min="0" value={configForm.min_advance_hours} onChange={e => setConfigForm(f => ({ ...f, min_advance_hours: e.target.value }))} className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white" />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Antelación máx. (días)</label>
                <input type="number" min="1" value={configForm.max_advance_days} onChange={e => setConfigForm(f => ({ ...f, max_advance_days: e.target.value }))} className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white" />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Cancelación (hs antes)</label>
                <input type="number" min="0" value={configForm.cancellation_hours} onChange={e => setConfigForm(f => ({ ...f, cancellation_hours: e.target.value }))} className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white" />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Rule Modal ─────────────────────────────────────────────────────── */}
      <Modal
        open={ruleOpen}
        onClose={() => setRuleOpen(false)}
        title={editRule ? `Editar: ${editRule.name}` : 'Nueva Tarifa'}
        size="md"
        footer={
          <div className="flex items-center justify-between w-full">
            <div>
              {editRule && (
                <Button variant="danger" size="sm" onClick={deleteRule} disabled={saving}>
                  <Trash2 size={14} /> Eliminar
                </Button>
              )}
            </div>
            <div className="flex gap-2">
              <Button variant="secondary" size="sm" onClick={() => setRuleOpen(false)}>Cancelar</Button>
              <Button size="sm" onClick={saveRule} loading={saving}>
                {editRule ? 'Guardar' : 'Crear tarifa'}
              </Button>
            </div>
          </div>
        }
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Input id="rule-name" label="Nombre" placeholder="Ej: 1 hora" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">Duración</label>
              <select value={form.duration_minutes} onChange={e => setForm(f => ({ ...f, duration_minutes: e.target.value }))} className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white">
                {DURATION_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Tipo de reserva</label>
            <div className="flex flex-wrap gap-2">
              {Object.entries(BOOKING_TYPES).map(([type, meta]) => (
                <button key={type} type="button" onClick={() => setForm(f => ({ ...f, booking_type: type }))} className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5 ${form.booking_type === type ? 'bg-cyan-600 text-white' : 'bg-slate-700/50 text-slate-400 hover:text-white'}`}>
                  {meta.icon} {meta.label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Input id="rule-price" type="number" label="Precio base (€)" placeholder="12.00" min="0" step="0.5" value={form.base_price} onChange={e => setForm(f => ({ ...f, base_price: e.target.value }))} />
            <Input id="rule-light" type="number" label="Recargo luz (€)" placeholder="4.00" min="0" step="0.5" value={form.lighting_surcharge} onChange={e => setForm(f => ({ ...f, lighting_surcharge: e.target.value }))} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Input id="rule-peak" type="number" label="Recargo pico (€)" placeholder="0" min="0" step="0.5" value={form.peak_surcharge} onChange={e => setForm(f => ({ ...f, peak_surcharge: e.target.value }))} />
            <Input id="rule-discount" type="number" label="Descuento (%)" placeholder="0" min="0" max="100" value={form.discount_pct} onChange={e => setForm(f => ({ ...f, discount_pct: e.target.value }))} />
          </div>

          <Input id="rule-fixed" type="number" label="Precio fijo (€) — si se pone, ignora base + descuento" placeholder="Dejar vacío para usar precio base" min="0" step="0.5" value={form.fixed_price} onChange={e => setForm(f => ({ ...f, fixed_price: e.target.value }))} />

          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 text-sm text-slate-300 cursor-pointer">
              <input type="checkbox" checked={form.is_active} onChange={e => setForm(f => ({ ...f, is_active: e.target.checked }))} className="rounded border-slate-600 bg-slate-800 text-cyan-500" />
              Activa
            </label>
            <div className="flex items-center gap-1.5 ml-auto">
              <label className="text-xs text-slate-400">Prioridad:</label>
              <input type="number" min="0" max="99" value={form.priority} onChange={e => setForm(f => ({ ...f, priority: e.target.value }))} className="w-14 bg-slate-800 border border-slate-600 rounded px-2 py-1 text-sm text-white text-center" />
            </div>
          </div>

          <Input id="rule-notes" label="Notas" placeholder="Observaciones internas..." value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />

          {/* Preview */}
          <div className="bg-slate-700/20 rounded-lg p-3 text-xs space-y-1">
            <p className="font-medium text-slate-400 mb-1.5">Vista previa del precio</p>
            {(() => {
              const base = parseFloat(form.base_price) || 0
              const light = parseFloat(form.lighting_surcharge) || 0
              const peak = parseFloat(form.peak_surcharge) || 0
              const disc = parseFloat(form.discount_pct) || 0
              const fixed = form.fixed_price ? parseFloat(form.fixed_price) : null
              const effectiveBase = fixed != null ? fixed : disc > 0 ? base * (1 - disc / 100) : base
              return (
                <div className="grid grid-cols-2 gap-1">
                  <span className="text-slate-500">Sin luz:</span><span className="text-white">{effectiveBase.toFixed(2)} €</span>
                  <span className="text-slate-500">Con luz:</span><span className="text-white">{(effectiveBase + light).toFixed(2)} €</span>
                  <span className="text-slate-500">Pico sin luz:</span><span className="text-white">{(effectiveBase + peak).toFixed(2)} €</span>
                  <span className="text-slate-500">Pico con luz:</span><span className="text-white">{(effectiveBase + light + peak).toFixed(2)} €</span>
                </div>
              )
            })()}
          </div>
        </div>
      </Modal>
    </div>
  )
}
