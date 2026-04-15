'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { FileSpreadsheet, Upload, Eye, CheckCircle2, AlertTriangle, ArrowLeft, Loader2, Trophy, Download } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/components/ui/toast'

interface Preview {
  league: { name: string; start_date: string }
  categories: {
    sheet: string
    name: string
    gender: string
    teams_count: number
    rounds_count: number
    matches_count: number
    teams: string[]
  }[]
}

interface ImportStats {
  league_id: number
  categories: number
  teams: number
  rounds: number
  matches: number
  byes: number
}

export default function ImportarLigaPage() {
  const { toast } = useToast()
  const router = useRouter()
  const searchParams = useSearchParams()
  const existingId = searchParams.get('league_id')

  const [file, setFile] = useState<File | null>(null)
  const [leagueName, setLeagueName] = useState('LIGA EDENDENTAL 2026')
  const [startDate, setStartDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [preview, setPreview] = useState<Preview | null>(null)
  const [loading, setLoading] = useState(false)
  const [importing, setImporting] = useState(false)
  const [stats, setStats] = useState<ImportStats | null>(null)
  const [existingLeague, setExistingLeague] = useState<{ id: number; name: string } | null>(null)

  useEffect(() => {
    if (!existingId) return
    const supabase = createClient()
    supabase.from('nm_leagues').select('id,name,start_date').eq('id', existingId).single().then(({ data }) => {
      if (data) {
        setExistingLeague({ id: data.id, name: data.name })
        setLeagueName(data.name)
        if (data.start_date) setStartDate(data.start_date)
      }
    })
  }, [existingId])

  async function onPreview(e: React.FormEvent) {
    e.preventDefault()
    if (!file) { toast('warning', 'Subí un archivo xlsx primero'); return }
    setLoading(true); setStats(null); setPreview(null)
    try {
      const fd = new FormData()
      fd.append('file', file)
      fd.append('league_name', leagueName)
      fd.append('start_date', startDate)
      fd.append('dry_run', 'true')
      if (existingLeague) fd.append('league_id', String(existingLeague.id))
      const res = await fetch('/api/import/liga', { method: 'POST', body: fd })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Error')
      setPreview(json.preview as Preview)
      toast('success', `Detectadas ${json.preview.categories.length} categorías`)
    } catch (err) {
      toast('error', (err as Error).message)
    } finally {
      setLoading(false)
    }
  }

  async function onConfirmImport() {
    if (!file || !preview) return
    if (!confirm(`¿Crear la liga "${leagueName}" con ${preview.categories.length} categorías?`)) return
    setImporting(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      fd.append('league_name', leagueName)
      fd.append('start_date', startDate)
      fd.append('dry_run', 'false')
      if (existingLeague) fd.append('league_id', String(existingLeague.id))
      const res = await fetch('/api/import/liga', { method: 'POST', body: fd })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Error')
      setStats(json.stats as ImportStats)
      toast('success', '¡Liga importada!')
    } catch (err) {
      toast('error', (err as Error).message)
    } finally {
      setImporting(false)
    }
  }

  const genderLabel: Record<string, string> = { male: 'Masculino', female: 'Femenino', mixed: 'Mixto' }

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-center gap-3">
        <Link href="/admin/ligas" className="text-slate-400 hover:text-white">
          <ArrowLeft size={20} />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <FileSpreadsheet className="text-cyan-400" /> Importar liga desde Excel
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Subí el Excel con el formato de ligas de Christian — categorías, equipos y jornadas se crean automáticamente.
          </p>
        </div>
      </div>

      {existingLeague && (
        <div className="rounded-lg border border-cyan-500/30 bg-cyan-500/10 p-3 text-sm text-cyan-200 flex items-center gap-2">
          <Upload size={16} />
          <span>
            Modo <strong>actualizar</strong>: los cambios se aplican sobre la liga existente
            <code className="mx-1 text-cyan-100">{existingLeague.name}</code> (equipos, jornadas y partidos nuevos se agregan; los existentes no se tocan).
          </span>
        </div>
      )}

      <div className="flex items-center justify-between bg-slate-800/30 rounded-lg border border-slate-700/50 p-3">
        <div className="text-xs text-slate-400">
          ¿Todavía no tenés Excel? Descargá la plantilla vacía y completala en Excel/Numbers.
        </div>
        <a
          href="/api/ligas/template"
          className="flex items-center gap-1 px-3 py-1.5 text-xs rounded-lg bg-slate-700 hover:bg-slate-600 text-white transition-colors"
        >
          <Download size={12} /> Plantilla vacía
        </a>
      </div>

      {/* Formulario */}
      <Card>
        <form onSubmit={onPreview} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Nombre de la liga</label>
            <Input value={leagueName} onChange={e => setLeagueName(e.target.value)} required />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Fecha de inicio</label>
            <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} required />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Archivo xlsx</label>
            <input
              type="file"
              accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              onChange={e => setFile(e.target.files?.[0] ?? null)}
              className="block w-full text-sm text-slate-300 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:bg-cyan-600 file:text-white hover:file:bg-cyan-500"
            />
            {file && <p className="text-xs text-slate-400 mt-1">{file.name} · {(file.size / 1024).toFixed(1)} KB</p>}
          </div>
          <div className="flex gap-2">
            <Button type="submit" disabled={loading || !file} className="flex items-center gap-2">
              {loading ? <Loader2 size={16} className="animate-spin" /> : <Eye size={16} />}
              Previsualizar
            </Button>
          </div>
        </form>
      </Card>

      {/* Preview */}
      {preview && !stats && (
        <Card>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-white">Vista previa</h2>
            <Badge variant="cyan">{preview.categories.length} categorías</Badge>
          </div>

          <div className="space-y-3">
            {preview.categories.map(cat => (
              <div key={cat.sheet} className="rounded-lg border border-slate-700/50 bg-slate-800/30 p-4">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div>
                    <h3 className="text-sm font-semibold text-white">{cat.name}</h3>
                    <p className="text-xs text-slate-500">Hoja: <code>{cat.sheet}</code></p>
                  </div>
                  <div className="flex flex-wrap gap-2 text-xs">
                    <Badge variant="info">{genderLabel[cat.gender] ?? cat.gender}</Badge>
                    <Badge variant="default">{cat.teams_count} equipos</Badge>
                    <Badge variant="default">{cat.rounds_count} jornadas</Badge>
                    <Badge variant="success">{cat.matches_count} partidos</Badge>
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {cat.teams.map(t => (
                    <span key={t} className="text-[11px] bg-slate-700/50 text-slate-300 px-2 py-0.5 rounded">
                      {t}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div className="mt-6 flex gap-2">
            <Button onClick={onConfirmImport} disabled={importing} className="flex items-center gap-2 bg-green-600 hover:bg-green-500">
              {importing ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
              Confirmar importación
            </Button>
          </div>
        </Card>
      )}

      {/* Resultado */}
      {stats && (
        <Card>
          <div className="flex items-center gap-3 text-green-400 mb-4">
            <CheckCircle2 size={22} />
            <h2 className="text-lg font-semibold">Importación completada</h2>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            {[
              ['Categorías', stats.categories],
              ['Equipos', stats.teams],
              ['Jornadas', stats.rounds],
              ['Partidos', stats.matches],
              ['Descansos', stats.byes],
            ].map(([label, n]) => (
              <div key={label as string} className="bg-slate-800/50 rounded-lg p-3 text-center">
                <div className="text-xl font-bold text-white">{n}</div>
                <div className="text-xs text-slate-400">{label}</div>
              </div>
            ))}
          </div>
          <div className="mt-6 flex gap-2">
            <Button
              onClick={() => router.push(`/admin/ligas`)}
              className="flex items-center gap-2"
            >
              <Trophy size={16} />
              Ver liga
            </Button>
          </div>
          <div className="mt-4 flex items-start gap-2 p-3 rounded-lg bg-amber-500/10 border border-amber-500/30">
            <AlertTriangle size={18} className="text-amber-400 shrink-0 mt-0.5" />
            <p className="text-xs text-amber-200">
              Las <strong>fechas de cada jornada</strong> quedaron sin programar. Editá cada jornada desde el detalle de la liga para fijar día y hora (ej. primera jornada hoy 17:00 Europe/Madrid, duración promedio 1h30).
            </p>
          </div>
        </Card>
      )}
    </div>
  )
}
