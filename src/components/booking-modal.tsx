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
import { Trash2 } from 'lucide-react'
import type { Court, CourtSchedule, Booking } from '@/types'

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
  const [loading, setLoading] = useState(false)
  const [deleting, setDeleting] = useState(false)

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
    }
  }, [booking, initialCourt, initialDate, initialTime, courts, open])

  // Calculate end time
  const endTime = (() => {
    if (!startTime) return ''
    const [h, m] = startTime.split(':').map(Number)
    const totalMin = h * 60 + m + Number(duration)
    const eh = Math.floor(totalMin / 60) % 24
    const em = totalMin % 60
    return `${String(eh).padStart(2, '0')}:${String(em).padStart(2, '0')}`
  })()

  // Price calculation
  const price = (() => {
    const cid = Number(courtId)
    const dow = new Date(date + 'T12:00:00').getDay()
    const schedule = schedules.find(s => s.court_id === cid && s.day_of_week === dow)
    if (!schedule) return 0
    const slots = Number(duration) / (schedule.slot_duration || 90)
    const basePrice = schedule.price_per_slot || 24
    // Check peak
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

    const bookingData = {
      club_id: 1,
      court_id: Number(courtId),
      date,
      start_time: startTime + ':00',
      end_time: endTime + ':00',
      duration_minutes: Number(duration),
      status,
      price,
      payment_method: paymentMethod,
      payment_status: status === 'confirmed' ? 'paid' : 'pending',
      notes: customerName || notes,
      type: 'regular' as const,
    }

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

      const { error } = await supabase
        .from('nm_bookings')
        .insert(bookingData)

      if (error) {
        toast('error', 'Error al crear: ' + error.message)
        setLoading(false)
        return
      }

      // Auto-register cash entry
      if (status === 'confirmed' && price > 0) {
        await supabase.from('nm_cash_register').insert({
          club_id: 1,
          type: 'booking',
          description: `Reserva ${customerName || 'Pista'} — ${date} ${startTime}`,
          amount: price,
          payment_method: paymentMethod,
          date,
        })
      }

      toast('success', 'Reserva creada')
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
        <div className="flex items-center justify-between bg-slate-800/50 rounded-lg px-4 py-3 border border-slate-700/50">
          <span className="text-sm text-slate-400">Precio</span>
          <span className="text-xl font-bold text-cyan-400">{formatCurrency(price)}</span>
        </div>

        {isAdmin && (
          <>
            <div className="border-t border-slate-700 pt-4">
              <h3 className="text-sm font-medium text-slate-300 mb-3">Datos del cliente</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Input
                  label="Nombre"
                  placeholder="Nombre del cliente"
                  value={customerName}
                  onChange={e => setCustomerName(e.target.value)}
                />
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
