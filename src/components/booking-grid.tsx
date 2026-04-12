'use client'

import { useState, useCallback, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { cn, formatCurrency, generateTimeSlots, COURT_COLORS } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { ChevronLeft, ChevronRight, Plus, X, User, Phone, Mail, Clock } from 'lucide-react'
import type { Court, CourtSchedule, Booking } from '@/types'

interface BookingGridProps {
  isAdmin?: boolean
  onSlotClick?: (court: Court, date: string, time: string) => void
  onBookingClick?: (booking: Booking) => void
}

export function BookingGrid({ isAdmin, onSlotClick, onBookingClick }: BookingGridProps) {
  const [date, setDate] = useState(() => {
    const d = new Date()
    return d.toISOString().split('T')[0]
  })
  const [courts, setCourts] = useState<Court[]>([])
  const [schedules, setSchedules] = useState<CourtSchedule[]>([])
  const [bookings, setBookings] = useState<Booking[]>([])
  const [loading, setLoading] = useState(true)

  const dayOfWeek = new Date(date + 'T12:00:00').getDay() // 0=Sun

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

  // Realtime subscription
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

  // Build time slots from schedules
  const getCourtSchedule = (courtId: number) => {
    return schedules.find(s => s.court_id === courtId && s.day_of_week === dayOfWeek)
  }

  // Get all unique time slots across all courts
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

  // Check if a slot has a booking
  function getBookingForSlot(courtId: number, time: string): Booking | undefined {
    return bookings.find(b => {
      if (b.court_id !== courtId) return false
      const startMin = timeToMinutes(b.start_time)
      const endMin = timeToMinutes(b.end_time)
      const slotMin = timeToMinutes(time)
      return slotMin >= startMin && slotMin < endMin
    })
  }

  // Check if slot is the start of a booking
  function isBookingStart(courtId: number, time: string): Booking | undefined {
    return bookings.find(b => {
      if (b.court_id !== courtId) return false
      return b.start_time.slice(0, 5) === time
    })
  }

  // Calculate booking span in slots
  function getBookingSpan(booking: Booking): number {
    const startMin = timeToMinutes(booking.start_time)
    const endMin = timeToMinutes(booking.end_time)
    return Math.ceil((endMin - startMin) / 30)
  }

  function isPeakHour(courtId: number, time: string): boolean {
    const schedule = getCourtSchedule(courtId)
    if (!schedule?.is_peak || !schedule.peak_start || !schedule.peak_end) return false
    const min = timeToMinutes(time)
    const peakStart = timeToMinutes(schedule.peak_start)
    const peakEnd = timeToMinutes(schedule.peak_end)
    return min >= peakStart && min < peakEnd
  }

  const isToday = date === new Date().toISOString().split('T')[0]
  const dateObj = new Date(date + 'T12:00:00')
  const dateLabel = dateObj.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Date navigation */}
      <div className="flex items-center justify-between">
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

      {/* Grid */}
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
                    const bookingStart = isBookingStart(court.id, time)
                    const peak = isPeakHour(court.id, time)

                    // If there's a booking and this is the start slot
                    if (bookingStart) {
                      const span = getBookingSpan(bookingStart)
                      return (
                        <td key={court.id} rowSpan={span} className="p-0.5 relative" style={{ height: `${span * 28}px` }}>
                          <button
                            onClick={() => onBookingClick?.(bookingStart)}
                            className={cn(
                              'w-full h-full rounded-lg px-2 py-1 text-left transition-all hover:brightness-110 cursor-pointer',
                              'border-l-4'
                            )}
                            style={{
                              backgroundColor: `${court.color || COURT_COLORS[ci]}20`,
                              borderLeftColor: court.color || COURT_COLORS[ci],
                            }}
                          >
                            <div className="text-xs font-medium text-white truncate">
                              {bookingStart.notes || 'Reserva'}
                            </div>
                            <div className="text-[10px] text-slate-400">
                              {bookingStart.start_time.slice(0, 5)} - {bookingStart.end_time.slice(0, 5)}
                            </div>
                            {bookingStart.price != null && (
                              <div className="text-[10px] font-medium" style={{ color: court.color || COURT_COLORS[ci] }}>
                                {formatCurrency(bookingStart.price)}
                              </div>
                            )}
                            <Badge variant={bookingStart.status === 'confirmed' ? 'success' : bookingStart.status === 'pending' ? 'warning' : 'default'} className="mt-0.5 text-[9px]">
                              {bookingStart.status === 'confirmed' ? 'Confirmada' : bookingStart.status === 'pending' ? 'Pendiente' : bookingStart.status}
                            </Badge>
                          </button>
                        </td>
                      )
                    }

                    // If slot is covered by a booking (not start), skip rendering
                    if (booking) return null

                    // Empty slot
                    return (
                      <td key={court.id} className="p-0.5" style={{ height: '28px' }}>
                        <button
                          onClick={() => onSlotClick?.(court, date, time)}
                          className={cn(
                            'w-full h-full rounded transition-colors text-center',
                            peak
                              ? 'bg-amber-500/5 hover:bg-amber-500/15 border border-amber-500/10'
                              : 'bg-slate-800/30 hover:bg-slate-700/50',
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

      {/* Legend */}
      <div className="flex items-center gap-6 text-xs text-slate-500">
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

function timeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number)
  return h * 60 + m
}
