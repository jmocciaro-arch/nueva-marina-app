'use client'

import { useState, useCallback, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/lib/auth-context'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Search, Calendar, Clock, MapPin, Users, Plus, UserPlus } from 'lucide-react'
import Link from 'next/link'

interface OpenBooking {
  id: string
  date: string
  start_time: string
  end_time: string
  needs_players: number
  players: string[] | null
  court: { name: string; color: string } | null
  booker: { full_name: string } | null
  booked_by: string
}

export default function BuscarPartidoPage() {
  const { user } = useAuth()
  const [bookings, setBookings] = useState<OpenBooking[]>([])
  const [loading, setLoading] = useState(true)
  const [joining, setJoining] = useState<string | null>(null)
  const [joined, setJoined] = useState<Set<string>>(new Set())

  const loadOpenBookings = useCallback(async () => {
    const supabase = createClient()
    setLoading(true)
    const today = new Date().toISOString().split('T')[0]

    const { data, error } = await supabase
      .from('nm_bookings')
      .select(`id, date, start_time, end_time, needs_players, players, booked_by, court:nm_courts(name, color)`)
      .eq('is_open', true)
      .gt('needs_players', 0)
      .gte('date', today)
      .order('date')
      .order('start_time')

    if (error || !data) { setLoading(false); return }

    const bookerIds = [...new Set(data.map((b: { booked_by: string }) => b.booked_by).filter(Boolean))]
    const { data: bookers } = await supabase
      .from('nm_users')
      .select('id, full_name')
      .in('id', bookerIds)

    const bookerMap: Record<string, { full_name: string }> = {}
    for (const b of bookers || []) bookerMap[b.id] = { full_name: b.full_name }

    setBookings(data.map((b: Record<string, unknown>) => ({
      ...b,
      court: Array.isArray(b.court) ? b.court[0] : b.court,
      booker: bookerMap[b.booked_by as string] ?? null,
    })) as OpenBooking[])
    setLoading(false)
  }, [])

  useEffect(() => { loadOpenBookings() }, [loadOpenBookings])

  async function handleJoin(booking: OpenBooking) {
    if (!user) return
    setJoining(booking.id)
    const supabase = createClient()
    const currentPlayers: string[] = Array.isArray(booking.players) ? booking.players : []
    const updatedPlayers = [...currentPlayers, user.id]
    const newNeeds = Math.max(0, booking.needs_players - 1)

    const { error } = await supabase
      .from('nm_bookings')
      .update({ players: updatedPlayers, needs_players: newNeeds })
      .eq('id', booking.id)

    if (!error) {
      setJoined(prev => new Set([...prev, booking.id]))
      setBookings(prev =>
        prev.map(b => b.id === booking.id ? { ...b, players: updatedPlayers, needs_players: newNeeds } : b)
      )
    }
    setJoining(null)
  }

  function alreadyJoined(booking: OpenBooking) {
    if (!user) return false
    if (joined.has(booking.id)) return true
    return Array.isArray(booking.players) && booking.players.includes(user.id)
  }

  function isOwner(booking: OpenBooking) {
    return booking.booked_by === user?.id
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Buscar Partido</h1>
          <p className="text-sm text-slate-400 mt-1">Encontra jugadores y unite a partidos abiertos</p>
        </div>
        <Link href="/mis-reservas">
          <Button size="sm">
            <Plus size={14} />
            Crear partido abierto
          </Button>
        </Link>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="h-28 rounded-xl bg-slate-800/50 border border-slate-700/50 animate-pulse" />
          ))}
        </div>
      ) : bookings.length === 0 ? (
        <Card>
          <div className="text-center py-14">
            <Search size={40} className="mx-auto text-slate-600 mb-3" />
            <p className="text-slate-300 font-medium mb-1">No hay partidos abiertos</p>
            <p className="text-slate-500 text-sm mb-5">No hay reservas abiertas buscando jugadores en este momento.</p>
            <Link href="/mis-reservas">
              <Button size="sm">
                <Plus size={14} />
                Crear partido abierto
              </Button>
            </Link>
          </div>
        </Card>
      ) : (
        <div className="space-y-3">
          {bookings.map(booking => {
            const isJoined = alreadyJoined(booking)
            const isMe = isOwner(booking)
            const spotsLabel = booking.needs_players === 1 ? '1 lugar' : `${booking.needs_players} lugares`

            return (
              <Card key={booking.id} hover>
                <div className="flex items-center gap-4">
                  <div
                    className="w-1.5 h-16 rounded-full flex-shrink-0"
                    style={{ backgroundColor: booking.court?.color || '#06b6d4' }}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className="font-semibold text-white">{booking.court?.name || 'Pista'}</span>
                      <Badge variant="cyan">
                        <Users size={10} className="mr-1" />
                        {spotsLabel} disponible{booking.needs_players !== 1 ? 's' : ''}
                      </Badge>
                    </div>
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-400">
                      <span className="flex items-center gap-1">
                        <Calendar size={11} />
                        {new Date(booking.date).toLocaleDateString('es-AR', { weekday: 'short', day: '2-digit', month: 'short' })}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock size={11} />
                        {booking.start_time?.slice(0, 5)}{booking.end_time ? ` - ${booking.end_time.slice(0, 5)}` : ''}
                      </span>
                      <span className="flex items-center gap-1">
                        <MapPin size={11} />
                        Organiza: {booking.booker?.full_name || 'Socio'}
                      </span>
                    </div>
                  </div>
                  <div className="flex-shrink-0">
                    {isMe ? (
                      <Badge variant="default">Tu reserva</Badge>
                    ) : isJoined ? (
                      <Badge variant="success">Unido</Badge>
                    ) : (
                      <Button
                        size="sm"
                        loading={joining === booking.id}
                        onClick={() => handleJoin(booking)}
                      >
                        <UserPlus size={14} />
                        Unirme
                      </Button>
                    )}
                  </div>
                </div>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
