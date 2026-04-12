'use client'

import { useState, useCallback, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Card } from '@/components/ui/card'
import { Modal } from '@/components/ui/modal'
import { Badge } from '@/components/ui/badge'
import { KpiCard } from '@/components/ui/kpi-card'
import { useToast } from '@/components/ui/toast'
import { UserCog, Plus, Calendar, Clock, Users, CheckCircle, XCircle, Edit2, Trash2, LogIn, LogOut } from 'lucide-react'
import type { StaffSchedule, StaffShift } from '@/types'

const DAY_NAMES = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']
const ROLE_OPTIONS = [
  { value: 'recepcion', label: 'Recepción' },
  { value: 'entrenador', label: 'Entrenador' },
  { value: 'mantenimiento', label: 'Mantenimiento' },
  { value: 'limpieza', label: 'Limpieza' },
  { value: 'gerente', label: 'Gerente' },
  { value: 'otro', label: 'Otro' },
]

type Tab = 'schedules' | 'shifts'

export default function AdminStaffPage() {
  const { toast } = useToast()
  const [tab, setTab] = useState<Tab>('shifts')

  // Schedules (horarios semanales)
  const [schedules, setSchedules] = useState<(StaffSchedule & { user?: { full_name: string } })[]>([])
  const [loadingSchedules, setLoadingSchedules] = useState(true)
  const [scheduleModalOpen, setScheduleModalOpen] = useState(false)
  const [scheduleSaving, setScheduleSaving] = useState(false)

  const [schedUserId, setSchedUserId] = useState('')
  const [schedDay, setSchedDay] = useState('1')
  const [schedStart, setSchedStart] = useState('09:00')
  const [schedEnd, setSchedEnd] = useState('17:00')
  const [schedRole, setSchedRole] = useState('recepcion')

  // Shifts (turnos diarios)
  const [shifts, setShifts] = useState<(StaffShift & { user?: { full_name: string } })[]>([])
  const [loadingShifts, setLoadingShifts] = useState(true)
  const [shiftDate, setShiftDate] = useState(() => new Date().toISOString().split('T')[0])
  const [shiftModalOpen, setShiftModalOpen] = useState(false)
  const [shiftSaving, setShiftSaving] = useState(false)

  const [shiftUserId, setShiftUserId] = useState('')
  const [shiftSchedStart, setShiftSchedStart] = useState('09:00')
  const [shiftSchedEnd, setShiftSchedEnd] = useState('17:00')

  // Users
  const [allUsers, setAllUsers] = useState<{ value: string; label: string }[]>([])

  const loadUsers = useCallback(async () => {
    const supabase = createClient()
    const { data } = await supabase
      .from('nm_club_members')
      .select('user_id, user:nm_users(full_name)')
      .eq('club_id', 1)
      .in('role', ['owner', 'admin', 'staff'])
    setAllUsers((data || []).map((d: Record<string, unknown>) => {
      const u = d.user as { full_name: string } | { full_name: string }[] | null
      const name = Array.isArray(u) ? u[0]?.full_name : u?.full_name
      return { value: d.user_id as string, label: name || (d.user_id as string) }
    }))
  }, [])

  const loadSchedules = useCallback(async () => {
    setLoadingSchedules(true)
    const supabase = createClient()
    const { data } = await supabase
      .from('nm_staff_schedules')
      .select('*, user:nm_users(full_name)')
      .eq('club_id', 1)
      .eq('is_active', true)
      .order('day_of_week')
      .order('start_time')
    setSchedules((data || []) as typeof schedules)
    setLoadingSchedules(false)
  }, [])

  const loadShifts = useCallback(async () => {
    setLoadingShifts(true)
    const supabase = createClient()
    const { data } = await supabase
      .from('nm_staff_shifts')
      .select('*, user:nm_users(full_name)')
      .eq('club_id', 1)
      .eq('date', shiftDate)
      .order('scheduled_start')
    setShifts((data || []) as typeof shifts)
    setLoadingShifts(false)
  }, [shiftDate])

  useEffect(() => { loadUsers() }, [loadUsers])
  useEffect(() => { loadSchedules() }, [loadSchedules])
  useEffect(() => { loadShifts() }, [loadShifts])

  const todayShifts = shifts.length
  const activeShifts = shifts.filter(s => s.status === 'active').length
  const completedShifts = shifts.filter(s => s.status === 'completed').length
  const absentShifts = shifts.filter(s => s.status === 'absent').length

  async function handleSaveSchedule(e: React.FormEvent) {
    e.preventDefault()
    if (!schedUserId) return
    setScheduleSaving(true)
    const supabase = createClient()
    const { error } = await supabase.from('nm_staff_schedules').insert({
      club_id: 1,
      user_id: schedUserId,
      day_of_week: Number(schedDay),
      start_time: schedStart,
      end_time: schedEnd,
      role: schedRole,
      is_active: true,
    })
    if (error) toast('error', 'Error: ' + error.message)
    else { toast('success', 'Horario creado'); setScheduleModalOpen(false); loadSchedules() }
    setScheduleSaving(false)
  }

  async function deleteSchedule(id: number) {
    if (!confirm('¿Eliminar este horario?')) return
    const supabase = createClient()
    await supabase.from('nm_staff_schedules').delete().eq('id', id)
    loadSchedules()
  }

  async function handleSaveShift(e: React.FormEvent) {
    e.preventDefault()
    if (!shiftUserId) return
    setShiftSaving(true)
    const supabase = createClient()
    const { error } = await supabase.from('nm_staff_shifts').insert({
      club_id: 1,
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

  async function checkIn(id: number) {
    const supabase = createClient()
    await supabase.from('nm_staff_shifts').update({
      check_in: new Date().toISOString(),
      status: 'active',
    }).eq('id', id)
    toast('success', 'Check-in registrado')
    loadShifts()
  }

  async function checkOut(id: number) {
    const supabase = createClient()
    await supabase.from('nm_staff_shifts').update({
      check_out: new Date().toISOString(),
      status: 'completed',
    }).eq('id', id)
    toast('success', 'Check-out registrado')
    loadShifts()
  }

  async function markAbsent(id: number) {
    const supabase = createClient()
    await supabase.from('nm_staff_shifts').update({ status: 'absent' }).eq('id', id)
    toast('info', 'Marcado como ausente')
    loadShifts()
  }

  async function deleteShift(id: number) {
    if (!confirm('¿Eliminar este turno?')) return
    const supabase = createClient()
    await supabase.from('nm_staff_shifts').delete().eq('id', id)
    loadShifts()
  }

  // Generate shifts from schedules for today
  async function generateFromSchedule() {
    const dayOfWeek = new Date(shiftDate + 'T12:00:00').getDay()
    const todaySchedules = schedules.filter(s => s.day_of_week === dayOfWeek)
    if (todaySchedules.length === 0) { toast('info', 'No hay horarios para este día'); return }

    const supabase = createClient()
    let created = 0
    for (const s of todaySchedules) {
      // Check if shift already exists
      const { data: existing } = await supabase
        .from('nm_staff_shifts')
        .select('id')
        .eq('user_id', s.user_id)
        .eq('date', shiftDate)
        .single()
      if (existing) continue

      await supabase.from('nm_staff_shifts').insert({
        club_id: 1,
        user_id: s.user_id,
        date: shiftDate,
        scheduled_start: s.start_time,
        scheduled_end: s.end_time,
        status: 'scheduled',
      })
      created++
    }
    toast('success', `${created} turnos generados desde horarios`)
    loadShifts()
  }

  const tabs: { key: Tab; label: string; icon: React.ReactNode }[] = [
    { key: 'shifts', label: 'Turnos del Día', icon: <Clock size={16} /> },
    { key: 'schedules', label: 'Horarios Semanales', icon: <Calendar size={16} /> },
  ]

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Gestión de Staff</h1>
          <p className="text-sm text-slate-400 mt-1">Turnos, horarios y asistencia del personal</p>
        </div>
        <div className="flex gap-2">
          {tab === 'shifts' && (
            <>
              <Button variant="ghost" onClick={generateFromSchedule}>
                <Calendar size={14} className="mr-1" /> Generar desde Horarios
              </Button>
              <Button onClick={() => setShiftModalOpen(true)}>
                <Plus size={16} className="mr-1" /> Nuevo Turno
              </Button>
            </>
          )}
          {tab === 'schedules' && (
            <Button onClick={() => setScheduleModalOpen(true)}>
              <Plus size={16} className="mr-1" /> Nuevo Horario
            </Button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-800/50 p-1 rounded-lg w-fit">
        {tabs.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)} className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${tab === t.key ? 'bg-cyan-600 text-white' : 'text-slate-400 hover:text-white'}`}>
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {tab === 'shifts' && (
        <>
          {/* Date picker */}
          <div className="flex items-center gap-3">
            <input type="date" value={shiftDate} onChange={e => setShiftDate(e.target.value)} className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white" />
            <span className="text-lg font-semibold text-white capitalize">
              {new Date(shiftDate + 'T12:00:00').toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })}
            </span>
          </div>

          {/* KPIs */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <KpiCard title="Turnos hoy" value={todayShifts} icon={<Users size={20} />} />
            <KpiCard title="Activos" value={activeShifts} icon={<CheckCircle size={20} />} color="#10b981" />
            <KpiCard title="Completados" value={completedShifts} icon={<LogOut size={20} />} color="#6366f1" />
            <KpiCard title="Ausentes" value={absentShifts} icon={<XCircle size={20} />} color="#ef4444" />
          </div>

          {/* Shifts */}
          {loadingShifts ? (
            <div className="text-center py-12 text-slate-500">Cargando...</div>
          ) : shifts.length === 0 ? (
            <Card><div className="text-center py-12 text-slate-500">No hay turnos para este día</div></Card>
          ) : (
            <Card>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-slate-700">
                      <th className="text-left text-xs font-medium text-slate-400 pb-3 pl-2">Staff</th>
                      <th className="text-left text-xs font-medium text-slate-400 pb-3">Horario</th>
                      <th className="text-left text-xs font-medium text-slate-400 pb-3">Check-in</th>
                      <th className="text-left text-xs font-medium text-slate-400 pb-3">Check-out</th>
                      <th className="text-left text-xs font-medium text-slate-400 pb-3">Estado</th>
                      <th className="text-right text-xs font-medium text-slate-400 pb-3 pr-2">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {shifts.map(s => (
                      <tr key={s.id} className="border-b border-slate-800">
                        <td className="py-3 pl-2 text-sm font-medium text-white">{s.user?.full_name || 'Staff'}</td>
                        <td className="py-3 text-sm text-slate-400">{s.scheduled_start} - {s.scheduled_end}</td>
                        <td className="py-3 text-sm text-slate-400">{s.check_in ? new Date(s.check_in).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }) : '-'}</td>
                        <td className="py-3 text-sm text-slate-400">{s.check_out ? new Date(s.check_out).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }) : '-'}</td>
                        <td className="py-3">
                          <Badge variant={s.status === 'active' ? 'success' : s.status === 'completed' ? 'info' : s.status === 'absent' ? 'danger' : 'warning'}>
                            {s.status === 'active' ? 'Activo' : s.status === 'completed' ? 'Completado' : s.status === 'absent' ? 'Ausente' : 'Programado'}
                          </Badge>
                        </td>
                        <td className="py-3 pr-2 text-right">
                          <div className="flex items-center justify-end gap-1">
                            {s.status === 'scheduled' && (
                              <>
                                <button onClick={() => checkIn(s.id)} className="px-2 py-1 rounded text-xs text-green-400 hover:bg-green-500/10 flex items-center gap-1"><LogIn size={12} /> Entrada</button>
                                <button onClick={() => markAbsent(s.id)} className="px-2 py-1 rounded text-xs text-red-400 hover:bg-red-500/10">Ausente</button>
                              </>
                            )}
                            {s.status === 'active' && (
                              <button onClick={() => checkOut(s.id)} className="px-2 py-1 rounded text-xs text-blue-400 hover:bg-blue-500/10 flex items-center gap-1"><LogOut size={12} /> Salida</button>
                            )}
                            <button onClick={() => deleteShift(s.id)} className="p-1 rounded text-slate-500 hover:text-red-400 hover:bg-red-500/10"><Trash2 size={14} /></button>
                          </div>
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

      {tab === 'schedules' && (
        <>
          {loadingSchedules ? (
            <div className="text-center py-12 text-slate-500">Cargando...</div>
          ) : schedules.length === 0 ? (
            <Card><div className="text-center py-12 text-slate-500">No hay horarios configurados</div></Card>
          ) : (
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
                              {s.role && <Badge variant="default">{ROLE_OPTIONS.find(r => r.value === s.role)?.label || s.role}</Badge>}
                            </div>
                          </div>
                          <button onClick={() => deleteSchedule(s.id)} className="p-1 rounded text-slate-500 hover:text-red-400 hover:bg-red-500/10"><Trash2 size={14} /></button>
                        </div>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </>
      )}

      {/* Schedule Modal */}
      <Modal
        open={scheduleModalOpen}
        onClose={() => setScheduleModalOpen(false)}
        title="Nuevo Horario Semanal"
        footer={
          <div className="flex items-center gap-3">
            <Button variant="ghost" onClick={() => setScheduleModalOpen(false)}>Cancelar</Button>
            <Button onClick={handleSaveSchedule} loading={scheduleSaving}>Crear</Button>
          </div>
        }
      >
        <form onSubmit={handleSaveSchedule} className="space-y-4">
          <Select label="Empleado" value={schedUserId} onChange={e => setSchedUserId(e.target.value)} options={[{ value: '', label: 'Seleccionar...' }, ...allUsers]} />
          <Select label="Día de la semana" value={schedDay} onChange={e => setSchedDay(e.target.value)} options={DAY_NAMES.map((d, i) => ({ value: String(i), label: d })).filter((_, i) => i > 0).concat([{ value: '0', label: 'Domingo' }])} />
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
    </div>
  )
}
