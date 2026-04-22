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

function parseExcel(buffer: ArrayBuffer): ImportRow[] {
  const wb = XLSX.read(buffer, { type: 'array' })
  const sheet = wb.Sheets[wb.SheetNames[0]]
  const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' })
  return raw.map(rawRow => {
    const row: ImportRow = {}
    for (const [key, value] of Object.entries(rawRow)) {
      const normalized = normalizeHeader(key)
      // Priorizar external_id > custom_export_field > club_member_id (el primer no-vacío gana)
      if (normalized === 'document_number' && row.document_number) continue
      if (value !== null && value !== undefined && String(value).trim() !== '') {
        row[normalized] = String(value).trim()
      }
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
  const [step, setStep] = useState<'upload' | 'preview' | 'importing' | 'done'>('upload')
  const [rows, setRows] = useState<ImportRow[]>([])
  const [fileName, setFileName] = useState('')
  const [importing, setImporting] = useState(false)
  const [progress, setProgress] = useState(0)
  const [results, setResults] = useState<ImportResult[]>([])
  const [summary, setSummary] = useState({ total: 0, created: 0, updated: 0, skipped: 0, errors: 0 })

  const handleFileUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setFileName(file.name)
    const reader = new FileReader()
    const isExcel = /\.(xlsx|xls)$/i.test(file.name)

    reader.onload = (ev) => {
      try {
        let parsed: ImportRow[] = []
        if (isExcel) {
          const buffer = ev.target?.result as ArrayBuffer
          parsed = parseExcel(buffer)
        } else {
          const text = ev.target?.result as string
          parsed = parseCSV(text)
        }
        if (parsed.length === 0) {
          toast('error', 'No se pudieron leer datos del archivo')
          return
        }
        setRows(parsed)
        setStep('preview')
        toast('success', `${parsed.length} registros encontrados`)
      } catch (err) {
        toast('error', `Error leyendo el archivo: ${(err as Error).message}`)
      }
    }

    if (isExcel) reader.readAsArrayBuffer(file)
    else reader.readAsText(file, 'utf-8')
  }, [toast])

  const handleImport = useCallback(async () => {
    setImporting(true)
    setStep('importing')
    setProgress(0)

    // Process in batches of 25
    const batchSize = 25
    const allResults: ImportResult[] = []
    let totalCreated = 0, totalUpdated = 0, totalSkipped = 0, totalErrors = 0

    for (let i = 0; i < rows.length; i += batchSize) {
      const batch = rows.slice(i, i + batchSize)
      try {
        const res = await fetch('/api/import/virtuagym', {
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
        batch.forEach(r => allResults.push({ email: r.email || '?', status: 'error', message: 'Error de red' }))
        totalErrors += batch.length
      }
      setProgress(Math.min(100, Math.round(((i + batchSize) / rows.length) * 100)))
    }

    setResults(allResults)
    setSummary({ total: rows.length, created: totalCreated, updated: totalUpdated, skipped: totalSkipped, errors: totalErrors })
    setStep('done')
    setImporting(false)
    toast('success', `Importación completada: ${totalCreated} creados, ${totalUpdated} actualizados`)
  }, [rows, toast])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Importar desde Virtuagym</h1>
        <p className="text-sm text-slate-400 mt-1">Importa socios, membresías y datos desde un CSV exportado de Virtuagym</p>
      </div>

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
              <h3 className="text-lg font-semibold text-white">Subí el CSV de Virtuagym</h3>
              <p className="text-sm text-slate-400 mt-1">
                Andá a Virtuagym {'>'} Configuración {'>'} Miembros {'>'} Exportar CSV
              </p>
            </div>
            <label className="cursor-pointer">
              <input type="file" accept=".csv,.txt,.tsv,.xlsx,.xls" onChange={handleFileUpload} className="hidden" />
              <div className="flex items-center gap-2 px-6 py-3 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-medium transition-colors">
                <FileSpreadsheet size={18} />
                Seleccionar archivo
              </div>
            </label>
            <p className="text-xs text-slate-600 mt-2">
              Formatos soportados: Excel (.xlsx, .xls), CSV, TSV
            </p>
          </div>
        </Card>
      )}

      {/* Step 2: Preview */}
      {step === 'preview' && (
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
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-700">
                    <th className="text-left text-xs font-medium text-slate-400 pb-3 pl-2">#</th>
                    <th className="text-left text-xs font-medium text-slate-400 pb-3">Nombre</th>
                    <th className="text-left text-xs font-medium text-slate-400 pb-3">Email</th>
                    <th className="text-left text-xs font-medium text-slate-400 pb-3">Teléfono</th>
                    <th className="text-left text-xs font-medium text-slate-400 pb-3">Membresía</th>
                    <th className="text-left text-xs font-medium text-slate-400 pb-3">Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.slice(0, 20).map((row, i) => (
                    <tr key={i} className="border-b border-slate-800 hover:bg-slate-800/30">
                      <td className="py-2.5 pl-2 text-xs text-slate-500">{i + 1}</td>
                      <td className="py-2.5 text-sm text-white">{[row.first_name, row.last_name].filter(Boolean).join(' ') || '-'}</td>
                      <td className="py-2.5 text-sm text-slate-300">{row.email || <span className="text-red-400">sin email</span>}</td>
                      <td className="py-2.5 text-sm text-slate-400">{row.phone || '-'}</td>
                      <td className="py-2.5 text-sm text-slate-400">{row.membership_name || '-'}</td>
                      <td className="py-2.5">
                        <Badge variant={row.status?.toLowerCase() === 'inactive' ? 'danger' : 'success'}>
                          {row.status || 'Activo'}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {rows.length > 20 && (
              <p className="text-xs text-slate-500 mt-3 text-center">... y {rows.length - 20} registros más</p>
            )}
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
