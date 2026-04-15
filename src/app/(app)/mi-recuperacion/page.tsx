'use client'

import { useState, useCallback, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/lib/auth-context'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card } from '@/components/ui/card'
import { Modal } from '@/components/ui/modal'
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/components/ui/toast'
import {
  Droplets, Snowflake, HandHelping, Activity, Stethoscope,
  Plus, Clock, Calendar, XCircle
} from 'lucide-react'
import type { RecoverySession } from '@/types'

const SELECT_CLS = 'w-full rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-cyan-500/40 focus:border-cyan-500'

const TYPE_META: Record<RecoverySession['type'], { label: string; icon: React.ReactNode; color: string; desc: string }> = {
  crio: { label: 'Crioterapia', icon: <Snowflake size={16} />, color: 'bg-cyan-500/15 text-cyan-400', desc: 'Terapia de frío para recuperación muscular' },
  hidro: { label: 'Hidroterapia', icon: <Droplets size={16} />, color: 'bg-blue-500/15 text-blue-400', desc: 'Baños de contraste e inmersión' },
  masaje: { label: 'Masaje', icon: <HandHelping size={16} />, color: 'bg-purple-500/15 text-purple-400', desc: 'Masaje deportivo o descontracturante' },
  estiramiento: { label: 'Estiramiento', icon: <Activity size={16} />, color: 'bg-green-500/15 text-green-400', desc: 'Sesión guiada de movilidad y flexibilidad' },
  fisio: { label: 'Fisioterapia', icon: <Stethoscope size={16} />, color: 'bg-orange-500/15 text-orange-400', desc: 'Tratamiento con fisioterapeuta' },
}

const STATUS_META: Record<RecoverySession['status'], { label: string; color: string }> = {
  scheduled: { label: 'Agendada', color: 'bg-yellow-500/15 text-yellow-400' },
  completed: { label: 'Completada', color: 'bg-green-500/15 text-green-400' },
  cancelled: { label: 'Cancelada', color: 'bg-red-500/15 text-red-400' },
  no_show: { label: 'No presentado', color: 'bg-slate-500/15 text-slate-400' },
}

export default function MiRecuperacionPage() {
  const { user } = useAuth()
  const { toast } = useToast()
  const [sessions, setSessions] = useState<RecoverySession[]>([])
  const [loading, setLoading] = useState(true)

  const [modalOpen, setModalOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    type: 'masaje' as RecoverySession['type'],
    scheduled_at: '',
    duration_minutes: 30,
    notes: '',
  })

  const loadSessions = useCallback(async () => {
    if (!user) return
    setLoading(true)
    const supabase = createClient()
    const { data } = await supabase
      .from('nm_recovery_sessions')
      .select('*')
      .eq('user_id', user.id)
      .eq('club_id', 1)
      .order('scheduled_at', { ascending: false })
      .limit(100)
    setSessions((data || []) as unknown as RecoverySession[])
    setLoading(false)
  }, [user])

  useEffect(() => { loadSessions() }, [loadSessions])

  function openCreate() {
    setForm({
      type: 'masaje',
      scheduled_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 16),
      duration_minutes: 30,
      notes: '',
    })
    setModalOpen(true)
  }

  async function requestSession() {
    if (!user) return
    if (!form.scheduled_at) {
      toast('error', 'Elegí fecha y hora')
      return
    }
    setSaving(true)
    const supabase = createClient()
    const { error } = await supabase.from('nm_recovery_sessions').insert({
      club_id: 1,
      user_id: user.id,
      type: form.type,
      scheduled_at: new Date(form.scheduled_at).toISOString(),
      duration_minutes: form.duration_minutes,
      notes: form.notes || null,
    })
    setSaving(false)
    if (error) {
      toast('error', `Error al solicitar sesión: ${error.message}`)
      return
    }
    toast('success', 'Sesión solicitada — te vamos a confirmar el turno')
    setModalOpen(false)
    loadSessions()
  }

  async function cancelSession(id: number) {
    if (!confirm('¿Cancelar esta sesión?')) return
    const supabase = createClient()
    const { error } = await supabase
      .from('nm_recovery_sessions')
      .update({ status: 'cancelled' })
      .eq('id', id)
    if (error) {
      toast('error', error.message)
      return
    }
    toast('success', 'Sesión cancelada')
    loadSessions()
  }

  const upcoming = sessions.filter(s => s.status === 'scheduled' && new Date(s.scheduled_at) >= new Date())
  const history = sessions.filter(s => !upcoming.includes(s))

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Droplets className="text-cyan-400" /> Mi Recuperación
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Reservá sesiones de crio, hidro, masajes, fisio y estiramientos
          </p>
        </div>
        <Button onClick={openCreate} className="bg-cyan-600 hover:bg-cyan-700">
          <Plus size={16} /> Solicitar sesión
        </Button>
      </div>

      {/* Types grid */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {(Object.entries(TYPE_META) as [RecoverySession['type'], typeof TYPE_META[RecoverySession['type']]][]).map(([k, m]) => (
          <Card key={k} className="p-4">
            <div className={`inline-flex items-center gap-1.5 px-2 py-1 rounded text-xs ${m.color}`}>
              {m.icon} {m.label}
            </div>
            <p className="text-xs text-slate-400 mt-2">{m.desc}</p>
          </Card>
        ))}
      </div>

      {/* Upcoming */}
      <div>
        <h2 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
          <Calendar size={18} /> Próximas sesiones
        </h2>
        <Card>
          {loading ? (
            <div className="p-8 text-center text-slate-400">Cargando...</div>
          ) : upcoming.length === 0 ? (
            <div className="p-8 text-center text-slate-400">No tenés sesiones próximas</div>
          ) : (
            <div className="divide-y divide-slate-700">
              {upcoming.map(s => {
                const meta = TYPE_META[s.type]
                const st = STATUS_META[s.status]
                const date = new Date(s.scheduled_at)
                return (
                  <div key={s.id} className="p-4 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded text-xs ${meta.color} shrink-0`}>
                        {meta.icon} {meta.label}
                      </span>
                      <div className="min-w-0">
                        <div className="text-white text-sm flex items-center gap-1.5">
                          <Clock size={14} className="text-slate-500" />
                          {date.toLocaleDateString('es-ES', { weekday: 'short', day: '2-digit', month: '2-digit' })}{' '}
                          {date.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
                        </div>
                        <div className="text-xs text-slate-400">{s.duration_minutes} min{s.notes ? ` · ${s.notes}` : ''}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge className={st.color}>{st.label}</Badge>
                      <button
                        onClick={() => cancelSession(s.id)}
                        className="p-1.5 text-red-400 hover:bg-red-500/10 rounded"
                        title="Cancelar"
                      >
                        <XCircle size={16} />
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </Card>
      </div>

      {/* History */}
      <div>
        <h2 className="text-lg font-semibold text-white mb-3">Historial</h2>
        <Card>
          {loading ? (
            <div className="p-8 text-center text-slate-400">Cargando...</div>
          ) : history.length === 0 ? (
            <div className="p-8 text-center text-slate-400">Sin historial todavía</div>
          ) : (
            <div className="divide-y divide-slate-700">
              {history.map(s => {
                const meta = TYPE_META[s.type]
                const st = STATUS_META[s.status]
                const date = new Date(s.scheduled_at)
                return (
                  <div key={s.id} className="p-4 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded text-xs ${meta.color} shrink-0`}>
                        {meta.icon} {meta.label}
                      </span>
                      <div className="min-w-0">
                        <div className="text-white text-sm">
                          {date.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' })}{' '}
                          {date.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
                        </div>
                        <div className="text-xs text-slate-400">{s.duration_minutes} min</div>
                      </div>
                    </div>
                    <Badge className={st.color}>{st.label}</Badge>
                  </div>
                )
              })}
            </div>
          )}
        </Card>
      </div>

      {/* Modal solicitar */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Solicitar sesión de recuperación">
        <div className="space-y-4">
          <div>
            <label className="block text-xs text-slate-400 mb-1">Tipo</label>
            <select className={SELECT_CLS} value={form.type} onChange={e => setForm({ ...form, type: e.target.value as RecoverySession['type'] })}>
              {Object.entries(TYPE_META).map(([k, m]) => (
                <option key={k} value={k}>{m.label}</option>
              ))}
            </select>
            <p className="text-xs text-slate-500 mt-1">{TYPE_META[form.type].desc}</p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-slate-400 mb-1">Fecha y hora</label>
              <Input type="datetime-local" value={form.scheduled_at} onChange={e => setForm({ ...form, scheduled_at: e.target.value })} />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Duración (min)</label>
              <select className={SELECT_CLS} value={String(form.duration_minutes)} onChange={e => setForm({ ...form, duration_minutes: Number(e.target.value) })}>
                <option value="15">15 min</option>
                <option value="30">30 min</option>
                <option value="45">45 min</option>
                <option value="60">60 min</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">Notas (opcional)</label>
            <Input placeholder="Zona a tratar, molestias, preferencias..." value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} />
          </div>
          <p className="text-xs text-slate-500">
            Tu solicitud queda como <strong>agendada</strong>. El staff del club te confirma el turno.
          </p>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={() => setModalOpen(false)}>Cancelar</Button>
            <Button onClick={requestSession} disabled={saving} className="bg-cyan-600 hover:bg-cyan-700">
              {saving ? 'Solicitando...' : 'Solicitar'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
