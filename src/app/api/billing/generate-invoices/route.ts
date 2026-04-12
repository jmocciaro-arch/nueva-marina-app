import { createServiceRoleClient, createServerSupabaseClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

/**
 * POST /api/billing/generate-invoices
 * Generates monthly invoices for all active subscriptions whose current_period_end is today or past.
 * Called manually by admin or via cron.
 */
export async function POST(request: Request) {
  // Verify admin
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const { data: membership } = await supabase
    .from('nm_club_members')
    .select('role')
    .eq('user_id', user.id)
    .eq('club_id', 1)
    .in('role', ['owner', 'admin'])
    .single()
  if (!membership) return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

  const admin = createServiceRoleClient()
  const today = new Date().toISOString().split('T')[0]

  // Get active subscriptions with their plans
  const { data: subs } = await admin
    .from('nm_subscriptions')
    .select('*, plan:nm_subscription_plans(*)')
    .eq('club_id', 1)
    .eq('status', 'active')

  if (!subs || subs.length === 0) {
    return NextResponse.json({ message: 'No hay suscripciones activas', generated: 0 })
  }

  let generated = 0
  const errors: string[] = []

  // Get next invoice number
  const { data: lastInv } = await admin
    .from('nm_invoices')
    .select('invoice_number')
    .eq('club_id', 1)
    .order('id', { ascending: false })
    .limit(1)
    .single()

  let nextNum = 1
  if (lastInv?.invoice_number) {
    const match = lastInv.invoice_number.match(/(\d+)$/)
    if (match) nextNum = parseInt(match[1]) + 1
  }

  const year = new Date().getFullYear()

  for (const sub of subs) {
    const plan = sub.plan as { name: string; price: number; billing_cycle: string } | null
    if (!plan) continue

    // Check if invoice already exists for current period
    const { data: existing } = await admin
      .from('nm_invoices')
      .select('id')
      .eq('subscription_id', sub.id)
      .eq('club_id', 1)
      .gte('created_at', sub.current_period_start || sub.start_date)
      .single()

    if (existing) continue // Already invoiced this period

    const taxRate = 21 // IVA Spain
    const subtotal = plan.price
    const tax = Math.round(subtotal * (taxRate / 100) * 100) / 100
    const total = Math.round((subtotal + tax) * 100) / 100
    const invoiceNumber = `NM-${year}-${String(nextNum).padStart(4, '0')}`

    // Calculate due date (15 days from now)
    const dueDate = new Date()
    dueDate.setDate(dueDate.getDate() + 15)

    const { error } = await admin.from('nm_invoices').insert({
      club_id: 1,
      user_id: sub.user_id,
      invoice_number: invoiceNumber,
      subscription_id: sub.id,
      items: [{ description: `${plan.name} — ${plan.billing_cycle}`, qty: 1, unit_price: plan.price, tax_rate: taxRate, total: plan.price }],
      subtotal,
      tax,
      total,
      status: 'pending',
      due_date: dueDate.toISOString().split('T')[0],
    })

    if (error) {
      errors.push(`${sub.user_id}: ${error.message}`)
    } else {
      generated++
      nextNum++

      // Renew the subscription period
      const periodStart = sub.current_period_end || today
      const periodEnd = new Date(periodStart)
      if (plan.billing_cycle === 'monthly') periodEnd.setMonth(periodEnd.getMonth() + 1)
      else if (plan.billing_cycle === 'quarterly') periodEnd.setMonth(periodEnd.getMonth() + 3)
      else if (plan.billing_cycle === 'semiannual') periodEnd.setMonth(periodEnd.getMonth() + 6)
      else if (plan.billing_cycle === 'annual') periodEnd.setFullYear(periodEnd.getFullYear() + 1)

      await admin.from('nm_subscriptions').update({
        current_period_start: periodStart,
        current_period_end: periodEnd.toISOString().split('T')[0],
      }).eq('id', sub.id)
    }
  }

  return NextResponse.json({ generated, errors: errors.length > 0 ? errors : undefined, total_subs: subs.length })
}
