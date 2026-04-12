'use client'

import { useCallback, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { KpiCard } from '@/components/ui/kpi-card'
import { Modal } from '@/components/ui/modal'
import { useToast } from '@/components/ui/toast'
import {
  Lightbulb,
  ThumbsUp,
  CheckCircle,
  Clock,
  Plus,
  RefreshCw,
  MessageSquare,
  Calendar,
  User,
} from 'lucide-react'

const CLUB_ID = 1

// ─────────────────────────────────────────────────────────────
// Tipos
// ─────────────────────────────────────────────────────────────
type IdeaStatus = 'submitted' | 'reviewing' | 'approved' | 'rejected' | 'done'
type IdeaPriority = 'low' | 'medium' | 'high'
type IdeaCategory = 'mejora' | 'bug' | 'feature' | 'otro'

interface IdeaRow {
  id: number
  club_id: number
  submitted_by: string
  title: string
  description: string
  category: IdeaCategory
  status: IdeaStatus
  assigned_to: string | null
  priority: IdeaPriority
  votes: number
  comments: unknown
  created_at: string
  submitter_name?: string
}

type FilterTab = 'todas' | IdeaStatus

// ─────────────────────────────────────────────────────────────
// Helpers de estilo
// ─────────────────────────────────────────────────────────────
function statusVariant(status: IdeaStatus) {
  switch (status) {
    case 'submitted': return 'info' as const
    case 'reviewing': return 'warning' as const
    case 'approved': return 'success' as const
    case 'rejected': return 'danger' as const
    case 'done': return 'cyan' as const
  }
}

function statusLabel(status: IdeaStatus) {
  const map: Record<IdeaStatus, string> = {
    submitted: 'Enviada',
    reviewing: 'En revisión',
    approved: 'Aprobada',
    rejected: 'Rechazada',
    done: 'Completada',
  }
  return map[status]
}

function priorityVariant(priority: IdeaPriority) {
  switch (priority) {
    case 'high': return 'danger' as const
    case 'medium': return 'warning' as const
    case 'low': return 'success' as const
  }
}

function priorityLabel(priority: IdeaPriority) {
  const map: Record<IdeaPriority, string> = {
    high: 'Alta',
    medium: 'Media',
    low: 'Baja',
  }
  return map[priority]
}

function categoryLabel(category: IdeaCategory) {
  const map: Record<IdeaCategory, string> = {
    mejora: 'Mejora',
    bug: 'Bug',
    feature: 'Feature',
    otro: 'Otro',
  }
  return map[category]
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('es-AR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

// ─────────────────────────────────────────────────────────────
// Página principal
// ─────────────────────────────────────────────────────────────
export default function InnovacionPage() {
  const { toast } = useToast()

  // ── Estado principal ──
  const [ideas, setIdeas] = useState<IdeaRow[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<FilterTab>('todas')

  // ── Modal detalle / edición ──
  const [editTarget, setEditTarget] = useState<IdeaRow | null>(null)
  const [editStatus, setEditStatus] = useState<IdeaStatus>('submitted')
  const [editPriority, setEditPriority] = useState<IdeaPriority>('medium')
  const [editAssigned, setEditAssigned] = useState('')
  const [saving, setSaving] = useState(false)

  // ── Modal nueva idea ──
  const [showNewModal, setShowNewModal] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [newDescription, setNewDescription] = useState('')
  const [newCategory, setNewCategory] = useState<IdeaCategory>('feature')
  const [creating, setCreating] = useState(false)

  // ─────────────────────────────────────────────────────────────
  // Carga de datos
  // ─────────────────────────────────────────────────────────────
  const loadIdeas = useCallback(async () => {
    setLoading(true)
    try {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('nm_innovation_ideas')
        .select(`
          *,
          submitter:nm_users!submitted_by(full_name)
        `)
        .eq('club_id', CLUB_ID)
        .order('created_at', { ascending: false })

      if (error) throw error

      const rows: IdeaRow[] = (data ?? []).map((row: unknown) => {
        const r = row as Record<string, unknown>
        const submitter = r.submitter as Record<string, unknown> | null
        return {
          ...(r as unknown as IdeaRow),
          submitter_name: (submitter?.full_name as string | undefined) ?? 'Desconocido',
        }
      })

      setIdeas(rows)
    } catch (err) {
      console.error(err)
      toast('error', 'No se pudieron cargar las ideas')
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => {
    loadIdeas()
  }, [loadIdeas])

  // ─────────────────────────────────────────────────────────────
  // KPIs derivados
  // ─────────────────────────────────────────────────────────────
  const totalIdeas = ideas.length
  const submittedCount = ideas.filter(i => i.status === 'submitted').length
  const approvedCount = ideas.filter(i => i.status === 'approved').length
  const doneCount = ideas.filter(i => i.status === 'done').length

  // ─────────────────────────────────────────────────────────────
  // Filtrado por tab
  // ─────────────────────────────────────────────────────────────
  const filtered = activeTab === 'todas'
    ? ideas
    : ideas.filter(i => i.status === activeTab)

  // ─────────────────────────────────────────────────────────────
  // Tabs
  // ─────────────────────────────────────────────────────────────
  const tabs: { key: FilterTab; label: string; count: number }[] = [
    { key: 'todas', label: 'Todas', count: totalIdeas },
    { key: 'submitted', label: 'Enviadas', count: submittedCount },
    { key: 'reviewing', label: 'En revisión', count: ideas.filter(i => i.status === 'reviewing').length },
    { key: 'approved', label: 'Aprobadas', count: approvedCount },
    { key: 'rejected', label: 'Rechazadas', count: ideas.filter(i => i.status === 'rejected').length },
    { key: 'done', label: 'Completadas', count: doneCount },
  ]

  // ─────────────────────────────────────────────────────────────
  // Abrir modal edición
  // ─────────────────────────────────────────────────────────────
  function openEdit(idea: IdeaRow) {
    setEditTarget(idea)
    setEditStatus(idea.status)
    setEditPriority(idea.priority)
    setEditAssigned(idea.assigned_to ?? '')
  }

  function closeEdit() {
    setEditTarget(null)
  }

  // ─────────────────────────────────────────────────────────────
  // Guardar edición
  // ─────────────────────────────────────────────────────────────
  async function saveEdit() {
    if (!editTarget) return
    setSaving(true)
    try {
      const supabase = createClient()
      const { error } = await supabase
        .from('nm_innovation_ideas')
        .update({
          status: editStatus,
          priority: editPriority,
          assigned_to: editAssigned.trim() || null,
        })
        .eq('id', editTarget.id)

      if (error) throw error

      toast('success', 'Idea actualizada correctamente')
      closeEdit()
      loadIdeas()
    } catch (err) {
      console.error(err)
      toast('error', 'Error al guardar los cambios')
    } finally {
      setSaving(false)
    }
  }

  // ─────────────────────────────────────────────────────────────
  // Crear nueva idea
  // ─────────────────────────────────────────────────────────────
  async function handleCreateIdea() {
    if (!newTitle.trim() || !newDescription.trim()) {
      toast('warning', 'Completá el título y la descripción')
      return
    }
    setCreating(true)
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('No autenticado')

      const { error } = await supabase
        .from('nm_innovation_ideas')
        .insert({
          club_id: CLUB_ID,
          submitted_by: user.id,
          title: newTitle.trim(),
          description: newDescription.trim(),
          category: newCategory,
          status: 'submitted' as IdeaStatus,
          priority: 'medium' as IdeaPriority,
          votes: 0,
          comments: [],
        })

      if (error) throw error

      toast('success', 'Idea enviada correctamente')
      setShowNewModal(false)
      setNewTitle('')
      setNewDescription('')
      setNewCategory('feature')
      loadIdeas()
    } catch (err) {
      console.error(err)
      toast('error', 'Error al crear la idea')
    } finally {
      setCreating(false)
    }
  }

  function closeNewModal() {
    setShowNewModal(false)
    setNewTitle('')
    setNewDescription('')
    setNewCategory('feature')
  }

  // ─────────────────────────────────────────────────────────────
  // Opciones de selects
  // ─────────────────────────────────────────────────────────────
  const statusOptions = [
    { value: 'submitted', label: 'Enviada' },
    { value: 'reviewing', label: 'En revisión' },
    { value: 'approved', label: 'Aprobada' },
    { value: 'rejected', label: 'Rechazada' },
    { value: 'done', label: 'Completada' },
  ]

  const priorityOptions = [
    { value: 'low', label: 'Baja' },
    { value: 'medium', label: 'Media' },
    { value: 'high', label: 'Alta' },
  ]

  const categoryOptions = [
    { value: 'mejora', label: 'Mejora' },
    { value: 'bug', label: 'Bug' },
    { value: 'feature', label: 'Feature' },
    { value: 'otro', label: 'Otro' },
  ]

  // ─────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">

      {/* Encabezado */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Innovación</h1>
          <p className="text-sm text-slate-400 mt-1">
            Ideas, mejoras y funcionalidades propuestas por el equipo
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" onClick={loadIdeas} loading={loading}>
            <RefreshCw size={14} />
            Actualizar
          </Button>
          <Button variant="primary" size="sm" onClick={() => setShowNewModal(true)}>
            <Plus size={14} />
            Nueva idea
          </Button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <KpiCard
          title="Total ideas"
          value={totalIdeas}
          subtitle="acumuladas"
          icon={<Lightbulb size={20} />}
          color="#06b6d4"
        />
        <KpiCard
          title="Enviadas"
          value={submittedCount}
          subtitle="pendientes de revisión"
          icon={<Clock size={20} />}
          color="#f59e0b"
        />
        <KpiCard
          title="Aprobadas"
          value={approvedCount}
          subtitle="en cola de desarrollo"
          icon={<ThumbsUp size={20} />}
          color="#22c55e"
        />
        <KpiCard
          title="Completadas"
          value={doneCount}
          subtitle="ya implementadas"
          icon={<CheckCircle size={20} />}
          color="#8b5cf6"
        />
      </div>

      {/* Tabs de filtro */}
      <div className="flex gap-1 overflow-x-auto pb-1">
        {tabs.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`
              flex items-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-medium transition-colors
              ${activeTab === tab.key
                ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30'
                : 'text-slate-400 hover:text-white hover:bg-slate-700/50 border border-transparent'}
            `}
          >
            {tab.label}
            <span className={`
              rounded-full px-1.5 py-0.5 text-xs
              ${activeTab === tab.key ? 'bg-cyan-500/30 text-cyan-300' : 'bg-slate-700 text-slate-500'}
            `}>
              {tab.count}
            </span>
          </button>
        ))}
      </div>

      {/* Grid de cards */}
      {loading ? (
        <div className="rounded-xl border border-slate-700/50 bg-slate-800/50 p-12 text-center text-slate-400 text-sm">
          Cargando ideas...
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-slate-700/50 bg-slate-800/50 p-12 text-center">
          <p className="text-slate-400 text-sm">No hay ideas en esta categoría todavía.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map(idea => (
            <div
              key={idea.id}
              onClick={() => openEdit(idea)}
              className="group rounded-xl border border-slate-700/50 bg-slate-800/50 p-5 cursor-pointer hover:border-cyan-500/40 hover:bg-slate-800 transition-all"
            >
              {/* Cabecera */}
              <div className="flex items-start justify-between gap-2 mb-3">
                <h3 className="font-semibold text-white text-sm leading-snug line-clamp-2 group-hover:text-cyan-300 transition-colors">
                  {idea.title}
                </h3>
                <Badge variant={priorityVariant(idea.priority)} className="shrink-0">
                  {priorityLabel(idea.priority)}
                </Badge>
              </div>

              {/* Descripción */}
              <p className="text-xs text-slate-400 line-clamp-2 mb-4">
                {idea.description}
              </p>

              {/* Badges */}
              <div className="flex flex-wrap gap-1.5 mb-4">
                <Badge variant="default">
                  {categoryLabel(idea.category)}
                </Badge>
                <Badge variant={statusVariant(idea.status)}>
                  {statusLabel(idea.status)}
                </Badge>
              </div>

              {/* Footer de la card */}
              <div className="flex items-center justify-between text-xs text-slate-500 border-t border-slate-700/50 pt-3">
                <div className="flex items-center gap-1">
                  <User size={11} />
                  <span className="truncate max-w-[100px]">{idea.submitter_name}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="flex items-center gap-1">
                    <ThumbsUp size={11} />
                    {idea.votes}
                  </span>
                  {Array.isArray(idea.comments) && (
                    <span className="flex items-center gap-1">
                      <MessageSquare size={11} />
                      {(idea.comments as unknown[]).length}
                    </span>
                  )}
                  <span className="flex items-center gap-1">
                    <Calendar size={11} />
                    {formatDate(idea.created_at)}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ─── Modal: Editar idea ─── */}
      <Modal
        open={!!editTarget}
        onClose={closeEdit}
        title="Gestionar idea"
        size="md"
        footer={
          <>
            <Button variant="secondary" size="sm" onClick={closeEdit} disabled={saving}>
              Cancelar
            </Button>
            <Button variant="primary" size="sm" onClick={saveEdit} loading={saving}>
              Guardar cambios
            </Button>
          </>
        }
      >
        {editTarget && (
          <div className="space-y-4">
            {/* Info de la idea */}
            <div className="rounded-lg bg-slate-700/40 px-4 py-3 space-y-2">
              <p className="text-sm font-semibold text-white">{editTarget.title}</p>
              <p className="text-xs text-slate-400 leading-relaxed">{editTarget.description}</p>
              <div className="flex flex-wrap gap-1.5 pt-1">
                <Badge variant="default">{categoryLabel(editTarget.category)}</Badge>
                <span className="text-xs text-slate-500 flex items-center gap-1">
                  <User size={11} /> {editTarget.submitter_name}
                </span>
                <span className="text-xs text-slate-500 flex items-center gap-1">
                  <ThumbsUp size={11} /> {editTarget.votes} votos
                </span>
              </div>
            </div>

            {/* Estado */}
            <Select
              id="edit-status"
              label="Estado"
              value={editStatus}
              options={statusOptions}
              onChange={e => setEditStatus(e.target.value as IdeaStatus)}
            />

            {/* Prioridad */}
            <Select
              id="edit-priority"
              label="Prioridad"
              value={editPriority}
              options={priorityOptions}
              onChange={e => setEditPriority(e.target.value as IdeaPriority)}
            />

            {/* Asignado a */}
            <Input
              id="edit-assigned"
              label="Asignado a (ID de usuario, opcional)"
              placeholder="UUID del responsable..."
              value={editAssigned}
              onChange={e => setEditAssigned(e.target.value)}
            />
          </div>
        )}
      </Modal>

      {/* ─── Modal: Nueva idea ─── */}
      <Modal
        open={showNewModal}
        onClose={closeNewModal}
        title="Proponer nueva idea"
        size="md"
        footer={
          <>
            <Button variant="secondary" size="sm" onClick={closeNewModal} disabled={creating}>
              Cancelar
            </Button>
            <Button variant="primary" size="sm" onClick={handleCreateIdea} loading={creating}>
              Enviar idea
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Input
            id="new-title"
            label="Título"
            placeholder="Descripción breve de la idea..."
            value={newTitle}
            onChange={e => setNewTitle(e.target.value)}
          />

          <div className="space-y-1">
            <label
              htmlFor="new-description"
              className="block text-sm font-medium text-slate-300"
            >
              Descripción
            </label>
            <textarea
              id="new-description"
              rows={4}
              placeholder="Explicá en detalle la idea, el problema que resuelve, etc."
              value={newDescription}
              onChange={e => setNewDescription(e.target.value)}
              className="w-full rounded-lg border border-slate-600 bg-slate-700/50 px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/40 focus:border-cyan-500 resize-none"
            />
          </div>

          <Select
            id="new-category"
            label="Categoría"
            value={newCategory}
            options={categoryOptions}
            onChange={e => setNewCategory(e.target.value as IdeaCategory)}
          />
        </div>
      </Modal>
    </div>
  )
}
