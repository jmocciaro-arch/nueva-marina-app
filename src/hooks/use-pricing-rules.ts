'use client'

import { useEffect, useState } from 'react'
import { fetchPriceRules, type PriceRule, type PriceRuleScope } from '@/lib/api/pricing'

export function usePricingRules(scope?: PriceRuleScope) {
  const [rules, setRules] = useState<PriceRule[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    fetchPriceRules(scope)
      .then((data) => {
        if (!cancelled) {
          setRules(data)
          setError(null)
        }
      })
      .catch((err) => { if (!cancelled) setError(err as Error) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [scope, reloadKey])

  return {
    rules,
    loading,
    error,
    setRules,
    reload: () => setReloadKey(k => k + 1),
  }
}
