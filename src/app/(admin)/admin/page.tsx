'use client'

import { KpiCard } from '@/components/ui/kpi-card'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Calendar, Users, Banknote, Trophy, TrendingUp, Dumbbell,
  DoorOpen, Receipt, MessageSquare, Target, UserCog, AlertCircle, Clock,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useCallback, useEffect, useState } from 'react'
import { formatCurrency, formatDate } from '@/lib/utils'
import Link from 'next/link'

interface RecentBooking {
  id: number
  customer_name: string
  court_id: number
  start_time: string
  status: string
}
interface RecentCash {
  id: number
  concept: string | null
  amount: number
  type: string
  created_at: string
}
interface RecentAccess {
  id: number
  granted: boolean
  timestamp: string
  credential_type: string | null
  direction: string | null
  user?: { full_name: string | null; email: string } | null
}
interface OverdueInvoice {
  id: number
  invoice_number: string
  total: number
  due_date: string
  user?: { full_name: string | null; email: string } | null
}

export default function AdminDashboardPage() {
  const [loading, setLoading] = useState(true)
  const [kpis, setKpis] = useState({
    // Core
    bookingsToday: 0,
    revenueToday: 0,
    activeMembers: 0,
    activeTournaments: 0,
    activeLeagues: 0,
    gymMembers: 0,
    // Fase 2 — Acceso
    accessToday: 0,
    accessDenied: 0,
    // Fase 3 — Facturación
    activeSubscriptions: 0,
    overdueInvoices: 0,
    // Fase 4/5 — Comunidad / retos
    postsThisWeek: 0,
    activeChallenges: 0,
    // Fase 6 — Staff
    staffOnShift: 0,
  })
  const [recentBookings, setRecentBookings] = useState<RecentBooking[]>([])
  const [recentCash, setRecentCash] = useState<RecentCash[]>([])
  const [recentAccess, setRecentAccess] = useState<RecentAccess[]>([])
  const [overdueInvoices, setOverdueInvoices] = useState<OverdueInvoice[]>([])

  const loadKpis = useCallback(async () => {
    setLoading(true)
    const supabase = createClient()
    const today = new Date().toISOString().split('T')[0]
    const weekAgo = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString()
    const nowTime = new Date().toTimeString().slice(0, 5)
    const dayOfWeek = new Date().getDay()

    const [
      bookings, cash, members, tournaments, leagues, gymMembers,
      accessToday, accessDenied, activeSubs, overdue,
      postsWeek, activeChallenges, staffShifts,
      recentBook, recentCashMov, recentLogs, overdueList,
    ] = await Promise.all([
      supabase.from('nm_bookings').select('id', { count: 'exact', head: true }).eq('date', today).neq('status', 'cancelled'),
      supabase.from('nm_cash_register').select('amount').eq('date', today),
      supabase.from('nm_club_members').select('id', { count: 'exact', head: true }).eq('is_active', true),
      supabase.from('nm_tournaments').select('id', { count: 'exact', head: true }).in('status', ['registration', 'active']),
      supabase.from('nm_leagues').select('id', { count: 'exact', head: true }).in('status', ['registration', 'active']),
      supabase.from('nm_gym_memberships').select('id', { count: 'exact', head: true }).eq('status', 'active'),
      supabase.from('nm_access_logs').select('id', { count: 'exact', head: true }).gte('timestamp', `${today}T00:00:00`).eq('granted', true),
      supabase.from('nm_access_logs').select('id', { count: 'exact', head: true }).gte('timestamp', `${today}T00:00:00`).eq('granted', false),
      supabase.from('nm_subscriptions').select('id', { count: 'exact', head: true }).eq('status', 'active'),
      supabase.from('nm_invoices').select('id', { count: 'exact', head: true }).eq('status', 'pending').lt('due_date', today),
      supabase.from('nm_posts').select('id', { count: 'exact', head: true }).gte('created_at', weekAgo),
      supabase.from('nm_challenges').select('id', { count: 'exact', head: true }).eq('is_active', true).lte('start_date', today).gte('end_date', today),
      supabase.from('nm_staff_schedules').select('id', { count: 'exact', head: true }).eq('day_of_week', dayOfWeek).lte('start_time', nowTime).gte('end_time', nowTime).eq('is_active', true),
      supabase.from('nm_bookings').select('id, customer_name, court_id, start_time, status').eq('date', today).neq('status', 'cancelled').order('start_time').limit(5),
      supabase.from('nm_cash_register').select('id, concept, amount, type, created_at').eq('date', today).order('created_at', { ascending: false }).limit(5),
      supabase.from('nm_access_logs').select('id, granted, timestamp, credential_type, direction, user:nm_users(full_name, email)').order('timestamp', { ascending: false }).limit(6),
      supabase.from('nm_invoices').select('id, invoice_number, total, due_date, user:nm_users(full_name, email)').eq('status', 'pending').lt('due_date', today).order('due_date').limit(5),
    ])

    const revenueToday = (cash.data || []).reduce((sum, r) => sum + (r.amount || 0), 0)

    setKpis({
      bookingsToday: bookings.count || 0,
      revenueToday,
      activeMembers: members.count || 0,
      activeTournaments: tournaments.count || 0,
      activeLeagues: leagues.count || 0,
      gymMembers: gymMembers.count || 0,
      accessToday: accessToday.count || 0,
      accessDenied: accessDenied.count || 0,
      activeSubscriptions: activeSubs.count || 0,
      overdueInvoices: overdue.count || 0,
      postsThisWeek: postsWeek.count || 0,
      activeChallenges: activeChallenges.count || 0,
      staffOnShift: staffShifts.count || 0,
    })
    setRecentBookings((recentBook.data ?? []) as RecentBooking[])
    setRecentCash((recentCashMov.data ?? []) as RecentCash[])
    setRecentAccess((recentLogs.data ?? []) as unknown as RecentAccess[])
    setOverdueInvoices((overdueList.data ?? []) as unknown as OverdueInvoice[])
    setLoading(false)
  }, [])

  useEffect(() => {
    loadKpis()
  }, [loadKpis])

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Dashboard Admin</h1>
          <p className="text-sm text-slate-400 mt-1">Nueva Marina Pádel & Sport · {new Date().toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
        </div>
        {loading && <div className="text-xs text-slate-500">Cargando…</div>}
      </div>

      {/* KPIs core */}
      <div>
        <p className="text-xs font-medium text-slate-500 uppercase mb-2">Operación</p>
        <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
          <KpiCard title="Reservas hoy" value={kpis.bookingsToday} icon={<Calendar size={20} />} />
          <KpiCard title="Ingresos hoy" value={formatCurrency(kpis.revenueToday)} icon={<Banknote size={20} />} color="#10b981" />
          <KpiCard title="Miembros activos" value={kpis.activeMembers} icon={<Users size={20} />} color="#8b5cf6" />
          <KpiCard title="Torneos activos" value={kpis.activeTournaments} icon={<Trophy size={20} />} color="#f59e0b" />
          <KpiCard title="Ligas activas" value={kpis.activeLeagues} icon={<TrendingUp size={20} />} color="#06b6d4" />
          <KpiCard title="Gym miembros" value={kpis.gymMembers} icon={<Dumbbell size={20} />} color="#ec4899" />
        </div>
      </div>

      {/* KPIs fases nuevas */}
      <div>
        <p className="text-xs font-medium text-slate-500 uppercase mb-2">Acceso · Facturación · Comunidad · Staff</p>
        <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-7 gap-3">
          <KpiCard title="Accesos hoy" value={kpis.accessToday} icon={<DoorOpen size={20} />} color="#22c55e" />
          <KpiCard title="Denegados" value={kpis.accessDenied} icon={<AlertCircle size={20} />} color="#ef4444" />
          <KpiCard title="Suscripciones" value={kpis.activeSubscriptions} icon={<Receipt size={20} />} color="#06b6d4" />
          <KpiCard title="Facturas vencidas" value={kpis.overdueInvoices} icon={<AlertCircle size={20} />} color="#f59e0b" />
          <KpiCard title="Posts (7 días)" value={kpis.postsThisWeek} icon={<MessageSquare size={20} />} color="#8b5cf6" />
          <KpiCard title="Retos activos" value={kpis.activeChallenges} icon={<Target size={20} />} color="#ec4899" />
          <KpiCard title="Staff en turno" value={kpis.staffOnShift} icon={<UserCog size={20} />} color="#10b981" />
        </div>
      </div>

      {/* Widgets datos en vivo */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Reservas de hoy */}
        <Card>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-white flex items-center gap-2">
              <Calendar size={16} className="text-cyan-400" /> Reservas de hoy
            </h3>
            <Link href="/admin/reservas" className="text-xs text-cyan-400 hover:text-cyan-300">Ver todo →</Link>
          </div>
          {recentBookings.length === 0 ? (
            <p className="text-xs text-slate-500 text-center py-6">Sin reservas hoy</p>
          ) : (
            <div className="space-y-1.5">
              {recentBookings.map(b => (
                <div key={b.id} className="flex items-center justify-between bg-slate-800/40 rounded-lg px-3 py-2 text-xs">
                  <span className="text-white truncate flex-1">{b.customer_name}</span>
                  <span className="text-slate-400 mx-2">Pista {b.court_id}</span>
                  <span className="text-cyan-300 font-mono">{b.start_time.slice(0, 5)}</span>
                  <Badge variant={b.status === 'confirmed' ? 'success' : 'warning'} className="ml-2">{b.status}</Badge>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Caja del día */}
        <Card>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-white flex items-center gap-2">
              <Banknote size={16} className="text-emerald-400" /> Movimientos de caja
            </h3>
            <Link href="/admin/caja" className="text-xs text-cyan-400 hover:text-cyan-300">Ver todo →</Link>
          </div>
          {recentCash.length === 0 ? (
            <p className="text-xs text-slate-500 text-center py-6">Sin movimientos hoy</p>
          ) : (
            <div className="space-y-1.5">
              {recentCash.map(c => (
                <div key={c.id} className="flex items-center justify-between bg-slate-800/40 rounded-lg px-3 py-2 text-xs">
                  <span className="text-white truncate flex-1">{c.concept ?? c.type}</span>
                  <span className={`font-mono ${c.amount >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                    {c.amount >= 0 ? '+' : ''}{formatCurrency(c.amount)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Últimos accesos */}
        <Card>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-white flex items-center gap-2">
              <DoorOpen size={16} className="text-green-400" /> Últimos accesos
            </h3>
            <Link href="/admin/accesos" className="text-xs text-cyan-400 hover:text-cyan-300">Ver todo →</Link>
          </div>
          {recentAccess.length === 0 ? (
            <p className="text-xs text-slate-500 text-center py-6">Sin registros</p>
          ) : (
            <div className="space-y-1.5">
              {recentAccess.map(a => (
                <div key={a.id} className="flex items-center justify-between bg-slate-800/40 rounded-lg px-3 py-2 text-xs">
                  <span className="text-white truncate flex-1">{a.user?.full_name ?? a.user?.email ?? '(sin usuario)'}</span>
                  <span className="text-slate-500 mx-2 uppercase">{a.credential_type ?? '-'}</span>
                  <span className="text-slate-500 mx-2 flex items-center gap-1"><Clock size={10} />{new Date(a.timestamp).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}</span>
                  <Badge variant={a.granted ? 'success' : 'danger'}>{a.granted ? 'OK' : 'Denegado'}</Badge>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Facturas vencidas */}
        <Card>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-white flex items-center gap-2">
              <Receipt size={16} className="text-amber-400" /> Facturas vencidas
            </h3>
            <Link href="/admin/facturacion" className="text-xs text-cyan-400 hover:text-cyan-300">Ver todo →</Link>
          </div>
          {overdueInvoices.length === 0 ? (
            <p className="text-xs text-slate-500 text-center py-6">¡Sin vencidas!</p>
          ) : (
            <div className="space-y-1.5">
              {overdueInvoices.map(i => (
                <div key={i.id} className="flex items-center justify-between bg-slate-800/40 rounded-lg px-3 py-2 text-xs">
                  <span className="text-white truncate flex-1">{i.invoice_number}</span>
                  <span className="text-slate-400 mx-2 truncate max-w-[120px]">{i.user?.full_name ?? i.user?.email ?? '-'}</span>
                  <span className="text-red-400 mx-2">{formatDate(i.due_date)}</span>
                  <span className="text-amber-400 font-mono font-bold">{formatCurrency(i.total)}</span>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  )
}
