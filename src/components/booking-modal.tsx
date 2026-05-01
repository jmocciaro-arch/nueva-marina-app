'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Modal } from '@/components/ui/modal'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/components/ui/toast'
import { formatCurrency, generateTimeSlots } from '@/lib/utils'
import { Trash2, Tag, Search, X, Check } from 'lucide-react'
import type { Court, CourtSchedule, Booking } from '@/types'
import { lookupPrice } from '@/lib/api/pricing'
import { useAuth } from '@/lib/auth-context'

interface BookingModalProps {
  open: boolean
  onClose: () => void
  onSaved: () => void
  courts: Court[]
  schedules: CourtSchedule[]
  // For creating
  initialCourt?: Court
  initialDate?: string
  initialTime?: string
  // For editing
  booking?: Booking | null
  isAdmin?: boolean
}

export function BookingModal({
  open, onClose, onSaved, courts, schedules,
  initialCourt, initialDate, initialTime,
  booking, isAdmin,
}: BookingModalProps) {
  const { toast } = useToast()
  const { member } = useAuth()
  const [loading, setLoading] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [pricingRule, setPricingRule] = useState<{ rule_id: number; amount: number; currency: string; name: string } | null>(null)
  const [pricingLoading, setPricingLoading] = useState(false)

  const [courtId, setCourtId] = useState('')
  const [date, setDate] = useState('')
  const [startTime, setStartTime] = useState('')
  const [duration, setDuration] = useState('90')
  const [customerName, setCustomerName] = useState('')
  const [customerPhone, setCustomerPhone] = useState('')
  const [customerEmail, setCustomerEmail] = useState('')
  const [notes, setNotes] = useState('')
  const [status, setStatus] = useState('confirmed')
  const [paymentMethod, setPaymentMethod] = useState('cash')

  // Vinculación a un socio/jugador registrado
  const [bookedById, setBookedById] = useState<string | null>(null)
  type UserSuggestion = { id: string; full_name: string | null; email: string | null; phone: string | null }
  const [userSuggestions, setUserSuggestions] = useState<UserSuggestion[]>([])
  const [showSuggestions, setShowSuggestions] = useState(false)

  const isEdit = !!booking

  useEffect(() => {
    if (booking) {
      setCourtId(String(booking.court_id))
      setDate(booking.date)
      setStartTime(booking.start_time.slice(0, 5))
      setDuration(String(booking.duration_minutes))
      setNotes(booking.notes || '')
      setStatus(booking.status)
      setPaymentMethod(booking.payment_method || 'cash')
      // Player info from notes (admin bookings store name in notes)
      if (booking.notes) setCustomerName(booking.notes)
      // Si la reserva está vinculada a un socio, cargar sus datos
      const bk = booking as unknown as Record<string, unknown>
      const linkedId = (bk.booked_by as string | null) ?? null
      setBookedById(linkedId)
      if (linkedId) {
        const supabase = createClient()
        supabase.from('nm_users').select('id, full_name, email, phone').eq('id', linkedId).single()
          .then(({ data }) => {
            if (data) {
              if (data.full_name) setCustomerName(data.full_name)
              if (data.email) setCustomerEmail(data.email)
              if (data.phone) setCustomerPhone(data.phone)
            }
          })
      }
    } else {
      setCourtId(initialCourt ? String(initialCourt.id) : courts[0] ? String(courts[0].id) : '')
      setDate(initialDate || new Date().toISOString().split('T')[0])
      setStartTime(initialTime || '10:00')
      setDuration('90')
      setCustomerName('')
      setCustomerPhone('')
      setCustomerEmail('')
      setNotes('')
      setStatus('confirmed')
      setPaymentMethod('cash')
      setBookedById(null)
      setUserSuggestions([])
      setShowSuggestions(false)
    }
  }, [booking, initialCourt, initialDate, initialTime, courts, open])

  // Buscar socios/jugadores cuando el admin tipea el nombre (debounce 250ms)
  useEffect(() => {
    if (!isAdmin) return
    if (bookedById) return // ya hay uno vinculado, no buscar
    const q = customerName.trim()
    if (q.length < 2) { setUserSuggestions([]); return }
    const timer = setTimeout(async () => {
      const supabase = createClient()
      const { data } = await supabase
        .from('nm_users')
        .select('id, full_name, email, phone')
        .or(`full_name.ilike.%${q}%,email.ilike.%${q}%`)
        .limit(8)
      setUserSuggestions((data ?? []) as UserSuggestion[])
    }, 250)
    return () => clearTimeout(timer)
  }, [customerName, isAdmin, bookedById])

  function pickUser(u: UserSuggestion) {
    setBookedById(u.id)
    setCustomerName(u.full_name ?? '')
    setCustomerEmail(u.email ?? '')
    setCustomerPhone(u.phone ?? '')
    setShowSuggestions(false)
    setUserSuggestions([])
  }

  function unlinkUser() {
    setBookedById(null)
    setUserSuggestions([])
  }

  // Calculate end time
  const endTime = (() => {
    if (!startTime) return ''
    const [h, m] = startTime.split(':').map(Number)
    const totalMin = h * 60 + m + Number(duration)
    const eh = Math.floor(totalMin / 60) % 24
    const em = totalMin % 60
    return `${String(eh).padStart(2, '0')}:${String(em).padStart(2, '0')}`
  })()

  // Legacy fallback (schedules) — usado sólo si nm_lookup_price no devuelve regla
  const legacyPrice = (() => {
    const cid = Number(courtId)
    const dow = new Date(date + 'T12:00:00').getDay()
    const schedule = schedules.find(s => s.court_id === cid && s.day_of_week === dow)
    if (!schedule) return 0
    const slots = Number(duration) / (schedule.slot_duration || 90)
    const basePrice = schedule.price_per_slot || 24
    if (schedule.is_peak && schedule.peak_start && schedule.peak_end && schedule.peak_price) {
      const startMin = timeToMin(startTime)
      const peakStart = timeToMin(schedule.peak_start)
      const peakEnd = timeToMin(schedule.peak_end)
      if (startMin >= peakStart && startMin < peakEnd) {
        return schedule.peak_price * slots
      }
    }
    return basePrice * slots
  })()

  // Precio unificado: resultado de nm_lookup_price (si existe) o fallback
  const price = pricingRule?.amount ?? legacyPrice

  // Lookup pricing cada vez que cambian los parámetros clave
  useEffect(() => {
    if (!courtId || !date || !startTime || !duration) {
      setPricingRule(null)
      return
    }
    let cancelled = false
    setPricingLoading(true)
    const at = new Date(`${date}T${startTime}:00`).toISOString()
    lookupPrice({
      club_id: 1,
      scope: 'court_hour',
      scope_ref_id: Number(courtId),
      at,
      duration_minutes: Number(duration),
      role_slug: member?.role ?? null,
    })
      .then((rule) => {
        if (!cancelled) setPricingRule(rule)
      })
      .catch(() => { if (!cancelled) setPricingRule(null) })
      .finally(() => { if (!cancelled) setPricingLoading(false) })
    return () => { cancelled = true }
  }, [courtId, date, startTime, duration, member?.role])

  // Available time slots
  const timeSlots = (() => {
    const cid = Number(courtId)
    const dow = new Date(date + 'T12:00:00').getDay()
    const schedule = schedules.find(s => s.court_id === cid && s.day_of_week === dow)
    if (!schedule) return []
    return generateTimeSlots(schedule.open_time, schedule.close_time, 30)
  })()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!courtId || !date || !startTime) return

    setLoading(true)
    const supabase = createClient()

    // Re-consultar precio en el momento del submit para consistencia
    let finalRule = pricingRule
    try {
      finalRule = await lookupPrice({
        club_id: 1,
        scope: 'court_hour',
        scope_ref_id: Number(courtId),
        at: new Date(`${date}T${startTime}:00`).toISOString(),
        duration_minutes: Number(duration),
        role_slug: member?.role ?? null,
      })
    } catch {
      // ignoro; usamos el preview o el legacy
    }
    const finalPrice = finalRule?.amount ?? legacyPrice

    const bookingData = {
      club_id: 1,
      court_id: Number(courtId),
      date,
      start_time: startTime + ':00',
      end_time: endTime + ':00',
      duration_minutes: Number(duration),
      status,
      price: finalPrice,
      price_rule_id: finalRule?.rule_id ?? null,
      payment_method: paymentMethod,
      payment_status: status === 'confirmed' ? 'paid' : 'pending',
      notes: customerName || notes,
      booked_by: bookedById,
      type: 'regular' as const,
    }

    let savedBookingId: number | null = null
    let emailEvent: 'created' | 'updated' | 'confirmed' | 'assigned' = 'created'

    if (isEdit && booking) {
      const { error } = await supabase
        .from('nm_bookings')
        .update(bookingData)
        .eq('id', booking.id)

      if (error) {
        toast('error', 'Error al actualizar: ' + error.message)
        setLoading(false)
        return
      }
      savedBookingId = booking.id
      const wasPending = booking.status === 'pending'
      const nowConfirmed = status === 'confirmed'
      const titularChanged = (booking.booked_by ?? null) !== (bookedById ?? null)
      emailEvent = titularChanged ? 'assigned' : (wasPending && nowConfirmed ? 'confirmed' : 'updated')
      toast('success', 'Reserva actualizada')
    } else {
      // Check availability
      const { data: conflicts } = await supabase
        .from('nm_bookings')
        .select('id')
        .eq('court_id', Number(courtId))
        .eq('date', date)
        .neq('status', 'cancelled')
        .lt('start_time', endTime + ':00')
        .gt('end_time', startTime + ':00')

      if (conflicts && conflicts.length > 0) {
        toast('error', 'Esa pista ya esta ocupada en ese horario')
        setLoading(false)
        return
      }

      const { data: inserted, error } = await supabase
        .from('nm_bookings')
        .insert(bookingData)
        .select('id')
        .single()

      if (error) {
        toast('error', 'Error al crear: ' + error.message)
        setLoading(false)
        return
      }
      savedBookingId = inserted?.id ?? null
      emailEvent = 'created'

      // Auto-register cash entry
      if (status === 'confirmed' && finalPrice > 0) {
        await supabase.from('nm_cash_register').insert({
          club_id: 1,
          type: 'booking',
          description: `Reserva ${customerName || 'Pista'} — ${date} ${startTime}`,
          amount: finalPrice,
          payment_method: paymentMethod,
          date,
        })
      }

      toast('success', 'Reserva creada')
    }

    // Notificación por email — best-effort, no bloquea el flujo
    if (savedBookingId && bookedById) {
      fetch('/api/bookings/notify-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ booking_id: savedBookingId, event_type: emailEvent }),
      }).catch(err => console.warn('[notify-email] fallo silencioso:', err))
    }

    setLoading(false)
    onSaved()
    onClose()
  }

  async function handleDelete() {
    if (!booking || !confirm('¿Seguro que queres cancelar esta reserva?')) return

    setDeleting(true)
    const supabase = createClient()

    const { error } = await supabase
      .from('nm_bookings')
      .update({ status: 'cancelled', cancelled_at: new Date().toISOString() })
      .eq('id', booking.id)

    if (error) {
      toast('error', 'Error al cancelar: ' + error.message)
    } else {
      // Reverse cash entry
      if (booking.price && booking.price > 0) {
        await supabase.from('nm_cash_register').insert({
          club_id: 1,
          type: 'booking',
          description: `CANCELACION — Reserva ${booking.notes || ''} — ${booking.date}`,
          amount: -booking.price,
          payment_method: booking.payment_method || 'cash',
          date: booking.date,
        })
      }

      // Notificación por email — best-effort
      if (booking.booked_by) {
        fetch('/api/bookings/notify-email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ booking_id: booking.id, event_type: 'cancelled' }),
        }).catch(err => console.warn('[notify-email] fallo silencioso:', err))
      }

      toast('info', 'Reserva cancelada')
      onSaved()
      onClose()
    }
    setDeleting(false)
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEdit ? 'Editar Reserva' : 'Nueva Reserva'}
      size="lg"
      footer={
        <div className="flex items-center justify-between w-full">
          <div>
            {isEdit && isAdmin && (
              <Button variant="danger" size="sm" onClick={handleDelete} loading={deleting}>
                <Trash2 size={14} className="mr-1" />
                Cancelar reserva
              </Button>
            )}
          </div>
          <div className="flex items-center gap-3">
            <Button variant="ghost" onClick={onClose}>Cerrar</Button>
            <Button onClick={handleSubmit} loading={loading}>
              {isEdit ? 'Guardar cambios' : 'Crear reserva'}
            </Button>
          </div>
        </div>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <Select
            label="Pista"
            value={courtId}
            onChange={e => setCourtId(e.target.value)}
            options={courts.map(c => ({ value: String(c.id), label: c.name }))}
            required
          />
          <Input
            label="Fecha"
            type="date"
            value={date}
            onChange={e => setDate(e.target.value)}
            required
          />
        </div>

        <div className="grid grid-cols-3 gap-4">
          <Select
            label="Hora inicio"
            value={startTime}
            onChange={e => setStartTime(e.target.value)}
            options={timeSlots.map(t => ({ value: t, label: t }))}
            required
          />
          <Select
            label="Duracion"
            value={duration}
            onChange={e => setDuration(e.target.value)}
            options={[
              { value: '60', label: '1 hora' },
              { value: '90', label: '1.5 horas' },
              { value: '120', label: '2 horas' },
            ]}
          />
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Hora fin</label>
            <div className="bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white">
              {endTime || '--:--'}
            </div>
          </div>
        </div>

        {/* Price display */}
        <div className="bg-slate-800/50 rounded-lg px-4 py-3 border border-slate-700/50">
          <div className="flex items-center justify-between">
            <span className="text-sm text-slate-400">
              Precio {pricingLoading && <span className="text-xs text-slate-500">(calculando…)</span>}
            </span>
            <span className="text-xl font-bold text-cyan-400">{formatCurrency(price)}</span>
          </div>
          {pricingRule ? (
            <div className="mt-2 flex items-center gap-2 text-xs text-slate-400">
              <Tag size={11} className="text-cyan-400" />
              <span>Regla aplicada:</span>
              <Badge variant="cyan">{pricingRule.name}</Badge>
              <span className="text-slate-600">#{pricingRule.rule_id}</span>
            </div>
          ) : !pricingLoading && (
            <div className="mt-2 text-xs text-amber-400/80">
              Sin regla en <code>nm_price_rules</code> · usando schedule legacy
            </div>
          )}
        </div>

        {isAdmin && (
          <>
            <div className="border-t border-slate-700 pt-4">
              <h3 className="text-sm font-medium text-slate-300 mb-3 flex items-center gap-2">
                Datos del cliente
                {bookedById ? (
                  <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-cyan-500/15 border border-cyan-500/30 text-cyan-300">
                    <Check size={11} /> Vinculado a socio/jugador
                    <button type="button" onClick={unlinkUser} className="ml-1 hover:text-white" title="Desvincular y cargar manual">
                      <X size={11} />
                    </button>
                  </span>
                ) : (
                  <span className="text-[11px] text-slate-500">Tipeá nombre o email para buscar socios</span>
                )}
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Nombre con autocompletado */}
                <div className="relative">
                  <label className="block text-sm font-medium text-slate-300 mb-1">Nombre</label>
                  <div className="relative">
                    <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
                    <input
                      type="text"
                      placeholder="Buscar socio o cargar manual"
                      value={customerName}
                      onChange={e => { setCustomerName(e.target.value); if (bookedById) setBookedById(null); setShowSuggestions(true) }}
                      onFocus={() => setShowSuggestions(true)}
                      onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
                      className="w-full pl-8 pr-3 py-2 rounded-lg bg-slate-800 border border-slate-600 text-white text-sm placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/40 focus:border-cyan-500"
                    />
                  </div>
                  {showSuggestions && !bookedById && userSuggestions.length > 0 && (
                    <div className="absolute z-50 mt-1 w-full max-h-60 overflow-auto rounded-lg border border-slate-600 bg-slate-900 shadow-2xl">
                      {userSuggestions.map(u => (
                        <button
                          key={u.id}
                          type="button"
                          onMouseDown={e => e.preventDefault()}
                          onClick={() => pickUser(u)}
                          className="w-full text-left px-3 py-2 hover:bg-slate-800 border-b border-slate-700/50 last:border-0"
                        >
                          <div className="text-sm text-white truncate">{u.full_name || '(sin nombre)'}</div>
                          <div className="text-[11px] text-slate-400 truncate">{u.email || u.phone || '—'}</div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <Input
                  label="Telefono"
                  type="tel"
                  placeholder="+34 600..."
                  value={customerPhone}
                  onChange={e => setCustomerPhone(e.target.value)}
                />
                <Input
                  label="Email"
                  type="email"
                  placeholder="email@..."
                  value={customerEmail}
                  onChange={e => setCustomerEmail(e.target.value)}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <Select
                label="Estado"
                value={status}
                onChange={e => setStatus(e.target.value)}
                options={[
                  { value: 'confirmed', label: 'Confirmada' },
                  { value: 'pending', label: 'Pendiente' },
                ]}
              />
              <Select
                label="Metodo de pago"
                value={paymentMethod}
                onChange={e => setPaymentMethod(e.target.value)}
                options={[
                  { value: 'cash', label: 'Efectivo' },
                  { value: 'card', label: 'Tarjeta' },
                  { value: 'transfer', label: 'Transferencia' },
                  { value: 'bizum', label: 'Bizum' },
                ]}
              />
            </div>
          </>
        )}

        <Input
          label="Notas"
          placeholder="Notas adicionales..."
          value={notes}
          onChange={e => setNotes(e.target.value)}
        />
      </form>
    </Modal>
  )
}

function timeToMin(time: string): number {
  const [h, m] = time.split(':').map(Number)
  return h * 60 + m
}
