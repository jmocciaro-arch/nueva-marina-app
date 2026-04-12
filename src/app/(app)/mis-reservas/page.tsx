'use client'

import { useState, useCallback, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/lib/auth-context'
import { BookingGrid } from '@/components/booking-grid'
import { BookingModal } from '@/components/booking-modal'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { Calendar, Clock, MapPin, Plus } from 'lucide-react'
import { formatCurrency, formatDate, formatTime } from '@/lib/utils'
import type { Court, CourtSchedule, Booking } from '@/types'

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
  const [tab, setTab] = useState<'grid' | 'list'>('grid')

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

  function handleSlotClick(court: Court, date: string, time: string) {
    setSelectedCourt(court)
    setSelectedDate(date)
    setSelectedTime(time)
    setModalOpen(true)
  }

  function handleSaved() {
    setRefreshKey(prev => prev + 1)
    loadData()
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Mis Reservas</h1>
          <p className="text-sm text-slate-400 mt-1">Consulta y gestiona tus reservas de pistas</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex bg-slate-800 rounded-lg p-0.5">
            <button
              onClick={() => setTab('grid')}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${tab === 'grid' ? 'bg-cyan-600 text-white' : 'text-slate-400 hover:text-white'}`}
            >
              <Calendar size={14} className="inline mr-1" />
              Calendario
            </button>
            <button
              onClick={() => setTab('list')}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${tab === 'list' ? 'bg-cyan-600 text-white' : 'text-slate-400 hover:text-white'}`}
            >
              <Clock size={14} className="inline mr-1" />
              Mis proximas
            </button>
          </div>
        </div>
      </div>

      {tab === 'grid' ? (
        <BookingGrid
          key={refreshKey}
          onSlotClick={handleSlotClick}
        />
      ) : (
        <div className="space-y-3">
          {myBookings.length === 0 ? (
            <Card>
              <div className="text-center py-12">
                <Calendar size={48} className="mx-auto text-slate-600 mb-3" />
                <p className="text-slate-400">No tenes reservas proximas</p>
                <Button size="sm" className="mt-4" onClick={() => setTab('grid')}>
                  <Plus size={14} className="mr-1" />
                  Reservar pista
                </Button>
              </div>
            </Card>
          ) : (
            myBookings.map(b => (
              <Card key={b.id} hover>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div
                      className="w-1.5 h-12 rounded-full"
                      style={{ backgroundColor: (b.court as unknown as Court)?.color || '#06b6d4' }}
                    />
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-white">{(b.court as unknown as Court)?.name || 'Pista'}</span>
                        <Badge variant={b.status === 'confirmed' ? 'success' : 'warning'}>
                          {b.status === 'confirmed' ? 'Confirmada' : 'Pendiente'}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-3 mt-1 text-sm text-slate-400">
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
                  <div className="text-right">
                    {b.price != null && (
                      <span className="text-lg font-bold text-cyan-400">{formatCurrency(b.price)}</span>
                    )}
                  </div>
                </div>
              </Card>
            ))
          )}
        </div>
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
