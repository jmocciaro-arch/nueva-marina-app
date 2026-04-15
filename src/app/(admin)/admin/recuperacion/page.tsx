'use client'

import { useState, useCallback, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card } from '@/components/ui/card'
import { Modal } from '@/components/ui/modal'
import { Badge } from '@/components/ui/badge'
import { KpiCard } from '@/components/ui/kpi-card'
import { useToast } from '@/components/ui/toast'
import {
  Droplets, Snowflake, HandHelping, Activity, Stethoscope,
  Plus, Trash2, CheckCircle2, XCircle, Calendar, Clock, Edit3, Tag
} from 'lucide-react'
import type { RecoverySession, User } from '@/types'
import { lookupPrice } from '@/lib/api/pricing'
import { useAuth } from '@/lib/auth-context'

const SELECT_CLS = 'w-full rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-cyan-500/40 focus:border-cyan-500'

const TYPE_META: Record<RecoverySession['type'], { label: string; icon: React.ReactNode; color: string }> = {
  crio: { label: 'Crioterapia', icon: <Snowflake size={16} />, color: 'bg-cyan-500/15 text-cyan-400' },
  hidro: { label: 'Hidroterapia', icon: <Droplets size={16} />, color: 'bg-blue-500/15 text-blue-400' },
  masaje: { label: 'Masaje', icon: <HandHelping size={16} />, color: 'bg-purple-500/15 text-purple-400' },
  estiramiento: { label: 'Estiramiento', icon: <Activity size={16} />, color: 'bg-green-500/15 text-green-400' },
  fisio: { label: 'Fisioterapia', icon: <Stethoscope size={16} />, color: 'bg-orange-500/15 text-orange-400' },
}

const STATUS_META: Record<RecoverySession['status'], { label: string; color: string }> = {
  scheduled: { label: 'Agendada', color: 'bg-yellow-500/15 text-yellow-400' },
  completed: { label: 'Completada', color: 'bg-green-500/15 text-green-400' },
  cancelled: { label: 'Cancelada', color: 'bg-red-500/15 text-red-400' },
  no_show: { label: 'No presentado', color: 'bg-slate-500/15 text-slate-400' },
}

const TABS = ['Hoy', 'Próximas', 'Historial'] as const
type Tab = typeof TABS[number]

export default function RecuperacionPage() {
  const { toast } = useToast()
  const { member } = useAuth()
  const [tab, setTab] = useState<Tab>('Hoy')
  const [sessions, setSessions] = useState<RecoverySession[]>([])
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)

  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<RecoverySession | null>(null)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    user_id: '',
    type: 'masaje' as RecoverySession['type'],
    scheduled_at: '',
    duration_minutes: 30,
    price: '',
    notes: '',
  })
  const [pricingRule, setPricingRule] = useState<{ rule_id: number; amount: number; currency: string; name: string } | null>(null)
  const [pricingLoading, setPricingLoading] = useState(false)

  // Lookup de precio cada vez que cambian los parámetros clave del form
  useEffect(() => {
    if (!modalOpen) return
    if (!form.type || !form.scheduled_at || !form.duration_minutes) {
      setPricingRule(null)
      return
    }
    let cancelled = false
    setPricingLoading(true)
    lookupPrice({
      club_id: 1,
      scope: 'recovery_type',
      scope_ref_id: null,
      at: new Date(form.scheduled_at).toISOString(),
      duration_minutes: form.duration_minutes,
      role_slug: member?.role ?? null,
    })
      .then(rule => {
        if (cancelled) return
        setPricingRule(rule)
        // Auto-completar el campo de precio si hay regla y el user no tocó manual
        if (rule && !form.price) {
          setForm(f => ({ ...f, price: String(rule.amount) }))
        }
      })
      .catch(() => { if (!cancelled) setPricingRule(null) })
      .finally(() => { if (!cancelled) setPricingLoading(false) })
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modalOpen, form.type, form.scheduled_at, form.duration_minutes, member?.role])

  const loadSessions = useCallback(async () => {
    setLoading(true)
    const supabase = createClient()
    const now = new Date()
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString()
    const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).toISOString()

    let query = supabase
      .from('nm_recovery_sessions')
      .select('*, user:nm_users!user_id(id, full_name, email), assigned_staff:nm_users!assigned_staff_id(id, full_name, email)')
      .eq('club_id', 1)

    if (tab === 'Hoy') {
      query = query.gte('scheduled_at', startOfToday).lt('scheduled_at', endOfToday).order('scheduled_at', { ascending: true })
    } else if (tab === 'Próximas') {
      query = query.gte('scheduled_at', endOfToday).order('scheduled_at', { ascending: true }).limit(100)
    } else {
      query = query.lt('scheduled_at', startOfToday).order('scheduled_at', { ascending: false }).limit(200)
    }

    const { data } = await query
    setSessions((data || []) as unknown as RecoverySession[])
    setLoading(false)
  }, [tab])

  const loadUsers = useCallback(async () => {
    const supabase = createClient()
    const { data } = await supabase.from('nm_users').select('id, full_name, email').order('full_name').limit(500)
    setUsers((data || []) as User[])
  }, [])

  useEffect(() => { loadSessions() }, [loadSessions])
  useEffect(() => { loadUsers() }, [loadUsers])

  function openCreate() {
    setEditing(null)
    setPricingRule(null)
    setForm({
      user_id: '',
      type: 'masaje',
      scheduled_at: new Date(Date.now() + 60 * 60 * 1000).toISOString().slice(0, 16),
      duration_minutes: 30,
      price: '',
      notes: '',
    })
    setModalOpen(true)
  }

  function openEdit(s: RecoverySession) {
    setEditing(s)
    setPricingRule(null)
    setForm({
      user_id: s.user_id,
      type: s.type,
      scheduled_at: s.scheduled_at.slice(0, 16),
      duration_minutes: s.duration_minutes,
      price: s.price?.toString() || '',
      notes: s.notes || '',
    })
    setModalOpen(true)
  }

  async function save() {
    if (!form.user_id) {
      toast('error', 'Falta el usuario')
      return
    }
    if (!form.scheduled_at) {
      toast('error', 'Falta fecha/hora')
      return
    }
    setSaving(true)
    const supabase = createClient()

    // Re-consultar la regla al momento del submit para consistencia
    let finalRule = pricingRule
    try {
      finalRule = await lookupPrice({
        club_id: 1,
        scope: 'recovery_type',
        scope_ref_id: null,
        at: new Date(form.scheduled_at).toISOString(),
        duration_minutes: form.duration_minutes,
        role_slug: member?.role ?? null,
      })
    } catch {
      // ignoro; uso el preview o el precio manual
    }

    const manualPrice = form.price ? Number(form.price) : null
    const finalPrice = finalRule?.amount ?? manualPrice

    const payload = {
      club_id: 1,
      user_id: form.user_id,
      type: form.type,
      scheduled_at: new Date(form.scheduled_at).toISOString(),
      duration_minutes: form.duration_minutes,
      price: finalPrice,
      price_rule_id: finalRule?.rule_id ?? null,
      notes: form.notes || null,
    }
    const { error } = editing
      ? await supabase.from('nm_recovery_sessions').update(payload).eq('id', editing.id)
      : await supabase.from('nm_recovery_sessions').insert(payload)
    setSaving(false)
    if (error) {
      toast('error', `Error al guardar: ${error.message}`)
      return
    }
    toast('success', editing ? 'Sesión actualizada' : 'Sesión creada')
    setModalOpen(false)
    loadSessions()
  }

  async function updateStatus(id: number, status: RecoverySession['status']) {
    const supabase = createClient()
    const patch: Record<string, unknown> = { status }
    if (status === 'completed') patch.completed_at = new Date().toISOString()
    const { error } = await supabase.from('nm_recovery_sessions').update(patch).eq('id', id)
    if (error) {
      toast('error', error.message)
      return
    }
    toast('success', `Marcada como ${STATUS_META[status].label}`)
    loadSessions()
  }

  async function remove(id: number) {
    if (!confirm('¿Eliminar esta sesión definitivamente?')) return
    const supabase = createClient()
    const { error } = await supabase.from('nm_recovery_sessions').delete().eq('id', id)
    if (error) {
      toast('error', error.message)
      return
    }
    toast('success', 'Sesión eliminada')
    loadSessions()
  }

  // KPIs
  const kpiToday = sessions.filter(s => s.status === 'scheduled').length
  const kpiCompleted = sessions.filter(s => s.status === 'completed').length
  const kpiRevenue = sessions
    .filter(s => s.status === 'completed' && s.payment_status === 'paid')
    .reduce((sum, s) => sum + (s.price || 0), 0)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Droplets className="text-cyan-400" /> Recuperación
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Crio, hidro, masajes, fisio, estiramientos
          </p>
        </div>
        <Button onClick={openCreate} className="bg-cyan-600 hover:bg-cyan-700">
          <Plus size={16} /> Nueva sesión
        </Button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <KpiCard title="Agendadas" value={kpiToday} icon={<Calendar />} />
        <KpiCard title="Completadas" value={kpiCompleted} icon={<CheckCircle2 />} />
        <KpiCard title="Ingresos (pagadas)" value={`${kpiRevenue.toFixed(2)}€`} icon={<Activity />} />
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-slate-700">
        {TABS.map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
              tab === t ? 'border-cyan-500 text-cyan-400' : 'border-transparent text-slate-400 hover:text-white'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Sessions list */}
      <Card>
        {loading ? (
          <div className="p-8 text-center text-slate-400">Cargando...</div>
        ) : sessions.length === 0 ? (
          <div className="p-8 text-center text-slate-400">
            No hay sesiones {tab === 'Hoy' ? 'hoy' : tab === 'Próximas' ? 'próximas' : 'en el historial'}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-800/50 text-slate-400 text-xs uppercase tracking-wider">
                <tr>
                  <th className="text-left px-4 py-3">Fecha/Hora</th>
                  <th className="text-left px-4 py-3">Usuario</th>
                  <th className="text-left px-4 py-3">Tipo</th>
                  <th className="text-left px-4 py-3">Duración</th>
                  <th className="text-left px-4 py-3">Precio</th>
                  <th className="text-left px-4 py-3">Estado</th>
                  <th className="text-right px-4 py-3">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700">
                {sessions.map(s => {
                  const meta = TYPE_META[s.type]
                  const st = STATUS_META[s.status]
                  const date = new Date(s.scheduled_at)
                  return (
                    <tr key={s.id} className="hover:bg-slate-800/30">
                      <td className="px-4 py-3 text-white">
                        <div className="flex items-center gap-2">
                          <Clock size={14} className="text-slate-500" />
                          <span>
                            {date.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit' })}{' '}
                            {date.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-white">{s.user?.full_name || s.user?.email || '—'}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded text-xs ${meta.color}`}>
                          {meta.icon} {meta.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-300">{s.duration_minutes} min</td>
                      <td className="px-4 py-3 text-slate-300">{s.price ? `${s.price}€` : '—'}</td>
                      <td className="px-4 py-3"><Badge className={st.color}>{st.label}</Badge></td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          {s.status === 'scheduled' && (
                            <>
                              <button
                                onClick={() => updateStatus(s.id, 'completed')}
                                className="p-1.5 text-green-400 hover:bg-green-500/10 rounded"
                                title="Completar"
                              >
                                <CheckCircle2 size={16} />
                              </button>
                              <button
                                onClick={() => updateStatus(s.id, 'cancelled')}
                                className="p-1.5 text-yellow-400 hover:bg-yellow-500/10 rounded"
                                title="Cancelar"
                              >
                                <XCircle size={16} />
                              </button>
                            </>
                          )}
                          <button
                            onClick={() => openEdit(s)}
                            className="p-1.5 text-blue-400 hover:bg-blue-500/10 rounded"
                            title="Editar"
                          >
                            <Edit3 size={16} />
                          </button>
                          <button
                            onClick={() => remove(s.id)}
                            className="p-1.5 text-red-400 hover:bg-red-500/10 rounded"
                            title="Eliminar"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Modal create/edit */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Editar sesión' : 'Nueva sesión de recuperación'}>
        <div className="space-y-4">
          <div>
            <label className="block text-xs text-slate-400 mb-1">Usuario</label>
            <select className={SELECT_CLS} value={form.user_id} onChange={e => setForm({ ...form, user_id: e.target.value })}>
              <option value="">— Seleccionar —</option>
              {users.map(u => (
                <option key={u.id} value={u.id}>{u.full_name || u.email}</option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-slate-400 mb-1">Tipo</label>
              <select className={SELECT_CLS} value={form.type} onChange={e => setForm({ ...form, type: e.target.value as RecoverySession['type'] })}>
                {Object.entries(TYPE_META).map(([k, m]) => (
                  <option key={k} value={k}>{m.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Duración (min)</label>
              <Input type="number" value={form.duration_minutes} onChange={e => setForm({ ...form, duration_minutes: Number(e.target.value) })} />
            </div>
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">Fecha y hora</label>
            <Input type="datetime-local" value={form.scheduled_at} onChange={e => setForm({ ...form, scheduled_at: e.target.value })} />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">Precio (€, opcional)</label>
            <Input type="number" step="0.01" placeholder="ej. 15.00" value={form.price} onChange={e => setForm({ ...form, price: e.target.value })} />
          </div>

          {/* Preview regla aplicada */}
          <div className="bg-slate-800/50 rounded-lg px-4 py-3 border border-slate-700/50">
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-400">
                Precio unificado {pricingLoading && <span className="text-xs text-slate-500">(calculando…)</span>}
              </span>
              <span className="text-lg font-bold text-cyan-400">
                {pricingRule ? `${pricingRule.amount.toFixed(2)} ${pricingRule.currency}` : '—'}
              </span>
            </div>
            {pricingRule ? (
              <div className="mt-2 flex items-center gap-2 text-xs text-slate-400">
                <Tag size={11} className="text-cyan-400" />
                <span>Regla:</span>
                <Badge className="bg-cyan-500/15 text-cyan-400">{pricingRule.name}</Badge>
                <span className="text-slate-600">#{pricingRule.rule_id}</span>
              </div>
            ) : !pricingLoading && (
              <div className="mt-2 text-xs text-amber-400/80">
                Sin regla en <code>nm_price_rules</code> (scope=recovery_type) · se usará el precio manual
              </div>
            )}
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">Notas</label>
            <Input placeholder="Observaciones, zona a tratar..." value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={() => setModalOpen(false)}>Cancelar</Button>
            <Button onClick={save} disabled={saving} className="bg-cyan-600 hover:bg-cyan-700">
              {saving ? 'Guardando...' : editing ? 'Actualizar' : 'Crear sesión'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
