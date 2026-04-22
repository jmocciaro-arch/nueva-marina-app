'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import {
  Dumbbell,
  CalendarDays,
  Users,
  Plus,
  LogIn,
  LogOut,
  Clock,
  CheckCircle,
  XCircle,
  Activity,
  Tag,
  Edit3,
  Trash2,
  Shield,
  Fingerprint,
  Smartphone,
  Key,
  Wifi,
  Hand,
  QrCode,
  ArrowDownToLine,
  ArrowUpFromLine,
  AlertCircle,
  UserCheck,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { lookupPrice } from '@/lib/api/pricing'
import { useAuth } from '@/lib/auth-context'
import { KpiCard } from '@/components/ui/kpi-card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Modal } from '@/components/ui/modal'
import { useToast } from '@/components/ui/toast'
import { formatCurrency, formatDate } from '@/lib/utils'

// ─── Constantes ────────────────────────────────────────────────────────────────

const CLUB_ID = 1

const DIAS_SEMANA: Record<number, string> = {
  0: 'Dom',
  1: 'Lun',
  2: 'Mar',
  3: 'Mié',
  4: 'Jue',
  5: 'Vie',
  6: 'Sáb',
}

const DIAS_OPTIONS = [0, 1, 2, 3, 4, 5, 6].map(d => ({
  value: String(d),
  label: DIAS_SEMANA[d],
}))

const PLAN_OPTIONS = [
  { value: 'mensual', label: 'Mensual' },
  { value: 'trimestral', label: 'Trimestral' },
  { value: 'semestral', label: 'Semestral' },
  { value: 'anual', label: 'Anual' },
]

const BILLING_OPTIONS = [
  { value: 'mensual', label: 'Mensual' },
  { value: 'trimestral', label: 'Trimestral' },
  { value: 'semestral', label: 'Semestral' },
  { value: 'anual', label: 'Anual' },
]

const STATUS_OPTIONS = [
  { value: 'active', label: 'Activa' },
  { value: 'inactive', label: 'Inactiva' },
  { value: 'suspended', label: 'Suspendida' },
  { value: 'cancelled', label: 'Cancelada' },
]

const SESSION_TYPE_OPTIONS = [
  { value: 'libre', label: 'Libre' },
  { value: 'clase', label: 'Clase' },
  { value: 'personal', label: 'Personal' },
]

const ZONE_OPTIONS = [
  { value: '', label: '— Sin zona —' },
  { value: 'sala_musculacion', label: 'Sala Musculación' },
  { value: 'sala_cardio', label: 'Cardio' },
  { value: 'piscina', label: 'Piscina' },
  { value: 'spa', label: 'Spa/Sauna' },
  { value: 'clases', label: 'Sala de Clases' },
]

const ZONE_LABELS: Record<string, string> = {
  sala_musculacion: 'Sala Musculación',
  sala_cardio: 'Cardio',
  piscina: 'Piscina',
  spa: 'Spa/Sauna',
  clases: 'Sala de Clases',
}

const AUTH_METHOD_OPTIONS = [
  { value: 'manual', label: 'Manual' },
  { value: 'qr', label: 'QR' },
  { value: 'nfc', label: 'NFC' },
  { value: 'pin', label: 'PIN' },
  { value: 'fingerprint', label: 'Huella' },
  { value: 'facial', label: 'Facial' },
]

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface GymUser {
  id: string
  full_name: string
}

interface Membership {
  id: number
  club_id: number
  user_id: string
  plan: string
  price: number
  billing_cycle: string
  start_date: string
  end_date: string | null
  status: string
  auto_renew: boolean
  nm_users?: { full_name: string } | null
}

interface GymClass {
  id: number
  club_id: number
  name: string
  instructor_id: string | null
  day_of_week: number
  start_time: string
  end_time: string
  max_capacity: number
  is_active: boolean
}

interface GymSession {
  id: number
  club_id: number
  user_id: string
  check_in: string
  check_out: string | null
  duration_minutes: number | null
  type: string
  nm_users?: { full_name: string } | null
}

interface GymAccessLogRow {
  id: number
  club_id: number
  user_id: string
  membership_id: number | null
  access_point_id: number | null
  auth_method: string
  direction: 'in' | 'out'
  granted: boolean
  denial_reason: string | null
  check_in_at: string
  check_out_at: string | null
  duration_minutes: number | null
  zone: string | null
  created_at: string
  nm_users?: { full_name: string } | null
}

interface GymStaffActivityRow {
  id: number
  club_id: number
  user_id: string
  shift_id: number | null
  action_type: string
  description: string | null
  reference_type: string | null
  reference_id: number | null
  metadata: Record<string, unknown>
  created_at: string
  nm_users?: { full_name: string } | null
}

// ─── Forms vacíos ─────────────────────────────────────────────────────────────

const MEMBERSHIP_FORM_EMPTY = {
  user_id: '',
  plan: 'mensual',
  price: '',
  billing_cycle: 'mensual',
  start_date: new Date().toISOString().slice(0, 10),
  end_date: '',
  status: 'active',
  auto_renew: true,
}

const CLASS_FORM_EMPTY = {
  name: '',
  instructor_id: '',
  day_of_week: '1',
  start_time: '09:00',
  end_time: '10:00',
  max_capacity: '15',
  is_active: true,
}

const SESSION_FORM_EMPTY = {
  user_id: '',
  type: 'libre',
  check_in: new Date().toISOString().slice(0, 16),
}

const ACCESS_LOG_FORM_EMPTY = {
  user_id: '',
  auth_method: 'manual',
  direction: 'in' as 'in' | 'out',
  zone: '',
}

type MembershipForm = typeof MEMBERSHIP_FORM_EMPTY
type ClassForm = typeof CLASS_FORM_EMPTY
type SessionForm = typeof SESSION_FORM_EMPTY
type AccessLogForm = typeof ACCESS_LOG_FORM_EMPTY

// ─── Helpers ──────────────────────────────────────────────────────────────────

function statusBadgeVariant(status: string): 'success' | 'warning' | 'danger' | 'default' {
  if (status === 'active') return 'success'
  if (status === 'suspended') return 'warning'
  if (status === 'cancelled') return 'danger'
  return 'default'
}

function statusLabel(status: string): string {
  const map: Record<string, string> = {
    active: 'Activa',
    inactive: 'Inactiva',
    suspended: 'Suspendida',
    cancelled: 'Cancelada',
  }
  return map[status] ?? status
}

function formatTimeStr(t: string) {
  return t.slice(0, 5)
}

function todayISO() {
  return new Date().toISOString().slice(0, 10)
}

// ─── Componente principal ──────────────────────────────────────────────────────

export default function GestionGimnasioPage() {
  const { toast } = useToast()
  const { member } = useAuth()

  // Pricing lookup state (membership + session)
  const [membershipRule, setMembershipRule] = useState<{ rule_id: number; amount: number; currency: string; name: string } | null>(null)
  const [membershipRuleLoading, setMembershipRuleLoading] = useState(false)
  const [sessionRule, setSessionRule] = useState<{ rule_id: number; amount: number; currency: string; name: string } | null>(null)
  const [sessionRuleLoading, setSessionRuleLoading] = useState(false)

  // Tabs
  const [activeTab, setActiveTab] = useState<'socios' | 'membresias' | 'clases' | 'sesiones' | 'personal'>('socios')

  // Datos
  const [memberships, setMemberships] = useState<Membership[]>([])
  const [classes, setClasses] = useState<GymClass[]>([])
  const [sessions, setSessions] = useState<GymSession[]>([])
  const [users, setUsers] = useState<GymUser[]>([])
  const [loading, setLoading] = useState(true)

  // Control de Personal
  const [accessLogs, setAccessLogs] = useState<GymAccessLogRow[]>([])
  const [staffActivity, setStaffActivity] = useState<GymStaffActivityRow[]>([])
  const [accessLogForm, setAccessLogForm] = useState<AccessLogForm>(ACCESS_LOG_FORM_EMPTY)
  const [savingAccessLog, setSavingAccessLog] = useState(false)
  const [now, setNow] = useState(new Date())

  // Modales
  const [membershipModal, setMembershipModal] = useState(false)
  const [classModal, setClassModal] = useState(false)
  const [sessionModal, setSessionModal] = useState(false)

  // Editing state
  const [editingMembership, setEditingMembership] = useState<Membership | null>(null)
  const [editingClass, setEditingClass] = useState<GymClass | null>(null)

  // Forms
  const [membershipForm, setMembershipForm] = useState<MembershipForm>(MEMBERSHIP_FORM_EMPTY)
  const [classForm, setClassForm] = useState<ClassForm>(CLASS_FORM_EMPTY)
  const [sessionForm, setSessionForm] = useState<SessionForm>(SESSION_FORM_EMPTY)

  // Saving
  const [savingMembership, setSavingMembership] = useState(false)
  const [savingClass, setSavingClass] = useState(false)
  const [savingSession, setSavingSession] = useState(false)

  // ─── Carga de datos ───────────────────────────────────────────────────────────

  const loadAll = useCallback(async () => {
    const supabase = createClient()
    setLoading(true)

    const today = todayISO()

    const [membRes, classRes, sessRes, usersRes, accessRes, staffActRes] = await Promise.all([
      supabase
        .from('nm_gym_memberships')
        .select('*, nm_users(full_name)')
        .eq('club_id', CLUB_ID)
        .order('start_date', { ascending: false }),
      supabase
        .from('nm_gym_classes')
        .select('*')
        .eq('club_id', CLUB_ID)
        .order('day_of_week', { ascending: true })
        .order('start_time', { ascending: true }),
      supabase
        .from('nm_gym_sessions')
        .select('*, nm_users(full_name)')
        .eq('club_id', CLUB_ID)
        .gte('check_in', `${today}T00:00:00`)
        .lte('check_in', `${today}T23:59:59`)
        .order('check_in', { ascending: false }),
      supabase
        .from('nm_users')
        .select('id, full_name')
        .eq('club_id', CLUB_ID)
        .order('full_name', { ascending: true }),
      supabase
        .from('nm_gym_access_logs')
        .select('*, nm_users(full_name)')
        .eq('club_id', CLUB_ID)
        .gte('check_in_at', `${today}T00:00:00`)
        .lte('check_in_at', `${today}T23:59:59`)
        .order('check_in_at', { ascending: false }),
      supabase
        .from('nm_gym_staff_activity')
        .select('*, nm_users(full_name)')
        .eq('club_id', CLUB_ID)
        .gte('created_at', `${today}T00:00:00`)
        .lte('created_at', `${today}T23:59:59`)
        .order('created_at', { ascending: false }),
    ])

    if (membRes.error) toast('error', 'Error al cargar membresías')
    else setMemberships((membRes.data as Membership[]) ?? [])

    if (classRes.error) toast('error', 'Error al cargar clases')
    else setClasses((classRes.data as GymClass[]) ?? [])

    if (sessRes.error) toast('error', 'Error al cargar sesiones')
    else setSessions((sessRes.data as GymSession[]) ?? [])

    if (usersRes.error) toast('error', 'Error al cargar usuarios')
    else setUsers((usersRes.data as GymUser[]) ?? [])

    if (!accessRes.error) setAccessLogs((accessRes.data as GymAccessLogRow[]) ?? [])
    if (!staffActRes.error) setStaffActivity((staffActRes.data as GymStaffActivityRow[]) ?? [])

    setLoading(false)
  }, [toast])

  useEffect(() => {
    loadAll()
  }, [loadAll])

  // Timer live para duración de personas adentro
  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 30000)
    return () => clearInterval(interval)
  }, [])

  // Lookup precio para membresía
  useEffect(() => {
    if (!membershipModal) return
    let cancelled = false
    setMembershipRuleLoading(true)
    lookupPrice({
      club_id: CLUB_ID,
      scope: 'gym_plan',
      scope_ref_id: null,
      at: new Date(membershipForm.start_date + 'T12:00:00').toISOString(),
      duration_minutes: null,
      role_slug: member?.role ?? null,
    })
      .then(rule => {
        if (cancelled) return
        setMembershipRule(rule)
        if (rule && !membershipForm.price) {
          setMembershipForm(f => ({ ...f, price: String(rule.amount), billing_cycle: rule.name.toLowerCase().includes('anual') ? 'anual' : f.billing_cycle }))
        }
      })
      .catch(() => { if (!cancelled) setMembershipRule(null) })
      .finally(() => { if (!cancelled) setMembershipRuleLoading(false) })
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [membershipModal, membershipForm.plan, membershipForm.billing_cycle, membershipForm.start_date, member?.role])

  // Lookup precio para sesión/clase (scope=class)
  useEffect(() => {
    if (!sessionModal) return
    if (sessionForm.type !== 'clase') {
      // Solo cobramos con regla si es una clase. Libre/personal se manejan con membresía o lógica externa.
      setSessionRule(null)
      return
    }
    let cancelled = false
    setSessionRuleLoading(true)
    lookupPrice({
      club_id: CLUB_ID,
      scope: 'class',
      scope_ref_id: null,
      at: new Date(sessionForm.check_in).toISOString(),
      duration_minutes: null,
      role_slug: member?.role ?? null,
    })
      .then(rule => { if (!cancelled) setSessionRule(rule) })
      .catch(() => { if (!cancelled) setSessionRule(null) })
      .finally(() => { if (!cancelled) setSessionRuleLoading(false) })
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionModal, sessionForm.type, sessionForm.check_in, member?.role])

  // ─── Control Personal: checkout ──────────────────────────────────────────────

  async function handleAccessCheckout(id: number) {
    const supabase = createClient()
    const log = accessLogs.find(l => l.id === id)
    const durationMinutes = log
      ? Math.round((now.getTime() - new Date(log.check_in_at).getTime()) / 60000)
      : null
    const { error } = await supabase
      .from('nm_gym_access_logs')
      .update({ check_out_at: now.toISOString(), duration_minutes: durationMinutes })
      .eq('id', id)
    if (error) {
      toast('error', 'No se pudo registrar el check-out')
    } else {
      toast('success', 'Check-out registrado')
      loadAll()
    }
  }

  // ─── Control Personal: registrar acceso manual ────────────────────────────────

  async function handleRegistrarAcceso() {
    if (!accessLogForm.user_id) {
      toast('warning', 'Seleccioná un usuario')
      return
    }
    const supabase = createClient()
    setSavingAccessLog(true)
    const { error } = await supabase.from('nm_gym_access_logs').insert({
      club_id: CLUB_ID,
      user_id: accessLogForm.user_id,
      auth_method: accessLogForm.auth_method,
      direction: accessLogForm.direction,
      zone: accessLogForm.zone || null,
      granted: true,
      check_in_at: new Date().toISOString(),
      check_out_at: null,
      duration_minutes: null,
      denial_reason: null,
      membership_id: null,
      access_point_id: null,
    })
    if (error) {
      toast('error', 'No se pudo registrar el acceso')
    } else {
      toast('success', 'Acceso registrado')
      setAccessLogForm(ACCESS_LOG_FORM_EMPTY)
      loadAll()
    }
    setSavingAccessLog(false)
  }

  // ─── KPIs ─────────────────────────────────────────────────────────────────────

  const activeMemberships = memberships.filter(m => m.status === 'active').length
  const today = new Date()
  const todayDow = today.getDay()
  const classesToday = classes.filter(c => c.day_of_week === todayDow && c.is_active).length
  const sessionsToday = sessions.length

  // ─── Usuarios como options ────────────────────────────────────────────────────

  const userOptions = [
    { value: '', label: '— Seleccioná un socio —' },
    ...users.map(u => ({ value: u.id, label: u.full_name })),
  ]

  // ─── Membresías: editar ───────────────────────────────────────────────────────

  function openEditMembership(m: Membership) {
    setEditingMembership(m)
    setMembershipForm({
      user_id: m.user_id,
      plan: m.plan,
      price: String(m.price),
      billing_cycle: m.billing_cycle,
      start_date: m.start_date.slice(0, 10),
      end_date: m.end_date ? m.end_date.slice(0, 10) : '',
      status: m.status,
      auto_renew: m.auto_renew,
    })
    setMembershipModal(true)
  }

  // ─── Membresías: eliminar ─────────────────────────────────────────────────────

  async function handleDeleteMembership(id: number) {
    if (!confirm('¿Eliminás esta membresía? Esta acción no se puede deshacer.')) return
    const supabase = createClient()
    const { error } = await supabase.from('nm_gym_memberships').delete().eq('id', id)
    if (error) {
      toast('error', 'No se pudo eliminar la membresía')
    } else {
      toast('success', 'Membresía eliminada')
      loadAll()
    }
  }

  // ─── Membresías: guardar (crear o actualizar) ─────────────────────────────────

  async function handleGuardarMembresia() {
    if (!membershipForm.user_id) {
      toast('warning', 'Seleccioná un socio')
      return
    }
    if (!membershipForm.price || parseFloat(membershipForm.price) <= 0) {
      toast('warning', 'El precio debe ser mayor a 0')
      return
    }

    const supabase = createClient()
    setSavingMembership(true)

    // Re-consultar regla al momento del submit
    let finalRule = membershipRule
    try {
      finalRule = await lookupPrice({
        club_id: CLUB_ID,
        scope: 'gym_plan',
        scope_ref_id: null,
        at: new Date(membershipForm.start_date + 'T12:00:00').toISOString(),
        duration_minutes: null,
        role_slug: member?.role ?? null,
      })
    } catch {
      // uso el preview / manual
    }
    const finalPrice = finalRule?.amount ?? parseFloat(membershipForm.price)

    const payload = {
      club_id: CLUB_ID,
      user_id: membershipForm.user_id,
      plan: membershipForm.plan,
      price: finalPrice,
      price_rule_id: finalRule?.rule_id ?? null,
      billing_cycle: membershipForm.billing_cycle,
      start_date: membershipForm.start_date,
      end_date: membershipForm.end_date || null,
      status: membershipForm.status,
      auto_renew: membershipForm.auto_renew,
    }

    let error
    if (editingMembership) {
      ;({ error } = await supabase.from('nm_gym_memberships').update(payload).eq('id', editingMembership.id))
    } else {
      ;({ error } = await supabase.from('nm_gym_memberships').insert(payload))
    }

    if (error) {
      toast('error', editingMembership ? 'No se pudo actualizar la membresía' : 'No se pudo crear la membresía')
    } else {
      toast('success', editingMembership ? 'Membresía actualizada' : 'Membresía creada correctamente')
      setMembershipModal(false)
      setMembershipForm(MEMBERSHIP_FORM_EMPTY)
      setEditingMembership(null)
      loadAll()
    }
    setSavingMembership(false)
  }

  // ─── Clases: editar ───────────────────────────────────────────────────────────

  function openEditClass(c: GymClass) {
    setEditingClass(c)
    setClassForm({
      name: c.name,
      instructor_id: c.instructor_id ?? '',
      day_of_week: String(c.day_of_week),
      start_time: c.start_time.slice(0, 5),
      end_time: c.end_time.slice(0, 5),
      max_capacity: String(c.max_capacity),
      is_active: c.is_active,
    })
    setClassModal(true)
  }

  // ─── Clases: eliminar ─────────────────────────────────────────────────────────

  async function handleDeleteClass(id: number) {
    if (!confirm('¿Eliminás esta clase? Esta acción no se puede deshacer.')) return
    const supabase = createClient()
    const { error } = await supabase.from('nm_gym_classes').delete().eq('id', id)
    if (error) {
      toast('error', 'No se pudo eliminar la clase')
    } else {
      toast('success', 'Clase eliminada')
      loadAll()
    }
  }

  // ─── Clases: toggle activa ────────────────────────────────────────────────────

  async function handleToggleClassActive(c: GymClass) {
    const supabase = createClient()
    const { error } = await supabase
      .from('nm_gym_classes')
      .update({ is_active: !c.is_active })
      .eq('id', c.id)
    if (error) {
      toast('error', 'No se pudo actualizar la clase')
    } else {
      toast('info', c.is_active ? 'Clase desactivada' : 'Clase activada')
      loadAll()
    }
  }

  // ─── Clases: guardar (crear o actualizar) ────────────────────────────────────

  async function handleGuardarClase() {
    if (!classForm.name.trim()) {
      toast('warning', 'El nombre de la clase es obligatorio')
      return
    }
    if (classForm.start_time >= classForm.end_time) {
      toast('warning', 'El horario de fin debe ser posterior al de inicio')
      return
    }

    const supabase = createClient()
    setSavingClass(true)

    const payload = {
      club_id: CLUB_ID,
      name: classForm.name.trim(),
      instructor_id: classForm.instructor_id || null,
      day_of_week: parseInt(classForm.day_of_week),
      start_time: classForm.start_time,
      end_time: classForm.end_time,
      max_capacity: parseInt(classForm.max_capacity) || 15,
      is_active: classForm.is_active,
    }

    let error
    if (editingClass) {
      ;({ error } = await supabase.from('nm_gym_classes').update(payload).eq('id', editingClass.id))
    } else {
      ;({ error } = await supabase.from('nm_gym_classes').insert(payload))
    }

    if (error) {
      toast('error', editingClass ? 'No se pudo actualizar la clase' : 'No se pudo crear la clase')
    } else {
      toast('success', editingClass ? 'Clase actualizada' : 'Clase creada correctamente')
      setClassModal(false)
      setClassForm(CLASS_FORM_EMPTY)
      setEditingClass(null)
      loadAll()
    }
    setSavingClass(false)
  }

  // ─── Sesiones: checkout ───────────────────────────────────────────────────────

  async function handleCheckout(id: number) {
    const supabase = createClient()
    const now = new Date()
    const session = sessions.find(s => s.id === id)
    const durationMinutes = session
      ? Math.round((now.getTime() - new Date(session.check_in).getTime()) / 60000)
      : null

    const { error } = await supabase
      .from('nm_gym_sessions')
      .update({
        check_out: now.toISOString(),
        duration_minutes: durationMinutes,
      })
      .eq('id', id)

    if (error) {
      toast('error', 'No se pudo registrar el check-out')
    } else {
      toast('success', 'Check-out registrado')
      loadAll()
    }
  }

  // ─── Sesiones: eliminar ───────────────────────────────────────────────────────

  async function handleDeleteSession(id: number) {
    if (!confirm('¿Eliminás esta sesión? Esta acción no se puede deshacer.')) return
    const supabase = createClient()
    const { error } = await supabase.from('nm_gym_sessions').delete().eq('id', id)
    if (error) {
      toast('error', 'No se pudo eliminar la sesión')
    } else {
      toast('success', 'Sesión eliminada')
      loadAll()
    }
  }

  // ─── Sesiones: registrar check-in ────────────────────────────────────────────

  async function handleRegistrarSesion() {
    if (!sessionForm.user_id) {
      toast('warning', 'Seleccioná un socio')
      return
    }

    const supabase = createClient()
    setSavingSession(true)

    // Si es clase, re-consultar la regla al submit
    let finalRule = sessionRule
    if (sessionForm.type === 'clase') {
      try {
        finalRule = await lookupPrice({
          club_id: CLUB_ID,
          scope: 'class',
          scope_ref_id: null,
          at: new Date(sessionForm.check_in).toISOString(),
          duration_minutes: null,
          role_slug: member?.role ?? null,
        })
      } catch {
        // ignoro, uso preview
      }
    } else {
      finalRule = null
    }

    const { error } = await supabase.from('nm_gym_sessions').insert({
      club_id: CLUB_ID,
      user_id: sessionForm.user_id,
      check_in: new Date(sessionForm.check_in).toISOString(),
      check_out: null,
      duration_minutes: null,
      type: sessionForm.type,
      price_amount: finalRule?.amount ?? null,
      price_rule_id: finalRule?.rule_id ?? null,
    })

    if (error) {
      toast('error', 'No se pudo registrar el check-in')
    } else {
      toast('success', 'Check-in registrado')
      setSessionModal(false)
      setSessionForm(SESSION_FORM_EMPTY)
      loadAll()
    }
    setSavingSession(false)
  }

  // ─── Render ───────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Gestión Gimnasio</h1>
          <p className="text-sm text-slate-400 mt-1">Membresías, clases y accesos del gimnasio</p>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <KpiCard
          title="Membresías activas"
          value={activeMemberships}
          icon={<Users size={20} />}
          color="#06b6d4"
        />
        <KpiCard
          title="Clases hoy"
          value={classesToday}
          subtitle={`${DIAS_SEMANA[todayDow]} — clases programadas`}
          icon={<CalendarDays size={20} />}
          color="#8b5cf6"
        />
        <KpiCard
          title="Sesiones hoy"
          value={sessionsToday}
          subtitle="check-ins del día"
          icon={<Activity size={20} />}
          color="#10b981"
        />
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-slate-700 overflow-x-auto">
        {(['socios', 'membresias', 'clases', 'sesiones', 'personal'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={[
              'px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px whitespace-nowrap',
              activeTab === tab
                ? 'border-cyan-500 text-cyan-400'
                : 'border-transparent text-slate-400 hover:text-slate-200',
            ].join(' ')}
          >
            {tab === 'socios' ? 'Socios'
              : tab === 'membresias' ? 'Membresías'
              : tab === 'clases' ? 'Clases'
              : tab === 'sesiones' ? 'Sesiones'
              : 'Control de Personal'}
          </button>
        ))}
      </div>

      {/* Contenido por tab */}
      {loading ? (
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-12 rounded-lg bg-slate-800/50 animate-pulse border border-slate-700/50" />
          ))}
        </div>
      ) : (
        <>
          {activeTab === 'socios' && (
            <SociosTab memberships={memberships} users={users} />
          )}
          {activeTab === 'membresias' && (
            <MembershipsTab
              memberships={memberships}
              onNueva={() => {
                setEditingMembership(null)
                setMembershipForm(MEMBERSHIP_FORM_EMPTY)
                setMembershipModal(true)
              }}
              onEdit={openEditMembership}
              onDelete={handleDeleteMembership}
            />
          )}
          {activeTab === 'clases' && (
            <ClassesTab
              classes={classes}
              onNueva={() => {
                setEditingClass(null)
                setClassForm(CLASS_FORM_EMPTY)
                setClassModal(true)
              }}
              onEdit={openEditClass}
              onDelete={handleDeleteClass}
              onToggleActive={handleToggleClassActive}
            />
          )}
          {activeTab === 'sesiones' && (
            <SessionsTab
              sessions={sessions}
              onCheckin={() => {
                setSessionForm(SESSION_FORM_EMPTY)
                setSessionModal(true)
              }}
              onCheckout={handleCheckout}
              onDelete={handleDeleteSession}
            />
          )}
          {activeTab === 'personal' && (
            <StaffControlTab
              accessLogs={accessLogs}
              staffActivity={staffActivity}
              users={users}
              accessLogForm={accessLogForm}
              setAccessLogForm={setAccessLogForm}
              savingAccessLog={savingAccessLog}
              onRegistrarAcceso={handleRegistrarAcceso}
              onAccessCheckout={handleAccessCheckout}
              now={now}
            />
          )}
        </>
      )}

      {/* Modal membresía (nueva o editar) */}
      <Modal
        open={membershipModal}
        onClose={() => {
          setMembershipModal(false)
          setEditingMembership(null)
          setMembershipForm(MEMBERSHIP_FORM_EMPTY)
        }}
        title={editingMembership ? 'Editar membresía' : 'Nueva membresía'}
        size="md"
        footer={
          <>
            <Button variant="secondary" onClick={() => {
              setMembershipModal(false)
              setEditingMembership(null)
              setMembershipForm(MEMBERSHIP_FORM_EMPTY)
            }}>
              Cancelar
            </Button>
            <Button loading={savingMembership} onClick={handleGuardarMembresia}>
              {editingMembership ? <Edit3 size={14} /> : <Plus size={14} />}
              {editingMembership ? 'Actualizar' : 'Crear membresía'}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Select
            id="mb-user"
            label="Socio *"
            value={membershipForm.user_id}
            options={userOptions}
            onChange={e => setMembershipForm(f => ({ ...f, user_id: e.target.value }))}
          />
          <div className="grid grid-cols-2 gap-4">
            <Select
              id="mb-plan"
              label="Plan"
              value={membershipForm.plan}
              options={PLAN_OPTIONS}
              onChange={e => setMembershipForm(f => ({ ...f, plan: e.target.value }))}
            />
            <Select
              id="mb-billing"
              label="Ciclo de cobro"
              value={membershipForm.billing_cycle}
              options={BILLING_OPTIONS}
              onChange={e => setMembershipForm(f => ({ ...f, billing_cycle: e.target.value }))}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input
              id="mb-price"
              label="Precio *"
              type="number"
              min="0"
              step="0.01"
              placeholder="0.00"
              value={membershipForm.price}
              onChange={e => setMembershipForm(f => ({ ...f, price: e.target.value }))}
            />
            <Select
              id="mb-status"
              label="Estado"
              value={membershipForm.status}
              options={STATUS_OPTIONS}
              onChange={e => setMembershipForm(f => ({ ...f, status: e.target.value }))}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input
              id="mb-start"
              label="Fecha inicio"
              type="date"
              value={membershipForm.start_date}
              onChange={e => setMembershipForm(f => ({ ...f, start_date: e.target.value }))}
            />
            <Input
              id="mb-end"
              label="Fecha vencimiento"
              type="date"
              value={membershipForm.end_date}
              onChange={e => setMembershipForm(f => ({ ...f, end_date: e.target.value }))}
            />
          </div>
          <ToggleSwitch
            id="mb-autorenew"
            label="Renovación automática"
            checked={membershipForm.auto_renew}
            onChange={v => setMembershipForm(f => ({ ...f, auto_renew: v }))}
          />

          {/* Preview regla aplicada */}
          <div className="bg-slate-800/50 rounded-lg px-4 py-3 border border-slate-700/50">
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-400">
                Precio unificado {membershipRuleLoading && <span className="text-xs text-slate-500">(calculando…)</span>}
              </span>
              <span className="text-lg font-bold text-cyan-400">
                {membershipRule ? `${membershipRule.amount.toFixed(2)} ${membershipRule.currency}` : '—'}
              </span>
            </div>
            {membershipRule ? (
              <div className="mt-2 flex items-center gap-2 text-xs text-slate-400">
                <Tag size={11} className="text-cyan-400" />
                <span>Regla:</span>
                <Badge variant="cyan">{membershipRule.name}</Badge>
                <span className="text-slate-600">#{membershipRule.rule_id}</span>
              </div>
            ) : !membershipRuleLoading && (
              <div className="mt-2 text-xs text-amber-400/80">
                Sin regla en <code>nm_price_rules</code> (scope=gym_plan) · se usará el precio manual
              </div>
            )}
          </div>
        </div>
      </Modal>

      {/* Modal clase (nueva o editar) */}
      <Modal
        open={classModal}
        onClose={() => {
          setClassModal(false)
          setEditingClass(null)
          setClassForm(CLASS_FORM_EMPTY)
        }}
        title={editingClass ? 'Editar clase' : 'Nueva clase'}
        size="md"
        footer={
          <>
            <Button variant="secondary" onClick={() => {
              setClassModal(false)
              setEditingClass(null)
              setClassForm(CLASS_FORM_EMPTY)
            }}>
              Cancelar
            </Button>
            <Button loading={savingClass} onClick={handleGuardarClase}>
              {editingClass ? <Edit3 size={14} /> : <Plus size={14} />}
              {editingClass ? 'Actualizar' : 'Crear clase'}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Input
            id="cl-name"
            label="Nombre de la clase *"
            placeholder="Ej: Yoga, Spinning, CrossFit..."
            value={classForm.name}
            onChange={e => setClassForm(f => ({ ...f, name: e.target.value }))}
          />
          <div className="grid grid-cols-2 gap-4">
            <Select
              id="cl-day"
              label="Día de la semana"
              value={classForm.day_of_week}
              options={DIAS_OPTIONS}
              onChange={e => setClassForm(f => ({ ...f, day_of_week: e.target.value }))}
            />
            <Input
              id="cl-capacity"
              label="Capacidad máx."
              type="number"
              min="1"
              step="1"
              value={classForm.max_capacity}
              onChange={e => setClassForm(f => ({ ...f, max_capacity: e.target.value }))}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input
              id="cl-start"
              label="Hora inicio"
              type="time"
              value={classForm.start_time}
              onChange={e => setClassForm(f => ({ ...f, start_time: e.target.value }))}
            />
            <Input
              id="cl-end"
              label="Hora fin"
              type="time"
              value={classForm.end_time}
              onChange={e => setClassForm(f => ({ ...f, end_time: e.target.value }))}
            />
          </div>
          <Select
            id="cl-instructor"
            label="Instructor (opcional)"
            value={classForm.instructor_id}
            options={[{ value: '', label: '— Sin instructor —' }, ...users.map(u => ({ value: u.id, label: u.full_name }))]}
            onChange={e => setClassForm(f => ({ ...f, instructor_id: e.target.value }))}
          />
          <ToggleSwitch
            id="cl-active"
            label="Clase activa"
            checked={classForm.is_active}
            onChange={v => setClassForm(f => ({ ...f, is_active: v }))}
          />
        </div>
      </Modal>

      {/* Modal check-in manual */}
      <Modal
        open={sessionModal}
        onClose={() => setSessionModal(false)}
        title="Registrar check-in"
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setSessionModal(false)}>
              Cancelar
            </Button>
            <Button loading={savingSession} onClick={handleRegistrarSesion}>
              <LogIn size={14} />
              Registrar
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Select
            id="sess-user"
            label="Socio *"
            value={sessionForm.user_id}
            options={userOptions}
            onChange={e => setSessionForm(f => ({ ...f, user_id: e.target.value }))}
          />
          <Select
            id="sess-type"
            label="Tipo de sesión"
            value={sessionForm.type}
            options={SESSION_TYPE_OPTIONS}
            onChange={e => setSessionForm(f => ({ ...f, type: e.target.value }))}
          />
          <Input
            id="sess-checkin"
            label="Hora de entrada"
            type="datetime-local"
            value={sessionForm.check_in}
            onChange={e => setSessionForm(f => ({ ...f, check_in: e.target.value }))}
          />

          {sessionForm.type === 'clase' && (
            <div className="bg-slate-800/50 rounded-lg px-4 py-3 border border-slate-700/50">
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-400">
                  Precio clase {sessionRuleLoading && <span className="text-xs text-slate-500">(calculando…)</span>}
                </span>
                <span className="text-lg font-bold text-cyan-400">
                  {sessionRule ? `${sessionRule.amount.toFixed(2)} ${sessionRule.currency}` : '—'}
                </span>
              </div>
              {sessionRule ? (
                <div className="mt-2 flex items-center gap-2 text-xs text-slate-400">
                  <Tag size={11} className="text-cyan-400" />
                  <span>Regla:</span>
                  <Badge variant="cyan">{sessionRule.name}</Badge>
                  <span className="text-slate-600">#{sessionRule.rule_id}</span>
                </div>
              ) : !sessionRuleLoading && (
                <div className="mt-2 text-xs text-amber-400/80">
                  Sin regla en <code>nm_price_rules</code> (scope=class) · clase incluida en plan
                </div>
              )}
            </div>
          )}
        </div>
      </Modal>
    </div>
  )
}

// ─── Tab: Membresías ──────────────────────────────────────────────────────────

function MembershipsTab({
  memberships,
  onNueva,
  onEdit,
  onDelete,
}: {
  memberships: Membership[]
  onNueva: () => void
  onEdit: (m: Membership) => void
  onDelete: (id: number) => void
}) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-400">{memberships.length} membresías registradas</p>
        <Button size="sm" onClick={onNueva}>
          <Plus size={14} />
          Nueva membresía
        </Button>
      </div>

      {memberships.length === 0 ? (
        <EmptyState icon={<Users size={36} />} label="No hay membresías registradas" />
      ) : (
        <div className="rounded-xl border border-slate-700/50 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-700/50 bg-slate-800/80">
                <th className="px-4 py-3 text-left font-medium text-slate-400">Socio</th>
                <th className="px-4 py-3 text-left font-medium text-slate-400">Plan</th>
                <th className="px-4 py-3 text-left font-medium text-slate-400">Precio</th>
                <th className="px-4 py-3 text-left font-medium text-slate-400">Estado</th>
                <th className="px-4 py-3 text-left font-medium text-slate-400">Inicio</th>
                <th className="px-4 py-3 text-left font-medium text-slate-400">Vence</th>
                <th className="px-4 py-3 text-left font-medium text-slate-400">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {memberships.map((m, i) => (
                <tr
                  key={m.id}
                  className={[
                    'border-b border-slate-700/30 last:border-0 transition-colors hover:bg-slate-800/40',
                    i % 2 === 0 ? 'bg-slate-800/20' : 'bg-transparent',
                  ].join(' ')}
                >
                  <td className="px-4 py-3 text-white font-medium">
                    {m.nm_users?.full_name ?? <span className="text-slate-500 italic">Sin nombre</span>}
                  </td>
                  <td className="px-4 py-3 text-slate-300 capitalize">{m.plan}</td>
                  <td className="px-4 py-3 text-slate-300">{formatCurrency(m.price)}</td>
                  <td className="px-4 py-3">
                    <Badge variant={statusBadgeVariant(m.status)}>
                      {statusLabel(m.status)}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-slate-400 text-xs">
                    {formatDate(m.start_date, { day: 'numeric', month: 'short', year: 'numeric' })}
                  </td>
                  <td className="px-4 py-3 text-slate-400 text-xs">
                    {m.end_date
                      ? formatDate(m.end_date, { day: 'numeric', month: 'short', year: 'numeric' })
                      : <span className="text-slate-600">—</span>}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="sm" onClick={() => onEdit(m)} title="Editar">
                        <Edit3 size={14} />
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => onDelete(m.id)} title="Eliminar" className="text-red-400 hover:text-red-300">
                        <Trash2 size={14} />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ─── Tab: Clases ──────────────────────────────────────────────────────────────

function ClassesTab({
  classes,
  onNueva,
  onEdit,
  onDelete,
  onToggleActive,
}: {
  classes: GymClass[]
  onNueva: () => void
  onEdit: (c: GymClass) => void
  onDelete: (id: number) => void
  onToggleActive: (c: GymClass) => void
}) {
  const classesByDay = [0, 1, 2, 3, 4, 5, 6].reduce<Record<number, GymClass[]>>((acc, d) => {
    acc[d] = classes.filter(c => c.day_of_week === d)
    return acc
  }, {} as Record<number, GymClass[]>)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-400">Horario semanal — {classes.filter(c => c.is_active).length} clases activas</p>
        <Button size="sm" onClick={onNueva}>
          <Plus size={14} />
          Nueva clase
        </Button>
      </div>

      {classes.length === 0 ? (
        <EmptyState icon={<CalendarDays size={36} />} label="No hay clases programadas" />
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
          {[0, 1, 2, 3, 4, 5, 6].map(d => (
            <div key={d} className="rounded-xl border border-slate-700/50 bg-slate-800/30 overflow-hidden">
              {/* Header del día */}
              <div className="px-3 py-2 bg-slate-800/60 border-b border-slate-700/50 text-center">
                <span className="text-xs font-semibold text-slate-300">{DIAS_SEMANA[d]}</span>
              </div>
              {/* Clases del día */}
              <div className="p-2 space-y-1.5 min-h-[80px]">
                {classesByDay[d].length === 0 ? (
                  <p className="text-xs text-slate-600 text-center pt-2">Sin clases</p>
                ) : (
                  classesByDay[d].map(c => (
                    <div
                      key={c.id}
                      className={[
                        'rounded-lg px-2 py-1.5 border',
                        c.is_active
                          ? 'bg-cyan-500/10 border-cyan-500/20'
                          : 'bg-slate-700/30 border-slate-600/30',
                      ].join(' ')}
                    >
                      <p className={['text-xs font-semibold truncate', c.is_active ? 'text-cyan-300' : 'text-slate-500'].join(' ')}>
                        {c.name}
                      </p>
                      <div className="flex items-center gap-1 mt-0.5">
                        <Clock size={10} className="text-slate-500 shrink-0" />
                        <span className="text-[10px] text-slate-500">
                          {formatTimeStr(c.start_time)}–{formatTimeStr(c.end_time)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between mt-0.5">
                        <span className="text-[10px] text-slate-600">Máx. {c.max_capacity}</span>
                        {!c.is_active && (
                          <span className="text-[10px] text-slate-600">Inactiva</span>
                        )}
                      </div>
                      {/* Acciones */}
                      <div className="flex items-center gap-0.5 mt-1.5 pt-1.5 border-t border-slate-700/40">
                        <button
                          onClick={() => onEdit(c)}
                          title="Editar"
                          className="p-0.5 rounded text-slate-400 hover:text-cyan-300 transition-colors"
                        >
                          <Edit3 size={11} />
                        </button>
                        <button
                          onClick={() => onToggleActive(c)}
                          title={c.is_active ? 'Desactivar' : 'Activar'}
                          className={['p-0.5 rounded transition-colors', c.is_active ? 'text-green-400 hover:text-green-300' : 'text-slate-500 hover:text-green-400'].join(' ')}
                        >
                          {c.is_active ? <CheckCircle size={11} /> : <XCircle size={11} />}
                        </button>
                        <button
                          onClick={() => onDelete(c.id)}
                          title="Eliminar"
                          className="p-0.5 rounded text-slate-500 hover:text-red-400 transition-colors"
                        >
                          <Trash2 size={11} />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Tab: Sesiones ────────────────────────────────────────────────────────────

function SessionsTab({
  sessions,
  onCheckin,
  onCheckout,
  onDelete,
}: {
  sessions: GymSession[]
  onCheckin: () => void
  onCheckout: (id: number) => void
  onDelete: (id: number) => void
}) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-400">
          {sessions.length > 0
            ? `${sessions.length} check-in${sessions.length !== 1 ? 's' : ''} hoy`
            : 'Sin accesos registrados hoy'}
        </p>
        <Button size="sm" onClick={onCheckin}>
          <LogIn size={14} />
          Registrar check-in
        </Button>
      </div>

      {sessions.length === 0 ? (
        <EmptyState icon={<Dumbbell size={36} />} label="No hubo accesos al gimnasio hoy" />
      ) : (
        <div className="rounded-xl border border-slate-700/50 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-700/50 bg-slate-800/80">
                <th className="px-4 py-3 text-left font-medium text-slate-400">Socio</th>
                <th className="px-4 py-3 text-left font-medium text-slate-400">Tipo</th>
                <th className="px-4 py-3 text-left font-medium text-slate-400">Entrada</th>
                <th className="px-4 py-3 text-left font-medium text-slate-400">Salida</th>
                <th className="px-4 py-3 text-left font-medium text-slate-400">Duración</th>
                <th className="px-4 py-3 text-left font-medium text-slate-400">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {sessions.map((s, i) => {
                const checkInDate = new Date(s.check_in)
                const checkOutDate = s.check_out ? new Date(s.check_out) : null
                return (
                  <tr
                    key={s.id}
                    className={[
                      'border-b border-slate-700/30 last:border-0 transition-colors hover:bg-slate-800/40',
                      i % 2 === 0 ? 'bg-slate-800/20' : 'bg-transparent',
                    ].join(' ')}
                  >
                    <td className="px-4 py-3 text-white font-medium">
                      {s.nm_users?.full_name ?? <span className="text-slate-500 italic">Sin nombre</span>}
                    </td>
                    <td className="px-4 py-3 text-slate-300 capitalize">{s.type}</td>
                    <td className="px-4 py-3 text-slate-300">
                      {checkInDate.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td className="px-4 py-3 text-slate-400">
                      {checkOutDate
                        ? checkOutDate.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })
                        : (
                          <span className="flex items-center gap-1 text-green-400">
                            <CheckCircle size={12} />
                            Adentro
                          </span>
                        )}
                    </td>
                    <td className="px-4 py-3 text-slate-400 text-xs">
                      {s.duration_minutes != null
                        ? `${s.duration_minutes} min`
                        : checkOutDate
                          ? `${Math.round((checkOutDate.getTime() - checkInDate.getTime()) / 60000)} min`
                          : <span className="text-slate-600">—</span>}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        {!s.check_out && (
                          <Button variant="ghost" size="sm" onClick={() => onCheckout(s.id)} title="Registrar salida" className="text-green-400 hover:text-green-300">
                            <LogOut size={14} />
                          </Button>
                        )}
                        <Button variant="ghost" size="sm" onClick={() => onDelete(s.id)} title="Eliminar" className="text-red-400 hover:text-red-300">
                          <Trash2 size={14} />
                        </Button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ─── Tab: Control de Personal ────────────────────────────────────────────────

function authMethodIcon(method: string) {
  const cls = 'inline-block'
  switch (method) {
    case 'qr': return <QrCode size={14} className={cls} />
    case 'nfc': return <Wifi size={14} className={cls} />
    case 'pin': return <Key size={14} className={cls} />
    case 'fingerprint': return <Fingerprint size={14} className={cls} />
    case 'facial': return <Smartphone size={14} className={cls} />
    default: return <Hand size={14} className={cls} />
  }
}

function actionTypeColor(action: string): string {
  if (action.includes('check') || action.includes('access')) return 'text-cyan-400'
  if (action.includes('open') || action.includes('start')) return 'text-green-400'
  if (action.includes('close') || action.includes('end')) return 'text-orange-400'
  if (action.includes('deny') || action.includes('error')) return 'text-red-400'
  if (action.includes('sale') || action.includes('cash')) return 'text-yellow-400'
  return 'text-slate-300'
}

function elapsedLabel(checkInAt: string, now: Date): string {
  const mins = Math.round((now.getTime() - new Date(checkInAt).getTime()) / 60000)
  if (mins < 60) return `${mins} min`
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return `${h}h ${m}m`
}

function StaffControlTab({
  accessLogs,
  staffActivity,
  users,
  accessLogForm,
  setAccessLogForm,
  savingAccessLog,
  onRegistrarAcceso,
  onAccessCheckout,
  now,
}: {
  accessLogs: GymAccessLogRow[]
  staffActivity: GymStaffActivityRow[]
  users: GymUser[]
  accessLogForm: AccessLogForm
  setAccessLogForm: React.Dispatch<React.SetStateAction<AccessLogForm>>
  savingAccessLog: boolean
  onRegistrarAcceso: () => void
  onAccessCheckout: (id: number) => void
  now: Date
}) {
  const presentes = accessLogs.filter(l => l.direction === 'in' && l.granted && !l.check_out_at)
  const totalEntradas = accessLogs.filter(l => l.direction === 'in').length
  const denegados = accessLogs.filter(l => !l.granted).length
  const logsConDuracion = accessLogs.filter(l => l.duration_minutes != null)
  const avgDuracion = logsConDuracion.length > 0
    ? Math.round(logsConDuracion.reduce((sum, l) => sum + (l.duration_minutes ?? 0), 0) / logsConDuracion.length)
    : 0

  const userOptions = [
    { value: '', label: '— Seleccioná un usuario —' },
    ...users.map(u => ({ value: u.id, label: u.full_name })),
  ]

  return (
    <div className="space-y-8">

      {/* ─── Sección A: Personal Presente ─────────────────────────────────────── */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <UserCheck size={18} className="text-cyan-400" />
          <h3 className="text-base font-semibold text-white">Personal Presente</h3>
          <span className="ml-1 rounded-full bg-cyan-500/20 px-2 py-0.5 text-xs font-medium text-cyan-300">
            {presentes.length} dentro
          </span>
        </div>

        {presentes.length === 0 ? (
          <EmptyState icon={<Users size={32} />} label="No hay nadie en el gimnasio ahora mismo" />
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {presentes.map(log => (
              <div
                key={log.id}
                className="rounded-xl border border-cyan-500/20 bg-cyan-500/5 p-4 space-y-2"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold text-white">
                      {log.nm_users?.full_name ?? <span className="text-slate-500 italic">Sin nombre</span>}
                    </p>
                    {log.zone && (
                      <p className="text-xs text-slate-400 mt-0.5">
                        {ZONE_LABELS[log.zone] ?? log.zone}
                      </p>
                    )}
                  </div>
                  <span className="shrink-0 rounded-full bg-green-500/20 px-2 py-0.5 text-[10px] font-medium text-green-400">
                    Adentro
                  </span>
                </div>
                <div className="flex items-center gap-3 text-xs text-slate-400">
                  <span className="flex items-center gap-1">
                    <Clock size={11} />
                    {new Date(log.check_in_at).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                  <span className="flex items-center gap-1 text-cyan-400">
                    <Activity size={11} />
                    {elapsedLabel(log.check_in_at, now)}
                  </span>
                  <span className="flex items-center gap-1">
                    {authMethodIcon(log.auth_method)}
                    <span className="capitalize">{log.auth_method}</span>
                  </span>
                </div>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => onAccessCheckout(log.id)}
                  className="w-full justify-center"
                >
                  <LogOut size={13} />
                  Checkout
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ─── Sección B: Accesos del Día ───────────────────────────────────────── */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Shield size={18} className="text-violet-400" />
          <h3 className="text-base font-semibold text-white">Accesos del Día</h3>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-xl border border-slate-700/50 bg-slate-800/40 px-4 py-3 text-center">
            <p className="text-2xl font-bold text-white">{totalEntradas}</p>
            <p className="text-xs text-slate-400 mt-0.5">Total entradas</p>
          </div>
          <div className="rounded-xl border border-cyan-500/20 bg-cyan-500/5 px-4 py-3 text-center">
            <p className="text-2xl font-bold text-cyan-400">{presentes.length}</p>
            <p className="text-xs text-slate-400 mt-0.5">Presentes ahora</p>
          </div>
          <div className="rounded-xl border border-slate-700/50 bg-slate-800/40 px-4 py-3 text-center">
            <p className="text-2xl font-bold text-white">{avgDuracion}</p>
            <p className="text-xs text-slate-400 mt-0.5">Duración prom. (min)</p>
          </div>
          <div className="rounded-xl border border-red-500/20 bg-red-500/5 px-4 py-3 text-center">
            <p className="text-2xl font-bold text-red-400">{denegados}</p>
            <p className="text-xs text-slate-400 mt-0.5">Denegados</p>
          </div>
        </div>

        {/* Tabla */}
        {accessLogs.length === 0 ? (
          <EmptyState icon={<Shield size={32} />} label="Sin registros de acceso hoy" />
        ) : (
          <div className="rounded-xl border border-slate-700/50 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-700/50 bg-slate-800/80">
                  <th className="px-4 py-3 text-left font-medium text-slate-400">Hora</th>
                  <th className="px-4 py-3 text-left font-medium text-slate-400">Usuario</th>
                  <th className="px-4 py-3 text-left font-medium text-slate-400">Método</th>
                  <th className="px-4 py-3 text-left font-medium text-slate-400">Dir.</th>
                  <th className="px-4 py-3 text-left font-medium text-slate-400">Duración</th>
                  <th className="px-4 py-3 text-left font-medium text-slate-400">Estado</th>
                </tr>
              </thead>
              <tbody>
                {accessLogs.map((log, i) => (
                  <tr
                    key={log.id}
                    className={[
                      'border-b border-slate-700/30 last:border-0 transition-colors hover:bg-slate-800/40',
                      i % 2 === 0 ? 'bg-slate-800/20' : 'bg-transparent',
                    ].join(' ')}
                  >
                    <td className="px-4 py-2.5 text-slate-400 text-xs">
                      {new Date(log.check_in_at).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td className="px-4 py-2.5 text-white">
                      {log.nm_users?.full_name ?? <span className="text-slate-500 italic">—</span>}
                    </td>
                    <td className="px-4 py-2.5">
                      <span className="flex items-center gap-1.5 text-slate-300">
                        {authMethodIcon(log.auth_method)}
                        <span className="text-xs capitalize">{log.auth_method}</span>
                      </span>
                    </td>
                    <td className="px-4 py-2.5">
                      {log.direction === 'in' ? (
                        <span className="flex items-center gap-1 text-green-400 text-xs">
                          <ArrowDownToLine size={12} /> Entrada
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-orange-400 text-xs">
                          <ArrowUpFromLine size={12} /> Salida
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-slate-400 text-xs">
                      {log.duration_minutes != null
                        ? `${log.duration_minutes} min`
                        : !log.check_out_at && log.direction === 'in'
                          ? <span className="text-cyan-400">{elapsedLabel(log.check_in_at, now)}</span>
                          : <span className="text-slate-600">—</span>}
                    </td>
                    <td className="px-4 py-2.5">
                      {log.granted ? (
                        <span className="flex items-center gap-1 text-green-400 text-xs">
                          <CheckCircle size={12} /> OK
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-red-400 text-xs" title={log.denial_reason ?? ''}>
                          <AlertCircle size={12} /> Denegado
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ─── Sección C: Actividad del Staff ──────────────────────────────────── */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Activity size={18} className="text-yellow-400" />
          <h3 className="text-base font-semibold text-white">Actividad del Staff</h3>
        </div>

        {staffActivity.length === 0 ? (
          <EmptyState icon={<Activity size={32} />} label="Sin actividad registrada hoy" />
        ) : (
          <div className="rounded-xl border border-slate-700/50 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-700/50 bg-slate-800/80">
                  <th className="px-4 py-3 text-left font-medium text-slate-400">Hora</th>
                  <th className="px-4 py-3 text-left font-medium text-slate-400">Staff</th>
                  <th className="px-4 py-3 text-left font-medium text-slate-400">Acción</th>
                  <th className="px-4 py-3 text-left font-medium text-slate-400">Descripción</th>
                  <th className="px-4 py-3 text-left font-medium text-slate-400">Referencia</th>
                </tr>
              </thead>
              <tbody>
                {staffActivity.map((act, i) => (
                  <tr
                    key={act.id}
                    className={[
                      'border-b border-slate-700/30 last:border-0 transition-colors hover:bg-slate-800/40',
                      i % 2 === 0 ? 'bg-slate-800/20' : 'bg-transparent',
                    ].join(' ')}
                  >
                    <td className="px-4 py-2.5 text-slate-400 text-xs">
                      {new Date(act.created_at).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td className="px-4 py-2.5 text-white">
                      {act.nm_users?.full_name ?? <span className="text-slate-500 italic">—</span>}
                    </td>
                    <td className="px-4 py-2.5">
                      <span className={['text-xs font-medium capitalize', actionTypeColor(act.action_type)].join(' ')}>
                        {act.action_type.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-slate-400 text-xs max-w-[220px] truncate">
                      {act.description ?? <span className="text-slate-600">—</span>}
                    </td>
                    <td className="px-4 py-2.5 text-slate-500 text-xs">
                      {act.reference_type && act.reference_id
                        ? `${act.reference_type} #${act.reference_id}`
                        : <span className="text-slate-700">—</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ─── Sección D: Registro de Acceso Manual ────────────────────────────── */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <LogIn size={18} className="text-emerald-400" />
          <h3 className="text-base font-semibold text-white">Registro de Acceso Manual</h3>
        </div>

        <div className="rounded-xl border border-slate-700/50 bg-slate-800/30 p-5">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Select
              id="access-user"
              label="Usuario *"
              value={accessLogForm.user_id}
              options={userOptions}
              onChange={e => setAccessLogForm(f => ({ ...f, user_id: e.target.value }))}
            />
            <Select
              id="access-method"
              label="Método"
              value={accessLogForm.auth_method}
              options={AUTH_METHOD_OPTIONS}
              onChange={e => setAccessLogForm(f => ({ ...f, auth_method: e.target.value }))}
            />
            <Select
              id="access-direction"
              label="Dirección"
              value={accessLogForm.direction}
              options={[
                { value: 'in', label: 'Entrada' },
                { value: 'out', label: 'Salida' },
              ]}
              onChange={e => setAccessLogForm(f => ({ ...f, direction: e.target.value as 'in' | 'out' }))}
            />
            <Select
              id="access-zone"
              label="Zona"
              value={accessLogForm.zone}
              options={ZONE_OPTIONS}
              onChange={e => setAccessLogForm(f => ({ ...f, zone: e.target.value }))}
            />
          </div>
          <div className="mt-4 flex justify-end">
            <Button loading={savingAccessLog} onClick={onRegistrarAcceso}>
              <LogIn size={14} />
              Registrar acceso
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Utilidades UI ────────────────────────────────────────────────────────────

function EmptyState({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div className="rounded-xl border border-slate-700/50 bg-slate-800/30 p-12 text-center">
      <div className="mx-auto mb-3 text-slate-600 flex justify-center">{icon}</div>
      <p className="text-slate-400">{label}</p>
    </div>
  )
}

function ToggleSwitch({
  id,
  label,
  checked,
  onChange,
}: {
  id: string
  label: string
  checked: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <label htmlFor={id} className="flex items-center gap-2.5 cursor-pointer select-none">
      <div
        className={[
          'relative w-10 h-5 rounded-full transition-colors',
          checked ? 'bg-cyan-600' : 'bg-slate-600',
        ].join(' ')}
      >
        <input
          id={id}
          type="checkbox"
          className="sr-only"
          checked={checked}
          onChange={e => onChange(e.target.checked)}
        />
        <span
          className={[
            'absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform',
            checked ? 'translate-x-5' : 'translate-x-0',
          ].join(' ')}
        />
      </div>
      <span className="text-sm text-slate-300">{label}</span>
    </label>
  )
}

// ─── Tab: Socios (listado con link a ficha completa) ─────────────────────────
function SociosTab({
  memberships,
  users,
}: {
  memberships: Membership[]
  users: GymUser[]
}) {
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'expired'>('all')

  const sociosMap = new Map<string, { user: GymUser | undefined; memberships: Membership[] }>()
  for (const m of memberships) {
    const existing = sociosMap.get(m.user_id)
    if (existing) {
      existing.memberships.push(m)
    } else {
      const user = users.find(u => u.id === m.user_id)
      sociosMap.set(m.user_id, { user, memberships: [m] })
    }
  }
  const socios = Array.from(sociosMap.values())

  const today = new Date().toISOString().slice(0, 10)
  const filtered = socios.filter(s => {
    const hasActive = s.memberships.some(m => m.status === 'active' && (!m.end_date || m.end_date >= today))
    if (filterStatus === 'active' && !hasActive) return false
    if (filterStatus === 'expired' && hasActive) return false
    if (search.trim()) {
      const q = search.toLowerCase()
      const name = s.user?.full_name ?? ''
      if (!name.toLowerCase().includes(q)) return false
    }
    return true
  })

  return (
    <div className="space-y-4">
      <div className="flex flex-col md:flex-row gap-3">
        <input
          type="text"
          placeholder="Buscar por nombre…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="flex-1 rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-white placeholder-slate-500"
        />
        <select
          value={filterStatus}
          onChange={e => setFilterStatus(e.target.value as 'all' | 'active' | 'expired')}
          className="rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-white md:w-48"
        >
          <option value="all">Todos</option>
          <option value="active">Abono activo</option>
          <option value="expired">Sin abono activo</option>
        </select>
      </div>

      <div className="rounded-xl border border-slate-700/50 bg-slate-800/50 overflow-hidden">
        {filtered.length === 0 ? (
          <div className="p-12 text-center text-slate-500 text-sm">
            {search ? 'Sin resultados' : 'Todavía no hay socios del gym. Importá desde Virtuagym.'}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-900/60">
                <tr className="text-left text-slate-400 text-xs uppercase tracking-wider">
                  <th className="px-4 py-3">Socio</th>
                  <th className="px-4 py-3">Abono actual</th>
                  <th className="px-4 py-3">Desde</th>
                  <th className="px-4 py-3">Hasta</th>
                  <th className="px-4 py-3">Estado</th>
                  <th className="px-4 py-3 text-right"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {filtered.map(s => {
                  const current = s.memberships.find(m => m.status === 'active' && (!m.end_date || m.end_date >= today))
                    ?? s.memberships[0]
                  const isActive = current.status === 'active' && (!current.end_date || current.end_date >= today)
                  return (
                    <tr key={s.user?.id ?? current.user_id} className="hover:bg-slate-700/30">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="h-7 w-7 rounded-full bg-slate-700 flex items-center justify-center text-xs font-bold text-cyan-400">
                            {(s.user?.full_name ?? '?').charAt(0).toUpperCase()}
                          </div>
                          <span className="font-medium text-white">{s.user?.full_name ?? '—'}</span>
                          {s.memberships.length > 1 && (
                            <Badge variant="default">{s.memberships.length} abonos</Badge>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-slate-300">{current.plan}</td>
                      <td className="px-4 py-3 text-slate-400">{formatDate(current.start_date)}</td>
                      <td className="px-4 py-3 text-slate-400">{current.end_date ? formatDate(current.end_date) : '—'}</td>
                      <td className="px-4 py-3">
                        <Badge variant={isActive ? 'success' : 'danger'}>
                          {isActive ? 'Activo' : 'Vencido'}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Link
                          href={`/admin/gimnasio/socio/${current.user_id}`}
                          className="text-cyan-400 hover:text-cyan-300 text-xs font-medium"
                        >
                          Ver ficha →
                        </Link>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
        {filtered.length > 0 && (
          <div className="px-4 py-3 border-t border-slate-700/40 text-xs text-slate-500">
            {filtered.length} socio(s) · Click en &quot;Ver ficha&quot; para abrir ficha completa con físico, objetivos, accesos, facturación y notas.
          </div>
        )}
      </div>
    </div>
  )
}
