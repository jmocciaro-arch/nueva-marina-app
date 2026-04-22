'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Modal } from '@/components/ui/modal'
import { useToast } from '@/components/ui/toast'
import { formatDate, formatCurrency } from '@/lib/utils'
import {
  ArrowLeft, Loader2, User as UserIcon, Activity, Target, Heart, ClipboardList,
  DoorOpen, Receipt, StickyNote, Plus, Trash2, Save, TrendingUp, AlertTriangle,
  Pin, PinOff,
} from 'lucide-react'
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from 'recharts'

interface UserData {
  id: string
  full_name: string | null
  email: string
  phone: string | null
  avatar_url: string | null
  birth_date: string | null
  city: string | null
  dni_nie: string | null
  emergency_contact: string | null
  medical_notes: string | null
  virtuagym_id: string | null
  notes: string | null
}

interface PhysicalMeasurement {
  id: number
  measured_at: string
  height_cm: number | null
  weight_kg: number | null
  bmi: number | null
  body_fat_pct: number | null
  muscle_mass_kg: number | null
  waist_cm: number | null
  hip_cm: number | null
  chest_cm: number | null
  resting_heart_rate: number | null
  notes: string | null
}

interface Goal {
  id: number
  goal_type: string
  title: string
  description: string | null
  target_value: number | null
  target_unit: string | null
  current_value: number | null
  start_value: number | null
  priority: string
  status: string
  start_date: string
  target_date: string | null
}

interface HealthCondition {
  id: number
  condition_type: string
  title: string
  description: string | null
  severity: string | null
  affected_area: string | null
  is_active: boolean
  started_at: string | null
  restrictions: string | null
  recommendations: string | null
}

interface CoachNote {
  id: number
  category: string
  title: string | null
  content: string
  is_private: boolean
  is_pinned: boolean
  created_at: string
  coach_id: string | null
}

interface GymMembership {
  id: number
  plan: string | null
  start_date: string | null
  end_date: string | null
  status: string | null
  price: number | null
}

interface AccessLog {
  id: number | string
  timestamp: string
  access_point: string | null
  result: string | null
}

interface InvoiceSummary {
  id: number
  invoice_number: string
  paid_at: string | null
  total: number
  status: string
  items: Array<{ name?: string | null; category?: string | null }> | null
}

type TabKey = 'datos' | 'fisico' | 'objetivos' | 'salud' | 'abonos' | 'accesos' | 'facturacion' | 'notas'

export default function SocioFichaPage() {
  const params = useParams<{ id: string }>()
  const userId = params?.id
  const { toast } = useToast()

  const [user, setUser] = useState<UserData | null>(null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<TabKey>('datos')

  const [measurements, setMeasurements] = useState<PhysicalMeasurement[]>([])
  const [goals, setGoals] = useState<Goal[]>([])
  const [health, setHealth] = useState<HealthCondition[]>([])
  const [notes, setNotes] = useState<CoachNote[]>([])
  const [memberships, setMemberships] = useState<GymMembership[]>([])
  const [accesses, setAccesses] = useState<AccessLog[]>([])
  const [invoices, setInvoices] = useState<InvoiceSummary[]>([])

  const loadAll = useCallback(async () => {
    if (!userId) return
    setLoading(true)
    const supabase = createClient()

    const [
      { data: userData },
      { data: msData },
      { data: goalsData },
      { data: healthData },
      { data: notesData },
      { data: membershipsData },
      { data: accessData },
      { data: invoicesData },
    ] = await Promise.all([
      supabase.from('nm_users').select('*').eq('id', userId).maybeSingle(),
      supabase.from('nm_gym_physical_measurements').select('*').eq('user_id', userId).order('measured_at', { ascending: false }),
      supabase.from('nm_gym_goals').select('*').eq('user_id', userId).order('created_at', { ascending: false }),
      supabase.from('nm_gym_health_conditions').select('*').eq('user_id', userId).order('is_active', { ascending: false }),
      supabase.from('nm_gym_coach_notes').select('*').eq('user_id', userId).order('is_pinned', { ascending: false }).order('created_at', { ascending: false }),
      supabase.from('nm_gym_memberships').select('*').eq('user_id', userId).order('start_date', { ascending: false }),
      supabase.from('nm_access_logs').select('*').eq('user_id', userId).order('timestamp', { ascending: false }).limit(100),
      supabase.from('nm_invoices').select('*').eq('user_id', userId).order('paid_at', { ascending: false }).limit(100),
    ])

    setUser(userData as UserData | null)
    setMeasurements((msData ?? []) as PhysicalMeasurement[])
    setGoals((goalsData ?? []) as Goal[])
    setHealth((healthData ?? []) as HealthCondition[])
    setNotes((notesData ?? []) as CoachNote[])
    setMemberships((membershipsData ?? []) as GymMembership[])
    setAccesses((accessData ?? []) as AccessLog[])
    setInvoices((invoicesData ?? []) as InvoiceSummary[])
    setLoading(false)
  }, [userId])

  useEffect(() => { loadAll() }, [loadAll])

  if (loading || !user) {
    return (
      <div className="flex items-center justify-center py-20 text-white">
        <Loader2 className="animate-spin" size={32} />
      </div>
    )
  }

  const age = user.birth_date
    ? Math.floor((Date.now() - new Date(user.birth_date).getTime()) / (1000 * 60 * 60 * 24 * 365.25))
    : null

  const tabs: Array<{ key: TabKey; label: string; icon: React.ReactNode; count?: number }> = [
    { key: 'datos', label: 'Datos', icon: <UserIcon size={14} /> },
    { key: 'fisico', label: 'Físico', icon: <Activity size={14} />, count: measurements.length },
    { key: 'objetivos', label: 'Objetivos', icon: <Target size={14} />, count: goals.filter(g => g.status === 'active').length },
    { key: 'salud', label: 'Salud', icon: <Heart size={14} />, count: health.filter(h => h.is_active).length },
    { key: 'abonos', label: 'Abonos', icon: <ClipboardList size={14} />, count: memberships.length },
    { key: 'accesos', label: 'Accesos', icon: <DoorOpen size={14} />, count: accesses.length },
    { key: 'facturacion', label: 'Facturación', icon: <Receipt size={14} />, count: invoices.length },
    { key: 'notas', label: 'Notas', icon: <StickyNote size={14} />, count: notes.length },
  ]

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* Back */}
      <Link href="/admin/gimnasio" className="text-sm text-slate-400 hover:text-cyan-400 inline-flex items-center gap-1">
        <ArrowLeft size={14} /> Volver a Gimnasio
      </Link>

      {/* Header con avatar + datos clave */}
      <Card className="p-5">
        <div className="flex flex-col md:flex-row gap-5">
          <div className="w-24 h-24 rounded-full bg-slate-800 border-2 border-slate-700 overflow-hidden shrink-0 flex items-center justify-center">
            {user.avatar_url ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img src={user.avatar_url} alt="" className="w-full h-full object-cover" />
            ) : (
              <UserIcon size={40} className="text-slate-600" />
            )}
          </div>
          <div className="flex-1 space-y-2">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-2xl font-bold text-white">{user.full_name ?? user.email}</h1>
              {age !== null && <Badge variant="info">{age} años</Badge>}
              {user.virtuagym_id && <Badge variant="default">VG #{user.virtuagym_id}</Badge>}
            </div>
            <div className="flex flex-wrap gap-4 text-xs text-slate-400">
              <span>📧 {user.email}</span>
              {user.phone && <span>📱 {user.phone}</span>}
              {user.dni_nie && <span>🆔 {user.dni_nie}</span>}
              {user.city && <span>📍 {user.city}</span>}
            </div>
            {user.emergency_contact && (
              <p className="text-xs text-amber-300">🆘 Emergencia: {user.emergency_contact}</p>
            )}
          </div>
          <div className="shrink-0 grid grid-cols-2 md:grid-cols-1 gap-2 text-right">
            <MiniMetric label="Último peso" value={measurements[0]?.weight_kg ? `${measurements[0].weight_kg} kg` : '—'} />
            <MiniMetric label="Último acceso" value={accesses[0] ? formatDate(accesses[0].timestamp) : '—'} />
          </div>
        </div>
      </Card>

      {/* Tabs */}
      <div className="flex gap-1 overflow-x-auto border-b border-slate-700/50">
        {tabs.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={[
              'px-3 py-2 text-sm whitespace-nowrap flex items-center gap-1.5 transition-colors',
              tab === t.key
                ? 'text-cyan-400 border-b-2 border-cyan-400'
                : 'text-slate-400 hover:text-slate-200',
            ].join(' ')}
          >
            {t.icon}
            {t.label}
            {t.count !== undefined && t.count > 0 && (
              <span className="text-[10px] text-slate-500">({t.count})</span>
            )}
          </button>
        ))}
      </div>

      {/* Contenido del tab */}
      {tab === 'datos' && <TabDatos user={user} />}
      {tab === 'fisico' && <TabFisico userId={user.id} measurements={measurements} onReload={loadAll} toast={toast} />}
      {tab === 'objetivos' && <TabObjetivos userId={user.id} goals={goals} onReload={loadAll} toast={toast} />}
      {tab === 'salud' && <TabSalud userId={user.id} conditions={health} onReload={loadAll} toast={toast} />}
      {tab === 'abonos' && <TabAbonos memberships={memberships} />}
      {tab === 'accesos' && <TabAccesos accesses={accesses} />}
      {tab === 'facturacion' && <TabFacturacion invoices={invoices} />}
      {tab === 'notas' && <TabNotas userId={user.id} notes={notes} onReload={loadAll} toast={toast} />}
    </div>
  )
}

function MiniMetric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] text-slate-500 uppercase tracking-wider">{label}</p>
      <p className="text-sm font-semibold text-white">{value}</p>
    </div>
  )
}

// ──────────────────────────────────────────────────────────────
// Tab: Datos
// ──────────────────────────────────────────────────────────────
function TabDatos({ user }: { user: UserData }) {
  return (
    <Card className="p-5 space-y-3">
      <h3 className="text-sm font-semibold text-white mb-2">Información personal</h3>
      <Row label="Nombre" value={user.full_name} />
      <Row label="Email" value={user.email} />
      <Row label="Teléfono" value={user.phone} />
      <Row label="DNI/NIE" value={user.dni_nie} />
      <Row label="Fecha de nacimiento" value={user.birth_date ? formatDate(user.birth_date) : null} />
      <Row label="Zona / Localidad" value={user.city} />
      <Row label="Contacto de emergencia" value={user.emergency_contact} />
      <Row label="Notas médicas" value={user.medical_notes} />
      <Row label="ID Virtuagym" value={user.virtuagym_id} mono />
      <Row label="Notas" value={user.notes} />
    </Card>
  )
}

function Row({ label, value, mono }: { label: string; value: string | null; mono?: boolean }) {
  return (
    <div className="flex justify-between text-sm gap-4 border-b border-slate-800 pb-2">
      <span className="text-slate-400">{label}</span>
      <span className={['text-white text-right', mono ? 'font-mono' : ''].join(' ')}>{value ?? '—'}</span>
    </div>
  )
}

// ──────────────────────────────────────────────────────────────
// Tab: Físico (mediciones con historial)
// ──────────────────────────────────────────────────────────────
function TabFisico({ userId, measurements, onReload, toast }: {
  userId: string
  measurements: PhysicalMeasurement[]
  onReload: () => void
  toast: (kind: 'success' | 'error' | 'info' | 'warning', msg: string) => void
}) {
  const [adding, setAdding] = useState(false)
  const [form, setForm] = useState({
    weight_kg: '', height_cm: '', body_fat_pct: '', muscle_mass_kg: '',
    waist_cm: '', hip_cm: '', chest_cm: '', resting_heart_rate: '', notes: '',
  })
  const [saving, setSaving] = useState(false)

  const weightChart = useMemo(() => {
    return [...measurements]
      .reverse()
      .filter(m => m.weight_kg !== null)
      .map(m => ({ date: m.measured_at.slice(5), weight: m.weight_kg, fat: m.body_fat_pct }))
  }, [measurements])

  async function save() {
    const supabase = createClient()
    setSaving(true)
    const payload: Record<string, unknown> = { user_id: userId }
    const numFields = ['weight_kg', 'height_cm', 'body_fat_pct', 'muscle_mass_kg', 'waist_cm', 'hip_cm', 'chest_cm', 'resting_heart_rate'] as const
    for (const f of numFields) {
      const v = form[f]
      if (v && !isNaN(parseFloat(v))) payload[f] = parseFloat(v)
    }
    if (form.notes.trim()) payload.notes = form.notes.trim()
    const { error } = await supabase.from('nm_gym_physical_measurements').insert(payload)
    setSaving(false)
    if (error) { toast('error', error.message); return }
    toast('success', 'Medición guardada')
    setAdding(false)
    setForm({ weight_kg: '', height_cm: '', body_fat_pct: '', muscle_mass_kg: '', waist_cm: '', hip_cm: '', chest_cm: '', resting_heart_rate: '', notes: '' })
    onReload()
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={() => setAdding(true)} className="flex items-center gap-1">
          <Plus size={14} /> Nueva medición
        </Button>
      </div>

      {weightChart.length >= 2 && (
        <Card className="p-4">
          <h4 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
            <TrendingUp size={14} className="text-cyan-400" /> Evolución del peso
          </h4>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={weightChart}>
              <CartesianGrid stroke="#1e293b" strokeDasharray="3 3" />
              <XAxis dataKey="date" stroke="#64748b" fontSize={10} />
              <YAxis stroke="#64748b" fontSize={10} />
              <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid #334155' }} />
              <Line type="monotone" dataKey="weight" stroke="#06b6d4" strokeWidth={2} dot={{ r: 3 }} name="Peso (kg)" />
              <Line type="monotone" dataKey="fat" stroke="#f59e0b" strokeWidth={2} dot={{ r: 3 }} name="% grasa" />
            </LineChart>
          </ResponsiveContainer>
        </Card>
      )}

      <Card className="p-0 overflow-hidden">
        {measurements.length === 0 ? (
          <div className="p-8 text-center text-slate-500 text-sm">Sin mediciones registradas.</div>
        ) : (
          <table className="w-full text-xs">
            <thead className="bg-slate-900/60">
              <tr className="text-left text-slate-400">
                <th className="px-3 py-2">Fecha</th>
                <th className="px-3 py-2 text-right">Peso</th>
                <th className="px-3 py-2 text-right">IMC</th>
                <th className="px-3 py-2 text-right">% grasa</th>
                <th className="px-3 py-2 text-right">Músc.</th>
                <th className="px-3 py-2 text-right">Cintura</th>
                <th className="px-3 py-2 text-right">Pulso rep.</th>
                <th className="px-3 py-2">Notas</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {measurements.map(m => (
                <tr key={m.id} className="hover:bg-slate-800/40">
                  <td className="px-3 py-2 text-slate-300">{formatDate(m.measured_at)}</td>
                  <td className="px-3 py-2 text-right text-white font-mono">{m.weight_kg ?? '—'}</td>
                  <td className="px-3 py-2 text-right text-slate-300 font-mono">{m.bmi ?? '—'}</td>
                  <td className="px-3 py-2 text-right text-slate-300 font-mono">{m.body_fat_pct ?? '—'}</td>
                  <td className="px-3 py-2 text-right text-slate-300 font-mono">{m.muscle_mass_kg ?? '—'}</td>
                  <td className="px-3 py-2 text-right text-slate-300 font-mono">{m.waist_cm ?? '—'}</td>
                  <td className="px-3 py-2 text-right text-slate-300 font-mono">{m.resting_heart_rate ?? '—'}</td>
                  <td className="px-3 py-2 text-slate-400 text-xs truncate max-w-xs">{m.notes ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      <Modal open={adding} onClose={() => setAdding(false)} title="Nueva medición" size="lg">
        <div className="grid grid-cols-2 gap-3">
          <FieldInput label="Peso (kg)" value={form.weight_kg} onChange={v => setForm({ ...form, weight_kg: v })} />
          <FieldInput label="Altura (cm)" value={form.height_cm} onChange={v => setForm({ ...form, height_cm: v })} />
          <FieldInput label="% Grasa" value={form.body_fat_pct} onChange={v => setForm({ ...form, body_fat_pct: v })} />
          <FieldInput label="Masa muscular (kg)" value={form.muscle_mass_kg} onChange={v => setForm({ ...form, muscle_mass_kg: v })} />
          <FieldInput label="Cintura (cm)" value={form.waist_cm} onChange={v => setForm({ ...form, waist_cm: v })} />
          <FieldInput label="Cadera (cm)" value={form.hip_cm} onChange={v => setForm({ ...form, hip_cm: v })} />
          <FieldInput label="Pecho (cm)" value={form.chest_cm} onChange={v => setForm({ ...form, chest_cm: v })} />
          <FieldInput label="Pulso en reposo" value={form.resting_heart_rate} onChange={v => setForm({ ...form, resting_heart_rate: v })} />
        </div>
        <div className="mt-3">
          <label className="block text-xs text-slate-400 mb-1">Notas</label>
          <textarea
            value={form.notes}
            onChange={e => setForm({ ...form, notes: e.target.value })}
            rows={2}
            className="w-full rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-white"
          />
        </div>
        <div className="flex gap-2 justify-end mt-4">
          <Button variant="ghost" onClick={() => setAdding(false)} disabled={saving}>Cancelar</Button>
          <Button onClick={save} disabled={saving} className="flex items-center gap-1">
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            Guardar
          </Button>
        </div>
      </Modal>
    </div>
  )
}

function FieldInput({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="block text-xs text-slate-400 mb-1">{label}</label>
      <Input type="number" step="0.1" value={value} onChange={e => onChange(e.target.value)} />
    </div>
  )
}

// ──────────────────────────────────────────────────────────────
// Tab: Objetivos
// ──────────────────────────────────────────────────────────────
function TabObjetivos({ userId, goals, onReload, toast }: {
  userId: string
  goals: Goal[]
  onReload: () => void
  toast: (kind: 'success' | 'error' | 'info' | 'warning', msg: string) => void
}) {
  const [adding, setAdding] = useState(false)
  const [form, setForm] = useState({
    goal_type: 'weight_loss', title: '', description: '',
    target_value: '', target_unit: 'kg', current_value: '', priority: 'medium',
    target_date: '',
  })
  const [saving, setSaving] = useState(false)

  async function save() {
    if (!form.title.trim()) { toast('error', 'Poné un título'); return }
    setSaving(true)
    const supabase = createClient()
    const payload = {
      user_id: userId,
      goal_type: form.goal_type,
      title: form.title.trim(),
      description: form.description.trim() || null,
      target_value: form.target_value ? parseFloat(form.target_value) : null,
      target_unit: form.target_unit || null,
      current_value: form.current_value ? parseFloat(form.current_value) : null,
      priority: form.priority,
      target_date: form.target_date || null,
      status: 'active',
    }
    const { error } = await supabase.from('nm_gym_goals').insert(payload)
    setSaving(false)
    if (error) { toast('error', error.message); return }
    toast('success', 'Objetivo creado')
    setAdding(false)
    setForm({ goal_type: 'weight_loss', title: '', description: '', target_value: '', target_unit: 'kg', current_value: '', priority: 'medium', target_date: '' })
    onReload()
  }

  async function updateStatus(id: number, status: string) {
    const supabase = createClient()
    const { error } = await supabase.from('nm_gym_goals').update({
      status,
      achieved_at: status === 'achieved' ? new Date().toISOString() : null,
    }).eq('id', id)
    if (error) { toast('error', error.message); return }
    toast('success', 'Objetivo actualizado')
    onReload()
  }

  async function remove(id: number) {
    if (!confirm('¿Borrar este objetivo?')) return
    const supabase = createClient()
    await supabase.from('nm_gym_goals').delete().eq('id', id)
    onReload()
  }

  const active = goals.filter(g => g.status === 'active')
  const achieved = goals.filter(g => g.status === 'achieved')

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={() => setAdding(true)} className="flex items-center gap-1">
          <Plus size={14} /> Nuevo objetivo
        </Button>
      </div>

      {active.length === 0 && achieved.length === 0 && (
        <Card className="p-8 text-center text-slate-500 text-sm">Sin objetivos todavía.</Card>
      )}

      {active.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs uppercase tracking-wider text-slate-500">En curso</p>
          {active.map(g => <GoalCard key={g.id} goal={g} onStatus={updateStatus} onDelete={remove} />)}
        </div>
      )}

      {achieved.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs uppercase tracking-wider text-slate-500">Logrados</p>
          {achieved.map(g => <GoalCard key={g.id} goal={g} onStatus={updateStatus} onDelete={remove} />)}
        </div>
      )}

      <Modal open={adding} onClose={() => setAdding(false)} title="Nuevo objetivo" size="lg">
        <div className="space-y-3">
          <div>
            <label className="block text-xs text-slate-400 mb-1">Tipo</label>
            <select
              value={form.goal_type}
              onChange={e => setForm({ ...form, goal_type: e.target.value })}
              className="w-full rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-white"
            >
              <option value="weight_loss">Pérdida de peso</option>
              <option value="muscle_gain">Ganar masa muscular</option>
              <option value="endurance">Resistencia / cardio</option>
              <option value="strength">Fuerza</option>
              <option value="flexibility">Flexibilidad / movilidad</option>
              <option value="rehabilitation">Rehabilitación</option>
              <option value="other">Otro</option>
            </select>
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">Título *</label>
            <Input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="Ej: Bajar 5 kg antes del verano" />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <FieldInput label="Valor actual" value={form.current_value} onChange={v => setForm({ ...form, current_value: v })} />
            <FieldInput label="Valor objetivo" value={form.target_value} onChange={v => setForm({ ...form, target_value: v })} />
            <div>
              <label className="block text-xs text-slate-400 mb-1">Unidad</label>
              <Input value={form.target_unit} onChange={e => setForm({ ...form, target_unit: e.target.value })} placeholder="kg, cm, reps…" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-slate-400 mb-1">Prioridad</label>
              <select
                value={form.priority}
                onChange={e => setForm({ ...form, priority: e.target.value })}
                className="w-full rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-white"
              >
                <option value="high">Alta</option>
                <option value="medium">Media</option>
                <option value="low">Baja</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Fecha objetivo</label>
              <Input type="date" value={form.target_date} onChange={e => setForm({ ...form, target_date: e.target.value })} />
            </div>
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">Descripción</label>
            <textarea
              value={form.description}
              onChange={e => setForm({ ...form, description: e.target.value })}
              rows={2}
              className="w-full rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-white"
            />
          </div>
          <div className="flex gap-2 justify-end pt-2">
            <Button variant="ghost" onClick={() => setAdding(false)} disabled={saving}>Cancelar</Button>
            <Button onClick={save} disabled={saving} className="flex items-center gap-1">
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
              Crear objetivo
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}

function GoalCard({ goal, onStatus, onDelete }: { goal: Goal; onStatus: (id: number, s: string) => void; onDelete: (id: number) => void }) {
  const goalTypeLabel: Record<string, string> = {
    weight_loss: 'Pérdida peso', muscle_gain: 'Masa muscular', endurance: 'Resistencia',
    strength: 'Fuerza', flexibility: 'Flexibilidad', rehabilitation: 'Rehab', other: 'Otro',
  }
  const priorityColor = goal.priority === 'high' ? 'danger' : goal.priority === 'medium' ? 'warning' : 'default'
  const achieved = goal.status === 'achieved'
  const progress = goal.target_value && goal.current_value && goal.start_value
    ? Math.min(100, Math.abs(((goal.current_value - goal.start_value) / (goal.target_value - goal.start_value)) * 100))
    : null

  return (
    <Card className="p-3">
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="cyan">{goalTypeLabel[goal.goal_type] ?? goal.goal_type}</Badge>
            <Badge variant={priorityColor}>{goal.priority === 'high' ? 'Alta' : goal.priority === 'medium' ? 'Media' : 'Baja'}</Badge>
            {achieved && <Badge variant="success">✓ Logrado</Badge>}
          </div>
          <h4 className="text-sm font-semibold text-white mt-1">{goal.title}</h4>
          {goal.description && <p className="text-xs text-slate-400 mt-1">{goal.description}</p>}
          {goal.target_value && (
            <p className="text-xs text-slate-500 mt-1 font-mono">
              {goal.current_value ?? '—'} / {goal.target_value} {goal.target_unit}
            </p>
          )}
          {goal.target_date && (
            <p className="text-[10px] text-slate-500 mt-1">Hasta: {formatDate(goal.target_date)}</p>
          )}
        </div>
        <div className="flex gap-1">
          {!achieved && (
            <button onClick={() => onStatus(goal.id, 'achieved')} title="Marcar como logrado" className="text-slate-500 hover:text-emerald-400 p-1">
              ✓
            </button>
          )}
          <button onClick={() => onDelete(goal.id)} className="text-slate-500 hover:text-red-400 p-1">
            <Trash2 size={12} />
          </button>
        </div>
      </div>
      {progress !== null && (
        <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
          <div className="h-full bg-cyan-500" style={{ width: `${progress}%` }} />
        </div>
      )}
    </Card>
  )
}

// ──────────────────────────────────────────────────────────────
// Tab: Salud / Condiciones
// ──────────────────────────────────────────────────────────────
function TabSalud({ userId, conditions, onReload, toast }: {
  userId: string
  conditions: HealthCondition[]
  onReload: () => void
  toast: (kind: 'success' | 'error' | 'info' | 'warning', msg: string) => void
}) {
  const [adding, setAdding] = useState(false)
  const [form, setForm] = useState({
    condition_type: 'injury', title: '', description: '',
    severity: 'moderate', affected_area: '', restrictions: '', recommendations: '',
    started_at: '',
  })
  const [saving, setSaving] = useState(false)

  async function save() {
    if (!form.title.trim()) { toast('error', 'Título obligatorio'); return }
    setSaving(true)
    const supabase = createClient()
    const { error } = await supabase.from('nm_gym_health_conditions').insert({
      user_id: userId,
      condition_type: form.condition_type,
      title: form.title.trim(),
      description: form.description.trim() || null,
      severity: form.severity,
      affected_area: form.affected_area.trim() || null,
      restrictions: form.restrictions.trim() || null,
      recommendations: form.recommendations.trim() || null,
      started_at: form.started_at || null,
      is_active: true,
    })
    setSaving(false)
    if (error) { toast('error', error.message); return }
    toast('success', 'Condición registrada')
    setAdding(false)
    setForm({ condition_type: 'injury', title: '', description: '', severity: 'moderate', affected_area: '', restrictions: '', recommendations: '', started_at: '' })
    onReload()
  }

  async function toggleActive(c: HealthCondition) {
    const supabase = createClient()
    await supabase.from('nm_gym_health_conditions').update({
      is_active: !c.is_active,
      resolved_at: !c.is_active ? null : new Date().toISOString().slice(0, 10),
    }).eq('id', c.id)
    onReload()
  }

  const typeLabel: Record<string, string> = {
    injury: 'Lesión', chronic: 'Patología crónica', allergy: 'Alergia',
    limitation: 'Limitación', surgery: 'Cirugía', other: 'Otro',
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={() => setAdding(true)} className="flex items-center gap-1">
          <Plus size={14} /> Nueva condición
        </Button>
      </div>

      {conditions.length === 0 ? (
        <Card className="p-8 text-center text-slate-500 text-sm">Sin condiciones registradas.</Card>
      ) : (
        <div className="space-y-2">
          {conditions.map(c => (
            <Card key={c.id} className={`p-3 ${!c.is_active ? 'opacity-60' : ''}`}>
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant={c.severity === 'severe' ? 'danger' : c.severity === 'moderate' ? 'warning' : 'default'}>
                      {typeLabel[c.condition_type] ?? c.condition_type}
                    </Badge>
                    {c.affected_area && <Badge variant="default">{c.affected_area}</Badge>}
                    {!c.is_active && <Badge variant="success">Resuelta</Badge>}
                  </div>
                  <h4 className="text-sm font-semibold text-white mt-1 flex items-center gap-1">
                    {c.is_active && <AlertTriangle size={12} className="text-amber-400" />}
                    {c.title}
                  </h4>
                  {c.description && <p className="text-xs text-slate-400 mt-1">{c.description}</p>}
                  {c.restrictions && (
                    <p className="text-xs text-red-300 mt-1"><strong>Evitar:</strong> {c.restrictions}</p>
                  )}
                  {c.recommendations && (
                    <p className="text-xs text-emerald-300 mt-1"><strong>Hacer:</strong> {c.recommendations}</p>
                  )}
                </div>
                <button onClick={() => toggleActive(c)} className="text-xs text-slate-400 hover:text-cyan-400 px-2 py-1">
                  {c.is_active ? 'Marcar resuelta' : 'Reactivar'}
                </button>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Modal open={adding} onClose={() => setAdding(false)} title="Nueva condición de salud" size="lg">
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-slate-400 mb-1">Tipo</label>
              <select
                value={form.condition_type}
                onChange={e => setForm({ ...form, condition_type: e.target.value })}
                className="w-full rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-white"
              >
                <option value="injury">Lesión</option>
                <option value="chronic">Patología crónica</option>
                <option value="allergy">Alergia</option>
                <option value="limitation">Limitación física</option>
                <option value="surgery">Cirugía</option>
                <option value="other">Otro</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Gravedad</label>
              <select
                value={form.severity}
                onChange={e => setForm({ ...form, severity: e.target.value })}
                className="w-full rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-white"
              >
                <option value="mild">Leve</option>
                <option value="moderate">Moderada</option>
                <option value="severe">Grave</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">Título *</label>
            <Input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="Ej: Hernia de disco L4-L5" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-slate-400 mb-1">Zona afectada</label>
              <Input value={form.affected_area} onChange={e => setForm({ ...form, affected_area: e.target.value })} placeholder="Espalda baja, rodilla derecha…" />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Desde</label>
              <Input type="date" value={form.started_at} onChange={e => setForm({ ...form, started_at: e.target.value })} />
            </div>
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">Descripción</label>
            <textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} rows={2} className="w-full rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-white" />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">Restricciones (qué evitar)</label>
            <textarea value={form.restrictions} onChange={e => setForm({ ...form, restrictions: e.target.value })} rows={2} className="w-full rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-white" />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">Recomendaciones (qué hacer)</label>
            <textarea value={form.recommendations} onChange={e => setForm({ ...form, recommendations: e.target.value })} rows={2} className="w-full rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-white" />
          </div>
          <div className="flex gap-2 justify-end pt-2">
            <Button variant="ghost" onClick={() => setAdding(false)} disabled={saving}>Cancelar</Button>
            <Button onClick={save} disabled={saving} className="flex items-center gap-1">
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
              Guardar
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}

// ──────────────────────────────────────────────────────────────
// Tab: Abonos
// ──────────────────────────────────────────────────────────────
function TabAbonos({ memberships }: { memberships: GymMembership[] }) {
  if (memberships.length === 0) {
    return <Card className="p-8 text-center text-slate-500 text-sm">Sin abonos registrados.</Card>
  }
  return (
    <Card className="p-0 overflow-hidden">
      <table className="w-full text-xs">
        <thead className="bg-slate-900/60">
          <tr className="text-left text-slate-400">
            <th className="px-3 py-2">Plan</th>
            <th className="px-3 py-2">Desde</th>
            <th className="px-3 py-2">Hasta</th>
            <th className="px-3 py-2">Estado</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-800">
          {memberships.map(m => (
            <tr key={m.id}>
              <td className="px-3 py-2 text-white">{m.plan ?? '—'}</td>
              <td className="px-3 py-2 text-slate-300">{m.start_date ? formatDate(m.start_date) : '—'}</td>
              <td className="px-3 py-2 text-slate-300">{m.end_date ? formatDate(m.end_date) : '—'}</td>
              <td className="px-3 py-2">
                <Badge variant={m.status === 'active' ? 'success' : m.status === 'cancelled' ? 'danger' : 'default'}>
                  {m.status ?? '—'}
                </Badge>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  )
}

// ──────────────────────────────────────────────────────────────
// Tab: Accesos
// ──────────────────────────────────────────────────────────────
function TabAccesos({ accesses }: { accesses: AccessLog[] }) {
  if (accesses.length === 0) {
    return <Card className="p-8 text-center text-slate-500 text-sm">Sin registros de acceso.</Card>
  }
  return (
    <Card className="p-0 overflow-hidden">
      <table className="w-full text-xs">
        <thead className="bg-slate-900/60">
          <tr className="text-left text-slate-400">
            <th className="px-3 py-2">Fecha y hora</th>
            <th className="px-3 py-2">Punto de acceso</th>
            <th className="px-3 py-2">Resultado</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-800">
          {accesses.map(a => (
            <tr key={a.id}>
              <td className="px-3 py-2 text-slate-300">{new Date(a.timestamp).toLocaleString('es-ES')}</td>
              <td className="px-3 py-2 text-slate-300">{a.access_point ?? '—'}</td>
              <td className="px-3 py-2">
                <Badge variant={a.result === 'allowed' || a.result === 'ok' ? 'success' : 'danger'}>
                  {a.result ?? '—'}
                </Badge>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  )
}

// ──────────────────────────────────────────────────────────────
// Tab: Facturación
// ──────────────────────────────────────────────────────────────
function TabFacturacion({ invoices }: { invoices: InvoiceSummary[] }) {
  if (invoices.length === 0) {
    return <Card className="p-8 text-center text-slate-500 text-sm">Sin facturas.</Card>
  }
  const total = invoices.reduce((s, i) => s + (i.total ?? 0), 0)
  return (
    <div className="space-y-3">
      <Card className="p-4 flex items-center justify-between">
        <span className="text-sm text-slate-400">Total facturado histórico</span>
        <span className="text-2xl font-bold text-cyan-400 font-mono">{formatCurrency(total)}</span>
      </Card>
      <Card className="p-0 overflow-hidden">
        <table className="w-full text-xs">
          <thead className="bg-slate-900/60">
            <tr className="text-left text-slate-400">
              <th className="px-3 py-2">Factura</th>
              <th className="px-3 py-2">Fecha</th>
              <th className="px-3 py-2">Producto</th>
              <th className="px-3 py-2 text-right">Importe</th>
              <th className="px-3 py-2">Estado</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {invoices.map(i => {
              const firstItem = i.items?.[0]
              return (
                <tr key={i.id}>
                  <td className="px-3 py-2 font-mono text-slate-300">{i.invoice_number}</td>
                  <td className="px-3 py-2 text-slate-300">{i.paid_at ? formatDate(i.paid_at) : '—'}</td>
                  <td className="px-3 py-2 text-slate-300">{firstItem?.name ?? '—'}</td>
                  <td className="px-3 py-2 text-right font-mono text-cyan-400">{formatCurrency(i.total)}</td>
                  <td className="px-3 py-2">
                    <Badge variant={i.status === 'paid' ? 'success' : 'warning'}>{i.status}</Badge>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </Card>
    </div>
  )
}

// ──────────────────────────────────────────────────────────────
// Tab: Notas del coach
// ──────────────────────────────────────────────────────────────
function TabNotas({ userId, notes, onReload, toast }: {
  userId: string
  notes: CoachNote[]
  onReload: () => void
  toast: (kind: 'success' | 'error' | 'info' | 'warning', msg: string) => void
}) {
  const [adding, setAdding] = useState(false)
  const [form, setForm] = useState({ category: 'general', title: '', content: '', is_private: false })
  const [saving, setSaving] = useState(false)

  async function save() {
    if (!form.content.trim()) { toast('error', 'Escribí el contenido'); return }
    setSaving(true)
    const supabase = createClient()
    const { error } = await supabase.from('nm_gym_coach_notes').insert({
      user_id: userId,
      category: form.category,
      title: form.title.trim() || null,
      content: form.content.trim(),
      is_private: form.is_private,
    })
    setSaving(false)
    if (error) { toast('error', error.message); return }
    toast('success', 'Nota guardada')
    setAdding(false)
    setForm({ category: 'general', title: '', content: '', is_private: false })
    onReload()
  }

  async function togglePin(n: CoachNote) {
    const supabase = createClient()
    await supabase.from('nm_gym_coach_notes').update({ is_pinned: !n.is_pinned }).eq('id', n.id)
    onReload()
  }

  async function remove(id: number) {
    if (!confirm('¿Borrar la nota?')) return
    const supabase = createClient()
    await supabase.from('nm_gym_coach_notes').delete().eq('id', id)
    onReload()
  }

  const catLabel: Record<string, string> = {
    general: 'General', technique: 'Técnica', progress: 'Progreso',
    behavior: 'Comportamiento', recommendation: 'Recomendación', warning: 'Aviso',
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={() => setAdding(true)} className="flex items-center gap-1">
          <Plus size={14} /> Nueva nota
        </Button>
      </div>

      {notes.length === 0 ? (
        <Card className="p-8 text-center text-slate-500 text-sm">Sin notas todavía.</Card>
      ) : (
        <div className="space-y-2">
          {notes.map(n => (
            <Card key={n.id} className={`p-3 ${n.is_pinned ? 'border-l-4 border-l-amber-500' : ''}`}>
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <Badge variant="cyan">{catLabel[n.category] ?? n.category}</Badge>
                    {n.is_private && <Badge variant="warning">Privada</Badge>}
                    {n.is_pinned && <Badge variant="default">📌 Fijada</Badge>}
                  </div>
                  {n.title && <h4 className="text-sm font-semibold text-white mt-1">{n.title}</h4>}
                  <p className="text-sm text-slate-300 mt-1 whitespace-pre-wrap">{n.content}</p>
                  <p className="text-[10px] text-slate-500 mt-2">{new Date(n.created_at).toLocaleString('es-ES')}</p>
                </div>
                <div className="flex gap-1">
                  <button onClick={() => togglePin(n)} title={n.is_pinned ? 'Desfijar' : 'Fijar'} className="text-slate-500 hover:text-amber-400 p-1">
                    {n.is_pinned ? <PinOff size={12} /> : <Pin size={12} />}
                  </button>
                  <button onClick={() => remove(n.id)} className="text-slate-500 hover:text-red-400 p-1">
                    <Trash2 size={12} />
                  </button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Modal open={adding} onClose={() => setAdding(false)} title="Nueva nota" size="lg">
        <div className="space-y-3">
          <div>
            <label className="block text-xs text-slate-400 mb-1">Categoría</label>
            <select
              value={form.category}
              onChange={e => setForm({ ...form, category: e.target.value })}
              className="w-full rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-white"
            >
              <option value="general">General</option>
              <option value="technique">Técnica</option>
              <option value="progress">Progreso</option>
              <option value="behavior">Comportamiento</option>
              <option value="recommendation">Recomendación</option>
              <option value="warning">Aviso</option>
            </select>
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">Título (opcional)</label>
            <Input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">Contenido *</label>
            <textarea
              value={form.content}
              onChange={e => setForm({ ...form, content: e.target.value })}
              rows={5}
              className="w-full rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-white"
            />
          </div>
          <label className="flex items-center gap-2 text-sm text-slate-300">
            <input type="checkbox" checked={form.is_private} onChange={e => setForm({ ...form, is_private: e.target.checked })} />
            Nota privada (solo staff — el socio no la ve)
          </label>
          <div className="flex gap-2 justify-end pt-2">
            <Button variant="ghost" onClick={() => setAdding(false)} disabled={saving}>Cancelar</Button>
            <Button onClick={save} disabled={saving} className="flex items-center gap-1">
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
              Guardar
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
