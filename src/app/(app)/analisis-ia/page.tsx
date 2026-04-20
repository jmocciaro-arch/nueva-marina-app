'use client'

import { useState, useCallback, useEffect, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/lib/auth-context'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Modal } from '@/components/ui/modal'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { KpiCard } from '@/components/ui/kpi-card'
import { useToast } from '@/components/ui/toast'
import { formatDate } from '@/lib/utils'
import {
  Sparkles, Upload, Play, Clock, Activity, Trophy, TrendingUp,
  Target, AlertCircle, ChevronRight, Zap, Flame, Video
} from 'lucide-react'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar,
} from 'recharts'

interface AiVideo {
  id: string
  title: string
  description: string | null
  status: 'pending' | 'processing' | 'completed' | 'failed'
  match_type: string
  court_side: string
  match_context: string | null
  duration_seconds: number | null
  thumbnail_url: string | null
  created_at: string
  processing_completed_at: string | null
}

interface AiReport {
  id: string
  video_id: string
  overall_score: number
  skill_score: number
  positioning_score: number
  consistency_score: number
  shots_total: number
  shots_forehand: number
  shots_backhand: number
  shots_volley: number
  shots_smash: number
  shots_serve: number
  shots_bandeja: number
  shots_vibora: number
  winners_count: number
  errors_count: number
  unforced_errors: number
  distance_meters: number
  avg_speed_kmh: number
  max_speed_kmh: number
  heatmap_data: Array<{ x: number; y: number; weight: number }>
  improvements: Array<{ title: string; description: string; priority: 'high' | 'med' | 'low'; shot_type?: string }>
  summary: string | null
  processed_at: string
}

interface AiHighlight {
  id: string
  timestamp_sec: number
  duration_sec: number
  shot_type: string
  outcome: string
  quality: string
  note: string | null
}

const STATUS_BADGE: Record<string, { color: 'success' | 'warning' | 'info' | 'danger'; label: string }> = {
  pending: { color: 'warning', label: 'Pendiente' },
  processing: { color: 'info', label: 'Procesando' },
  completed: { color: 'success', label: 'Completado' },
  failed: { color: 'danger', label: 'Error' },
}

export default function AnalisisIAPage() {
  const { user } = useAuth()
  const { toast } = useToast()

  const [videos, setVideos] = useState<AiVideo[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<AiVideo | null>(null)
  const [report, setReport] = useState<AiReport | null>(null)
  const [highlights, setHighlights] = useState<AiHighlight[]>([])
  const [loadingDetail, setLoadingDetail] = useState(false)

  const [showNewModal, setShowNewModal] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [form, setForm] = useState({
    title: '',
    description: '',
    match_type: 'dobles',
    court_side: 'derecha',
    match_context: '',
    partner: '',
    opponents: '',
    duration_seconds: 3600,
  })

  const loadVideos = useCallback(async () => {
    if (!user) return
    setLoading(true)
    const supabase = createClient()
    const { data, error } = await supabase
      .from('nm_ai_videos')
      .select('id, title, description, status, match_type, court_side, match_context, duration_seconds, thumbnail_url, created_at, processing_completed_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
    if (!error && data) setVideos(data as AiVideo[])
    setLoading(false)
  }, [user])

  useEffect(() => { loadVideos() }, [loadVideos])

  const loadDetail = useCallback(async (video: AiVideo) => {
    setSelected(video)
    setReport(null)
    setHighlights([])
    if (video.status !== 'completed') return
    setLoadingDetail(true)
    const supabase = createClient()
    const [{ data: reportData }, { data: highlightsData }] = await Promise.all([
      supabase.from('nm_ai_reports').select('*').eq('video_id', video.id).maybeSingle(),
      supabase.from('nm_ai_highlights').select('*').eq('video_id', video.id).order('timestamp_sec'),
    ])
    if (reportData) setReport(reportData as AiReport)
    if (highlightsData) setHighlights(highlightsData as AiHighlight[])
    setLoadingDetail(false)
  }, [])

  async function handleCreate() {
    if (!form.title.trim()) {
      toast('error', 'El título es obligatorio')
      return
    }
    setSubmitting(true)
    try {
      const res = await fetch('/api/ai-analysis/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: form.title.trim(),
          description: form.description.trim() || null,
          match_type: form.match_type,
          court_side: form.court_side,
          match_context: form.match_context.trim() || null,
          partner: form.partner.trim() || null,
          opponents: form.opponents.trim() || null,
          duration_seconds: form.duration_seconds,
        }),
      })
      const json = await res.json()
      if (!res.ok || !json.video_id) {
        toast('error', json.error || 'No se pudo crear el análisis')
        return
      }

      toast('info', 'Analizando tu partido con IA…')
      const procRes = await fetch('/api/ai-analysis/process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ video_id: json.video_id }),
      })
      const procJson = await procRes.json()
      if (!procRes.ok) {
        toast('error', procJson.error || 'Falló el análisis')
      } else {
        toast('success', `Informe listo — Score ${procJson.overall_score}/100`)
      }
      setShowNewModal(false)
      setForm({
        title: '', description: '', match_type: 'dobles', court_side: 'derecha',
        match_context: '', partner: '', opponents: '', duration_seconds: 3600,
      })
      await loadVideos()
    } finally {
      setSubmitting(false)
    }
  }

  const stats = useMemo(() => {
    const completed = videos.filter(v => v.status === 'completed').length
    const processing = videos.filter(v => v.status === 'processing' || v.status === 'pending').length
    return { total: videos.length, completed, processing }
  }, [videos])

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Sparkles size={24} className="text-cyan-400" />
            Análisis IA
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Subí un vídeo de tu partido y recibí un informe completo en minutos.
          </p>
        </div>
        <Button onClick={() => setShowNewModal(true)}>
          <Upload size={16} className="mr-2" /> Nuevo análisis
        </Button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <KpiCard title="Total de análisis" value={stats.total} icon={<Video size={20} />} color="#06b6d4" />
        <KpiCard title="Completados" value={stats.completed} icon={<Trophy size={20} />} color="#10b981" />
        <KpiCard title="En proceso" value={stats.processing} icon={<Clock size={20} />} color="#f59e0b" />
      </div>

      {/* Lista de videos */}
      {loading ? (
        <div className="text-center py-12 text-slate-500">Cargando análisis…</div>
      ) : videos.length === 0 ? (
        <Card className="p-12 text-center">
          <Sparkles size={48} className="mx-auto text-cyan-500 mb-4" />
          <h3 className="text-lg font-semibold text-white mb-2">Sin análisis todavía</h3>
          <p className="text-sm text-slate-400 mb-6 max-w-md mx-auto">
            Subí el vídeo de tu próximo partido y nuestra IA te devolverá métricas,
            mapa de calor, 3 puntos a mejorar y momentos destacados.
          </p>
          <Button onClick={() => setShowNewModal(true)}>
            <Upload size={16} className="mr-2" /> Analizar mi primer partido
          </Button>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {videos.map(v => {
            const status = STATUS_BADGE[v.status]
            return (
              <button
                key={v.id}
                onClick={() => loadDetail(v)}
                className="text-left bg-slate-900 border border-slate-800 rounded-xl overflow-hidden hover:border-cyan-500/50 transition-colors group"
              >
                <div className="aspect-video bg-slate-800 flex items-center justify-center relative">
                  {v.thumbnail_url ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img src={v.thumbnail_url} alt={v.title} className="object-cover w-full h-full" />
                  ) : (
                    <Play size={40} className="text-slate-600 group-hover:text-cyan-400 transition-colors" />
                  )}
                  <div className="absolute top-2 right-2">
                    <Badge variant={status.color}>{status.label}</Badge>
                  </div>
                </div>
                <div className="p-4">
                  <h3 className="font-semibold text-white truncate">{v.title}</h3>
                  <p className="text-xs text-slate-500 mt-1">{formatDate(v.created_at)}</p>
                  <div className="flex items-center gap-3 mt-3 text-xs text-slate-400">
                    <span className="capitalize">{v.match_type}</span>
                    <span className="text-slate-600">•</span>
                    <span className="capitalize">{v.court_side}</span>
                    {v.duration_seconds && (
                      <>
                        <span className="text-slate-600">•</span>
                        <span>{Math.round(v.duration_seconds / 60)} min</span>
                      </>
                    )}
                  </div>
                </div>
              </button>
            )
          })}
        </div>
      )}

      {/* Modal detalle */}
      {selected && (
        <Modal
          open={!!selected}
          onClose={() => { setSelected(null); setReport(null); setHighlights([]) }}
          title={selected.title}
          size="xl"
        >
          {selected.status !== 'completed' ? (
            <div className="py-12 text-center">
              <Clock size={40} className="mx-auto text-amber-400 mb-3" />
              <p className="text-white font-medium">
                {selected.status === 'failed' ? 'Análisis fallido' : 'Todavía procesando…'}
              </p>
              <p className="text-sm text-slate-400 mt-1">
                {selected.status === 'failed'
                  ? 'Intentá subir el vídeo nuevamente.'
                  : 'Esto puede tardar unos minutos. Te notificaremos al terminar.'}
              </p>
            </div>
          ) : loadingDetail ? (
            <div className="py-12 text-center text-slate-500">Cargando informe…</div>
          ) : report ? (
            <ReportView report={report} highlights={highlights} />
          ) : null}
        </Modal>
      )}

      {/* Modal crear */}
      <Modal
        open={showNewModal}
        onClose={() => setShowNewModal(false)}
        title="Nuevo análisis IA"
        size="lg"
        footer={
          <>
            <Button variant="ghost" onClick={() => setShowNewModal(false)} disabled={submitting}>
              Cancelar
            </Button>
            <Button onClick={handleCreate} disabled={submitting}>
              {submitting ? 'Procesando…' : 'Analizar partido'}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="block text-xs text-slate-400 mb-1">Título del partido *</label>
            <Input
              value={form.title}
              onChange={e => setForm({ ...form, title: e.target.value })}
              placeholder="Ej: Amistoso del domingo vs Juan y Marta"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-slate-400 mb-1">Tipo</label>
              <Select
                value={form.match_type}
                onChange={e => setForm({ ...form, match_type: e.target.value })}
                options={[
                  { value: 'dobles', label: 'Dobles' },
                  { value: 'singles', label: 'Individual' },
                ]}
              />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Lado de pista</label>
              <Select
                value={form.court_side}
                onChange={e => setForm({ ...form, court_side: e.target.value })}
                options={[
                  { value: 'derecha', label: 'Derecha' },
                  { value: 'reves', label: 'Revés' },
                ]}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-slate-400 mb-1">Tu pareja</label>
              <Input
                value={form.partner}
                onChange={e => setForm({ ...form, partner: e.target.value })}
                placeholder="Ej: Carlos"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Rivales</label>
              <Input
                value={form.opponents}
                onChange={e => setForm({ ...form, opponents: e.target.value })}
                placeholder="Ej: Juan y Marta"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">Duración (minutos)</label>
            <Input
              type="number"
              value={Math.round(form.duration_seconds / 60)}
              onChange={e => setForm({ ...form, duration_seconds: Math.max(60, parseInt(e.target.value || '60') * 60) })}
            />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">Notas</label>
            <Input
              value={form.description}
              onChange={e => setForm({ ...form, description: e.target.value })}
              placeholder="Cualquier detalle relevante del partido"
            />
          </div>
          <div className="rounded-lg border border-cyan-500/30 bg-cyan-500/5 p-3 text-xs text-cyan-200">
            <p className="font-medium mb-1 flex items-center gap-1">
              <Sparkles size={12} /> MVP — vídeo opcional
            </p>
            <p className="text-cyan-300/80">
              En esta versión podés crear el análisis sin subir el vídeo. El informe se
              genera con un modelo de referencia. Pronto vas a poder subir el archivo.
            </p>
          </div>
        </div>
      </Modal>
    </div>
  )
}

// ──────────────────────────────────────────────────────────────
// Report view
// ──────────────────────────────────────────────────────────────
function ReportView({ report, highlights }: { report: AiReport; highlights: AiHighlight[] }) {
  const shotsData = [
    { name: 'Derecha', value: report.shots_forehand },
    { name: 'Revés', value: report.shots_backhand },
    { name: 'Volea', value: report.shots_volley },
    { name: 'Bandeja', value: report.shots_bandeja },
    { name: 'Víbora', value: report.shots_vibora },
    { name: 'Remate', value: report.shots_smash },
    { name: 'Saque', value: report.shots_serve },
  ]

  const radarData = [
    { metric: 'Técnica', value: report.skill_score },
    { metric: 'Posición', value: report.positioning_score },
    { metric: 'Consistencia', value: report.consistency_score },
    { metric: 'Ataque', value: Math.min(100, Math.round((report.winners_count / Math.max(report.shots_total, 1)) * 400)) },
    { metric: 'Defensa', value: Math.max(0, 100 - Math.round((report.unforced_errors / Math.max(report.shots_total, 1)) * 400)) },
  ]

  return (
    <div className="space-y-6">
      {/* Score global */}
      <div className="text-center py-4">
        <div className="inline-flex flex-col items-center">
          <div className="relative w-28 h-28">
            <svg className="w-28 h-28 -rotate-90" viewBox="0 0 100 100">
              <circle cx="50" cy="50" r="45" fill="none" stroke="#1e293b" strokeWidth="8" />
              <circle
                cx="50" cy="50" r="45" fill="none"
                stroke="#06b6d4" strokeWidth="8" strokeLinecap="round"
                strokeDasharray={`${(report.overall_score / 100) * 283} 283`}
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <div>
                <p className="text-3xl font-bold text-white leading-none">{report.overall_score}</p>
                <p className="text-[10px] text-slate-400 uppercase tracking-wider text-center">/ 100</p>
              </div>
            </div>
          </div>
          <p className="mt-2 text-sm text-slate-300 font-medium">Score global</p>
        </div>
      </div>

      {report.summary && (
        <Card className="p-4 bg-cyan-500/5 border-cyan-500/30">
          <p className="text-sm text-cyan-100">{report.summary}</p>
        </Card>
      )}

      {/* Métricas principales */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <MiniStat icon={<Activity size={16} />} label="Golpes" value={report.shots_total} color="#06b6d4" />
        <MiniStat icon={<Trophy size={16} />} label="Ganadores" value={report.winners_count} color="#10b981" />
        <MiniStat icon={<AlertCircle size={16} />} label="No forzados" value={report.unforced_errors} color="#f59e0b" />
        <MiniStat icon={<Zap size={16} />} label="Distancia" value={`${report.distance_meters}m`} color="#a855f7" />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="p-4">
          <h4 className="text-sm font-semibold text-white mb-3">Golpes por tipo</h4>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={shotsData}>
              <XAxis dataKey="name" stroke="#64748b" fontSize={10} />
              <YAxis stroke="#64748b" fontSize={10} />
              <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid #334155' }} />
              <Bar dataKey="value" fill="#06b6d4" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>
        <Card className="p-4">
          <h4 className="text-sm font-semibold text-white mb-3">Perfil de juego</h4>
          <ResponsiveContainer width="100%" height={200}>
            <RadarChart data={radarData}>
              <PolarGrid stroke="#334155" />
              <PolarAngleAxis dataKey="metric" tick={{ fill: '#94a3b8', fontSize: 10 }} />
              <PolarRadiusAxis stroke="#475569" tick={{ fill: '#64748b', fontSize: 9 }} domain={[0, 100]} />
              <Radar dataKey="value" stroke="#06b6d4" fill="#06b6d4" fillOpacity={0.4} />
            </RadarChart>
          </ResponsiveContainer>
        </Card>
      </div>

      {/* Heatmap simple */}
      <Card className="p-4">
        <h4 className="text-sm font-semibold text-white mb-3">Mapa de calor — posicionamiento</h4>
        <HeatmapMini data={report.heatmap_data} />
        <p className="text-xs text-slate-500 mt-2">
          Zonas con mayor tiempo de permanencia en la pista durante el partido.
        </p>
      </Card>

      {/* Improvements */}
      <Card className="p-4">
        <h4 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
          <TrendingUp size={16} className="text-cyan-400" />
          Cosas para mejorar
        </h4>
        <div className="space-y-3">
          {report.improvements.map((imp, i) => (
            <div key={i} className="rounded-lg border border-slate-700/60 p-3 flex items-start gap-3">
              <div className={`shrink-0 mt-1 w-2 h-2 rounded-full ${
                imp.priority === 'high' ? 'bg-red-500' : imp.priority === 'med' ? 'bg-amber-500' : 'bg-emerald-500'
              }`} />
              <div className="flex-1">
                <p className="text-sm font-semibold text-white">{imp.title}</p>
                <p className="text-xs text-slate-400 mt-1">{imp.description}</p>
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* Highlights */}
      {highlights.length > 0 && (
        <Card className="p-4">
          <h4 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
            <Flame size={16} className="text-orange-400" />
            Momentos destacados
          </h4>
          <div className="space-y-2">
            {highlights.map(h => (
              <div key={h.id} className="flex items-center gap-3 rounded-lg bg-slate-800/50 p-2 text-sm">
                <span className="font-mono text-xs text-cyan-400 bg-slate-900 px-2 py-1 rounded">
                  {fmtTime(h.timestamp_sec)}
                </span>
                <span className="text-white flex-1 truncate">{h.note}</span>
                <Badge variant={h.outcome === 'winner' ? 'success' : h.outcome === 'error' ? 'danger' : 'info'}>
                  {h.outcome === 'winner' ? 'Ganador' : h.outcome === 'error' ? 'Error' : 'En juego'}
                </Badge>
                <ChevronRight size={14} className="text-slate-500" />
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  )
}

function MiniStat({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: string | number; color: string }) {
  return (
    <div className="rounded-lg border border-slate-700/50 bg-slate-800/40 p-3">
      <div className="flex items-center gap-2 text-slate-400 text-xs">
        <span style={{ color }}>{icon}</span>
        {label}
      </div>
      <p className="text-lg font-bold text-white mt-1">{value}</p>
    </div>
  )
}

function HeatmapMini({ data }: { data: Array<{ x: number; y: number; weight: number }> }) {
  const grid: number[][] = Array.from({ length: 6 }, () => Array(10).fill(0))
  for (const { x, y, weight } of data) {
    if (x >= 0 && x < 10 && y >= 0 && y < 6) grid[y][x] = weight
  }
  return (
    <div className="grid grid-cols-10 gap-1 aspect-[2/1] max-w-lg mx-auto bg-emerald-950/40 rounded-lg p-2 border border-emerald-900/50">
      {grid.flatMap((row, y) =>
        row.map((w, x) => (
          <div
            key={`${x}-${y}`}
            className="aspect-square rounded"
            style={{
              backgroundColor: `rgba(6, 182, 212, ${Math.min(0.9, w)})`,
            }}
          />
        ))
      )}
    </div>
  )
}

function fmtTime(sec: number): string {
  const m = Math.floor(sec / 60)
  const s = sec % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}
