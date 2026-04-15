'use client'

import { useEffect, useState } from 'react'
import { lookupPrice, type PriceRuleScope } from '@/lib/api/pricing'

interface UsePriceLookupArgs {
  club_id?: number
  scope: PriceRuleScope
  scope_ref_id?: number | null
  at?: string // ISO
  duration_minutes?: number | null
  role_slug?: string | null
  /** si false, el hook no dispara el lookup (útil hasta tener datos mínimos) */
  enabled?: boolean
}

export interface PricingLookupResult {
  rule_id: number
  amount: number
  currency: string
  name: string
}

export function usePriceLookup(args: UsePriceLookupArgs) {
  const [rule, setRule] = useState<PricingLookupResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  const enabled = args.enabled ?? true

  useEffect(() => {
    if (!enabled) {
      setRule(null)
      return
    }
    let cancelled = false
    setLoading(true)
    lookupPrice({
      club_id: args.club_id ?? 1,
      scope: args.scope,
      scope_ref_id: args.scope_ref_id ?? null,
      at: args.at,
      duration_minutes: args.duration_minutes ?? null,
      role_slug: args.role_slug ?? null,
    })
      .then(r => { if (!cancelled) { setRule(r); setError(null) } })
      .catch(e => { if (!cancelled) { setRule(null); setError(e as Error) } })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [
    enabled,
    args.club_id,
    args.scope,
    args.scope_ref_id,
    args.at,
    args.duration_minutes,
    args.role_slug,
  ])

  return { rule, loading, error }
}
