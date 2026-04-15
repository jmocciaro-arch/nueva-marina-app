'use client'

import { useState, useCallback, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card } from '@/components/ui/card'
import { KpiCard } from '@/components/ui/kpi-card'
import { Badge } from '@/components/ui/badge'
import { Select } from '@/components/ui/select'
import { formatCurrency } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  BarChart3,
  Banknote,
  CreditCard,
  ArrowRightLeft,
  Wallet,
  ShoppingBag,
  Trophy,
  Dumbbell,
  CalendarDays,
  Users,
  TrendingUp,
  Layout,
  Download,
} from 'lucide-react'

// ─── types ───────────────────────────────────────────────────────────────────

type Period = 'today' | 'week' | 'month' | 'last_month'

interface CashRow {
  type: string
  payment_method: string
  amount: number
}

interface BookingRow {
  booked_by: string | null
  court_id: number | null
  price: number | null
  nm_courts: { name: string } | null
  nm_users: { full_name: string | null; email: string } | null
}

interface PlayerStat {
  user_id: string
  name: string
  email: string
  bookings: number
  total_spent: number
}

interface CourtStat {
  court_id: number
  name: string
  bookings: number
  revenue: number
}

// ─── helpers ─────────────────────────────────────────────────────────────────

function getPeriodRange(period: Period): { from: string; to: string } {
  const now = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  const fmt = (d: Date) =>
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`

  if (period === 'today') {
    const t = fmt(now)
    return { from: t, to: t }
  }
  if (period === 'week') {
    const day = now.getDay() === 0 ? 6 : now.getDay() - 1
    const mon = new Date(now)
    mon.setDate(now.getDate() - day)
    return { from: fmt(mon), to: fmt(now) }
  }
  if (period === 'month') {
    const first = new Date(now.getFullYear(), now.getMonth(), 1)
    return { from: fmt(first), to: fmt(now) }
  }
  // last_month
  const first = new Date(now.getFullYear(), now.getMonth() - 1, 1)
  const last = new Date(now.getFullYear(), now.getMonth(), 0)
  return { from: fmt(first), to: fmt(last) }
}

const PERIOD_OPTIONS = [
  { value: 'today', label: 'Hoy' },
  { value: 'week', label: 'Esta semana' },
  { value: 'month', label: 'Este mes' },
  { value: 'last_month', label: 'Ultimo mes' },
]

const TYPE_META: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  booking:    { label: 'Reservas',   color: '#06b6d4', icon: <CalendarDays size={18} /> },
  shop:       { label: 'Tienda',     color: '#8b5cf6', icon: <ShoppingBag size={18} /> },
  tournament: { label: 'Torneos',    color: '#f59e0b', icon: <Trophy size={18} /> },
  gym:        { label: 'Gimnasio',   color: '#10b981', icon: <Dumbbell size={18} /> },
  league:     { label: 'Liga',       color: '#ec4899', icon: <BarChart3 size={18} /> },
  class:      { label: 'Clases',     color: '#3b82f6', icon: <Users size={18} /> },
  other:      { label: 'Otros',      color: '#6b7280', icon: <Banknote size={18} /> },
}

const METHOD_META: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  cash:     { label: 'Efectivo',       color: '#10b981', icon: <Wallet size={18} /> },
  card:     { label: 'Tarjeta',        color: '#06b6d4', icon: <CreditCard size={18} /> },
  transfer: { label: 'Transferencia',  color: '#8b5cf6', icon: <ArrowRightLeft size={18} /> },
  bizum:    { label: 'Bizum',          color: '#f59e0b', icon: <Banknote size={18} /> },
}

// ─── component ───────────────────────────────────────────────────────────────

export default function ReportesPage() {
  const [period, setPeriod] = useState<Period>('month')
  const [loading, setLoading] = useState(true)

  // cash data
  const [cashRows, setCashRows] = useState<CashRow[]>([])
  // booking data
  const [bookingRows, setBookingRows] = useState<BookingRow[]>([])
  // gym data
  const [gymMemberships, setGymMemberships] = useState(0)
  const [gymSessionsToday, setGymSessionsToday] = useState(0)
  // subscriptions data
  const [activeSubs, setActiveSubs] = useState(0)
  const [subsRevenue, setSubsRevenue] = useState(0)
  // leagues data
  const [activeLeagues, setActiveLeagues] = useState(0)
  const [totalTeams, setTotalTeams] = useState(0)

  // ── fetch ──────────────────────────────────────────────────────────────────

  const loadData = useCallback(async () => {
    setLoading(true)
    const supabase = createClient()
    const { from, to } = getPeriodRange(period)

    const today = new Date().toISOString().split('T')[0]

    const [cashRes, bookingsRes, gymMembRes, gymSessRes, subsRes, leaguesRes, teamsRes] = await Promise.all([
      supabase
        .from('nm_cash_register')
        .select('type, payment_method, amount')
        .eq('club_id', 1)
        .gte('date', from)
        .lte('date', to),
      supabase
        .from('nm_bookings')
        .select('booked_by, court_id, price, nm_courts(name), nm_users(full_name, email)')
        .eq('club_id', 1)
        .gte('date', from)
        .lte('date', to)
        .neq('status', 'cancelled'),
      supabase
        .from('nm_gym_memberships')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'active'),
      supabase
        .from('nm_gym_sessions')
        .select('id', { count: 'exact', head: true })
        .eq('date', today),
      supabase
        .from('nm_subscriptions')
        .select('id, nm_subscription_plans(price)')
        .eq('status', 'active'),
      supabase
        .from('nm_leagues')
        .select('id', { count: 'exact', head: true })
        .in('status', ['registration', 'active']),
      supabase
        .from('nm_league_teams')
        .select('id', { count: 'exact', head: true }),
    ])

    setCashRows((cashRes.data || []) as CashRow[])
    setBookingRows((bookingsRes.data || []) as unknown as BookingRow[])

    setGymMemberships(gymMembRes.count ?? 0)
    setGymSessionsToday(gymSessRes.count ?? 0)

    const subsData = (subsRes.data || []) as unknown as { id: number; nm_subscription_plans: { price: number } | { price: number }[] | null }[]
    setActiveSubs(subsData.length)
    const rev = subsData.reduce((sum: number, s) => {
      const plan = Array.isArray(s.nm_subscription_plans) ? s.nm_subscription_plans[0] : s.nm_subscription_plans
      return sum + (plan?.price ?? 0)
    }, 0)
    setSubsRevenue(rev)

    setActiveLeagues(leaguesRes.count ?? 0)
    setTotalTeams(teamsRes.count ?? 0)

    setLoading(false)
  }, [period])

  useEffect(() => {
    loadData()
  }, [loadData])

  // ── CSV export ─────────────────────────────────────────────────────────────

  function exportCSV() {
    const rows: string[][] = [
      ['Metrica', 'Valor'],
      ['Ingresos totales', String(totalRevenue)],
      ['Reservas', String(totalBookings)],
      ['Precio medio reserva', String(avgPrice.toFixed(2))],
      ['Pistas activas', String(uniqueCourts)],
      ['Socios gym activos', String(gymMemberships)],
      ['Sesiones gym hoy', String(gymSessionsToday)],
      ['Suscripciones activas', String(activeSubs)],
      ['Ingresos suscripciones', String(subsRevenue)],
      ['Ligas activas', String(activeLeagues)],
      ['Equipos en ligas', String(totalTeams)],
      [],
      ['Tipo', 'Ingresos'],
      ...Object.entries(revenueByType).map(([k, v]) => [TYPE_META[k]?.label ?? k, String(v)]),
      [],
      ['Metodo de pago', 'Ingresos'],
      ...Object.entries(revenueByMethod).map(([k, v]) => [METHOD_META[k]?.label ?? k, String(v)]),
      [],
      ['Jugador', 'Email', 'Reservas', 'Gasto total'],
      ...topPlayers.map(p => [p.name, p.email, String(p.bookings), String(p.total_spent)]),
    ]
    const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `reporte-${period}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  // ── derived data ───────────────────────────────────────────────────────────

  const incomeRows = cashRows.filter(r => r.amount > 0)

  // KPIs
  const totalRevenue = incomeRows.reduce((s, r) => s + r.amount, 0)
  const totalBookings = bookingRows.length
  const avgPrice = totalBookings > 0
    ? bookingRows.reduce((s, b) => s + (b.price ?? 0), 0) / totalBookings
    : 0

  // occupancy: booked slots / total possible slots in period
  // Simple approach: bookings / (courts * days * avg slots per day)
  // We show it as "X reservas" since we don't have real capacity without complex query
  const uniqueCourts = new Set(bookingRows.map(b => b.court_id).filter(Boolean)).size

  // Revenue by type
  const revenueByType = incomeRows.reduce<Record<string, number>>((acc, r) => {
    acc[r.type] = (acc[r.type] || 0) + r.amount
    return acc
  }, {})

  // Revenue by payment method
  const revenueByMethod = incomeRows.reduce<Record<string, number>>((acc, r) => {
    acc[r.payment_method] = (acc[r.payment_method] || 0) + r.amount
    return acc
  }, {})

  // Top players
  const playerMap = bookingRows.reduce<Record<string, PlayerStat>>((acc, b) => {
    if (!b.booked_by) return acc
    if (!acc[b.booked_by]) {
      acc[b.booked_by] = {
        user_id: b.booked_by,
        name: b.nm_users?.full_name || b.nm_users?.email || 'Jugador',
        email: b.nm_users?.email || '',
        bookings: 0,
        total_spent: 0,
      }
    }
    acc[b.booked_by].bookings += 1
    acc[b.booked_by].total_spent += b.price ?? 0
    return acc
  }, {})

  const topPlayers: PlayerStat[] = Object.values(playerMap)
    .sort((a, b) => b.bookings - a.bookings)
    .slice(0, 10)

  // Court utilization
  const courtMap = bookingRows.reduce<Record<number, CourtStat>>((acc, b) => {
    if (!b.court_id) return acc
    if (!acc[b.court_id]) {
      acc[b.court_id] = {
        court_id: b.court_id,
        name: b.nm_courts?.name || `Pista ${b.court_id}`,
        bookings: 0,
        revenue: 0,
      }
    }
    acc[b.court_id].bookings += 1
    acc[b.court_id].revenue += b.price ?? 0
    return acc
  }, {})

  const courtStats: CourtStat[] = Object.values(courtMap)
    .sort((a, b) => b.bookings - a.bookings)

  const maxCourtBookings = courtStats[0]?.bookings || 1

  // ── render ─────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Reportes y Analytics</h1>
          <p className="text-sm text-slate-400 mt-1">Estadisticas y metricas del club</p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            size="sm"
            variant="ghost"
            onClick={exportCSV}
            disabled={loading}
          >
            <Download size={14} />
            Exportar CSV
          </Button>
          <div className="w-48">
            <Select
              value={period}
              onChange={e => setPeriod(e.target.value as Period)}
              options={PERIOD_OPTIONS}
            />
          </div>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-20 text-slate-500">Cargando datos...</div>
      ) : (
        <>
          {/* ── KPIs ─────────────────────────────────────────────────────── */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <KpiCard
              title="Ingresos totales"
              value={formatCurrency(totalRevenue)}
              icon={<TrendingUp size={20} />}
              color="#10b981"
            />
            <KpiCard
              title="Reservas"
              value={totalBookings}
              icon={<CalendarDays size={20} />}
              color="#06b6d4"
            />
            <KpiCard
              title="Precio medio reserva"
              value={formatCurrency(avgPrice)}
              icon={<BarChart3 size={20} />}
              color="#8b5cf6"
            />
            <KpiCard
              title="Pistas activas"
              value={uniqueCourts}
              subtitle="con reservas en el periodo"
              icon={<Layout size={20} />}
              color="#f59e0b"
            />
          </div>

          {/* ── KPIs secundarios ─────────────────────────────────────────── */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <KpiCard
              title="Socios gym activos"
              value={gymMemberships}
              icon={<Dumbbell size={20} />}
              color="#10b981"
            />
            <KpiCard
              title="Sesiones gym hoy"
              value={gymSessionsToday}
              icon={<Users size={20} />}
              color="#06b6d4"
            />
            <KpiCard
              title="Suscripciones activas"
              value={activeSubs}
              subtitle={`${formatCurrency(subsRevenue)} / mes`}
              icon={<CreditCard size={20} />}
              color="#8b5cf6"
            />
            <KpiCard
              title="Ligas activas"
              value={activeLeagues}
              subtitle={`${totalTeams} equipos inscriptos`}
              icon={<Trophy size={20} />}
              color="#f59e0b"
            />
          </div>

          {/* ── Revenue by type ───────────────────────────────────────────── */}
          <section>
            <h2 className="text-base font-semibold text-white mb-3">Ingresos por tipo</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {['booking', 'shop', 'tournament', 'gym', 'league', 'class', 'other'].map(type => {
                const meta = TYPE_META[type]
                const amount = revenueByType[type] || 0
                return (
                  <Card key={type} className="flex items-center gap-3">
                    <div
                      className="rounded-lg p-2 shrink-0"
                      style={{ backgroundColor: `${meta.color}20`, color: meta.color }}
                    >
                      {meta.icon}
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs text-slate-400 truncate">{meta.label}</p>
                      <p className="text-base font-bold text-white tabular-nums">
                        {formatCurrency(amount)}
                      </p>
                    </div>
                  </Card>
                )
              })}
            </div>
          </section>

          {/* ── Revenue by payment method ─────────────────────────────────── */}
          <section>
            <h2 className="text-base font-semibold text-white mb-3">Ingresos por metodo de pago</h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {['cash', 'card', 'transfer', 'bizum'].map(method => {
                const meta = METHOD_META[method]
                const amount = revenueByMethod[method] || 0
                const pct = totalRevenue > 0 ? Math.round((amount / totalRevenue) * 100) : 0
                return (
                  <Card key={method}>
                    <div className="flex items-center gap-2 mb-2">
                      <div
                        className="rounded-lg p-1.5"
                        style={{ backgroundColor: `${meta.color}20`, color: meta.color }}
                      >
                        {meta.icon}
                      </div>
                      <span className="text-sm text-slate-400">{meta.label}</span>
                    </div>
                    <p className="text-xl font-bold text-white tabular-nums">
                      {formatCurrency(amount)}
                    </p>
                    {totalRevenue > 0 && (
                      <div className="mt-2">
                        <div className="flex justify-between text-xs text-slate-500 mb-1">
                          <span>{pct}%</span>
                        </div>
                        <div className="h-1.5 rounded-full bg-slate-700 overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all"
                            style={{ width: `${pct}%`, backgroundColor: meta.color }}
                          />
                        </div>
                      </div>
                    )}
                  </Card>
                )
              })}
            </div>
          </section>

          {/* ── Top players ───────────────────────────────────────────────── */}
          <section>
            <h2 className="text-base font-semibold text-white mb-3">Top jugadores</h2>
            <Card className="p-0 overflow-hidden">
              {topPlayers.length === 0 ? (
                <p className="text-center py-8 text-slate-500 text-sm">Sin datos para este periodo</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-slate-700">
                        <th className="text-left text-xs font-medium text-slate-400 px-5 py-3">#</th>
                        <th className="text-left text-xs font-medium text-slate-400 py-3">Jugador</th>
                        <th className="text-center text-xs font-medium text-slate-400 py-3">Reservas</th>
                        <th className="text-right text-xs font-medium text-slate-400 px-5 py-3">Gasto total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {topPlayers.map((p, i) => (
                        <tr key={p.user_id} className="border-b border-slate-800 hover:bg-slate-800/30">
                          <td className="px-5 py-3">
                            {i === 0 ? (
                              <span className="text-amber-400 font-bold text-sm">1°</span>
                            ) : (
                              <span className="text-slate-500 text-sm">{i + 1}</span>
                            )}
                          </td>
                          <td className="py-3">
                            <div>
                              <p className="text-sm font-medium text-white">{p.name}</p>
                              {p.email && p.name !== p.email && (
                                <p className="text-xs text-slate-500">{p.email}</p>
                              )}
                            </div>
                          </td>
                          <td className="py-3 text-center">
                            <Badge variant={i === 0 ? 'cyan' : 'default'}>
                              {p.bookings} {p.bookings === 1 ? 'reserva' : 'reservas'}
                            </Badge>
                          </td>
                          <td className="px-5 py-3 text-right text-sm font-semibold text-white tabular-nums">
                            {formatCurrency(p.total_spent)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
          </section>

          {/* ── Court utilization ─────────────────────────────────────────── */}
          <section>
            <h2 className="text-base font-semibold text-white mb-3">Utilizacion de pistas</h2>
            {courtStats.length === 0 ? (
              <Card>
                <p className="text-center py-4 text-slate-500 text-sm">Sin reservas para este periodo</p>
              </Card>
            ) : (
              <div className="space-y-3">
                {courtStats.map((c, i) => {
                  const pct = Math.round((c.bookings / maxCourtBookings) * 100)
                  const colors = ['#06b6d4', '#8b5cf6', '#f59e0b', '#10b981', '#ec4899', '#ef4444']
                  const color = colors[i % colors.length]
                  return (
                    <Card key={c.court_id} className="p-4">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <div
                            className="w-2 h-2 rounded-full"
                            style={{ backgroundColor: color }}
                          />
                          <span className="text-sm font-medium text-white">{c.name}</span>
                          {i === 0 && (
                            <Badge variant="cyan">Mas usada</Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-4">
                          <span className="text-xs text-slate-400">
                            {c.bookings} {c.bookings === 1 ? 'reserva' : 'reservas'}
                          </span>
                          <span className="text-sm font-semibold text-white tabular-nums">
                            {formatCurrency(c.revenue)}
                          </span>
                        </div>
                      </div>
                      <div className="h-2 rounded-full bg-slate-700 overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all"
                          style={{ width: `${pct}%`, backgroundColor: color }}
                        />
                      </div>
                    </Card>
                  )
                })}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  )
}
