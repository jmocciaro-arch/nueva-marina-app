'use client'

import { useState } from 'react'
import { Modal } from '@/components/ui/modal'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  type PriceRule,
  type PriceRuleScope,
  type BillingCycle,
  upsertPriceRule,
} from '@/lib/api/pricing'

interface Props {
  rule: PriceRule
  onClose: () => void
  onSaved: (rule: PriceRule) => void
}

const SCOPES: { value: PriceRuleScope; label: string }[] = [
  { value: 'court_hour', label: 'Pistas (court_hour)' },
  { value: 'gym_plan', label: 'Planes gym' },
  { value: 'recovery_type', label: 'Recuperación' },
  { value: 'class', label: 'Clases' },
  { value: 'bar_item', label: 'Bar' },
  { value: 'product', label: 'Tienda (override)' },
  { value: 'bonus', label: 'Bonos' },
  { value: 'season', label: 'Temporadas' },
  { value: 'discount', label: 'Descuentos' },
  { value: 'special_service', label: 'Servicios especiales' },
]

const SEL = 'w-full rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-cyan-500/40 focus:border-cyan-500'

export function PricingRuleDialog({ rule, onClose, onSaved }: Props) {
  const [form, setForm] = useState<PriceRule>(rule)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [conditionsText, setConditionsText] = useState(
    JSON.stringify(rule.conditions ?? {}, null, 2)
  )

  const update = (patch: Partial<PriceRule>) =>
    setForm(prev => ({ ...prev, ...patch }))

  const handleSave = async () => {
    setSaving(true)
    setError(null)
    try {
      // validar JSON conditions
      let parsed: Record<string, unknown> = {}
      try {
        parsed = conditionsText.trim() ? JSON.parse(conditionsText) : {}
      } catch {
        setError('JSON inválido en "conditions"')
        setSaving(false)
        return
      }
      const payload = { ...form, conditions: parsed }
      const saved = await upsertPriceRule(payload)
      onSaved(saved)
    } catch (e) {
      setError((e as Error).message ?? 'Error al guardar')
    } finally {
      setSaving(false)
    }
  }

  const toLocalDT = (iso: string | null) =>
    iso ? iso.slice(0, 16) : ''

  return (
    <Modal
      open
      onClose={onClose}
      title={form.id && form.id > 0 ? 'Editar regla de precio' : 'Nueva regla de precio'}
      size="lg"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={saving}>Cancelar</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? 'Guardando...' : 'Guardar'}
          </Button>
        </>
      }
    >
      <div className="grid grid-cols-2 gap-4 text-sm">
        <label className="flex flex-col gap-1">
          <span className="text-slate-400 text-xs">Scope</span>
          <select
            className={SEL}
            value={form.scope}
            onChange={e => update({ scope: e.target.value as PriceRuleScope })}
          >
            {SCOPES.map(s => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-slate-400 text-xs">Nombre</span>
          <Input
            value={form.name}
            onChange={e => update({ name: e.target.value })}
            placeholder="Ej: Hora pista noche"
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-slate-400 text-xs">Monto</span>
          <Input
            type="number"
            step="0.01"
            value={form.amount ?? ''}
            onChange={e =>
              update({ amount: e.target.value === '' ? null : Number(e.target.value) })
            }
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-slate-400 text-xs">Moneda</span>
          <Input
            value={form.currency ?? 'EUR'}
            onChange={e => update({ currency: e.target.value })}
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-slate-400 text-xs">Ciclo de facturación</span>
          <select
            className={SEL}
            value={form.billing_cycle ?? ''}
            onChange={e =>
              update({ billing_cycle: (e.target.value || null) as BillingCycle })
            }
          >
            <option value="">— (sin ciclo)</option>
            <option value="once">Una vez</option>
            <option value="monthly">Mensual</option>
            <option value="yearly">Anual</option>
          </select>
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-slate-400 text-xs">scope_ref_id (opcional)</span>
          <Input
            type="number"
            value={form.scope_ref_id ?? ''}
            onChange={e =>
              update({ scope_ref_id: e.target.value === '' ? null : Number(e.target.value) })
            }
            placeholder="ID del recurso (pista, producto...)"
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-slate-400 text-xs">Vigencia desde</span>
          <input
            type="datetime-local"
            className={SEL}
            value={toLocalDT(form.valid_from)}
            onChange={e =>
              update({
                valid_from: e.target.value ? new Date(e.target.value).toISOString() : null,
              })
            }
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-slate-400 text-xs">Vigencia hasta</span>
          <input
            type="datetime-local"
            className={SEL}
            value={toLocalDT(form.valid_to)}
            onChange={e =>
              update({
                valid_to: e.target.value ? new Date(e.target.value).toISOString() : null,
              })
            }
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-slate-400 text-xs">Prioridad</span>
          <Input
            type="number"
            value={form.priority ?? 0}
            onChange={e => update({ priority: Number(e.target.value || 0) })}
          />
        </label>

        <label className="flex items-center gap-2 mt-6">
          <input
            type="checkbox"
            checked={form.is_active ?? true}
            onChange={e => update({ is_active: e.target.checked })}
            className="w-4 h-4 accent-cyan-500"
          />
          <span className="text-sm text-slate-300">Activa</span>
        </label>

        <label className="flex flex-col gap-1 col-span-2">
          <span className="text-slate-400 text-xs">Conditions (JSON)</span>
          <textarea
            className={`${SEL} font-mono text-xs h-32`}
            value={conditionsText}
            onChange={e => setConditionsText(e.target.value)}
            placeholder='{ "day_of_week": [1,2,3,4,5], "time_start": "18:00" }'
          />
        </label>
      </div>

      {error && (
        <div className="mt-4 text-sm text-red-400 bg-red-500/10 border border-red-500/30 rounded px-3 py-2">
          {error}
        </div>
      )}
    </Modal>
  )
}
