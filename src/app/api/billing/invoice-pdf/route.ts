import { createServerSupabaseClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

/**
 * GET /api/billing/invoice-pdf?id=123
 * Returns invoice data as JSON (PDF generation will be added with jspdf in a future iteration).
 * For now, returns structured invoice data that can be printed via browser.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const invoiceId = searchParams.get('id')

  if (!invoiceId) {
    return NextResponse.json({ error: 'Missing invoice id' }, { status: 400 })
  }

  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const { data: invoice } = await supabase
    .from('nm_invoices')
    .select('*, user:nm_users(full_name, email, phone, address, postal_code, document_type, document_number)')
    .eq('id', Number(invoiceId))
    .single()

  if (!invoice) {
    return NextResponse.json({ error: 'Factura no encontrada' }, { status: 404 })
  }

  // Check authorization: user can see own invoices, admin can see all
  if (invoice.user_id !== user.id) {
    const { data: membership } = await supabase
      .from('nm_club_members')
      .select('role')
      .eq('user_id', user.id)
      .eq('club_id', 1)
      .in('role', ['owner', 'admin'])
      .single()
    if (!membership) return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }

  // Return invoice data (structured for rendering/PDF)
  return NextResponse.json({
    invoice: {
      number: invoice.invoice_number,
      date: invoice.created_at,
      due_date: invoice.due_date,
      status: invoice.status,
      items: invoice.items,
      subtotal: invoice.subtotal,
      tax: invoice.tax,
      total: invoice.total,
      paid_at: invoice.paid_at,
      payment_method: invoice.payment_method,
    },
    customer: invoice.user,
    club: {
      name: 'Nueva Marina Padel & Sport',
      legal_name: 'FALTA ENVIDO SL',
      address: 'España',
      tax_id: '', // To be configured
    },
  })
}
