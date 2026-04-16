'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Card } from '@/components/ui/card'
import { Modal } from '@/components/ui/modal'
import { Badge } from '@/components/ui/badge'
import { KpiCard } from '@/components/ui/kpi-card'
import { useToast } from '@/components/ui/toast'
import {
  UserCog, Plus, Calendar, Clock, Users, CheckCircle, XCircle,
  Edit3, Trash2, LogIn, LogOut, ChevronLeft, ChevronRight,
  Coffee, Timer, Wifi, Fingerprint, ScanFace, KeyRound, Hand,
  DollarSign, Package, ShieldCheck, ClipboardList, AlertTriangle,
  BarChart3, CreditCard, Banknote, ArrowRightLeft, Eye,
  Camera, Hash, Pause, Play
} from 'lucide-react'
import type { StaffSchedule, StaffShift, Product, AccessCredential } from '@/types'

// =============================================
// CONSTANTS
// =============================================

const CLUB_ID = 1

const DAY_NAMES = ['Domingo', 'Lunes', 'Martes', 'Miercoles', 'Jueves', 'Viernes', 'Sabado']
const DAY_NAMES_SHORT = ['Dom', 'Lun', 'Mar', 'Mie', 'Jue', 'Vie', 'Sab']

const ROLE_OPTIONS = [
  { value: 'recepcion', label: 'Recepcion' },
  { value: 'entrenador', label: 'Entrenador' },
  { value: 'mantenimiento', label: 'Mantenimiento' },
  { value: 'limpieza', label: 'Limpieza' },
  { value: 'gerente', label: 'Gerente' },
  { value: 'otro', label: 'Otro' },
]

const ROLE_COLORS: Record<string, string> = {
  recepcion: 'bg-blue-500/20 text-blue-400',
  entrenador: 'bg-green-500/20 text-green-400',
  mantenimiento: 'bg-amber-500/20 text-amber-400',
  limpieza: 'bg-purple-500/20 text-purple-400',
  gerente: 'bg-red-500/20 text-red-400',
  otro: 'bg-slate-500/20 text-slate-400',
}

const ROLE_BAR_COLORS: Record<string, string> = {
  recepcion: 'bg-blue-500',
  entrenador: 'bg-green-500',
  mantenimiento: 'bg-amber-500',
  limpieza: 'bg-purple-500',
  gerente: 'bg-red-500',
  otro: 'bg-slate-500',
}

const AUTH_METHODS = ['pin', 'nfc', 'fingerprint', 'facial', 'manual'] as const
type AuthMethod = typeof AUTH_METHODS[number]

const AUTH_ICONS: Record<AuthMethod, React.ReactNode> = {
  pin: <KeyRound size={14} />,
  nfc: <Wifi size={14} />,
  fingerprint: <Fingerprint size={14} />,
  facial: <ScanFace size={14} />,
  manual: <Hand size={14} />,
}

const PAYMENT_METHODS = [
  { key: 'efectivo', label: 'Efectivo', icon: <Banknote size={16} /> },
  { key: 'tarjeta', label: 'Tarjeta', icon: <CreditCard size={16} /> },
  { key: 'transferencia', label: 'Transferencia', icon: <ArrowRightLeft size={16} /> },
  { key: 'bizum', label: 'Bizum', icon: <DollarSign size={16} /> },
]

type Tab = 'panel' | 'shifts' | 'cash' | 'stock' | 'schedules' | 'credentials'

// =============================================
// EXTENDED TYPES
// =============================================

interface ExtendedShift extends Omit<StaffShift, 'user'> {
  break_start?: string | null
  break_end?: string | null
  break_minutes?: number
  net_minutes?: number
  overtime_minutes?: number
  auth_method?: AuthMethod
  role?: string
  user?: { full_name: string } | null
}

type ShiftWithUser = ExtendedShift

interface ScheduleWithUser extends Omit<StaffSchedule, 'user'> {
  user?: { full_name: string } | null
}

interface CashClosing {
  id: number
  club_id: number
  closed_by: string
  opened_at: string
  closed_at: string
  expected_efectivo: number
  expected_tarjeta: number
  expected_transferencia: number
  expected_bizum: number
  actual_efectivo: number
  actual_tarjeta: number
  actual_transferencia: number
  actual_bizum: number
  difference: number
  transaction_count: number
  booking_count: number
  sale_count: number
  notes?: string
  status: 'ok' | 'discrepancy'
  user?: { full_name: string } | null
}

interface StockSnapshot {
  id: number
  club_id: number
  taken_by: string
  taken_at: string
  total_products: number
  products_with_diff: number
  items: StockSnapshotItem[]
  status: 'ok' | 'discrepancy'
  user?: { full_name: string } | null
}

interface StockSnapshotItem {
  product_id: number
  product_name: string
  expected: number
  actual: number
  difference: number
}

interface UserOption {
  value: string
  label: string
}

interface CashRegisterSummary {
  efectivo: number
  tarjeta: number
  transferencia: number
  bizum: number
  bookings: number
  sales: number
  total: number
}

// =============================================
// HELPERS
// =============================================

function formatTime(iso: string | undefined | null): string {
  if (!iso) return '-'
  return new Date(iso).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })
}

function formatDateTime(iso: string | undefined | null): string {
  if (!iso) return '-'
  const d = new Date(iso)
  return d.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit' }) + ' ' +
    d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })
}

function minutesToHHMM(mins: number): string {
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return `${h}h ${m.toString().padStart(2, '0')}m`
}

function elapsedMinutes(from: string): number {
  return Math.max(0, Math.floor((Date.now() - new Date(from).getTime()) / 60000))
}

function elapsedDisplay(from: string): string {
  const total = Math.floor((Date.now() - new Date(from).getTime()) / 1000)
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
}

function getInitials(name: string): string {
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
}

function todayISO(): string {
  return new Date().toISOString().split('T')[0]
}

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + 'T12:00:00')
  d.setDate(d.getDate() + days)
  return d.toISOString().split('T')[0]
}

// =============================================
// LIVE TIMER COMPONENT
// =============================================

function LiveTimer({ from }: { from: string }) {
  const [display, setDisplay] = useState(elapsedDisplay(from))

  useEffect(() => {
    const id = setInterval(() => setDisplay(elapsedDisplay(from)), 1000)
    return () => clearInterval(id)
  }, [from])

  return <span className="font-mono text-green-400">{display}</span>
}

// =============================================
// MAIN COMPONENT
// =============================================

export default function AdminStaffPage() {
  const { toast } = useToast()
  const [tab, setTab] = useState<Tab>('panel')
  const [now, setNow] = useState(Date.now())

  // Data
  const [allUsers, setAllUsers] = useState<UserOption[]>([])
  const [shifts, setShifts] = useState<ShiftWithUser[]>([])
  const [schedules, setSchedules] = useState<ScheduleWithUser[]>([])
  const [cashClosings, setCashClosings] = useState<CashClosing[]>([])
  const [stockSnapshots, setStockSnapshots] = useState<StockSnapshot[]>([])
  const [credentials, setCredentials] = useState<(AccessCredential & { user?: { full_name: string } | null })[]>([])
  const [products, setProducts] = useState<Product[]>([])

  // Loading
  const [loadingShifts, setLoadingShifts] = useState(true)
  const [loadingSchedules, setLoadingSchedules] = useState(true)
  const [loadingCash, setLoadingCash] = useState(true)
  const [loadingSnapshots, setLoadingSnapshots] = useState(true)
  const [loadingCredentials, setLoadingCredentials] = useState(true)

  // Shift date
  const [shiftDate, setShiftDate] = useState(todayISO)

  // Schedule form
  const [scheduleModalOpen, setScheduleModalOpen] = useState(false)
  const [scheduleSaving, setScheduleSaving] = useState(false)
  const [editingSchedule, setEditingSchedule] = useState<ScheduleWithUser | null>(null)
  const [schedUserId, setSchedUserId] = useState('')
  const [schedDay, setSchedDay] = useState('1')
  const [schedStart, setSchedStart] = useState('09:00')
  const [schedEnd, setSchedEnd] = useState('17:00')
  const [schedRole, setSchedRole] = useState('recepcion')

  // Shift form
  const [shiftModalOpen, setShiftModalOpen] = useState(false)
  const [shiftSaving, setShiftSaving] = useState(false)
  const [shiftUserId, setShiftUserId] = useState('')
  const [shiftSchedStart, setShiftSchedStart] = useState('09:00')
  const [shiftSchedEnd, setShiftSchedEnd] = useState('17:00')

  // Cierre turno modal
  const [closingShift, setClosingShift] = useState<ShiftWithUser | null>(null)
  const [closingStep, setClosingStep] = useState(0)
  const [closingCash, setClosingCash] = useState<Record<string, number>>({})
  const [closingExpected, setClosingExpected] = useState<CashRegisterSummary | null>(null)
  const [closingStockItems, setClosingStockItems] = useState<StockSnapshotItem[]>([])
  const [closingChecklist, setClosingChecklist] = useState({ caja: false, stock: false, pistas: false, notas: false })
  const [closingNotes, setClosingNotes] = useState('')
  const [closingSaving, setClosingSaving] = useState(false)

  // Cash closing modal
  const [cashCloseModalOpen, setCashCloseModalOpen] = useState(false)
  const [cashExpected, setCashExpected] = useState<CashRegisterSummary | null>(null)
  const [cashActual, setCashActual] = useState<Record<string, number>>({})
  const [cashNotes, setCashNotes] = useState('')
  const [cashCloseSaving, setCashCloseSaving] = useState(false)

  // Stock snapshot modal
  const [stockModalOpen, setStockModalOpen] = useState(false)
  const [stockItems, setStockItems] = useState<StockSnapshotItem[]>([])
  const [stockSaving, setStockSaving] = useState(false)

  // Credential modals
  const [credModalOpen, setCredModalOpen] = useState(false)
  const [credType, setCredType] = useState<'pin' | 'nfc' | 'fingerprint' | 'facial'>('pin')
  const [credUserId, setCredUserId] = useState('')
  const [credPin, setCredPin] = useState('')
  const [credPinConfirm, setCredPinConfirm] = useState('')
  const [credSaving, setCredSaving] = useState(false)

  // Cash closing detail modal
  const [cashDetailModal, setCashDetailModal] = useState<CashClosing | null>(null)

  // Active strip scroll ref
  const stripRef = useRef<HTMLDivElement>(null)

  // Global tick for timers
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [])

  // =============================================
  // DATA LOADERS
  // =============================================

  const loadUsers = useCallback(async () => {
    const supabase = createClient()
    const { data } = await supabase
      .from('nm_club_members')
      .select('user_id, user:nm_users(full_name)')
      .eq('club_id', CLUB_ID)
      .in('role', ['owner', 'admin', 'staff'])
    setAllUsers((data || []).map((d: Record<string, unknown>) => {
      const u = d.user as { full_name: string } | { full_name: string }[] | null
      const name = Array.isArray(u) ? u[0]?.full_name : u?.full_name
      return { value: d.user_id as string, label: name || (d.user_id as string) }
    }))
  }, [])

  const loadShifts = useCallback(async () => {
    setLoadingShifts(true)
    const supabase = createClient()
    const { data } = await supabase
      .from('nm_staff_shifts')
      .select('*, user:nm_users(full_name)')
      .eq('club_id', CLUB_ID)
      .eq('date', shiftDate)
      .order('scheduled_start')
    setShifts((data || []) as ShiftWithUser[])
    setLoadingShifts(false)
  }, [shiftDate])

  const loadSchedules = useCallback(async () => {
    setLoadingSchedules(true)
    const supabase = createClient()
    const { data } = await supabase
      .from('nm_staff_schedules')
      .select('*, user:nm_users(full_name)')
      .eq('club_id', CLUB_ID)
      .eq('is_active', true)
      .order('day_of_week')
      .order('start_time')
    setSchedules((data || []) as ScheduleWithUser[])
    setLoadingSchedules(false)
  }, [])

  const loadCashClosings = useCallback(async () => {
    setLoadingCash(true)
    const supabase = createClient()
    const { data } = await supabase
      .from('nm_cash_closings')
      .select('*, user:nm_users!nm_cash_closings_closed_by_fkey(full_name)')
      .eq('club_id', CLUB_ID)
      .order('closed_at', { ascending: false })
      .limit(50)
    setCashClosings((data || []) as CashClosing[])
    setLoadingCash(false)
  }, [])

  const loadStockSnapshots = useCallback(async () => {
    setLoadingSnapshots(true)
    const supabase = createClient()
    const { data } = await supabase
      .from('nm_stock_snapshots')
      .select('*, user:nm_users!nm_stock_snapshots_taken_by_fkey(full_name)')
      .eq('club_id', CLUB_ID)
      .order('taken_at', { ascending: false })
      .limit(50)
    setStockSnapshots((data || []) as StockSnapshot[])
    setLoadingSnapshots(false)
  }, [])

  const loadCredentials = useCallback(async () => {
    setLoadingCredentials(true)
    const supabase = createClient()
    const { data } = await supabase
      .from('nm_access_credentials')
      .select('*, user:nm_users(full_name)')
      .eq('club_id', CLUB_ID)
      .eq('is_active', true)
    setCredentials((data || []) as (AccessCredential & { user?: { full_name: string } | null })[])
    setLoadingCredentials(false)
  }, [])

  const loadProducts = useCallback(async () => {
    const supabase = createClient()
    const { data } = await supabase
      .from('nm_products')
      .select('*')
      .eq('club_id', CLUB_ID)
      .eq('is_active', true)
      .order('name')
    setProducts((data || []) as Product[])
  }, [])

  useEffect(() => { loadUsers() }, [loadUsers])
  useEffect(() => { loadShifts() }, [loadShifts])
  useEffect(() => { loadSchedules() }, [loadSchedules])
  useEffect(() => { loadCashClosings() }, [loadCashClosings])
  useEffect(() => { loadStockSnapshots() }, [loadStockSnapshots])
  useEffect(() => { loadCredentials() }, [loadCredentials])
  useEffect(() => { loadProducts() }, [loadProducts])

  // =============================================
  // COMPUTED
  // =============================================

  const todayShifts = shifts
  const activeShifts = shifts.filter(s => s.status === 'active')
  const completedShifts = shifts.filter(s => s.status === 'completed')
  const absentShifts = shifts.filter(s => s.status === 'absent')
  const scheduledShifts = shifts.filter(s => s.status === 'scheduled')

  const totalHoursToday = shifts.reduce((acc, s) => {
    if (s.status === 'completed' && s.check_in && s.check_out) {
      const mins = Math.floor((new Date(s.check_out).getTime() - new Date(s.check_in).getTime()) / 60000)
      return acc + mins - (s.break_minutes || 0)
    }
    if (s.status === 'active' && s.check_in) {
      return acc + elapsedMinutes(s.check_in) - (s.break_minutes || 0)
    }
    return acc
  }, 0)

  const totalOvertimeToday = shifts.reduce((acc, s) => acc + (s.overtime_minutes || 0), 0)

  const shiftNeedsCheckbox = (s: ShiftWithUser) =>
    s.role === 'recepcion' || s.role === 'gerente'

  // =============================================
  // CASH REGISTER QUERY
  // =============================================

  async function getCashSummary(since: string): Promise<CashRegisterSummary> {
    const supabase = createClient()
    const { data } = await supabase
      .from('nm_cash_register')
      .select('amount, payment_method, type')
      .eq('club_id', CLUB_ID)
      .gte('created_at', since)

    let efectivo = 0, tarjeta = 0, transferencia = 0, bizum = 0, bookings = 0, sales = 0

    for (const row of (data || []) as { amount: number; payment_method: string; type: string }[]) {
      switch (row.payment_method) {
        case 'efectivo': efectivo += row.amount; break
        case 'tarjeta': tarjeta += row.amount; break
        case 'transferencia': transferencia += row.amount; break
        case 'bizum': bizum += row.amount; break
      }
      if (row.type === 'booking') bookings++
      if (row.type === 'shop') sales++
    }

    return { efectivo, tarjeta, transferencia, bizum, bookings, sales, total: efectivo + tarjeta + transferencia + bizum }
  }

  // =============================================
  // SHIFT ACTIONS
  // =============================================

  async function checkIn(id: number) {
    const supabase = createClient()
    const { error } = await supabase.from('nm_staff_shifts').update({
      check_in: new Date().toISOString(),
      status: 'active',
    }).eq('id', id)
    if (error) { toast('error', 'Error: ' + error.message); return }
    toast('success', 'Entrada registrada')
    loadShifts()
  }

  async function startBreak(id: number) {
    const supabase = createClient()
    const { error } = await supabase.from('nm_staff_shifts').update({
      break_start: new Date().toISOString(),
    }).eq('id', id)
    if (error) { toast('error', 'Error: ' + error.message); return }
    toast('info', 'Pausa iniciada')
    loadShifts()
  }

  async function endBreak(shift: ShiftWithUser) {
    if (!shift.break_start) return
    const diffMins = Math.floor((Date.now() - new Date(shift.break_start).getTime()) / 60000)
    const supabase = createClient()
    const { error } = await supabase.from('nm_staff_shifts').update({
      break_end: new Date().toISOString(),
      break_minutes: (shift.break_minutes || 0) + diffMins,
    }).eq('id', shift.id)
    if (error) { toast('error', 'Error: ' + error.message); return }
    toast('info', 'Pausa finalizada')
    loadShifts()
  }

  async function markAbsent(id: number) {
    const supabase = createClient()
    const { error } = await supabase.from('nm_staff_shifts').update({ status: 'absent' }).eq('id', id)
    if (error) { toast('error', 'Error: ' + error.message); return }
    toast('info', 'Marcado como ausente')
    loadShifts()
  }

  async function deleteShift(id: number) {
    if (!confirm('Eliminar este turno?')) return
    const supabase = createClient()
    await supabase.from('nm_staff_shifts').delete().eq('id', id)
    loadShifts()
  }

  // Open cierre de turno modal
  async function openCloseShiftModal(shift: ShiftWithUser) {
    setClosingShift(shift)
    setClosingStep(0)
    setClosingNotes('')
    setClosingChecklist({ caja: false, stock: false, pistas: false, notas: false })
    setClosingCash({})
    setClosingStockItems([])

    if (shiftNeedsCheckbox(shift) && shift.check_in) {
      const summary = await getCashSummary(shift.check_in)
      setClosingExpected(summary)
    } else {
      setClosingExpected(null)
    }

    // Prepare stock items
    const items = products.map(p => ({
      product_id: p.id,
      product_name: p.name,
      expected: p.stock,
      actual: p.stock,
      difference: 0,
    }))
    setClosingStockItems(items)
  }

  async function confirmCloseShift() {
    if (!closingShift) return
    setClosingSaving(true)
    const supabase = createClient()

    const checkOutTime = new Date().toISOString()
    let netMins = 0
    if (closingShift.check_in) {
      netMins = Math.floor((Date.now() - new Date(closingShift.check_in).getTime()) / 60000) - (closingShift.break_minutes || 0)
    }

    // Close the shift
    const { error: shiftErr } = await supabase.from('nm_staff_shifts').update({
      check_out: checkOutTime,
      status: 'completed',
      net_minutes: Math.max(0, netMins),
      notes: closingNotes || null,
    }).eq('id', closingShift.id)

    if (shiftErr) { toast('error', 'Error cerrando turno: ' + shiftErr.message); setClosingSaving(false); return }

    // Cash closing if applicable
    if (shiftNeedsCheckbox(closingShift) && closingExpected) {
      const totalExpected = closingExpected.total
      const totalActual = PAYMENT_METHODS.reduce((a, m) => a + (closingCash[m.key] || 0), 0)
      await supabase.from('nm_cash_closings').insert({
        club_id: CLUB_ID,
        closed_by: closingShift.user_id,
        opened_at: closingShift.check_in,
        closed_at: checkOutTime,
        expected_efectivo: closingExpected.efectivo,
        expected_tarjeta: closingExpected.tarjeta,
        expected_transferencia: closingExpected.transferencia,
        expected_bizum: closingExpected.bizum,
        actual_efectivo: closingCash['efectivo'] || 0,
        actual_tarjeta: closingCash['tarjeta'] || 0,
        actual_transferencia: closingCash['transferencia'] || 0,
        actual_bizum: closingCash['bizum'] || 0,
        difference: totalActual - totalExpected,
        transaction_count: closingExpected.bookings + closingExpected.sales,
        booking_count: closingExpected.bookings,
        sale_count: closingExpected.sales,
        notes: closingNotes || null,
        status: Math.abs(totalActual - totalExpected) < 0.01 ? 'ok' : 'discrepancy',
      })
    }

    // Stock snapshot
    const itemsWithDiff = closingStockItems.filter(i => i.difference !== 0)
    if (closingStockItems.length > 0) {
      await supabase.from('nm_stock_snapshots').insert({
        club_id: CLUB_ID,
        taken_by: closingShift.user_id,
        taken_at: checkOutTime,
        total_products: closingStockItems.length,
        products_with_diff: itemsWithDiff.length,
        items: closingStockItems,
        status: itemsWithDiff.length === 0 ? 'ok' : 'discrepancy',
      })
    }

    // Shift handover
    await supabase.from('nm_shift_handovers').insert({
      club_id: CLUB_ID,
      shift_id: closingShift.id,
      checklist: closingChecklist,
      notes: closingNotes || null,
      created_at: checkOutTime,
    })

    setClosingSaving(false)
    setClosingShift(null)
    toast('success', 'Turno cerrado correctamente')
    loadShifts()
    loadCashClosings()
    loadStockSnapshots()
  }

  // =============================================
  // GENERATE SHIFTS
  // =============================================

  async function generateFromSchedule() {
    const dayOfWeek = new Date(shiftDate + 'T12:00:00').getDay()
    const todaySchedules = schedules.filter(s => s.day_of_week === dayOfWeek)
    if (todaySchedules.length === 0) { toast('info', 'No hay horarios para este dia'); return }

    const supabase = createClient()
    let created = 0
    for (const s of todaySchedules) {
      const { data: existing } = await supabase
        .from('nm_staff_shifts')
        .select('id')
        .eq('user_id', s.user_id)
        .eq('date', shiftDate)
        .single()
      if (existing) continue

      await supabase.from('nm_staff_shifts').insert({
        club_id: CLUB_ID,
        user_id: s.user_id,
        date: shiftDate,
        scheduled_start: s.start_time,
        scheduled_end: s.end_time,
        role: s.role,
        status: 'scheduled',
      })
      created++
    }
    toast('success', `${created} turnos generados desde horarios`)
    loadShifts()
  }

  // =============================================
  // SCHEDULE CRUD
  // =============================================

  async function handleSaveSchedule(e: React.FormEvent) {
    e.preventDefault()
    if (!schedUserId) return
    setScheduleSaving(true)
    const supabase = createClient()

    if (editingSchedule) {
      const { error } = await supabase.from('nm_staff_schedules').update({
        user_id: schedUserId,
        day_of_week: Number(schedDay),
        start_time: schedStart,
        end_time: schedEnd,
        role: schedRole,
      }).eq('id', editingSchedule.id)
      if (error) toast('error', 'Error: ' + error.message)
      else { toast('success', 'Horario actualizado'); setScheduleModalOpen(false); setEditingSchedule(null); loadSchedules() }
    } else {
      const { error } = await supabase.from('nm_staff_schedules').insert({
        club_id: CLUB_ID,
        user_id: schedUserId,
        day_of_week: Number(schedDay),
        start_time: schedStart,
        end_time: schedEnd,
        role: schedRole,
        is_active: true,
      })
      if (error) toast('error', 'Error: ' + error.message)
      else { toast('success', 'Horario creado'); setScheduleModalOpen(false); loadSchedules() }
    }
    setScheduleSaving(false)
  }

  async function deleteSchedule(id: number) {
    if (!confirm('Eliminar este horario?')) return
    const supabase = createClient()
    await supabase.from('nm_staff_schedules').delete().eq('id', id)
    loadSchedules()
  }

  // =============================================
  // SHIFT CREATE
  // =============================================

  async function handleSaveShift(e: React.FormEvent) {
    e.preventDefault()
    if (!shiftUserId) return
    setShiftSaving(true)
    const supabase = createClient()
    const { error } = await supabase.from('nm_staff_shifts').insert({
      club_id: CLUB_ID,
      user_id: shiftUserId,
      date: shiftDate,
      scheduled_start: shiftSchedStart,
      scheduled_end: shiftSchedEnd,
      status: 'scheduled',
    })
    if (error) toast('error', 'Error: ' + error.message)
    else { toast('success', 'Turno creado'); setShiftModalOpen(false); loadShifts() }
    setShiftSaving(false)
  }

  // =============================================
  // CASH CLOSE (standalone)
  // =============================================

  async function openCashCloseModal() {
    // Find last closing to determine "opened_at"
    const lastClose = cashClosings[0]
    const since = lastClose?.closed_at || new Date(new Date().setHours(0, 0, 0, 0)).toISOString()
    const summary = await getCashSummary(since)
    setCashExpected(summary)
    setCashActual({})
    setCashNotes('')
    setCashCloseModalOpen(true)
  }

  async function confirmCashClose() {
    setCashCloseSaving(true)
    const supabase = createClient()
    const { data: me } = await supabase.auth.getUser()
    const userId = me?.user?.id || ''

    const lastClose = cashClosings[0]
    const openedAt = lastClose?.closed_at || new Date(new Date().setHours(0, 0, 0, 0)).toISOString()
    const closedAt = new Date().toISOString()

    const totalExpected = cashExpected?.total || 0
    const totalActual = PAYMENT_METHODS.reduce((a, m) => a + (cashActual[m.key] || 0), 0)

    const { error } = await supabase.from('nm_cash_closings').insert({
      club_id: CLUB_ID,
      closed_by: userId,
      opened_at: openedAt,
      closed_at: closedAt,
      expected_efectivo: cashExpected?.efectivo || 0,
      expected_tarjeta: cashExpected?.tarjeta || 0,
      expected_transferencia: cashExpected?.transferencia || 0,
      expected_bizum: cashExpected?.bizum || 0,
      actual_efectivo: cashActual['efectivo'] || 0,
      actual_tarjeta: cashActual['tarjeta'] || 0,
      actual_transferencia: cashActual['transferencia'] || 0,
      actual_bizum: cashActual['bizum'] || 0,
      difference: totalActual - totalExpected,
      transaction_count: (cashExpected?.bookings || 0) + (cashExpected?.sales || 0),
      booking_count: cashExpected?.bookings || 0,
      sale_count: cashExpected?.sales || 0,
      notes: cashNotes || null,
      status: Math.abs(totalActual - totalExpected) < 0.01 ? 'ok' : 'discrepancy',
    })

    setCashCloseSaving(false)
    if (error) { toast('error', 'Error: ' + error.message); return }
    toast('success', 'Caja cerrada correctamente')
    setCashCloseModalOpen(false)
    loadCashClosings()
  }

  // =============================================
  // STOCK SNAPSHOT (standalone)
  // =============================================

  function openStockModal() {
    setStockItems(products.map(p => ({
      product_id: p.id,
      product_name: p.name,
      expected: p.stock,
      actual: p.stock,
      difference: 0,
    })))
    setStockModalOpen(true)
  }

  async function confirmStockSnapshot() {
    setStockSaving(true)
    const supabase = createClient()
    const { data: me } = await supabase.auth.getUser()
    const userId = me?.user?.id || ''

    const itemsWithDiff = stockItems.filter(i => i.difference !== 0)
    const { error } = await supabase.from('nm_stock_snapshots').insert({
      club_id: CLUB_ID,
      taken_by: userId,
      taken_at: new Date().toISOString(),
      total_products: stockItems.length,
      products_with_diff: itemsWithDiff.length,
      items: stockItems,
      status: itemsWithDiff.length === 0 ? 'ok' : 'discrepancy',
    })

    setStockSaving(false)
    if (error) { toast('error', 'Error: ' + error.message); return }
    toast('success', 'Snapshot de stock guardado')
    setStockModalOpen(false)
    loadStockSnapshots()
  }

  // =============================================
  // CREDENTIALS
  // =============================================

  function openCredModal(userId: string, type: 'pin' | 'nfc' | 'fingerprint' | 'facial') {
    setCredUserId(userId)
    setCredType(type)
    setCredPin('')
    setCredPinConfirm('')
    setCredModalOpen(true)
  }

  async function saveCredential() {
    if (credType === 'pin') {
      if (credPin.length < 4 || credPin.length > 6) { toast('error', 'El PIN debe tener entre 4 y 6 digitos'); return }
      if (credPin !== credPinConfirm) { toast('error', 'Los PINs no coinciden'); return }
    }
    setCredSaving(true)
    const supabase = createClient()

    const credData = credType === 'pin' ? credPin : `${credType}_${Date.now()}`

    const { error } = await supabase.from('nm_access_credentials').insert({
      club_id: CLUB_ID,
      user_id: credUserId,
      type: credType,
      credential_data: credData,
      is_active: true,
    })

    setCredSaving(false)
    if (error) { toast('error', 'Error: ' + error.message); return }
    toast('success', 'Credencial registrada')
    setCredModalOpen(false)
    loadCredentials()
  }

  async function deactivateCredential(id: number) {
    if (!confirm('Desactivar esta credencial?')) return
    const supabase = createClient()
    await supabase.from('nm_access_credentials').update({ is_active: false }).eq('id', id)
    toast('info', 'Credencial desactivada')
    loadCredentials()
  }

  // =============================================
  // TAB CONFIG
  // =============================================

  const tabs: { key: Tab; label: string; icon: React.ReactNode }[] = [
    { key: 'panel', label: 'Panel de Control', icon: <BarChart3 size={16} /> },
    { key: 'shifts', label: 'Turnos del Dia', icon: <Clock size={16} /> },
    { key: 'cash', label: 'Cierre de Caja', icon: <DollarSign size={16} /> },
    { key: 'stock', label: 'Control Stock', icon: <Package size={16} /> },
    { key: 'schedules', label: 'Horarios Semanales', icon: <Calendar size={16} /> },
    { key: 'credentials', label: 'Credenciales', icon: <ShieldCheck size={16} /> },
  ]

  // =============================================
  // RENDER
  // =============================================

  return (
    <div className="space-y-6">
      {/* HEADER */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <UserCog size={24} /> Gestion de Staff
          </h1>
          <p className="text-sm text-slate-400 mt-1">Turnos, caja, stock, horarios y credenciales del personal</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {tab === 'shifts' && (
            <>
              <Button variant="ghost" onClick={generateFromSchedule}>
                <Calendar size={14} className="mr-1" /> Generar turnos
              </Button>
              <Button onClick={() => { setShiftUserId(''); setShiftSchedStart('09:00'); setShiftSchedEnd('17:00'); setShiftModalOpen(true) }}>
                <Plus size={16} className="mr-1" /> Nuevo Turno
              </Button>
            </>
          )}
          {tab === 'cash' && (
            <Button onClick={openCashCloseModal}>
              <DollarSign size={16} className="mr-1" /> Cerrar Caja
            </Button>
          )}
          {tab === 'stock' && (
            <Button onClick={openStockModal}>
              <ClipboardList size={16} className="mr-1" /> Tomar Snapshot
            </Button>
          )}
          {tab === 'schedules' && (
            <Button onClick={() => {
              setEditingSchedule(null); setSchedUserId(''); setSchedDay('1')
              setSchedStart('09:00'); setSchedEnd('17:00'); setSchedRole('recepcion')
              setScheduleModalOpen(true)
            }}>
              <Plus size={16} className="mr-1" /> Nuevo Horario
            </Button>
          )}
        </div>
      </div>

      {/* TABS */}
      <div className="flex gap-1 bg-slate-800/50 p-1 rounded-lg overflow-x-auto">
        {tabs.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors whitespace-nowrap ${
              tab === t.key ? 'bg-cyan-600 text-white' : 'text-slate-400 hover:text-white'
            }`}
          >
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {/* ============================================= */}
      {/* TAB 1: PANEL DE CONTROL */}
      {/* ============================================= */}
      {tab === 'panel' && (
        <>
          {/* KPIs */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <KpiCard title="Staff en turno" value={activeShifts.length} icon={<Users size={20} />} color="#10b981" />
            <KpiCard title="Horas hoy" value={minutesToHHMM(totalHoursToday)} icon={<Clock size={20} />} color="#06b6d4" />
            <KpiCard title="Turnos completados" value={completedShifts.length} icon={<CheckCircle size={20} />} color="#6366f1" />
            <KpiCard title="Ausencias" value={absentShifts.length} icon={<XCircle size={20} />} color="#ef4444" />
          </div>

          {/* Active Staff Strip */}
          <div>
            <h2 className="text-sm font-semibold text-slate-300 mb-3">Staff activo ahora</h2>
            {activeShifts.length === 0 ? (
              <Card className="text-center py-8 text-slate-500">No hay staff activo en este momento</Card>
            ) : (
              <div ref={stripRef} className="flex gap-3 overflow-x-auto pb-2">
                {activeShifts.map(s => (
                  <div key={s.id} className="flex-shrink-0 w-56 rounded-xl border border-green-500/30 bg-slate-800/50 p-4">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-10 h-10 rounded-full bg-green-500/20 flex items-center justify-center text-green-400 font-bold text-sm">
                        {getInitials(s.user?.full_name || 'S')}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-white truncate">{s.user?.full_name || 'Staff'}</p>
                        {s.role && (
                          <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium ${ROLE_COLORS[s.role] || ROLE_COLORS.otro}`}>
                            {ROLE_OPTIONS.find(r => r.value === s.role)?.label || s.role}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="space-y-1 text-xs text-slate-400">
                      <div className="flex justify-between">
                        <span>Entrada</span>
                        <span className="text-white">{formatTime(s.check_in)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Transcurrido</span>
                        {s.check_in && <LiveTimer from={s.check_in} />}
                      </div>
                      {s.auth_method && (
                        <div className="flex justify-between items-center">
                          <span>Metodo</span>
                          <span className="text-slate-300 flex items-center gap-1">{AUTH_ICONS[s.auth_method]}</span>
                        </div>
                      )}
                      {s.break_start && !s.break_end && (
                        <Badge variant="warning">En pausa</Badge>
                      )}
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full mt-3"
                      onClick={() => openCloseShiftModal(s)}
                    >
                      <LogOut size={12} className="mr-1" /> Cerrar turno
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Shift Timeline */}
          <div>
            <h2 className="text-sm font-semibold text-slate-300 mb-3">Timeline de hoy</h2>
            <Card>
              {shifts.length === 0 ? (
                <p className="text-center py-8 text-slate-500">No hay turnos para hoy</p>
              ) : (
                <div className="relative pl-6 space-y-4">
                  <div className="absolute left-2 top-2 bottom-2 w-0.5 bg-slate-700" />
                  {shifts.map(s => {
                    const isActive = s.status === 'active'
                    const isCompleted = s.status === 'completed'
                    const isScheduled = s.status === 'scheduled'
                    const isAbsent = s.status === 'absent'
                    return (
                      <div key={s.id} className={`relative ${isScheduled ? 'opacity-50' : ''}`}>
                        <div className={`absolute -left-4 top-1 w-3 h-3 rounded-full border-2 ${
                          isActive ? 'bg-green-500 border-green-400 animate-pulse' :
                          isCompleted ? 'bg-slate-500 border-slate-400' :
                          isAbsent ? 'bg-red-500 border-red-400' :
                          'bg-slate-700 border-slate-600'
                        }`} />
                        <div className="flex items-center gap-3 flex-wrap">
                          <span className="text-sm font-medium text-white">{s.user?.full_name || 'Staff'}</span>
                          {s.role && (
                            <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium ${ROLE_COLORS[s.role] || ROLE_COLORS.otro}`}>
                              {ROLE_OPTIONS.find(r => r.value === s.role)?.label || s.role}
                            </span>
                          )}
                          <span className="text-xs text-slate-500">{s.scheduled_start} - {s.scheduled_end}</span>
                          {isActive && s.check_in && (
                            <span className="text-xs text-green-400 flex items-center gap-1">
                              <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                              <LiveTimer from={s.check_in} />
                            </span>
                          )}
                          {isCompleted && s.check_in && s.check_out && (
                            <span className="text-xs text-slate-400">
                              {formatTime(s.check_in)} - {formatTime(s.check_out)} ({minutesToHHMM(
                                Math.floor((new Date(s.check_out).getTime() - new Date(s.check_in).getTime()) / 60000) - (s.break_minutes || 0)
                              )})
                            </span>
                          )}
                          {isAbsent && <Badge variant="danger">Ausente</Badge>}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </Card>
          </div>
        </>
      )}

      {/* ============================================= */}
      {/* TAB 2: TURNOS DEL DIA */}
      {/* ============================================= */}
      {tab === 'shifts' && (
        <>
          {/* Date navigation */}
          <div className="flex items-center gap-3 flex-wrap">
            <button onClick={() => setShiftDate(addDays(shiftDate, -1))} className="p-2 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white">
              <ChevronLeft size={20} />
            </button>
            <button onClick={() => setShiftDate(todayISO())} className="px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-800 text-slate-300 hover:bg-slate-700">
              Hoy
            </button>
            <button onClick={() => setShiftDate(addDays(shiftDate, 1))} className="p-2 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white">
              <ChevronRight size={20} />
            </button>
            <input
              type="date"
              value={shiftDate}
              onChange={e => setShiftDate(e.target.value)}
              className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white"
            />
            <span className="text-lg font-semibold text-white capitalize">
              {new Date(shiftDate + 'T12:00:00').toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })}
            </span>
          </div>

          {/* KPIs */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            <KpiCard title="Programados" value={todayShifts.length} icon={<Calendar size={20} />} />
            <KpiCard title="Activos" value={activeShifts.length} icon={<Users size={20} />} color="#10b981" />
            <KpiCard title="Completados" value={completedShifts.length} icon={<CheckCircle size={20} />} color="#6366f1" />
            <KpiCard title="Ausentes" value={absentShifts.length} icon={<XCircle size={20} />} color="#ef4444" />
            <KpiCard title="Horas trabajadas" value={minutesToHHMM(totalHoursToday)} icon={<Clock size={20} />} color="#06b6d4" />
            <KpiCard title="Horas extras" value={minutesToHHMM(totalOvertimeToday)} icon={<Timer size={20} />} color="#f59e0b" />
          </div>

          {/* Shifts table */}
          {loadingShifts ? (
            <div className="text-center py-12 text-slate-500">Cargando...</div>
          ) : shifts.length === 0 ? (
            <Card><div className="text-center py-12 text-slate-500">No hay turnos para este dia</div></Card>
          ) : (
            <Card className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-slate-700">
                      {['Staff', 'Horario', 'Entrada', 'Salida', 'Pausa', 'Neto', 'Extras', 'Metodo', 'Estado', 'Acciones'].map(h => (
                        <th key={h} className="text-left text-xs font-medium text-slate-400 px-3 py-3">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {shifts.map(s => {
                      const isOnBreak = Boolean(s.break_start && !s.break_end)
                      let netMins = 0
                      if (s.check_in && s.check_out) {
                        netMins = Math.floor((new Date(s.check_out).getTime() - new Date(s.check_in).getTime()) / 60000) - (s.break_minutes || 0)
                      } else if (s.check_in && s.status === 'active') {
                        netMins = elapsedMinutes(s.check_in) - (s.break_minutes || 0)
                      }
                      return (
                        <tr key={s.id} className="border-b border-slate-800 hover:bg-slate-800/30">
                          <td className="px-3 py-3">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium text-white">{s.user?.full_name || 'Staff'}</span>
                              {s.role && (
                                <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium ${ROLE_COLORS[s.role] || ROLE_COLORS.otro}`}>
                                  {ROLE_OPTIONS.find(r => r.value === s.role)?.label || s.role}
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="px-3 py-3 text-sm text-slate-400">{s.scheduled_start || '-'} - {s.scheduled_end || '-'}</td>
                          <td className="px-3 py-3 text-sm text-slate-400">{formatTime(s.check_in)}</td>
                          <td className="px-3 py-3 text-sm text-slate-400">{formatTime(s.check_out)}</td>
                          <td className="px-3 py-3 text-sm text-slate-400">
                            {isOnBreak ? <Badge variant="warning">En pausa</Badge> : (s.break_minutes || 0) > 0 ? `${s.break_minutes}m` : '-'}
                          </td>
                          <td className="px-3 py-3 text-sm text-white font-mono">{netMins > 0 ? minutesToHHMM(netMins) : '-'}</td>
                          <td className="px-3 py-3 text-sm text-amber-400">{(s.overtime_minutes || 0) > 0 ? `${s.overtime_minutes}m` : '-'}</td>
                          <td className="px-3 py-3">{s.auth_method ? <span className="text-slate-300">{AUTH_ICONS[s.auth_method]}</span> : <span className="text-slate-600">-</span>}</td>
                          <td className="px-3 py-3">
                            <Badge variant={
                              s.status === 'active' ? (isOnBreak ? 'warning' : 'success') :
                              s.status === 'completed' ? 'info' :
                              s.status === 'absent' ? 'danger' : 'warning'
                            }>
                              {s.status === 'active' ? (isOnBreak ? 'En pausa' : 'Activo') :
                               s.status === 'completed' ? 'Completado' :
                               s.status === 'absent' ? 'Ausente' : 'Programado'}
                            </Badge>
                          </td>
                          <td className="px-3 py-3">
                            <div className="flex items-center gap-1">
                              {s.status === 'scheduled' && (
                                <>
                                  <button onClick={() => checkIn(s.id)} className="px-2 py-1 rounded text-xs text-green-400 hover:bg-green-500/10 flex items-center gap-1"><LogIn size={12} /> Entrada</button>
                                  <button onClick={() => markAbsent(s.id)} className="px-2 py-1 rounded text-xs text-red-400 hover:bg-red-500/10">Ausente</button>
                                </>
                              )}
                              {s.status === 'active' && !isOnBreak && (
                                <>
                                  <button onClick={() => startBreak(s.id)} className="px-2 py-1 rounded text-xs text-amber-400 hover:bg-amber-500/10 flex items-center gap-1"><Pause size={12} /> Pausa</button>
                                  <button onClick={() => openCloseShiftModal(s)} className="px-2 py-1 rounded text-xs text-blue-400 hover:bg-blue-500/10 flex items-center gap-1"><LogOut size={12} /> Salida</button>
                                </>
                              )}
                              {s.status === 'active' && isOnBreak && (
                                <button onClick={() => endBreak(s)} className="px-2 py-1 rounded text-xs text-green-400 hover:bg-green-500/10 flex items-center gap-1"><Play size={12} /> Fin Pausa</button>
                              )}
                              <button onClick={() => deleteShift(s.id)} className="p-1 rounded text-slate-500 hover:text-red-400 hover:bg-red-500/10"><Trash2 size={14} /></button>
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
        </>
      )}

      {/* ============================================= */}
      {/* TAB 3: CIERRE DE CAJA */}
      {/* ============================================= */}
      {tab === 'cash' && (
        <>
          {/* Active Cash Shift banner */}
          {activeShifts.filter(s => s.role === 'recepcion' || s.role === 'gerente').length > 0 && (
            <Card className="border-cyan-500/30">
              <div className="flex items-center justify-between flex-wrap gap-4">
                <div>
                  <p className="text-sm text-slate-400">Caja activa</p>
                  {activeShifts.filter(s => s.role === 'recepcion' || s.role === 'gerente').map(s => (
                    <p key={s.id} className="text-white font-medium">
                      {s.user?.full_name} — desde {formatTime(s.check_in)}
                      {s.check_in && <span className="ml-2 text-green-400 text-sm"><LiveTimer from={s.check_in} /></span>}
                    </p>
                  ))}
                </div>
                <Button onClick={openCashCloseModal}>
                  <DollarSign size={16} className="mr-1" /> Cerrar Caja
                </Button>
              </div>
            </Card>
          )}

          {/* History */}
          <h2 className="text-sm font-semibold text-slate-300">Historial de cierres</h2>
          {loadingCash ? (
            <div className="text-center py-12 text-slate-500">Cargando...</div>
          ) : cashClosings.length === 0 ? (
            <Card><div className="text-center py-12 text-slate-500">No hay cierres registrados</div></Card>
          ) : (
            <Card className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-slate-700">
                      {['Fecha/hora', 'Cerrado por', 'Esperado', 'Real', 'Diferencia', 'Estado', 'Acciones'].map(h => (
                        <th key={h} className="text-left text-xs font-medium text-slate-400 px-3 py-3">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {cashClosings.map(c => {
                      const expected = c.expected_efectivo + c.expected_tarjeta + c.expected_transferencia + c.expected_bizum
                      const actual = c.actual_efectivo + c.actual_tarjeta + c.actual_transferencia + c.actual_bizum
                      const diff = actual - expected
                      return (
                        <tr key={c.id} className="border-b border-slate-800 hover:bg-slate-800/30">
                          <td className="px-3 py-3 text-sm text-slate-300">{formatDateTime(c.closed_at)}</td>
                          <td className="px-3 py-3 text-sm text-white">{c.user?.full_name || '-'}</td>
                          <td className="px-3 py-3 text-sm text-slate-400">{expected.toFixed(2)} EUR</td>
                          <td className="px-3 py-3 text-sm text-white">{actual.toFixed(2)} EUR</td>
                          <td className={`px-3 py-3 text-sm font-medium ${diff === 0 ? 'text-green-400' : 'text-red-400'}`}>
                            {diff >= 0 ? '+' : ''}{diff.toFixed(2)} EUR
                          </td>
                          <td className="px-3 py-3">
                            <Badge variant={c.status === 'ok' ? 'success' : 'danger'}>{c.status === 'ok' ? 'OK' : 'Discrepancia'}</Badge>
                          </td>
                          <td className="px-3 py-3">
                            <button onClick={() => setCashDetailModal(c)} className="px-2 py-1 rounded text-xs text-cyan-400 hover:bg-cyan-500/10 flex items-center gap-1"><Eye size={12} /> Detalle</button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
        </>
      )}

      {/* ============================================= */}
      {/* TAB 4: CONTROL STOCK */}
      {/* ============================================= */}
      {tab === 'stock' && (
        <>
          <h2 className="text-sm font-semibold text-slate-300">Historial de snapshots</h2>
          {loadingSnapshots ? (
            <div className="text-center py-12 text-slate-500">Cargando...</div>
          ) : stockSnapshots.length === 0 ? (
            <Card><div className="text-center py-12 text-slate-500">No hay snapshots registrados</div></Card>
          ) : (
            <Card className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-slate-700">
                      {['Fecha', 'Tomado por', 'Productos', 'Con diferencia', 'Estado'].map(h => (
                        <th key={h} className="text-left text-xs font-medium text-slate-400 px-3 py-3">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {stockSnapshots.map(snap => (
                      <tr key={snap.id} className="border-b border-slate-800 hover:bg-slate-800/30">
                        <td className="px-3 py-3 text-sm text-slate-300">{formatDateTime(snap.taken_at)}</td>
                        <td className="px-3 py-3 text-sm text-white">{snap.user?.full_name || '-'}</td>
                        <td className="px-3 py-3 text-sm text-slate-400">{snap.total_products}</td>
                        <td className="px-3 py-3 text-sm text-slate-400">
                          {snap.products_with_diff > 0 ? (
                            <span className="text-red-400 font-medium">{snap.products_with_diff}</span>
                          ) : '0'}
                        </td>
                        <td className="px-3 py-3">
                          <Badge variant={snap.status === 'ok' ? 'success' : 'danger'}>{snap.status === 'ok' ? 'OK' : 'Discrepancia'}</Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
        </>
      )}

      {/* ============================================= */}
      {/* TAB 5: HORARIOS SEMANALES */}
      {/* ============================================= */}
      {tab === 'schedules' && (
        <>
          {loadingSchedules ? (
            <div className="text-center py-12 text-slate-500">Cargando...</div>
          ) : (
            <>
              {/* Visual Week Grid */}
              <Card className="p-0">
                <div className="overflow-x-auto">
                  <div className="grid grid-cols-8 min-w-[700px]">
                    {/* Header */}
                    <div className="px-3 py-2 border-b border-r border-slate-700 text-xs text-slate-500 font-medium">Staff</div>
                    {[1, 2, 3, 4, 5, 6, 0].map(d => (
                      <div key={d} className="px-3 py-2 border-b border-r border-slate-700 text-xs text-slate-400 font-medium text-center">
                        {DAY_NAMES_SHORT[d]}
                      </div>
                    ))}

                    {/* Rows per user */}
                    {allUsers.map(u => {
                      const userSchedules = schedules.filter(s => s.user_id === u.value)
                      if (userSchedules.length === 0) return null
                      return (
                        <div key={u.value} className="contents">
                          <div className="px-3 py-3 border-b border-r border-slate-700 text-sm text-white truncate flex items-center">
                            {u.label}
                          </div>
                          {[1, 2, 3, 4, 5, 6, 0].map(d => {
                            const dayScheds = userSchedules.filter(s => s.day_of_week === d)
                            return (
                              <div key={d} className="px-1 py-2 border-b border-r border-slate-700 min-h-[50px] flex flex-col gap-1">
                                {dayScheds.map(s => (
                                  <button
                                    key={s.id}
                                    onClick={() => {
                                      setEditingSchedule(s)
                                      setSchedUserId(s.user_id)
                                      setSchedDay(String(s.day_of_week))
                                      setSchedStart(s.start_time)
                                      setSchedEnd(s.end_time)
                                      setSchedRole(s.role || 'recepcion')
                                      setScheduleModalOpen(true)
                                    }}
                                    className={`w-full rounded px-1.5 py-1 text-[10px] text-white font-medium text-left truncate ${ROLE_BAR_COLORS[s.role || 'otro']}`}
                                  >
                                    {s.start_time}-{s.end_time}
                                  </button>
                                ))}
                                {dayScheds.length === 0 && (
                                  <button
                                    onClick={() => {
                                      setEditingSchedule(null)
                                      setSchedUserId(u.value)
                                      setSchedDay(String(d))
                                      setSchedStart('09:00')
                                      setSchedEnd('17:00')
                                      setSchedRole('recepcion')
                                      setScheduleModalOpen(true)
                                    }}
                                    className="w-full h-full rounded border border-dashed border-slate-700 text-slate-600 text-[10px] flex items-center justify-center hover:border-cyan-500/30 hover:text-cyan-500 transition-colors"
                                  >
                                    <Plus size={10} />
                                  </button>
                                )}
                              </div>
                            )
                          })}
                        </div>
                      )
                    })}
                  </div>
                </div>
              </Card>

              {/* Role legend */}
              <div className="flex gap-3 flex-wrap">
                {ROLE_OPTIONS.map(r => (
                  <div key={r.value} className="flex items-center gap-1.5 text-xs text-slate-400">
                    <div className={`w-3 h-3 rounded ${ROLE_BAR_COLORS[r.value]}`} />
                    {r.label}
                  </div>
                ))}
              </div>

              {/* List view */}
              <div className="space-y-4">
                {[1, 2, 3, 4, 5, 6, 0].map(day => {
                  const daySchedules = schedules.filter(s => s.day_of_week === day)
                  if (daySchedules.length === 0) return null
                  return (
                    <div key={day}>
                      <h3 className="text-sm font-semibold text-white mb-2">{DAY_NAMES[day]}</h3>
                      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                        {daySchedules.map(s => (
                          <div key={s.id} className="flex items-center gap-3 px-4 py-3 rounded-xl bg-slate-800/50 border border-slate-700/50">
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-white truncate">{s.user?.full_name || 'Staff'}</p>
                              <div className="flex items-center gap-2 mt-0.5">
                                <span className="text-xs text-slate-400">{s.start_time} - {s.end_time}</span>
                                {s.role && (
                                  <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium ${ROLE_COLORS[s.role] || ROLE_COLORS.otro}`}>
                                    {ROLE_OPTIONS.find(r => r.value === s.role)?.label || s.role}
                                  </span>
                                )}
                              </div>
                            </div>
                            <button
                              onClick={() => {
                                setEditingSchedule(s)
                                setSchedUserId(s.user_id)
                                setSchedDay(String(s.day_of_week))
                                setSchedStart(s.start_time)
                                setSchedEnd(s.end_time)
                                setSchedRole(s.role || 'recepcion')
                                setScheduleModalOpen(true)
                              }}
                              className="p-1 rounded text-slate-500 hover:text-cyan-400 hover:bg-cyan-500/10"
                            >
                              <Edit3 size={14} />
                            </button>
                            <button onClick={() => deleteSchedule(s.id)} className="p-1 rounded text-slate-500 hover:text-red-400 hover:bg-red-500/10"><Trash2 size={14} /></button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )
                })}
              </div>
            </>
          )}
        </>
      )}

      {/* ============================================= */}
      {/* TAB 6: CREDENCIALES */}
      {/* ============================================= */}
      {tab === 'credentials' && (
        <>
          {loadingCredentials ? (
            <div className="text-center py-12 text-slate-500">Cargando...</div>
          ) : (
            <Card className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-slate-700">
                      <th className="text-left text-xs font-medium text-slate-400 px-3 py-3">Staff</th>
                      <th className="text-center text-xs font-medium text-slate-400 px-3 py-3">PIN</th>
                      <th className="text-center text-xs font-medium text-slate-400 px-3 py-3">NFC</th>
                      <th className="text-center text-xs font-medium text-slate-400 px-3 py-3">Huella</th>
                      <th className="text-center text-xs font-medium text-slate-400 px-3 py-3">Facial</th>
                      <th className="text-right text-xs font-medium text-slate-400 px-3 py-3">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {allUsers.map(u => {
                      const userCreds = credentials.filter(c => c.user_id === u.value)
                      const hasPin = userCreds.some(c => c.type === 'pin')
                      const hasNfc = userCreds.some(c => c.type === 'nfc')
                      const hasFinger = userCreds.some(c => c.type === 'fingerprint')
                      const hasFacial = userCreds.some(c => c.type === 'facial')

                      const CredCell = ({ has, type }: { has: boolean; type: 'pin' | 'nfc' | 'fingerprint' | 'facial' }) => (
                        <td className="px-3 py-3 text-center">
                          {has ? (
                            <button
                              onClick={() => {
                                const cred = userCreds.find(c => c.type === type)
                                if (cred) deactivateCredential(cred.id)
                              }}
                              className="text-green-400 hover:text-green-300 mx-auto"
                              title="Desactivar"
                            >
                              <CheckCircle size={18} />
                            </button>
                          ) : (
                            <button
                              onClick={() => openCredModal(u.value, type)}
                              className="text-slate-600 hover:text-cyan-400 mx-auto"
                              title="Registrar"
                            >
                              <XCircle size={18} />
                            </button>
                          )}
                        </td>
                      )

                      return (
                        <tr key={u.value} className="border-b border-slate-800 hover:bg-slate-800/30">
                          <td className="px-3 py-3 text-sm font-medium text-white">{u.label}</td>
                          <CredCell has={hasPin} type="pin" />
                          <CredCell has={hasNfc} type="nfc" />
                          <CredCell has={hasFinger} type="fingerprint" />
                          <CredCell has={hasFacial} type="facial" />
                          <td className="px-3 py-3 text-right text-sm text-slate-500">
                            {userCreds.length} credencial{userCreds.length !== 1 ? 'es' : ''}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
        </>
      )}

      {/* ============================================= */}
      {/* MODALS */}
      {/* ============================================= */}

      {/* Schedule Modal */}
      <Modal
        open={scheduleModalOpen}
        onClose={() => { setScheduleModalOpen(false); setEditingSchedule(null) }}
        title={editingSchedule ? 'Editar Horario Semanal' : 'Nuevo Horario Semanal'}
        footer={
          <div className="flex items-center gap-3">
            <Button variant="ghost" onClick={() => { setScheduleModalOpen(false); setEditingSchedule(null) }}>Cancelar</Button>
            <Button onClick={handleSaveSchedule} loading={scheduleSaving}>{editingSchedule ? 'Guardar cambios' : 'Crear'}</Button>
          </div>
        }
      >
        <form onSubmit={handleSaveSchedule} className="space-y-4">
          <Select label="Empleado" value={schedUserId} onChange={e => setSchedUserId(e.target.value)} options={[{ value: '', label: 'Seleccionar...' }, ...allUsers]} />
          <Select label="Dia de la semana" value={schedDay} onChange={e => setSchedDay(e.target.value)} options={DAY_NAMES.map((d, i) => ({ value: String(i), label: d })).filter((_, i) => i > 0).concat([{ value: '0', label: 'Domingo' }])} />
          <div className="grid grid-cols-2 gap-4">
            <Input label="Hora entrada" type="time" value={schedStart} onChange={e => setSchedStart(e.target.value)} />
            <Input label="Hora salida" type="time" value={schedEnd} onChange={e => setSchedEnd(e.target.value)} />
          </div>
          <Select label="Rol" value={schedRole} onChange={e => setSchedRole(e.target.value)} options={ROLE_OPTIONS} />
        </form>
      </Modal>

      {/* Shift Modal */}
      <Modal
        open={shiftModalOpen}
        onClose={() => setShiftModalOpen(false)}
        title="Nuevo Turno"
        footer={
          <div className="flex items-center gap-3">
            <Button variant="ghost" onClick={() => setShiftModalOpen(false)}>Cancelar</Button>
            <Button onClick={handleSaveShift} loading={shiftSaving}>Crear</Button>
          </div>
        }
      >
        <form onSubmit={handleSaveShift} className="space-y-4">
          <Select label="Empleado" value={shiftUserId} onChange={e => setShiftUserId(e.target.value)} options={[{ value: '', label: 'Seleccionar...' }, ...allUsers]} />
          <div className="grid grid-cols-2 gap-4">
            <Input label="Hora programada entrada" type="time" value={shiftSchedStart} onChange={e => setShiftSchedStart(e.target.value)} />
            <Input label="Hora programada salida" type="time" value={shiftSchedEnd} onChange={e => setShiftSchedEnd(e.target.value)} />
          </div>
        </form>
      </Modal>

      {/* Cierre de Turno Modal (wizard) */}
      <Modal
        open={closingShift !== null}
        onClose={() => setClosingShift(null)}
        title="Cierre de Turno"
        size="lg"
        footer={
          <div className="flex items-center gap-3">
            {closingStep > 0 && (
              <Button variant="ghost" onClick={() => setClosingStep(closingStep - 1)}>Anterior</Button>
            )}
            <Button variant="ghost" onClick={() => setClosingShift(null)}>Cancelar</Button>
            {closingStep < 4 ? (
              <Button onClick={() => setClosingStep(closingStep + 1)}>Siguiente</Button>
            ) : (
              <Button onClick={confirmCloseShift} loading={closingSaving}>Confirmar Cierre</Button>
            )}
          </div>
        }
      >
        {closingShift && (
          <div className="space-y-6">
            {/* Step indicators */}
            <div className="flex gap-1">
              {['Resumen', 'Caja', 'Stock', 'Checklist', 'Notas'].map((label, i) => (
                <button
                  key={label}
                  onClick={() => setClosingStep(i)}
                  className={`flex-1 py-1.5 rounded text-xs font-medium transition-colors ${
                    closingStep === i ? 'bg-cyan-600 text-white' : 'bg-slate-700 text-slate-400'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            {/* Step 0: Resumen */}
            {closingStep === 0 && (
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-slate-300">Resumen del turno</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="rounded-lg bg-slate-700/50 p-3">
                    <p className="text-xs text-slate-400">Empleado</p>
                    <p className="text-sm text-white font-medium">{closingShift.user?.full_name || 'Staff'}</p>
                  </div>
                  <div className="rounded-lg bg-slate-700/50 p-3">
                    <p className="text-xs text-slate-400">Rol</p>
                    <p className="text-sm text-white font-medium">{ROLE_OPTIONS.find(r => r.value === closingShift.role)?.label || closingShift.role || '-'}</p>
                  </div>
                  <div className="rounded-lg bg-slate-700/50 p-3">
                    <p className="text-xs text-slate-400">Check-in</p>
                    <p className="text-sm text-white font-medium">{formatTime(closingShift.check_in)}</p>
                  </div>
                  <div className="rounded-lg bg-slate-700/50 p-3">
                    <p className="text-xs text-slate-400">Tiempo transcurrido</p>
                    <p className="text-sm text-white font-medium">{closingShift.check_in ? <LiveTimer from={closingShift.check_in} /> : '-'}</p>
                  </div>
                  <div className="rounded-lg bg-slate-700/50 p-3">
                    <p className="text-xs text-slate-400">Pausas</p>
                    <p className="text-sm text-white font-medium">{closingShift.break_minutes || 0} min</p>
                  </div>
                </div>
              </div>
            )}

            {/* Step 1: Cuadre de caja */}
            {closingStep === 1 && (
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-slate-300">Cuadre de Caja</h3>
                {!shiftNeedsCheckbox(closingShift) ? (
                  <p className="text-sm text-slate-500">No aplica para este rol. Podes saltar este paso.</p>
                ) : closingExpected ? (
                  <div className="space-y-3">
                    {PAYMENT_METHODS.map(m => {
                      const exp = closingExpected[m.key as keyof CashRegisterSummary] as number
                      const act = closingCash[m.key] || 0
                      const diff = act - exp
                      return (
                        <div key={m.key} className="grid grid-cols-4 gap-3 items-center">
                          <div className="flex items-center gap-2 text-sm text-slate-300">
                            {m.icon} {m.label}
                          </div>
                          <div className="text-sm text-slate-400 text-right">{exp.toFixed(2)} EUR</div>
                          <Input
                            type="number"
                            step="0.01"
                            value={closingCash[m.key]?.toString() || ''}
                            onChange={e => setClosingCash(prev => ({ ...prev, [m.key]: parseFloat(e.target.value) || 0 }))}
                            placeholder="Real"
                          />
                          <div className={`text-sm font-medium text-right ${diff === 0 ? 'text-green-400' : 'text-red-400'}`}>
                            {diff >= 0 ? '+' : ''}{diff.toFixed(2)}
                          </div>
                        </div>
                      )
                    })}
                    <div className="border-t border-slate-700 pt-3 flex justify-between text-sm">
                      <span className="text-slate-400">Transacciones: {closingExpected.bookings + closingExpected.sales}</span>
                      <span className="text-slate-400">Reservas: {closingExpected.bookings} | Ventas: {closingExpected.sales}</span>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-slate-500">Cargando datos de caja...</p>
                )}
              </div>
            )}

            {/* Step 2: Control stock */}
            {closingStep === 2 && (
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-slate-300">Control de Stock (opcional)</h3>
                {closingStockItems.length === 0 ? (
                  <p className="text-sm text-slate-500">No hay productos activos</p>
                ) : (
                  <div className="max-h-60 overflow-y-auto space-y-2">
                    {closingStockItems.map((item, i) => (
                      <div key={item.product_id} className="grid grid-cols-4 gap-2 items-center">
                        <span className="text-sm text-white truncate">{item.product_name}</span>
                        <span className="text-sm text-slate-400 text-right">Esperado: {item.expected}</span>
                        <Input
                          type="number"
                          value={item.actual.toString()}
                          onChange={e => {
                            const val = parseInt(e.target.value) || 0
                            setClosingStockItems(prev => prev.map((it, idx) =>
                              idx === i ? { ...it, actual: val, difference: val - it.expected } : it
                            ))
                          }}
                        />
                        <span className={`text-sm font-medium text-right ${item.difference === 0 ? 'text-green-400' : 'text-red-400'}`}>
                          {item.difference >= 0 ? '+' : ''}{item.difference}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Step 3: Checklist */}
            {closingStep === 3 && (
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-slate-300">Checklist de traspaso</h3>
                <div className="space-y-3">
                  {[
                    { key: 'caja' as const, label: 'Caja cuadrada' },
                    { key: 'stock' as const, label: 'Stock verificado' },
                    { key: 'pistas' as const, label: 'Pistas en orden' },
                    { key: 'notas' as const, label: 'Notas para el siguiente turno' },
                  ].map(item => (
                    <label key={item.key} className="flex items-center gap-3 cursor-pointer group">
                      <input
                        type="checkbox"
                        checked={closingChecklist[item.key]}
                        onChange={e => setClosingChecklist(prev => ({ ...prev, [item.key]: e.target.checked }))}
                        className="w-5 h-5 rounded border-slate-600 bg-slate-700 text-cyan-500 focus:ring-cyan-500/40"
                      />
                      <span className={`text-sm ${closingChecklist[item.key] ? 'text-white' : 'text-slate-400'} group-hover:text-white transition-colors`}>
                        {item.label}
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            {/* Step 4: Notas */}
            {closingStep === 4 && (
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-slate-300">Notas</h3>
                <textarea
                  value={closingNotes}
                  onChange={e => setClosingNotes(e.target.value)}
                  rows={5}
                  placeholder="Notas para el siguiente turno..."
                  className="w-full rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/40 focus:border-cyan-500"
                />
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* Cash Close Modal (standalone) */}
      <Modal
        open={cashCloseModalOpen}
        onClose={() => setCashCloseModalOpen(false)}
        title="Cerrar Caja"
        size="lg"
        footer={
          <div className="flex items-center gap-3">
            <Button variant="ghost" onClick={() => setCashCloseModalOpen(false)}>Cancelar</Button>
            <Button onClick={confirmCashClose} loading={cashCloseSaving}>Confirmar Cierre</Button>
          </div>
        }
      >
        {cashExpected && (
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-slate-300">Totales esperados vs. reales</h3>
            {PAYMENT_METHODS.map(m => {
              const exp = cashExpected[m.key as keyof CashRegisterSummary] as number
              const act = cashActual[m.key] || 0
              const diff = act - exp
              return (
                <div key={m.key} className="grid grid-cols-4 gap-3 items-center">
                  <div className="flex items-center gap-2 text-sm text-slate-300">
                    {m.icon} {m.label}
                  </div>
                  <div className="text-sm text-slate-400 text-right">{exp.toFixed(2)} EUR</div>
                  <Input
                    type="number"
                    step="0.01"
                    value={cashActual[m.key]?.toString() || ''}
                    onChange={e => setCashActual(prev => ({ ...prev, [m.key]: parseFloat(e.target.value) || 0 }))}
                    placeholder="Real"
                  />
                  <div className={`text-sm font-medium text-right ${diff === 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {diff >= 0 ? '+' : ''}{diff.toFixed(2)}
                  </div>
                </div>
              )
            })}
            <div className="border-t border-slate-700 pt-3 grid grid-cols-3 gap-3 text-sm text-slate-400">
              <span>Transacciones: {cashExpected.bookings + cashExpected.sales}</span>
              <span>Reservas: {cashExpected.bookings}</span>
              <span>Ventas: {cashExpected.sales}</span>
            </div>
            <textarea
              value={cashNotes}
              onChange={e => setCashNotes(e.target.value)}
              rows={3}
              placeholder="Notas (opcional)..."
              className="w-full rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/40 focus:border-cyan-500"
            />
          </div>
        )}
      </Modal>

      {/* Stock Snapshot Modal */}
      <Modal
        open={stockModalOpen}
        onClose={() => setStockModalOpen(false)}
        title="Tomar Snapshot de Stock"
        size="lg"
        footer={
          <div className="flex items-center gap-3">
            <Button variant="ghost" onClick={() => setStockModalOpen(false)}>Cancelar</Button>
            <Button onClick={confirmStockSnapshot} loading={stockSaving}>Guardar Snapshot</Button>
          </div>
        }
      >
        <div className="space-y-4">
          <p className="text-sm text-slate-400">Contá el stock real de cada producto y registralo aca.</p>
          {stockItems.length === 0 ? (
            <p className="text-sm text-slate-500">No hay productos activos</p>
          ) : (
            <div className="max-h-96 overflow-y-auto space-y-2">
              <div className="grid grid-cols-4 gap-2 text-xs text-slate-500 font-medium sticky top-0 bg-slate-800 py-1">
                <span>Producto</span>
                <span className="text-right">Esperado</span>
                <span>Real</span>
                <span className="text-right">Diferencia</span>
              </div>
              {stockItems.map((item, i) => (
                <div key={item.product_id} className="grid grid-cols-4 gap-2 items-center">
                  <span className="text-sm text-white truncate">{item.product_name}</span>
                  <span className="text-sm text-slate-400 text-right">{item.expected}</span>
                  <Input
                    type="number"
                    value={item.actual.toString()}
                    onChange={e => {
                      const val = parseInt(e.target.value) || 0
                      setStockItems(prev => prev.map((it, idx) =>
                        idx === i ? { ...it, actual: val, difference: val - it.expected } : it
                      ))
                    }}
                  />
                  <span className={`text-sm font-medium text-right ${item.difference === 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {item.difference >= 0 ? '+' : ''}{item.difference}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </Modal>

      {/* Credential Registration Modal */}
      <Modal
        open={credModalOpen}
        onClose={() => setCredModalOpen(false)}
        title={`Registrar ${credType === 'pin' ? 'PIN' : credType === 'nfc' ? 'NFC' : credType === 'fingerprint' ? 'Huella Digital' : 'Reconocimiento Facial'}`}
        footer={
          <div className="flex items-center gap-3">
            <Button variant="ghost" onClick={() => setCredModalOpen(false)}>Cancelar</Button>
            {credType === 'pin' && <Button onClick={saveCredential} loading={credSaving}>Registrar PIN</Button>}
            {credType !== 'pin' && <Button onClick={saveCredential} loading={credSaving}>Simular Registro</Button>}
          </div>
        }
      >
        {credType === 'pin' && (
          <div className="space-y-4">
            <Input
              label="Codigo PIN (4-6 digitos)"
              type="password"
              maxLength={6}
              value={credPin}
              onChange={e => setCredPin(e.target.value.replace(/\D/g, ''))}
              placeholder="****"
            />
            <Input
              label="Confirmar PIN"
              type="password"
              maxLength={6}
              value={credPinConfirm}
              onChange={e => setCredPinConfirm(e.target.value.replace(/\D/g, ''))}
              placeholder="****"
            />
          </div>
        )}
        {credType === 'nfc' && (
          <div className="text-center py-8 space-y-4">
            <div className="mx-auto w-16 h-16 rounded-full bg-cyan-500/20 flex items-center justify-center animate-pulse">
              <Wifi size={32} className="text-cyan-400" />
            </div>
            <p className="text-slate-300">Acerca el tag NFC al lector...</p>
            <p className="text-xs text-slate-500">Esperando lectura del dispositivo</p>
          </div>
        )}
        {credType === 'fingerprint' && (
          <div className="text-center py-8 space-y-4">
            <div className="mx-auto w-16 h-16 rounded-full bg-green-500/20 flex items-center justify-center animate-pulse">
              <Fingerprint size={32} className="text-green-400" />
            </div>
            <p className="text-slate-300">Coloca el dedo en el sensor...</p>
            <p className="text-xs text-slate-500">Esperando lectura del sensor biometrico</p>
          </div>
        )}
        {credType === 'facial' && (
          <div className="text-center py-8 space-y-4">
            <div className="mx-auto w-16 h-16 rounded-full bg-purple-500/20 flex items-center justify-center animate-pulse">
              <Camera size={32} className="text-purple-400" />
            </div>
            <p className="text-slate-300">Mira a la camara...</p>
            <p className="text-xs text-slate-500">Capturando datos faciales</p>
          </div>
        )}
      </Modal>

      {/* Cash Closing Detail Modal */}
      <Modal
        open={cashDetailModal !== null}
        onClose={() => setCashDetailModal(null)}
        title="Detalle de Cierre de Caja"
        size="lg"
      >
        {cashDetailModal && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="rounded-lg bg-slate-700/50 p-3">
                <p className="text-xs text-slate-400">Cerrado por</p>
                <p className="text-sm text-white font-medium">{cashDetailModal.user?.full_name || '-'}</p>
              </div>
              <div className="rounded-lg bg-slate-700/50 p-3">
                <p className="text-xs text-slate-400">Fecha/hora</p>
                <p className="text-sm text-white font-medium">{formatDateTime(cashDetailModal.closed_at)}</p>
              </div>
            </div>

            <h3 className="text-sm font-semibold text-slate-300">Desglose por metodo de pago</h3>
            <div className="space-y-2">
              {PAYMENT_METHODS.map(m => {
                const exp = cashDetailModal[`expected_${m.key}` as keyof CashClosing] as number
                const act = cashDetailModal[`actual_${m.key}` as keyof CashClosing] as number
                const diff = act - exp
                return (
                  <div key={m.key} className="grid grid-cols-4 gap-3 items-center">
                    <div className="flex items-center gap-2 text-sm text-slate-300">{m.icon} {m.label}</div>
                    <div className="text-sm text-slate-400 text-right">Esperado: {exp.toFixed(2)}</div>
                    <div className="text-sm text-white text-right">Real: {act.toFixed(2)}</div>
                    <div className={`text-sm font-medium text-right ${diff === 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {diff >= 0 ? '+' : ''}{diff.toFixed(2)}
                    </div>
                  </div>
                )
              })}
            </div>

            <div className="border-t border-slate-700 pt-3 grid grid-cols-3 gap-3 text-sm">
              <span className="text-slate-400">Transacciones: {cashDetailModal.transaction_count}</span>
              <span className="text-slate-400">Reservas: {cashDetailModal.booking_count}</span>
              <span className="text-slate-400">Ventas: {cashDetailModal.sale_count}</span>
            </div>

            {cashDetailModal.notes && (
              <div className="rounded-lg bg-slate-700/50 p-3">
                <p className="text-xs text-slate-400 mb-1">Notas</p>
                <p className="text-sm text-white">{cashDetailModal.notes}</p>
              </div>
            )}

            <div className="flex justify-between items-center border-t border-slate-700 pt-3">
              <span className="text-sm text-slate-300 font-medium">Diferencia total</span>
              <span className={`text-lg font-bold ${cashDetailModal.difference === 0 ? 'text-green-400' : 'text-red-400'}`}>
                {cashDetailModal.difference >= 0 ? '+' : ''}{cashDetailModal.difference.toFixed(2)} EUR
              </span>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
