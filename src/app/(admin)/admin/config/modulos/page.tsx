'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  Layers, AlertTriangle,
  Calendar, Dumbbell, Droplets, ShoppingBag, ScanLine,
  Trophy, Medal, BarChart3, Lightbulb, Banknote, Activity, MessageSquare, Target,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/components/ui/toast'
import { usePermissions } from '@/lib/use-permissions'

const CLUB_ID = 1

interface ClubModule {
  id?: number
  club_id: number
  module_key: string
  is_enabled: boolean
  config?: Record<string, unknown>
}

const ALL_MODULES: { key: string; label: string; description: string; icon: React.ReactNode }[] = [
  { key: 'padel', label: 'Pádel', description: 'Reservas de pistas y torneos/ligas de pádel', icon: <Calendar size={20} className="text-cyan-400" /> },
  { key: 'gym', label: 'Gimnasio', description: 'Membresías, clases y check-ins', icon: <Dumbbell size={20} className="text-cyan-400" /> },
  { key: 'recovery', label: 'Recuperación', description: 'Crio, hidro, masajes, fisio, estiramientos', icon: <Droplets size={20} className="text-cyan-400" /> },
  { key: 'shop', label: 'Tienda', description: 'Catálogo, stock y punto de venta', icon: <ShoppingBag size={20} className="text-cyan-400" /> },
  { key: 'access', label: 'Control de acceso', description: 'Puntos de acceso, credenciales y registro', icon: <ScanLine size={20} className="text-cyan-400" /> },
  { key: 'tournaments', label: 'Torneos', description: 'Organización de torneos', icon: <Trophy size={20} className="text-cyan-400" /> },
  { key: 'leagues', label: 'Ligas', description: 'Ligas y campeonatos', icon: <Medal size={20} className="text-cyan-400" /> },
  { key: 'ranking', label: 'Ranking', description: 'Ranking de jugadores', icon: <BarChart3 size={20} className="text-cyan-400" /> },
  { key: 'cash', label: 'Caja', description: 'Registro de movimientos y turnos de caja', icon: <Banknote size={20} className="text-cyan-400" /> },
  { key: 'reports', label: 'Reportes', description: 'Reportes operativos y financieros', icon: <Activity size={20} className="text-cyan-400" /> },
  { key: 'community', label: 'Comunidad', description: 'Feed social y anuncios', icon: <MessageSquare size={20} className="text-cyan-400" /> },
  { key: 'challenges', label: 'Retos', description: 'Retos y gamificación', icon: <Target size={20} className="text-cyan-400" /> },
  { key: 'innovation', label: 'Innovación', description: 'Laboratorio de funcionalidades experimentales', icon: <Lightbulb size={20} className="text-cyan-400" /> },
]

export default function ModulosPage() {
  const { toast } = useToast()
  const { can, loading: permsLoading } = usePermissions()
  const [modules, setModules] = useState<Map<string, ClubModule>>(new Map())
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<Set<string>>(new Set())

  const load = useCallback(async () => {
    setLoading(true)
    const supabase = createClient()
    const { data, error } = await supabase
      .from('nm_club_modules')
      .select('*')
      .eq('club_id', CLUB_ID)
    if (error) toast('error', 'Error al cargar módulos')
    const m = new Map<string, ClubModule>()
    for (const row of (data as ClubModule[]) || []) m.set(row.module_key, row)
    setModules(m)
    setLoading(false)
  }, [toast])

  useEffect(() => { load() }, [load])

  async function toggle(key: string, nextEnabled: boolean) {
    if (saving.has(key)) return
    setSaving(prev => new Set(prev).add(key))

    const supabase = createClient()
    const existing = modules.get(key)

    // Optimistic
    const next = new Map(modules)
    next.set(key, { ...(existing || { club_id: CLUB_ID, module_key: key }), is_enabled: nextEnabled } as ClubModule)
    setModules(next)

    const { error } = existing?.id
      ? await supabase.from('nm_club_modules').update({ is_enabled: nextEnabled, updated_at: new Date().toISOString() }).eq('id', existing.id)
      : await supabase.from('nm_club_modules').upsert(
          { club_id: CLUB_ID, module_key: key, is_enabled: nextEnabled },
          { onConflict: 'club_id,module_key' },
        )

    if (error) {
      toast('error', `No se pudo actualizar "${key}": ${error.message}`)
      load()
    } else {
      toast('success', `Módulo "${key}" ${nextEnabled ? 'activado' : 'desactivado'}`)
      load()
    }

    setSaving(prev => {
      const nxt = new Set(prev)
      nxt.delete(key)
      return nxt
    })
  }

  if (permsLoading) return <div className="p-8 text-slate-400">Cargando permisos…</div>

  if (!can('config.modules')) {
    return (
      <div className="p-8">
        <Card>
          <div className="flex items-center gap-3 text-amber-400">
            <AlertTriangle size={20} />
            <div>
              <h2 className="text-base font-semibold">Sin permisos</h2>
              <p className="text-sm text-slate-400 mt-1">
                Necesitás <code>config.modules</code> para gestionar módulos del club.
              </p>
            </div>
          </div>
        </Card>
      </div>
    )
  }

  const enabledCount = Array.from(modules.values()).filter(m => m.is_enabled).length

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <Layers className="text-cyan-400" /> Módulos del club
        </h1>
        <p className="text-sm text-slate-400 mt-1">
          Activá o desactivá funcionalidades. Los módulos desactivados ocultan sus rutas en la UI.
        </p>
      </div>

      <Card>
        <div className="flex items-center justify-between mb-4">
          <p className="text-sm text-slate-400">
            <span className="text-white font-medium">{enabledCount}</span> de {ALL_MODULES.length} módulos activos
          </p>
          <Badge variant="cyan">club #{CLUB_ID}</Badge>
        </div>

        {loading ? (
          <div className="p-8 text-center text-slate-400">Cargando módulos…</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {ALL_MODULES.map(mod => {
              const record = modules.get(mod.key)
              // Default: habilitado si no hay registro (comportamiento conservador para no romper instalaciones nuevas)
              const enabled = record?.is_enabled ?? true
              const isBusy = saving.has(mod.key)
              return (
                <div
                  key={mod.key}
                  className={[
                    'rounded-lg border p-4 transition-colors',
                    enabled ? 'bg-cyan-500/5 border-cyan-500/20' : 'bg-slate-800/30 border-slate-700/50',
                  ].join(' ')}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3 min-w-0 flex-1">
                      <div className={['p-2 rounded-lg shrink-0', enabled ? 'bg-cyan-500/15' : 'bg-slate-700/50'].join(' ')}>
                        {mod.icon}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <h3 className="text-sm font-semibold text-white">{mod.label}</h3>
                          <code className="text-[10px] text-slate-500">{mod.key}</code>
                        </div>
                        <p className="text-xs text-slate-400 mt-0.5">{mod.description}</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      disabled={isBusy}
                      onClick={() => toggle(mod.key, !enabled)}
                      className={[
                        'relative inline-flex h-6 w-11 flex-shrink-0 rounded-full border-2 transition-colors',
                        enabled ? 'bg-cyan-600 border-cyan-600' : 'bg-slate-700 border-slate-600',
                        isBusy ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer',
                      ].join(' ')}
                    >
                      <span
                        className={[
                          'inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform mt-0.5',
                          enabled ? 'translate-x-5' : 'translate-x-0.5',
                        ].join(' ')}
                      />
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </Card>
    </div>
  )
}
