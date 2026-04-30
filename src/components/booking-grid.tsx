'use client'

import { useState, useCallback, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { cn, formatCurrency, generateTimeSlots, COURT_COLORS } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { ChevronLeft, ChevronRight, Plus, Clock, CalendarDays } from 'lucide-react'
import type { Court, CourtSchedule, Booking } from '@/types'

export type BookingView = 'grid' | 'timeline' | 'agenda'

interface BookingGridProps {
  isAdmin?: boolean
  view?: BookingView
  onSlotClick?: (court: Court, date: string, time: string) => void
  onBookingClick?: (booking: Booking) => void
}

export function BookingGrid({ view = 'grid', onSlotClick, onBookingClick }: BookingGridProps) {
  const [date, setDate] = useState(() => new Date().toISOString().split('T')[0])
  const [courts, setCourts] = useState<Court[]>([])
  const [schedules, setSchedules] = useState<CourtSchedule[]>([])
  const [bookings, setBookings] = useState<Booking[]>([])
  const [loading, setLoading] = useState(true)

  const dayOfWeek = new Date(date + 'T12:00:00').getDay()

  const loadData = useCallback(async () => {
    setLoading(true)
    const supabase = createClient()

    const [courtsRes, schedulesRes, bookingsRes] = await Promise.all([
      supabase.from('nm_courts').select('*').eq('club_id', 1).eq('is_active', true).order('sort_order'),
      supabase.from('nm_court_schedules').select('*'),
      supabase.from('nm_bookings').select('*, court:nm_courts(id, name, color)').eq('club_id', 1).eq('date', date).neq('status', 'cancelled'),
    ])

    setCourts(courtsRes.data || [])
    setSchedules(schedulesRes.data || [])
    setBookings((bookingsRes.data || []) as unknown as Booking[])
    setLoading(false)
  }, [date])

  useEffect(() => {
    loadData()
  }, [loadData])

  useEffect(() => {
    const supabase = createClient()
    const channel = supabase
      .channel('bookings-realtime')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'nm_bookings',
        filter: `date=eq.${date}`,
      }, () => {
        loadData()
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [date, loadData])

  function changeDate(delta: number) {
    const d = new Date(date + 'T12:00:00')
    d.setDate(d.getDate() + delta)
    setDate(d.toISOString().split('T')[0])
  }

  function goToday() {
    setDate(new Date().toISOString().split('T')[0])
  }

  const getCourtSchedule = (courtId: number) =>
    schedules.find(s => s.court_id === courtId && s.day_of_week === dayOfWeek)

  const allSlots = (() => {
    const slotSet = new Set<string>()
    courts.forEach(court => {
      const schedule = getCourtSchedule(court.id)
      if (schedule) {
        const slots = generateTimeSlots(schedule.open_time, schedule.close_time, 30)
        slots.forEach(s => slotSet.add(s))
      }
    })
    return Array.from(slotSet).sort()
  })()

  const isToday = date === new Date().toISOString().split('T')[0]
  const dateObj = new Date(date + 'T12:00:00')
  const dateLabel = dateObj.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <button onClick={() => changeDate(-1)} className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors">
            <ChevronLeft size={20} />
          </button>
          <button onClick={goToday} className={cn('px-3 py-2 rounded-lg text-sm font-medium transition-colors', isToday ? 'bg-cyan-600 text-white' : 'bg-slate-800 hover:bg-slate-700 text-slate-300')}>
            Hoy
          </button>
          <button onClick={() => changeDate(1)} className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors">
            <ChevronRight size={20} />
          </button>
        </div>
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-semibold text-white capitalize">{dateLabel}</h2>
          <input
            type="date"
            value={date}
            onChange={e => setDate(e.target.value)}
            className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-white"
          />
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : view === 'timeline' ? (
        <TimelineView
          courts={courts}
          allSlots={allSlots}
          bookings={bookings}
          schedules={schedules}
          dayOfWeek={dayOfWeek}
          date={date}
          onSlotClick={onSlotClick}
          onBookingClick={onBookingClick}
        />
      ) : view === 'agenda' ? (
        <AgendaView
          courts={courts}
          bookings={bookings}
          onBookingClick={onBookingClick}
        />
      ) : (
        <GridView
          courts={courts}
          allSlots={allSlots}
          bookings={bookings}
          schedules={schedules}
          dayOfWeek={dayOfWeek}
          date={date}
          onSlotClick={onSlotClick}
          onBookingClick={onBookingClick}
        />
      )}

      <div className="flex items-center gap-6 text-xs text-slate-500 flex-wrap">
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded bg-slate-800/30 border border-slate-700" />
          <span>Disponible</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded bg-amber-500/10 border border-amber-500/20" />
          <span>Hora punta</span>
        </div>
        {courts.map((court, i) => (
          <div key={court.id} className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded" style={{ backgroundColor: `${court.color || COURT_COLORS[i]}40` }} />
            <span>{court.name}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ============== Vista 1: GRID (horas × pistas) ==============

interface ViewProps {
  courts: Court[]
  allSlots: string[]
  bookings: Booking[]
  schedules: CourtSchedule[]
  dayOfWeek: number
  date: string
  onSlotClick?: (court: Court, date: string, time: string) => void
  onBookingClick?: (booking: Booking) => void
}

function GridView({ courts, allSlots, bookings, schedules, dayOfWeek, date, onSlotClick, onBookingClick }: ViewProps) {
  function getBookingForSlot(courtId: number, time: string) {
    return bookings.find(b => {
      if (b.court_id !== courtId) return false
      const startMin = timeToMinutes(b.start_time)
      const endMin = timeToMinutes(b.end_time)
      const slotMin = timeToMinutes(time)
      return slotMin >= startMin && slotMin < endMin
    })
  }

  function isBookingStart(courtId: number, time: string) {
    return bookings.find(b => b.court_id === courtId && b.start_time.slice(0, 5) === time)
  }

  function getBookingSpan(b: Booking) {
    return Math.ceil((timeToMinutes(b.end_time) - timeToMinutes(b.start_time)) / 30)
  }

  function isPeak(courtId: number, time: string) {
    const s = schedules.find(s => s.court_id === courtId && s.day_of_week === dayOfWeek)
    if (!s?.is_peak || !s.peak_start || !s.peak_end) return false
    const min = timeToMinutes(time)
    return min >= timeToMinutes(s.peak_start) && min < timeToMinutes(s.peak_end)
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-slate-700/50">
      <table className="w-full border-collapse">
        <thead>
          <tr>
            <th className="sticky left-0 z-10 bg-slate-900 border-b border-r border-slate-700 px-3 py-3 text-left text-xs font-medium text-slate-400 w-20">
              <Clock size={14} className="inline mr-1" />
              Hora
            </th>
            {courts.map((court, i) => (
              <th key={court.id} className="border-b border-slate-700 px-3 py-3 text-center min-w-[160px]" style={{ borderTop: `3px solid ${court.color || COURT_COLORS[i]}` }}>
                <span className="text-sm font-semibold text-white">{court.name}</span>
                {court.surface && <span className="block text-xs text-slate-500">{court.surface}</span>}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {allSlots.map(time => {
            const isHour = time.endsWith(':00')
            return (
              <tr key={time} className={cn(isHour ? 'border-t border-slate-700/80' : 'border-t border-slate-800/50')}>
                <td className={cn('sticky left-0 z-10 bg-slate-900 border-r border-slate-700 px-3 py-0 text-xs tabular-nums', isHour ? 'text-white font-medium' : 'text-slate-600')}>
                  {time}
                </td>
                {courts.map((court, ci) => {
                  const booking = getBookingForSlot(court.id, time)
                  const start = isBookingStart(court.id, time)
                  const peak = isPeak(court.id, time)

                  if (start) {
                    const span = getBookingSpan(start)
                    return (
                      <td key={court.id} rowSpan={span} className="p-0.5 relative" style={{ height: `${span * 28}px` }}>
                        <button
                          onClick={() => onBookingClick?.(start)}
                          className="w-full h-full rounded-lg px-2 py-1 text-left transition-all hover:brightness-110 cursor-pointer border-l-4"
                          style={{
                            backgroundColor: `${court.color || COURT_COLORS[ci]}20`,
                            borderLeftColor: court.color || COURT_COLORS[ci],
                          }}
                        >
                          <div className="text-xs font-medium text-white truncate">{start.notes || 'Reserva'}</div>
                          <div className="text-[10px] text-slate-400">{start.start_time.slice(0, 5)} - {start.end_time.slice(0, 5)}</div>
                          {start.price != null && (
                            <div className="text-[10px] font-medium" style={{ color: court.color || COURT_COLORS[ci] }}>
                              {formatCurrency(start.price)}
                            </div>
                          )}
                          <Badge variant={start.status === 'confirmed' ? 'success' : start.status === 'pending' ? 'warning' : 'default'} className="mt-0.5 text-[9px]">
                            {start.status === 'confirmed' ? 'Confirmada' : start.status === 'pending' ? 'Pendiente' : start.status}
                          </Badge>
                        </button>
                      </td>
                    )
                  }

                  if (booking) return null

                  return (
                    <td key={court.id} className="p-0.5" style={{ height: '28px' }}>
                      <button
                        onClick={() => onSlotClick?.(court, date, time)}
                        className={cn(
                          'w-full h-full rounded transition-colors text-center',
                          peak ? 'bg-amber-500/5 hover:bg-amber-500/15 border border-amber-500/10' : 'bg-slate-800/30 hover:bg-slate-700/50',
                        )}
                        title={`${court.name} — ${time} ${peak ? '(peak)' : ''}`}
                      >
                        <Plus size={12} className="mx-auto text-slate-600 opacity-0 group-hover:opacity-100" />
                      </button>
                    </td>
                  )
                })}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

// ============== Vista 2: TIMELINE (pistas × horas, horizontal) ==============

function TimelineView({ courts, allSlots, bookings, schedules, dayOfWeek, date, onSlotClick, onBookingClick }: ViewProps) {
  if (allSlots.length === 0) {
    return <EmptyDay />
  }

  const slotWidth = 56
  const totalWidth = allSlots.length * slotWidth
  const labelWidth = 120

  const firstSlotMin = timeToMinutes(allSlots[0])

  function isPeak(courtId: number, time: string) {
    const s = schedules.find(s => s.court_id === courtId && s.day_of_week === dayOfWeek)
    if (!s?.is_peak || !s.peak_start || !s.peak_end) return false
    const min = timeToMinutes(time)
    return min >= timeToMinutes(s.peak_start) && min < timeToMinutes(s.peak_end)
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-slate-700/50 bg-slate-900/40">
      <div style={{ minWidth: totalWidth + labelWidth }}>
        {/* Header de horas */}
        <div className="flex border-b border-slate-700 sticky top-0 bg-slate-900 z-10">
          <div className="border-r border-slate-700 bg-slate-900 sticky left-0 z-20 flex items-center px-3 py-2 text-xs font-medium text-slate-400" style={{ width: labelWidth, minWidth: labelWidth }}>
            <Clock size={14} className="inline mr-1" />
            Pista \ Hora
          </div>
          {allSlots.map(time => {
            const isHour = time.endsWith(':00')
            return (
              <div
                key={time}
                className={cn('flex items-center justify-center text-[10px] tabular-nums border-r', isHour ? 'border-slate-700 text-white font-medium' : 'border-slate-800 text-slate-600')}
                style={{ width: slotWidth, minWidth: slotWidth, height: 32 }}
              >
                {isHour ? time : ''}
              </div>
            )
          })}
        </div>

        {/* Filas por pista */}
        {courts.map((court, ci) => {
          const courtBookings = bookings.filter(b => b.court_id === court.id)
          const color = court.color || COURT_COLORS[ci]
          return (
            <div key={court.id} className="flex border-b border-slate-800 relative" style={{ height: 60 }}>
              {/* Etiqueta de pista */}
              <div
                className="border-r border-slate-700 bg-slate-900 sticky left-0 z-10 flex flex-col justify-center px-3"
                style={{ width: labelWidth, minWidth: labelWidth, borderLeft: `3px solid ${color}` }}
              >
                <span className="text-sm font-semibold text-white">{court.name}</span>
                {court.surface && <span className="text-[10px] text-slate-500">{court.surface}</span>}
              </div>

              {/* Lane: slots vacíos clickeables */}
              <div className="relative flex" style={{ width: totalWidth }}>
                {allSlots.map(time => {
                  const peak = isPeak(court.id, time)
                  return (
                    <button
                      key={time}
                      onClick={() => onSlotClick?.(court, date, time)}
                      className={cn(
                        'border-r border-slate-800 transition-colors',
                        peak ? 'bg-amber-500/5 hover:bg-amber-500/15' : 'hover:bg-slate-800/50',
                      )}
                      style={{ width: slotWidth, minWidth: slotWidth, height: 60 }}
                      title={`${court.name} — ${time}${peak ? ' (peak)' : ''}`}
                    />
                  )
                })}

                {/* Bookings absolutos sobre la lane */}
                {courtBookings.map(b => {
                  const startMin = timeToMinutes(b.start_time)
                  const endMin = timeToMinutes(b.end_time)
                  const left = ((startMin - firstSlotMin) / 30) * slotWidth
                  const width = ((endMin - startMin) / 30) * slotWidth
                  if (width <= 0) return null
                  return (
                    <button
                      key={b.id}
                      onClick={(e) => { e.stopPropagation(); onBookingClick?.(b) }}
                      className="absolute top-1 bottom-1 rounded-md px-2 py-1 text-left transition-all hover:brightness-110 cursor-pointer border-l-4 overflow-hidden"
                      style={{
                        left,
                        width: width - 2,
                        backgroundColor: `${color}25`,
                        borderLeftColor: color,
                      }}
                    >
                      <div className="text-[11px] font-medium text-white truncate leading-tight">{b.notes || 'Reserva'}</div>
                      <div className="text-[10px] text-slate-300 leading-tight">{b.start_time.slice(0, 5)} - {b.end_time.slice(0, 5)}</div>
                      {b.price != null && (
                        <div className="text-[10px] font-medium leading-tight" style={{ color }}>
                          {formatCurrency(b.price)}
                        </div>
                      )}
                    </button>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ============== Vista 3: AGENDA (lista de reservas) ==============

function AgendaView({ courts, bookings, onBookingClick }: { courts: Court[]; bookings: Booking[]; onBookingClick?: (b: Booking) => void }) {
  if (bookings.length === 0) {
    return (
      <div className="rounded-xl border border-slate-700/50 bg-slate-900/40 py-20 flex flex-col items-center justify-center text-center">
        <CalendarDays size={48} className="text-slate-600 mb-3" />
        <p className="text-slate-400 font-medium">Sin reservas para este día</p>
        <p className="text-slate-600 text-sm mt-1">Cuando se cree una reserva aparecerá acá.</p>
      </div>
    )
  }

  const sorted = [...bookings].sort((a, b) => a.start_time.localeCompare(b.start_time))

  return (
    <div className="rounded-xl border border-slate-700/50 bg-slate-900/40 divide-y divide-slate-800">
      {sorted.map(b => {
        const ci = courts.findIndex(c => c.id === b.court_id)
        const court = courts[ci]
        const color = court?.color || COURT_COLORS[ci >= 0 ? ci : 0]
        return (
          <button
            key={b.id}
            onClick={() => onBookingClick?.(b)}
            className="w-full flex items-center gap-4 px-4 py-3 hover:bg-slate-800/40 transition-colors text-left"
          >
            <div className="flex flex-col items-center justify-center min-w-[64px]">
              <span className="text-base font-bold text-white tabular-nums">{b.start_time.slice(0, 5)}</span>
              <span className="text-[10px] text-slate-500 tabular-nums">→ {b.end_time.slice(0, 5)}</span>
            </div>

            <div className="w-1 self-stretch rounded-full" style={{ backgroundColor: color }} />

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-white truncate">{b.notes || 'Reserva'}</span>
                <Badge variant={b.status === 'confirmed' ? 'success' : b.status === 'pending' ? 'warning' : 'default'} className="text-[10px]">
                  {b.status === 'confirmed' ? 'Confirmada' : b.status === 'pending' ? 'Pendiente' : b.status}
                </Badge>
              </div>
              <div className="text-xs text-slate-400 flex items-center gap-3 mt-0.5">
                <span style={{ color }} className="font-medium">{court?.name || 'Pista'}</span>
                <span>·</span>
                <span>{((timeToMinutes(b.end_time) - timeToMinutes(b.start_time)))} min</span>
              </div>
            </div>

            {b.price != null && (
              <div className="text-sm font-semibold tabular-nums" style={{ color }}>
                {formatCurrency(b.price)}
              </div>
            )}
          </button>
        )
      })}
    </div>
  )
}

function EmptyDay() {
  return (
    <div className="rounded-xl border border-slate-700/50 bg-slate-900/40 py-20 flex flex-col items-center justify-center text-center">
      <CalendarDays size={48} className="text-slate-600 mb-3" />
      <p className="text-slate-400 font-medium">Sin horarios configurados</p>
      <p className="text-slate-600 text-sm mt-1">Configurá los horarios de las pistas para verlas acá.</p>
    </div>
  )
}

function timeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number)
  return h * 60 + m
}
