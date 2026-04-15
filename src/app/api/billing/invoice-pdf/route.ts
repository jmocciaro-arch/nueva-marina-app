import { jsPDF } from 'jspdf'
import { NextResponse } from 'next/server'
import { createServerSupabaseClient, createServiceRoleClient } from '@/lib/supabase/server'

// ─── helpers ────────────────────────────────────────────────────────────────

function eur(amount: number): string {
  return new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency: 'EUR',
  }).format(amount)
}

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('es-ES', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

// ─── route ──────────────────────────────────────────────────────────────────

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const invoiceId = searchParams.get('id')

  if (!invoiceId) {
    return NextResponse.json({ error: 'Falta el parámetro id' }, { status: 400 })
  }

  // 1. Autenticación
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  }

  // 2. Datos de la factura (con usuario)
  const serviceClient = createServiceRoleClient()

  const { data: invoice, error: invoiceError } = await serviceClient
    .from('nm_invoices')
    .select(
      '*, user:nm_users(full_name, email, phone, address, postal_code, document_type, document_number)'
    )
    .eq('id', Number(invoiceId))
    .single()

  if (invoiceError || !invoice) {
    return NextResponse.json({ error: 'Factura no encontrada' }, { status: 404 })
  }

  // 3. Autorización
  if (invoice.user_id !== user.id) {
    const { data: membership } = await supabase
      .from('nm_club_members')
      .select('role')
      .eq('user_id', user.id)
      .eq('club_id', invoice.club_id)
      .in('role', ['owner', 'admin'])
      .single()

    if (!membership) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
    }
  }

  // 4. Configuración del club
  const { data: configRows } = await serviceClient
    .from('nm_club_config')
    .select('key, value')
    .eq('club_id', invoice.club_id)
    .in('key', [
      'club_name',
      'club_legal_name',
      'club_tax_id',
      'club_address',
      'club_phone',
      'club_email',
    ])

  const cfg: Record<string, string> = {}
  for (const row of configRows ?? []) {
    cfg[row.key] = row.value
  }

  const clubName = cfg['club_name'] ?? 'Nueva Marina Pádel & Sport'
  const clubLegalName = cfg['club_legal_name'] ?? clubName
  const clubTaxId = cfg['club_tax_id'] ?? ''
  const clubAddress = cfg['club_address'] ?? ''
  const clubPhone = cfg['club_phone'] ?? ''
  const clubEmail = cfg['club_email'] ?? ''

  const customer = invoice.user ?? {}
  const items: Array<{
    description: string
    qty: number
    unit_price: number
    tax_rate: number
    total: number
  }> = Array.isArray(invoice.items) ? invoice.items : []

  // 5. Generación del PDF
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  const pageW = 210
  const marginL = 15
  const marginR = 15
  const contentW = pageW - marginL - marginR

  let y = 15 // cursor vertical

  // ── Cabecera: nombre del club ────────────────────────────────────────────
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(18)
  doc.text(clubName, marginL, y)
  y += 7

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(80, 80, 80)

  if (clubLegalName && clubLegalName !== clubName) {
    doc.text(clubLegalName, marginL, y)
    y += 5
  }
  if (clubTaxId) {
    doc.text(`NIF/CIF: ${clubTaxId}`, marginL, y)
    y += 5
  }
  if (clubAddress) {
    doc.text(clubAddress, marginL, y)
    y += 5
  }
  const contactParts = [clubPhone, clubEmail].filter(Boolean)
  if (contactParts.length) {
    doc.text(contactParts.join('  ·  '), marginL, y)
    y += 5
  }

  // ── Línea separadora ────────────────────────────────────────────────────
  y += 3
  doc.setDrawColor(200, 200, 200)
  doc.line(marginL, y, pageW - marginR, y)
  y += 7

  // ── Bloque: número / fechas ──────────────────────────────────────────────
  doc.setTextColor(0, 0, 0)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(14)
  doc.text('FACTURA', marginL, y)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)

  // columna derecha
  const col2X = pageW - marginR - 70
  doc.text(`Nº:`, col2X, y - 4)
  doc.setFont('helvetica', 'bold')
  doc.text(invoice.invoice_number ?? String(invoiceId), col2X + 12, y - 4)
  doc.setFont('helvetica', 'normal')

  y += 6
  doc.text(`Fecha de emisión:`, col2X, y - 4)
  doc.text(fmtDate(invoice.created_at), col2X + 38, y - 4)

  if (invoice.due_date) {
    y += 5
    doc.text(`Fecha de vencimiento:`, col2X, y - 4)
    doc.text(fmtDate(invoice.due_date), col2X + 46, y - 4)
  }

  if (invoice.paid_at) {
    y += 5
    doc.text(`Fecha de pago:`, col2X, y - 4)
    doc.text(fmtDate(invoice.paid_at), col2X + 32, y - 4)
  }

  // Estado
  y += 7
  const statusLabel: Record<string, string> = {
    paid: 'PAGADA',
    pending: 'PENDIENTE',
    overdue: 'VENCIDA',
    cancelled: 'CANCELADA',
  }
  const statusText = statusLabel[invoice.status] ?? invoice.status?.toUpperCase() ?? ''
  const statusColor: Record<string, [number, number, number]> = {
    PAGADA: [34, 139, 34],
    PENDIENTE: [220, 150, 0],
    VENCIDA: [200, 40, 40],
    CANCELADA: [120, 120, 120],
  }
  const [r, g, b] = statusColor[statusText] ?? [80, 80, 80]
  doc.setTextColor(r, g, b)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.text(`Estado: ${statusText}`, marginL, y)
  doc.setTextColor(0, 0, 0)

  // ── Línea separadora ────────────────────────────────────────────────────
  y += 6
  doc.setDrawColor(200, 200, 200)
  doc.line(marginL, y, pageW - marginR, y)
  y += 8

  // ── Bloque cliente ──────────────────────────────────────────────────────
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.setTextColor(60, 60, 60)
  doc.text('DATOS DEL CLIENTE', marginL, y)
  y += 5

  doc.setFont('helvetica', 'normal')
  doc.setTextColor(0, 0, 0)

  const customerLines: string[] = []
  if (customer.full_name) customerLines.push(customer.full_name)
  if (customer.document_type && customer.document_number)
    customerLines.push(`${customer.document_type}: ${customer.document_number}`)
  if (customer.email) customerLines.push(customer.email)
  if (customer.phone) customerLines.push(customer.phone)
  if (customer.address) customerLines.push(customer.address)
  if (customer.postal_code) customerLines.push(customer.postal_code)

  for (const line of customerLines) {
    doc.text(line, marginL, y)
    y += 5
  }

  // ── Línea separadora ────────────────────────────────────────────────────
  y += 3
  doc.setDrawColor(200, 200, 200)
  doc.line(marginL, y, pageW - marginR, y)
  y += 8

  // ── Tabla de ítems ───────────────────────────────────────────────────────
  const colDesc = marginL
  const colQty = marginL + contentW * 0.52
  const colPrice = marginL + contentW * 0.64
  const colTax = marginL + contentW * 0.77
  const colTotal = marginL + contentW * 0.89

  // Cabecera de tabla
  doc.setFillColor(40, 40, 40)
  doc.rect(marginL, y - 5, contentW, 7, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.text('Descripción', colDesc + 2, y)
  doc.text('Cant.', colQty, y)
  doc.text('Precio', colPrice, y)
  doc.text('IVA %', colTax, y)
  doc.text('Total', colTotal, y)
  y += 5

  // Filas
  doc.setTextColor(0, 0, 0)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)

  let rowAlt = false
  for (const item of items) {
    rowAlt = !rowAlt
    if (rowAlt) {
      doc.setFillColor(245, 245, 245)
      doc.rect(marginL, y - 4, contentW, 7, 'F')
    }

    const descLines = doc.splitTextToSize(item.description ?? '', colQty - colDesc - 4)
    doc.text(descLines, colDesc + 2, y)
    doc.text(String(item.qty ?? 1), colQty, y)
    doc.text(eur(item.unit_price ?? 0), colPrice, y)
    doc.text(`${item.tax_rate ?? 0}%`, colTax, y)
    doc.text(eur(item.total ?? 0), colTotal, y)

    const rowHeight = Math.max(descLines.length * 5, 7)
    y += rowHeight
  }

  // ── Totales ──────────────────────────────────────────────────────────────
  y += 4
  doc.setDrawColor(200, 200, 200)
  doc.line(marginL, y, pageW - marginR, y)
  y += 6

  const totalsLabelX = pageW - marginR - 70
  const totalsValueX = pageW - marginR

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)

  doc.text('Subtotal:', totalsLabelX, y)
  doc.text(eur(invoice.subtotal ?? 0), totalsValueX, y, { align: 'right' })
  y += 6

  doc.text('IVA:', totalsLabelX, y)
  doc.text(eur(invoice.tax ?? 0), totalsValueX, y, { align: 'right' })
  y += 6

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(12)
  doc.text('TOTAL:', totalsLabelX, y)
  doc.text(eur(invoice.total ?? 0), totalsValueX, y, { align: 'right' })
  y += 4

  doc.setDrawColor(40, 40, 40)
  doc.line(totalsLabelX, y, pageW - marginR, y)

  // ── Método de pago ───────────────────────────────────────────────────────
  if (invoice.payment_method) {
    y += 8
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    doc.setTextColor(80, 80, 80)
    const methodLabels: Record<string, string> = {
      card: 'Tarjeta de crédito/débito',
      cash: 'Efectivo',
      transfer: 'Transferencia bancaria',
      stripe: 'Pago online (Stripe)',
    }
    const methodText =
      methodLabels[invoice.payment_method] ?? invoice.payment_method
    doc.text(`Método de pago: ${methodText}`, marginL, y)
  }

  // ── Pie de página ────────────────────────────────────────────────────────
  const footerY = 285
  doc.setDrawColor(200, 200, 200)
  doc.line(marginL, footerY - 4, pageW - marginR, footerY - 4)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.setTextColor(120, 120, 120)
  doc.text('Nueva Marina Pádel & Sport', pageW / 2, footerY, { align: 'center' })
  doc.text(
    `Documento generado el ${fmtDate(new Date().toISOString())}`,
    pageW / 2,
    footerY + 4,
    { align: 'center' }
  )

  // 6. Salida como PDF
  const pdfBuffer = doc.output('arraybuffer')
  const safeInvoiceNumber = (invoice.invoice_number ?? invoiceId)
    .toString()
    .replace(/[^a-zA-Z0-9\-_]/g, '_')

  return new Response(pdfBuffer, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="factura-${safeInvoiceNumber}.pdf"`,
      'Cache-Control': 'no-store',
    },
  })
}
