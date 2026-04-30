'use client'

import { useState, useCallback, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/lib/auth-context'
import { BookingGrid, type BookingView } from '@/components/booking-grid'
import { BookingModal } from '@/components/booking-modal'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { Calendar, Clock, Plus, LayoutGrid, GanttChart, ListOrdered, User } from 'lucide-react'
import { cn, formatCurrency, formatDate, formatTime } from '@/lib/utils'
import type { Court, CourtSchedule, Booking } from '@/types'
import { useRealtimeRefresh } from '@/hooks/use-realtime-refresh'

type ViewMode = BookingView | 'mine'

const VIEW_STORAGE_KEY = 'nm_mis_reservas_view'

const VIEW_OPTIONS: { id: ViewMode; label: string; icon: typeof LayoutGrid; mobileLabel?: string }[] = [
  { id: 'mine',     label: 'Mis próximas', icon: User,         mobileLabel: 'Mías' },
  { id: 'grid',     label: 'Grilla',       icon: LayoutGrid },
  { id: 'timeline', label: 'Timeline',     icon: GanttChart },
  { id: 'agenda',   label: 'Agenda',       icon: ListOrdered },
]

export default function MisReservasPage() {
  const { user } = useAuth()
  const [courts, setCourts] = useState<Court[]>([])
  const [schedules, setSchedules] = useState<CourtSchedule[]>([])
  const [myBookings, setMyBookings] = useState<Booking[]>([])
  const [modalOpen, setModalOpen] = useState(false)
  const [selectedCourt, setSelectedCourt] = useState<Court | undefined>()
  const [selectedDate, setSelectedDate] = useState<string | undefined>()
  const [selectedTime, setSelectedTime] = useState<string | undefined>()
  const [refreshKey, setRefreshKey] = useState(0)
  const [view, setView] = useState<ViewMode>('grid')

  // En mobile, default a "Mis próximas" (más usable). En desktop, default "Grilla".
  // Si el usuario eligió algo antes, usamos eso.
  useEffect(() => {
    if (typeof window === 'undefined') return
    const saved = window.localStorage.getItem(VIEW_STORAGE_KEY) as ViewMode | null
    if (saved && (['mine', 'grid', 'timeline', 'agenda'] as ViewMode[]).includes(saved)) {
      setView(saved)
      return
    }
    const isMobile = window.matchMedia('(max-width: 768px)').matches
    setView(isMobile ? 'mine' : 'grid')
  }, [])

  function handleViewChange(next: ViewMode) {
    setView(next)
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(VIEW_STORAGE_KEY, next)
    }
  }

  const loadData = useCallback(async () => {
    const supabase = createClient()
    if (!user) return

    const [courtsRes, schedulesRes, bookingsRes] = await Promise.all([
      supabase.from('nm_courts').select('*').eq('club_id', 1).eq('is_active', true).order('sort_order'),
      supabase.from('nm_court_schedules').select('*'),
      supabase.from('nm_bookings').select('*, court:nm_courts(id, name, color)')
        .eq('booked_by', user.id)
        .neq('status', 'cancelled')
        .gte('date', new Date().toISOString().split('T')[0])
        .order('date')
        .order('start_time'),
    ])

    setCourts((courtsRes.data || []) as Court[])
    setSchedules((schedulesRes.data || []) as CourtSchedule[])
    setMyBookings((bookingsRes.data || []) as unknown as Booking[])
  }, [user])

  useEffect(() => {
    loadData()
  }, [loadData])

  useRealtimeRefresh(['nm_bookings'], loadData)

  function handleSlotClick(court: Court, date: string, time: string) {
    setSelectedCourt(court)
    setSelectedDate(date)
    setSelectedTime(time)
    setModalOpen(true)
  }

  function handleNewBooking() {
    setSelectedCourt(undefined)
    setSelectedDate(undefined)
    setSelectedTime(undefined)
    setModalOpen(true)
  }

  function handleSaved() {
    setRefreshKey(prev => prev + 1)
    loadData()
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white">Mis Reservas</h1>
          <p className="text-sm text-slate-400 mt-1">Reservá una pista o consultá tus próximas</p>
        </div>
        <Button onClick={handleNewBooking}>
          <Plus size={16} className="mr-1" />
          Reservar pista
        </Button>
      </div>

      {/* Selector de vista */}
      <div className="inline-flex items-center bg-slate-800/60 border border-slate-700/50 rounded-lg p-1 overflow-x-auto max-w-full">
        {VIEW_OPTIONS.map(opt => {
          const Icon = opt.icon
          const active = view === opt.id
          return (
            <button
              key={opt.id}
              onClick={() => handleViewChange(opt.id)}
              className={cn(
                'flex items-center gap-1.5 px-3 py-2 rounded-md text-sm font-medium transition-colors whitespace-nowrap',
                active ? 'bg-cyan-600 text-white shadow' : 'text-slate-400 hover:text-white hover:bg-slate-700/50',
              )}
            >
              <Icon size={16} />
              <span className="hidden sm:inline">{opt.label}</span>
              <span className="sm:hidden">{opt.mobileLabel || opt.label}</span>
            </button>
          )
        })}
      </div>

      {view === 'mine' ? (
        <div className="space-y-3">
          {myBookings.length === 0 ? (
            <Card>
              <div className="text-center py-12">
                <Calendar size={48} className="mx-auto text-slate-600 mb-3" />
                <p className="text-slate-400">No tenés reservas próximas</p>
                <Button size="sm" className="mt-4" onClick={handleNewBooking}>
                  <Plus size={14} className="mr-1" />
                  Reservar pista
                </Button>
              </div>
            </Card>
          ) : (
            myBookings.map(b => (
              <Card key={b.id} hover>
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 sm:gap-4 min-w-0">
                    <div
                      className="w-1.5 h-12 rounded-full shrink-0"
                      style={{ backgroundColor: (b.court as unknown as Court)?.color || '#06b6d4' }}
                    />
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-white">{(b.court as unknown as Court)?.name || 'Pista'}</span>
                        <Badge variant={b.status === 'confirmed' ? 'success' : 'warning'}>
                          {b.status === 'confirmed' ? 'Confirmada' : 'Pendiente'}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-3 mt-1 text-sm text-slate-400 flex-wrap">
                        <span className="flex items-center gap-1">
                          <Calendar size={12} />
                          {formatDate(b.date, { day: 'numeric', month: 'short', weekday: 'short' })}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock size={12} />
                          {formatTime(b.start_time)} - {formatTime(b.end_time)}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    {b.price != null && (
                      <span className="text-base sm:text-lg font-bold text-cyan-400 tabular-nums">{formatCurrency(b.price)}</span>
                    )}
                  </div>
                </div>
              </Card>
            ))
          )}
        </div>
      ) : (
        <BookingGrid
          key={refreshKey}
          view={view}
          onSlotClick={handleSlotClick}
        />
      )}

      <BookingModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSaved={handleSaved}
        courts={courts}
        schedules={schedules}
        initialCourt={selectedCourt}
        initialDate={selectedDate}
        initialTime={selectedTime}
      />
    </div>
  )
}
