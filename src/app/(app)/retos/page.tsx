'use client'

import { useState, useCallback, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/lib/auth-context'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { useToast } from '@/components/ui/toast'
import { Target, Trophy, Flame, Award, Users, CheckCircle } from 'lucide-react'
import type { Challenge, ChallengeParticipant, UserBadge } from '@/types'

const METRIC_LABELS: Record<string, string> = {
  bookings: 'reservas',
  matches_won: 'partidos ganados',
  matches_played: 'partidos jugados',
  gym_visits: 'visitas al gym',
  classes_attended: 'clases',
  tournaments: 'torneos',
  posts: 'publicaciones',
  streak_days: 'días consecutivos',
  custom: 'unidades',
}

export default function RetosPlayerPage() {
  const { user } = useAuth()
  const { toast } = useToast()
  const [challenges, setChallenges] = useState<(Challenge & { my_participation?: ChallengeParticipant; participant_count?: number })[]>([])
  const [myBadges, setMyBadges] = useState<(UserBadge & { badge?: { name: string; slug: string; icon_url?: string; description?: string; category?: string } })[]>([])
  const [loading, setLoading] = useState(true)
  const [joining, setJoining] = useState<number | null>(null)

  const loadData = useCallback(async () => {
    if (!user) return
    setLoading(true)
    const supabase = createClient()

    // Active challenges
    const { data: challengeData } = await supabase
      .from('nm_challenges')
      .select('*')
      .eq('club_id', 1)
      .eq('is_active', true)
      .order('created_at', { ascending: false })

    const chs = (challengeData || []) as Challenge[]

    if (chs.length > 0) {
      // My participations
      const { data: myParts } = await supabase
        .from('nm_challenge_participants')
        .select('*')
        .eq('user_id', user.id)
        .in('challenge_id', chs.map(c => c.id))

      const partMap: Record<number, ChallengeParticipant> = {}
      ;(myParts || []).forEach(p => { partMap[p.challenge_id] = p as ChallengeParticipant })

      // Participant counts
      const { data: counts } = await supabase
        .from('nm_challenge_participants')
        .select('challenge_id')
        .in('challenge_id', chs.map(c => c.id))

      const countMap: Record<number, number> = {}
      ;(counts || []).forEach(p => {
        countMap[p.challenge_id] = (countMap[p.challenge_id] || 0) + 1
      })

      setChallenges(chs.map(c => ({ ...c, my_participation: partMap[c.id], participant_count: countMap[c.id] || 0 })))
    } else {
      setChallenges([])
    }

    // My badges
    const { data: badgeData } = await supabase
      .from('nm_user_badges')
      .select('*, badge:nm_badges(name, slug, icon_url, description, category)')
      .eq('user_id', user.id)
      .order('awarded_at', { ascending: false })
    setMyBadges((badgeData || []) as typeof myBadges)

    setLoading(false)
  }, [user])

  useEffect(() => { loadData() }, [loadData])

  async function joinChallenge(challengeId: number) {
    if (!user) return
    setJoining(challengeId)
    const supabase = createClient()
    const { error } = await supabase.from('nm_challenge_participants').insert({
      challenge_id: challengeId,
      user_id: user.id,
      current_value: 0,
      completed: false,
    })
    if (error) {
      if (error.code === '23505') toast('info', 'Ya estás participando en este reto')
      else toast('error', 'Error: ' + error.message)
    } else {
      toast('success', '¡Te uniste al reto!')
      loadData()
    }
    setJoining(null)
  }

  const activeChallenges = challenges.filter(c => !c.my_participation?.completed)
  const completedChallenges = challenges.filter(c => c.my_participation?.completed)

  if (loading) {
    return (
      <div className="space-y-6">
        <div><h1 className="text-2xl font-bold text-white">Retos</h1></div>
        <div className="text-center py-12 text-slate-500">Cargando...</div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Retos</h1>
        <p className="text-sm text-slate-400 mt-1">Desafíos activos, tu progreso y badges conseguidos</p>
      </div>

      {/* My Badges */}
      {myBadges.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold text-white mb-3 flex items-center gap-2"><Award size={20} className="text-yellow-400" /> Mis Badges</h2>
          <div className="flex gap-3 flex-wrap">
            {myBadges.map(ub => (
              <div key={ub.id} className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-yellow-500/10 border border-yellow-500/20">
                <span className="text-xl">{ub.badge?.icon_url || '🏆'}</span>
                <div>
                  <p className="text-sm font-semibold text-yellow-300">{ub.badge?.name}</p>
                  {ub.badge?.description && <p className="text-[10px] text-yellow-400/60">{ub.badge.description}</p>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Active Challenges */}
      <div>
        <h2 className="text-lg font-semibold text-white mb-3 flex items-center gap-2"><Flame size={20} className="text-orange-400" /> Retos Activos</h2>
        {challenges.length === 0 ? (
          <Card>
            <div className="flex flex-col items-center py-12">
              <div className="w-16 h-16 rounded-2xl bg-slate-700/50 flex items-center justify-center mb-4">
                <Target size={32} className="text-slate-500" />
              </div>
              <h3 className="text-lg font-semibold text-white">Sin retos activos</h3>
              <p className="text-sm text-slate-400 mt-2">Cuando el club cree nuevos retos, aparecerán acá</p>
            </div>
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {activeChallenges.map(c => {
              const myPart = c.my_participation
              const pct = myPart ? Math.min((myPart.current_value / c.target_value) * 100, 100) : 0
              const metricLabel = METRIC_LABELS[c.metric] || c.metric

              return (
                <Card key={c.id}>
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-xl bg-orange-500/10 flex items-center justify-center">
                        <Target size={24} className="text-orange-400" />
                      </div>
                      <div>
                        <p className="font-semibold text-white">{c.name}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <Badge variant="warning">{c.type === 'individual' ? 'Individual' : c.type === 'team' ? 'Equipo' : 'Club'}</Badge>
                          <span className="text-xs text-slate-500 flex items-center gap-1"><Users size={10} /> {c.participant_count}</span>
                        </div>
                      </div>
                    </div>
                    {c.reward_type && c.reward_type !== 'none' && (
                      <div className="flex items-center gap-1 text-yellow-400 text-xs"><Trophy size={12} /> Premio</div>
                    )}
                  </div>

                  {c.description && <p className="text-xs text-slate-400 mb-3">{c.description}</p>}

                  {myPart ? (
                    <div>
                      <div className="flex items-center justify-between text-sm mb-1.5">
                        <span className="text-slate-400">Progreso</span>
                        <span className="text-white font-semibold">{myPart.current_value} / {c.target_value} <span className="text-slate-500 text-xs">{metricLabel}</span></span>
                      </div>
                      <div className="w-full bg-slate-700 rounded-full h-3">
                        <div className="bg-gradient-to-r from-orange-500 to-yellow-500 h-3 rounded-full transition-all" style={{ width: `${pct}%` }} />
                      </div>
                      <p className="text-xs text-slate-500 mt-1.5 text-right">{Math.round(pct)}% completado</p>
                    </div>
                  ) : (
                    <div className="text-center pt-2">
                      <p className="text-xs text-slate-500 mb-2">Meta: {c.target_value} {metricLabel}</p>
                      <Button onClick={() => joinChallenge(c.id)} loading={joining === c.id}>
                        <Flame size={14} className="mr-1" /> Unirme al Reto
                      </Button>
                    </div>
                  )}

                  {(c.start_date || c.end_date) && (
                    <div className="mt-2 text-[10px] text-slate-600">
                      {c.start_date && <span>{new Date(c.start_date).toLocaleDateString('es-ES')}</span>}
                      {c.start_date && c.end_date && <span> — </span>}
                      {c.end_date && <span>{new Date(c.end_date).toLocaleDateString('es-ES')}</span>}
                    </div>
                  )}
                </Card>
              )
            })}
          </div>
        )}
      </div>

      {/* Completed Challenges */}
      {completedChallenges.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold text-white mb-3 flex items-center gap-2"><CheckCircle size={20} className="text-green-400" /> Retos Completados</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {completedChallenges.map(c => (
              <div key={c.id} className="flex items-center gap-3 px-4 py-3 rounded-xl bg-green-500/5 border border-green-500/20">
                <CheckCircle size={20} className="text-green-400 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white truncate">{c.name}</p>
                  <p className="text-xs text-green-400/70">Completado {c.my_participation?.completed_at ? new Date(c.my_participation.completed_at).toLocaleDateString('es-ES') : ''}</p>
                </div>
                <span className="text-sm font-bold text-green-400">{c.my_participation?.current_value}/{c.target_value}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
