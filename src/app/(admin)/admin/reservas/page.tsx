'use client'

import { useState, useCallback, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { BookingGrid, type BookingView } from '@/components/booking-grid'
import { BookingModal } from '@/components/booking-modal'
import { Button } from '@/components/ui/button'
import { Plus, LayoutGrid, GanttChart, ListOrdered } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Court, CourtSchedule, Booking } from '@/types'
import { useRealtimeRefresh } from '@/hooks/use-realtime-refresh'

const VIEW_STORAGE_KEY = 'nm_bookings_view'

const VIEW_OPTIONS: { id: BookingView; label: string; icon: typeof LayoutGrid; hint: string }[] = [
  { id: 'grid', label: 'Grilla', icon: LayoutGrid, hint: 'Horas por columna de pista' },
  { id: 'timeline', label: 'Timeline', icon: GanttChart, hint: 'Pistas en filas, horas horizontal' },
  { id: 'agenda', label: 'Agenda', icon: ListOrdered, hint: 'Lista de reservas del día' },
]

export default function GestionReservasPage() {
  const [courts, setCourts] = useState<Court[]>([])
  const [schedules, setSchedules] = useState<CourtSchedule[]>([])
  const [modalOpen, setModalOpen] = useState(false)
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null)
  const [selectedCourt, setSelectedCourt] = useState<Court | undefined>()
  const [selectedDate, setSelectedDate] = useState<string | undefined>()
  const [selectedTime, setSelectedTime] = useState<string | undefined>()
  const [refreshKey, setRefreshKey] = useState(0)
  const [view, setView] = useState<BookingView>('grid')

  useEffect(() => {
    const saved = typeof window !== 'undefined' ? window.localStorage.getItem(VIEW_STORAGE_KEY) : null
    if (saved === 'grid' || saved === 'timeline' || saved === 'agenda') {
      setView(saved)
    }
  }, [])

  function handleViewChange(next: BookingView) {
    setView(next)
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(VIEW_STORAGE_KEY, next)
    }
  }

  const loadCourtsAndSchedules = useCallback(async () => {
    const supabase = createClient()
    const [courtsRes, schedulesRes] = await Promise.all([
      supabase.from('nm_courts').select('*').eq('club_id', 1).eq('is_active', true).order('sort_order'),
      supabase.from('nm_court_schedules').select('*'),
    ])
    setCourts((courtsRes.data || []) as Court[])
    setSchedules((schedulesRes.data || []) as CourtSchedule[])
  }, [])

  useEffect(() => {
    loadCourtsAndSchedules()
  }, [loadCourtsAndSchedules])

  const handleRealtimeChange = useCallback(() => {
    loadCourtsAndSchedules()
    setRefreshKey(prev => prev + 1)
  }, [loadCourtsAndSchedules])

  useRealtimeRefresh(['nm_bookings', 'nm_courts', 'nm_court_schedules'], handleRealtimeChange)

  function handleSlotClick(court: Court, date: string, time: string) {
    setSelectedBooking(null)
    setSelectedCourt(court)
    setSelectedDate(date)
    setSelectedTime(time)
    setModalOpen(true)
  }

  function handleBookingClick(booking: Booking) {
    setSelectedBooking(booking)
    setSelectedCourt(undefined)
    setSelectedDate(undefined)
    setSelectedTime(undefined)
    setModalOpen(true)
  }

  function handleNewBooking() {
    setSelectedBooking(null)
    setSelectedCourt(undefined)
    setSelectedDate(undefined)
    setSelectedTime(undefined)
    setModalOpen(true)
  }

  function handleSaved() {
    setRefreshKey(prev => prev + 1)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white">Gestion de Reservas</h1>
          <p className="text-sm text-slate-400 mt-1">Administra todas las reservas de pistas del club</p>
        </div>
        <Button onClick={handleNewBooking}>
          <Plus size={16} className="mr-1" />
          Nueva Reserva
        </Button>
      </div>

      {/* Selector de vista */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="inline-flex items-center bg-slate-800/60 border border-slate-700/50 rounded-lg p-1">
          {VIEW_OPTIONS.map(opt => {
            const Icon = opt.icon
            const active = view === opt.id
            return (
              <button
                key={opt.id}
                onClick={() => handleViewChange(opt.id)}
                title={opt.hint}
                className={cn(
                  'flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-colors',
                  active ? 'bg-cyan-600 text-white shadow' : 'text-slate-400 hover:text-white hover:bg-slate-700/50',
                )}
              >
                <Icon size={16} />
                {opt.label}
              </button>
            )
          })}
        </div>

        {/* Pills de pistas */}
        <div className="flex items-center gap-2 flex-wrap">
          {courts.map(court => (
            <div key={court.id} className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-800/50 border border-slate-700/50">
              <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: court.color }} />
              <span className="text-xs font-medium text-slate-300">{court.name}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Booking Grid */}
      <BookingGrid
        key={refreshKey}
        isAdmin
        view={view}
        onSlotClick={handleSlotClick}
        onBookingClick={handleBookingClick}
      />

      {/* Modal */}
      <BookingModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSaved={handleSaved}
        courts={courts}
        schedules={schedules}
        initialCourt={selectedCourt}
        initialDate={selectedDate}
        initialTime={selectedTime}
        booking={selectedBooking}
        isAdmin
      />
    </div>
  )
}
