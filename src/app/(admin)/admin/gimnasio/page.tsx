'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  Dumbbell,
  CalendarDays,
  Users,
  Plus,
  LogIn,
  Clock,
  CheckCircle,
  XCircle,
  Activity,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
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

type MembershipForm = typeof MEMBERSHIP_FORM_EMPTY
type ClassForm = typeof CLASS_FORM_EMPTY
type SessionForm = typeof SESSION_FORM_EMPTY

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

  // Tabs
  const [activeTab, setActiveTab] = useState<'membresias' | 'clases' | 'sesiones'>('membresias')

  // Datos
  const [memberships, setMemberships] = useState<Membership[]>([])
  const [classes, setClasses] = useState<GymClass[]>([])
  const [sessions, setSessions] = useState<GymSession[]>([])
  const [users, setUsers] = useState<GymUser[]>([])
  const [loading, setLoading] = useState(true)

  // Modales
  const [membershipModal, setMembershipModal] = useState(false)
  const [classModal, setClassModal] = useState(false)
  const [sessionModal, setSessionModal] = useState(false)

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

    const [membRes, classRes, sessRes, usersRes] = await Promise.all([
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
    ])

    if (membRes.error) toast('error', 'Error al cargar membresías')
    else setMemberships((membRes.data as Membership[]) ?? [])

    if (classRes.error) toast('error', 'Error al cargar clases')
    else setClasses((classRes.data as GymClass[]) ?? [])

    if (sessRes.error) toast('error', 'Error al cargar sesiones')
    else setSessions((sessRes.data as GymSession[]) ?? [])

    if (usersRes.error) toast('error', 'Error al cargar usuarios')
    else setUsers((usersRes.data as GymUser[]) ?? [])

    setLoading(false)
  }, [toast])

  useEffect(() => {
    loadAll()
  }, [loadAll])

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

  // ─── Membresías: guardar ──────────────────────────────────────────────────────

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

    const { error } = await supabase.from('nm_gym_memberships').insert({
      club_id: CLUB_ID,
      user_id: membershipForm.user_id,
      plan: membershipForm.plan,
      price: parseFloat(membershipForm.price),
      billing_cycle: membershipForm.billing_cycle,
      start_date: membershipForm.start_date,
      end_date: membershipForm.end_date || null,
      status: membershipForm.status,
      auto_renew: membershipForm.auto_renew,
    })

    if (error) {
      toast('error', 'No se pudo crear la membresía')
    } else {
      toast('success', 'Membresía creada correctamente')
      setMembershipModal(false)
      setMembershipForm(MEMBERSHIP_FORM_EMPTY)
      loadAll()
    }
    setSavingMembership(false)
  }

  // ─── Clases: guardar ──────────────────────────────────────────────────────────

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

    const { error } = await supabase.from('nm_gym_classes').insert({
      club_id: CLUB_ID,
      name: classForm.name.trim(),
      instructor_id: classForm.instructor_id || null,
      day_of_week: parseInt(classForm.day_of_week),
      start_time: classForm.start_time,
      end_time: classForm.end_time,
      max_capacity: parseInt(classForm.max_capacity) || 15,
      is_active: classForm.is_active,
    })

    if (error) {
      toast('error', 'No se pudo crear la clase')
    } else {
      toast('success', 'Clase creada correctamente')
      setClassModal(false)
      setClassForm(CLASS_FORM_EMPTY)
      loadAll()
    }
    setSavingClass(false)
  }

  // ─── Sesiones: registrar check-in ────────────────────────────────────────────

  async function handleRegistrarSesion() {
    if (!sessionForm.user_id) {
      toast('warning', 'Seleccioná un socio')
      return
    }

    const supabase = createClient()
    setSavingSession(true)

    const { error } = await supabase.from('nm_gym_sessions').insert({
      club_id: CLUB_ID,
      user_id: sessionForm.user_id,
      check_in: new Date(sessionForm.check_in).toISOString(),
      check_out: null,
      duration_minutes: null,
      type: sessionForm.type,
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
      <div className="flex gap-1 border-b border-slate-700">
        {(['membresias', 'clases', 'sesiones'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={[
              'px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px',
              activeTab === tab
                ? 'border-cyan-500 text-cyan-400'
                : 'border-transparent text-slate-400 hover:text-slate-200',
            ].join(' ')}
          >
            {tab === 'membresias' ? 'Membresías' : tab === 'clases' ? 'Clases' : 'Sesiones'}
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
          {activeTab === 'membresias' && (
            <MembershipsTab
              memberships={memberships}
              onNueva={() => {
                setMembershipForm(MEMBERSHIP_FORM_EMPTY)
                setMembershipModal(true)
              }}
            />
          )}
          {activeTab === 'clases' && (
            <ClassesTab
              classes={classes}
              onNueva={() => {
                setClassForm(CLASS_FORM_EMPTY)
                setClassModal(true)
              }}
            />
          )}
          {activeTab === 'sesiones' && (
            <SessionsTab
              sessions={sessions}
              onCheckin={() => {
                setSessionForm(SESSION_FORM_EMPTY)
                setSessionModal(true)
              }}
            />
          )}
        </>
      )}

      {/* Modal nueva membresía */}
      <Modal
        open={membershipModal}
        onClose={() => setMembershipModal(false)}
        title="Nueva membresía"
        size="md"
        footer={
          <>
            <Button variant="secondary" onClick={() => setMembershipModal(false)}>
              Cancelar
            </Button>
            <Button loading={savingMembership} onClick={handleGuardarMembresia}>
              <Plus size={14} />
              Crear membresía
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
        </div>
      </Modal>

      {/* Modal nueva clase */}
      <Modal
        open={classModal}
        onClose={() => setClassModal(false)}
        title="Nueva clase"
        size="md"
        footer={
          <>
            <Button variant="secondary" onClick={() => setClassModal(false)}>
              Cancelar
            </Button>
            <Button loading={savingClass} onClick={handleGuardarClase}>
              <Plus size={14} />
              Crear clase
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
        </div>
      </Modal>
    </div>
  )
}

// ─── Tab: Membresías ──────────────────────────────────────────────────────────

function MembershipsTab({
  memberships,
  onNueva,
}: {
  memberships: Membership[]
  onNueva: () => void
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
}: {
  classes: GymClass[]
  onNueva: () => void
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
}: {
  sessions: GymSession[]
  onCheckin: () => void
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
