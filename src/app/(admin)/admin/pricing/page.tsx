'use client'

import { useState } from 'react'
import { Tag, Plus, Edit2, Trash2, Euro, Calendar, Filter } from 'lucide-react'
import { usePermissions } from '@/lib/use-permissions'
import { usePricingRules } from '@/hooks/use-pricing-rules'
import {
  type PriceRule,
  type PriceRuleScope,
  deletePriceRule,
} from '@/lib/api/pricing'
import { PricingRuleDialog } from './pricing-rule-dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/components/ui/toast'

const CLUB_ID = 1

const SCOPES: { value: PriceRuleScope; label: string; color: 'default' | 'info' | 'success' | 'warning' | 'danger' | 'cyan' }[] = [
  { value: 'court_hour', label: 'Pistas', color: 'info' },
  { value: 'gym_plan', label: 'Planes gym', color: 'success' },
  { value: 'recovery_type', label: 'Recuperación', color: 'info' },
  { value: 'class', label: 'Clases', color: 'default' },
  { value: 'bar_item', label: 'Bar', color: 'warning' },
  { value: 'product', label: 'Tienda', color: 'default' },
  { value: 'bonus', label: 'Bonos', color: 'success' },
  { value: 'season', label: 'Temporadas', color: 'warning' },
  { value: 'discount', label: 'Descuentos', color: 'danger' },
  { value: 'special_service', label: 'Servicios esp.', color: 'default' },
]

const SEL = 'rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-cyan-500/40'

function emptyRule(scope: PriceRuleScope): PriceRule {
  const now = new Date().toISOString()
  return {
    id: 0,
    club_id: CLUB_ID,
    scope,
    scope_ref_id: null,
    name: '',
    amount: 0,
    currency: 'EUR',
    billing_cycle: null,
    conditions: {},
    valid_from: now,
    valid_to: null,
    is_active: true,
    priority: 0,
    created_at: now,
    updated_at: now,
  }
}

export default function PricingPage() {
  const { can, loading: permLoading } = usePermissions()
  const [scope, setScope] = useState<PriceRuleScope | undefined>()
  const { rules, loading, error, setRules, reload } = usePricingRules(scope)
  const [editing, setEditing] = useState<PriceRule | null>(null)
  const { toast } = useToast()

  if (permLoading) {
    return <div className="p-6 text-slate-400">Cargando permisos…</div>
  }
  if (!can('pricing.manage')) {
    return (
      <div className="p-6">
        <div className="max-w-md bg-red-500/10 border border-red-500/30 rounded-xl p-6 text-center">
          <h2 className="text-lg font-semibold text-red-300 mb-2">Sin permisos</h2>
          <p className="text-sm text-slate-400">No tenés permiso para gestionar precios.</p>
        </div>
      </div>
    )
  }

  async function handleDelete(rule: PriceRule) {
    if (!confirm(`¿Borrar la regla "${rule.name}"?`)) return
    try {
      await deletePriceRule(rule.id)
      setRules(rules.filter(r => r.id !== rule.id))
      toast('success', 'Regla eliminada')
    } catch (e) {
      toast('error', (e as Error).message || 'Error al borrar')
    }
  }

  const scopeMeta = (s: PriceRuleScope) => SCOPES.find(x => x.value === s)

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <header className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Tag className="text-cyan-400" size={24} />
            Pricing unificado
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Todas las reglas de precio del club en un solo lugar · tabla <code className="text-cyan-400">nm_price_rules</code>
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 text-slate-400">
            <Filter size={16} />
            <select
              className={SEL}
              value={scope ?? ''}
              onChange={e => setScope((e.target.value || undefined) as PriceRuleScope | undefined)}
            >
              <option value="">Todos los scopes</option>
              {SCOPES.map(s => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
          </div>
          <Button onClick={() => setEditing(emptyRule(scope ?? 'court_hour'))}>
            <Plus size={16} /> Nueva regla
          </Button>
        </div>
      </header>

      {/* KPIs rápidos */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {SCOPES.slice(0, 5).map(s => {
          const count = rules.filter(r => r.scope === s.value).length
          return (
            <div key={s.value} className="bg-slate-800/50 border border-slate-700 rounded-lg px-4 py-3">
              <div className="text-xs text-slate-400">{s.label}</div>
              <div className="text-xl font-bold text-white mt-1">{count}</div>
            </div>
          )
        })}
      </div>

      {error && (
        <div className="text-sm text-red-400 bg-red-500/10 border border-red-500/30 rounded px-3 py-2">
          {error.message}
        </div>
      )}

      {/* Tabla */}
      <div className="bg-slate-800/30 border border-slate-700 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-800/60 text-slate-400 text-xs uppercase tracking-wider">
              <tr>
                <th className="text-left px-4 py-3">Scope</th>
                <th className="text-left px-4 py-3">Nombre</th>
                <th className="text-right px-4 py-3">Monto</th>
                <th className="text-left px-4 py-3">Ciclo</th>
                <th className="text-left px-4 py-3">Vigencia</th>
                <th className="text-center px-4 py-3">Activa</th>
                <th className="text-right px-4 py-3">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-slate-400">Cargando reglas…</td></tr>
              ) : rules.length === 0 ? (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-slate-500">No hay reglas{scope ? ` en "${scope}"` : ''}.</td></tr>
              ) : rules.map(r => {
                const sm = scopeMeta(r.scope)
                return (
                  <tr key={r.id} className="border-t border-slate-700/50 hover:bg-slate-800/40">
                    <td className="px-4 py-3">
                      <Badge variant={sm?.color ?? 'default'}>{sm?.label ?? r.scope}</Badge>
                    </td>
                    <td className="px-4 py-3 text-white font-medium">
                      {r.name}
                      {r.scope_ref_id && (
                        <span className="ml-2 text-xs text-slate-500">#ref {r.scope_ref_id}</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right text-slate-200 font-mono">
                      {r.amount !== null ? (
                        <span className="inline-flex items-center gap-1">
                          <Euro size={12} className="text-cyan-400" />
                          {r.amount.toFixed(2)}
                        </span>
                      ) : '—'}
                      <span className="ml-1 text-xs text-slate-500">{r.currency}</span>
                    </td>
                    <td className="px-4 py-3 text-slate-400 text-xs uppercase">
                      {r.billing_cycle ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-400">
                      <Calendar size={12} className="inline mr-1" />
                      {r.valid_from?.slice(0, 10) ?? '∞'} → {r.valid_to?.slice(0, 10) ?? '∞'}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {r.is_active ? (
                        <span className="inline-block w-2 h-2 rounded-full bg-green-400" />
                      ) : (
                        <span className="inline-block w-2 h-2 rounded-full bg-slate-500" />
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex justify-end gap-1">
                        <button
                          className="p-1.5 rounded hover:bg-slate-700 text-slate-400 hover:text-cyan-400"
                          onClick={() => setEditing(r)}
                          title="Editar"
                        >
                          <Edit2 size={14} />
                        </button>
                        <button
                          className="p-1.5 rounded hover:bg-slate-700 text-slate-400 hover:text-red-400"
                          onClick={() => handleDelete(r)}
                          title="Borrar"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {editing && (
        <PricingRuleDialog
          rule={editing}
          onClose={() => setEditing(null)}
          onSaved={(saved) => {
            setEditing(null)
            toast('success', 'Regla guardada')
            setRules(prev => {
              const idx = prev.findIndex(p => p.id === saved.id)
              if (idx === -1) return [...prev, saved].sort((a, b) => a.scope.localeCompare(b.scope))
              const copy = [...prev]
              copy[idx] = saved
              return copy
            })
            reload()
          }}
        />
      )}
    </div>
  )
}
