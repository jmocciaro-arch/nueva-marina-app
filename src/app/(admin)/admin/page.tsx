'use client'

import { KpiCard } from '@/components/ui/kpi-card'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Modal } from '@/components/ui/modal'
import { useToast } from '@/components/ui/toast'
import {
  Calendar, Users, Banknote, Trophy, TrendingUp, Dumbbell,
  DoorOpen, Receipt, MessageSquare, Target, UserCog, AlertCircle, Clock,
  Pencil, Save, X, Eye, EyeOff, ChevronUp, ChevronDown, RotateCcw,
  LayoutGrid, Plus, Palette, ShoppingBag, Shield, Award, Zap,
  BarChart3, Settings, Heart, ClipboardList, PackageOpen, CreditCard,
  CalendarClock, Swords, Search, Bike,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useAuth } from '@/lib/auth-context'
import { formatCurrency, formatDate } from '@/lib/utils'
import Link from 'next/link'

// ─── Types ───────────────────────────────────────────────────────────────────

interface RecentBooking { id: number; customer_name: string; court_id: number; start_time: string; status: string }
interface RecentCash { id: number; concept: string | null; amount: number; type: string; created_at: string }
interface RecentAccess { id: number; granted: boolean; timestamp: string; credential_type: string | null; direction: string | null; user?: { full_name: string | null; email: string } | null }
interface OverdueInvoice { id: number; invoice_number: string; total: number; due_date: string; user?: { full_name: string | null; email: string } | null }
interface StaffShift { id: number; user?: { full_name: string | null; email: string } | null; start_time: string; end_time: string }
interface TournamentRow { id: number; name: string; status: string; start_date: string }
interface LeagueRow { id: number; name: string; status: string }
interface LowStockProduct { id: number; name: string; stock: number; price: number }
interface PostRow { id: number; content: string; created_at: string; author?: { full_name: string | null } | null }
interface ChallengeRow { id: number; title: string; is_active: boolean; end_date: string }
interface GymCheckin { id: number; check_in_time: string; user?: { full_name: string | null; email: string } | null }
interface UpcomingEvent { id: number; customer_name: string; court_id: number; date: string; start_time: string }

interface WidgetConfig {
  id: string
  visible: boolean
  order: number
  size: 'sm' | 'md' | 'lg' | 'full'
}

interface DashTheme {
  accentColor: string
  columns: 2 | 3 | 4
  kpiColumns: 4 | 5 | 6 | 7
  compactKpis: boolean
  cardStyle: 'default' | 'glass' | 'bordered'
  showAnimations: boolean
}

// ─── KPI definitions ─────────────────────────────────────────────────────────

type KpiCategory = 'padel' | 'gym' | 'finanzas' | 'acceso' | 'tienda' | 'social' | 'staff'

interface KpiMeta {
  title: string
  icon: React.ReactNode
  color: string
  category: KpiCategory
}

const KPI_CATEGORIES: Record<KpiCategory, string> = {
  padel: 'Padel & Sport',
  gym: 'Gimnasio',
  finanzas: 'Finanzas',
  acceso: 'Acceso & Seguridad',
  tienda: 'Tienda',
  social: 'Social',
  staff: 'Staff',
}

const KPI_META: Record<string, KpiMeta> = {
  kpi_bookings_today:    { title: 'Reservas hoy',             icon: <Calendar size={20} />,      color: '#06b6d4', category: 'padel' },
  kpi_bookings_week:     { title: 'Reservas esta semana',     icon: <CalendarClock size={20} />, color: '#0ea5e9', category: 'padel' },
  kpi_court_occupancy:   { title: 'Ocupacion pistas (%)',     icon: <LayoutGrid size={20} />,    color: '#14b8a6', category: 'padel' },
  kpi_active_tournaments:{ title: 'Torneos activos',          icon: <Trophy size={20} />,        color: '#f59e0b', category: 'padel' },
  kpi_tournament_players:{ title: 'Jugadores en torneos',     icon: <Swords size={20} />,        color: '#eab308', category: 'padel' },
  kpi_active_leagues:    { title: 'Ligas activas',            icon: <TrendingUp size={20} />,    color: '#06b6d4', category: 'padel' },
  kpi_league_teams:      { title: 'Equipos en ligas',         icon: <Users size={20} />,         color: '#0891b2', category: 'padel' },
  kpi_gym_members:       { title: 'Membresías gym',           icon: <Dumbbell size={20} />,      color: '#ec4899', category: 'gym' },
  kpi_gym_checkins:      { title: 'Check-ins gym hoy',        icon: <DoorOpen size={20} />,      color: '#f472b6', category: 'gym' },
  kpi_training_plans:    { title: 'Planes entrenamiento',     icon: <ClipboardList size={20} />, color: '#a855f7', category: 'gym' },
  kpi_recovery_sessions: { title: 'Sesiones recuperacion hoy',icon: <Heart size={20} />,         color: '#f43f5e', category: 'gym' },
  kpi_revenue_today:     { title: 'Ingresos hoy',            icon: <Banknote size={20} />,      color: '#10b981', category: 'finanzas' },
  kpi_revenue_month:     { title: 'Ingresos del mes',        icon: <CreditCard size={20} />,    color: '#059669', category: 'finanzas' },
  kpi_active_subs:       { title: 'Suscripciones activas',   icon: <Receipt size={20} />,       color: '#06b6d4', category: 'finanzas' },
  kpi_overdue_invoices:  { title: 'Facturas vencidas',       icon: <AlertCircle size={20} />,   color: '#f59e0b', category: 'finanzas' },
  kpi_pending_closing:   { title: 'Cierre caja pendiente',   icon: <Banknote size={20} />,      color: '#ef4444', category: 'finanzas' },
  kpi_access_today:      { title: 'Accesos hoy',             icon: <DoorOpen size={20} />,      color: '#22c55e', category: 'acceso' },
  kpi_access_denied:     { title: 'Accesos denegados',       icon: <Shield size={20} />,        color: '#ef4444', category: 'acceso' },
  kpi_active_members:    { title: 'Miembros activos',        icon: <Users size={20} />,         color: '#8b5cf6', category: 'acceso' },
  kpi_sales_today:       { title: 'Ventas hoy',              icon: <ShoppingBag size={20} />,   color: '#f97316', category: 'tienda' },
  kpi_low_stock:         { title: 'Productos stock bajo',    icon: <PackageOpen size={20} />,   color: '#ef4444', category: 'tienda' },
  kpi_posts_week:        { title: 'Posts (7 dias)',           icon: <MessageSquare size={20} />, color: '#8b5cf6', category: 'social' },
  kpi_active_challenges: { title: 'Retos activos',           icon: <Target size={20} />,        color: '#ec4899', category: 'social' },
  kpi_challenge_participants: { title: 'Participantes retos',icon: <Award size={20} />,         color: '#d946ef', category: 'social' },
  kpi_staff_on_shift:    { title: 'Staff en turno',          icon: <UserCog size={20} />,       color: '#10b981', category: 'staff' },
  kpi_staff_hours:       { title: 'Horas staff hoy',         icon: <Clock size={20} />,         color: '#059669', category: 'staff' },
}

// ─── Live widget definitions ─────────────────────────────────────────────────

interface LiveMeta {
  title: string
  icon: React.ReactNode
  link: string
  color: string
  category: KpiCategory
}

const LIVE_META: Record<string, LiveMeta> = {
  live_bookings:       { title: 'Reservas de hoy',       icon: <Calendar size={16} />,      link: '/admin/reservas',       color: 'text-cyan-400',    category: 'padel' },
  live_cash:           { title: 'Movimientos de caja',   icon: <Banknote size={16} />,      link: '/admin/caja',           color: 'text-emerald-400', category: 'finanzas' },
  live_access:         { title: 'Ultimos accesos',       icon: <DoorOpen size={16} />,      link: '/admin/accesos',        color: 'text-green-400',   category: 'acceso' },
  live_invoices:       { title: 'Facturas vencidas',     icon: <Receipt size={16} />,       link: '/admin/facturacion',    color: 'text-amber-400',   category: 'finanzas' },
  live_staff:          { title: 'Staff activo ahora',    icon: <UserCog size={16} />,       link: '/admin/staff',          color: 'text-emerald-400', category: 'staff' },
  live_tournaments:    { title: 'Torneos en curso',      icon: <Trophy size={16} />,        link: '/admin/torneos',        color: 'text-amber-400',   category: 'padel' },
  live_leagues:        { title: 'Ligas activas',         icon: <TrendingUp size={16} />,    link: '/admin/ligas',          color: 'text-cyan-400',    category: 'padel' },
  live_low_stock:      { title: 'Productos stock bajo',  icon: <PackageOpen size={16} />,   link: '/admin/tienda',         color: 'text-red-400',     category: 'tienda' },
  live_posts:          { title: 'Posts recientes',       icon: <MessageSquare size={16} />, link: '/admin/comunidad',      color: 'text-violet-400',  category: 'social' },
  live_challenges:     { title: 'Retos en progreso',     icon: <Target size={16} />,        link: '/admin/retos',          color: 'text-pink-400',    category: 'social' },
  live_gym:            { title: 'Gym check-ins hoy',     icon: <Dumbbell size={16} />,      link: '/admin/gimnasio',       color: 'text-pink-400',    category: 'gym' },
  live_upcoming_events:{ title: 'Proximos eventos',      icon: <CalendarClock size={16} />, link: '/admin/reservas',       color: 'text-sky-400',     category: 'padel' },
}

// ─── Quick action definitions ────────────────────────────────────────────────

interface QaMeta {
  title: string
  icon: React.ReactNode
  href: string
  color: string
  bg: string
  category: KpiCategory
}

const QA_META: Record<string, QaMeta> = {
  qa_new_booking:  { title: 'Nueva reserva',    icon: <Calendar size={18} />,      href: '/admin/reservas',       color: 'text-cyan-400',    bg: 'bg-cyan-500/10',    category: 'padel' },
  qa_cash:         { title: 'Ver caja',          icon: <Banknote size={18} />,      href: '/admin/caja',           color: 'text-emerald-400', bg: 'bg-emerald-500/10', category: 'finanzas' },
  qa_new_tournament:{ title: 'Torneos',          icon: <Trophy size={18} />,        href: '/admin/torneos',        color: 'text-amber-400',   bg: 'bg-amber-500/10',   category: 'padel' },
  qa_leagues:      { title: 'Ligas',             icon: <TrendingUp size={18} />,    href: '/admin/ligas',          color: 'text-cyan-400',    bg: 'bg-cyan-500/10',    category: 'padel' },
  qa_access:       { title: 'Accesos',           icon: <DoorOpen size={18} />,      href: '/admin/accesos',        color: 'text-green-400',   bg: 'bg-green-500/10',   category: 'acceso' },
  qa_billing:      { title: 'Facturacion',       icon: <Receipt size={18} />,       href: '/admin/facturacion',    color: 'text-amber-400',   bg: 'bg-amber-500/10',   category: 'finanzas' },
  qa_shop:         { title: 'Tienda',            icon: <ShoppingBag size={18} />,   href: '/admin/tienda',         color: 'text-orange-400',  bg: 'bg-orange-500/10',  category: 'tienda' },
  qa_users:        { title: 'Usuarios',          icon: <Users size={18} />,         href: '/admin/usuarios',       color: 'text-violet-400',  bg: 'bg-violet-500/10',  category: 'acceso' },
  qa_staff:        { title: 'Staff',             icon: <UserCog size={18} />,       href: '/admin/staff',          color: 'text-emerald-400', bg: 'bg-emerald-500/10', category: 'staff' },
  qa_gym:          { title: 'Gimnasio',          icon: <Dumbbell size={18} />,      href: '/admin/gimnasio',       color: 'text-pink-400',    bg: 'bg-pink-500/10',    category: 'gym' },
  qa_training:     { title: 'Entrenamiento',     icon: <Bike size={18} />,          href: '/admin/entrenamiento',  color: 'text-purple-400',  bg: 'bg-purple-500/10',  category: 'gym' },
  qa_community:    { title: 'Comunidad',         icon: <MessageSquare size={18} />, href: '/admin/comunidad',      color: 'text-violet-400',  bg: 'bg-violet-500/10',  category: 'social' },
  qa_challenges:   { title: 'Retos',             icon: <Target size={18} />,        href: '/admin/retos',          color: 'text-pink-400',    bg: 'bg-pink-500/10',    category: 'social' },
  qa_reports:      { title: 'Reportes',          icon: <BarChart3 size={18} />,     href: '/admin/reportes',       color: 'text-sky-400',     bg: 'bg-sky-500/10',     category: 'padel' },
  qa_config:       { title: 'Configuracion',     icon: <Settings size={18} />,      href: '/admin/config',         color: 'text-slate-400',   bg: 'bg-slate-500/10',   category: 'staff' },
}

// ─── Default configs ─────────────────────────────────────────────────────────

const ALL_KPI_IDS = Object.keys(KPI_META)
const ALL_LIVE_IDS = Object.keys(LIVE_META)
const ALL_QA_IDS = Object.keys(QA_META)

const VISIBLE_KPI_DEFAULT = new Set([
  'kpi_bookings_today', 'kpi_revenue_today', 'kpi_active_members',
  'kpi_active_tournaments', 'kpi_gym_members', 'kpi_access_today', 'kpi_active_subs',
])
const VISIBLE_LIVE_DEFAULT = new Set(['live_bookings', 'live_cash', 'live_access', 'live_invoices'])
const VISIBLE_QA_DEFAULT = new Set(['qa_new_booking', 'qa_cash', 'qa_new_tournament', 'qa_access', 'qa_billing', 'qa_staff'])

function buildDefaults(ids: string[], visibleSet: Set<string>, baseOrder: number): WidgetConfig[] {
  return ids.map((id, i) => ({
    id,
    visible: visibleSet.has(id),
    order: baseOrder + i,
    size: 'sm' as const,
  }))
}

const DEFAULT_KPI_WIDGETS = buildDefaults(ALL_KPI_IDS, VISIBLE_KPI_DEFAULT, 1)
const DEFAULT_LIVE_WIDGETS = buildDefaults(ALL_LIVE_IDS, VISIBLE_LIVE_DEFAULT, 100)
const DEFAULT_QA_WIDGETS = buildDefaults(ALL_QA_IDS, VISIBLE_QA_DEFAULT, 200)

const ACCENT_COLORS = [
  { name: 'Cyan', value: '#06b6d4' },
  { name: 'Esmeralda', value: '#10b981' },
  { name: 'Ambar', value: '#f59e0b' },
  { name: 'Violeta', value: '#8b5cf6' },
  { name: 'Rosa', value: '#ec4899' },
  { name: 'Lima', value: '#84cc16' },
]

const DEFAULT_THEME: DashTheme = {
  accentColor: '#06b6d4',
  columns: 2,
  kpiColumns: 7,
  compactKpis: false,
  cardStyle: 'default',
  showAnimations: true,
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function AdminDashboardPage() {
  const { user } = useAuth()
  const { toast } = useToast()
  const [loading, setLoading] = useState(true)

  // ─── Dashboard config state ───────────────────────────────────────────────
  const [kpiWidgets, setKpiWidgets] = useState<WidgetConfig[]>(DEFAULT_KPI_WIDGETS)
  const [liveWidgets, setLiveWidgets] = useState<WidgetConfig[]>(DEFAULT_LIVE_WIDGETS)
  const [qaWidgets, setQaWidgets] = useState<WidgetConfig[]>(DEFAULT_QA_WIDGETS)
  const [dashTheme, setDashTheme] = useState<DashTheme>(DEFAULT_THEME)
  const [isEditing, setIsEditing] = useState(false)
  const [showThemeModal, setShowThemeModal] = useState(false)
  const [showGallery, setShowGallery] = useState(false)
  const [gallerySearch, setGallerySearch] = useState('')
  const [galleryTab, setGalleryTab] = useState<'kpi' | 'live' | 'qa'>('kpi')

  // Backup for cancel
  const [backupKpi, setBackupKpi] = useState<WidgetConfig[]>([])
  const [backupLive, setBackupLive] = useState<WidgetConfig[]>([])
  const [backupQa, setBackupQa] = useState<WidgetConfig[]>([])
  const [backupTheme, setBackupTheme] = useState<DashTheme>(DEFAULT_THEME)

  // ─── Data state ───────────────────────────────────────────────────────────
  const [kpis, setKpis] = useState({
    bookingsToday: 0, bookingsWeek: 0, courtOccupancy: 0,
    activeTournaments: 0, tournamentPlayers: 0, activeLeagues: 0, leagueTeams: 0,
    gymMembers: 0, gymCheckins: 0, trainingPlans: 0, recoverySessions: 0,
    revenueToday: 0, revenueMonth: 0, activeSubs: 0, overdueInvoices: 0, pendingClosing: 0,
    accessToday: 0, accessDenied: 0, activeMembers: 0,
    salesToday: 0, lowStock: 0,
    postsWeek: 0, activeChallenges: 0, challengeParticipants: 0,
    staffOnShift: 0, staffHours: 0,
  })

  const [recentBookings, setRecentBookings] = useState<RecentBooking[]>([])
  const [recentCash, setRecentCash] = useState<RecentCash[]>([])
  const [recentAccess, setRecentAccess] = useState<RecentAccess[]>([])
  const [overdueInvoices, setOverdueInvoices] = useState<OverdueInvoice[]>([])
  const [staffShifts, setStaffShifts] = useState<StaffShift[]>([])
  const [tournamentsLive, setTournamentsLive] = useState<TournamentRow[]>([])
  const [leaguesLive, setLeaguesLive] = useState<LeagueRow[]>([])
  const [lowStockProducts, setLowStockProducts] = useState<LowStockProduct[]>([])
  const [recentPosts, setRecentPosts] = useState<PostRow[]>([])
  const [challengesLive, setChallengesLive] = useState<ChallengeRow[]>([])
  const [gymCheckins, setGymCheckins] = useState<GymCheckin[]>([])
  const [upcomingEvents, setUpcomingEvents] = useState<UpcomingEvent[]>([])

  // ─── Load saved config ────────────────────────────────────────────────────
  useEffect(() => {
    if (!user) return
    const saved = localStorage.getItem(`dash-admin-${user.id}`)
    if (saved) {
      try {
        const parsed = JSON.parse(saved)
        if (parsed.kpiWidgets) setKpiWidgets(parsed.kpiWidgets)
        if (parsed.liveWidgets) setLiveWidgets(parsed.liveWidgets)
        if (parsed.qaWidgets) setQaWidgets(parsed.qaWidgets)
        if (parsed.theme) setDashTheme(parsed.theme)
      } catch { /* ignore corrupt */ }
    }
  }, [user])

  // ─── Data loading ─────────────────────────────────────────────────────────
  const loadKpis = useCallback(async () => {
    setLoading(true)
    const supabase = createClient()
    const today = new Date().toISOString().split('T')[0]
    const weekAgo = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString()
    const monthStart = today.slice(0, 8) + '01'
    const nowTime = new Date().toTimeString().slice(0, 5)
    const dayOfWeek = new Date().getDay()

    const [
      bookings, bookingsWeek, courts, totalCourts, tournaments, tournamentPlayers,
      leagues, leagueTeams, gymMembers, gymCheckinsCount,
      trainingPlans, recoverySessions,
      cashToday, cashMonth, activeSubs, overdue, pendingClosing,
      accessToday, accessDenied, activeMembers,
      salesToday, lowStockCount,
      postsWeek, activeChallenges, challengeParticipants,
      staffShiftsCount, staffHoursQ,
      // Live data
      recentBook, recentCashMov, recentLogs, overdueList,
      staffLive, tournamentsLiveQ, leaguesLiveQ, lowStockQ,
      postsQ, challengesQ, gymCheckinsQ, upcomingQ,
    ] = await Promise.all([
      // KPI counts
      supabase.from('nm_bookings').select('id', { count: 'exact', head: true }).eq('date', today).neq('status', 'cancelled'),
      supabase.from('nm_bookings').select('id', { count: 'exact', head: true }).gte('date', new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString().split('T')[0]).neq('status', 'cancelled'),
      supabase.from('nm_bookings').select('court_id', { count: 'exact', head: true }).eq('date', today).neq('status', 'cancelled'),
      supabase.from('nm_courts').select('id', { count: 'exact', head: true }).eq('is_active', true),
      supabase.from('nm_tournaments').select('id', { count: 'exact', head: true }).in('status', ['registration', 'active']),
      supabase.from('nm_tournament_players').select('id', { count: 'exact', head: true }),
      supabase.from('nm_leagues').select('id', { count: 'exact', head: true }).in('status', ['registration', 'active']),
      supabase.from('nm_league_teams').select('id', { count: 'exact', head: true }),
      supabase.from('nm_gym_memberships').select('id', { count: 'exact', head: true }).eq('status', 'active'),
      supabase.from('nm_gym_access_logs').select('id', { count: 'exact', head: true }).gte('check_in_time', `${today}T00:00:00`),
      supabase.from('nm_training_plans').select('id', { count: 'exact', head: true }).eq('is_active', true),
      supabase.from('nm_recovery_sessions').select('id', { count: 'exact', head: true }).eq('date', today),
      supabase.from('nm_cash_register').select('amount').eq('date', today),
      supabase.from('nm_cash_register').select('amount').gte('date', monthStart),
      supabase.from('nm_subscriptions').select('id', { count: 'exact', head: true }).eq('status', 'active'),
      supabase.from('nm_invoices').select('id', { count: 'exact', head: true }).eq('status', 'pending').lt('due_date', today),
      supabase.from('nm_cash_closings').select('id', { count: 'exact', head: true }).eq('date', today).eq('status', 'pending'),
      supabase.from('nm_access_logs').select('id', { count: 'exact', head: true }).gte('timestamp', `${today}T00:00:00`).eq('granted', true),
      supabase.from('nm_access_logs').select('id', { count: 'exact', head: true }).gte('timestamp', `${today}T00:00:00`).eq('granted', false),
      supabase.from('nm_club_members').select('id', { count: 'exact', head: true }).eq('is_active', true),
      supabase.from('nm_shop_orders').select('id', { count: 'exact', head: true }).gte('created_at', `${today}T00:00:00`),
      supabase.from('nm_products').select('id', { count: 'exact', head: true }).lt('stock', 5).eq('is_active', true),
      supabase.from('nm_posts').select('id', { count: 'exact', head: true }).gte('created_at', weekAgo),
      supabase.from('nm_challenges').select('id', { count: 'exact', head: true }).eq('is_active', true).lte('start_date', today).gte('end_date', today),
      supabase.from('nm_challenge_participants').select('id', { count: 'exact', head: true }),
      supabase.from('nm_staff_schedules').select('id', { count: 'exact', head: true }).eq('day_of_week', dayOfWeek).lte('start_time', nowTime).gte('end_time', nowTime).eq('is_active', true),
      supabase.from('nm_staff_schedules').select('start_time, end_time').eq('day_of_week', dayOfWeek).eq('is_active', true),
      // Live data queries
      supabase.from('nm_bookings').select('id, customer_name, court_id, start_time, status').eq('date', today).neq('status', 'cancelled').order('start_time').limit(5),
      supabase.from('nm_cash_register').select('id, concept, amount, type, created_at').eq('date', today).order('created_at', { ascending: false }).limit(5),
      supabase.from('nm_access_logs').select('id, granted, timestamp, credential_type, direction, user:nm_users(full_name, email)').order('timestamp', { ascending: false }).limit(6),
      supabase.from('nm_invoices').select('id, invoice_number, total, due_date, user:nm_users(full_name, email)').eq('status', 'pending').lt('due_date', today).order('due_date').limit(5),
      supabase.from('nm_staff_schedules').select('id, start_time, end_time, user:nm_users(full_name, email)').eq('day_of_week', dayOfWeek).lte('start_time', nowTime).gte('end_time', nowTime).eq('is_active', true).limit(5),
      supabase.from('nm_tournaments').select('id, name, status, start_date').in('status', ['registration', 'active']).limit(5),
      supabase.from('nm_leagues').select('id, name, status').in('status', ['registration', 'active']).limit(5),
      supabase.from('nm_products').select('id, name, stock, price').lt('stock', 5).eq('is_active', true).order('stock').limit(5),
      supabase.from('nm_posts').select('id, content, created_at, author:nm_users(full_name)').order('created_at', { ascending: false }).limit(5),
      supabase.from('nm_challenges').select('id, title, is_active, end_date').eq('is_active', true).limit(5),
      supabase.from('nm_gym_access_logs').select('id, check_in_time, user:nm_users(full_name, email)').gte('check_in_time', `${today}T00:00:00`).order('check_in_time', { ascending: false }).limit(5),
      supabase.from('nm_bookings').select('id, customer_name, court_id, date, start_time').gte('date', today).neq('status', 'cancelled').order('date').order('start_time').limit(5),
    ])

    const revenueToday = (cashToday.data || []).reduce((sum, r) => sum + (r.amount || 0), 0)
    const revenueMonth = (cashMonth.data || []).reduce((sum, r) => sum + (r.amount || 0), 0)

    // Staff hours: sum (end_time - start_time) for today
    let totalStaffHours = 0
    if (staffHoursQ.data) {
      for (const s of staffHoursQ.data) {
        const [sh, sm] = (s.start_time as string).split(':').map(Number)
        const [eh, em] = (s.end_time as string).split(':').map(Number)
        totalStaffHours += (eh * 60 + em - sh * 60 - sm) / 60
      }
    }

    // Occupancy: (bookings today / (courts * 14 slots)) * 100
    const nCourts = totalCourts.count || 1
    const occupancy = nCourts > 0 ? Math.round(((bookings.count || 0) / (nCourts * 14)) * 100) : 0

    setKpis({
      bookingsToday: bookings.count || 0,
      bookingsWeek: bookingsWeek.count || 0,
      courtOccupancy: occupancy,
      activeTournaments: tournaments.count || 0,
      tournamentPlayers: tournamentPlayers.count || 0,
      activeLeagues: leagues.count || 0,
      leagueTeams: leagueTeams.count || 0,
      gymMembers: gymMembers.count || 0,
      gymCheckins: gymCheckinsCount.count || 0,
      trainingPlans: trainingPlans.count || 0,
      recoverySessions: recoverySessions.count || 0,
      revenueToday,
      revenueMonth,
      activeSubs: activeSubs.count || 0,
      overdueInvoices: overdue.count || 0,
      pendingClosing: pendingClosing.count || 0,
      accessToday: accessToday.count || 0,
      accessDenied: accessDenied.count || 0,
      activeMembers: activeMembers.count || 0,
      salesToday: salesToday.count || 0,
      lowStock: lowStockCount.count || 0,
      postsWeek: postsWeek.count || 0,
      activeChallenges: activeChallenges.count || 0,
      challengeParticipants: challengeParticipants.count || 0,
      staffOnShift: staffShiftsCount.count || 0,
      staffHours: Math.round(totalStaffHours * 10) / 10,
    })

    setRecentBookings((recentBook.data ?? []) as RecentBooking[])
    setRecentCash((recentCashMov.data ?? []) as RecentCash[])
    setRecentAccess((recentLogs.data ?? []) as unknown as RecentAccess[])
    setOverdueInvoices((overdueList.data ?? []) as unknown as OverdueInvoice[])
    setStaffShifts((staffLive.data ?? []) as unknown as StaffShift[])
    setTournamentsLive((tournamentsLiveQ.data ?? []) as TournamentRow[])
    setLeaguesLive((leaguesLiveQ.data ?? []) as LeagueRow[])
    setLowStockProducts((lowStockQ.data ?? []) as LowStockProduct[])
    setRecentPosts((postsQ.data ?? []) as unknown as PostRow[])
    setChallengesLive((challengesQ.data ?? []) as ChallengeRow[])
    setGymCheckins((gymCheckinsQ.data ?? []) as unknown as GymCheckin[])
    setUpcomingEvents((upcomingQ.data ?? []) as UpcomingEvent[])

    setLoading(false)
  }, [])

  useEffect(() => { loadKpis() }, [loadKpis])

  // ─── Edit actions ─────────────────────────────────────────────────────────

  function startEditing() {
    setBackupKpi([...kpiWidgets])
    setBackupLive([...liveWidgets])
    setBackupQa([...qaWidgets])
    setBackupTheme({ ...dashTheme })
    setIsEditing(true)
  }

  function cancelEditing() {
    setKpiWidgets(backupKpi)
    setLiveWidgets(backupLive)
    setQaWidgets(backupQa)
    setDashTheme(backupTheme)
    setIsEditing(false)
  }

  function saveConfig() {
    if (!user) return
    const config = { kpiWidgets, liveWidgets, qaWidgets, theme: dashTheme }
    localStorage.setItem(`dash-admin-${user.id}`, JSON.stringify(config))
    const supabase = createClient()
    supabase.from('nm_dashboard_configs').upsert({
      user_id: user.id,
      club_id: 1,
      dashboard_type: 'admin',
      layout: [...kpiWidgets, ...liveWidgets, ...qaWidgets],
      theme: dashTheme,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id,dashboard_type' }).then(() => {})
    setIsEditing(false)
    toast('success', 'Dashboard guardado')
  }

  function resetToDefaults() {
    setKpiWidgets(DEFAULT_KPI_WIDGETS)
    setLiveWidgets(DEFAULT_LIVE_WIDGETS)
    setQaWidgets(DEFAULT_QA_WIDGETS)
    setDashTheme(DEFAULT_THEME)
    toast('info', 'Valores por defecto restaurados')
  }

  function moveWidget(list: WidgetConfig[], setList: React.Dispatch<React.SetStateAction<WidgetConfig[]>>, idx: number, direction: 'up' | 'down') {
    const newList = [...list]
    const targetIdx = direction === 'up' ? idx - 1 : idx + 1
    if (targetIdx < 0 || targetIdx >= newList.length) return
    const tmp = newList[idx].order
    newList[idx] = { ...newList[idx], order: newList[targetIdx].order }
    newList[targetIdx] = { ...newList[targetIdx], order: tmp }
    newList.sort((a, b) => a.order - b.order)
    setList(newList)
  }

  function toggleWidget(list: WidgetConfig[], setList: React.Dispatch<React.SetStateAction<WidgetConfig[]>>, idx: number) {
    const newList = [...list]
    newList[idx] = { ...newList[idx], visible: !newList[idx].visible }
    setList(newList)
  }

  // ─── KPI value map ────────────────────────────────────────────────────────

  const kpiValues: Record<string, string | number> = {
    kpi_bookings_today:    kpis.bookingsToday,
    kpi_bookings_week:     kpis.bookingsWeek,
    kpi_court_occupancy:   `${kpis.courtOccupancy}%`,
    kpi_active_tournaments: kpis.activeTournaments,
    kpi_tournament_players: kpis.tournamentPlayers,
    kpi_active_leagues:    kpis.activeLeagues,
    kpi_league_teams:      kpis.leagueTeams,
    kpi_gym_members:       kpis.gymMembers,
    kpi_gym_checkins:      kpis.gymCheckins,
    kpi_training_plans:    kpis.trainingPlans,
    kpi_recovery_sessions: kpis.recoverySessions,
    kpi_revenue_today:     formatCurrency(kpis.revenueToday),
    kpi_revenue_month:     formatCurrency(kpis.revenueMonth),
    kpi_active_subs:       kpis.activeSubs,
    kpi_overdue_invoices:  kpis.overdueInvoices,
    kpi_pending_closing:   kpis.pendingClosing,
    kpi_access_today:      kpis.accessToday,
    kpi_access_denied:     kpis.accessDenied,
    kpi_active_members:    kpis.activeMembers,
    kpi_sales_today:       kpis.salesToday,
    kpi_low_stock:         kpis.lowStock,
    kpi_posts_week:        kpis.postsWeek,
    kpi_active_challenges: kpis.activeChallenges,
    kpi_challenge_participants: kpis.challengeParticipants,
    kpi_staff_on_shift:    kpis.staffOnShift,
    kpi_staff_hours:       `${kpis.staffHours}h`,
  }

  // ─── Live widget renderer ─────────────────────────────────────────────────

  function renderLiveWidget(wid: string) {
    const meta = LIVE_META[wid]
    if (!meta) return null

    const header = (
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-white flex items-center gap-2">
          <span className={meta.color}>{meta.icon}</span> {meta.title}
        </h3>
        <Link href={meta.link} className="text-xs text-cyan-400 hover:text-cyan-300">Ver todo &rarr;</Link>
      </div>
    )

    const emptyMsg = (msg: string) => <p className="text-xs text-slate-500 text-center py-6">{msg}</p>

    switch (wid) {
      case 'live_bookings':
        return (
          <Card>
            {header}
            {recentBookings.length === 0 ? emptyMsg('Sin reservas hoy') : (
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
        )

      case 'live_cash':
        return (
          <Card>
            {header}
            {recentCash.length === 0 ? emptyMsg('Sin movimientos hoy') : (
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
        )

      case 'live_access':
        return (
          <Card>
            {header}
            {recentAccess.length === 0 ? emptyMsg('Sin registros') : (
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
        )

      case 'live_invoices':
        return (
          <Card>
            {header}
            {overdueInvoices.length === 0 ? emptyMsg('Sin vencidas!') : (
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
        )

      case 'live_staff':
        return (
          <Card>
            {header}
            {staffShifts.length === 0 ? emptyMsg('Nadie en turno') : (
              <div className="grid grid-cols-2 gap-2">
                {staffShifts.map(s => (
                  <div key={s.id} className="bg-slate-800/40 rounded-lg px-3 py-2 text-xs">
                    <p className="text-white font-medium truncate">{s.user?.full_name ?? s.user?.email ?? '-'}</p>
                    <p className="text-slate-500 font-mono">{s.start_time?.slice(0, 5)} - {s.end_time?.slice(0, 5)}</p>
                  </div>
                ))}
              </div>
            )}
          </Card>
        )

      case 'live_tournaments':
        return (
          <Card>
            {header}
            {tournamentsLive.length === 0 ? emptyMsg('Sin torneos activos') : (
              <div className="space-y-1.5">
                {tournamentsLive.map(t => (
                  <div key={t.id} className="flex items-center justify-between bg-slate-800/40 rounded-lg px-3 py-2 text-xs">
                    <span className="text-white truncate flex-1">{t.name}</span>
                    <Badge variant={t.status === 'active' ? 'success' : 'warning'}>{t.status}</Badge>
                  </div>
                ))}
              </div>
            )}
          </Card>
        )

      case 'live_leagues':
        return (
          <Card>
            {header}
            {leaguesLive.length === 0 ? emptyMsg('Sin ligas activas') : (
              <div className="space-y-1.5">
                {leaguesLive.map(l => (
                  <div key={l.id} className="flex items-center justify-between bg-slate-800/40 rounded-lg px-3 py-2 text-xs">
                    <span className="text-white truncate flex-1">{l.name}</span>
                    <Badge variant={l.status === 'active' ? 'success' : 'warning'}>{l.status}</Badge>
                  </div>
                ))}
              </div>
            )}
          </Card>
        )

      case 'live_low_stock':
        return (
          <Card>
            {header}
            {lowStockProducts.length === 0 ? emptyMsg('Stock OK') : (
              <div className="space-y-1.5">
                {lowStockProducts.map(p => (
                  <div key={p.id} className="flex items-center justify-between bg-slate-800/40 rounded-lg px-3 py-2 text-xs">
                    <span className="text-white truncate flex-1">{p.name}</span>
                    <span className="text-red-400 font-mono font-bold mx-2">{p.stock} uds</span>
                    <span className="text-slate-400">{formatCurrency(p.price)}</span>
                  </div>
                ))}
              </div>
            )}
          </Card>
        )

      case 'live_posts':
        return (
          <Card>
            {header}
            {recentPosts.length === 0 ? emptyMsg('Sin posts recientes') : (
              <div className="space-y-1.5">
                {recentPosts.map(p => (
                  <div key={p.id} className="bg-slate-800/40 rounded-lg px-3 py-2 text-xs">
                    <p className="text-white truncate">{p.content?.slice(0, 80)}{(p.content?.length ?? 0) > 80 ? '...' : ''}</p>
                    <p className="text-slate-500 mt-0.5">{p.author?.full_name ?? 'Anonimo'} · {formatDate(p.created_at)}</p>
                  </div>
                ))}
              </div>
            )}
          </Card>
        )

      case 'live_challenges':
        return (
          <Card>
            {header}
            {challengesLive.length === 0 ? emptyMsg('Sin retos activos') : (
              <div className="space-y-1.5">
                {challengesLive.map(c => (
                  <div key={c.id} className="flex items-center justify-between bg-slate-800/40 rounded-lg px-3 py-2 text-xs">
                    <span className="text-white truncate flex-1">{c.title}</span>
                    <span className="text-slate-500 text-[10px]">Hasta {formatDate(c.end_date)}</span>
                  </div>
                ))}
              </div>
            )}
          </Card>
        )

      case 'live_gym':
        return (
          <Card>
            {header}
            {gymCheckins.length === 0 ? emptyMsg('Sin check-ins hoy') : (
              <div className="space-y-1.5">
                {gymCheckins.map(g => (
                  <div key={g.id} className="flex items-center justify-between bg-slate-800/40 rounded-lg px-3 py-2 text-xs">
                    <span className="text-white truncate flex-1">{g.user?.full_name ?? g.user?.email ?? '-'}</span>
                    <span className="text-slate-500 font-mono">{new Date(g.check_in_time).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                ))}
              </div>
            )}
          </Card>
        )

      case 'live_upcoming_events':
        return (
          <Card>
            {header}
            {upcomingEvents.length === 0 ? emptyMsg('Sin eventos proximos') : (
              <div className="space-y-1.5">
                {upcomingEvents.map(e => (
                  <div key={e.id} className="flex items-center justify-between bg-slate-800/40 rounded-lg px-3 py-2 text-xs">
                    <span className="text-white truncate flex-1">{e.customer_name}</span>
                    <span className="text-slate-400 mx-2">P{e.court_id}</span>
                    <span className="text-cyan-300 font-mono">{e.date === new Date().toISOString().split('T')[0] ? '' : formatDate(e.date) + ' '}{e.start_time?.slice(0, 5)}</span>
                  </div>
                ))}
              </div>
            )}
          </Card>
        )

      default:
        return null
    }
  }

  // ─── Visible/hidden computed ──────────────────────────────────────────────

  const visibleKpis = useMemo(() => kpiWidgets.filter(w => w.visible).sort((a, b) => a.order - b.order), [kpiWidgets])
  const hiddenKpis = useMemo(() => kpiWidgets.filter(w => !w.visible), [kpiWidgets])
  const visibleLive = useMemo(() => liveWidgets.filter(w => w.visible).sort((a, b) => a.order - b.order), [liveWidgets])
  const hiddenLive = useMemo(() => liveWidgets.filter(w => !w.visible), [liveWidgets])
  const visibleQa = useMemo(() => qaWidgets.filter(w => w.visible).sort((a, b) => a.order - b.order), [qaWidgets])
  const hiddenQa = useMemo(() => qaWidgets.filter(w => !w.visible), [qaWidgets])

  const liveColsClass = dashTheme.columns === 4
    ? 'lg:grid-cols-4'
    : dashTheme.columns === 3
    ? 'lg:grid-cols-3'
    : 'lg:grid-cols-2'

  const kpiColsClass = dashTheme.kpiColumns === 7
    ? 'xl:grid-cols-7'
    : dashTheme.kpiColumns === 6
    ? 'xl:grid-cols-6'
    : dashTheme.kpiColumns === 5
    ? 'xl:grid-cols-5'
    : 'xl:grid-cols-4'

  const cardStyleClass = dashTheme.cardStyle === 'glass'
    ? 'backdrop-blur-lg bg-white/5'
    : dashTheme.cardStyle === 'bordered'
    ? 'border-2 border-slate-600'
    : ''

  const animClass = dashTheme.showAnimations ? 'transition-all duration-300' : ''

  // ─── Gallery modal helpers ────────────────────────────────────────────────

  function galleryItems() {
    const searchLower = gallerySearch.toLowerCase()

    if (galleryTab === 'kpi') {
      return kpiWidgets
        .filter(w => {
          const meta = KPI_META[w.id]
          if (!meta) return false
          if (!searchLower) return true
          return meta.title.toLowerCase().includes(searchLower) || KPI_CATEGORIES[meta.category].toLowerCase().includes(searchLower)
        })
        .map(w => ({ widget: w, meta: KPI_META[w.id], category: KPI_META[w.id]?.category }))
    }
    if (galleryTab === 'live') {
      return liveWidgets
        .filter(w => {
          const meta = LIVE_META[w.id]
          if (!meta) return false
          if (!searchLower) return true
          return meta.title.toLowerCase().includes(searchLower) || KPI_CATEGORIES[meta.category].toLowerCase().includes(searchLower)
        })
        .map(w => ({ widget: w, meta: LIVE_META[w.id], category: LIVE_META[w.id]?.category }))
    }
    return qaWidgets
      .filter(w => {
        const meta = QA_META[w.id]
        if (!meta) return false
        if (!searchLower) return true
        return meta.title.toLowerCase().includes(searchLower) || KPI_CATEGORIES[meta.category].toLowerCase().includes(searchLower)
      })
      .map(w => ({ widget: w, meta: QA_META[w.id], category: QA_META[w.id]?.category }))
  }

  function toggleGalleryWidget(wid: string) {
    if (galleryTab === 'kpi') {
      const idx = kpiWidgets.findIndex(w => w.id === wid)
      if (idx >= 0) toggleWidget(kpiWidgets, setKpiWidgets, idx)
    } else if (galleryTab === 'live') {
      const idx = liveWidgets.findIndex(w => w.id === wid)
      if (idx >= 0) toggleWidget(liveWidgets, setLiveWidgets, idx)
    } else {
      const idx = qaWidgets.findIndex(w => w.id === wid)
      if (idx >= 0) toggleWidget(qaWidgets, setQaWidgets, idx)
    }
  }

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className={`space-y-6 ${cardStyleClass}`}>
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-2xl font-bold text-white">Dashboard Admin</h1>
          <p className="text-sm text-slate-400 mt-1">
            Nueva Marina Padel & Sport &middot; {new Date().toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {loading && <span className="text-xs text-slate-500 animate-pulse">Cargando...</span>}
          {isEditing ? (
            <>
              <Button variant="ghost" onClick={() => setShowGallery(true)} className="text-xs gap-1.5">
                <Plus size={14} /> Agregar widget
              </Button>
              <Button variant="ghost" onClick={() => setShowThemeModal(true)} className="text-xs gap-1.5">
                <Palette size={14} /> Tema
              </Button>
              <Button variant="ghost" onClick={resetToDefaults} className="text-xs gap-1.5">
                <RotateCcw size={14} /> Restablecer
              </Button>
              <Button variant="ghost" onClick={cancelEditing} className="text-xs gap-1.5 text-red-400">
                <X size={14} /> Cancelar
              </Button>
              <Button onClick={saveConfig} className="text-xs gap-1.5">
                <Save size={14} /> Guardar
              </Button>
            </>
          ) : (
            <Button variant="ghost" onClick={startEditing} className="text-xs gap-1.5">
              <Pencil size={14} /> Personalizar
            </Button>
          )}
        </div>
      </div>

      {/* Editing indicator */}
      {isEditing && (
        <div className="rounded-xl bg-cyan-500/10 border border-cyan-500/20 px-4 py-3 text-sm text-cyan-400 flex items-center gap-2">
          <LayoutGrid size={16} />
          <span className="font-medium">Modo edicion</span>
          <span className="text-cyan-400/70">— Oculta, reordena o cambia el tema de tus widgets</span>
        </div>
      )}

      {/* ── Quick Actions ─────────────────────────────────────────────── */}
      {visibleQa.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-medium text-slate-500 uppercase">Acciones rapidas</p>
            {isEditing && hiddenQa.length > 0 && (
              <span className="text-[10px] text-slate-500">{hiddenQa.length} oculto(s)</span>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            {visibleQa.map((w, idx) => {
              const meta = QA_META[w.id]
              if (!meta) return null
              return (
                <div key={w.id} className="relative group">
                  <Link
                    href={meta.href}
                    className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl ${meta.bg} ${meta.color} text-sm font-medium hover:brightness-125 ${animClass}`}
                  >
                    {meta.icon}
                    {meta.title}
                  </Link>
                  {isEditing && (
                    <div className="absolute -top-1 -right-1 flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                      <button
                        onClick={() => moveWidget(qaWidgets, setQaWidgets, qaWidgets.indexOf(w), 'up')}
                        className="p-1 rounded bg-slate-700/90 text-slate-300 hover:text-white"
                      >
                        <ChevronUp size={12} />
                      </button>
                      <button
                        onClick={() => moveWidget(qaWidgets, setQaWidgets, qaWidgets.indexOf(w), 'down')}
                        className="p-1 rounded bg-slate-700/90 text-slate-300 hover:text-white"
                      >
                        <ChevronDown size={12} />
                      </button>
                      <button
                        onClick={() => toggleWidget(qaWidgets, setQaWidgets, qaWidgets.indexOf(w))}
                        className="p-1 rounded bg-red-500/20 text-red-400 hover:bg-red-500/30"
                      >
                        <EyeOff size={12} />
                      </button>
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {isEditing && hiddenQa.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-2">
              {hiddenQa.map(w => {
                const meta = QA_META[w.id]
                if (!meta) return null
                return (
                  <button
                    key={w.id}
                    onClick={() => toggleWidget(qaWidgets, setQaWidgets, qaWidgets.indexOf(w))}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800/50 border border-dashed border-slate-700 text-xs text-slate-500 hover:text-white hover:border-cyan-500/50 transition-colors"
                  >
                    <Plus size={12} /> {meta.title}
                  </button>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* ── KPIs ──────────────────────────────────────────────────────── */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs font-medium text-slate-500 uppercase">Indicadores</p>
          {isEditing && hiddenKpis.length > 0 && (
            <span className="text-[10px] text-slate-500">{hiddenKpis.length} oculto(s)</span>
          )}
        </div>
        <div className={`grid grid-cols-2 lg:grid-cols-4 ${kpiColsClass} gap-3`}>
          {visibleKpis.map((w, idx) => {
            const meta = KPI_META[w.id]
            if (!meta) return null
            return (
              <div key={w.id} className={`relative group ${animClass}`}>
                <KpiCard
                  title={meta.title}
                  value={kpiValues[w.id] ?? 0}
                  icon={meta.icon}
                  color={meta.color}
                />
                {isEditing && (
                  <div className="absolute inset-0 bg-slate-900/60 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1">
                    <button
                      onClick={() => moveWidget(kpiWidgets, setKpiWidgets, kpiWidgets.indexOf(w), 'up')}
                      className="p-1.5 rounded-lg bg-slate-700 text-slate-300 hover:bg-slate-600 hover:text-white"
                      title="Mover izquierda"
                    >
                      <ChevronUp size={14} />
                    </button>
                    <button
                      onClick={() => moveWidget(kpiWidgets, setKpiWidgets, kpiWidgets.indexOf(w), 'down')}
                      className="p-1.5 rounded-lg bg-slate-700 text-slate-300 hover:bg-slate-600 hover:text-white"
                      title="Mover derecha"
                    >
                      <ChevronDown size={14} />
                    </button>
                    <button
                      onClick={() => toggleWidget(kpiWidgets, setKpiWidgets, kpiWidgets.indexOf(w))}
                      className="p-1.5 rounded-lg bg-red-500/20 text-red-400 hover:bg-red-500/30"
                      title="Ocultar"
                    >
                      <EyeOff size={14} />
                    </button>
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {isEditing && hiddenKpis.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {hiddenKpis.map(w => {
              const meta = KPI_META[w.id]
              if (!meta) return null
              return (
                <button
                  key={w.id}
                  onClick={() => toggleWidget(kpiWidgets, setKpiWidgets, kpiWidgets.indexOf(w))}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800/50 border border-dashed border-slate-700 text-xs text-slate-500 hover:text-white hover:border-cyan-500/50 transition-colors"
                >
                  <Plus size={12} /> {meta.title}
                </button>
              )
            })}
          </div>
        )}
      </div>

      {/* ── Live Widgets ──────────────────────────────────────────────── */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs font-medium text-slate-500 uppercase">Datos en vivo</p>
          {isEditing && hiddenLive.length > 0 && (
            <span className="text-[10px] text-slate-500">{hiddenLive.length} oculto(s)</span>
          )}
        </div>
        <div className={`grid grid-cols-1 ${liveColsClass} gap-4`}>
          {visibleLive.map((w, idx) => (
            <div key={w.id} className={`relative group ${animClass}`}>
              {renderLiveWidget(w.id)}
              {isEditing && (
                <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                  <button
                    onClick={() => moveWidget(liveWidgets, setLiveWidgets, liveWidgets.indexOf(w), 'up')}
                    className="p-1.5 rounded-lg bg-slate-700/90 text-slate-300 hover:bg-slate-600 hover:text-white"
                  >
                    <ChevronUp size={14} />
                  </button>
                  <button
                    onClick={() => moveWidget(liveWidgets, setLiveWidgets, liveWidgets.indexOf(w), 'down')}
                    className="p-1.5 rounded-lg bg-slate-700/90 text-slate-300 hover:bg-slate-600 hover:text-white"
                  >
                    <ChevronDown size={14} />
                  </button>
                  <button
                    onClick={() => toggleWidget(liveWidgets, setLiveWidgets, liveWidgets.indexOf(w))}
                    className="p-1.5 rounded-lg bg-red-500/20 text-red-400 hover:bg-red-500/30"
                  >
                    <EyeOff size={14} />
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>

        {isEditing && hiddenLive.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {hiddenLive.map(w => {
              const meta = LIVE_META[w.id]
              if (!meta) return null
              return (
                <button
                  key={w.id}
                  onClick={() => toggleWidget(liveWidgets, setLiveWidgets, liveWidgets.indexOf(w))}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800/50 border border-dashed border-slate-700 text-xs text-slate-500 hover:text-white hover:border-cyan-500/50 transition-colors"
                >
                  <Plus size={12} /> {meta.title}
                </button>
              )
            })}
          </div>
        )}
      </div>

      {/* ── Theme Modal ───────────────────────────────────────────────── */}
      {showThemeModal && (
        <Modal open onClose={() => setShowThemeModal(false)} title="Tema del Dashboard" size="md">
          <div className="space-y-6">
            {/* Accent color */}
            <div>
              <p className="text-sm text-slate-300 font-medium mb-3">Color de acento</p>
              <div className="flex gap-3">
                {ACCENT_COLORS.map(c => (
                  <button
                    key={c.value}
                    onClick={() => setDashTheme(t => ({ ...t, accentColor: c.value }))}
                    className={`w-10 h-10 rounded-full border-2 transition-all ${
                      dashTheme.accentColor === c.value ? 'border-white scale-110' : 'border-transparent hover:border-slate-500'
                    }`}
                    style={{ backgroundColor: c.value }}
                    title={c.name}
                  />
                ))}
              </div>
            </div>

            {/* Live widget columns */}
            <div>
              <p className="text-sm text-slate-300 font-medium mb-3">Columnas widgets en vivo</p>
              <div className="flex gap-2">
                {([2, 3, 4] as const).map(n => (
                  <button
                    key={n}
                    onClick={() => setDashTheme(t => ({ ...t, columns: n }))}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                      dashTheme.columns === n
                        ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30'
                        : 'bg-slate-800 text-slate-400 border border-slate-700 hover:text-white'
                    }`}
                  >
                    {n} col
                  </button>
                ))}
              </div>
            </div>

            {/* KPI columns */}
            <div>
              <p className="text-sm text-slate-300 font-medium mb-3">Columnas KPIs</p>
              <div className="flex gap-2">
                {([4, 5, 6, 7] as const).map(n => (
                  <button
                    key={n}
                    onClick={() => setDashTheme(t => ({ ...t, kpiColumns: n }))}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                      dashTheme.kpiColumns === n
                        ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30'
                        : 'bg-slate-800 text-slate-400 border border-slate-700 hover:text-white'
                    }`}
                  >
                    {n} col
                  </button>
                ))}
              </div>
            </div>

            {/* Card style */}
            <div>
              <p className="text-sm text-slate-300 font-medium mb-3">Estilo de tarjetas</p>
              <div className="flex gap-2">
                {(['default', 'glass', 'bordered'] as const).map(s => (
                  <button
                    key={s}
                    onClick={() => setDashTheme(t => ({ ...t, cardStyle: s }))}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors capitalize ${
                      dashTheme.cardStyle === s
                        ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30'
                        : 'bg-slate-800 text-slate-400 border border-slate-700 hover:text-white'
                    }`}
                  >
                    {s === 'default' ? 'Default' : s === 'glass' ? 'Glass' : 'Bordered'}
                  </button>
                ))}
              </div>
            </div>

            {/* Compact KPIs */}
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-300 font-medium">KPIs compactos</p>
                <p className="text-xs text-slate-500">Reduce el tamano de los indicadores</p>
              </div>
              <button
                onClick={() => setDashTheme(t => ({ ...t, compactKpis: !t.compactKpis }))}
                className={`w-12 h-6 rounded-full transition-colors relative ${
                  dashTheme.compactKpis ? 'bg-cyan-500' : 'bg-slate-700'
                }`}
              >
                <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-transform ${
                  dashTheme.compactKpis ? 'translate-x-6' : 'translate-x-0.5'
                }`} />
              </button>
            </div>

            {/* Show animations */}
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-300 font-medium">Animaciones</p>
                <p className="text-xs text-slate-500">Transiciones suaves entre cambios</p>
              </div>
              <button
                onClick={() => setDashTheme(t => ({ ...t, showAnimations: !t.showAnimations }))}
                className={`w-12 h-6 rounded-full transition-colors relative ${
                  dashTheme.showAnimations ? 'bg-cyan-500' : 'bg-slate-700'
                }`}
              >
                <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-transform ${
                  dashTheme.showAnimations ? 'translate-x-6' : 'translate-x-0.5'
                }`} />
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* ── Widget Gallery Modal ──────────────────────────────────────── */}
      {showGallery && (
        <Modal open onClose={() => { setShowGallery(false); setGallerySearch('') }} title="Galeria de Widgets" size="lg">
          <div className="space-y-4">
            {/* Search */}
            <div className="relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                type="text"
                value={gallerySearch}
                onChange={e => setGallerySearch(e.target.value)}
                placeholder="Buscar widget..."
                className="w-full pl-10 pr-4 py-2.5 rounded-lg bg-slate-900/50 border border-slate-700 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-cyan-500/50"
              />
            </div>

            {/* Tabs */}
            <div className="flex gap-1 border-b border-slate-700 pb-0">
              {([
                { key: 'kpi' as const, label: 'KPIs', count: ALL_KPI_IDS.length },
                { key: 'live' as const, label: 'En vivo', count: ALL_LIVE_IDS.length },
                { key: 'qa' as const, label: 'Acciones', count: ALL_QA_IDS.length },
              ]).map(tab => (
                <button
                  key={tab.key}
                  onClick={() => setGalleryTab(tab.key)}
                  className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                    galleryTab === tab.key
                      ? 'text-cyan-400 border-cyan-400'
                      : 'text-slate-500 border-transparent hover:text-slate-300'
                  }`}
                >
                  {tab.label} ({tab.count})
                </button>
              ))}
            </div>

            {/* Items grouped by category */}
            {(() => {
              const items = galleryItems()
              const grouped = new Map<string, typeof items>()
              for (const item of items) {
                const cat = item.category ?? 'other'
                const catLabel = KPI_CATEGORIES[cat as KpiCategory] ?? cat
                if (!grouped.has(catLabel)) grouped.set(catLabel, [])
                grouped.get(catLabel)!.push(item)
              }

              return Array.from(grouped.entries()).map(([catLabel, catItems]) => (
                <div key={catLabel}>
                  <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-2">{catLabel}</p>
                  <div className="space-y-1">
                    {catItems.map(({ widget, meta }) => (
                      <div
                        key={widget.id}
                        className="flex items-center justify-between px-3 py-2 rounded-lg bg-slate-800/40 hover:bg-slate-800/60 transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <span className="text-slate-400">{meta.icon}</span>
                          <span className="text-sm text-white">{meta.title}</span>
                          <span className="text-[10px] text-slate-600 font-mono">{widget.id}</span>
                        </div>
                        <button
                          onClick={() => toggleGalleryWidget(widget.id)}
                          className={`w-10 h-5 rounded-full transition-colors relative ${
                            widget.visible ? 'bg-cyan-500' : 'bg-slate-700'
                          }`}
                        >
                          <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${
                            widget.visible ? 'translate-x-5' : 'translate-x-0.5'
                          }`} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              ))
            })()}
          </div>
        </Modal>
      )}
    </div>
  )
}
