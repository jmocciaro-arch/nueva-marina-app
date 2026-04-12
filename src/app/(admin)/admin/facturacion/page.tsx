'use client'

import { useState, useCallback, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Card } from '@/components/ui/card'
import { Modal } from '@/components/ui/modal'
import { Badge } from '@/components/ui/badge'
import { KpiCard } from '@/components/ui/kpi-card'
import { useToast } from '@/components/ui/toast'
import { formatCurrency } from '@/lib/utils'
import {
  Receipt, Plus, CreditCard, Users, FileText, Trash2, Edit3,
  Ticket, Package, CheckCircle, Clock, AlertCircle, Search, XCircle
} from 'lucide-react'
import type { SubscriptionPlan, Subscription, Invoice, CreditPack, UserCredit } from '@/types'

const TABS = ['Planes', 'Suscripciones', 'Facturas', 'Bonos'] as const
type Tab = typeof TABS[number]

const BILLING_CYCLES = [
  { value: 'monthly', label: 'Mensual' },
  { value: 'quarterly', label: 'Trimestral' },
  { value: 'semiannual', label: 'Semestral' },
  { value: 'annual', label: 'Anual' },
]

const SUB_STATUSES: Record<string, { label: string; variant: 'success' | 'warning' | 'danger' | 'info' }> = {
  active: { label: 'Activa', variant: 'success' },
  past_due: { label: 'Vencida', variant: 'warning' },
  cancelled: { label: 'Cancelada', variant: 'danger' },
  paused: { label: 'Pausada', variant: 'info' },
  expired: { label: 'Expirada', variant: 'danger' },
}

const INV_STATUSES: Record<string, { label: string; variant: 'success' | 'warning' | 'danger' | 'info' }> = {
  pending: { label: 'Pendiente', variant: 'warning' },
  paid: { label: 'Pagada', variant: 'success' },
  overdue: { label: 'Vencida', variant: 'danger' },
  cancelled: { label: 'Anulada', variant: 'danger' },
  refunded: { label: 'Reembolsada', variant: 'info' },
}

const CREDIT_TYPES = [
  { value: 'class', label: 'Clases' },
  { value: 'booking', label: 'Reservas' },
  { value: 'mixed', label: 'Mixto' },
]

export default function FacturacionPage() {
  const { toast } = useToast()
  const [tab, setTab] = useState<Tab>('Planes')

  // ─── Plans ───
  const [plans, setPlans] = useState<SubscriptionPlan[]>([])
  const [loadingPlans, setLoadingPlans] = useState(true)
  const [planModal, setPlanModal] = useState(false)
  const [editingPlan, setEditingPlan] = useState<SubscriptionPlan | null>(null)
  const [savingPlan, setSavingPlan] = useState(false)
  const [planForm, setPlanForm] = useState({
    name: '', description: '', price: '', billing_cycle: 'monthly',
    includes_gym: false, includes_courts: false, court_discount_pct: '0',
    max_classes_per_week: '', max_bookings_per_week: '',
  })

  // ─── Subscriptions ───
  const [subs, setSubs] = useState<(Subscription & { user?: { full_name?: string; email?: string }; plan?: { name?: string } })[]>([])
  const [loadingSubs, setLoadingSubs] = useState(true)
  const [subSearch, setSubSearch] = useState('')
  const [subModal, setSubModal] = useState(false)
  const [savingSub, setSavingSub] = useState(false)
  const [subForm, setSubForm] = useState({ user_id: '', plan_id: '', payment_method: 'cash', start_date: new Date().toISOString().split('T')[0] })
  const [userOptions, setUserOptions] = useState<{ value: string; label: string }[]>([])

  // ─── Invoices ───
  const [invoices, setInvoices] = useState<(Invoice & { user?: { full_name?: string; email?: string } })[]>([])
  const [loadingInvoices, setLoadingInvoices] = useState(true)
  const [invFilter, setInvFilter] = useState('all')

  // ─── Credit Packs ───
  const [packs, setPacks] = useState<CreditPack[]>([])
  const [loadingPacks, setLoadingPacks] = useState(true)
  const [packModal, setPackModal] = useState(false)
  const [savingPack, setSavingPack] = useState(false)
  const [packForm, setPackForm] = useState({ name: '', type: 'class', credits: '', price: '', valid_days: '90' })

  // ─── User Credits ───
  const [userCredits, setUserCredits] = useState<(UserCredit & { user?: { full_name?: string }; pack?: { name?: string } })[]>([])

  // ─── Loaders ───
  const loadPlans = useCallback(async () => {
    setLoadingPlans(true)
    const supabase = createClient()
    const { data } = await supabase.from('nm_subscription_plans').select('*').eq('club_id', 1).order('sort_order')
    setPlans((data || []) as SubscriptionPlan[])
    setLoadingPlans(false)
  }, [])

  const loadSubs = useCallback(async () => {
    setLoadingSubs(true)
    const supabase = createClient()
    const { data } = await supabase
      .from('nm_subscriptions')
      .select('*, user:nm_users(full_name, email), plan:nm_subscription_plans(name)')
      .eq('club_id', 1)
      .order('created_at', { ascending: false })
    setSubs((data || []) as unknown as typeof subs)
    setLoadingSubs(false)
  }, [])

  const loadInvoices = useCallback(async () => {
    setLoadingInvoices(true)
    const supabase = createClient()
    let query = supabase
      .from('nm_invoices')
      .select('*, user:nm_users(full_name, email)')
      .eq('club_id', 1)
      .order('created_at', { ascending: false })
      .limit(100)
    if (invFilter !== 'all') query = query.eq('status', invFilter)
    const { data } = await query
    setInvoices((data || []) as unknown as typeof invoices)
    setLoadingInvoices(false)
  }, [invFilter])

  const loadPacks = useCallback(async () => {
    setLoadingPacks(true)
    const supabase = createClient()
    const { data: packsData } = await supabase.from('nm_credit_packs').select('*').eq('club_id', 1).order('created_at', { ascending: false })
    setPacks((packsData || []) as CreditPack[])
    const { data: creditsData } = await supabase
      .from('nm_user_credits')
      .select('*, user:nm_users(full_name), pack:nm_credit_packs(name)')
      .eq('club_id', 1)
      .eq('status', 'active')
      .order('purchased_at', { ascending: false })
      .limit(50)
    setUserCredits((creditsData || []) as unknown as typeof userCredits)
    setLoadingPacks(false)
  }, [])

  const loadUsers = useCallback(async () => {
    const supabase = createClient()
    const { data } = await supabase.from('nm_users').select('id, full_name, email').eq('is_active', true).order('full_name').limit(500)
    setUserOptions((data || []).map(u => ({ value: u.id, label: `${u.full_name || u.email} (${u.email})` })))
  }, [])

  useEffect(() => {
    if (tab === 'Planes') loadPlans()
    else if (tab === 'Suscripciones') { loadSubs(); loadPlans(); loadUsers() }
    else if (tab === 'Facturas') loadInvoices()
    else if (tab === 'Bonos') loadPacks()
  }, [tab, loadPlans, loadSubs, loadInvoices, loadPacks, loadUsers])

  // ─── KPIs ───
  const activeSubs = subs.filter(s => s.status === 'active').length
  const monthlyRevenue = subs.filter(s => s.status === 'active').reduce((sum, s) => {
    const plan = plans.find(p => p.id === s.plan_id)
    return sum + (plan?.price || 0)
  }, 0)
  const pendingInvoices = invoices.filter(i => i.status === 'pending' || i.status === 'overdue').length
  const pendingAmount = invoices.filter(i => i.status === 'pending' || i.status === 'overdue').reduce((s, i) => s + (i.total || 0), 0)

  // ─── Plan CRUD ───
  function openNewPlan() {
    setEditingPlan(null)
    setPlanForm({ name: '', description: '', price: '', billing_cycle: 'monthly', includes_gym: false, includes_courts: false, court_discount_pct: '0', max_classes_per_week: '', max_bookings_per_week: '' })
    setPlanModal(true)
  }
  function openEditPlan(p: SubscriptionPlan) {
    setEditingPlan(p)
    setPlanForm({
      name: p.name, description: p.description || '', price: String(p.price), billing_cycle: p.billing_cycle,
      includes_gym: p.includes_gym, includes_courts: p.includes_courts, court_discount_pct: String(p.court_discount_pct || 0),
      max_classes_per_week: p.max_classes_per_week ? String(p.max_classes_per_week) : '', max_bookings_per_week: p.max_bookings_per_week ? String(p.max_bookings_per_week) : '',
    })
    setPlanModal(true)
  }
  async function savePlan(e: React.FormEvent) {
    e.preventDefault()
    if (!planForm.name || !planForm.price) return
    setSavingPlan(true)
    const supabase = createClient()
    const payload = {
      club_id: 1, name: planForm.name, description: planForm.description || null,
      price: Number(planForm.price), billing_cycle: planForm.billing_cycle,
      includes_gym: planForm.includes_gym, includes_courts: planForm.includes_courts,
      court_discount_pct: Number(planForm.court_discount_pct) || 0,
      max_classes_per_week: planForm.max_classes_per_week ? Number(planForm.max_classes_per_week) : null,
      max_bookings_per_week: planForm.max_bookings_per_week ? Number(planForm.max_bookings_per_week) : null,
    }
    const { error } = editingPlan
      ? await supabase.from('nm_subscription_plans').update(payload).eq('id', editingPlan.id)
      : await supabase.from('nm_subscription_plans').insert(payload)
    if (error) toast('error', error.message)
    else { toast('success', editingPlan ? 'Plan actualizado' : 'Plan creado'); setPlanModal(false); loadPlans() }
    setSavingPlan(false)
  }
  async function deletePlan(id: number) {
    if (!confirm('¿Eliminar este plan?')) return
    const supabase = createClient()
    const { error } = await supabase.from('nm_subscription_plans').delete().eq('id', id)
    if (error) toast('error', error.message)
    else { toast('info', 'Plan eliminado'); loadPlans() }
  }

  // ─── Subscription create ───
  async function saveSub(e: React.FormEvent) {
    e.preventDefault()
    if (!subForm.user_id || !subForm.plan_id) return
    setSavingSub(true)
    const supabase = createClient()
    const plan = plans.find(p => p.id === Number(subForm.plan_id))
    const startDate = subForm.start_date
    const periodEnd = new Date(startDate)
    if (plan?.billing_cycle === 'monthly') periodEnd.setMonth(periodEnd.getMonth() + 1)
    else if (plan?.billing_cycle === 'quarterly') periodEnd.setMonth(periodEnd.getMonth() + 3)
    else if (plan?.billing_cycle === 'semiannual') periodEnd.setMonth(periodEnd.getMonth() + 6)
    else if (plan?.billing_cycle === 'annual') periodEnd.setFullYear(periodEnd.getFullYear() + 1)

    const { error } = await supabase.from('nm_subscriptions').insert({
      club_id: 1, user_id: subForm.user_id, plan_id: Number(subForm.plan_id),
      status: 'active', start_date: startDate, current_period_start: startDate,
      current_period_end: periodEnd.toISOString().split('T')[0], payment_method: subForm.payment_method,
    })
    if (error) toast('error', error.message)
    else { toast('success', 'Suscripción creada'); setSubModal(false); loadSubs() }
    setSavingSub(false)
  }

  async function cancelSub(id: number) {
    if (!confirm('¿Cancelar esta suscripción?')) return
    const supabase = createClient()
    const { error } = await supabase.from('nm_subscriptions').update({ status: 'cancelled', cancelled_at: new Date().toISOString() }).eq('id', id)
    if (error) toast('error', error.message)
    else { toast('info', 'Suscripción cancelada'); loadSubs() }
  }

  // ─── Invoice mark paid ───
  async function markInvoicePaid(id: number) {
    const supabase = createClient()
    const { error } = await supabase.from('nm_invoices').update({ status: 'paid', paid_at: new Date().toISOString() }).eq('id', id)
    if (error) toast('error', error.message)
    else { toast('success', 'Factura marcada como pagada'); loadInvoices() }
  }

  // ─── Credit Pack CRUD ───
  async function savePack(e: React.FormEvent) {
    e.preventDefault()
    if (!packForm.name || !packForm.credits || !packForm.price) return
    setSavingPack(true)
    const supabase = createClient()
    const { error } = await supabase.from('nm_credit_packs').insert({
      club_id: 1, name: packForm.name, type: packForm.type,
      credits: Number(packForm.credits), price: Number(packForm.price),
      valid_days: Number(packForm.valid_days) || 90,
    })
    if (error) toast('error', error.message)
    else { toast('success', 'Bono creado'); setPackModal(false); loadPacks() }
    setSavingPack(false)
  }
  async function deletePack(id: number) {
    if (!confirm('¿Eliminar este bono?')) return
    const supabase = createClient()
    const { error } = await supabase.from('nm_credit_packs').delete().eq('id', id)
    if (error) toast('error', error.message)
    else { toast('info', 'Bono eliminado'); loadPacks() }
  }

  // ─── Filtered subs ───
  const filteredSubs = subs.filter(s => {
    if (!subSearch.trim()) return true
    const q = subSearch.toLowerCase()
    const u = s.user as { full_name?: string; email?: string } | undefined
    return (u?.full_name || '').toLowerCase().includes(q) || (u?.email || '').toLowerCase().includes(q)
  })

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Facturación</h1>
        <p className="text-sm text-slate-400 mt-1">Planes, suscripciones, facturas y bonos de crédito</p>
      </div>

      {/* Tabs */}
      <div className="flex bg-slate-800/50 rounded-lg p-1 gap-1">
        {TABS.map(t => (
          <button key={t} onClick={() => setTab(t)} className={`flex-1 py-2 px-3 rounded-md text-sm font-medium transition-colors ${tab === t ? 'bg-cyan-600 text-white' : 'text-slate-400 hover:text-white'}`}>
            {t}
          </button>
        ))}
      </div>

      {/* ═══════════ TAB: Planes ═══════════ */}
      {tab === 'Planes' && (
        <>
          <div className="flex justify-end">
            <Button onClick={openNewPlan}><Plus size={16} className="mr-1" /> Nuevo Plan</Button>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {loadingPlans ? (
              <p className="text-slate-500 col-span-full text-center py-12">Cargando...</p>
            ) : plans.length === 0 ? (
              <p className="text-slate-500 col-span-full text-center py-12">No hay planes configurados</p>
            ) : plans.map(p => (
              <Card key={p.id}>
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <p className="font-semibold text-white text-lg">{p.name}</p>
                    <p className="text-xs text-slate-400">{BILLING_CYCLES.find(c => c.value === p.billing_cycle)?.label}</p>
                  </div>
                  <p className="text-2xl font-bold text-cyan-400">{formatCurrency(p.price)}</p>
                </div>
                {p.description && <p className="text-sm text-slate-400 mb-3">{p.description}</p>}
                <div className="flex flex-wrap gap-2 mb-4">
                  {p.includes_gym && <Badge variant="success">Gym</Badge>}
                  {p.includes_courts && <Badge variant="info">Pistas</Badge>}
                  {p.court_discount_pct > 0 && <Badge variant="info">{p.court_discount_pct}% dto pista</Badge>}
                  {p.max_classes_per_week && <Badge variant="warning">{p.max_classes_per_week} clases/sem</Badge>}
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="ghost" size="sm" onClick={() => openEditPlan(p)}><Edit3 size={14} className="mr-1" /> Editar</Button>
                  <button onClick={() => deletePlan(p.id)} className="p-1.5 rounded text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-colors"><Trash2 size={14} /></button>
                </div>
              </Card>
            ))}
          </div>

          <Modal open={planModal} onClose={() => setPlanModal(false)} title={editingPlan ? 'Editar Plan' : 'Nuevo Plan'} footer={<div className="flex gap-3"><Button variant="ghost" onClick={() => setPlanModal(false)}>Cancelar</Button><Button onClick={savePlan} loading={savingPlan}>Guardar</Button></div>}>
            <form onSubmit={savePlan} className="space-y-4">
              <Input label="Nombre" placeholder="Socio Premium" value={planForm.name} onChange={e => setPlanForm(f => ({ ...f, name: e.target.value }))} required />
              <Input label="Descripción" placeholder="Acceso completo al club..." value={planForm.description} onChange={e => setPlanForm(f => ({ ...f, description: e.target.value }))} />
              <div className="grid grid-cols-2 gap-4">
                <Input label="Precio (EUR)" type="number" step="0.01" min="0" value={planForm.price} onChange={e => setPlanForm(f => ({ ...f, price: e.target.value }))} required />
                <Select label="Ciclo de facturación" value={planForm.billing_cycle} onChange={e => setPlanForm(f => ({ ...f, billing_cycle: e.target.value }))} options={BILLING_CYCLES} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <label className="flex items-center gap-2 text-sm text-slate-300 cursor-pointer">
                  <input type="checkbox" checked={planForm.includes_gym} onChange={e => setPlanForm(f => ({ ...f, includes_gym: e.target.checked }))} className="rounded border-slate-600 bg-slate-800" />
                  Incluye gimnasio
                </label>
                <label className="flex items-center gap-2 text-sm text-slate-300 cursor-pointer">
                  <input type="checkbox" checked={planForm.includes_courts} onChange={e => setPlanForm(f => ({ ...f, includes_courts: e.target.checked }))} className="rounded border-slate-600 bg-slate-800" />
                  Incluye pistas
                </label>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <Input label="Dto. pista %" type="number" min="0" max="100" value={planForm.court_discount_pct} onChange={e => setPlanForm(f => ({ ...f, court_discount_pct: e.target.value }))} />
                <Input label="Clases/semana" type="number" min="0" placeholder="∞" value={planForm.max_classes_per_week} onChange={e => setPlanForm(f => ({ ...f, max_classes_per_week: e.target.value }))} />
                <Input label="Reservas/semana" type="number" min="0" placeholder="∞" value={planForm.max_bookings_per_week} onChange={e => setPlanForm(f => ({ ...f, max_bookings_per_week: e.target.value }))} />
              </div>
            </form>
          </Modal>
        </>
      )}

      {/* ═══════════ TAB: Suscripciones ═══════════ */}
      {tab === 'Suscripciones' && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <KpiCard title="Suscripciones activas" value={activeSubs} icon={<Users size={20} />} color="#10b981" />
            <KpiCard title="Ingreso mensual" value={formatCurrency(monthlyRevenue)} icon={<Receipt size={20} />} color="#06b6d4" />
            <KpiCard title="Facturas pendientes" value={pendingInvoices} icon={<Clock size={20} />} color="#f59e0b" />
            <KpiCard title="Monto pendiente" value={formatCurrency(pendingAmount)} icon={<AlertCircle size={20} />} color="#ef4444" />
          </div>

          <div className="flex items-center gap-4">
            <div className="relative flex-1 max-w-sm">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input type="text" placeholder="Buscar por nombre o email..." value={subSearch} onChange={e => setSubSearch(e.target.value)} className="w-full rounded-lg border border-slate-600 bg-slate-800 pl-9 pr-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/40" />
            </div>
            <Button onClick={() => setSubModal(true)}><Plus size={16} className="mr-1" /> Nueva Suscripción</Button>
          </div>

          <Card>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-700">
                    <th className="text-left text-xs font-medium text-slate-400 pb-3 pl-2">Usuario</th>
                    <th className="text-left text-xs font-medium text-slate-400 pb-3">Plan</th>
                    <th className="text-left text-xs font-medium text-slate-400 pb-3">Estado</th>
                    <th className="text-left text-xs font-medium text-slate-400 pb-3">Período</th>
                    <th className="text-left text-xs font-medium text-slate-400 pb-3">Pago</th>
                    <th className="text-right text-xs font-medium text-slate-400 pb-3 pr-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {loadingSubs ? (
                    <tr><td colSpan={6} className="text-center py-8 text-slate-500">Cargando...</td></tr>
                  ) : filteredSubs.length === 0 ? (
                    <tr><td colSpan={6} className="text-center py-8 text-slate-500">No hay suscripciones</td></tr>
                  ) : filteredSubs.map(s => {
                    const u = s.user as { full_name?: string; email?: string } | undefined
                    const p = s.plan as { name?: string } | undefined
                    const st = SUB_STATUSES[s.status] || { label: s.status, variant: 'info' as const }
                    return (
                      <tr key={s.id} className="border-b border-slate-800 hover:bg-slate-800/30">
                        <td className="py-3 pl-2">
                          <p className="text-sm text-white">{u?.full_name || 'Sin nombre'}</p>
                          <p className="text-xs text-slate-500">{u?.email}</p>
                        </td>
                        <td className="py-3 text-sm text-cyan-400 font-medium">{p?.name || '—'}</td>
                        <td className="py-3"><Badge variant={st.variant}>{st.label}</Badge></td>
                        <td className="py-3 text-xs text-slate-400">
                          {s.current_period_start && s.current_period_end ? `${s.current_period_start} → ${s.current_period_end}` : s.start_date}
                        </td>
                        <td className="py-3 text-sm text-slate-400 capitalize">{s.payment_method || '—'}</td>
                        <td className="py-3 pr-2 text-right">
                          {s.status === 'active' && (
                            <button onClick={() => cancelSub(s.id)} className="p-1.5 rounded text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-colors" title="Cancelar"><XCircle size={14} /></button>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </Card>

          <Modal open={subModal} onClose={() => setSubModal(false)} title="Nueva Suscripción" footer={<div className="flex gap-3"><Button variant="ghost" onClick={() => setSubModal(false)}>Cancelar</Button><Button onClick={saveSub} loading={savingSub}>Crear</Button></div>}>
            <form onSubmit={saveSub} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Usuario</label>
                <select value={subForm.user_id} onChange={e => setSubForm(f => ({ ...f, user_id: e.target.value }))} required className="w-full rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-cyan-500/40">
                  <option value="">Seleccionar usuario...</option>
                  {userOptions.map(u => <option key={u.value} value={u.value}>{u.label}</option>)}
                </select>
              </div>
              <Select label="Plan" value={subForm.plan_id} onChange={e => setSubForm(f => ({ ...f, plan_id: e.target.value }))} options={[{ value: '', label: 'Seleccionar plan...' }, ...plans.map(p => ({ value: String(p.id), label: `${p.name} — ${formatCurrency(p.price)}/${BILLING_CYCLES.find(c => c.value === p.billing_cycle)?.label}` }))]} />
              <div className="grid grid-cols-2 gap-4">
                <Input label="Fecha inicio" type="date" value={subForm.start_date} onChange={e => setSubForm(f => ({ ...f, start_date: e.target.value }))} required />
                <Select label="Método de pago" value={subForm.payment_method} onChange={e => setSubForm(f => ({ ...f, payment_method: e.target.value }))} options={[
                  { value: 'cash', label: 'Efectivo' }, { value: 'card', label: 'Tarjeta' },
                  { value: 'transfer', label: 'Transferencia' }, { value: 'direct_debit', label: 'Domiciliación' },
                ]} />
              </div>
            </form>
          </Modal>
        </>
      )}

      {/* ═══════════ TAB: Facturas ═══════════ */}
      {tab === 'Facturas' && (
        <>
          <div className="flex items-center gap-4">
            <div className="flex bg-slate-800 rounded-lg p-1 gap-1">
              {[{ v: 'all', l: 'Todas' }, { v: 'pending', l: 'Pendientes' }, { v: 'paid', l: 'Pagadas' }, { v: 'overdue', l: 'Vencidas' }].map(f => (
                <button key={f.v} onClick={() => setInvFilter(f.v)} className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${invFilter === f.v ? 'bg-cyan-600 text-white' : 'text-slate-400 hover:text-white'}`}>{f.l}</button>
              ))}
            </div>
          </div>

          <Card>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-700">
                    <th className="text-left text-xs font-medium text-slate-400 pb-3 pl-2">Nº Factura</th>
                    <th className="text-left text-xs font-medium text-slate-400 pb-3">Usuario</th>
                    <th className="text-right text-xs font-medium text-slate-400 pb-3">Total</th>
                    <th className="text-left text-xs font-medium text-slate-400 pb-3">Estado</th>
                    <th className="text-left text-xs font-medium text-slate-400 pb-3">Vencimiento</th>
                    <th className="text-right text-xs font-medium text-slate-400 pb-3 pr-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {loadingInvoices ? (
                    <tr><td colSpan={6} className="text-center py-8 text-slate-500">Cargando...</td></tr>
                  ) : invoices.length === 0 ? (
                    <tr><td colSpan={6} className="text-center py-8 text-slate-500">No hay facturas</td></tr>
                  ) : invoices.map(inv => {
                    const u = inv.user as { full_name?: string; email?: string } | undefined
                    const st = INV_STATUSES[inv.status] || { label: inv.status, variant: 'info' as const }
                    return (
                      <tr key={inv.id} className="border-b border-slate-800 hover:bg-slate-800/30">
                        <td className="py-3 pl-2 text-sm font-mono text-cyan-400">{inv.invoice_number}</td>
                        <td className="py-3">
                          <p className="text-sm text-white">{u?.full_name || 'Sin nombre'}</p>
                          <p className="text-xs text-slate-500">{u?.email}</p>
                        </td>
                        <td className="py-3 text-right text-sm font-semibold text-white">{formatCurrency(inv.total || 0)}</td>
                        <td className="py-3"><Badge variant={st.variant}>{st.label}</Badge></td>
                        <td className="py-3 text-sm text-slate-400">{inv.due_date || '—'}</td>
                        <td className="py-3 pr-2 text-right">
                          {(inv.status === 'pending' || inv.status === 'overdue') && (
                            <Button variant="ghost" size="sm" onClick={() => markInvoicePaid(inv.id)}>
                              <CheckCircle size={14} className="mr-1" /> Cobrar
                            </Button>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}

      {/* ═══════════ TAB: Bonos ═══════════ */}
      {tab === 'Bonos' && (
        <>
          <div className="flex justify-end">
            <Button onClick={() => setPackModal(true)}><Plus size={16} className="mr-1" /> Nuevo Bono</Button>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {loadingPacks ? (
              <p className="text-slate-500 col-span-full text-center py-12">Cargando...</p>
            ) : packs.length === 0 ? (
              <p className="text-slate-500 col-span-full text-center py-12">No hay bonos configurados</p>
            ) : packs.map(p => (
              <Card key={p.id}>
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-indigo-500/10 flex items-center justify-center">
                      <Ticket size={20} className="text-indigo-400" />
                    </div>
                    <div>
                      <p className="font-semibold text-white">{p.name}</p>
                      <p className="text-xs text-slate-400">{CREDIT_TYPES.find(t => t.value === p.type)?.label} · {p.valid_days} días</p>
                    </div>
                  </div>
                </div>
                <div className="flex items-baseline gap-2 mt-3">
                  <span className="text-2xl font-bold text-indigo-400">{p.credits}</span>
                  <span className="text-sm text-slate-400">créditos</span>
                  <span className="ml-auto text-lg font-semibold text-white">{formatCurrency(p.price)}</span>
                </div>
                <div className="mt-3 flex items-center gap-2">
                  <button onClick={() => deletePack(p.id)} className="p-1.5 rounded text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-colors"><Trash2 size={14} /></button>
                </div>
              </Card>
            ))}
          </div>

          {/* Active user credits */}
          {userCredits.length > 0 && (
            <>
              <h3 className="text-lg font-semibold text-white mt-6">Créditos activos de usuarios</h3>
              <Card>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-slate-700">
                        <th className="text-left text-xs font-medium text-slate-400 pb-3 pl-2">Usuario</th>
                        <th className="text-left text-xs font-medium text-slate-400 pb-3">Bono</th>
                        <th className="text-center text-xs font-medium text-slate-400 pb-3">Usados</th>
                        <th className="text-center text-xs font-medium text-slate-400 pb-3">Restantes</th>
                        <th className="text-left text-xs font-medium text-slate-400 pb-3">Vence</th>
                      </tr>
                    </thead>
                    <tbody>
                      {userCredits.map(uc => {
                        const u = uc.user as { full_name?: string } | undefined
                        const pk = uc.pack as { name?: string } | undefined
                        const remaining = uc.total_credits - uc.used_credits
                        return (
                          <tr key={uc.id} className="border-b border-slate-800">
                            <td className="py-3 pl-2 text-sm text-white">{u?.full_name || '—'}</td>
                            <td className="py-3 text-sm text-indigo-400">{pk?.name || '—'}</td>
                            <td className="py-3 text-center text-sm text-slate-400">{uc.used_credits}</td>
                            <td className="py-3 text-center text-sm font-semibold text-white">{remaining}</td>
                            <td className="py-3 text-sm text-slate-400">{uc.expires_at ? new Date(uc.expires_at).toLocaleDateString('es-ES') : '—'}</td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </Card>
            </>
          )}

          <Modal open={packModal} onClose={() => setPackModal(false)} title="Nuevo Bono de Créditos" footer={<div className="flex gap-3"><Button variant="ghost" onClick={() => setPackModal(false)}>Cancelar</Button><Button onClick={savePack} loading={savingPack}>Crear</Button></div>}>
            <form onSubmit={savePack} className="space-y-4">
              <Input label="Nombre" placeholder="Bono 10 Clases" value={packForm.name} onChange={e => setPackForm(f => ({ ...f, name: e.target.value }))} required />
              <Select label="Tipo" value={packForm.type} onChange={e => setPackForm(f => ({ ...f, type: e.target.value }))} options={CREDIT_TYPES} />
              <div className="grid grid-cols-3 gap-4">
                <Input label="Créditos" type="number" min="1" value={packForm.credits} onChange={e => setPackForm(f => ({ ...f, credits: e.target.value }))} required />
                <Input label="Precio (EUR)" type="number" step="0.01" min="0" value={packForm.price} onChange={e => setPackForm(f => ({ ...f, price: e.target.value }))} required />
                <Input label="Validez (días)" type="number" min="1" value={packForm.valid_days} onChange={e => setPackForm(f => ({ ...f, valid_days: e.target.value }))} />
              </div>
            </form>
          </Modal>
        </>
      )}
    </div>
  )
}
