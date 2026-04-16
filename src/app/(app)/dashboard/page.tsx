'use client'

import { useAuth } from '@/lib/auth-context'
import { KpiCard } from '@/components/ui/kpi-card'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Modal } from '@/components/ui/modal'
import { useToast } from '@/components/ui/toast'
import {
  Calendar, Trophy, Medal, Swords, TrendingUp, Target, CreditCard,
  QrCode, MessageSquare, ClipboardList, Clock, AlertCircle,
  Pencil, Save, X, EyeOff, Plus, ChevronUp, ChevronDown, RotateCcw, Palette,
  Dumbbell, Heart, ShoppingBag, UserCircle, Award, Users, BarChart3,
  Search, Layers, Eye, LayoutGrid, Columns2,
} from 'lucide-react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { useCallback, useEffect, useState, useMemo } from 'react'
import { formatDate } from '@/lib/utils'

// ─── Widget config types ─────────────────────────────────────────────────────

interface WidgetVis { id: string; visible: boolean; order: number }

// ─── Theme config ────────────────────────────────────────────────────────────

type AccentColor = 'cyan' | 'emerald' | 'amber' | 'violet' | 'pink' | 'lime'
type CardStyle = 'default' | 'glass' | 'bordered'

interface ThemeConfig {
  accent: AccentColor
  liveColumns: 1 | 2
  kpiColumns: 2 | 3 | 4
  compactKpis: boolean
  cardStyle: CardStyle
}

const DEFAULT_THEME: ThemeConfig = {
  accent: 'cyan',
  liveColumns: 2,
  kpiColumns: 4,
  compactKpis: false,
  cardStyle: 'default',
}

const ACCENT_COLORS: { key: AccentColor; label: string; tw: string; hex: string }[] = [
  { key: 'cyan', label: 'Cian', tw: 'bg-cyan-500', hex: '#06b6d4' },
  { key: 'emerald', label: 'Esmeralda', tw: 'bg-emerald-500', hex: '#10b981' },
  { key: 'amber', label: 'Ambar', tw: 'bg-amber-500', hex: '#f59e0b' },
  { key: 'violet', label: 'Violeta', tw: 'bg-violet-500', hex: '#8b5cf6' },
  { key: 'pink', label: 'Rosa', tw: 'bg-pink-500', hex: '#ec4899' },
  { key: 'lime', label: 'Lima', tw: 'bg-lime-500', hex: '#84cc16' },
]

// ─── KPI definitions ─────────────────────────────────────────────────────────

interface KpiDef {
  id: string
  title: string
  icon: React.ReactNode
  color: string
  category: string
  getValue: (s: DashStats) => string | number
}

const KPI_DEFS: KpiDef[] = [
  // Padel
  { id: 'kpi_active_bookings', title: 'Reservas activas', icon: <Calendar size={20} />, color: '#06b6d4', category: 'Padel', getValue: s => s.bookings },
  { id: 'kpi_matches_played', title: 'Partidos jugados', icon: <Swords size={20} />, color: '#06b6d4', category: 'Padel', getValue: s => s.matches },
  { id: 'kpi_ranking', title: 'Ranking', icon: <TrendingUp size={20} />, color: '#06b6d4', category: 'Padel', getValue: s => s.ranking },
  { id: 'kpi_win_rate', title: 'Win Rate', icon: <Trophy size={20} />, color: '#10b981', category: 'Padel', getValue: s => `${s.winRate}%` },
  { id: 'kpi_next_match', title: 'Proximo partido', icon: <Clock size={20} />, color: '#06b6d4', category: 'Padel', getValue: s => s.nextMatch || '-' },
  // Torneos & Ligas
  { id: 'kpi_active_tournaments', title: 'Torneos activos', icon: <Trophy size={20} />, color: '#f59e0b', category: 'Torneos & Ligas', getValue: s => s.activeTournaments },
  { id: 'kpi_active_leagues', title: 'Ligas activas', icon: <Award size={20} />, color: '#f59e0b', category: 'Torneos & Ligas', getValue: s => s.activeLeagues },
  { id: 'kpi_tournament_wins', title: 'Victorias torneos', icon: <Medal size={20} />, color: '#f59e0b', category: 'Torneos & Ligas', getValue: s => s.tournamentWins },
  { id: 'kpi_league_position', title: 'Mejor pos. liga', icon: <BarChart3 size={20} />, color: '#f59e0b', category: 'Torneos & Ligas', getValue: s => s.leaguePosition ? `#${s.leaguePosition}` : '-' },
  // Gym & Wellness
  { id: 'kpi_gym_days_month', title: 'Dias gym (mes)', icon: <Dumbbell size={20} />, color: '#ec4899', category: 'Gym & Wellness', getValue: s => s.gymDays },
  { id: 'kpi_training_progress', title: 'Progreso entreno', icon: <ClipboardList size={20} />, color: '#ec4899', category: 'Gym & Wellness', getValue: s => `${s.trainingProgress}%` },
  { id: 'kpi_recovery_sessions', title: 'Sesiones recup.', icon: <Heart size={20} />, color: '#ec4899', category: 'Gym & Wellness', getValue: s => s.recoverySessions },
  // Social
  { id: 'kpi_challenges_active', title: 'Retos activos', icon: <Target size={20} />, color: '#8b5cf6', category: 'Social', getValue: s => s.challengesActive },
  { id: 'kpi_challenges_completed', title: 'Retos completados', icon: <Target size={20} />, color: '#8b5cf6', category: 'Social', getValue: s => s.challengesCompleted },
  { id: 'kpi_badges_earned', title: 'Badges obtenidos', icon: <Award size={20} />, color: '#8b5cf6', category: 'Social', getValue: s => s.badgesEarned },
  { id: 'kpi_community_posts', title: 'Mis posts', icon: <MessageSquare size={20} />, color: '#8b5cf6', category: 'Social', getValue: s => s.communityPosts },
]

const DEFAULT_KPIS: WidgetVis[] = [
  { id: 'kpi_active_bookings', visible: true, order: 1 },
  { id: 'kpi_matches_played', visible: true, order: 2 },
  { id: 'kpi_ranking', visible: true, order: 3 },
  { id: 'kpi_win_rate', visible: true, order: 4 },
  { id: 'kpi_next_match', visible: false, order: 5 },
  { id: 'kpi_active_tournaments', visible: false, order: 6 },
  { id: 'kpi_active_leagues', visible: false, order: 7 },
  { id: 'kpi_tournament_wins', visible: false, order: 8 },
  { id: 'kpi_league_position', visible: false, order: 9 },
  { id: 'kpi_gym_days_month', visible: false, order: 10 },
  { id: 'kpi_training_progress', visible: false, order: 11 },
  { id: 'kpi_recovery_sessions', visible: false, order: 12 },
  { id: 'kpi_challenges_active', visible: false, order: 13 },
  { id: 'kpi_challenges_completed', visible: false, order: 14 },
  { id: 'kpi_badges_earned', visible: false, order: 15 },
  { id: 'kpi_community_posts', visible: false, order: 16 },
]

// ─── Quick Action definitions ────────────────────────────────────────────────

const QA_META: Record<string, { href: string; icon: React.ReactNode; label: string; color: 'cyan' | 'green' | 'amber' | 'purple' | 'pink' | 'indigo'; category: string }> = {
  qa_reservar: { href: '/mis-reservas', icon: <Calendar size={18} />, label: 'Reservar', color: 'cyan', category: 'Padel' },
  qa_buscar: { href: '/buscar-partido', icon: <Swords size={18} />, label: 'Buscar partido', color: 'green', category: 'Padel' },
  qa_acceso: { href: '/mi-acceso', icon: <QrCode size={18} />, label: 'Mi acceso', color: 'purple', category: 'General' },
  qa_entrenamiento: { href: '/mi-entrenamiento', icon: <ClipboardList size={18} />, label: 'Entrenamiento', color: 'pink', category: 'Gym & Wellness' },
  qa_retos: { href: '/retos', icon: <Target size={18} />, label: 'Retos', color: 'amber', category: 'Social' },
  qa_comunidad: { href: '/comunidad', icon: <MessageSquare size={18} />, label: 'Comunidad', color: 'indigo', category: 'Social' },
  qa_torneos: { href: '/mis-torneos', icon: <Trophy size={18} />, label: 'Mis Torneos', color: 'amber', category: 'Torneos & Ligas' },
  qa_ligas: { href: '/mis-ligas', icon: <Award size={18} />, label: 'Mis Ligas', color: 'amber', category: 'Torneos & Ligas' },
  qa_ranking: { href: '/ranking', icon: <TrendingUp size={18} />, label: 'Ranking', color: 'cyan', category: 'Padel' },
  qa_gym: { href: '/gimnasio', icon: <Dumbbell size={18} />, label: 'Gimnasio', color: 'pink', category: 'Gym & Wellness' },
  qa_recuperacion: { href: '/mi-recuperacion', icon: <Heart size={18} />, label: 'Recuperacion', color: 'pink', category: 'Gym & Wellness' },
  qa_tienda: { href: '/tienda', icon: <ShoppingBag size={18} />, label: 'Tienda', color: 'green', category: 'General' },
  qa_suscripcion: { href: '/mi-suscripcion', icon: <CreditCard size={18} />, label: 'Mi Suscripcion', color: 'green', category: 'General' },
  qa_ficha: { href: '/mi-ficha', icon: <UserCircle size={18} />, label: 'Mi Ficha', color: 'purple', category: 'General' },
}

const DEFAULT_QUICK_ACTIONS: WidgetVis[] = [
  { id: 'qa_reservar', visible: true, order: 1 },
  { id: 'qa_buscar', visible: true, order: 2 },
  { id: 'qa_acceso', visible: true, order: 3 },
  { id: 'qa_entrenamiento', visible: true, order: 4 },
  { id: 'qa_retos', visible: true, order: 5 },
  { id: 'qa_comunidad', visible: true, order: 6 },
  { id: 'qa_torneos', visible: false, order: 7 },
  { id: 'qa_ligas', visible: false, order: 8 },
  { id: 'qa_ranking', visible: false, order: 9 },
  { id: 'qa_gym', visible: false, order: 10 },
  { id: 'qa_recuperacion', visible: false, order: 11 },
  { id: 'qa_tienda', visible: false, order: 12 },
  { id: 'qa_suscripcion', visible: false, order: 13 },
  { id: 'qa_ficha', visible: false, order: 14 },
]

// ─── Live Widget definitions ─────────────────────────────────────────────────

const LIVE_META: Record<string, { title: string; icon: React.ReactNode; iconColor: string; linkHref: string; linkLabel: string; category: string }> = {
  live_bookings: { title: 'Proximas reservas', icon: <Calendar size={16} />, iconColor: 'text-cyan-400', linkHref: '/mis-reservas', linkLabel: 'Ver todas', category: 'Padel' },
  live_subscription: { title: 'Mi suscripcion', icon: <CreditCard size={16} />, iconColor: 'text-emerald-400', linkHref: '/mi-suscripcion', linkLabel: 'Detalles', category: 'General' },
  live_challenges: { title: 'Mis retos', icon: <Target size={16} />, iconColor: 'text-pink-400', linkHref: '/retos', linkLabel: 'Ver todos', category: 'Social' },
  live_profile: { title: 'Tu perfil', icon: <Medal size={16} />, iconColor: 'text-amber-400', linkHref: '/perfil', linkLabel: 'Ver', category: 'General' },
  live_tournaments: { title: 'Mis torneos activos', icon: <Trophy size={16} />, iconColor: 'text-amber-400', linkHref: '/mis-torneos', linkLabel: 'Ver todos', category: 'Torneos & Ligas' },
  live_leagues: { title: 'Mis ligas', icon: <Award size={16} />, iconColor: 'text-amber-400', linkHref: '/mis-ligas', linkLabel: 'Ver todas', category: 'Torneos & Ligas' },
  live_gym: { title: 'Mi actividad gym', icon: <Dumbbell size={16} />, iconColor: 'text-pink-400', linkHref: '/gimnasio', linkLabel: 'Ver todo', category: 'Gym & Wellness' },
  live_training: { title: 'Mi plan entrenamiento', icon: <ClipboardList size={16} />, iconColor: 'text-pink-400', linkHref: '/mi-entrenamiento', linkLabel: 'Ver plan', category: 'Gym & Wellness' },
  live_community: { title: 'Posts recientes', icon: <MessageSquare size={16} />, iconColor: 'text-indigo-400', linkHref: '/comunidad', linkLabel: 'Ver todos', category: 'Social' },
  live_ranking: { title: 'Top 5 ranking', icon: <TrendingUp size={16} />, iconColor: 'text-cyan-400', linkHref: '/ranking', linkLabel: 'Ver ranking', category: 'Padel' },
}

const DEFAULT_LIVE_WIDGETS: WidgetVis[] = [
  { id: 'live_bookings', visible: true, order: 1 },
  { id: 'live_subscription', visible: true, order: 2 },
  { id: 'live_challenges', visible: true, order: 3 },
  { id: 'live_profile', visible: true, order: 4 },
  { id: 'live_tournaments', visible: false, order: 5 },
  { id: 'live_leagues', visible: false, order: 6 },
  { id: 'live_gym', visible: false, order: 7 },
  { id: 'live_training', visible: false, order: 8 },
  { id: 'live_community', visible: false, order: 9 },
  { id: 'live_ranking', visible: false, order: 10 },
]

// ─── Data types ──────────────────────────────────────────────────────────────

interface DashStats {
  bookings: number; matches: number; ranking: string; winRate: number; nextMatch: string
  activeTournaments: number; activeLeagues: number; tournamentWins: number; leaguePosition: number | null
  gymDays: number; trainingProgress: number; recoverySessions: number
  challengesActive: number; challengesCompleted: number; badgesEarned: number; communityPosts: number
}

const EMPTY_STATS: DashStats = {
  bookings: 0, matches: 0, ranking: '-', winRate: 0, nextMatch: '',
  activeTournaments: 0, activeLeagues: 0, tournamentWins: 0, leaguePosition: null,
  gymDays: 0, trainingProgress: 0, recoverySessions: 0,
  challengesActive: 0, challengesCompleted: 0, badgesEarned: 0, communityPosts: 0,
}

interface Booking { id: number; date: string; start_time: string; court_id: number; status: string }
interface Challenge { id: number; name: string; metric: string | null; target_value: number; current_value: number }
interface Subscription { id: number; status: string; current_period_end: string | null; plan?: { name: string; price: number } | null }
interface TournamentEntry { id: number; name: string; start_date: string; status: string }
interface LeagueEntry { id: number; name: string; position: number | null }
interface GymLog { id: number; checked_in_at: string }
interface TrainingPlan { id: number; name: string; description: string | null; status: string }
interface CommunityPost { id: number; title: string | null; content: string; created_at: string; author_name: string }
interface RankingEntry { user_id: string; full_name: string; ranking_position: number; win_rate: number }

interface DashConfig {
  kpis: WidgetVis[]
  quickActions: WidgetVis[]
  liveWidgets: WidgetVis[]
  theme: ThemeConfig
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function mergeWidgets(saved: WidgetVis[] | undefined, defaults: WidgetVis[]): WidgetVis[] {
  if (!saved || saved.length === 0) return defaults
  const map = new Map(saved.map(w => [w.id, w]))
  const merged: WidgetVis[] = []
  let maxOrder = Math.max(...saved.map(w => w.order), 0)
  for (const d of defaults) {
    if (map.has(d.id)) {
      merged.push(map.get(d.id)!)
      map.delete(d.id)
    } else {
      maxOrder++
      merged.push({ ...d, visible: false, order: maxOrder })
    }
  }
  // keep any extras from saved that still exist
  for (const [, w] of map) merged.push(w)
  merged.sort((a, b) => a.order - b.order)
  return merged
}

// ─── Main Component ──────────────────────────────────────────────────────────

export default function DashboardPage() {
  const { user } = useAuth()
  const { toast } = useToast()
  const [stats, setStats] = useState<DashStats>(EMPTY_STATS)
  const [loading, setLoading] = useState(true)

  // Live widget data
  const [upcomingBookings, setUpcomingBookings] = useState<Booking[]>([])
  const [myChallenges, setMyChallenges] = useState<Challenge[]>([])
  const [mySubscription, setMySubscription] = useState<Subscription | null>(null)
  const [fichaCompleted, setFichaCompleted] = useState<string | null>(null)
  const [pendingInvoices, setPendingInvoices] = useState(0)
  const [myTournaments, setMyTournaments] = useState<TournamentEntry[]>([])
  const [myLeagues, setMyLeagues] = useState<LeagueEntry[]>([])
  const [gymLogs, setGymLogs] = useState<GymLog[]>([])
  const [trainingPlan, setTrainingPlan] = useState<TrainingPlan | null>(null)
  const [communityPosts, setCommunityPosts] = useState<CommunityPost[]>([])
  const [topRanking, setTopRanking] = useState<RankingEntry[]>([])

  // ─── Dashboard customization ──────────────────────────────────────────────
  const [isEditing, setIsEditing] = useState(false)
  const [kpis, setKpis] = useState<WidgetVis[]>(DEFAULT_KPIS)
  const [quickActions, setQuickActions] = useState<WidgetVis[]>(DEFAULT_QUICK_ACTIONS)
  const [liveWidgets, setLiveWidgets] = useState<WidgetVis[]>(DEFAULT_LIVE_WIDGETS)
  const [theme, setTheme] = useState<ThemeConfig>(DEFAULT_THEME)

  const [backupKpis, setBackupKpis] = useState<WidgetVis[]>([])
  const [backupQA, setBackupQA] = useState<WidgetVis[]>([])
  const [backupLive, setBackupLive] = useState<WidgetVis[]>([])
  const [backupTheme, setBackupTheme] = useState<ThemeConfig>(DEFAULT_THEME)

  // Modals
  const [themeModalOpen, setThemeModalOpen] = useState(false)
  const [galleryOpen, setGalleryOpen] = useState(false)
  const [gallerySearch, setGallerySearch] = useState('')

  // Load saved config
  useEffect(() => {
    if (!user) return
    const saved = localStorage.getItem(`dash-player-${user.id}`)
    if (saved) {
      try {
        const p = JSON.parse(saved) as Partial<DashConfig>
        setKpis(mergeWidgets(p.kpis, DEFAULT_KPIS))
        setQuickActions(mergeWidgets(p.quickActions, DEFAULT_QUICK_ACTIONS))
        setLiveWidgets(mergeWidgets(p.liveWidgets, DEFAULT_LIVE_WIDGETS))
        if (p.theme) setTheme({ ...DEFAULT_THEME, ...p.theme })
      } catch { /* ignore */ }
    }
  }, [user])

  function startEdit() {
    setBackupKpis([...kpis]); setBackupQA([...quickActions]); setBackupLive([...liveWidgets]); setBackupTheme({ ...theme })
    setIsEditing(true)
  }
  function cancelEdit() {
    setKpis(backupKpis); setQuickActions(backupQA); setLiveWidgets(backupLive); setTheme(backupTheme)
    setIsEditing(false)
  }
  function saveEdit() {
    if (!user) return
    const config: DashConfig = { kpis, quickActions, liveWidgets, theme }
    localStorage.setItem(`dash-player-${user.id}`, JSON.stringify(config))
    // DB upsert (fire-and-forget)
    const supabase = createClient()
    supabase.from('nm_user_dashboard_configs').upsert({ user_id: user.id, config, updated_at: new Date().toISOString() }, { onConflict: 'user_id' }).then()
    setIsEditing(false)
    toast('success', 'Dashboard guardado')
  }
  function resetEdit() {
    setKpis(DEFAULT_KPIS); setQuickActions(DEFAULT_QUICK_ACTIONS); setLiveWidgets(DEFAULT_LIVE_WIDGETS); setTheme(DEFAULT_THEME)
    toast('info', 'Restaurado a valores por defecto')
  }

  function toggleVis(list: WidgetVis[], setList: React.Dispatch<React.SetStateAction<WidgetVis[]>>, idx: number) {
    const n = [...list]; n[idx] = { ...n[idx], visible: !n[idx].visible }; setList(n)
  }
  function moveVis(list: WidgetVis[], setList: React.Dispatch<React.SetStateAction<WidgetVis[]>>, idx: number, dir: 'up' | 'down') {
    const n = [...list]; const t = dir === 'up' ? idx - 1 : idx + 1
    if (t < 0 || t >= n.length) return
    const tmp = n[idx].order; n[idx] = { ...n[idx], order: n[t].order }; n[t] = { ...n[t], order: tmp }
    n.sort((a, b) => a.order - b.order); setList(n)
  }

  // ─── Data loading ─────────────────────────────────────────────────────────

  const loadStats = useCallback(async () => {
    const supabase = createClient()
    if (!user) return
    setLoading(true)
    const today = new Date().toISOString().split('T')[0]
    const monthStart = `${today.slice(0, 8)}01`

    const [
      bookingsCount, profileRes, upcoming,
      subRes, challengesRes, userRes, pendingInv,
      tournamentsCount, leaguesCount, challengesCompletedRes,
      badgesRes, postsCount, gymDaysRes,
      tournamentsLive, leaguesLive, gymLogsLive,
      trainingLive, communityLive, rankingLive,
    ] = await Promise.all([
      // Existing
      supabase.from('nm_bookings').select('id', { count: 'exact', head: true }).eq('booked_by', user.id).eq('status', 'confirmed'),
      supabase.from('nm_player_profiles').select('*').eq('user_id', user.id).single(),
      supabase.from('nm_bookings').select('id, date, start_time, court_id, status').eq('booked_by', user.id).eq('status', 'confirmed').gte('date', today).order('date').order('start_time').limit(5),
      supabase.from('nm_subscriptions').select('id, status, current_period_end, plan:nm_subscription_plans(name, price)').eq('user_id', user.id).eq('status', 'active').maybeSingle(),
      supabase.from('nm_challenge_participants').select('current_value, completed, challenge:nm_challenges(id, name, metric, target_value, is_active, end_date)').eq('user_id', user.id).eq('completed', false).limit(5),
      supabase.from('nm_users').select('profile_completed_at').eq('id', user.id).single(),
      supabase.from('nm_invoices').select('id', { count: 'exact', head: true }).eq('user_id', user.id).eq('status', 'pending'),
      // New KPI queries
      supabase.from('nm_tournament_registrations').select('id', { count: 'exact', head: true }).contains('player', [user.id]),
      supabase.from('nm_league_teams').select('id', { count: 'exact', head: true }).contains('player_id', [user.id]),
      supabase.from('nm_challenge_participants').select('id', { count: 'exact', head: true }).eq('user_id', user.id).eq('completed', true),
      supabase.from('nm_user_badges').select('id', { count: 'exact', head: true }).eq('user_id', user.id),
      supabase.from('nm_posts').select('id', { count: 'exact', head: true }).eq('author_id', user.id),
      supabase.from('nm_gym_access_logs').select('id', { count: 'exact', head: true }).eq('user_id', user.id).gte('checked_in_at', monthStart),
      // New live widget queries
      supabase.from('nm_tournament_registrations').select('tournament:nm_tournaments(id, name, start_date, status)').contains('player', [user.id]).limit(3),
      supabase.from('nm_league_teams').select('league:nm_leagues(id, name), position').contains('player_id', [user.id]).limit(3),
      supabase.from('nm_gym_access_logs').select('id, checked_in_at').eq('user_id', user.id).order('checked_in_at', { ascending: false }).limit(5),
      supabase.from('nm_user_training_plans').select('id, name, description, status').eq('user_id', user.id).eq('status', 'active').maybeSingle(),
      supabase.from('nm_posts').select('id, title, content, created_at, author:nm_users(full_name)').order('created_at', { ascending: false }).limit(3),
      supabase.from('nm_player_profiles').select('user_id, full_name:nm_users(full_name), ranking_position, win_rate').not('ranking_position', 'is', null).order('ranking_position').limit(5),
    ])

    // Next match from upcoming bookings
    const upcomingData = (upcoming.data ?? []) as Booking[]
    const nextMatchStr = upcomingData.length > 0 ? formatDate(upcomingData[0].date) : ''

    setStats({
      bookings: bookingsCount.count || 0,
      matches: profileRes.data?.matches_played || 0,
      ranking: profileRes.data?.ranking_position ? `#${profileRes.data.ranking_position}` : '-',
      winRate: profileRes.data?.win_rate || 0,
      nextMatch: nextMatchStr,
      activeTournaments: tournamentsCount.count || 0,
      activeLeagues: leaguesCount.count || 0,
      tournamentWins: profileRes.data?.tournament_wins || 0,
      leaguePosition: profileRes.data?.best_league_position || null,
      gymDays: gymDaysRes.count || 0,
      trainingProgress: profileRes.data?.training_progress || 0,
      recoverySessions: profileRes.data?.recovery_sessions || 0,
      challengesActive: (challengesRes.data ?? []).length,
      challengesCompleted: challengesCompletedRes.count || 0,
      badgesEarned: badgesRes.count || 0,
      communityPosts: postsCount.count || 0,
    })

    setUpcomingBookings(upcomingData)
    setMySubscription(subRes.data as unknown as Subscription | null)
    setMyChallenges(
      ((challengesRes.data ?? []) as unknown as { current_value: number; challenge: { id: number; name: string; metric: string | null; target_value: number; is_active: boolean; end_date: string } | null }[])
        .filter(p => p.challenge?.is_active && p.challenge.end_date >= today)
        .map(p => ({ id: p.challenge!.id, name: p.challenge!.name, metric: p.challenge!.metric, target_value: p.challenge!.target_value, current_value: p.current_value }))
    )
    setFichaCompleted(userRes.data?.profile_completed_at ?? null)
    setPendingInvoices(pendingInv.count || 0)

    // New live data
    setMyTournaments(
      ((tournamentsLive.data ?? []) as unknown as { tournament: { id: number; name: string; start_date: string; status: string } | null }[])
        .filter(t => t.tournament).map(t => ({ id: t.tournament!.id, name: t.tournament!.name, start_date: t.tournament!.start_date, status: t.tournament!.status }))
    )
    setMyLeagues(
      ((leaguesLive.data ?? []) as unknown as { league: { id: number; name: string } | null; position: number | null }[])
        .filter(l => l.league).map(l => ({ id: l.league!.id, name: l.league!.name, position: l.position }))
    )
    setGymLogs((gymLogsLive.data ?? []) as GymLog[])
    setTrainingPlan(trainingLive.data as unknown as TrainingPlan | null)
    setCommunityPosts(
      ((communityLive.data ?? []) as unknown as { id: number; title: string | null; content: string; created_at: string; author: { full_name: string } | null }[])
        .map(p => ({ id: p.id, title: p.title, content: p.content, created_at: p.created_at, author_name: p.author?.full_name || 'Anonimo' }))
    )
    setTopRanking(
      ((rankingLive.data ?? []) as unknown as { user_id: string; full_name: { full_name: string } | null; ranking_position: number; win_rate: number }[])
        .map(r => ({ user_id: r.user_id, full_name: (r.full_name as unknown as { full_name: string } | null)?.full_name || 'Jugador', ranking_position: r.ranking_position, win_rate: r.win_rate || 0 }))
    )

    setLoading(false)
  }, [user])

  useEffect(() => { loadStats() }, [loadStats])

  // ─── Derived ──────────────────────────────────────────────────────────────

  const visibleKpis = useMemo(() => kpis.filter(k => k.visible).sort((a, b) => a.order - b.order), [kpis])
  const visibleQA = useMemo(() => quickActions.filter(q => q.visible).sort((a, b) => a.order - b.order), [quickActions])
  const visibleLive = useMemo(() => liveWidgets.filter(w => w.visible).sort((a, b) => a.order - b.order), [liveWidgets])

  const accentHex = useMemo(() => ACCENT_COLORS.find(a => a.key === theme.accent)?.hex || '#06b6d4', [theme.accent])

  const kpiGridCols = theme.kpiColumns === 2 ? 'grid-cols-2' : theme.kpiColumns === 3 ? 'grid-cols-2 lg:grid-cols-3' : 'grid-cols-2 lg:grid-cols-4'
  const liveGridCols = theme.liveColumns === 1 ? 'grid-cols-1' : 'grid-cols-1 lg:grid-cols-2'

  const greeting = () => {
    const h = new Date().getHours()
    if (h < 12) return 'Buenos dias'
    if (h < 20) return 'Buenas tardes'
    return 'Buenas noches'
  }

  // ─── Gallery helpers ──────────────────────────────────────────────────────

  type GalleryItem = { id: string; label: string; category: string; type: 'kpi' | 'qa' | 'live'; visible: boolean }

  const galleryItems = useMemo((): GalleryItem[] => {
    const items: GalleryItem[] = []
    for (const def of KPI_DEFS) {
      const w = kpis.find(k => k.id === def.id)
      items.push({ id: def.id, label: def.title, category: def.category, type: 'kpi', visible: w?.visible ?? false })
    }
    for (const [id, meta] of Object.entries(QA_META)) {
      const w = quickActions.find(q => q.id === id)
      items.push({ id, label: meta.label, category: meta.category, type: 'qa', visible: w?.visible ?? false })
    }
    for (const [id, meta] of Object.entries(LIVE_META)) {
      const w = liveWidgets.find(l => l.id === id)
      items.push({ id, label: meta.title, category: meta.category, type: 'live', visible: w?.visible ?? false })
    }
    return items
  }, [kpis, quickActions, liveWidgets])

  const filteredGallery = useMemo(() => {
    if (!gallerySearch) return galleryItems
    const q = gallerySearch.toLowerCase()
    return galleryItems.filter(i => i.label.toLowerCase().includes(q) || i.category.toLowerCase().includes(q))
  }, [galleryItems, gallerySearch])

  function galleryToggle(item: GalleryItem) {
    if (item.type === 'kpi') {
      const idx = kpis.findIndex(k => k.id === item.id)
      if (idx >= 0) toggleVis(kpis, setKpis, idx)
    } else if (item.type === 'qa') {
      const idx = quickActions.findIndex(q => q.id === item.id)
      if (idx >= 0) toggleVis(quickActions, setQuickActions, idx)
    } else {
      const idx = liveWidgets.findIndex(w => w.id === item.id)
      if (idx >= 0) toggleVis(liveWidgets, setLiveWidgets, idx)
    }
  }

  // ─── Edit overlay component ───────────────────────────────────────────────

  function EditOverlay({ list, setList, idx }: { list: WidgetVis[]; setList: React.Dispatch<React.SetStateAction<WidgetVis[]>>; idx: number }) {
    if (!isEditing) return null
    return (
      <div className="absolute top-2 right-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity z-10">
        <button onClick={() => moveVis(list, setList, idx, 'up')} className="p-1.5 rounded-lg bg-slate-700 text-white hover:bg-slate-600"><ChevronUp size={12} /></button>
        <button onClick={() => moveVis(list, setList, idx, 'down')} className="p-1.5 rounded-lg bg-slate-700 text-white hover:bg-slate-600"><ChevronDown size={12} /></button>
        <button onClick={() => toggleVis(list, setList, idx)} className="p-1.5 rounded-lg bg-red-500/20 text-red-400 hover:bg-red-500/30"><EyeOff size={12} /></button>
      </div>
    )
  }

  // ─── Hidden widgets restore buttons ───────────────────────────────────────

  function HiddenWidgets({ items, list, setList, getMeta }: { items: WidgetVis[]; list: WidgetVis[]; setList: React.Dispatch<React.SetStateAction<WidgetVis[]>>; getMeta: (id: string) => string }) {
    const hidden = items.filter(w => !w.visible)
    if (!isEditing || hidden.length === 0) return null
    return (
      <div className="flex flex-wrap gap-2">
        {hidden.map(w => (
          <button key={w.id} onClick={() => toggleVis(list, setList, list.indexOf(w))} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800/50 border border-dashed border-slate-700 text-xs text-slate-500 hover:text-white hover:border-cyan-500/50 transition-colors">
            <Plus size={12} /> {getMeta(w.id)}
          </button>
        ))}
      </div>
    )
  }

  // ─── Card wrapper with theme styles ───────────────────────────────────────

  function ThemedCard({ children, className }: { children: React.ReactNode; className?: string }) {
    const styleMap: Record<CardStyle, string> = {
      default: '',
      glass: 'bg-slate-800/30 backdrop-blur-sm',
      bordered: 'bg-transparent border-2',
    }
    return <Card className={`${styleMap[theme.cardStyle]} ${className || ''}`}>{children}</Card>
  }

  // ─── Render live widget content ───────────────────────────────────────────

  function renderLiveWidget(w: WidgetVis) {
    const meta = LIVE_META[w.id]
    if (!meta) return null
    const wIdx = liveWidgets.indexOf(w)

    const wrapper = (content: React.ReactNode) => (
      <div key={w.id} className="relative group">
        <EditOverlay list={liveWidgets} setList={setLiveWidgets} idx={wIdx} />
        <ThemedCard>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-white flex items-center gap-2">
              <span className={meta.iconColor}>{meta.icon}</span> {meta.title}
            </h3>
            <Link href={meta.linkHref} className="text-xs hover:text-cyan-300" style={{ color: accentHex }}>{meta.linkLabel} &rarr;</Link>
          </div>
          {content}
        </ThemedCard>
      </div>
    )

    if (w.id === 'live_bookings') return wrapper(
      upcomingBookings.length === 0 ? (
        <div className="text-center py-6">
          <Calendar size={32} className="mx-auto text-slate-600 mb-2" />
          <p className="text-xs text-slate-400 mb-3">No tenes reservas proximas</p>
          <Link href="/mis-reservas"><Button size="sm">Reservar ahora</Button></Link>
        </div>
      ) : (
        <div className="space-y-1.5">
          {upcomingBookings.map(b => (
            <div key={b.id} className="flex items-center justify-between bg-slate-800/40 rounded-lg px-3 py-2 text-xs">
              <span className="text-white">{formatDate(b.date)}</span>
              <span className="font-mono mx-2" style={{ color: accentHex }}>{b.start_time.slice(0, 5)}</span>
              <Badge variant="info">Pista {b.court_id}</Badge>
            </div>
          ))}
        </div>
      )
    )

    if (w.id === 'live_subscription') return wrapper(
      mySubscription ? (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm text-white font-medium">{mySubscription.plan?.name ?? 'Plan activo'}</span>
            <Badge variant="success">Activa</Badge>
          </div>
          {mySubscription.plan?.price != null && <p className="text-xs text-slate-400">&euro;{mySubscription.plan.price} / mes</p>}
          {mySubscription.current_period_end && (
            <p className="text-xs text-slate-500 flex items-center gap-1"><Clock size={11} /> Renueva el {formatDate(mySubscription.current_period_end)}</p>
          )}
        </div>
      ) : (
        <div className="text-center py-6">
          <CreditCard size={32} className="mx-auto text-slate-600 mb-2" />
          <p className="text-xs text-slate-400 mb-3">No tenes una suscripcion activa</p>
          <Link href="/mi-suscripcion"><Button size="sm">Ver planes</Button></Link>
        </div>
      )
    )

    if (w.id === 'live_challenges') return wrapper(
      myChallenges.length === 0 ? (
        <div className="text-center py-6">
          <Target size={32} className="mx-auto text-slate-600 mb-2" />
          <p className="text-xs text-slate-400 mb-3">No estas en ningun reto</p>
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
      )
    )

    if (w.id === 'live_profile') return wrapper(
      <div className="space-y-1.5 text-xs">
        <div className="flex items-center justify-between bg-slate-800/40 rounded-lg px-3 py-2">
          <span className="text-slate-300">Ficha GDPR</span>
          <Badge variant={fichaCompleted ? 'success' : 'warning'}>{fichaCompleted ? 'Completa' : 'Pendiente'}</Badge>
        </div>
        <div className="flex items-center justify-between bg-slate-800/40 rounded-lg px-3 py-2">
          <span className="text-slate-300">Suscripcion</span>
          <Badge variant={mySubscription ? 'success' : 'warning'}>{mySubscription ? 'Activa' : 'Sin plan'}</Badge>
        </div>
        <div className="flex items-center justify-between bg-slate-800/40 rounded-lg px-3 py-2">
          <span className="text-slate-300">Facturas pendientes</span>
          <Badge variant={pendingInvoices === 0 ? 'success' : 'danger'}>{pendingInvoices}</Badge>
        </div>
      </div>
    )

    if (w.id === 'live_tournaments') return wrapper(
      myTournaments.length === 0 ? (
        <div className="text-center py-6">
          <Trophy size={32} className="mx-auto text-slate-600 mb-2" />
          <p className="text-xs text-slate-400 mb-3">No estas inscripto en torneos</p>
          <Link href="/mis-torneos"><Button size="sm">Ver torneos</Button></Link>
        </div>
      ) : (
        <div className="space-y-1.5">
          {myTournaments.map(t => (
            <div key={t.id} className="flex items-center justify-between bg-slate-800/40 rounded-lg px-3 py-2 text-xs">
              <span className="text-white truncate">{t.name}</span>
              <span className="text-amber-300 font-mono">{formatDate(t.start_date)}</span>
            </div>
          ))}
        </div>
      )
    )

    if (w.id === 'live_leagues') return wrapper(
      myLeagues.length === 0 ? (
        <div className="text-center py-6">
          <Award size={32} className="mx-auto text-slate-600 mb-2" />
          <p className="text-xs text-slate-400 mb-3">No estas en ninguna liga</p>
          <Link href="/mis-ligas"><Button size="sm">Ver ligas</Button></Link>
        </div>
      ) : (
        <div className="space-y-1.5">
          {myLeagues.map(l => (
            <div key={l.id} className="flex items-center justify-between bg-slate-800/40 rounded-lg px-3 py-2 text-xs">
              <span className="text-white truncate">{l.name}</span>
              <Badge variant="info">{l.position ? `#${l.position}` : '-'}</Badge>
            </div>
          ))}
        </div>
      )
    )

    if (w.id === 'live_gym') return wrapper(
      gymLogs.length === 0 ? (
        <div className="text-center py-6">
          <Dumbbell size={32} className="mx-auto text-slate-600 mb-2" />
          <p className="text-xs text-slate-400 mb-3">Sin check-ins recientes</p>
          <Link href="/gimnasio"><Button size="sm">Ir al gimnasio</Button></Link>
        </div>
      ) : (
        <div className="space-y-1.5">
          {gymLogs.map(g => (
            <div key={g.id} className="flex items-center justify-between bg-slate-800/40 rounded-lg px-3 py-2 text-xs">
              <span className="text-white">{formatDate(g.checked_in_at.split('T')[0])}</span>
              <span className="text-pink-300 font-mono">{g.checked_in_at.split('T')[1]?.slice(0, 5) || ''}</span>
            </div>
          ))}
        </div>
      )
    )

    if (w.id === 'live_training') return wrapper(
      trainingPlan ? (
        <div className="space-y-2">
          <p className="text-sm text-white font-medium">{trainingPlan.name}</p>
          {trainingPlan.description && <p className="text-xs text-slate-400 line-clamp-3">{trainingPlan.description}</p>}
          <Badge variant="success">Activo</Badge>
        </div>
      ) : (
        <div className="text-center py-6">
          <ClipboardList size={32} className="mx-auto text-slate-600 mb-2" />
          <p className="text-xs text-slate-400 mb-3">Sin plan de entrenamiento activo</p>
          <Link href="/mi-entrenamiento"><Button size="sm">Crear plan</Button></Link>
        </div>
      )
    )

    if (w.id === 'live_community') return wrapper(
      communityPosts.length === 0 ? (
        <div className="text-center py-6">
          <MessageSquare size={32} className="mx-auto text-slate-600 mb-2" />
          <p className="text-xs text-slate-400 mb-3">No hay posts recientes</p>
          <Link href="/comunidad"><Button size="sm">Ir a comunidad</Button></Link>
        </div>
      ) : (
        <div className="space-y-1.5">
          {communityPosts.map(p => (
            <div key={p.id} className="bg-slate-800/40 rounded-lg px-3 py-2 text-xs">
              <div className="flex items-center justify-between mb-0.5">
                <span className="text-white font-medium truncate">{p.title || p.content.slice(0, 40)}</span>
                <span className="text-slate-500 text-[10px]">{formatDate(p.created_at.split('T')[0])}</span>
              </div>
              <p className="text-slate-400 text-[11px]">por {p.author_name}</p>
            </div>
          ))}
        </div>
      )
    )

    if (w.id === 'live_ranking') return wrapper(
      topRanking.length === 0 ? (
        <div className="text-center py-6">
          <TrendingUp size={32} className="mx-auto text-slate-600 mb-2" />
          <p className="text-xs text-slate-400 mb-3">Sin datos de ranking</p>
        </div>
      ) : (
        <div className="space-y-1.5">
          {topRanking.map((r, i) => (
            <div key={r.user_id} className="flex items-center justify-between bg-slate-800/40 rounded-lg px-3 py-2 text-xs">
              <div className="flex items-center gap-2">
                <span className="font-bold text-white w-5">{i + 1}</span>
                <span className={`text-white ${r.user_id === user?.id ? 'font-bold' : ''}`}>{r.full_name}</span>
              </div>
              <span className="text-emerald-300 font-mono">{r.win_rate}%</span>
            </div>
          ))}
        </div>
      )
    )

    return null
  }

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white">
            {greeting()}, {user?.first_name || user?.full_name?.split(' ')[0] || 'Jugador'}
          </h1>
          <p className="text-sm text-slate-400 mt-1">Bienvenido a Nueva Marina Padel & Sport</p>
        </div>
        <div className="flex items-center gap-2">
          {loading && <span className="text-xs text-slate-500">Cargando...</span>}
          {isEditing ? (
            <>
              <Button variant="ghost" onClick={() => setGalleryOpen(true)} className="text-xs gap-1.5"><Plus size={14} /> Agregar widget</Button>
              <Button variant="ghost" onClick={() => setThemeModalOpen(true)} className="text-xs gap-1.5"><Palette size={14} /> Tema</Button>
              <Button variant="ghost" onClick={resetEdit} className="text-xs gap-1.5"><RotateCcw size={14} /> Restablecer</Button>
              <Button variant="ghost" onClick={cancelEdit} className="text-xs gap-1.5 text-red-400"><X size={14} /> Cancelar</Button>
              <Button onClick={saveEdit} className="text-xs gap-1.5"><Save size={14} /> Guardar</Button>
            </>
          ) : (
            <Button variant="ghost" onClick={startEdit} className="text-xs gap-1.5"><Pencil size={14} /> Personalizar</Button>
          )}
        </div>
      </div>

      {/* Alertas (ficha incompleta, facturas pendientes) */}
      {(!fichaCompleted || pendingInvoices > 0) && (
        <div className="space-y-2">
          {!fichaCompleted && (
            <Link href="/mi-ficha" className="block">
              <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-3 flex items-center gap-3 hover:bg-amber-500/15 transition-colors">
                <AlertCircle size={18} className="text-amber-400 shrink-0" />
                <div className="flex-1">
                  <p className="text-sm text-white font-medium">Tu ficha personal esta incompleta</p>
                  <p className="text-xs text-amber-300">Completa tus datos y consentimiento GDPR &rarr; <span className="underline">Mi Ficha</span></p>
                </div>
              </div>
            </Link>
          )}
          {pendingInvoices > 0 && (
            <Link href="/mi-suscripcion" className="block">
              <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 flex items-center gap-3 hover:bg-red-500/15 transition-colors">
                <AlertCircle size={18} className="text-red-400 shrink-0" />
                <div className="flex-1">
                  <p className="text-sm text-white font-medium">Tenes {pendingInvoices} factura{pendingInvoices > 1 ? 's' : ''} pendiente{pendingInvoices > 1 ? 's' : ''}</p>
                  <p className="text-xs text-red-300">Revisalas en &rarr; <span className="underline">Mi Suscripcion</span></p>
                </div>
              </div>
            </Link>
          )}
        </div>
      )}

      {/* KPIs (editable) */}
      <div className={`grid ${kpiGridCols} gap-4`}>
        {visibleKpis.map((k) => {
          const def = KPI_DEFS.find(d => d.id === k.id)
          if (!def) return null
          const kIdx = kpis.indexOf(k)
          return (
            <div key={k.id} className="relative group">
              {isEditing && (
                <div className="absolute top-2 right-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                  <button onClick={() => moveVis(kpis, setKpis, kIdx, 'up')} className="p-1.5 rounded-lg bg-slate-700 text-white hover:bg-slate-600"><ChevronUp size={12} /></button>
                  <button onClick={() => moveVis(kpis, setKpis, kIdx, 'down')} className="p-1.5 rounded-lg bg-slate-700 text-white hover:bg-slate-600"><ChevronDown size={12} /></button>
                  <button onClick={() => toggleVis(kpis, setKpis, kIdx)} className="p-1.5 rounded-lg bg-red-500/20 text-red-400 hover:bg-red-500/30"><EyeOff size={12} /></button>
                </div>
              )}
              <KpiCard
                title={def.title}
                value={def.getValue(stats)}
                icon={def.icon}
                color={def.color}
              />
            </div>
          )
        })}
      </div>
      <HiddenWidgets
        items={kpis}
        list={kpis}
        setList={setKpis}
        getMeta={(id) => KPI_DEFS.find(d => d.id === id)?.title || id}
      />

      {/* Quick Actions (editable) */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {visibleQA.map((q) => {
          const meta = QA_META[q.id]
          if (!meta) return null
          return (
            <div key={q.id} className="relative group">
              <QuickAction href={meta.href} icon={meta.icon} label={meta.label} color={meta.color} />
              {isEditing && (
                <div className="absolute inset-0 bg-slate-900/60 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1 z-10">
                  <button onClick={() => moveVis(quickActions, setQuickActions, quickActions.indexOf(q), 'up')} className="p-1.5 rounded-lg bg-slate-700 text-white"><ChevronUp size={12} /></button>
                  <button onClick={() => moveVis(quickActions, setQuickActions, quickActions.indexOf(q), 'down')} className="p-1.5 rounded-lg bg-slate-700 text-white"><ChevronDown size={12} /></button>
                  <button onClick={() => toggleVis(quickActions, setQuickActions, quickActions.indexOf(q))} className="p-1.5 rounded-lg bg-red-500/20 text-red-400"><EyeOff size={12} /></button>
                </div>
              )}
            </div>
          )
        })}
      </div>
      <HiddenWidgets
        items={quickActions}
        list={quickActions}
        setList={setQuickActions}
        getMeta={(id) => QA_META[id]?.label || id}
      />

      {/* Live Widgets (editable) */}
      <div className={`grid ${liveGridCols} gap-4`}>
        {visibleLive.map(w => renderLiveWidget(w))}
      </div>
      <HiddenWidgets
        items={liveWidgets}
        list={liveWidgets}
        setList={setLiveWidgets}
        getMeta={(id) => LIVE_META[id]?.title || id}
      />

      {/* ─── Theme Modal ──────────────────────────────────────────────────── */}
      <Modal open={themeModalOpen} onClose={() => setThemeModalOpen(false)} title="Tema del dashboard" size="md">
        <div className="space-y-6">
          {/* Accent color */}
          <div>
            <label className="text-sm font-medium text-white mb-2 block">Color de acento</label>
            <div className="flex gap-3">
              {ACCENT_COLORS.map(c => (
                <button
                  key={c.key}
                  onClick={() => setTheme(t => ({ ...t, accent: c.key }))}
                  className={`w-10 h-10 rounded-full ${c.tw} transition-all ${theme.accent === c.key ? 'ring-2 ring-white ring-offset-2 ring-offset-slate-800 scale-110' : 'opacity-60 hover:opacity-100'}`}
                  title={c.label}
                />
              ))}
            </div>
          </div>

          {/* KPI columns */}
          <div>
            <label className="text-sm font-medium text-white mb-2 block">Columnas KPI</label>
            <div className="flex gap-2">
              {([2, 3, 4] as const).map(n => (
                <button
                  key={n}
                  onClick={() => setTheme(t => ({ ...t, kpiColumns: n }))}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${theme.kpiColumns === n ? 'bg-slate-600 text-white' : 'bg-slate-800 text-slate-400 hover:text-white'}`}
                >
                  {n} cols
                </button>
              ))}
            </div>
          </div>

          {/* Live widget columns */}
          <div>
            <label className="text-sm font-medium text-white mb-2 block">Columnas widgets en vivo</label>
            <div className="flex gap-2">
              {([1, 2] as const).map(n => (
                <button
                  key={n}
                  onClick={() => setTheme(t => ({ ...t, liveColumns: n }))}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${theme.liveColumns === n ? 'bg-slate-600 text-white' : 'bg-slate-800 text-slate-400 hover:text-white'}`}
                >
                  {n === 1 ? <Layers size={14} /> : <Columns2 size={14} />} {n} col{n > 1 ? 's' : ''}
                </button>
              ))}
            </div>
          </div>

          {/* Compact KPIs */}
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium text-white">KPIs compactos</label>
            <button
              onClick={() => setTheme(t => ({ ...t, compactKpis: !t.compactKpis }))}
              className={`w-11 h-6 rounded-full transition-colors relative ${theme.compactKpis ? 'bg-cyan-500' : 'bg-slate-700'}`}
            >
              <div className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-transform ${theme.compactKpis ? 'translate-x-5' : 'translate-x-0.5'}`} />
            </button>
          </div>

          {/* Card style */}
          <div>
            <label className="text-sm font-medium text-white mb-2 block">Estilo de tarjetas</label>
            <div className="flex gap-2">
              {([{ key: 'default', label: 'Default' }, { key: 'glass', label: 'Glass' }, { key: 'bordered', label: 'Bordes' }] as const).map(s => (
                <button
                  key={s.key}
                  onClick={() => setTheme(t => ({ ...t, cardStyle: s.key }))}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${theme.cardStyle === s.key ? 'bg-slate-600 text-white' : 'bg-slate-800 text-slate-400 hover:text-white'}`}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </Modal>

      {/* ─── Widget Gallery Modal ─────────────────────────────────────────── */}
      <Modal open={galleryOpen} onClose={() => { setGalleryOpen(false); setGallerySearch('') }} title="Galeria de widgets" size="lg">
        <div className="space-y-4">
          {/* Search */}
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar widgets..."
              value={gallerySearch}
              onChange={e => setGallerySearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-slate-900 border border-slate-700 rounded-lg text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-cyan-500"
            />
          </div>

          {/* Grouped by category */}
          {(() => {
            const categories = [...new Set(filteredGallery.map(i => i.category))]
            const typeLabels: Record<string, string> = { kpi: 'KPI', qa: 'Accion rapida', live: 'Widget en vivo' }
            return categories.map(cat => {
              const items = filteredGallery.filter(i => i.category === cat)
              return (
                <div key={cat}>
                  <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">{cat}</h3>
                  <div className="space-y-1">
                    {items.map(item => (
                      <div key={item.id} className="flex items-center justify-between bg-slate-800/40 rounded-lg px-3 py-2">
                        <div className="flex items-center gap-3">
                          <Badge variant="info" className="text-[10px]">{typeLabels[item.type]}</Badge>
                          <span className="text-sm text-white">{item.label}</span>
                        </div>
                        <button
                          onClick={() => galleryToggle(item)}
                          className={`w-9 h-5 rounded-full transition-colors relative ${item.visible ? 'bg-cyan-500' : 'bg-slate-700'}`}
                        >
                          <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${item.visible ? 'translate-x-4' : 'translate-x-0.5'}`} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )
            })
          })()}
        </div>
      </Modal>
    </div>
  )
}

// ─── QuickAction component ──────────────────────────────────────────────────

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
