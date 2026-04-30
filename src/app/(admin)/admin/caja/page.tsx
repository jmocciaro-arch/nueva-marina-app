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
import { Banknote, Plus, TrendingUp, TrendingDown, CreditCard, Wallet, ArrowRightLeft, ChevronLeft, ChevronRight, Trash2, Edit3 } from 'lucide-react'
import type { CashEntry } from '@/types'
import { useRealtimeRefresh } from '@/hooks/use-realtime-refresh'

const PAYMENT_METHODS: Record<string, { label: string; icon: React.ReactNode }> = {
  cash: { label: 'Efectivo', icon: <Wallet size={14} /> },
  card: { label: 'Tarjeta', icon: <CreditCard size={14} /> },
  transfer: { label: 'Transferencia', icon: <ArrowRightLeft size={14} /> },
  bizum: { label: 'Bizum', icon: <Banknote size={14} /> },
}

const ENTRY_TYPES = [
  { value: 'booking', label: 'Reserva' },
  { value: 'shop', label: 'Tienda' },
  { value: 'tournament', label: 'Torneo' },
  { value: 'league', label: 'Liga' },
  { value: 'gym', label: 'Gimnasio' },
  { value: 'class', label: 'Clase' },
  { value: 'subscription', label: 'Suscripción' },
  { value: 'credit_pack', label: 'Bono créditos' },
  { value: 'other', label: 'Otro' },
]

export default function CajaRegistradoraPage() {
  const { toast } = useToast()
  const [date, setDate] = useState(() => new Date().toISOString().split('T')[0])
  const [entries, setEntries] = useState<CashEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [editingEntry, setEditingEntry] = useState<CashEntry | null>(null)

  const [formType, setFormType] = useState('other')
  const [formDesc, setFormDesc] = useState('')
  const [formAmount, setFormAmount] = useState('')
  const [formMethod, setFormMethod] = useState('cash')
  const [formIsExpense, setFormIsExpense] = useState(false)

  const loadEntries = useCallback(async () => {
    setLoading(true)
    const supabase = createClient()
    const { data } = await supabase
      .from('nm_cash_register')
      .select('*')
      .eq('club_id', 1)
      .eq('date', date)
      .order('created_at', { ascending: false })

    setEntries((data || []) as CashEntry[])
    setLoading(false)
  }, [date])

  useEffect(() => {
    loadEntries()
  }, [loadEntries])

  useRealtimeRefresh(['nm_cash_register'], loadEntries)

  const totalIncome = entries.filter(e => e.amount > 0).reduce((s, e) => s + e.amount, 0)
  const totalExpense = entries.filter(e => e.amount < 0).reduce((s, e) => s + Math.abs(e.amount), 0)
  const netTotal = totalIncome - totalExpense
  const byMethod = entries.reduce((acc, e) => {
    if (e.amount > 0) {
      acc[e.payment_method] = (acc[e.payment_method] || 0) + e.amount
    }
    return acc
  }, {} as Record<string, number>)

  function changeDate(delta: number) {
    const d = new Date(date + 'T12:00:00')
    d.setDate(d.getDate() + delta)
    setDate(d.toISOString().split('T')[0])
  }

  const isToday = date === new Date().toISOString().split('T')[0]
  const dateLabel = new Date(date + 'T12:00:00').toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })

  function openNewModal() {
    setEditingEntry(null)
    setFormDesc('')
    setFormAmount('')
    setFormType('other')
    setFormMethod('cash')
    setFormIsExpense(false)
    setModalOpen(true)
  }

  function openEditModal(entry: CashEntry) {
    setEditingEntry(entry)
    setFormType(entry.type)
    setFormDesc(entry.description ?? '')
    setFormAmount(String(Math.abs(entry.amount)))
    setFormMethod(entry.payment_method)
    setFormIsExpense(entry.amount < 0)
    setModalOpen(true)
  }

  function closeModal() {
    setEditingEntry(null)
    setModalOpen(false)
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!formAmount || !formDesc) return

    setSaving(true)
    const supabase = createClient()
    const amount = formIsExpense ? -Math.abs(Number(formAmount)) : Math.abs(Number(formAmount))

    let error
    if (editingEntry) {
      ;({ error } = await supabase.from('nm_cash_register').update({
        type: formType,
        description: formDesc,
        amount,
        payment_method: formMethod,
      }).eq('id', editingEntry.id))
    } else {
      ;({ error } = await supabase.from('nm_cash_register').insert({
        club_id: 1,
        type: formType,
        description: formDesc,
        amount,
        payment_method: formMethod,
        date,
      }))
    }

    if (error) {
      toast('error', 'Error: ' + error.message)
    } else {
      toast('success', editingEntry ? 'Movimiento actualizado' : 'Movimiento registrado')
      closeModal()
      loadEntries()
    }
    setSaving(false)
  }

  async function handleDelete(id: number) {
    if (!confirm('¿Eliminar este movimiento?')) return
    const supabase = createClient()
    const { error } = await supabase.from('nm_cash_register').delete().eq('id', id)
    if (error) {
      toast('error', 'Error: ' + error.message)
    } else {
      toast('info', 'Movimiento eliminado')
      loadEntries()
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Caja Registradora</h1>
          <p className="text-sm text-slate-400 mt-1">Control de ingresos y gastos del dia</p>
        </div>
        <Button onClick={openNewModal}>
          <Plus size={16} className="mr-1" />
          Nuevo Movimiento
        </Button>
      </div>

      {/* Date nav */}
      <div className="flex items-center gap-2">
        <button onClick={() => changeDate(-1)} className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors">
          <ChevronLeft size={20} />
        </button>
        <button onClick={() => setDate(new Date().toISOString().split('T')[0])} className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${isToday ? 'bg-cyan-600 text-white' : 'bg-slate-800 hover:bg-slate-700 text-slate-300'}`}>
          Hoy
        </button>
        <button onClick={() => changeDate(1)} className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors">
          <ChevronRight size={20} />
        </button>
        <span className="text-lg font-semibold text-white capitalize ml-2">{dateLabel}</span>
        <input type="date" value={date} onChange={e => setDate(e.target.value)} className="ml-auto bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-white" />
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard title="Total del dia" value={formatCurrency(netTotal)} icon={<Banknote size={20} />} color={netTotal >= 0 ? '#10b981' : '#ef4444'} />
        <KpiCard title="Ingresos" value={formatCurrency(totalIncome)} icon={<TrendingUp size={20} />} color="#10b981" />
        <KpiCard title="Gastos" value={formatCurrency(totalExpense)} icon={<TrendingDown size={20} />} color="#ef4444" />
        <KpiCard title="Movimientos" value={entries.length} icon={<ArrowRightLeft size={20} />} />
      </div>

      {/* Payment breakdown */}
      {Object.keys(byMethod).length > 0 && (
        <div className="flex items-center gap-4 flex-wrap">
          {Object.entries(byMethod).map(([method, amount]) => (
            <div key={method} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-800/50 border border-slate-700/50">
              {PAYMENT_METHODS[method]?.icon}
              <span className="text-xs text-slate-400">{PAYMENT_METHODS[method]?.label || method}</span>
              <span className="text-sm font-semibold text-white">{formatCurrency(amount)}</span>
            </div>
          ))}
        </div>
      )}

      {/* Entries table */}
      <Card>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-700">
                <th className="text-left text-xs font-medium text-slate-400 pb-3 pl-2">Hora</th>
                <th className="text-left text-xs font-medium text-slate-400 pb-3">Tipo</th>
                <th className="text-left text-xs font-medium text-slate-400 pb-3">Descripcion</th>
                <th className="text-left text-xs font-medium text-slate-400 pb-3">Metodo</th>
                <th className="text-right text-xs font-medium text-slate-400 pb-3">Monto</th>
                <th className="text-right text-xs font-medium text-slate-400 pb-3 pr-2"></th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6} className="text-center py-8 text-slate-500">Cargando...</td></tr>
              ) : entries.length === 0 ? (
                <tr><td colSpan={6} className="text-center py-8 text-slate-500">No hay movimientos para este dia</td></tr>
              ) : entries.map(entry => (
                <tr key={entry.id} className="border-b border-slate-800 hover:bg-slate-800/30">
                  <td className="py-3 pl-2 text-sm text-slate-400 tabular-nums">
                    {new Date(entry.created_at).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
                  </td>
                  <td className="py-3">
                    <Badge variant={entry.amount > 0 ? 'success' : 'danger'}>
                      {ENTRY_TYPES.find(t => t.value === entry.type)?.label || entry.type}
                    </Badge>
                  </td>
                  <td className="py-3 text-sm text-white">{entry.description}</td>
                  <td className="py-3">
                    <div className="flex items-center gap-1.5 text-sm text-slate-400">
                      {PAYMENT_METHODS[entry.payment_method]?.icon}
                      {PAYMENT_METHODS[entry.payment_method]?.label || entry.payment_method}
                    </div>
                  </td>
                  <td className={`py-3 text-right text-sm font-semibold tabular-nums ${entry.amount > 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {entry.amount > 0 ? '+' : ''}{formatCurrency(entry.amount)}
                  </td>
                  <td className="py-3 pr-2 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button onClick={() => openEditModal(entry)} className="p-1 rounded text-slate-500 hover:text-cyan-400 hover:bg-cyan-500/10 transition-colors">
                        <Edit3 size={14} />
                      </button>
                      <button onClick={() => handleDelete(entry.id)} className="p-1 rounded text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-colors">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
            {entries.length > 0 && (
              <tfoot>
                <tr className="border-t border-slate-700">
                  <td colSpan={4} className="py-3 pl-2 text-sm font-semibold text-white">Total</td>
                  <td className={`py-3 text-right text-lg font-bold tabular-nums ${netTotal >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {formatCurrency(netTotal)}
                  </td>
                  <td />
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </Card>

      {/* New / Edit Entry Modal */}
      <Modal
        open={modalOpen}
        onClose={closeModal}
        title={editingEntry ? 'Editar Movimiento' : 'Nuevo Movimiento'}
        footer={
          <div className="flex items-center gap-3">
            <Button variant="ghost" onClick={closeModal}>Cancelar</Button>
            <Button onClick={handleSave} loading={saving}>{editingEntry ? 'Guardar cambios' : 'Registrar'}</Button>
          </div>
        }
      >
        <form onSubmit={handleSave} className="space-y-4">
          <div className="flex bg-slate-900 rounded-lg p-1">
            <button type="button" onClick={() => setFormIsExpense(false)} className={`flex-1 py-2 rounded-md text-sm font-medium transition-colors ${!formIsExpense ? 'bg-green-600 text-white' : 'text-slate-400'}`}>
              <TrendingUp size={14} className="inline mr-1" /> Ingreso
            </button>
            <button type="button" onClick={() => setFormIsExpense(true)} className={`flex-1 py-2 rounded-md text-sm font-medium transition-colors ${formIsExpense ? 'bg-red-600 text-white' : 'text-slate-400'}`}>
              <TrendingDown size={14} className="inline mr-1" /> Gasto
            </button>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Select label="Tipo" value={formType} onChange={e => setFormType(e.target.value)} options={ENTRY_TYPES} />
            <Select label="Metodo de pago" value={formMethod} onChange={e => setFormMethod(e.target.value)} options={[
              { value: 'cash', label: 'Efectivo' },
              { value: 'card', label: 'Tarjeta' },
              { value: 'transfer', label: 'Transferencia' },
              { value: 'bizum', label: 'Bizum' },
            ]} />
          </div>
          <Input label="Descripcion" placeholder="Concepto del movimiento..." value={formDesc} onChange={e => setFormDesc(e.target.value)} required />
          <Input label="Monto (EUR)" type="number" step="0.01" min="0" placeholder="0.00" value={formAmount} onChange={e => setFormAmount(e.target.value)} required />
        </form>
      </Modal>
    </div>
  )
}
