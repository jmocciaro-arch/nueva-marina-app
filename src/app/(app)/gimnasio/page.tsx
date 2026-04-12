'use client'

import { useState, useCallback, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/lib/auth-context'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Dumbbell, CheckCircle, Clock, CreditCard, AlertCircle } from 'lucide-react'

interface GymMembership {
  id: string
  plan: string
  price: number
  start_date: string
  end_date: string
  status: string
}

interface GymClass {
  id: string
  name: string
  instructor: string | null
  day_of_week: number
  start_time: string
  end_time: string
  capacity: number | null
  is_active: boolean
}

interface GymSession {
  id: string
  check_in_at: string
  check_out_at: string | null
  notes: string | null
}

const DAY_FULL = ['Domingo', 'Lunes', 'Martes', 'Miercoles', 'Jueves', 'Viernes', 'Sabado']

export default function GimnasioPage() {
  const { user } = useAuth()
  const [membership, setMembership] = useState<GymMembership | null>(null)
  const [classes, setClasses] = useState<GymClass[]>([])
  const [sessions, setSessions] = useState<GymSession[]>([])
  const [loading, setLoading] = useState(true)

  const loadData = useCallback(async () => {
    const supabase = createClient()
    if (!user) return
    setLoading(true)

    const [memRes, classesRes, sessionsRes] = await Promise.all([
      supabase
        .from('nm_gym_memberships')
        .select('*')
        .eq('user_id', user.id)
        .eq('status', 'active')
        .order('start_date', { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from('nm_gym_classes')
        .select('*')
        .eq('is_active', true)
        .order('day_of_week')
        .order('start_time'),
      supabase
        .from('nm_gym_sessions')
        .select('*')
        .eq('user_id', user.id)
        .order('check_in_at', { ascending: false })
        .limit(10),
    ])

    setMembership(memRes.data || null)
    setClasses((classesRes.data || []) as GymClass[])
    setSessions((sessionsRes.data || []) as GymSession[])
    setLoading(false)
  }, [user])

  useEffect(() => { loadData() }, [loadData])

  const classesByDay: Record<number, GymClass[]> = {}
  for (const cls of classes) {
    if (!classesByDay[cls.day_of_week]) classesByDay[cls.day_of_week] = []
    classesByDay[cls.day_of_week].push(cls)
  }
  const activeDays = Object.keys(classesByDay).map(Number).sort()

  function formatDate(d: string) {
    return new Date(d).toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: 'numeric' })
  }

  function daysLeft(endDate: string) {
    return Math.ceil((new Date(endDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Gimnasio</h1>
        <p className="text-sm text-slate-400 mt-1">Clases disponibles, horarios y tu suscripcion</p>
      </div>

      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-32 rounded-xl bg-slate-800/50 border border-slate-700/50 animate-pulse" />
          ))}
        </div>
      ) : (
        <>
          {/* Membresia */}
          {membership ? (
            <Card>
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-cyan-500/20 flex items-center justify-center">
                    <CreditCard size={20} className="text-cyan-400" />
                  </div>
                  <div>
                    <h2 className="text-white font-semibold">{membership.plan}</h2>
                    <p className="text-slate-400 text-xs">Membresia activa</p>
                  </div>
                </div>
                <Badge variant="success">Activa</Badge>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm">
                <div>
                  <p className="text-slate-500 text-xs mb-0.5">Precio</p>
                  <p className="text-white font-medium">
                    {membership.price != null ? `€${membership.price.toFixed(2)}/mes` : '-'}
                  </p>
                </div>
                <div>
                  <p className="text-slate-500 text-xs mb-0.5">Desde</p>
                  <p className="text-white">{formatDate(membership.start_date)}</p>
                </div>
                <div>
                  <p className="text-slate-500 text-xs mb-0.5">Vence</p>
                  <p className="text-white">{formatDate(membership.end_date)}</p>
                  {(() => {
                    const days = daysLeft(membership.end_date)
                    return (
                      <p className={`text-xs mt-0.5 ${days <= 7 ? 'text-amber-400' : 'text-slate-400'}`}>
                        {days} dias restantes
                      </p>
                    )
                  })()}
                </div>
              </div>
            </Card>
          ) : (
            <Card>
              <div className="flex items-start gap-3">
                <AlertCircle size={20} className="text-amber-400 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-white font-medium">No tenes membresia activa</p>
                  <p className="text-slate-400 text-sm mt-1">
                    Acercate al club o contacta con administracion para activar tu membresia de gimnasio.
                  </p>
                </div>
              </div>
            </Card>
          )}

          {/* Clases */}
          {classes.length > 0 && (
            <div>
              <h2 className="text-white font-semibold mb-3 flex items-center gap-2">
                <Dumbbell size={16} className="text-cyan-400" />
                Clases semanales
              </h2>
              <div className="space-y-4">
                {activeDays.map(day => (
                  <div key={day}>
                    <p className="text-xs font-semibold text-cyan-400 uppercase tracking-wider mb-2">
                      {DAY_FULL[day]}
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {classesByDay[day].map(cls => (
                        <div
                          key={cls.id}
                          className="flex items-center gap-3 rounded-lg bg-slate-800/60 border border-slate-700/40 px-4 py-3"
                        >
                          <div className="flex-1 min-w-0">
                            <p className="text-white text-sm font-medium truncate">{cls.name}</p>
                            {cls.instructor && <p className="text-slate-400 text-xs">{cls.instructor}</p>}
                          </div>
                          <div className="text-right text-xs text-slate-400 flex-shrink-0">
                            <span className="flex items-center gap-1">
                              <Clock size={11} />
                              {cls.start_time?.slice(0, 5)} - {cls.end_time?.slice(0, 5)}
                            </span>
                            {cls.capacity && <span className="text-slate-500">{cls.capacity} plazas</span>}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Historial de sesiones */}
          {sessions.length > 0 && (
            <div>
              <h2 className="text-white font-semibold mb-3 flex items-center gap-2">
                <CheckCircle size={16} className="text-green-400" />
                Ultimas visitas
              </h2>
              <Card>
                <div className="divide-y divide-slate-700/40">
                  {sessions.map(session => {
                    const checkIn = new Date(session.check_in_at)
                    const checkOut = session.check_out_at ? new Date(session.check_out_at) : null
                    const duration = checkOut
                      ? Math.round((checkOut.getTime() - checkIn.getTime()) / 60000)
                      : null
                    return (
                      <div key={session.id} className="flex items-center justify-between py-3 first:pt-0 last:pb-0">
                        <div>
                          <p className="text-white text-sm">
                            {checkIn.toLocaleDateString('es-AR', { weekday: 'short', day: '2-digit', month: 'short' })}
                          </p>
                          <p className="text-slate-400 text-xs">
                            {checkIn.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}
                            {checkOut && ` - ${checkOut.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}`}
                          </p>
                        </div>
                        <div className="text-right">
                          {duration != null ? (
                            <span className="text-cyan-400 text-xs font-medium">{duration} min</span>
                          ) : (
                            <Badge variant="warning">En curso</Badge>
                          )}
                          {session.notes && <p className="text-slate-500 text-xs">{session.notes}</p>}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </Card>
            </div>
          )}

          {classes.length === 0 && sessions.length === 0 && !membership && (
            <Card>
              <div className="text-center py-10">
                <Dumbbell size={40} className="mx-auto text-slate-600 mb-3" />
                <p className="text-slate-400 text-sm">No hay informacion de gimnasio disponible</p>
              </div>
            </Card>
          )}
        </>
      )}
    </div>
  )
}
