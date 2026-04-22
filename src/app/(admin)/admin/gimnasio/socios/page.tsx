'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { KpiCard } from '@/components/ui/kpi-card'
import { useToast } from '@/components/ui/toast'
import { formatDate } from '@/lib/utils'
import { Users, UserCheck, UserX, Search, Loader2 } from 'lucide-react'

interface SocioRow {
  user_id: string
  full_name: string | null
  email: string | null
  phone: string | null
  avatar_url: string | null
  city: string | null
  is_player: boolean
  membership_plan: string | null
  membership_end: string | null
  membership_status: string | null
}

const PAGE_SIZE_OPTIONS = [15, 50, 100, 500, 1000, 99999] as const
const PAGE_SIZE_LABELS: Record<number, string> = { 15: '15', 50: '50', 100: '100', 500: '500', 1000: '1.000', 99999: 'Todos' }

export default function SociosGimPage() {
  const { toast } = useToast()
  const [rows, setRows] = useState<SocioRow[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'expired'>('all')
  const [pageSize, setPageSize] = useState(15)
  const [page, setPage] = useState(1)

  const load = useCallback(async () => {
    setLoading(true)
    const supabase = createClient()

    // 1) Miembros del club con flag is_gym_member
    const { data: members, error: memErr } = await supabase
      .from('nm_club_members')
      .select('user_id, is_player, is_gym_member')
      .eq('club_id', 1)
      .eq('is_gym_member', true)

    if (memErr) {
      toast('error', `Error: ${memErr.message}`)
      setLoading(false)
      return
    }

    if (!members || members.length === 0) {
      setRows([])
      setLoading(false)
      return
    }

    const userIds = members.map(m => m.user_id)

    // 2) Datos de los usuarios
    const { data: users } = await supabase
      .from('nm_users')
      .select('id, full_name, email, phone, avatar_url, city')
      .in('id', userIds)

    const userMap: Record<string, { full_name: string | null; email: string | null; phone: string | null; avatar_url: string | null; city: string | null }> = {}
    for (const u of users ?? []) userMap[u.id] = u

    // 3) Última membresía del gym (la más reciente por user)
    const { data: gyms } = await supabase
      .from('nm_gym_memberships')
      .select('user_id, plan, start_date, end_date, status')
      .in('user_id', userIds)
      .order('start_date', { ascending: false })

    const latestGym: Record<string, { plan: string | null; end_date: string | null; status: string | null }> = {}
    for (const g of gyms ?? []) {
      if (!latestGym[g.user_id]) {
        latestGym[g.user_id] = { plan: g.plan, end_date: g.end_date, status: g.status }
      }
    }

    // 4) Combinar
    const combined: SocioRow[] = members.map(m => ({
      user_id: m.user_id,
      full_name: userMap[m.user_id]?.full_name ?? null,
      email: userMap[m.user_id]?.email ?? null,
      phone: userMap[m.user_id]?.phone ?? null,
      avatar_url: userMap[m.user_id]?.avatar_url ?? null,
      city: userMap[m.user_id]?.city ?? null,
      is_player: m.is_player === true,
      membership_plan: latestGym[m.user_id]?.plan ?? null,
      membership_end: latestGym[m.user_id]?.end_date ?? null,
      membership_status: latestGym[m.user_id]?.status ?? null,
    }))

    setRows(combined)
    setLoading(false)
  }, [toast])

  useEffect(() => { load() }, [load])

  async function togglePlayer(userId: string, current: boolean) {
    const supabase = createClient()
    const { error } = await supabase
      .from('nm_club_members')
      .update({ is_player: !current })
      .eq('user_id', userId)
      .eq('club_id', 1)
    if (error) { toast('error', error.message); return }
    setRows(prev => prev.map(r => r.user_id === userId ? { ...r, is_player: !current } : r))
    toast('success', current ? 'Quitado de jugadores' : 'Habilitado como jugador')
  }

  async function removeGymMember(userId: string) {
    if (!confirm('¿Quitar este socio del gym?')) return
    const supabase = createClient()
    const { error } = await supabase
      .from('nm_club_members')
      .update({ is_gym_member: false })
      .eq('user_id', userId)
      .eq('club_id', 1)
    if (error) { toast('error', error.message); return }
    setRows(prev => prev.filter(r => r.user_id !== userId))
    toast('success', 'Quitado de socios del gym')
  }

  const today = useMemo(() => new Date().toISOString().slice(0, 10), [])

  const filtered = rows.filter(r => {
    const active = r.membership_status === 'active' && (!r.membership_end || r.membership_end >= today)
    if (filterStatus === 'active' && !active) return false
    if (filterStatus === 'expired' && active) return false
    if (search.trim()) {
      const q = search.toLowerCase()
      if (!(r.full_name ?? '').toLowerCase().includes(q)
        && !(r.email ?? '').toLowerCase().includes(q)
        && !(r.phone ?? '').includes(q)) return false
    }
    return true
  })

  useEffect(() => { setPage(1) }, [search, filterStatus, pageSize])

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize))
  const currentPage = Math.min(page, totalPages)
  const paged = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize)

  const stats = useMemo(() => ({
    total: rows.length,
    active: rows.filter(r => r.membership_status === 'active' && (!r.membership_end || r.membership_end >= today)).length,
    expired: rows.filter(r => !(r.membership_status === 'active' && (!r.membership_end || r.membership_end >= today))).length,
  }), [rows, today])

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Socios del gimnasio</h1>
        <p className="text-sm text-slate-400 mt-1">
          Socios con membresía del gym. Click en &quot;Ver ficha&quot; para datos físicos, objetivos, accesos y notas.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <KpiCard title="Total socios" value={stats.total} icon={<Users size={20} />} color="#06b6d4" />
        <KpiCard title="Activos" value={stats.active} icon={<UserCheck size={20} />} color="#10b981" />
        <KpiCard title="Vencidos" value={stats.expired} icon={<UserX size={20} />} color="#f59e0b" />
      </div>

      <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar por nombre, email o teléfono…"
            className="w-full rounded-lg border border-slate-600 bg-slate-800 pl-9 pr-3 py-2 text-sm text-white placeholder-slate-500"
          />
        </div>
        <select
          value={filterStatus}
          onChange={e => setFilterStatus(e.target.value as 'all' | 'active' | 'expired')}
          className="rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-white md:w-48"
        >
          <option value="all">Todos</option>
          <option value="active">Abono activo</option>
          <option value="expired">Vencido</option>
        </select>
        <select
          value={pageSize}
          onChange={e => setPageSize(parseInt(e.target.value))}
          className="rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-white"
          title="Filas por página"
        >
          {PAGE_SIZE_OPTIONS.map(n => (
            <option key={n} value={n}>{PAGE_SIZE_LABELS[n]} por página</option>
          ))}
        </select>
      </div>

      <div className="rounded-xl border border-slate-700/50 bg-slate-800/50 overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-slate-500 text-sm flex items-center justify-center gap-2">
            <Loader2 size={16} className="animate-spin" /> Cargando…
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center text-slate-500 text-sm">
            {rows.length === 0 ? 'No hay socios del gym cargados todavía.' : 'Sin resultados para la búsqueda.'}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-900/60">
                <tr className="text-left text-slate-400 text-xs uppercase tracking-wider">
                  <th className="px-4 py-3">Socio</th>
                  <th className="px-4 py-3">Email</th>
                  <th className="px-4 py-3">Teléfono</th>
                  <th className="px-4 py-3">Zona</th>
                  <th className="px-4 py-3">Abono</th>
                  <th className="px-4 py-3">Vence</th>
                  <th className="px-4 py-3">Estado</th>
                  <th className="px-4 py-3 text-center">Jugador</th>
                  <th className="px-4 py-3 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {paged.map(r => {
                  const active = r.membership_status === 'active' && (!r.membership_end || r.membership_end >= today)
                  return (
                    <tr key={r.user_id} className="hover:bg-slate-700/30">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="h-8 w-8 rounded-full bg-slate-700 flex items-center justify-center text-xs font-bold text-cyan-400 overflow-hidden">
                            {r.avatar_url ? (
                              /* eslint-disable-next-line @next/next/no-img-element */
                              <img src={r.avatar_url} alt="" className="w-full h-full object-cover" />
                            ) : (
                              <span>{(r.full_name ?? r.email ?? '?').charAt(0).toUpperCase()}</span>
                            )}
                          </div>
                          <span className="font-medium text-white">{r.full_name ?? '(sin nombre)'}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-slate-300">{r.email ?? '—'}</td>
                      <td className="px-4 py-3 text-slate-400">{r.phone ?? '—'}</td>
                      <td className="px-4 py-3 text-slate-400">{r.city ?? '—'}</td>
                      <td className="px-4 py-3 text-slate-300">{r.membership_plan ?? '—'}</td>
                      <td className="px-4 py-3 text-slate-400">{r.membership_end ? formatDate(r.membership_end) : '—'}</td>
                      <td className="px-4 py-3">
                        <Badge variant={active ? 'success' : 'danger'}>{active ? 'Activo' : 'Vencido'}</Badge>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <button
                          onClick={() => togglePlayer(r.user_id, r.is_player)}
                          className={`px-2 py-1 text-xs rounded transition-colors ${
                            r.is_player
                              ? 'bg-cyan-500/20 text-cyan-400 hover:bg-cyan-500/30'
                              : 'bg-slate-700 text-slate-400 hover:bg-slate-600'
                          }`}
                        >
                          {r.is_player ? '✓ Sí' : 'Habilitar'}
                        </button>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center gap-2 justify-end">
                          <Link
                            href={`/admin/gimnasio/socio/${r.user_id}`}
                            className="text-cyan-400 hover:text-cyan-300 text-xs font-medium"
                          >
                            Ver ficha →
                          </Link>
                          <button
                            onClick={() => removeGymMember(r.user_id)}
                            className="text-xs text-slate-500 hover:text-red-400 px-1"
                            title="Quitar del gym"
                          >
                            ✕
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        {filtered.length > 0 && (
          <div className="px-4 py-3 border-t border-slate-700/40 flex items-center justify-between flex-wrap gap-2">
            <span className="text-xs text-slate-500">
              Mostrando {(currentPage - 1) * pageSize + 1}–{Math.min(currentPage * pageSize, filtered.length)} de {filtered.length}
            </span>
            {totalPages > 1 && (
              <div className="flex items-center gap-1">
                <Button variant="ghost" onClick={() => setPage(Math.max(1, currentPage - 1))} disabled={currentPage === 1}>
                  ← Anterior
                </Button>
                <span className="text-xs text-slate-400 px-2">Página {currentPage} / {totalPages}</span>
                <Button variant="ghost" onClick={() => setPage(Math.min(totalPages, currentPage + 1))} disabled={currentPage === totalPages}>
                  Siguiente →
                </Button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
