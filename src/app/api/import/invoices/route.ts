import { createServiceRoleClient } from '@/lib/supabase/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

interface InvoiceRow {
  invoice_number: string
  invoice_date: string | null
  payment_method: string | null
  virtuagym_member_id: string | null
  member_unique_id: string | null
  dni: string | null
  first_name: string | null
  last_name: string | null
  email: string | null
  phone: string | null
  product_name: string | null
  period_start: string | null
  period_end: string | null
  subtotal: number
  tax: number
  total: number
  unpaid: number
  paid_at: string | null
  sold_by: string | null
  category: string | null
}

/**
 * Clasifica un producto en uno de tres grupos según la categoría y el nombre.
 * - 'subscription' → nm_subscription_plans (cuotas mensuales, bonos, pases)
 * - 'retail'       → nm_products (productos físicos, accesorios)
 */
function classifyProduct(row: { product_name: string | null; category: string | null }): 'subscription' | 'retail' {
  const name = (row.product_name ?? '').toLowerCase()
  const cat = (row.category ?? '').toLowerCase()
  // Explícito por categoría
  if (cat === 'memberships' || cat.startsWith('bonos')) return 'subscription'
  if (cat === 'retail') return 'retail'
  // Fallback por palabras clave del nombre
  if (/(cuota|bono|pase|mensual|familiar|acceso|clase|unlimited|abono)/.test(name)) return 'subscription'
  return 'retail'
}

/** Detecta ciclo de facturación aproximado por el nombre. */
function guessBillingCycle(name: string): string {
  const n = name.toLowerCase()
  if (/mensual|cuota/.test(n)) return 'monthly'
  if (/trimestral/.test(n)) return 'quarterly'
  if (/anual/.test(n)) return 'yearly'
  if (/diari|día|dia|jornada/.test(n)) return 'daily'
  if (/bono|pack|pase/.test(n)) return 'one_time'
  return 'monthly'
}

export async function POST(request: Request) {
  // Auth: admin only
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

  const { rows } = await request.json() as { rows: InvoiceRow[] }
  if (!rows || rows.length === 0) {
    return NextResponse.json({ error: 'No se recibieron datos' }, { status: 400 })
  }

  const admin = createServiceRoleClient()
  const results: { email: string; status: 'created' | 'updated' | 'skipped' | 'error'; message?: string }[] = []

  // ── 1) Pre-cargar catálogos de productos/planes existentes (evitar N queries por fila)
  const uniqueProducts = new Map<string, 'subscription' | 'retail'>()
  for (const r of rows) {
    if (r.product_name) {
      uniqueProducts.set(r.product_name, classifyProduct(r))
    }
  }

  // Cachés en memoria para este batch
  const planIdByName = new Map<string, number>()
  const productIdByName = new Map<string, number>()

  // Crear/obtener cada producto único
  for (const [name, kind] of uniqueProducts.entries()) {
    try {
      if (kind === 'subscription') {
        // Precio = promedio del total de las facturas con ese producto
        const matchingRows = rows.filter(r => r.product_name === name)
        const avgPrice = matchingRows.reduce((s, r) => s + r.total, 0) / matchingRows.length

        const { data: existing } = await admin
          .from('nm_subscription_plans')
          .select('id')
          .eq('club_id', 1)
          .eq('name', name)
          .maybeSingle()

        if (existing) {
          planIdByName.set(name, existing.id as number)
        } else {
          const { data: created, error } = await admin
            .from('nm_subscription_plans')
            .insert({
              club_id: 1,
              name,
              price: avgPrice.toFixed(2),
              billing_cycle: guessBillingCycle(name),
              is_active: true,
            })
            .select('id')
            .single()
          if (!error && created) planIdByName.set(name, created.id as number)
        }
      } else {
        // retail → nm_products
        const matchingRows = rows.filter(r => r.product_name === name)
        const avgPrice = matchingRows.reduce((s, r) => s + r.total, 0) / matchingRows.length

        const { data: existing } = await admin
          .from('nm_products')
          .select('id')
          .eq('club_id', 1)
          .eq('name', name)
          .maybeSingle()

        if (existing) {
          productIdByName.set(name, existing.id as number)
        } else {
          const { data: created, error } = await admin
            .from('nm_products')
            .insert({
              club_id: 1,
              name,
              price: avgPrice.toFixed(2),
              is_active: true,
            })
            .select('id')
            .single()
          if (!error && created) productIdByName.set(name, created.id as number)
        }
      }
    } catch {
      // swallow — si falla un producto puntual, igual importamos las facturas
    }
  }

  // ── 2) Pre-cargar usuarios del club por virtuagym_id y por dni_nie
  const vgIds = [...new Set(rows.map(r => r.virtuagym_member_id).filter(Boolean))]
  const dnis = [...new Set(rows.map(r => r.dni).filter(Boolean))]

  const userByVgId = new Map<string, string>()
  const userByDni = new Map<string, string>()

  if (vgIds.length > 0) {
    const { data: usersByVg } = await admin
      .from('nm_users')
      .select('id, virtuagym_id')
      .in('virtuagym_id', vgIds as string[])
    for (const u of usersByVg ?? []) {
      if (u.virtuagym_id) userByVgId.set(u.virtuagym_id, u.id)
    }
  }
  if (dnis.length > 0) {
    const { data: usersByDni } = await admin
      .from('nm_users')
      .select('id, dni_nie')
      .in('dni_nie', dnis as string[])
    for (const u of usersByDni ?? []) {
      if (u.dni_nie) userByDni.set(u.dni_nie.toUpperCase(), u.id)
    }
  }

  // ── 3) Procesar cada factura
  for (const row of rows) {
    const key = `${row.invoice_number}`
    try {
      // Resolver user
      let userId: string | null = null
      if (row.virtuagym_member_id && userByVgId.has(row.virtuagym_member_id)) {
        userId = userByVgId.get(row.virtuagym_member_id) ?? null
      }
      if (!userId && row.dni) {
        userId = userByDni.get(row.dni.toUpperCase()) ?? null
      }

      const productKind = row.product_name ? classifyProduct(row) : 'retail'
      const planId = row.product_name ? planIdByName.get(row.product_name) ?? null : null

      const isPaid = row.unpaid === 0 && row.paid_at !== null
      const status = isPaid ? 'paid' : (row.unpaid > 0 ? 'pending' : 'paid')

      // Chequear si ya existe (evitar duplicar)
      const { data: existing } = await admin
        .from('nm_invoices')
        .select('id')
        .eq('club_id', 1)
        .eq('invoice_number', row.invoice_number)
        .maybeSingle()

      const payload = {
        club_id: 1,
        user_id: userId,
        invoice_number: row.invoice_number,
        items: [{
          name: row.product_name,
          category: row.category,
          kind: productKind,
          plan_id: planId,
          period_start: row.period_start,
          period_end: row.period_end,
          subtotal: row.subtotal,
          tax: row.tax,
          total: row.total,
          sold_by: row.sold_by,
        }],
        subtotal: row.subtotal,
        tax: row.tax,
        total: row.total,
        status,
        paid_at: row.paid_at,
        payment_method: row.payment_method,
        payment_reference: row.member_unique_id,
        notes: row.sold_by ? `Vendedor: ${row.sold_by}` : null,
      }

      if (existing) {
        await admin.from('nm_invoices').update(payload).eq('id', existing.id)
        results.push({ email: key, status: 'updated' })
      } else {
        const { error } = await admin.from('nm_invoices').insert(payload)
        if (error) {
          results.push({ email: key, status: 'error', message: error.message })
        } else {
          results.push({ email: key, status: userId ? 'created' : 'created', message: userId ? undefined : 'Sin cliente vinculado' })
        }
      }
    } catch (err) {
      results.push({ email: key, status: 'error', message: String(err) })
    }
  }

  const created = results.filter(r => r.status === 'created').length
  const updated = results.filter(r => r.status === 'updated').length
  const skipped = results.filter(r => r.status === 'skipped').length
  const errors = results.filter(r => r.status === 'error').length

  return NextResponse.json({
    total: rows.length,
    created,
    updated,
    skipped,
    errors,
    products_created: productIdByName.size,
    plans_created: planIdByName.size,
    results,
  })
}
