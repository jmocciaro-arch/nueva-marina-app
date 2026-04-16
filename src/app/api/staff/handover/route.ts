import { createServiceRoleClient, createServerSupabaseClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

/**
 * POST /api/staff/handover
 * Create a shift handover record
 * Body: {
 *   outgoing_shift_id, incoming_shift_id?,
 *   cash_closing_id?, stock_snapshot_id?,
 *   checklist: [{ item: string, done: boolean }],
 *   notes?: string
 * }
 */
export async function POST(request: Request) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const body = await request.json()
  const {
    outgoing_shift_id,
    incoming_user_id,
    incoming_shift_id,
    cash_closing_id,
    stock_snapshot_id,
    checklist,
    notes,
  } = body

  if (!outgoing_shift_id) {
    return NextResponse.json({ error: 'Falta outgoing_shift_id' }, { status: 400 })
  }

  const admin = createServiceRoleClient()

  // Get the outgoing shift to find user
  const { data: outShift } = await admin
    .from('nm_staff_shifts')
    .select('user_id')
    .eq('id', outgoing_shift_id)
    .single()

  if (!outShift) {
    return NextResponse.json({ error: 'Turno saliente no encontrado' }, { status: 404 })
  }

  const { data: handover, error } = await admin
    .from('nm_shift_handovers')
    .insert({
      club_id: 1,
      outgoing_user_id: outShift.user_id,
      incoming_user_id: incoming_user_id || user.id,
      outgoing_shift_id,
      incoming_shift_id: incoming_shift_id || null,
      cash_closing_id: cash_closing_id || null,
      stock_snapshot_id: stock_snapshot_id || null,
      handover_at: new Date().toISOString(),
      notes: notes || null,
      checklist: JSON.stringify(checklist || []),
      status: 'completed',
    })
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Close the outgoing shift if still active
  await admin
    .from('nm_staff_shifts')
    .update({
      check_out: new Date().toISOString(),
      status: 'completed',
    })
    .eq('id', outgoing_shift_id)
    .eq('status', 'active')

  return NextResponse.json({ success: true, handover })
}

/**
 * GET /api/staff/handover?date=YYYY-MM-DD
 * Get handover history for a date
 */
export async function GET(request: Request) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const url = new URL(request.url)
  const date = url.searchParams.get('date') || new Date().toISOString().split('T')[0]

  const { data: handovers } = await supabase
    .from('nm_shift_handovers')
    .select(`
      *,
      outgoing_user:nm_users!outgoing_user_id(full_name),
      incoming_user:nm_users!incoming_user_id(full_name)
    `)
    .gte('handover_at', `${date}T00:00:00`)
    .lte('handover_at', `${date}T23:59:59`)
    .order('handover_at', { ascending: false })

  return NextResponse.json({ handovers: handovers || [] })
}
