'use client'

import { useState, useCallback, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/lib/auth-context'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ClipboardList, Dumbbell, Calendar, Target, CheckCircle, PauseCircle } from 'lucide-react'
import type { UserTrainingPlan, TrainingPlan } from '@/types'

interface ScheduleExercise {
  name: string
  sets?: number | string
  reps?: number | string
  rest?: string
  notes?: string
}

interface ScheduleDay {
  day: string
  exercises: ScheduleExercise[]
}

function ScheduleViewer({ schedule }: { schedule: unknown }) {
  if (!schedule || (Array.isArray(schedule) && schedule.length === 0)) {
    return (
      <p className="text-sm text-slate-500 italic mt-4">
        El entrenador aún no cargó los ejercicios.
      </p>
    )
  }

  // Normalise: schedule can be an array of days directly, or { weeks: [...] }
  let days: ScheduleDay[] = []
  if (Array.isArray(schedule)) {
    // Could be array of days or array of weeks
    const first = schedule[0] as Record<string, unknown>
    if (first && 'exercises' in first) {
      days = schedule as ScheduleDay[]
    } else if (first && 'days' in first) {
      // { days: ScheduleDay[] }[]  — flatten all weeks
      for (const week of schedule as { days: ScheduleDay[] }[]) {
        if (Array.isArray(week.days)) days.push(...week.days)
      }
    }
  } else if (typeof schedule === 'object' && schedule !== null) {
    const s = schedule as Record<string, unknown>
    if (Array.isArray(s.weeks)) {
      for (const week of s.weeks as { days?: ScheduleDay[]; exercises?: ScheduleExercise[]; day?: string }[]) {
        if (Array.isArray(week.days)) days.push(...week.days)
      }
    } else if (Array.isArray(s.days)) {
      days = s.days as ScheduleDay[]
    }
  }

  if (days.length === 0) {
    return (
      <p className="text-sm text-slate-500 italic mt-4">
        El entrenador aún no cargó los ejercicios.
      </p>
    )
  }

  return (
    <div className="mt-5 space-y-4">
      <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wide">Rutina de ejercicios</h3>
      {days.map((dayItem, i) => (
        <div key={i} className="rounded-lg bg-slate-800/60 border border-slate-700/50 overflow-hidden">
          <div className="px-4 py-2 bg-indigo-600/20 border-b border-slate-700/50">
            <span className="text-sm font-semibold text-indigo-300">{dayItem.day}</span>
          </div>
          {Array.isArray(dayItem.exercises) && dayItem.exercises.length > 0 ? (
            <ul className="divide-y divide-slate-700/40">
              {dayItem.exercises.map((ex, j) => (
                <li key={j} className="flex items-center justify-between px-4 py-2.5 gap-3">
                  <span className="text-sm text-white font-medium">{ex.name}</span>
                  <div className="flex items-center gap-2 text-xs text-slate-400 shrink-0">
                    {(ex.sets !== undefined || ex.reps !== undefined) && (
                      <span className="bg-slate-700/60 px-2 py-0.5 rounded text-slate-300">
                        {ex.sets ?? '?'} × {ex.reps ?? '?'}
                      </span>
                    )}
                    {ex.rest && (
                      <span className="text-slate-500">descanso: {ex.rest}</span>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="px-4 py-2.5 text-xs text-slate-500">Sin ejercicios cargados.</p>
          )}
        </div>
      ))}
    </div>
  )
}

const LEVEL_LABELS: Record<string, string> = { beginner: 'Principiante', intermediate: 'Intermedio', advanced: 'Avanzado' }
const LEVEL_COLORS: Record<string, string> = { beginner: 'text-green-400', intermediate: 'text-yellow-400', advanced: 'text-red-400' }

export default function MiEntrenamientoPage() {
  const { user } = useAuth()
  const [plans, setPlans] = useState<(UserTrainingPlan & { plan?: TrainingPlan })[]>([])
  const [loading, setLoading] = useState(true)

  const loadData = useCallback(async () => {
    if (!user) return
    setLoading(true)
    const supabase = createClient()
    const { data } = await supabase
      .from('nm_user_training_plans')
      .select('*, plan:nm_training_plans(*)')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
    setPlans((data || []) as typeof plans)
    setLoading(false)
  }, [user])

  useEffect(() => { loadData() }, [loadData])

  const activePlan = plans.find(p => p.status === 'active')
  const completedPlans = plans.filter(p => p.status === 'completed')
  const pausedPlans = plans.filter(p => p.status === 'paused')

  if (loading) {
    return (
      <div className="space-y-6">
        <div><h1 className="text-2xl font-bold text-white">Mi Entrenamiento</h1></div>
        <div className="text-center py-12 text-slate-500">Cargando...</div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Mi Entrenamiento</h1>
        <p className="text-sm text-slate-400 mt-1">Tu plan de entrenamiento personalizado y rutinas</p>
      </div>

      {/* Active Plan */}
      {activePlan && activePlan.plan ? (
        <Card>
          <div className="flex items-start gap-4">
            <div className="w-14 h-14 rounded-xl bg-indigo-600/10 flex items-center justify-center flex-shrink-0">
              <Dumbbell size={28} className="text-indigo-400" />
            </div>
            <div className="flex-1">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xl font-bold text-white">{activePlan.plan.name}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge variant="success">Activo</Badge>
                    {activePlan.plan.target_level && (
                      <span className={`text-xs font-medium ${LEVEL_COLORS[activePlan.plan.target_level] || 'text-slate-400'}`}>
                        {LEVEL_LABELS[activePlan.plan.target_level]}
                      </span>
                    )}
                  </div>
                </div>
              </div>
              {activePlan.plan.description && (
                <p className="text-sm text-slate-300 mt-3 leading-relaxed border-l-2 border-indigo-500/50 pl-3">{activePlan.plan.description}</p>
              )}
              <div className="mt-4 flex flex-wrap gap-4 text-sm text-slate-400">
                {activePlan.plan.duration_weeks && (
                  <div className="flex items-center gap-1.5">
                    <Calendar size={14} /> {activePlan.plan.duration_weeks} semanas
                  </div>
                )}
                {activePlan.plan.goal && (
                  <div className="flex items-center gap-1.5">
                    <Target size={14} /> {activePlan.plan.goal}
                  </div>
                )}
                {activePlan.start_date && (
                  <div className="flex items-center gap-1.5">
                    <Calendar size={14} /> Inicio: <span className="text-white">{new Date(activePlan.start_date).toLocaleDateString('es-ES', { day: 'numeric', month: 'long' })}</span>
                  </div>
                )}
              </div>

              {/* Progress placeholder */}
              {activePlan.plan.duration_weeks && activePlan.start_date && (
                <div className="mt-4">
                  <div className="flex items-center justify-between text-xs mb-1.5">
                    <span className="text-slate-500">Progreso</span>
                    <span className="text-white font-medium">
                      {(() => {
                        const start = new Date(activePlan.start_date)
                        const now = new Date()
                        const weeks = Math.floor((now.getTime() - start.getTime()) / (7 * 24 * 60 * 60 * 1000))
                        const pct = Math.min(Math.round((weeks / activePlan.plan!.duration_weeks!) * 100), 100)
                        return `Semana ${Math.min(weeks + 1, activePlan.plan!.duration_weeks!)} de ${activePlan.plan!.duration_weeks} (${pct}%)`
                      })()}
                    </span>
                  </div>
                  <div className="w-full bg-slate-700 rounded-full h-2.5">
                    <div
                      className="bg-gradient-to-r from-indigo-500 to-cyan-500 h-2.5 rounded-full transition-all"
                      style={{
                        width: `${Math.min(Math.round(((Date.now() - new Date(activePlan.start_date).getTime()) / (7 * 24 * 60 * 60 * 1000)) / (activePlan.plan.duration_weeks || 1) * 100), 100)}%`,
                      }}
                    />
                  </div>
                </div>
              )}

              {/* Schedule */}
              <ScheduleViewer schedule={activePlan.plan.schedule as unknown} />
            </div>
          </div>
        </Card>
      ) : (
        <Card>
          <div className="flex flex-col items-center py-8">
            <div className="w-16 h-16 rounded-2xl bg-slate-700/50 flex items-center justify-center mb-4">
              <ClipboardList size={32} className="text-slate-500" />
            </div>
            <h3 className="text-lg font-semibold text-white">Sin plan activo</h3>
            <p className="text-sm text-slate-400 mt-2">Tu entrenador te asignará un plan personalizado</p>
          </div>
        </Card>
      )}

      {/* Paused Plans */}
      {pausedPlans.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold text-white mb-3 flex items-center gap-2"><PauseCircle size={20} className="text-yellow-400" /> Planes Pausados</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {pausedPlans.map(p => (
              <div key={p.id} className="flex items-center gap-3 px-4 py-3 rounded-xl bg-yellow-500/5 border border-yellow-500/20">
                <PauseCircle size={20} className="text-yellow-400 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white truncate">{p.plan?.name}</p>
                  <p className="text-xs text-yellow-400/60">Pausado</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Completed Plans */}
      {completedPlans.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold text-white mb-3 flex items-center gap-2"><CheckCircle size={20} className="text-green-400" /> Planes Completados</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {completedPlans.map(p => (
              <div key={p.id} className="flex items-center gap-3 px-4 py-3 rounded-xl bg-green-500/5 border border-green-500/20">
                <CheckCircle size={20} className="text-green-400 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white truncate">{p.plan?.name}</p>
                  <p className="text-xs text-green-400/60">{p.plan?.duration_weeks} semanas — {p.plan?.target_level ? LEVEL_LABELS[p.plan.target_level] : ''}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
