'use client'

import { useState, useCallback, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/lib/auth-context'
import { useToast } from '@/components/ui/toast'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { formatCurrency } from '@/lib/utils'
import { CreditCard, Calendar, FileText, Ticket, CheckCircle, Download, Phone, AlertTriangle } from 'lucide-react'
import type { Subscription, Invoice, UserCredit } from '@/types'

const BILLING_LABELS: Record<string, string> = { monthly: 'Mensual', quarterly: 'Trimestral', semiannual: 'Semestral', annual: 'Anual' }

export default function MiSuscripcionPage() {
  const { user } = useAuth()
  const { toast } = useToast()
  const [sub, setSub] = useState<(Subscription & { plan?: { name: string; price: number; billing_cycle: string; includes_gym: boolean; includes_courts: boolean } }) | null>(null)
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [credits, setCredits] = useState<(UserCredit & { pack?: { name: string } })[]>([])
  const [loading, setLoading] = useState(true)
  const [cancelando, setCancelando] = useState(false)
  const [confirmCancelar, setConfirmCancelar] = useState(false)
  const [clubPhone, setClubPhone] = useState('')

  const loadData = useCallback(async () => {
    if (!user) return
    setLoading(true)
    const supabase = createClient()

    const { data: subData } = await supabase
      .from('nm_subscriptions')
      .select('*, plan:nm_subscription_plans(name, price, billing_cycle, includes_gym, includes_courts)')
      .eq('user_id', user.id)
      .eq('club_id', 1)
      .eq('status', 'active')
      .single()
    setSub(subData as unknown as typeof sub)

    const { data: invData } = await supabase
      .from('nm_invoices')
      .select('*')
      .eq('user_id', user.id)
      .eq('club_id', 1)
      .order('created_at', { ascending: false })
      .limit(20)
    setInvoices((invData || []) as Invoice[])

    const { data: credData } = await supabase
      .from('nm_user_credits')
      .select('*, pack:nm_credit_packs(name)')
      .eq('user_id', user.id)
      .eq('club_id', 1)
      .eq('status', 'active')
    setCredits((credData || []) as unknown as typeof credits)

    // Club phone
    const { data: phoneRow } = await supabase
      .from('nm_club_config')
      .select('value')
      .eq('club_id', 1)
      .eq('key', 'club_phone')
      .maybeSingle()
    if (phoneRow?.value) setClubPhone(phoneRow.value)

    setLoading(false)
  }, [user])

  useEffect(() => { loadData() }, [loadData])

  const cancelarSuscripcion = useCallback(async () => {
    if (!sub) return
    setCancelando(true)
    try {
      const supabase = createClient()
      const { error } = await supabase
        .from('nm_subscriptions')
        .update({ cancel_at_period_end: true })
        .eq('id', sub.id)
      if (error) throw error
      setSub(prev => prev ? { ...prev, cancel_at_period_end: true } : prev)
      const msg = sub.current_period_end
        ? `Tu suscripción seguirá activa hasta el ${new Date(sub.current_period_end).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })}`
        : 'Tu suscripción seguirá activa hasta el fin del período actual'
      toast('success', msg)
    } catch {
      toast('error', 'Error al cancelar la suscripción')
    } finally {
      setCancelando(false)
      setConfirmCancelar(false)
    }
  }, [sub, toast])

  if (loading) {
    return (
      <div className="space-y-6">
        <div><h1 className="text-2xl font-bold text-white">Mi Suscripción</h1></div>
        <div className="text-center py-12 text-slate-500">Cargando...</div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Mi Suscripción</h1>
        <p className="text-sm text-slate-400 mt-1">Tu plan, facturas y créditos</p>
      </div>

      {/* Current Plan */}
      {sub && sub.plan ? (
        <>
        <Card>
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-xl bg-cyan-600/10 flex items-center justify-center">
                <CreditCard size={28} className="text-cyan-400" />
              </div>
              <div>
                <p className="text-xl font-bold text-white">{sub.plan.name}</p>
                <p className="text-sm text-slate-400">{BILLING_LABELS[sub.plan.billing_cycle] || sub.plan.billing_cycle}</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-2xl font-bold text-cyan-400">{formatCurrency(sub.plan.price)}</p>
              <Badge variant="success">Activa</Badge>
            </div>
          </div>
          <div className="mt-4 flex flex-wrap gap-3">
            {sub.plan.includes_gym && <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-green-500/10 text-green-400 text-sm"><CheckCircle size={14} /> Gimnasio incluido</div>}
            {sub.plan.includes_courts && <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-500/10 text-blue-400 text-sm"><CheckCircle size={14} /> Pistas incluidas</div>}
          </div>
          {sub.current_period_end && (
            <div className="mt-4 flex items-center gap-2 text-sm text-slate-400">
              <Calendar size={14} /> Próxima renovación: <span className="text-white font-medium">{new Date(sub.current_period_end).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
            </div>
          )}
          {(sub as Subscription & { cancel_at_period_end?: boolean }).cancel_at_period_end && (
            <div className="mt-4 rounded-lg bg-amber-500/10 border border-amber-500/20 px-4 py-3 text-sm text-amber-400">
              Cancelación programada — la suscripción no se renovará al finalizar el período actual.
            </div>
          )}
          <div className="mt-5 flex flex-wrap items-center gap-3 pt-4 border-t border-slate-700/50">
            {!(sub as Subscription & { cancel_at_period_end?: boolean }).cancel_at_period_end && (
              <Button
                variant="danger"
                size="sm"
                onClick={() => setConfirmCancelar(true)}
              >
                <AlertTriangle size={14} className="mr-1.5" />
                Cancelar suscripción
              </Button>
            )}
            {clubPhone && (
              <a
                href={`tel:${clubPhone}`}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-700/50 text-slate-300 hover:bg-slate-700 hover:text-white text-sm font-medium transition-colors"
              >
                <Phone size={14} />
                Contactar recepción
              </a>
            )}
            <p className="text-xs text-slate-500">Para cambiar de plan, contactá a recepción.</p>
          </div>
        </Card>

        {/* Diálogo de confirmación de cancelación */}
        {confirmCancelar && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4">
            <div className="w-full max-w-sm rounded-2xl bg-slate-900 border border-slate-700 p-6 shadow-2xl">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-red-500/10 flex items-center justify-center shrink-0">
                  <AlertTriangle size={20} className="text-red-400" />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-white">¿Cancelar suscripción?</h3>
                  <p className="text-sm text-slate-400 mt-0.5">No se renovará al finalizar el período actual.</p>
                </div>
              </div>
              {sub.current_period_end && (
                <p className="text-sm text-slate-300 mb-5">
                  Tu suscripción seguirá activa hasta el{' '}
                  <span className="font-semibold text-white">
                    {new Date(sub.current_period_end).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })}
                  </span>.
                </p>
              )}
              <div className="flex gap-3 justify-end">
                <Button variant="secondary" size="sm" onClick={() => setConfirmCancelar(false)}>
                  Volver
                </Button>
                <Button
                  variant="danger"
                  size="sm"
                  disabled={cancelando}
                  onClick={cancelarSuscripcion}
                >
                  {cancelando ? 'Procesando…' : 'Sí, cancelar'}
                </Button>
              </div>
            </div>
          </div>
        )}
        </>
      ) : (
        <Card>
          <div className="flex flex-col items-center py-8">
            <div className="w-16 h-16 rounded-2xl bg-slate-700/50 flex items-center justify-center mb-4">
              <CreditCard size={32} className="text-slate-500" />
            </div>
            <h3 className="text-lg font-semibold text-white">Sin suscripción activa</h3>
            <p className="text-sm text-slate-400 mt-2">Contactá a recepción para suscribirte a un plan</p>
          </div>
        </Card>
      )}

      {/* Credits */}
      {credits.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2"><Ticket size={20} className="text-indigo-400" /> Mis Créditos</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            {credits.map(c => {
              const remaining = c.total_credits - c.used_credits
              const pct = (remaining / c.total_credits) * 100
              return (
                <Card key={c.id}>
                  <div className="flex items-center justify-between mb-2">
                    <p className="font-semibold text-white">{(c.pack as { name: string })?.name || 'Bono'}</p>
                    <span className="text-2xl font-bold text-indigo-400">{remaining}</span>
                  </div>
                  <div className="w-full bg-slate-700 rounded-full h-2 mb-2">
                    <div className="bg-indigo-500 h-2 rounded-full transition-all" style={{ width: `${pct}%` }} />
                  </div>
                  <div className="flex justify-between text-xs text-slate-500">
                    <span>{c.used_credits} usados de {c.total_credits}</span>
                    {c.expires_at && <span>Vence: {new Date(c.expires_at).toLocaleDateString('es-ES')}</span>}
                  </div>
                </Card>
              )
            })}
          </div>
        </div>
      )}

      {/* Invoices */}
      <div>
        <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2"><FileText size={20} className="text-slate-400" /> Mis Facturas</h2>
        <Card>
          {invoices.length === 0 ? (
            <p className="text-center py-8 text-slate-500">No hay facturas todavía</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-700">
                    <th className="text-left text-xs font-medium text-slate-400 pb-3 pl-2">Nº</th>
                    <th className="text-right text-xs font-medium text-slate-400 pb-3">Total</th>
                    <th className="text-left text-xs font-medium text-slate-400 pb-3">Estado</th>
                    <th className="text-left text-xs font-medium text-slate-400 pb-3">Fecha</th>
                    <th className="text-left text-xs font-medium text-slate-400 pb-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {invoices.map(inv => (
                    <tr key={inv.id} className="border-b border-slate-800">
                      <td className="py-3 pl-2 text-sm font-mono text-cyan-400">{inv.invoice_number}</td>
                      <td className="py-3 text-right text-sm font-semibold text-white">{formatCurrency(inv.total || 0)}</td>
                      <td className="py-3">
                        <Badge variant={inv.status === 'paid' ? 'success' : inv.status === 'overdue' ? 'danger' : 'warning'}>
                          {inv.status === 'paid' ? 'Pagada' : inv.status === 'overdue' ? 'Vencida' : 'Pendiente'}
                        </Badge>
                      </td>
                      <td className="py-3 text-sm text-slate-400">{new Date(inv.created_at).toLocaleDateString('es-ES')}</td>
                      <td className="py-3 pr-2">
                        <a
                          href={`/api/billing/invoice-pdf?id=${inv.id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-slate-700/50 text-slate-400 hover:bg-slate-700 hover:text-white text-xs font-medium transition-colors"
                          title="Descargar PDF"
                        >
                          <Download size={12} />
                          PDF
                        </a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>
    </div>
  )
}
