import { createServiceRoleClient, createServerSupabaseClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

/**
 * GET /api/staff/cash-closing?since=ISO_DATE
 * Get expected cash totals since a given date (for the closing modal)
 */
export async function GET(request: Request) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const url = new URL(request.url)
  const since = url.searchParams.get('since') || new Date().toISOString().split('T')[0] + 'T00:00:00'

  const { data: movements } = await supabase
    .from('nm_cash_register')
    .select('amount, payment_method, type')
    .gte('created_at', since)

  if (!movements) {
    return NextResponse.json({
      expected: { cash: 0, card: 0, transfer: 0, bizum: 0, total: 0 },
      counts: { transactions: 0, bookings: 0, sales: 0 },
    })
  }

  const totals = { cash: 0, card: 0, transfer: 0, bizum: 0, total: 0 }
  const counts = { transactions: movements.length, bookings: 0, sales: 0 }

  for (const m of movements) {
    const amount = m.amount || 0
    totals.total += amount
    switch (m.payment_method) {
      case 'cash': case 'efectivo': totals.cash += amount; break
      case 'card': case 'tarjeta': totals.card += amount; break
      case 'transfer': case 'transferencia': totals.transfer += amount; break
      case 'bizum': totals.bizum += amount; break
      default: totals.cash += amount; break
    }
    if (m.type === 'booking') counts.bookings++
    if (m.type === 'shop') counts.sales++
  }

  return NextResponse.json({ expected: totals, counts })
}

/**
 * POST /api/staff/cash-closing
 * Create a cash closing record
 * Body: { shift_id?, opened_at, actual_cash, actual_card, actual_transfer, actual_bizum, notes? }
 */
export async function POST(request: Request) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const body = await request.json()
  const { shift_id, opened_at, actual_cash, actual_card, actual_transfer, actual_bizum, notes } = body

  if (!opened_at) {
    return NextResponse.json({ error: 'Falta opened_at' }, { status: 400 })
  }

  const admin = createServiceRoleClient()

  // Calculate expected totals
  const { data: movements } = await admin
    .from('nm_cash_register')
    .select('amount, payment_method, type')
    .gte('created_at', opened_at)

  const expected = { cash: 0, card: 0, transfer: 0, bizum: 0, total: 0 }
  const counts = { transactions: (movements || []).length, bookings: 0, sales: 0 }

  for (const m of (movements || [])) {
    const amount = m.amount || 0
    expected.total += amount
    switch (m.payment_method) {
      case 'cash': case 'efectivo': expected.cash += amount; break
      case 'card': case 'tarjeta': expected.card += amount; break
      case 'transfer': case 'transferencia': expected.transfer += amount; break
      case 'bizum': expected.bizum += amount; break
      default: expected.cash += amount; break
    }
    if (m.type === 'booking') counts.bookings++
    if (m.type === 'shop') counts.sales++
  }

  const actualTotal = (actual_cash || 0) + (actual_card || 0) + (actual_transfer || 0) + (actual_bizum || 0)

  const { data: closing, error } = await admin
    .from('nm_cash_closings')
    .insert({
      club_id: 1,
      shift_id: shift_id || null,
      closed_by: user.id,
      opened_at,
      closed_at: new Date().toISOString(),
      expected_cash: expected.cash,
      expected_card: expected.card,
      expected_transfer: expected.transfer,
      expected_bizum: expected.bizum,
      expected_total: expected.total,
      actual_cash: actual_cash || 0,
      actual_card: actual_card || 0,
      actual_transfer: actual_transfer || 0,
      actual_bizum: actual_bizum || 0,
      actual_total: actualTotal,
      total_transactions: counts.transactions,
      total_bookings: counts.bookings,
      total_sales: counts.sales,
      notes: notes || null,
      status: 'closed',
    })
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true, closing })
}
