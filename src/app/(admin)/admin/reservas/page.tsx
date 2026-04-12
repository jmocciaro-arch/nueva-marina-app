'use client'

import { useState, useCallback, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { BookingGrid } from '@/components/booking-grid'
import { BookingModal } from '@/components/booking-modal'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Plus, Calendar, List } from 'lucide-react'
import type { Court, CourtSchedule, Booking } from '@/types'

export default function GestionReservasPage() {
  const [courts, setCourts] = useState<Court[]>([])
  const [schedules, setSchedules] = useState<CourtSchedule[]>([])
  const [modalOpen, setModalOpen] = useState(false)
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null)
  const [selectedCourt, setSelectedCourt] = useState<Court | undefined>()
  const [selectedDate, setSelectedDate] = useState<string | undefined>()
  const [selectedTime, setSelectedTime] = useState<string | undefined>()
  const [refreshKey, setRefreshKey] = useState(0)

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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Gestion de Reservas</h1>
          <p className="text-sm text-slate-400 mt-1">Administra todas las reservas de pistas del club</p>
        </div>
        <Button onClick={handleNewBooking}>
          <Plus size={16} className="mr-1" />
          Nueva Reserva
        </Button>
      </div>

      {/* Stats pills */}
      <div className="flex items-center gap-3">
        {courts.map(court => (
          <div key={court.id} className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-800/50 border border-slate-700/50">
            <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: court.color }} />
            <span className="text-xs font-medium text-slate-300">{court.name}</span>
          </div>
        ))}
      </div>

      {/* Booking Grid */}
      <BookingGrid
        key={refreshKey}
        isAdmin
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
