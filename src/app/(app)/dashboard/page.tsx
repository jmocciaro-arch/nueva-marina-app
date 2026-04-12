'use client'

import { useAuth } from '@/lib/auth-context'
import { KpiCard } from '@/components/ui/kpi-card'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Calendar, Trophy, Medal, Swords, TrendingUp } from 'lucide-react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { useCallback, useEffect, useState } from 'react'

export default function DashboardPage() {
  const { user } = useAuth()
  const [stats, setStats] = useState({ bookings: 0, matches: 0, ranking: '-', winRate: 0 })

  const loadStats = useCallback(async () => {
    const supabase = createClient()
    if (!user) return

    const [bookingsRes, profileRes] = await Promise.all([
      supabase.from('nm_bookings').select('id', { count: 'exact', head: true }).eq('booked_by', user.id).eq('status', 'confirmed'),
      supabase.from('nm_player_profiles').select('*').eq('user_id', user.id).single(),
    ])

    setStats({
      bookings: bookingsRes.count || 0,
      matches: profileRes.data?.matches_played || 0,
      ranking: profileRes.data?.ranking_position ? `#${profileRes.data.ranking_position}` : '-',
      winRate: profileRes.data?.win_rate || 0,
    })
  }, [user])

  useEffect(() => {
    loadStats()
  }, [loadStats])

  const greeting = () => {
    const h = new Date().getHours()
    if (h < 12) return 'Buenos dias'
    if (h < 20) return 'Buenas tardes'
    return 'Buenas noches'
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">
          {greeting()}, {user?.first_name || user?.full_name?.split(' ')[0] || 'Jugador'}
        </h1>
        <p className="text-sm text-slate-400 mt-1">Bienvenido a Nueva Marina Padel & Sport</p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          title="Reservas activas"
          value={stats.bookings}
          icon={<Calendar size={20} />}
        />
        <KpiCard
          title="Partidos jugados"
          value={stats.matches}
          icon={<Swords size={20} />}
        />
        <KpiCard
          title="Ranking"
          value={stats.ranking}
          icon={<TrendingUp size={20} />}
        />
        <KpiCard
          title="Win Rate"
          value={`${stats.winRate}%`}
          icon={<Trophy size={20} />}
          color="#10b981"
        />
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card hover>
          <Link href="/mis-reservas" className="block">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-cyan-500/20 flex items-center justify-center">
                <Calendar size={20} className="text-cyan-400" />
              </div>
              <div>
                <p className="text-sm font-medium text-white">Reservar pista</p>
                <p className="text-xs text-slate-400">4 pistas disponibles</p>
              </div>
            </div>
          </Link>
        </Card>

        <Card hover>
          <Link href="/buscar-partido" className="block">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-green-500/20 flex items-center justify-center">
                <Swords size={20} className="text-green-400" />
              </div>
              <div>
                <p className="text-sm font-medium text-white">Buscar partido</p>
                <p className="text-xs text-slate-400">Encontra jugadores</p>
              </div>
            </div>
          </Link>
        </Card>

        <Card hover>
          <Link href="/mis-torneos" className="block">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-amber-500/20 flex items-center justify-center">
                <Trophy size={20} className="text-amber-400" />
              </div>
              <div>
                <p className="text-sm font-medium text-white">Torneos</p>
                <p className="text-xs text-slate-400">Ver proximos torneos</p>
              </div>
            </div>
          </Link>
        </Card>
      </div>

      {/* Upcoming bookings placeholder */}
      <Card>
        <h3 className="text-lg font-semibold text-white mb-4">Proximas reservas</h3>
        <div className="text-center py-8">
          <Calendar size={40} className="mx-auto text-slate-600 mb-3" />
          <p className="text-sm text-slate-400">No tenes reservas proximas</p>
          <Link href="/mis-reservas">
            <Button size="sm" className="mt-3">Reservar ahora</Button>
          </Link>
        </div>
      </Card>
    </div>
  )
}
