import { createServiceRoleClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

/**
 * GET /api/cron/daily
 *
 * Tarea diaria automatizada (ejecutada por Vercel Cron a las 03:00 UTC).
 *
 * Autenticación: header `Authorization: Bearer <CRON_SECRET>` (env var).
 * En Vercel, los cron jobs ya setean automáticamente este header cuando
 * existe la variable CRON_SECRET.
 *
 * Acciones:
 *  1) Marca facturas vencidas (pending + due_date < hoy) → status = 'overdue'
 *     + dispara notificación via trigger existente.
 *  2) Genera facturas del período siguiente para suscripciones cuyo
 *     current_period_end <= hoy (y sin factura previa para ese período).
 *     Renueva current_period_start/end según billing_cycle.
 *  3) Expira credenciales de acceso cuyo expires_at pasó.
 *  4) Desactiva suscripciones con status='active' pero end_date < hoy
 *     (cancelación programada que ya llegó a término).
 */
export async function GET(request: Request) {
  const auth = request.headers.get('authorization')
  const expected = `Bearer ${process.env.CRON_SECRET ?? ''}`
  if (!process.env.CRON_SECRET || auth !== expected) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const admin = createServiceRoleClient()
  const today = new Date().toISOString().split('T')[0]
  const results: Record<string, unknown> = { today }

  // ── 1) Facturas vencidas ─────────────────────────────────────────────────
  try {
    const { data: overdue, error } = await admin
      .from('nm_invoices')
      .update({ status: 'overdue' })
      .eq('status', 'pending')
      .lt('due_date', today)
      .select('id, user_id, invoice_number, total, club_id')
    if (error) throw error
    results.overdue_invoices = overdue?.length ?? 0

    // Notificación explícita de "vencida" (el trigger cubre paid/insert, no overdue)
    if (overdue?.length) {
      type OverdueRow = { id: number; user_id: string | null; invoice_number: string | null; total: number; club_id: number | null }
      const notifs = (overdue as OverdueRow[])
        .filter((i) => !!i.user_id)
        .map((i) => ({
          club_id: i.club_id ?? 1,
          user_id: i.user_id,
          type: 'alert',
          channel: 'in_app',
          title: 'Factura vencida',
          body: `La factura ${i.invoice_number} (€${i.total}) está vencida`,
          data: { invoice_id: i.id },
          is_read: false,
        }))
      if (notifs.length) await admin.from('nm_notifications').insert(notifs)
    }
  } catch (e) {
    results.overdue_invoices_error = (e as Error).message
  }

  // ── 2) Generar facturas de suscripciones que cumplieron el período ───────
  try {
    const { data: subs } = await admin
      .from('nm_subscriptions')
      .select('*, plan:nm_subscription_plans(name, price, billing_cycle)')
      .eq('status', 'active')
      .lte('current_period_end', today)

    let generated = 0
    if (subs?.length) {
      // Próximo número de factura
      const { data: lastInv } = await admin
        .from('nm_invoices')
        .select('invoice_number')
        .eq('club_id', 1)
        .order('id', { ascending: false })
        .limit(1)
        .single()
      let nextNum = 1
      if (lastInv?.invoice_number) {
        const m = lastInv.invoice_number.match(/(\d+)$/)
        if (m) nextNum = parseInt(m[1]) + 1
      }
      const year = new Date().getFullYear()

      for (const sub of subs) {
        const plan = sub.plan as { name: string; price: number; billing_cycle: string } | null
        if (!plan) continue

        // Dedup: ya existe factura para este período
        const { data: existing } = await admin
          .from('nm_invoices')
          .select('id')
          .eq('subscription_id', sub.id)
          .gte('created_at', sub.current_period_start || sub.start_date)
          .maybeSingle()
        if (existing) continue

        const tax = Math.round(plan.price * 0.21 * 100) / 100
        const total = Math.round((plan.price + tax) * 100) / 100
        const invoiceNumber = `NM-${year}-${String(nextNum).padStart(4, '0')}`
        const dueDate = new Date()
        dueDate.setDate(dueDate.getDate() + 15)

        const { error } = await admin.from('nm_invoices').insert({
          club_id: sub.club_id ?? 1,
          user_id: sub.user_id,
          invoice_number: invoiceNumber,
          subscription_id: sub.id,
          items: [{ description: `${plan.name} — ${plan.billing_cycle}`, qty: 1, unit_price: plan.price, tax_rate: 21, total: plan.price }],
          subtotal: plan.price,
          tax,
          total,
          status: 'pending',
          due_date: dueDate.toISOString().split('T')[0],
        })
        if (error) continue

        // Renovar período
        const periodStart = sub.current_period_end || today
        const periodEnd = new Date(periodStart)
        const cycle = plan.billing_cycle
        if (cycle === 'monthly') periodEnd.setMonth(periodEnd.getMonth() + 1)
        else if (cycle === 'quarterly') periodEnd.setMonth(periodEnd.getMonth() + 3)
        else if (cycle === 'semiannual') periodEnd.setMonth(periodEnd.getMonth() + 6)
        else if (cycle === 'annual') periodEnd.setFullYear(periodEnd.getFullYear() + 1)
        else periodEnd.setMonth(periodEnd.getMonth() + 1)

        await admin.from('nm_subscriptions').update({
          current_period_start: periodStart,
          current_period_end: periodEnd.toISOString().split('T')[0],
        }).eq('id', sub.id)

        generated++
        nextNum++
      }
    }
    results.invoices_generated = generated
  } catch (e) {
    results.invoices_generated_error = (e as Error).message
  }

  // ── 3) Expirar credenciales ──────────────────────────────────────────────
  try {
    const { data: expired, error } = await admin
      .from('nm_access_credentials')
      .update({ is_active: false })
      .eq('is_active', true)
      .lt('expires_at', new Date().toISOString())
      .select('id')
    if (error) throw error
    results.credentials_expired = expired?.length ?? 0
  } catch (e) {
    results.credentials_expired_error = (e as Error).message
  }

  // ── 4) Cancelar suscripciones con cancel_at_period_end que ya vencieron ──
  try {
    const { data: cancelled, error } = await admin
      .from('nm_subscriptions')
      .update({ status: 'cancelled' })
      .eq('status', 'active')
      .eq('cancel_at_period_end', true)
      .lte('current_period_end', today)
      .select('id')
    if (error) throw error
    results.subscriptions_cancelled = cancelled?.length ?? 0
  } catch (e) {
    results.subscriptions_cancelled_error = (e as Error).message
  }

  return NextResponse.json({ ok: true, ...results })
}
