'use client'

import { useState, useCallback, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/lib/auth-context'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Card } from '@/components/ui/card'
import { Modal } from '@/components/ui/modal'
import { Badge } from '@/components/ui/badge'
import { KpiCard } from '@/components/ui/kpi-card'
import { useToast } from '@/components/ui/toast'
import { ClipboardList, Plus, Users, Dumbbell, Edit2, Trash2, UserPlus, Eye, Calendar } from 'lucide-react'
import type { TrainingPlan, UserTrainingPlan, User } from '@/types'

const LEVEL_OPTIONS = [
  { value: 'beginner', label: 'Principiante' },
  { value: 'intermediate', label: 'Intermedio' },
  { value: 'advanced', label: 'Avanzado' },
]

const LEVEL_COLORS: Record<string, string> = {
  beginner: 'bg-green-500/10 text-green-400',
  intermediate: 'bg-yellow-500/10 text-yellow-400',
  advanced: 'bg-red-500/10 text-red-400',
}

type Tab = 'plans' | 'assignments'

export default function AdminEntrenamientoPage() {
  const { user } = useAuth()
  const { toast } = useToast()
  const [tab, setTab] = useState<Tab>('plans')

  // Plans
  const [plans, setPlans] = useState<TrainingPlan[]>([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [editId, setEditId] = useState<number | null>(null)

  const [formName, setFormName] = useState('')
  const [formDesc, setFormDesc] = useState('')
  const [formLevel, setFormLevel] = useState('beginner')
  const [formWeeks, setFormWeeks] = useState('4')
  const [formGoal, setFormGoal] = useState('')
  const [formIsTemplate, setFormIsTemplate] = useState(true)

  // Assignments
  const [assignments, setAssignments] = useState<(UserTrainingPlan & { plan?: { name: string }; user?: { full_name: string } })[]>([])
  const [assignModalOpen, setAssignModalOpen] = useState(false)
  const [assignSaving, setAssignSaving] = useState(false)
  const [assignPlanId, setAssignPlanId] = useState('')
  const [assignUserId, setAssignUserId] = useState('')
  const [assignStart, setAssignStart] = useState(() => new Date().toISOString().split('T')[0])
  const [allUsers, setAllUsers] = useState<{ value: string; label: string }[]>([])

  // Detail
  const [detailPlan, setDetailPlan] = useState<TrainingPlan | null>(null)

  const loadPlans = useCallback(async () => {
    setLoading(true)
    const supabase = createClient()
    const { data } = await supabase
      .from('nm_training_plans')
      .select('*')
      .eq('club_id', 1)
      .order('created_at', { ascending: false })
    setPlans((data || []) as TrainingPlan[])
    setLoading(false)
  }, [])

  const loadAssignments = useCallback(async () => {
    const supabase = createClient()
    const { data } = await supabase
      .from('nm_user_training_plans')
      .select('*, plan:nm_training_plans(name), user:nm_users(full_name)')
      .order('created_at', { ascending: false })
      .limit(100)
    setAssignments((data || []) as typeof assignments)
  }, [])

  const loadUsers = useCallback(async () => {
    const supabase = createClient()
    const { data } = await supabase
      .from('nm_users')
      .select('id, full_name')
      .order('full_name')
    setAllUsers((data || []).map(u => ({ value: u.id, label: u.full_name || u.id })))
  }, [])

  useEffect(() => { loadPlans(); loadAssignments(); loadUsers() }, [loadPlans, loadAssignments, loadUsers])

  const totalPlans = plans.length
  const templates = plans.filter(p => p.is_template).length
  const activeAssignments = assignments.filter(a => a.status === 'active').length

  function resetForm() {
    setEditId(null); setFormName(''); setFormDesc(''); setFormLevel('beginner')
    setFormWeeks('4'); setFormGoal(''); setFormIsTemplate(true)
  }

  function openEdit(p: TrainingPlan) {
    setEditId(p.id); setFormName(p.name); setFormDesc(p.description || ''); setFormLevel(p.target_level || 'beginner')
    setFormWeeks(String(p.duration_weeks || 4)); setFormGoal(p.goal || ''); setFormIsTemplate(p.is_template)
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
      created_by: user?.id || null,
      target_level: formLevel,
      duration_weeks: Number(formWeeks) || 4,
      goal: formGoal || null,
      schedule: [],
      is_template: formIsTemplate,
      is_active: true,
    }

    const { error } = editId
      ? await supabase.from('nm_training_plans').update(payload).eq('id', editId)
      : await supabase.from('nm_training_plans').insert(payload)

    if (error) toast('error', 'Error: ' + error.message)
    else { toast('success', editId ? 'Plan actualizado' : 'Plan creado'); resetForm(); setModalOpen(false); loadPlans() }
    setSaving(false)
  }

  async function handleDelete(id: number) {
    if (!confirm('¿Eliminar este plan?')) return
    const supabase = createClient()
    await supabase.from('nm_user_training_plans').delete().eq('plan_id', id)
    const { error } = await supabase.from('nm_training_plans').delete().eq('id', id)
    if (error) toast('error', 'Error: ' + error.message)
    else { toast('info', 'Plan eliminado'); loadPlans() }
  }

  async function handleAssign(e: React.FormEvent) {
    e.preventDefault()
    if (!assignPlanId || !assignUserId) return
    setAssignSaving(true)
    const supabase = createClient()
    const { error } = await supabase.from('nm_user_training_plans').insert({
      user_id: assignUserId,
      plan_id: Number(assignPlanId),
      assigned_by: user?.id,
      start_date: assignStart,
      status: 'active',
      progress: {},
    })
    if (error) toast('error', 'Error: ' + error.message)
    else { toast('success', 'Plan asignado al usuario'); setAssignModalOpen(false); setAssignPlanId(''); setAssignUserId(''); loadAssignments() }
    setAssignSaving(false)
  }

  async function removeAssignment(id: number) {
    if (!confirm('¿Quitar asignación?')) return
    const supabase = createClient()
    const { error } = await supabase.from('nm_user_training_plans').delete().eq('id', id)
    if (error) toast('error', 'Error: ' + error.message)
    else { toast('info', 'Asignación eliminada'); loadAssignments() }
  }

  async function updateAssignmentStatus(id: number, status: string) {
    const supabase = createClient()
    await supabase.from('nm_user_training_plans').update({ status }).eq('id', id)
    loadAssignments()
  }

  const tabs: { key: Tab; label: string; icon: React.ReactNode }[] = [
    { key: 'plans', label: 'Planes', icon: <ClipboardList size={16} /> },
    { key: 'assignments', label: 'Asignaciones', icon: <Users size={16} /> },
  ]

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Entrenamiento</h1>
          <p className="text-sm text-slate-400 mt-1">Planes de entrenamiento, rutinas y asignaciones a usuarios</p>
        </div>
        <div className="flex gap-2">
          {tab === 'plans' && (
            <Button onClick={() => { resetForm(); setModalOpen(true) }}>
              <Plus size={16} className="mr-1" /> Nuevo Plan
            </Button>
          )}
          {tab === 'assignments' && (
            <Button onClick={() => setAssignModalOpen(true)}>
              <UserPlus size={16} className="mr-1" /> Asignar Plan
            </Button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-800/50 p-1 rounded-lg w-fit">
        {tabs.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)} className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${tab === t.key ? 'bg-cyan-600 text-white' : 'text-slate-400 hover:text-white'}`}>
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard title="Total Planes" value={totalPlans} icon={<ClipboardList size={20} />} />
        <KpiCard title="Templates" value={templates} icon={<Dumbbell size={20} />} color="#8b5cf6" />
        <KpiCard title="Asignaciones Activas" value={activeAssignments} icon={<Users size={20} />} color="#10b981" />
        <KpiCard title="Usuarios con Plan" value={new Set(assignments.filter(a => a.status === 'active').map(a => a.user_id)).size} icon={<UserPlus size={20} />} color="#06b6d4" />
      </div>

      {tab === 'plans' && (
        <>
          {loading ? (
            <div className="text-center py-12 text-slate-500">Cargando...</div>
          ) : plans.length === 0 ? (
            <Card><div className="text-center py-12 text-slate-500">No hay planes de entrenamiento</div></Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {plans.map(p => (
                <Card key={p.id}>
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-xl bg-indigo-500/10 flex items-center justify-center">
                        <Dumbbell size={24} className="text-indigo-400" />
                      </div>
                      <div>
                        <p className="font-semibold text-white">{p.name}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          {p.target_level && (
                            <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${LEVEL_COLORS[p.target_level] || ''}`}>
                              {LEVEL_OPTIONS.find(l => l.value === p.target_level)?.label}
                            </span>
                          )}
                          {p.is_template && <Badge variant="info">Template</Badge>}
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <button onClick={() => setDetailPlan(p)} className="p-1.5 rounded text-slate-500 hover:text-cyan-400 hover:bg-cyan-500/10"><Eye size={14} /></button>
                      <button onClick={() => openEdit(p)} className="p-1.5 rounded text-slate-500 hover:text-yellow-400 hover:bg-yellow-500/10"><Edit2 size={14} /></button>
                      <button onClick={() => handleDelete(p.id)} className="p-1.5 rounded text-slate-500 hover:text-red-400 hover:bg-red-500/10"><Trash2 size={14} /></button>
                    </div>
                  </div>
                  {p.description && <p className="text-xs text-slate-400 mb-2">{p.description}</p>}
                  <div className="flex items-center gap-4 text-xs text-slate-500">
                    {p.duration_weeks && <span className="flex items-center gap-1"><Calendar size={12} /> {p.duration_weeks} semanas</span>}
                    {p.goal && <span>Meta: {p.goal}</span>}
                  </div>
                </Card>
              ))}
            </div>
          )}
        </>
      )}

      {tab === 'assignments' && (
        <>
          {assignments.length === 0 ? (
            <Card><div className="text-center py-12 text-slate-500">No hay asignaciones</div></Card>
          ) : (
            <Card>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-slate-700">
                      <th className="text-left text-xs font-medium text-slate-400 pb-3 pl-2">Usuario</th>
                      <th className="text-left text-xs font-medium text-slate-400 pb-3">Plan</th>
                      <th className="text-left text-xs font-medium text-slate-400 pb-3">Inicio</th>
                      <th className="text-left text-xs font-medium text-slate-400 pb-3">Estado</th>
                      <th className="text-right text-xs font-medium text-slate-400 pb-3 pr-2">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {assignments.map(a => (
                      <tr key={a.id} className="border-b border-slate-800">
                        <td className="py-3 pl-2 text-sm text-white">{a.user?.full_name || 'Usuario'}</td>
                        <td className="py-3 text-sm text-cyan-400">{a.plan?.name || 'Plan'}</td>
                        <td className="py-3 text-sm text-slate-400">{a.start_date ? new Date(a.start_date).toLocaleDateString('es-ES') : '-'}</td>
                        <td className="py-3">
                          <Badge variant={a.status === 'active' ? 'success' : a.status === 'completed' ? 'info' : 'warning'}>
                            {a.status === 'active' ? 'Activo' : a.status === 'completed' ? 'Completado' : 'Pausado'}
                          </Badge>
                        </td>
                        <td className="py-3 pr-2 text-right">
                          <div className="flex items-center justify-end gap-1">
                            {a.status === 'active' && (
                              <>
                                <button onClick={() => updateAssignmentStatus(a.id, 'paused')} className="px-2 py-1 rounded text-xs text-yellow-400 hover:bg-yellow-500/10">Pausar</button>
                                <button onClick={() => updateAssignmentStatus(a.id, 'completed')} className="px-2 py-1 rounded text-xs text-green-400 hover:bg-green-500/10">Completar</button>
                              </>
                            )}
                            {a.status === 'paused' && (
                              <button onClick={() => updateAssignmentStatus(a.id, 'active')} className="px-2 py-1 rounded text-xs text-green-400 hover:bg-green-500/10">Reactivar</button>
                            )}
                            <button onClick={() => removeAssignment(a.id)} className="p-1 rounded text-slate-500 hover:text-red-400 hover:bg-red-500/10"><Trash2 size={14} /></button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
        </>
      )}

      {/* Plan Modal */}
      <Modal
        open={modalOpen}
        onClose={() => { setModalOpen(false); resetForm() }}
        title={editId ? 'Editar Plan' : 'Nuevo Plan de Entrenamiento'}
        footer={
          <div className="flex items-center gap-3">
            <Button variant="ghost" onClick={() => { setModalOpen(false); resetForm() }}>Cancelar</Button>
            <Button onClick={handleSave} loading={saving}>{editId ? 'Guardar' : 'Crear'}</Button>
          </div>
        }
      >
        <form onSubmit={handleSave} className="space-y-4">
          <Input label="Nombre del plan" value={formName} onChange={e => setFormName(e.target.value)} placeholder="Ej: Plan Pádel Intensivo" required />
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">Descripción</label>
            <textarea value={formDesc} onChange={e => setFormDesc(e.target.value)} placeholder="Descripción del plan..." rows={3} className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:border-cyan-500 focus:outline-none resize-none" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Select label="Nivel" value={formLevel} onChange={e => setFormLevel(e.target.value)} options={LEVEL_OPTIONS} />
            <Input label="Duración (semanas)" type="number" min="1" max="52" value={formWeeks} onChange={e => setFormWeeks(e.target.value)} />
          </div>
          <Input label="Objetivo" value={formGoal} onChange={e => setFormGoal(e.target.value)} placeholder="Ej: Mejorar drive y volea" />
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={formIsTemplate} onChange={e => setFormIsTemplate(e.target.checked)} className="w-4 h-4 rounded bg-slate-900 border-slate-700 text-cyan-600 focus:ring-cyan-500" />
            <span className="text-sm text-slate-300">Es un template reutilizable</span>
          </label>
        </form>
      </Modal>

      {/* Assign Modal */}
      <Modal
        open={assignModalOpen}
        onClose={() => setAssignModalOpen(false)}
        title="Asignar Plan a Usuario"
        footer={
          <div className="flex items-center gap-3">
            <Button variant="ghost" onClick={() => setAssignModalOpen(false)}>Cancelar</Button>
            <Button onClick={handleAssign} loading={assignSaving}>Asignar</Button>
          </div>
        }
      >
        <form onSubmit={handleAssign} className="space-y-4">
          <Select label="Plan" value={assignPlanId} onChange={e => setAssignPlanId(e.target.value)} options={[{ value: '', label: 'Seleccionar plan...' }, ...plans.map(p => ({ value: String(p.id), label: p.name }))]} />
          <Select label="Usuario" value={assignUserId} onChange={e => setAssignUserId(e.target.value)} options={[{ value: '', label: 'Seleccionar usuario...' }, ...allUsers]} />
          <Input label="Fecha de inicio" type="date" value={assignStart} onChange={e => setAssignStart(e.target.value)} />
        </form>
      </Modal>

      {/* Detail Modal */}
      <Modal open={!!detailPlan} onClose={() => setDetailPlan(null)} title={detailPlan?.name || 'Plan'}>
        {detailPlan && (
          <div className="space-y-4">
            {detailPlan.description && <p className="text-sm text-slate-300">{detailPlan.description}</p>}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-slate-900 rounded-lg p-3">
                <p className="text-xs text-slate-500">Nivel</p>
                <p className="text-white font-medium">{LEVEL_OPTIONS.find(l => l.value === detailPlan.target_level)?.label || '-'}</p>
              </div>
              <div className="bg-slate-900 rounded-lg p-3">
                <p className="text-xs text-slate-500">Duración</p>
                <p className="text-white font-medium">{detailPlan.duration_weeks} semanas</p>
              </div>
              <div className="bg-slate-900 rounded-lg p-3 col-span-2">
                <p className="text-xs text-slate-500">Objetivo</p>
                <p className="text-white font-medium">{detailPlan.goal || 'Sin objetivo definido'}</p>
              </div>
            </div>
            <div className="text-xs text-slate-500">
              {detailPlan.is_template ? 'Template reutilizable' : 'Plan personalizado'} — Creado: {new Date(detailPlan.created_at).toLocaleDateString('es-ES')}
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
