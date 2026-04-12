'use client'

import { useState, useCallback, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Card } from '@/components/ui/card'
import { Modal } from '@/components/ui/modal'
import { Badge } from '@/components/ui/badge'
import { KpiCard } from '@/components/ui/kpi-card'
import { useToast } from '@/components/ui/toast'
import { Target, Plus, Trophy, Users, Award, Flame, Edit2, Trash2, Eye } from 'lucide-react'
import type { Challenge, ChallengeParticipant, Badge as BadgeType } from '@/types'

const CHALLENGE_TYPES = [
  { value: 'individual', label: 'Individual' },
  { value: 'team', label: 'Equipo' },
  { value: 'club_wide', label: 'Todo el club' },
]

const METRIC_OPTIONS = [
  { value: 'bookings', label: 'Reservas realizadas' },
  { value: 'matches_won', label: 'Partidos ganados' },
  { value: 'matches_played', label: 'Partidos jugados' },
  { value: 'gym_visits', label: 'Visitas al gimnasio' },
  { value: 'classes_attended', label: 'Clases asistidas' },
  { value: 'tournaments', label: 'Torneos jugados' },
  { value: 'posts', label: 'Publicaciones' },
  { value: 'streak_days', label: 'Días consecutivos' },
  { value: 'custom', label: 'Personalizado' },
]

const REWARD_TYPES = [
  { value: 'badge', label: 'Badge/Insignia' },
  { value: 'credits', label: 'Créditos' },
  { value: 'discount', label: 'Descuento' },
  { value: 'free_booking', label: 'Reserva gratis' },
  { value: 'merchandise', label: 'Merchandising' },
  { value: 'none', label: 'Sin premio' },
]

type Tab = 'challenges' | 'badges'

export default function AdminRetosPage() {
  const { toast } = useToast()
  const [tab, setTab] = useState<Tab>('challenges')

  // Challenges
  const [challenges, setChallenges] = useState<(Challenge & { participant_count?: number })[]>([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [editId, setEditId] = useState<number | null>(null)

  const [formName, setFormName] = useState('')
  const [formDesc, setFormDesc] = useState('')
  const [formType, setFormType] = useState('individual')
  const [formMetric, setFormMetric] = useState('bookings')
  const [formTarget, setFormTarget] = useState('10')
  const [formStart, setFormStart] = useState('')
  const [formEnd, setFormEnd] = useState('')
  const [formRewardType, setFormRewardType] = useState('badge')
  const [formRewardValue, setFormRewardValue] = useState('')

  // Badges
  const [badges, setBadges] = useState<BadgeType[]>([])
  const [badgeModalOpen, setBadgeModalOpen] = useState(false)
  const [badgeSaving, setBadgeSaving] = useState(false)
  const [editBadgeId, setEditBadgeId] = useState<number | null>(null)
  const [badgeName, setBadgeName] = useState('')
  const [badgeSlug, setBadgeSlug] = useState('')
  const [badgeDesc, setBadgeDesc] = useState('')
  const [badgeCategory, setBadgeCategory] = useState('')
  const [badgeIcon, setBadgeIcon] = useState('')

  // Detail modal
  const [detailChallenge, setDetailChallenge] = useState<Challenge | null>(null)
  const [participants, setParticipants] = useState<(ChallengeParticipant & { user?: { full_name: string } })[]>([])

  const loadChallenges = useCallback(async () => {
    setLoading(true)
    const supabase = createClient()
    const { data } = await supabase
      .from('nm_challenges')
      .select('*')
      .eq('club_id', 1)
      .order('is_active', { ascending: false })
      .order('created_at', { ascending: false })

    // Get participant counts
    if (data && data.length > 0) {
      const { data: counts } = await supabase
        .from('nm_challenge_participants')
        .select('challenge_id')
        .in('challenge_id', data.map(c => c.id))

      const countMap: Record<number, number> = {}
      ;(counts || []).forEach(p => {
        countMap[p.challenge_id] = (countMap[p.challenge_id] || 0) + 1
      })

      setChallenges(data.map(c => ({ ...c, participant_count: countMap[c.id] || 0 })) as typeof challenges)
    } else {
      setChallenges([])
    }
    setLoading(false)
  }, [])

  const loadBadges = useCallback(async () => {
    const supabase = createClient()
    const { data } = await supabase
      .from('nm_badges')
      .select('*')
      .eq('club_id', 1)
      .order('category', { ascending: true })
    setBadges((data || []) as BadgeType[])
  }, [])

  useEffect(() => { loadChallenges(); loadBadges() }, [loadChallenges, loadBadges])

  const activeChallenges = challenges.filter(c => c.is_active).length
  const totalParticipants = challenges.reduce((s, c) => s + (c.participant_count || 0), 0)

  function resetForm() {
    setEditId(null); setFormName(''); setFormDesc(''); setFormType('individual')
    setFormMetric('bookings'); setFormTarget('10'); setFormStart(''); setFormEnd('')
    setFormRewardType('badge'); setFormRewardValue('')
  }

  function openEdit(c: Challenge) {
    setEditId(c.id); setFormName(c.name); setFormDesc(c.description || ''); setFormType(c.type)
    setFormMetric(c.metric); setFormTarget(String(c.target_value)); setFormStart(c.start_date || ''); setFormEnd(c.end_date || '')
    setFormRewardType(c.reward_type || 'badge'); setFormRewardValue(c.reward_value || '')
    setModalOpen(true)
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!formName) return
    setSaving(true)
    const supabase = createClient()
    const payload = {
      club_id: 1,
      name: formName,
      description: formDesc || null,
      type: formType,
      metric: formMetric,
      target_value: Number(formTarget) || 10,
      start_date: formStart || null,
      end_date: formEnd || null,
      reward_type: formRewardType,
      reward_value: formRewardValue || null,
      is_active: true,
    }

    const { error } = editId
      ? await supabase.from('nm_challenges').update(payload).eq('id', editId)
      : await supabase.from('nm_challenges').insert(payload)

    if (error) {
      toast('error', 'Error: ' + error.message)
    } else {
      toast('success', editId ? 'Reto actualizado' : 'Reto creado')
      resetForm(); setModalOpen(false); loadChallenges()
    }
    setSaving(false)
  }

  async function handleDelete(id: number) {
    if (!confirm('¿Eliminar este reto?')) return
    const supabase = createClient()
    await supabase.from('nm_challenge_participants').delete().eq('challenge_id', id)
    const { error } = await supabase.from('nm_challenges').delete().eq('id', id)
    if (error) toast('error', 'Error: ' + error.message)
    else { toast('info', 'Reto eliminado'); loadChallenges() }
  }

  async function toggleActive(id: number, active: boolean) {
    const supabase = createClient()
    await supabase.from('nm_challenges').update({ is_active: !active }).eq('id', id)
    loadChallenges()
  }

  async function openDetail(c: Challenge) {
    setDetailChallenge(c)
    const supabase = createClient()
    const { data } = await supabase
      .from('nm_challenge_participants')
      .select('*, user:nm_users(full_name)')
      .eq('challenge_id', c.id)
      .order('current_value', { ascending: false })
    setParticipants((data || []) as typeof participants)
  }

  // Badge CRUD
  function resetBadgeForm() {
    setEditBadgeId(null); setBadgeName(''); setBadgeSlug(''); setBadgeDesc(''); setBadgeCategory(''); setBadgeIcon('')
  }

  function openEditBadge(b: BadgeType) {
    setEditBadgeId(b.id); setBadgeName(b.name); setBadgeSlug(b.slug); setBadgeDesc(b.description || '')
    setBadgeCategory(b.category || ''); setBadgeIcon(b.icon_url || '')
    setBadgeModalOpen(true)
  }

  async function handleSaveBadge(e: React.FormEvent) {
    e.preventDefault()
    if (!badgeName || !badgeSlug) return
    setBadgeSaving(true)
    const supabase = createClient()
    const payload = {
      club_id: 1,
      name: badgeName,
      slug: badgeSlug,
      description: badgeDesc || null,
      category: badgeCategory || null,
      icon_url: badgeIcon || null,
    }

    const { error } = editBadgeId
      ? await supabase.from('nm_badges').update(payload).eq('id', editBadgeId)
      : await supabase.from('nm_badges').insert(payload)

    if (error) toast('error', 'Error: ' + error.message)
    else { toast('success', editBadgeId ? 'Badge actualizado' : 'Badge creado'); resetBadgeForm(); setBadgeModalOpen(false); loadBadges() }
    setBadgeSaving(false)
  }

  async function handleDeleteBadge(id: number) {
    if (!confirm('¿Eliminar este badge?')) return
    const supabase = createClient()
    await supabase.from('nm_user_badges').delete().eq('badge_id', id)
    const { error } = await supabase.from('nm_badges').delete().eq('id', id)
    if (error) toast('error', 'Error: ' + error.message)
    else { toast('info', 'Badge eliminado'); loadBadges() }
  }

  const tabs: { key: Tab; label: string; icon: React.ReactNode }[] = [
    { key: 'challenges', label: 'Retos', icon: <Target size={16} /> },
    { key: 'badges', label: 'Badges', icon: <Award size={16} /> },
  ]

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Retos y Gamificación</h1>
          <p className="text-sm text-slate-400 mt-1">Gestión de desafíos, badges y sistema de logros</p>
        </div>
        <Button onClick={() => { if (tab === 'challenges') { resetForm(); setModalOpen(true) } else { resetBadgeForm(); setBadgeModalOpen(true) } }}>
          <Plus size={16} className="mr-1" />
          {tab === 'challenges' ? 'Nuevo Reto' : 'Nuevo Badge'}
        </Button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-800/50 p-1 rounded-lg w-fit">
        {tabs.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)} className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${tab === t.key ? 'bg-cyan-600 text-white' : 'text-slate-400 hover:text-white'}`}>
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {tab === 'challenges' && (
        <>
          {/* KPIs */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <KpiCard title="Total Retos" value={challenges.length} icon={<Target size={20} />} />
            <KpiCard title="Activos" value={activeChallenges} icon={<Flame size={20} />} color="#10b981" />
            <KpiCard title="Participantes" value={totalParticipants} icon={<Users size={20} />} color="#6366f1" />
            <KpiCard title="Badges" value={badges.length} icon={<Award size={20} />} color="#f59e0b" />
          </div>

          {/* Challenges list */}
          {loading ? (
            <div className="text-center py-12 text-slate-500">Cargando...</div>
          ) : challenges.length === 0 ? (
            <Card><div className="text-center py-12 text-slate-500">No hay retos creados</div></Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {challenges.map(c => {
                const metricLabel = METRIC_OPTIONS.find(m => m.value === c.metric)?.label || c.metric
                return (
                  <Card key={c.id}>
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${c.is_active ? 'bg-green-500/10' : 'bg-slate-700/50'}`}>
                          <Target size={24} className={c.is_active ? 'text-green-400' : 'text-slate-500'} />
                        </div>
                        <div>
                          <p className="font-semibold text-white">{c.name}</p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <Badge variant={c.is_active ? 'success' : 'default'}>{c.is_active ? 'Activo' : 'Inactivo'}</Badge>
                            <Badge variant="info">{c.type === 'individual' ? 'Individual' : c.type === 'team' ? 'Equipo' : 'Club'}</Badge>
                          </div>
                        </div>
                      </div>
                      <div className="flex gap-1">
                        <button onClick={() => openDetail(c)} className="p-1.5 rounded text-slate-500 hover:text-cyan-400 hover:bg-cyan-500/10"><Eye size={14} /></button>
                        <button onClick={() => openEdit(c)} className="p-1.5 rounded text-slate-500 hover:text-yellow-400 hover:bg-yellow-500/10"><Edit2 size={14} /></button>
                        <button onClick={() => handleDelete(c.id)} className="p-1.5 rounded text-slate-500 hover:text-red-400 hover:bg-red-500/10"><Trash2 size={14} /></button>
                      </div>
                    </div>
                    {c.description && <p className="text-xs text-slate-400 mb-3">{c.description}</p>}
                    <div className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-4 text-slate-400">
                        <span>Meta: <span className="text-white font-medium">{c.target_value} {metricLabel.toLowerCase()}</span></span>
                        <span className="flex items-center gap-1"><Users size={12} /> {c.participant_count || 0}</span>
                      </div>
                      <button onClick={() => toggleActive(c.id, c.is_active)} className={`text-xs px-2 py-1 rounded ${c.is_active ? 'text-red-400 hover:bg-red-500/10' : 'text-green-400 hover:bg-green-500/10'}`}>
                        {c.is_active ? 'Desactivar' : 'Activar'}
                      </button>
                    </div>
                    {(c.start_date || c.end_date) && (
                      <div className="mt-2 text-xs text-slate-500">
                        {c.start_date && <span>Desde {new Date(c.start_date).toLocaleDateString('es-ES')}</span>}
                        {c.start_date && c.end_date && <span> — </span>}
                        {c.end_date && <span>Hasta {new Date(c.end_date).toLocaleDateString('es-ES')}</span>}
                      </div>
                    )}
                    {c.reward_type && c.reward_type !== 'none' && (
                      <div className="mt-2 flex items-center gap-1.5 text-xs text-yellow-400">
                        <Trophy size={12} /> Premio: {REWARD_TYPES.find(r => r.value === c.reward_type)?.label}{c.reward_value ? ` — ${c.reward_value}` : ''}
                      </div>
                    )}
                  </Card>
                )
              })}
            </div>
          )}
        </>
      )}

      {tab === 'badges' && (
        <>
          {badges.length === 0 ? (
            <Card><div className="text-center py-12 text-slate-500">No hay badges creados</div></Card>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {badges.map(b => (
                <Card key={b.id}>
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-14 h-14 rounded-xl bg-yellow-500/10 flex items-center justify-center text-2xl">
                        {b.icon_url || '🏆'}
                      </div>
                      <div>
                        <p className="font-semibold text-white">{b.name}</p>
                        <p className="text-xs text-slate-500 font-mono">{b.slug}</p>
                        {b.category && <Badge variant="default">{b.category}</Badge>}
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <button onClick={() => openEditBadge(b)} className="p-1.5 rounded text-slate-500 hover:text-yellow-400 hover:bg-yellow-500/10"><Edit2 size={14} /></button>
                      <button onClick={() => handleDeleteBadge(b.id)} className="p-1.5 rounded text-slate-500 hover:text-red-400 hover:bg-red-500/10"><Trash2 size={14} /></button>
                    </div>
                  </div>
                  {b.description && <p className="text-xs text-slate-400 mt-2">{b.description}</p>}
                </Card>
              ))}
            </div>
          )}
        </>
      )}

      {/* Challenge Modal */}
      <Modal
        open={modalOpen}
        onClose={() => { setModalOpen(false); resetForm() }}
        title={editId ? 'Editar Reto' : 'Nuevo Reto'}
        footer={
          <div className="flex items-center gap-3">
            <Button variant="ghost" onClick={() => { setModalOpen(false); resetForm() }}>Cancelar</Button>
            <Button onClick={handleSave} loading={saving}>{editId ? 'Guardar' : 'Crear'}</Button>
          </div>
        }
      >
        <form onSubmit={handleSave} className="space-y-4">
          <Input label="Nombre del reto" value={formName} onChange={e => setFormName(e.target.value)} placeholder="Ej: Reto 30 reservas en un mes" required />
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">Descripción</label>
            <textarea value={formDesc} onChange={e => setFormDesc(e.target.value)} placeholder="Descripción del desafío..." rows={3} className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:border-cyan-500 focus:outline-none resize-none" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Select label="Tipo" value={formType} onChange={e => setFormType(e.target.value)} options={CHALLENGE_TYPES} />
            <Select label="Métrica" value={formMetric} onChange={e => setFormMetric(e.target.value)} options={METRIC_OPTIONS} />
          </div>
          <Input label="Objetivo (valor numérico)" type="number" min="1" value={formTarget} onChange={e => setFormTarget(e.target.value)} required />
          <div className="grid grid-cols-2 gap-4">
            <Input label="Fecha inicio" type="date" value={formStart} onChange={e => setFormStart(e.target.value)} />
            <Input label="Fecha fin" type="date" value={formEnd} onChange={e => setFormEnd(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Select label="Tipo de premio" value={formRewardType} onChange={e => setFormRewardType(e.target.value)} options={REWARD_TYPES} />
            <Input label="Valor del premio" value={formRewardValue} onChange={e => setFormRewardValue(e.target.value)} placeholder="Ej: 10 créditos" />
          </div>
        </form>
      </Modal>

      {/* Badge Modal */}
      <Modal
        open={badgeModalOpen}
        onClose={() => { setBadgeModalOpen(false); resetBadgeForm() }}
        title={editBadgeId ? 'Editar Badge' : 'Nuevo Badge'}
        footer={
          <div className="flex items-center gap-3">
            <Button variant="ghost" onClick={() => { setBadgeModalOpen(false); resetBadgeForm() }}>Cancelar</Button>
            <Button onClick={handleSaveBadge} loading={badgeSaving}>{editBadgeId ? 'Guardar' : 'Crear'}</Button>
          </div>
        }
      >
        <form onSubmit={handleSaveBadge} className="space-y-4">
          <Input label="Nombre" value={badgeName} onChange={e => setBadgeName(e.target.value)} placeholder="Ej: Maratonista" required />
          <Input label="Slug (identificador único)" value={badgeSlug} onChange={e => setBadgeSlug(e.target.value)} placeholder="Ej: maratonista" required />
          <Input label="Descripción" value={badgeDesc} onChange={e => setBadgeDesc(e.target.value)} placeholder="Completó 100 reservas" />
          <div className="grid grid-cols-2 gap-4">
            <Input label="Categoría" value={badgeCategory} onChange={e => setBadgeCategory(e.target.value)} placeholder="Ej: deportivo, social" />
            <Input label="Icono (emoji o URL)" value={badgeIcon} onChange={e => setBadgeIcon(e.target.value)} placeholder="🏆" />
          </div>
        </form>
      </Modal>

      {/* Challenge Detail Modal */}
      <Modal
        open={!!detailChallenge}
        onClose={() => setDetailChallenge(null)}
        title={detailChallenge?.name || 'Detalle del Reto'}
      >
        {detailChallenge && (
          <div className="space-y-4">
            {detailChallenge.description && <p className="text-sm text-slate-300">{detailChallenge.description}</p>}
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="bg-slate-900 rounded-lg p-3">
                <p className="text-slate-500 text-xs">Métrica</p>
                <p className="text-white font-medium">{METRIC_OPTIONS.find(m => m.value === detailChallenge.metric)?.label}</p>
              </div>
              <div className="bg-slate-900 rounded-lg p-3">
                <p className="text-slate-500 text-xs">Objetivo</p>
                <p className="text-white font-medium">{detailChallenge.target_value}</p>
              </div>
            </div>

            <div>
              <h4 className="text-sm font-semibold text-white mb-2">Leaderboard ({participants.length} participantes)</h4>
              {participants.length === 0 ? (
                <p className="text-xs text-slate-500 text-center py-4">Sin participantes aún</p>
              ) : (
                <div className="space-y-1.5 max-h-64 overflow-y-auto">
                  {participants.map((p, i) => {
                    const pct = Math.min((p.current_value / detailChallenge.target_value) * 100, 100)
                    return (
                      <div key={p.id} className="flex items-center gap-3 px-3 py-2 rounded-lg bg-slate-900/50">
                        <span className={`w-6 text-center text-xs font-bold ${i < 3 ? 'text-yellow-400' : 'text-slate-500'}`}>
                          {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `#${i + 1}`}
                        </span>
                        <span className="flex-1 text-sm text-white">{p.user?.full_name || 'Usuario'}</span>
                        <div className="w-24 bg-slate-700 rounded-full h-1.5">
                          <div className={`h-1.5 rounded-full ${p.completed ? 'bg-green-500' : 'bg-cyan-500'}`} style={{ width: `${pct}%` }} />
                        </div>
                        <span className="text-xs text-slate-400 w-16 text-right">{p.current_value}/{detailChallenge.target_value}</span>
                        {p.completed && <span className="text-green-400 text-xs">✓</span>}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
