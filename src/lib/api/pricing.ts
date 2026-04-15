import { createClient } from '@/lib/supabase/client'

export type PriceRuleScope =
  | 'court_hour'
  | 'gym_plan'
  | 'recovery_type'
  | 'class'
  | 'bar_item'
  | 'product'
  | 'bonus'
  | 'season'
  | 'discount'
  | 'special_service'

export type BillingCycle = 'once' | 'monthly' | 'yearly' | null

export interface PriceRule {
  id: number
  club_id: number
  scope: PriceRuleScope
  scope_ref_id: number | null
  name: string
  amount: number | null
  currency: string | null
  billing_cycle: BillingCycle
  conditions: Record<string, unknown>
  valid_from: string | null
  valid_to: string | null
  is_active: boolean
  priority: number
  created_at: string
  updated_at: string
}

export async function fetchPriceRules(scope?: PriceRuleScope): Promise<PriceRule[]> {
  const supabase = createClient()
  let q = supabase.from('nm_price_rules').select('*').order('scope').order('name')
  if (scope) q = q.eq('scope', scope)
  const { data, error } = await q
  if (error) throw error
  return (data || []) as PriceRule[]
}

export async function upsertPriceRule(rule: Partial<PriceRule>): Promise<PriceRule> {
  const supabase = createClient()
  // Supabase: insert si no hay id, update si hay id
  const payload = { ...rule }
  let query
  if (payload.id && payload.id > 0) {
    query = supabase.from('nm_price_rules').update(payload).eq('id', payload.id).select().single()
  } else {
    delete payload.id
    query = supabase.from('nm_price_rules').insert(payload).select().single()
  }
  const { data, error } = await query
  if (error) throw error
  return data as PriceRule
}

export async function deletePriceRule(id: number): Promise<void> {
  const supabase = createClient()
  const { error } = await supabase.from('nm_price_rules').delete().eq('id', id)
  if (error) throw error
}

export async function lookupPrice(params: {
  club_id: number
  scope: PriceRuleScope
  scope_ref_id?: number | null
  at?: string
  duration_minutes?: number | null
  role_slug?: string | null
}): Promise<{ rule_id: number; amount: number; currency: string; name: string } | null> {
  const supabase = createClient()
  const { data, error } = await supabase.rpc('nm_lookup_price', {
    p_club_id: params.club_id,
    p_scope: params.scope,
    p_scope_ref_id: params.scope_ref_id ?? null,
    p_at: params.at ?? new Date().toISOString(),
    p_duration_minutes: params.duration_minutes ?? null,
    p_role_slug: params.role_slug ?? null,
  })
  if (error) throw error
  if (!data || (Array.isArray(data) && data.length === 0)) return null
  return Array.isArray(data) ? data[0] : data
}
