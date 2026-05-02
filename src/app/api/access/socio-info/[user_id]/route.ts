import { createServiceRoleClient, createServerSupabaseClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

/**
 * GET /api/access/socio-info/[user_id]
 * Devuelve la ficha rápida del socio: datos personales, membresía, plan, vencimiento,
 * créditos, facturas pendientes, últimos consumos y sugerencias de productos.
 *
 * Solo accesible por admins/owners del club o el propio socio.
 */
type ConsumoItem = { product_id?: number; product_name?: string; category?: string; qty?: number; price?: number }
type OrderRow = { id: number; total: number | null; created_at: string; items: ConsumoItem[] | null }

export async function GET(
  request: Request,
  { params }: { params: Promise<{ user_id: string }> }
) {
  const { user_id } = await params

  // Auth: caller tiene que ser admin del club o el mismo user_id
  const userClient = await createServerSupabaseClient()
  const { data: { user: caller } } = await userClient.auth.getUser()
  if (!caller) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  }
  if (caller.id !== user_id) {
    const { data: membership } = await userClient
      .from('nm_club_members')
      .select('role')
      .eq('user_id', caller.id)
      .eq('club_id', 1)
      .in('role', ['owner', 'admin', 'staff'])
      .single()
    if (!membership) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
    }
  }

  const admin = createServiceRoleClient()

  // Disparamos todas las consultas en paralelo
  const [
    userRes,
    memberRes,
    subRes,
    creditsRes,
    invoicesRes,
    ordersRes,
  ] = await Promise.all([
    admin.from('nm_users')
      .select('id, full_name, email, phone, avatar_url, date_of_birth, is_active, created_at')
      .eq('id', user_id)
      .single(),
    admin.from('nm_club_members')
      .select('id, role, membership_type, membership_start, membership_end, is_active')
      .eq('user_id', user_id)
      .eq('club_id', 1)
      .single(),
    admin.from('nm_subscriptions')
      .select('id, status, start_date, current_period_start, current_period_end, cancel_at_period_end, plan:nm_subscription_plans(id, name, price, billing_cycle, includes_gym, includes_courts)')
      .eq('user_id', user_id)
      .eq('club_id', 1)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    admin.from('nm_user_credits')
      .select('id, total_credits, used_credits, status, expires_at, pack:nm_credit_packs(name, type)')
      .eq('user_id', user_id)
      .eq('club_id', 1)
      .eq('status', 'active'),
    admin.from('nm_invoices')
      .select('id, invoice_number, total, status, due_date, created_at')
      .eq('user_id', user_id)
      .eq('club_id', 1)
      .in('status', ['pending', 'overdue'])
      .order('due_date', { ascending: true }),
    admin.from('nm_orders')
      .select('id, total, created_at, items')
      .eq('user_id', user_id)
      .eq('club_id', 1)
      .in('status', ['paid', 'completed', 'pending'])
      .order('created_at', { ascending: false })
      .limit(30),
  ])

  if (userRes.error || !userRes.data) {
    return NextResponse.json({ error: 'Socio no encontrado' }, { status: 404 })
  }

  const u = userRes.data
  const m = memberRes.data
  const s = subRes.data
  const credits = creditsRes.data || []
  const pendingInvoices = invoicesRes.data || []
  const orders = (ordersRes.data || []) as OrderRow[]

  // Cálculos
  const today = new Date()
  const periodEnd = s?.current_period_end ? new Date(s.current_period_end) : null
  const daysUntilExpiry = periodEnd
    ? Math.ceil((periodEnd.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
    : null

  const totalCredits = credits.reduce((acc: number, c: { total_credits: number | null }) => acc + (c.total_credits || 0), 0)
  const usedCredits = credits.reduce((acc: number, c: { used_credits: number | null }) => acc + (c.used_credits || 0), 0)
  const remainingCredits = totalCredits - usedCredits

  const pendingTotal = pendingInvoices.reduce((acc: number, i: { total: number | null }) => acc + Number(i.total || 0), 0)

  // Análisis de consumos: productos más frecuentes y por día de la semana
  const productCount = new Map<string, { name: string; qty: number; lastSeen: string; category?: string }>()
  const categoryCount = new Map<string, number>()
  const dayOfWeekCount = [0, 0, 0, 0, 0, 0, 0]
  const recentItems: Array<{ date: string; name: string; qty: number; price?: number; category?: string }> = []

  for (const order of orders) {
    if (!Array.isArray(order.items)) continue
    const dow = new Date(order.created_at).getDay()
    dayOfWeekCount[dow]++
    for (const item of order.items) {
      const name = item.product_name || `Producto #${item.product_id}` || 'Sin nombre'
      const key = `${item.product_id || ''}|${name}`
      const existing = productCount.get(key)
      const qty = item.qty || 1
      if (existing) {
        existing.qty += qty
      } else {
        productCount.set(key, { name, qty, lastSeen: order.created_at, category: item.category })
      }
      if (item.category) {
        categoryCount.set(item.category, (categoryCount.get(item.category) || 0) + qty)
      }
      if (recentItems.length < 10) {
        recentItems.push({ date: order.created_at, name, qty, price: item.price, category: item.category })
      }
    }
  }

  const topProducts = Array.from(productCount.values())
    .sort((a, b) => b.qty - a.qty)
    .slice(0, 5)

  const topCategories = Array.from(categoryCount.entries())
    .map(([category, count]) => ({ category, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 3)

  // Sugerencias: productos disponibles en categorías que el socio frecuenta,
  // que NO haya comprado (o no haya comprado mucho), priorizando los nuevos.
  let suggestions: Array<{ id: number; name: string; category?: string; price: number; reason: string }> = []
  if (topCategories.length > 0) {
    const categoriesUsed = topCategories.map(c => c.category)
    const productNamesUsed = new Set(Array.from(productCount.values()).map(p => p.name))
    const { data: candidates } = await admin
      .from('nm_products')
      .select('id, name, category, price, is_active, is_featured')
      .eq('club_id', 1)
      .eq('is_active', true)
      .in('category', categoriesUsed)
      .limit(20)
    type ProductRow = { id: number; name: string; category: string | null; price: number; is_active: boolean; is_featured: boolean }
    suggestions = (candidates as ProductRow[] || [])
      .filter((p: ProductRow) => !productNamesUsed.has(p.name))
      .slice(0, 4)
      .map((p: ProductRow) => ({
        id: p.id,
        name: p.name,
        category: p.category || undefined,
        price: Number(p.price),
        reason: `Suele consumir productos de "${p.category}"`,
      }))
  }
  // Fallback: si el socio nunca compró nada, sugerir destacados
  if (suggestions.length === 0) {
    const { data: featured } = await admin
      .from('nm_products')
      .select('id, name, category, price')
      .eq('club_id', 1)
      .eq('is_active', true)
      .eq('is_featured', true)
      .limit(4)
    type FeaturedRow = { id: number; name: string; category: string | null; price: number }
    suggestions = (featured as FeaturedRow[] || []).map((p: FeaturedRow) => ({
      id: p.id,
      name: p.name,
      category: p.category || undefined,
      price: Number(p.price),
      reason: 'Producto destacado',
    }))
  }

  // Día de la semana favorito
  const dayNames = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']
  const maxDow = Math.max(...dayOfWeekCount)
  const favoriteDay = maxDow > 0 ? dayNames[dayOfWeekCount.indexOf(maxDow)] : null

  return NextResponse.json({
    user: {
      id: u.id,
      full_name: u.full_name,
      email: u.email,
      phone: u.phone,
      avatar_url: u.avatar_url,
      date_of_birth: u.date_of_birth,
      is_active: u.is_active,
      member_since: u.created_at,
    },
    membership: m ? {
      type: m.membership_type,
      role: m.role,
      start: m.membership_start,
      end: m.membership_end,
      is_active: m.is_active,
    } : null,
    subscription: s ? {
      status: s.status,
      plan_name: (s.plan as unknown as { name?: string })?.name || null,
      plan_price: (s.plan as unknown as { price?: number })?.price ?? null,
      billing_cycle: (s.plan as unknown as { billing_cycle?: string })?.billing_cycle || null,
      includes_gym: (s.plan as unknown as { includes_gym?: boolean })?.includes_gym ?? false,
      includes_courts: (s.plan as unknown as { includes_courts?: boolean })?.includes_courts ?? false,
      period_start: s.current_period_start,
      period_end: s.current_period_end,
      days_until_expiry: daysUntilExpiry,
      cancel_at_period_end: s.cancel_at_period_end,
    } : null,
    credits: {
      total: totalCredits,
      used: usedCredits,
      remaining: remainingCredits,
      packs: credits.map((c: { pack: unknown; total_credits: number; used_credits: number; expires_at: string | null }) => ({
        name: (c.pack as unknown as { name?: string })?.name || 'Pack',
        type: (c.pack as unknown as { type?: string })?.type || null,
        total: c.total_credits,
        used: c.used_credits,
        remaining: c.total_credits - c.used_credits,
        expires_at: c.expires_at,
      })),
    },
    debt: {
      pending_count: pendingInvoices.length,
      pending_total: pendingTotal,
      invoices: pendingInvoices.map((i: { id: number; invoice_number: string; total: number | null; status: string; due_date: string | null }) => ({
        id: i.id,
        number: i.invoice_number,
        total: Number(i.total || 0),
        status: i.status,
        due_date: i.due_date,
      })),
    },
    consumption: {
      total_orders: orders.length,
      top_products: topProducts,
      top_categories: topCategories,
      recent_items: recentItems,
      favorite_day_of_week: favoriteDay,
    },
    suggestions,
  })
}
