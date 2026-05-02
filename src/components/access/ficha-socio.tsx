'use client'

import { useEffect, useState } from 'react'
import {
  CheckCircle, XCircle, AlertCircle, Calendar, CreditCard, ShoppingCart,
  TrendingUp, Sparkles, Loader2, Phone, Mail, X
} from 'lucide-react'

export type FichaSocioData = {
  user: {
    id: string
    full_name: string | null
    email: string | null
    phone: string | null
    avatar_url: string | null
    date_of_birth: string | null
    is_active: boolean
    member_since: string
  }
  membership: {
    type: string | null
    role: string | null
    start: string | null
    end: string | null
    is_active: boolean
  } | null
  subscription: {
    status: string
    plan_name: string | null
    plan_price: number | null
    billing_cycle: string | null
    includes_gym: boolean
    includes_courts: boolean
    period_start: string | null
    period_end: string | null
    days_until_expiry: number | null
    cancel_at_period_end: boolean
  } | null
  credits: {
    total: number
    used: number
    remaining: number
    packs: Array<{ name: string; type: string | null; total: number; used: number; remaining: number; expires_at: string | null }>
  }
  debt: {
    pending_count: number
    pending_total: number
    invoices: Array<{ id: number; number: string; total: number; status: string; due_date: string | null }>
  }
  consumption: {
    total_orders: number
    top_products: Array<{ name: string; qty: number; lastSeen: string; category?: string }>
    top_categories: Array<{ category: string; count: number }>
    recent_items: Array<{ date: string; name: string; qty: number; price?: number; category?: string }>
    favorite_day_of_week: string | null
  }
  suggestions: Array<{ id: number; name: string; category?: string; price: number; reason: string }>
}

type Props = {
  userId: string
  granted?: boolean  // si viene en modo "acceso permitido/denegado"
  reason?: string    // motivo si denegado
  onClose?: () => void
  variant?: 'overlay' | 'modal'  // overlay = sobre la cámara, modal = vista completa
}

export function FichaSocio({ userId, granted, reason, onClose, variant = 'modal' }: Props) {
  const [data, setData] = useState<FichaSocioData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    fetch(`/api/access/socio-info/${userId}`)
      .then(r => r.json())
      .then(d => {
        if (cancelled) return
        if (d.error) setError(d.error)
        else setData(d as FichaSocioData)
      })
      .catch(() => { if (!cancelled) setError('Error de conexión') })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [userId])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12 text-slate-400">
        <Loader2 size={32} className="animate-spin mr-3" /> Cargando ficha…
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="text-center py-12 text-red-400">
        {error || 'No se pudo cargar la ficha del socio'}
      </div>
    )
  }

  const { user, subscription, credits, debt, consumption, suggestions } = data

  const headerColor = granted === false ? 'bg-red-500/30' : granted === true ? 'bg-green-500/30' : 'bg-slate-800'
  const accentColor = granted === false ? 'border-red-300' : granted === true ? 'border-green-300' : 'border-cyan-400'

  const expiryBadge = subscription?.days_until_expiry !== null && subscription?.days_until_expiry !== undefined
    ? subscription.days_until_expiry < 0
      ? { color: 'bg-red-500/20 text-red-300 border-red-500/40', text: `Vencido hace ${Math.abs(subscription.days_until_expiry)} días` }
      : subscription.days_until_expiry <= 7
        ? { color: 'bg-orange-500/20 text-orange-300 border-orange-500/40', text: `Vence en ${subscription.days_until_expiry} días` }
        : { color: 'bg-green-500/20 text-green-300 border-green-500/40', text: `Vigente · ${subscription.days_until_expiry} días restantes` }
    : null

  const borderClass = variant === 'overlay' ? `border-4 ${accentColor}` : 'border border-slate-700'

  return (
    <div className={`bg-slate-900 ${borderClass} rounded-xl shadow-2xl overflow-hidden`}>
      {/* Header con foto, nombre y resultado */}
      <div className={`${headerColor} p-4 flex items-start gap-4`}>
        {user.avatar_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={user.avatar_url}
            alt={user.full_name || ''}
            className={`w-20 h-20 rounded-full object-cover border-4 ${accentColor} flex-shrink-0`}
          />
        ) : (
          <div className={`w-20 h-20 rounded-full bg-slate-700 flex items-center justify-center text-2xl text-slate-300 font-bold border-4 ${accentColor} flex-shrink-0`}>
            {(user.full_name || '?').slice(0, 2).toUpperCase()}
          </div>
        )}
        <div className="flex-1 min-w-0">
          {granted !== undefined && (
            <div className="flex items-center gap-2 mb-1">
              {granted
                ? <><CheckCircle size={20} className="text-green-300" /><span className="text-green-300 font-bold text-lg">PERMITIDO</span></>
                : <><XCircle size={20} className="text-red-300" /><span className="text-red-300 font-bold text-lg">DENEGADO</span>{reason && <span className="text-red-200 text-sm">({reason})</span>}</>}
            </div>
          )}
          <h2 className="text-2xl font-bold text-white truncate">{user.full_name || 'Sin nombre'}</h2>
          <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1 text-xs text-slate-300">
            {user.email && <span className="flex items-center gap-1"><Mail size={12} />{user.email}</span>}
            {user.phone && <span className="flex items-center gap-1"><Phone size={12} />{user.phone}</span>}
          </div>
        </div>
        {onClose && (
          <button onClick={onClose} className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-white/10">
            <X size={20} />
          </button>
        )}
      </div>

      <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Plan + vencimiento */}
        <div className="bg-slate-800/50 rounded-lg p-3">
          <div className="flex items-center gap-2 text-xs text-slate-400 mb-2">
            <CreditCard size={14} /> PLAN ACTUAL
          </div>
          {subscription?.plan_name ? (
            <>
              <div className="text-lg font-bold text-white">{subscription.plan_name}</div>
              <div className="text-sm text-slate-400">
                {subscription.plan_price ? `${subscription.plan_price.toFixed(2)} € / ${subscription.billing_cycle || 'mes'}` : ''}
              </div>
              {expiryBadge && (
                <div className={`inline-block mt-2 px-2 py-1 rounded text-xs border ${expiryBadge.color}`}>
                  {expiryBadge.text}
                </div>
              )}
              <div className="flex gap-2 mt-2 text-xs">
                {subscription.includes_gym && <span className="px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-300">Gimnasio</span>}
                {subscription.includes_courts && <span className="px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-300">Pistas</span>}
              </div>
            </>
          ) : (
            <div className="text-sm text-slate-500">Sin plan activo</div>
          )}
        </div>

        {/* Deuda */}
        <div className={`rounded-lg p-3 ${debt.pending_count > 0 ? 'bg-red-500/10 border border-red-500/30' : 'bg-slate-800/50'}`}>
          <div className="flex items-center gap-2 text-xs text-slate-400 mb-2">
            <AlertCircle size={14} /> FACTURAS PENDIENTES
          </div>
          {debt.pending_count > 0 ? (
            <>
              <div className="text-2xl font-bold text-red-300">{debt.pending_total.toFixed(2)} €</div>
              <div className="text-sm text-slate-400">{debt.pending_count} {debt.pending_count === 1 ? 'factura' : 'facturas'} sin pagar</div>
              <ul className="mt-2 space-y-1 text-xs text-slate-400 max-h-20 overflow-y-auto">
                {debt.invoices.map(i => (
                  <li key={i.id} className="flex justify-between">
                    <span>#{i.number}{i.due_date ? ` · vence ${new Date(i.due_date).toLocaleDateString('es-ES')}` : ''}</span>
                    <span className="text-red-300">{i.total.toFixed(2)} €</span>
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <>
              <div className="text-lg font-bold text-green-300">Al día</div>
              <div className="text-sm text-slate-500">Sin pagos pendientes</div>
            </>
          )}
        </div>

        {/* Créditos */}
        {credits.total > 0 && (
          <div className="bg-slate-800/50 rounded-lg p-3">
            <div className="flex items-center gap-2 text-xs text-slate-400 mb-2">
              <TrendingUp size={14} /> CRÉDITOS
            </div>
            <div className="text-lg font-bold text-white">{credits.remaining} / {credits.total}</div>
            <div className="text-sm text-slate-400">{credits.used} usados</div>
            <div className="mt-2 w-full bg-slate-700 rounded-full h-1.5">
              <div
                className="bg-cyan-500 h-1.5 rounded-full"
                style={{ width: `${credits.total > 0 ? (credits.remaining / credits.total) * 100 : 0}%` }}
              />
            </div>
          </div>
        )}

        {/* Consumos recientes */}
        <div className="bg-slate-800/50 rounded-lg p-3">
          <div className="flex items-center gap-2 text-xs text-slate-400 mb-2">
            <ShoppingCart size={14} /> CONSUMOS ({consumption.total_orders} órdenes)
          </div>
          {consumption.top_products.length > 0 ? (
            <>
              <ul className="space-y-1 text-sm">
                {consumption.top_products.slice(0, 3).map((p, idx) => (
                  <li key={idx} className="flex justify-between text-slate-300">
                    <span className="truncate">{p.name}</span>
                    <span className="text-slate-500 text-xs ml-2">×{p.qty}</span>
                  </li>
                ))}
              </ul>
              {consumption.favorite_day_of_week && (
                <div className="text-xs text-slate-500 mt-2 flex items-center gap-1">
                  <Calendar size={12} /> Suele consumir los <strong className="text-slate-400">{consumption.favorite_day_of_week}</strong>
                </div>
              )}
            </>
          ) : (
            <div className="text-sm text-slate-500">Sin consumos registrados</div>
          )}
        </div>
      </div>

      {/* Sugerencias para ofrecerle */}
      {suggestions.length > 0 && (
        <div className="px-4 pb-4">
          <div className="bg-cyan-500/10 border border-cyan-500/30 rounded-lg p-3">
            <div className="flex items-center gap-2 text-xs text-cyan-300 mb-2 font-medium">
              <Sparkles size={14} /> OFRECELE
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              {suggestions.map(s => (
                <div key={s.id} className="bg-slate-900 rounded p-2 border border-slate-700">
                  <div className="text-sm text-white font-medium truncate">{s.name}</div>
                  <div className="text-xs text-slate-500">{s.category}</div>
                  <div className="text-sm text-cyan-400 font-bold mt-1">{s.price.toFixed(2)} €</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
