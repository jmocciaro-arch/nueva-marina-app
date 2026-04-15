'use client'

import { useAuth } from '@/lib/auth-context'
import { KpiCard } from '@/components/ui/kpi-card'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Calendar, Trophy, Medal, Swords, TrendingUp, Target, CreditCard,
  QrCode, MessageSquare, ClipboardList, Clock, AlertCircle,
} from 'lucide-react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { useCallback, useEffect, useState } from 'react'
import { formatDate } from '@/lib/utils'

interface Booking { id: number; date: string; start_time: string; court_id: number; status: string }
interface Challenge { id: number; name: string; metric: string | null; target_value: number; current_value: number }
interface Subscription { id: number; status: string; current_period_end: string | null; plan?: { name: string; price: number } | null }

export default function DashboardPage() {
  const { user } = useAuth()
  const [stats, setStats] = useState({ bookings: 0, matches: 0, ranking: '-', winRate: 0 })
  const [loading, setLoading] = useState(true)
  const [upcomingBookings, setUpcomingBookings] = useState<Booking[]>([])
  const [myChallenges, setMyChallenges] = useState<Challenge[]>([])
  const [mySubscription, setMySubscription] = useState<Subscription | null>(null)
  const [fichaCompleted, setFichaCompleted] = useState<string | null>(null)
  const [pendingInvoices, setPendingInvoices] = useState(0)

  const loadStats = useCallback(async () => {
    const supabase = createClient()
    if (!user) return
    setLoading(true)
    const today = new Date().toISOString().split('T')[0]

    const [
      bookingsCount, profileRes, upcoming,
      subRes, challengesRes, userRes, pendingInv,
    ] = await Promise.all([
      supabase.from('nm_bookings').select('id', { count: 'exact', head: true }).eq('booked_by', user.id).eq('status', 'confirmed'),
      supabase.from('nm_player_profiles').select('*').eq('user_id', user.id).single(),
      supabase.from('nm_bookings').select('id, date, start_time, court_id, status').eq('booked_by', user.id).eq('status', 'confirmed').gte('date', today).order('date').order('start_time').limit(5),
      supabase.from('nm_subscriptions').select('id, status, current_period_end, plan:nm_subscription_plans(name, price)').eq('user_id', user.id).eq('status', 'active').maybeSingle(),
      supabase.from('nm_challenge_participants').select('current_value, completed, challenge:nm_challenges(id, name, metric, target_value, is_active, end_date)').eq('user_id', user.id).eq('completed', false).limit(5),
      supabase.from('nm_users').select('profile_completed_at').eq('id', user.id).single(),
      supabase.from('nm_invoices').select('id', { count: 'exact', head: true }).eq('user_id', user.id).eq('status', 'pending'),
    ])

    setStats({
      bookings: bookingsCount.count || 0,
      matches: profileRes.data?.matches_played || 0,
      ranking: profileRes.data?.ranking_position ? `#${profileRes.data.ranking_position}` : '-',
      winRate: profileRes.data?.win_rate || 0,
    })
    setUpcomingBookings((upcoming.data ?? []) as Booking[])
    setMySubscription(subRes.data as unknown as Subscription | null)
    setMyChallenges(
      ((challengesRes.data ?? []) as unknown as { current_value: number; challenge: { id: number; name: string; metric: string | null; target_value: number; is_active: boolean; end_date: string } | null }[])
        .filter(p => p.challenge?.is_active && p.challenge.end_date >= today)
        .map(p => ({
          id: p.challenge!.id,
          name: p.challenge!.name,
          metric: p.challenge!.metric,
          target_value: p.challenge!.target_value,
          current_value: p.current_value,
        }))
    )
    setFichaCompleted(userRes.data?.profile_completed_at ?? null)
    setPendingInvoices(pendingInv.count || 0)
    setLoading(false)
  }, [user])

  useEffect(() => {
    loadStats()
  }, [loadStats])

  const greeting = () => {
    const h = new Date().getHours()
    if (h < 12) return 'Buenos días'
    if (h < 20) return 'Buenas tardes'
    return 'Buenas noches'
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white">
            {greeting()}, {user?.first_name || user?.full_name?.split(' ')[0] || 'Jugador'}
          </h1>
          <p className="text-sm text-slate-400 mt-1">Bienvenido a Nueva Marina Pádel & Sport</p>
        </div>
        {loading && <div className="text-xs text-slate-500">Cargando…</div>}
      </div>

      {/* Alertas (ficha incompleta, facturas pendientes) */}
      {(!fichaCompleted || pendingInvoices > 0) && (
        <div className="space-y-2">
          {!fichaCompleted && (
            <Link href="/mi-ficha" className="block">
              <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-3 flex items-center gap-3 hover:bg-amber-500/15 transition-colors">
                <AlertCircle size={18} className="text-amber-400 shrink-0" />
                <div className="flex-1">
                  <p className="text-sm text-white font-medium">Tu ficha personal está incompleta</p>
                  <p className="text-xs text-amber-300">Completá tus datos y consentimiento GDPR → <span className="underline">Mi Ficha</span></p>
                </div>
              </div>
            </Link>
          )}
          {pendingInvoices > 0 && (
            <Link href="/mi-suscripcion" className="block">
              <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 flex items-center gap-3 hover:bg-red-500/15 transition-colors">
                <AlertCircle size={18} className="text-red-400 shrink-0" />
                <div className="flex-1">
                  <p className="text-sm text-white font-medium">Tenés {pendingInvoices} factura{pendingInvoices > 1 ? 's' : ''} pendiente{pendingInvoices > 1 ? 's' : ''}</p>
                  <p className="text-xs text-red-300">Revisalas en → <span className="underline">Mi Suscripción</span></p>
                </div>
              </div>
            </Link>
          )}
        </div>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard title="Reservas activas" value={stats.bookings} icon={<Calendar size={20} />} />
        <KpiCard title="Partidos jugados" value={stats.matches} icon={<Swords size={20} />} />
        <KpiCard title="Ranking" value={stats.ranking} icon={<TrendingUp size={20} />} color="#06b6d4" />
        <KpiCard title="Win Rate" value={`${stats.winRate}%`} icon={<Trophy size={20} />} color="#10b981" />
      </div>

      {/* Quick Actions — ampliado con mi-acceso y comunidad */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <QuickAction href="/mis-reservas" icon={<Calendar size={18} />} label="Reservar" color="cyan" />
        <QuickAction href="/buscar-partido" icon={<Swords size={18} />} label="Buscar partido" color="green" />
        <QuickAction href="/mi-acceso" icon={<QrCode size={18} />} label="Mi acceso" color="purple" />
        <QuickAction href="/mi-entrenamiento" icon={<ClipboardList size={18} />} label="Entrenamiento" color="pink" />
        <QuickAction href="/retos" icon={<Target size={18} />} label="Retos" color="amber" />
        <QuickAction href="/comunidad" icon={<MessageSquare size={18} />} label="Comunidad" color="indigo" />
      </div>

      {/* Widgets en vivo */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Próximas reservas */}
        <Card>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-white flex items-center gap-2">
              <Calendar size={16} className="text-cyan-400" /> Próximas reservas
            </h3>
            <Link href="/mis-reservas" className="text-xs text-cyan-400 hover:text-cyan-300">Ver todas →</Link>
          </div>
          {upcomingBookings.length === 0 ? (
            <div className="text-center py-6">
              <Calendar size={32} className="mx-auto text-slate-600 mb-2" />
              <p className="text-xs text-slate-400 mb-3">No tenés reservas próximas</p>
              <Link href="/mis-reservas"><Button size="sm">Reservar ahora</Button></Link>
            </div>
          ) : (
            <div className="space-y-1.5">
              {upcomingBookings.map(b => (
                <div key={b.id} className="flex items-center justify-between bg-slate-800/40 rounded-lg px-3 py-2 text-xs">
                  <span className="text-white">{formatDate(b.date)}</span>
                  <span className="text-cyan-300 font-mono mx-2">{b.start_time.slice(0, 5)}</span>
                  <Badge variant="info">Pista {b.court_id}</Badge>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Mi suscripción */}
        <Card>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-white flex items-center gap-2">
              <CreditCard size={16} className="text-emerald-400" /> Mi suscripción
            </h3>
            <Link href="/mi-suscripcion" className="text-xs text-cyan-400 hover:text-cyan-300">Detalles →</Link>
          </div>
          {mySubscription ? (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm text-white font-medium">{mySubscription.plan?.name ?? 'Plan activo'}</span>
                <Badge variant="success">Activa</Badge>
              </div>
              {mySubscription.plan?.price != null && (
                <p className="text-xs text-slate-400">€{mySubscription.plan.price} / mes</p>
              )}
              {mySubscription.current_period_end && (
                <p className="text-xs text-slate-500 flex items-center gap-1">
                  <Clock size={11} /> Renueva el {formatDate(mySubscription.current_period_end)}
                </p>
              )}
            </div>
          ) : (
            <div className="text-center py-6">
              <CreditCard size={32} className="mx-auto text-slate-600 mb-2" />
              <p className="text-xs text-slate-400 mb-3">No tenés una suscripción activa</p>
              <Link href="/mi-suscripcion"><Button size="sm">Ver planes</Button></Link>
            </div>
          )}
        </Card>

        {/* Mis retos */}
        <Card>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-white flex items-center gap-2">
              <Target size={16} className="text-pink-400" /> Mis retos
            </h3>
            <Link href="/retos" className="text-xs text-cyan-400 hover:text-cyan-300">Ver todos →</Link>
          </div>
          {myChallenges.length === 0 ? (
            <div className="text-center py-6">
              <Target size={32} className="mx-auto text-slate-600 mb-2" />
              <p className="text-xs text-slate-400 mb-3">No estás en ningún reto</p>
              <Link href="/retos"><Button size="sm">Descubrir retos</Button></Link>
            </div>
          ) : (
            <div className="space-y-2">
              {myChallenges.map(c => {
                const pct = c.target_value > 0 ? Math.min(100, Math.round((c.current_value / c.target_value) * 100)) : 0
                return (
                  <div key={c.id} className="bg-slate-800/40 rounded-lg px-3 py-2">
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="text-white truncate">{c.name}</span>
                      <span className="text-pink-300 font-mono">{c.current_value}/{c.target_value}</span>
                    </div>
                    <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden">
                      <div className="h-full bg-pink-500 transition-all" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </Card>

        {/* Accesos rápidos / info */}
        <Card>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-white flex items-center gap-2">
              <Medal size={16} className="text-amber-400" /> Tu perfil
            </h3>
            <Link href="/perfil" className="text-xs text-cyan-400 hover:text-cyan-300">Ver →</Link>
          </div>
          <div className="space-y-1.5 text-xs">
            <div className="flex items-center justify-between bg-slate-800/40 rounded-lg px-3 py-2">
              <span className="text-slate-300">Ficha GDPR</span>
              <Badge variant={fichaCompleted ? 'success' : 'warning'}>
                {fichaCompleted ? 'Completa' : 'Pendiente'}
              </Badge>
            </div>
            <div className="flex items-center justify-between bg-slate-800/40 rounded-lg px-3 py-2">
              <span className="text-slate-300">Suscripción</span>
              <Badge variant={mySubscription ? 'success' : 'warning'}>
                {mySubscription ? 'Activa' : 'Sin plan'}
              </Badge>
            </div>
            <div className="flex items-center justify-between bg-slate-800/40 rounded-lg px-3 py-2">
              <span className="text-slate-300">Facturas pendientes</span>
              <Badge variant={pendingInvoices === 0 ? 'success' : 'danger'}>
                {pendingInvoices}
              </Badge>
            </div>
          </div>
        </Card>
      </div>
    </div>
  )
}

function QuickAction({ href, icon, label, color }: { href: string; icon: React.ReactNode; label: string; color: 'cyan' | 'green' | 'amber' | 'purple' | 'pink' | 'indigo' }) {
  const colorMap = {
    cyan: 'bg-cyan-500/20 text-cyan-400',
    green: 'bg-green-500/20 text-green-400',
    amber: 'bg-amber-500/20 text-amber-400',
    purple: 'bg-purple-500/20 text-purple-400',
    pink: 'bg-pink-500/20 text-pink-400',
    indigo: 'bg-indigo-500/20 text-indigo-400',
  }
  return (
    <Link href={href}>
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 hover:border-slate-700 transition-colors">
        <div className={`w-10 h-10 rounded-lg ${colorMap[color]} flex items-center justify-center mb-2`}>
          {icon}
        </div>
        <p className="text-xs font-medium text-white">{label}</p>
      </div>
    </Link>
  )
}
