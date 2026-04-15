'use client'

import { useState, useCallback, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/lib/auth-context'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Modal } from '@/components/ui/modal'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { useToast } from '@/components/ui/toast'
import { Search, Calendar, Clock, MapPin, Users, Plus, UserPlus } from 'lucide-react'

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

interface Court {
  id: number
  name: string
}

const TIME_OPTIONS = [
  '08:00', '09:00', '10:00', '11:00', '12:00', '13:00',
  '14:00', '15:00', '16:00', '17:00', '18:00', '19:00',
  '20:00', '21:00', '22:00',
].map(t => ({ value: t, label: t }))

export default function BuscarPartidoPage() {
  const { user } = useAuth()
  const { toast } = useToast()
  const [bookings, setBookings] = useState<OpenBooking[]>([])
  const [loading, setLoading] = useState(true)
  const [joining, setJoining] = useState<string | null>(null)
  const [joined, setJoined] = useState<Set<string>>(new Set())

  // modal crear partido
  const [showModal, setShowModal] = useState(false)
  const [courts, setCourts] = useState<Court[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [form, setForm] = useState({
    description: '',
    date: new Date().toISOString().split('T')[0],
    start_time: '10:00',
    end_time: '11:30',
    court_id: '',
  })

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

  // cargar pistas disponibles
  useEffect(() => {
    async function loadCourts() {
      const supabase = createClient()
      const { data } = await supabase
        .from('nm_courts')
        .select('id, name')
        .eq('club_id', 1)
        .eq('is_active', true)
        .order('name')
      setCourts((data || []) as Court[])
    }
    loadCourts()
  }, [])

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

  async function handleCreatePartido() {
    if (!user) return
    if (!form.date || !form.start_time || !form.end_time) {
      toast('error', 'Completá la fecha y horario')
      return
    }
    setSubmitting(true)
    const supabase = createClient()

    const notes = form.description.trim()
      ? `[PARTIDO ABIERTO] ${form.description.trim()}`
      : '[PARTIDO ABIERTO]'

    const { error } = await supabase.from('nm_bookings').insert({
      club_id: 1,
      booked_by: user.id,
      date: form.date,
      start_time: form.start_time,
      end_time: form.end_time,
      duration_minutes: 90,
      status: 'confirmed',
      is_open: true,
      needs_players: 3,
      players: [],
      notes,
      ...(form.court_id ? { court_id: Number(form.court_id) } : {}),
    })

    if (error) {
      toast('error', 'No se pudo crear el partido')
    } else {
      toast('success', 'Partido abierto creado')
      setShowModal(false)
      setForm({ description: '', date: new Date().toISOString().split('T')[0], start_time: '10:00', end_time: '11:30', court_id: '' })
      loadOpenBookings()
    }
    setSubmitting(false)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Buscar Partido</h1>
          <p className="text-sm text-slate-400 mt-1">Encontra jugadores y unite a partidos abiertos</p>
        </div>
        <Button size="sm" onClick={() => setShowModal(true)}>
          <Plus size={14} />
          Crear partido abierto
        </Button>
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
            <Button size="sm" onClick={() => setShowModal(true)}>
              <Plus size={14} />
              Crear partido abierto
            </Button>
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

      {/* ── Modal crear partido abierto ───────────────────────────────── */}
      <Modal
        open={showModal}
        onClose={() => setShowModal(false)}
        title="Crear partido abierto"
        size="sm"
        footer={
          <>
            <Button variant="ghost" size="sm" onClick={() => setShowModal(false)}>
              Cancelar
            </Button>
            <Button size="sm" loading={submitting} onClick={handleCreatePartido}>
              Publicar partido
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">
              Descripcion
            </label>
            <textarea
              className="w-full rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/40 focus:border-cyan-500 resize-none"
              rows={3}
              placeholder="Ej: Busco pareja para jugar nivel intermedio, somos dos confirmados"
              value={form.description}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
            />
          </div>

          <Input
            label="Fecha"
            type="date"
            value={form.date}
            min={new Date().toISOString().split('T')[0]}
            onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
          />

          <div className="grid grid-cols-2 gap-3">
            <Select
              label="Hora inicio"
              value={form.start_time}
              options={TIME_OPTIONS}
              onChange={e => setForm(f => ({ ...f, start_time: e.target.value }))}
            />
            <Select
              label="Hora fin"
              value={form.end_time}
              options={TIME_OPTIONS}
              onChange={e => setForm(f => ({ ...f, end_time: e.target.value }))}
            />
          </div>

          {courts.length > 0 && (
            <Select
              label="Pista preferida (opcional)"
              value={form.court_id}
              options={[{ value: '', label: 'Sin preferencia' }, ...courts.map(c => ({ value: String(c.id), label: c.name }))]}
              onChange={e => setForm(f => ({ ...f, court_id: e.target.value }))}
            />
          )}
        </div>
      </Modal>
    </div>
  )
}
