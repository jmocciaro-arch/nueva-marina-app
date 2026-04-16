import { createServiceRoleClient, createServerSupabaseClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

interface SnapshotItem {
  product_id: number
  product_name: string
  expected_stock: number
  actual_stock: number
  difference: number
}

/**
 * GET /api/staff/stock-snapshot
 * Get current stock for all active products (to fill the snapshot form)
 */
export async function GET() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const { data: products } = await supabase
    .from('nm_products')
    .select('id, name, stock')
    .eq('is_active', true)
    .order('name')

  return NextResponse.json({
    products: (products || []).map(p => ({
      product_id: p.id,
      product_name: p.name,
      expected_stock: p.stock ?? 0,
    })),
  })
}

/**
 * POST /api/staff/stock-snapshot
 * Save a stock snapshot
 * Body: { cash_closing_id?, items: [{ product_id, product_name, expected_stock, actual_stock, difference }], notes? }
 */
export async function POST(request: Request) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const body = await request.json()
  const { cash_closing_id, items, notes } = body as {
    cash_closing_id?: number
    items: SnapshotItem[]
    notes?: string
  }

  if (!items || items.length === 0) {
    return NextResponse.json({ error: 'No hay items' }, { status: 400 })
  }

  const admin = createServiceRoleClient()

  const productsWithDiff = items.filter(i => i.difference !== 0).length

  const { data: snapshot, error } = await admin
    .from('nm_stock_snapshots')
    .insert({
      club_id: 1,
      cash_closing_id: cash_closing_id || null,
      taken_by: user.id,
      taken_at: new Date().toISOString(),
      items: JSON.stringify(items),
      total_products: items.length,
      products_with_diff: productsWithDiff,
      notes: notes || null,
      status: 'pending',
    })
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // If there are stock differences, update the actual stock in nm_products
  for (const item of items) {
    if (item.difference !== 0) {
      await admin
        .from('nm_products')
        .update({ stock: item.actual_stock })
        .eq('id', item.product_id)
    }
  }

  return NextResponse.json({ success: true, snapshot })
}
