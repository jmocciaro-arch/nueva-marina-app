'use client'

import { useState, useCallback } from 'react'
import * as XLSX from 'xlsx'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { KpiCard } from '@/components/ui/kpi-card'
import { useToast } from '@/components/ui/toast'
import { Upload, FileSpreadsheet, Users, CheckCircle, AlertCircle, XCircle, ArrowRight } from 'lucide-react'

interface ImportRow {
  member_id?: string
  first_name?: string
  last_name?: string
  email?: string
  phone?: string
  date_of_birth?: string
  gender?: string
  address?: string
  postal_code?: string
  city?: string
  membership_name?: string
  membership_start?: string
  membership_end?: string
  status?: string
  // Campos extra que Virtuagym exporta
  document_number?: string  // DNI/NIE (de external_id o custom_export_field)
  vat_number?: string       // NIF (de member_vat_number)
  iban?: string             // de bank_account_number
  card_number?: string      // de card_nr (tarjeta RFID)
  tags?: string
  registration_date?: string
  last_check_in?: string
  [key: string]: string | undefined
}

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

type ImportType = 'clients' | 'invoices'

interface ImportResult {
  email: string
  status: 'created' | 'updated' | 'skipped' | 'error'
  message?: string
}

// Normaliza un header al nombre interno que espera el importador
function normalizeHeader(h: string): string {
  const normalized = h.toLowerCase()
    .replace(/[áà]/g, 'a').replace(/[éè]/g, 'e').replace(/[íì]/g, 'i')
    .replace(/[óò]/g, 'o').replace(/[úù]/g, 'u')
    .replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '')
  const mapping: Record<string, string> = {
    'id': 'member_id', 'member_id': 'member_id', 'miembro_id': 'member_id',
    'nombre': 'first_name', 'first_name': 'first_name', 'firstname': 'first_name', 'name': 'first_name',
    'apellido': 'last_name', 'apellidos': 'last_name', 'last_name': 'last_name', 'lastname': 'last_name', 'surname': 'last_name',
    'email': 'email', 'correo': 'email', 'e_mail': 'email', 'mail': 'email',
    'telefono': 'phone', 'phone': 'phone', 'tel': 'phone', 'mobile': 'phone', 'movil': 'phone',
    'fecha_nacimiento': 'date_of_birth', 'date_of_birth': 'date_of_birth', 'birthday': 'date_of_birth', 'birth_date': 'date_of_birth',
    'genero': 'gender', 'gender': 'gender', 'sexo': 'gender',
    'direccion': 'address', 'address': 'address', 'street': 'address',
    'codigo_postal': 'postal_code', 'postal_code': 'postal_code', 'zip': 'postal_code', 'zip_code': 'postal_code', 'cp': 'postal_code',
    'ciudad': 'city', 'city': 'city',
    'membresia': 'membership_name', 'membership': 'membership_name', 'membership_name': 'membership_name', 'plan': 'membership_name', 'abono': 'membership_name',
    'inicio_membresia': 'membership_start', 'membership_start': 'membership_start', 'start_date': 'membership_start', 'member_since': 'membership_start',
    'fin_membresia': 'membership_end', 'membership_end': 'membership_end', 'end_date': 'membership_end', 'unsubscribe_date': 'membership_end',
    'estado': 'status', 'status': 'status', 'active': 'status',
    'external_id': 'document_number', 'dni': 'document_number', 'nie': 'document_number', 'document_number': 'document_number',
    'club_member_id': 'document_number',
    'custom_export_field': 'document_number',
    'member_vat_number': 'vat_number', 'vat': 'vat_number', 'nif': 'vat_number',
    'bank_account_number': 'iban', 'iban': 'iban',
    'card_nr': 'card_number', 'card_number': 'card_number', 'tarjeta': 'card_number',
    'tags': 'tags',
    'registration_date': 'registration_date',
    'check_in': 'last_check_in', 'last_check_in': 'last_check_in',
  }
  return mapping[normalized] || normalized
}

/** Virtuagym usa "DD-MM-YYYY" o "DD-MM-YYYY HH:MM:SS". Devuelve YYYY-MM-DD o null. */
function toIsoDate(input: string | null | undefined): string | null {
  if (!input) return null
  const s = String(input).trim()
  if (s === '' || s === '-') return null
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10)
  const m = s.match(/^(\d{2})-(\d{2})-(\d{4})/)
  if (m) return `${m[3]}-${m[2]}-${m[1]}`
  return null
}

function parseInvoicesExcel(buffer: ArrayBuffer): InvoiceRow[] {
  const wb = XLSX.read(buffer, { type: 'array' })
  const sheet = wb.Sheets[wb.SheetNames[0]]
  const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' })
  const num = (v: unknown): number => {
    if (v === null || v === undefined || v === '') return 0
    const n = typeof v === 'number' ? v : parseFloat(String(v).replace(',', '.'))
    return isFinite(n) ? n : 0
  }
  const str = (v: unknown): string | null => {
    if (v === null || v === undefined) return null
    const s = String(v).trim()
    if (s === '' || s === '-') return null
    return s
  }
  return raw
    .filter(r => r['Factura'])
    .map(r => {
      const tax4 = num(r['4.00% Impuesto de venta'])
      const tax10 = num(r['10.00% Impuesto de venta'])
      const tax21 = num(r['21.00% Impuesto de venta'])
      return {
        invoice_number: String(r['Factura'] ?? ''),
        invoice_date: toIsoDate(str(r['Fecha de factura'])),
        payment_method: str(r['Método de pago']),
        virtuagym_member_id: str(r['Núm. de miembro del club']),
        member_unique_id: str(r['Núm. de miembro único']),
        dni: str(r['Dni']) || str(r['DNI']) || null,
        first_name: str(r['Nombre']),
        last_name: str(r['Apellidos']),
        email: str(r['correo electrónico']),
        phone: str(r['Móvil']) || str(r['Teléfono']),
        product_name: str(r['Nombre del producto']),
        period_start: toIsoDate(str(r['Periodo de inicio'])),
        period_end: toIsoDate(str(r['Periodo de finalización'])),
        subtotal: num(r['Total, excl. impuesto']),
        tax: tax4 + tax10 + tax21,
        total: num(r['Total, incl. impuesto']),
        unpaid: num(r['No pagado']),
        paid_at: toIsoDate(str(r['Pagado el'])),
        sold_by: str(r['Vendido por']),
        category: str(r['Categoría de ingreso']),
      }
    })
}

function parseExcel(buffer: ArrayBuffer): ImportRow[] {
  const wb = XLSX.read(buffer, { type: 'array' })
  const sheet = wb.Sheets[wb.SheetNames[0]]
  const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' })
  return raw.map(rawRow => {
    const row: ImportRow = {}
    // Detección de membresía desde columnas "Acceso", "Boxeo", "Clases dirigidas"
    const memberships: string[] = []

    for (const [key, value] of Object.entries(rawRow)) {
      const normalized = normalizeHeader(key)
      const strVal = value === null || value === undefined ? '' : String(value).trim()

      // Columnas especiales tipo abono: Acceso, Boxeo, Clases dirigidas
      const lowerKey = key.toLowerCase()
      if (['acceso', 'boxeo', 'clases_dirigidas', 'clases dirigidas', 'padel', 'spa'].includes(lowerKey)) {
        if (strVal && strVal !== '0' && strVal !== '-' && strVal.toLowerCase() !== 'no') {
          // Si vale "unlimited" o es un número > 0, cuenta como abono activo
          memberships.push(`${key}: ${strVal}`)
        }
        continue
      }

      // Priorizar external_id > custom_export_field > club_member_id
      if (normalized === 'document_number' && row.document_number) continue
      if (strVal !== '') row[normalized] = strVal
    }

    if (memberships.length > 0 && !row.membership_name) {
      row.membership_name = memberships.join(', ')
    }

    return row
  }).filter(r => r.email || r.first_name)
}

function parseCSV(text: string): ImportRow[] {
  const lines = text.split(/\r?\n/).filter(l => l.trim())
  if (lines.length < 2) return []

  // Parse header — handle quoted fields
  const parseRow = (line: string): string[] => {
    const result: string[] = []
    let current = ''
    let inQuotes = false
    for (let i = 0; i < line.length; i++) {
      const char = line[i]
      if (char === '"') {
        inQuotes = !inQuotes
      } else if ((char === ',' || char === ';') && !inQuotes) {
        result.push(current.trim())
        current = ''
      } else {
        current += char
      }
    }
    result.push(current.trim())
    return result
  }

  const headers = parseRow(lines[0]).map(normalizeHeader)

  return lines.slice(1).map(line => {
    const values = parseRow(line)
    const row: ImportRow = {}
    headers.forEach((h, i) => {
      if (values[i] && !row[h]) row[h] = values[i]
    })
    return row
  }).filter(row => row.email || row.first_name)
}

export default function ImportarPage() {
  const { toast } = useToast()
  const [importType, setImportType] = useState<ImportType>('clients')
  const [step, setStep] = useState<'upload' | 'preview' | 'importing' | 'done'>('upload')
  const [rows, setRows] = useState<ImportRow[]>([])
  const [invoiceRows, setInvoiceRows] = useState<InvoiceRow[]>([])
  const [fileName, setFileName] = useState('')
  const [filesProcessed, setFilesProcessed] = useState<string[]>([])
  const [importing, setImporting] = useState(false)
  const [progress, setProgress] = useState(0)
  const [results, setResults] = useState<ImportResult[]>([])
  const [summary, setSummary] = useState({ total: 0, created: 0, updated: 0, skipped: 0, errors: 0 })

  const handleFileUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? [])
    if (files.length === 0) return

    const processed: string[] = []
    let totalNewClients: ImportRow[] = []
    let totalNewInvoices: InvoiceRow[] = []
    let filesRead = 0

    files.forEach(file => {
      const reader = new FileReader()
      const isExcel = /\.(xlsx|xls)$/i.test(file.name)

      reader.onload = (ev) => {
        try {
          if (importType === 'clients') {
            const parsed = isExcel
              ? parseExcel(ev.target?.result as ArrayBuffer)
              : parseCSV(ev.target?.result as string)
            totalNewClients = [...totalNewClients, ...parsed]
          } else {
            // Invoices — solo Excel
            if (!isExcel) throw new Error('Facturas requieren archivo Excel (.xlsx)')
            const parsed = parseInvoicesExcel(ev.target?.result as ArrayBuffer)
            totalNewInvoices = [...totalNewInvoices, ...parsed]
          }
          processed.push(file.name)
        } catch (err) {
          toast('error', `${file.name}: ${(err as Error).message}`)
        } finally {
          filesRead++
          if (filesRead === files.length) {
            // Todos los archivos procesados
            if (importType === 'clients') {
              if (totalNewClients.length === 0) { toast('error', 'No se pudieron leer datos'); return }
              setRows(totalNewClients)
            } else {
              if (totalNewInvoices.length === 0) { toast('error', 'No se pudieron leer facturas'); return }
              setInvoiceRows(totalNewInvoices)
            }
            setFileName(processed.length === 1 ? processed[0] : `${processed.length} archivos`)
            setFilesProcessed(processed)
            setStep('preview')
            const total = importType === 'clients' ? totalNewClients.length : totalNewInvoices.length
            toast('success', `${total} registros cargados de ${processed.length} archivo(s)`)
          }
        }
      }

      if (isExcel) reader.readAsArrayBuffer(file)
      else reader.readAsText(file, 'utf-8')
    })
  }, [toast, importType])

  const handleImport = useCallback(async () => {
    setImporting(true)
    setStep('importing')
    setProgress(0)

    const items = importType === 'clients' ? rows : invoiceRows
    const endpoint = importType === 'clients' ? '/api/import/virtuagym' : '/api/import/invoices'
    const batchSize = importType === 'clients' ? 25 : 50

    const allResults: ImportResult[] = []
    let totalCreated = 0, totalUpdated = 0, totalSkipped = 0, totalErrors = 0

    for (let i = 0; i < items.length; i += batchSize) {
      const batch = items.slice(i, i + batchSize)
      try {
        const res = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ rows: batch }),
        })
        const data = await res.json()
        if (data.results) {
          allResults.push(...data.results)
          totalCreated += data.created || 0
          totalUpdated += data.updated || 0
          totalSkipped += data.skipped || 0
          totalErrors += data.errors || 0
        }
      } catch {
        batch.forEach(r => {
          const hasEmail = (r as ImportRow).email
          const hasInvoice = (r as InvoiceRow).invoice_number
          const key: string = hasEmail || hasInvoice || '?'
          allResults.push({ email: key, status: 'error', message: 'Error de red' })
        })
        totalErrors += batch.length
      }
      setProgress(Math.min(100, Math.round(((i + batchSize) / items.length) * 100)))
    }

    setResults(allResults)
    setSummary({ total: items.length, created: totalCreated, updated: totalUpdated, skipped: totalSkipped, errors: totalErrors })
    setStep('done')
    setImporting(false)
    toast('success', `Importación completada: ${totalCreated} creados, ${totalUpdated} actualizados`)
  }, [rows, invoiceRows, importType, toast])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Importar desde Virtuagym</h1>
        <p className="text-sm text-slate-400 mt-1">Importa socios, membresías y facturación desde exports de Virtuagym</p>
      </div>

      {/* Selector tipo de importación (solo en step upload) */}
      {step === 'upload' && (
        <div className="flex gap-2">
          <button
            onClick={() => setImportType('clients')}
            className={`flex-1 px-4 py-3 rounded-lg border text-sm font-medium transition-colors ${
              importType === 'clients'
                ? 'border-cyan-500 bg-cyan-500/10 text-cyan-300'
                : 'border-slate-700 bg-slate-800/50 text-slate-400 hover:border-slate-600'
            }`}
          >
            👥 Clientes / Socios
          </button>
          <button
            onClick={() => setImportType('invoices')}
            className={`flex-1 px-4 py-3 rounded-lg border text-sm font-medium transition-colors ${
              importType === 'invoices'
                ? 'border-cyan-500 bg-cyan-500/10 text-cyan-300'
                : 'border-slate-700 bg-slate-800/50 text-slate-400 hover:border-slate-600'
            }`}
          >
            💶 Facturas / Pagos
          </button>
        </div>
      )}

      {/* Steps indicator */}
      <div className="flex items-center gap-2 text-sm">
        {['Subir CSV', 'Preview', 'Importar', 'Resultado'].map((label, i) => {
          const steps = ['upload', 'preview', 'importing', 'done']
          const isActive = steps.indexOf(step) >= i
          return (
            <div key={label} className="flex items-center gap-2">
              {i > 0 && <ArrowRight size={14} className="text-slate-600" />}
              <span className={`px-3 py-1 rounded-full ${isActive ? 'bg-cyan-600/20 text-cyan-400' : 'bg-slate-800 text-slate-500'}`}>
                {i + 1}. {label}
              </span>
            </div>
          )
        })}
      </div>

      {/* Step 1: Upload */}
      {step === 'upload' && (
        <Card>
          <div className="flex flex-col items-center justify-center py-16 gap-4">
            <div className="w-20 h-20 rounded-2xl bg-cyan-600/10 flex items-center justify-center">
              <Upload size={40} className="text-cyan-500" />
            </div>
            <div className="text-center">
              <h3 className="text-lg font-semibold text-white">
                {importType === 'clients' ? 'Subí el CSV o Excel de clientes' : 'Subí los Excel de facturas'}
              </h3>
              <p className="text-sm text-slate-400 mt-1">
                {importType === 'clients'
                  ? 'Virtuagym → Configuración del sistema → Exportar miembros'
                  : 'Virtuagym → Finanzas → Facturas → Exportar (podés subir varios archivos a la vez)'}
              </p>
            </div>
            <label className="cursor-pointer">
              <input
                type="file"
                accept={importType === 'clients' ? '.csv,.txt,.tsv,.xlsx,.xls' : '.xlsx,.xls'}
                multiple={importType === 'invoices'}
                onChange={handleFileUpload}
                className="hidden"
              />
              <div className="flex items-center gap-2 px-6 py-3 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-medium transition-colors">
                <FileSpreadsheet size={18} />
                {importType === 'clients' ? 'Seleccionar archivo' : 'Seleccionar archivos'}
              </div>
            </label>
            <p className="text-xs text-slate-600 mt-2">
              {importType === 'clients'
                ? 'Formatos soportados: Excel (.xlsx, .xls), CSV, TSV'
                : 'Seleccioná todos los Excel a la vez (Cmd+click). Se van a juntar.'}
            </p>
          </div>
        </Card>
      )}

      {/* Step 2: Preview */}
      {step === 'preview' && importType === 'clients' && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <KpiCard title="Total registros" value={rows.length} icon={<Users size={20} />} />
            <KpiCard title="Con email" value={rows.filter(r => r.email?.includes('@')).length} icon={<CheckCircle size={20} />} color="#10b981" />
            <KpiCard title="Con membresía" value={rows.filter(r => r.membership_name).length} icon={<FileSpreadsheet size={20} />} color="#6366f1" />
            <KpiCard title="Sin email" value={rows.filter(r => !r.email?.includes('@')).length} icon={<AlertCircle size={20} />} color="#ef4444" />
          </div>

          <Card>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-lg font-semibold text-white">Preview: {fileName}</h3>
                <p className="text-xs text-slate-400">Mostrando los primeros 20 registros</p>
              </div>
              <div className="flex items-center gap-3">
                <Button variant="ghost" onClick={() => { setStep('upload'); setRows([]) }}>
                  Cancelar
                </Button>
                <Button onClick={handleImport} loading={importing}>
                  <Upload size={16} className="mr-1" />
                  Importar {rows.filter(r => r.email?.includes('@')).length} usuarios
                </Button>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-slate-700">
                    <th className="text-left font-medium text-slate-400 pb-3 pl-2">#</th>
                    <th className="text-left font-medium text-slate-400 pb-3">Nombre</th>
                    <th className="text-left font-medium text-slate-400 pb-3">Email</th>
                    <th className="text-left font-medium text-slate-400 pb-3">Teléfono</th>
                    <th className="text-left font-medium text-slate-400 pb-3">DNI/NIE</th>
                    <th className="text-left font-medium text-slate-400 pb-3">Nac.</th>
                    <th className="text-left font-medium text-slate-400 pb-3">Ciudad</th>
                    <th className="text-left font-medium text-slate-400 pb-3">Tarjeta</th>
                    <th className="text-left font-medium text-slate-400 pb-3">Abonos</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.slice(0, 20).map((row, i) => (
                    <tr key={i} className="border-b border-slate-800 hover:bg-slate-800/30">
                      <td className="py-2 pl-2 text-slate-500">{i + 1}</td>
                      <td className="py-2 text-white whitespace-nowrap">{[row.first_name, row.last_name].filter(Boolean).join(' ') || '-'}</td>
                      <td className="py-2 text-slate-300">{row.email || <span className="text-red-400">sin email</span>}</td>
                      <td className="py-2 text-slate-400 whitespace-nowrap">{row.phone || '-'}</td>
                      <td className="py-2 text-slate-400 font-mono">{row.document_number || '-'}</td>
                      <td className="py-2 text-slate-400 whitespace-nowrap">{row.date_of_birth || '-'}</td>
                      <td className="py-2 text-slate-400 whitespace-nowrap">{row.city || '-'}</td>
                      <td className="py-2 text-slate-500 font-mono text-[10px]">
                        {row.card_number && row.card_number !== '-' ? '●' : '-'}
                      </td>
                      <td className="py-2">
                        {row.membership_name ? (
                          <Badge variant="cyan">{row.membership_name.length > 30 ? row.membership_name.slice(0, 28) + '…' : row.membership_name}</Badge>
                        ) : (
                          <span className="text-slate-600">-</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-3 text-[11px] text-slate-500 flex flex-wrap gap-x-4 gap-y-1">
              <span>💡 También se importa: <strong>género, dirección, CP, IBAN, tags, fecha de alta, último check-in</strong> en la ficha del usuario (no se muestran en el preview).</span>
            </div>
            {rows.length > 20 && (
              <p className="text-xs text-slate-500 mt-3 text-center">... y {rows.length - 20} registros más</p>
            )}
          </Card>
        </>
      )}

      {/* Step 2: Preview de FACTURAS */}
      {step === 'preview' && importType === 'invoices' && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
            <KpiCard title="Total facturas" value={invoiceRows.length} icon={<FileSpreadsheet size={20} />} />
            <KpiCard
              title="Total facturado"
              value={`€${invoiceRows.reduce((s, r) => s + r.total, 0).toFixed(2)}`}
              icon={<CheckCircle size={20} />}
              color="#10b981"
            />
            <KpiCard
              title="Pagadas"
              value={invoiceRows.filter(r => r.unpaid === 0).length}
              icon={<CheckCircle size={20} />}
              color="#10b981"
            />
            <KpiCard
              title="Impagas"
              value={invoiceRows.filter(r => r.unpaid > 0).length}
              icon={<AlertCircle size={20} />}
              color="#ef4444"
            />
            <KpiCard
              title="Productos únicos"
              value={new Set(invoiceRows.map(r => r.product_name).filter(Boolean)).size}
              icon={<FileSpreadsheet size={20} />}
              color="#6366f1"
            />
          </div>

          <Card>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-lg font-semibold text-white">Preview: {fileName}</h3>
                <p className="text-xs text-slate-400">
                  {filesProcessed.length > 1
                    ? `${filesProcessed.length} archivos · ${invoiceRows.length} facturas · mostrando los primeros 20`
                    : `Mostrando los primeros 20 de ${invoiceRows.length}`}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <Button variant="ghost" onClick={() => { setStep('upload'); setInvoiceRows([]); setFilesProcessed([]) }}>
                  Cancelar
                </Button>
                <Button onClick={handleImport} loading={importing}>
                  <Upload size={16} className="mr-1" />
                  Importar {invoiceRows.length} facturas
                </Button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-slate-700">
                    <th className="text-left font-medium text-slate-400 pb-3 pl-2">#</th>
                    <th className="text-left font-medium text-slate-400 pb-3">Factura</th>
                    <th className="text-left font-medium text-slate-400 pb-3">Fecha</th>
                    <th className="text-left font-medium text-slate-400 pb-3">Cliente</th>
                    <th className="text-left font-medium text-slate-400 pb-3">DNI</th>
                    <th className="text-left font-medium text-slate-400 pb-3">Producto</th>
                    <th className="text-right font-medium text-slate-400 pb-3">Total</th>
                    <th className="text-left font-medium text-slate-400 pb-3 pl-3">Pago</th>
                    <th className="text-left font-medium text-slate-400 pb-3">Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {invoiceRows.slice(0, 20).map((r, i) => (
                    <tr key={i} className="border-b border-slate-800 hover:bg-slate-800/30">
                      <td className="py-2 pl-2 text-slate-500">{i + 1}</td>
                      <td className="py-2 text-slate-300 font-mono">{r.invoice_number}</td>
                      <td className="py-2 text-slate-400 whitespace-nowrap">{r.invoice_date || '-'}</td>
                      <td className="py-2 text-white whitespace-nowrap">{[r.first_name, r.last_name].filter(Boolean).join(' ') || '-'}</td>
                      <td className="py-2 text-slate-400 font-mono">{r.dni || '-'}</td>
                      <td className="py-2 text-slate-300">{r.product_name || '-'}</td>
                      <td className="py-2 text-right font-mono text-cyan-400">€{r.total.toFixed(2)}</td>
                      <td className="py-2 text-slate-400 pl-3 whitespace-nowrap">{r.payment_method || '-'}</td>
                      <td className="py-2">
                        <Badge variant={r.unpaid > 0 ? 'danger' : 'success'}>
                          {r.unpaid > 0 ? 'Impaga' : 'Pagada'}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {invoiceRows.length > 20 && (
              <p className="text-xs text-slate-500 mt-3 text-center">... y {invoiceRows.length - 20} facturas más</p>
            )}
            <div className="mt-3 text-[11px] text-slate-500">
              💡 Al importar se van a: (1) guardar las facturas, (2) crear/actualizar productos únicos,
              (3) crear/actualizar planes de abonos según <em>Categoría de ingreso</em> y (4) vincular al cliente por DNI o ID Virtuagym.
            </div>
          </Card>
        </>
      )}

      {/* Step 3: Importing */}
      {step === 'importing' && (
        <Card>
          <div className="flex flex-col items-center justify-center py-16 gap-6">
            <div className="w-20 h-20 rounded-2xl bg-cyan-600/10 flex items-center justify-center">
              <div className="w-10 h-10 border-3 border-cyan-500 border-t-transparent rounded-full animate-spin" />
            </div>
            <div className="text-center">
              <h3 className="text-lg font-semibold text-white">Importando usuarios...</h3>
              <p className="text-sm text-slate-400 mt-1">{progress}% completado</p>
            </div>
            <div className="w-full max-w-md bg-slate-800 rounded-full h-3">
              <div
                className="bg-cyan-500 h-3 rounded-full transition-all duration-500"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        </Card>
      )}

      {/* Step 4: Results */}
      {step === 'done' && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
            <KpiCard title="Total" value={summary.total} icon={<Users size={20} />} />
            <KpiCard title="Creados" value={summary.created} icon={<CheckCircle size={20} />} color="#10b981" />
            <KpiCard title="Actualizados" value={summary.updated} icon={<ArrowRight size={20} />} color="#6366f1" />
            <KpiCard title="Omitidos" value={summary.skipped} icon={<AlertCircle size={20} />} color="#f59e0b" />
            <KpiCard title="Errores" value={summary.errors} icon={<XCircle size={20} />} color="#ef4444" />
          </div>

          <Card>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-white">Resultados de importación</h3>
              <Button variant="ghost" onClick={() => { setStep('upload'); setRows([]); setResults([]) }}>
                Nueva importación
              </Button>
            </div>
            <div className="overflow-x-auto max-h-96 overflow-y-auto">
              <table className="w-full">
                <thead className="sticky top-0 bg-slate-800">
                  <tr className="border-b border-slate-700">
                    <th className="text-left text-xs font-medium text-slate-400 pb-3 pl-2">Email</th>
                    <th className="text-left text-xs font-medium text-slate-400 pb-3">Estado</th>
                    <th className="text-left text-xs font-medium text-slate-400 pb-3">Detalle</th>
                  </tr>
                </thead>
                <tbody>
                  {results.map((r, i) => (
                    <tr key={i} className="border-b border-slate-800">
                      <td className="py-2 pl-2 text-sm text-white">{r.email}</td>
                      <td className="py-2">
                        <Badge variant={r.status === 'created' ? 'success' : r.status === 'updated' ? 'info' : r.status === 'error' ? 'danger' : 'warning'}>
                          {r.status === 'created' ? 'Creado' : r.status === 'updated' ? 'Actualizado' : r.status === 'error' ? 'Error' : 'Omitido'}
                        </Badge>
                      </td>
                      <td className="py-2 text-sm text-slate-400">{r.message || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}
    </div>
  )
}
