'use client'

import { useState, useCallback, useEffect, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { KpiCard } from '@/components/ui/kpi-card'
import { formatDate } from '@/lib/utils'
import { Sparkles, Video, Trophy, Clock, AlertTriangle, Search } from 'lucide-react'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from 'recharts'

interface AdminAiVideo {
  id: string
  title: string
  status: 'pending' | 'processing' | 'completed' | 'failed'
  match_type: string
  court_side: string
  duration_seconds: number | null
  created_at: string
  user_id: string
  user?: { full_name: string | null; email: string }
  report?: { overall_score: number; shots_total: number; winners_count: number } | null
}

const STATUS_BADGE: Record<string, { color: 'success' | 'warning' | 'info' | 'danger'; label: string }> = {
  pending: { color: 'warning', label: 'Pendiente' },
  processing: { color: 'info', label: 'Procesando' },
  completed: { color: 'success', label: 'Completado' },
  failed: { color: 'danger', label: 'Error' },
}

export default function AdminAnalisisIAPage() {
  const [videos, setVideos] = useState<AdminAiVideo[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')

  const loadData = useCallback(async () => {
    setLoading(true)
    const supabase = createClient()

    const { data: rows } = await supabase
      .from('nm_ai_videos')
      .select('id, title, status, match_type, court_side, duration_seconds, created_at, user_id')
      .order('created_at', { ascending: false })
      .limit(500)

    if (!rows) { setLoading(false); return }

    const userIds = [...new Set(rows.map(r => r.user_id))]
    const videoIds = rows.map(r => r.id)

    const [{ data: users }, { data: reports }] = await Promise.all([
      supabase.from('nm_users').select('id, full_name, email').in('id', userIds),
      supabase.from('nm_ai_reports').select('video_id, overall_score, shots_total, winners_count').in('video_id', videoIds),
    ])

    const userMap: Record<string, { full_name: string | null; email: string }> = {}
    for (const u of users ?? []) userMap[u.id] = { full_name: u.full_name, email: u.email }

    const reportMap: Record<string, { overall_score: number; shots_total: number; winners_count: number }> = {}
    for (const r of reports ?? []) reportMap[r.video_id] = r

    setVideos(rows.map(r => ({ ...r, user: userMap[r.user_id], report: reportMap[r.id] ?? null })) as AdminAiVideo[])
    setLoading(false)
  }, [])

  useEffect(() => { loadData() }, [loadData])

  const filtered = useMemo(() => {
    return videos.filter(v => {
      if (statusFilter !== 'all' && v.status !== statusFilter) return false
      if (search) {
        const s = search.toLowerCase()
        const matchesTitle = v.title.toLowerCase().includes(s)
        const matchesUser = (v.user?.full_name ?? '').toLowerCase().includes(s) || (v.user?.email ?? '').toLowerCase().includes(s)
        if (!matchesTitle && !matchesUser) return false
      }
      return true
    })
  }, [videos, search, statusFilter])

  const stats = useMemo(() => {
    const completed = videos.filter(v => v.status === 'completed')
    const avgScore = completed.length
      ? Math.round(completed.reduce((s, v) => s + (v.report?.overall_score ?? 0), 0) / completed.length)
      : 0
    const today = new Date().toISOString().slice(0, 10)
    const todayCount = videos.filter(v => v.created_at.slice(0, 10) === today).length
    const failed = videos.filter(v => v.status === 'failed').length
    return { total: videos.length, completed: completed.length, avgScore, todayCount, failed }
  }, [videos])

  const chartData = useMemo(() => {
    const byDay: Record<string, number> = {}
    for (const v of videos) {
      const d = v.created_at.slice(0, 10)
      byDay[d] = (byDay[d] ?? 0) + 1
    }
    return Object.entries(byDay)
      .sort((a, b) => a[0].localeCompare(b[0]))
      .slice(-14)
      .map(([date, count]) => ({ date: date.slice(5), count }))
  }, [videos])

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <Sparkles size={24} className="text-cyan-400" />
          Análisis IA — Gestión
        </h1>
        <p className="text-sm text-slate-400 mt-1">
          Monitor de los análisis generados por los socios del club.
        </p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <KpiCard title="Total análisis" value={stats.total} icon={<Video size={20} />} color="#06b6d4" />
        <KpiCard title="Completados" value={stats.completed} icon={<Trophy size={20} />} color="#10b981" />
        <KpiCard title="Hoy" value={stats.todayCount} icon={<Clock size={20} />} color="#a855f7" />
        <KpiCard title="Score medio club" value={`${stats.avgScore}/100`} icon={<Sparkles size={20} />} color="#f59e0b" />
        <KpiCard title="Con error" value={stats.failed} icon={<AlertTriangle size={20} />} color="#ef4444" />
      </div>

      {/* Chart de volumen */}
      <Card className="p-4">
        <h2 className="text-sm font-semibold text-white mb-3">Análisis por día (últimos 14)</h2>
        {chartData.length === 0 ? (
          <p className="text-sm text-slate-500 py-8 text-center">Sin datos todavía.</p>
        ) : (
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={chartData}>
              <CartesianGrid stroke="#1e293b" strokeDasharray="3 3" />
              <XAxis dataKey="date" stroke="#64748b" fontSize={10} />
              <YAxis stroke="#64748b" fontSize={10} />
              <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid #334155' }} />
              <Bar dataKey="count" fill="#06b6d4" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </Card>

      {/* Filtros */}
      <div className="flex flex-col md:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar por título, jugador o email…"
            className="pl-9"
          />
        </div>
        <Select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
          options={[
            { value: 'all', label: 'Todos los estados' },
            { value: 'completed', label: 'Completados' },
            { value: 'processing', label: 'Procesando' },
            { value: 'pending', label: 'Pendientes' },
            { value: 'failed', label: 'Con error' },
          ]}
          className="md:w-48"
        />
      </div>

      {/* Tabla */}
      <Card className="p-0 overflow-hidden">
        {loading ? (
          <div className="py-12 text-center text-slate-500">Cargando…</div>
        ) : filtered.length === 0 ? (
          <div className="py-12 text-center text-slate-500">Sin resultados</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-900/60 border-b border-slate-700/50">
                <tr className="text-left text-xs uppercase tracking-wider text-slate-400">
                  <th className="px-4 py-3">Jugador</th>
                  <th className="px-4 py-3">Título</th>
                  <th className="px-4 py-3">Tipo</th>
                  <th className="px-4 py-3">Estado</th>
                  <th className="px-4 py-3 text-right">Score</th>
                  <th className="px-4 py-3 text-right">Golpes</th>
                  <th className="px-4 py-3 text-right">Fecha</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {filtered.map(v => {
                  const status = STATUS_BADGE[v.status]
                  return (
                    <tr key={v.id} className="hover:bg-slate-800/40">
                      <td className="px-4 py-3">
                        <p className="text-white font-medium">{v.user?.full_name ?? '—'}</p>
                        <p className="text-xs text-slate-500">{v.user?.email ?? ''}</p>
                      </td>
                      <td className="px-4 py-3 text-slate-300">{v.title}</td>
                      <td className="px-4 py-3">
                        <span className="text-xs text-slate-400 capitalize">{v.match_type}</span>
                        <span className="text-xs text-slate-600"> · </span>
                        <span className="text-xs text-slate-400 capitalize">{v.court_side}</span>
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={status.color}>{status.label}</Badge>
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-cyan-400">
                        {v.report ? `${v.report.overall_score}/100` : '—'}
                      </td>
                      <td className="px-4 py-3 text-right text-slate-300">
                        {v.report?.shots_total ?? '—'}
                      </td>
                      <td className="px-4 py-3 text-right text-slate-400 text-xs">
                        {formatDate(v.created_at)}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  )
}
