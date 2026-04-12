'use client'

import { KpiCard } from '@/components/ui/kpi-card'
import { Card } from '@/components/ui/card'
import { Calendar, Users, Banknote, Trophy, TrendingUp, Dumbbell } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useCallback, useEffect, useState } from 'react'
import { formatCurrency } from '@/lib/utils'

export default function AdminDashboardPage() {
  const [kpis, setKpis] = useState({
    bookingsToday: 0,
    revenueToday: 0,
    activeMembers: 0,
    activeTournaments: 0,
    activeLeagues: 0,
    gymMembers: 0,
  })

  const loadKpis = useCallback(async () => {
    const supabase = createClient()
    const today = new Date().toISOString().split('T')[0]

    const [bookings, cash, members, tournaments, leagues] = await Promise.all([
      supabase.from('nm_bookings').select('id', { count: 'exact', head: true }).eq('date', today).neq('status', 'cancelled'),
      supabase.from('nm_cash_register').select('amount').eq('date', today),
      supabase.from('nm_club_members').select('id', { count: 'exact', head: true }).eq('is_active', true),
      supabase.from('nm_tournaments').select('id', { count: 'exact', head: true }).in('status', ['registration', 'active']),
      supabase.from('nm_leagues').select('id', { count: 'exact', head: true }).in('status', ['registration', 'active']),
    ])

    const revenueToday = (cash.data || []).reduce((sum, r) => sum + (r.amount || 0), 0)

    setKpis({
      bookingsToday: bookings.count || 0,
      revenueToday,
      activeMembers: members.count || 0,
      activeTournaments: tournaments.count || 0,
      activeLeagues: leagues.count || 0,
      gymMembers: 0,
    })
  }, [])

  useEffect(() => {
    loadKpis()
  }, [loadKpis])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Dashboard Admin</h1>
        <p className="text-sm text-slate-400 mt-1">Nueva Marina Padel & Sport</p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        <KpiCard title="Reservas hoy" value={kpis.bookingsToday} icon={<Calendar size={20} />} />
        <KpiCard title="Ingresos hoy" value={formatCurrency(kpis.revenueToday)} icon={<Banknote size={20} />} color="#10b981" />
        <KpiCard title="Miembros activos" value={kpis.activeMembers} icon={<Users size={20} />} color="#8b5cf6" />
        <KpiCard title="Torneos activos" value={kpis.activeTournaments} icon={<Trophy size={20} />} color="#f59e0b" />
        <KpiCard title="Ligas activas" value={kpis.activeLeagues} icon={<TrendingUp size={20} />} color="#06b6d4" />
        <KpiCard title="Gym miembros" value={kpis.gymMembers} icon={<Dumbbell size={20} />} color="#ec4899" />
      </div>

      {/* Quick overview */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <h3 className="text-lg font-semibold text-white mb-4">Reservas de hoy</h3>
          <div className="text-center py-8">
            <Calendar size={40} className="mx-auto text-slate-600 mb-3" />
            <p className="text-sm text-slate-400">Las reservas apareceran aca</p>
          </div>
        </Card>

        <Card>
          <h3 className="text-lg font-semibold text-white mb-4">Caja del dia</h3>
          <div className="text-center py-8">
            <Banknote size={40} className="mx-auto text-slate-600 mb-3" />
            <p className="text-sm text-slate-400">Los movimientos apareceran aca</p>
          </div>
        </Card>
      </div>
    </div>
  )
}
