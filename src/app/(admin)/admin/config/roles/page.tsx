'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  ShieldCheck, Users, Lock, Plus, Trash2, Edit3, Save, X,
  Check, AlertTriangle, Search,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card } from '@/components/ui/card'
import { Modal } from '@/components/ui/modal'
import { Badge } from '@/components/ui/badge'
import { KpiCard } from '@/components/ui/kpi-card'
import { useToast } from '@/components/ui/toast'
import { usePermissions } from '@/lib/use-permissions'

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface Role {
  id: number
  club_id: number | null
  name: string
  slug: string
  is_system: boolean
  permissions?: string[] // legacy (array-col)
}

interface Permission {
  id: number
  key: string
  module: string
  description: string | null
}

interface RolePermissionRow {
  role_id: number
  permission_key: string
}

const CLUB_ID = 1

// Módulos conocidos → etiqueta y orden
const MODULE_ORDER: Record<string, number> = {
  dashboard: 1,
  agenda: 2,
  padel: 3,
  courts: 4,
  tournaments: 5,
  leagues: 6,
  ranking: 7,
  gym: 8,
  training: 9,
  recovery: 10,
  access: 11,
  shop: 12,
  cash: 13,
  billing: 14,
  subscriptions: 15,
  finance: 16,
  pricing: 17,
  users: 18,
  members: 19,
  staff: 20,
  coaches: 21,
  community: 22,
  reports: 23,
  config: 24,
}

const MODULE_LABEL: Record<string, string> = {
  dashboard: 'Dashboard',
  agenda: 'Agenda unificada',
  padel: 'Pádel & reservas',
  courts: 'Pistas',
  tournaments: 'Torneos',
  leagues: 'Ligas',
  ranking: 'Ranking',
  gym: 'Gimnasio',
  training: 'Entrenamiento',
  recovery: 'Recuperación',
  access: 'Control de acceso',
  shop: 'Tienda',
  cash: 'Caja',
  billing: 'Facturación',
  subscriptions: 'Suscripciones',
  finance: 'Finanzas',
  pricing: 'Reglas de precios',
  users: 'Usuarios',
  members: 'Miembros',
  staff: 'Staff',
  coaches: 'Entrenadores',
  community: 'Comunidad',
  reports: 'Reportes',
  config: 'Configuración',
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function RolesPermisosPage() {
  const { toast } = useToast()
  const { can, loading: permsLoading } = usePermissions()

  const [roles, setRoles] = useState<Role[]>([])
  const [permissions, setPermissions] = useState<Permission[]>([])
  const [matrix, setMatrix] = useState<Map<number, Set<string>>>(new Map())
  const [loading, setLoading] = useState(true)
  const [selectedRoleId, setSelectedRoleId] = useState<number | null>(null)
  const [search, setSearch] = useState('')

  // Modales
  const [createOpen, setCreateOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [createForm, setCreateForm] = useState({ name: '', slug: '' })
  const [editForm, setEditForm] = useState({ id: 0, name: '', slug: '' })
  const [saving, setSaving] = useState(false)

  // Toggling en curso (por role+key) para feedback inmediato
  const [toggling, setToggling] = useState<Set<string>>(new Set())

  // ─── Load ────────────────────────────────────────────────────────────────────

  const loadAll = useCallback(async () => {
    setLoading(true)
    const supabase = createClient()

    const [rolesRes, permsRes, rpRes] = await Promise.all([
      supabase.from('nm_roles').select('*').order('is_system', { ascending: false }).order('name'),
      supabase.from('nm_permissions').select('*').order('module').order('key'),
      supabase.from('nm_role_permissions').select('role_id, permission_key'),
    ])

    if (rolesRes.error) toast('error', 'Error al cargar roles')
    if (permsRes.error) toast('error', 'Error al cargar permisos')
    if (rpRes.error) toast('error', 'Error al cargar matriz rol-permiso')

    const rolesData = (rolesRes.data as Role[]) || []
    setRoles(rolesData)
    setPermissions((permsRes.data as Permission[]) || [])

    const m = new Map<number, Set<string>>()
    for (const r of rolesData) m.set(r.id, new Set())
    for (const row of (rpRes.data as RolePermissionRow[]) || []) {
      if (!m.has(row.role_id)) m.set(row.role_id, new Set())
      m.get(row.role_id)!.add(row.permission_key)
    }
    setMatrix(m)

    // Seleccionar primer rol por defecto
    if (!selectedRoleId && rolesData.length > 0) {
      setSelectedRoleId(rolesData[0].id)
    }
    setLoading(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [toast])

  useEffect(() => { loadAll() }, [loadAll])

  // ─── Derived ─────────────────────────────────────────────────────────────────

  const selectedRole = useMemo(
    () => roles.find(r => r.id === selectedRoleId) || null,
    [roles, selectedRoleId],
  )

  const permsByModule = useMemo(() => {
    const filtered = search
      ? permissions.filter(p =>
          p.key.toLowerCase().includes(search.toLowerCase()) ||
          (p.description || '').toLowerCase().includes(search.toLowerCase()))
      : permissions
    const grouped: Record<string, Permission[]> = {}
    for (const p of filtered) {
      if (!grouped[p.module]) grouped[p.module] = []
      grouped[p.module].push(p)
    }
    const sortedKeys = Object.keys(grouped).sort(
      (a, b) => (MODULE_ORDER[a] ?? 99) - (MODULE_ORDER[b] ?? 99),
    )
    return sortedKeys.map(k => ({ module: k, items: grouped[k] }))
  }, [permissions, search])

  const selectedKeys = selectedRoleId ? matrix.get(selectedRoleId) : new Set<string>()

  const kpiTotalRoles = roles.length
  const kpiTotalPerms = permissions.length
  const kpiSystemRoles = roles.filter(r => r.is_system).length

  // ─── Toggle permission ───────────────────────────────────────────────────────

  async function togglePerm(roleId: number, key: string, hasIt: boolean) {
    const sig = `${roleId}:${key}`
    if (toggling.has(sig)) return

    const role = roles.find(r => r.id === roleId)
    if (!role) return

    // Los is_system owner/admin tienen acceso * — bloquear edición para evitar confusión
    if (role.is_system && (role.slug === 'owner' || role.slug === 'admin')) {
      toast('warning', `Rol "${role.name}" tiene acceso completo por diseño (no editable)`)
      return
    }

    setToggling(prev => new Set(prev).add(sig))

    // Optimistic update
    const next = new Map(matrix)
    const set = new Set<string>(next.get(roleId) ?? [])
    if (hasIt) set.delete(key)
    else set.add(key)
    next.set(roleId, set)
    setMatrix(next)

    const supabase = createClient()
    const { error } = hasIt
      ? await supabase.from('nm_role_permissions').delete().eq('role_id', roleId).eq('permission_key', key)
      : await supabase.from('nm_role_permissions').insert({ role_id: roleId, permission_key: key })

    if (error) {
      toast('error', `No se pudo ${hasIt ? 'quitar' : 'asignar'} el permiso: ${error.message}`)
      // Revert
      const rev = new Map(matrix)
      setMatrix(rev)
    }

    setToggling(prev => {
      const nxt = new Set(prev)
      nxt.delete(sig)
      return nxt
    })
  }

  // ─── Crear rol ───────────────────────────────────────────────────────────────

  async function openCreate() {
    setCreateForm({ name: '', slug: '' })
    setCreateOpen(true)
  }

  async function saveCreate() {
    if (!createForm.name.trim() || !createForm.slug.trim()) {
      toast('warning', 'Nombre y slug son obligatorios')
      return
    }
    if (!/^[a-z0-9_]+$/.test(createForm.slug)) {
      toast('warning', 'El slug solo puede tener minúsculas, números y guión bajo')
      return
    }
    setSaving(true)
    const supabase = createClient()
    const { data, error } = await supabase
      .from('nm_roles')
      .insert({
        club_id: CLUB_ID,
        name: createForm.name.trim(),
        slug: createForm.slug.trim(),
        is_system: false,
      })
      .select()
      .single()
    setSaving(false)
    if (error) {
      toast('error', `No se pudo crear el rol: ${error.message}`)
      return
    }
    toast('success', `Rol "${createForm.name}" creado`)
    setCreateOpen(false)
    await loadAll()
    if (data) setSelectedRoleId((data as Role).id)
  }

  // ─── Editar rol ──────────────────────────────────────────────────────────────

  function openEdit(r: Role) {
    if (r.is_system) {
      toast('warning', 'Los roles del sistema no pueden renombrarse')
      return
    }
    setEditForm({ id: r.id, name: r.name, slug: r.slug })
    setEditOpen(true)
  }

  async function saveEdit() {
    if (!editForm.name.trim()) {
      toast('warning', 'El nombre es obligatorio')
      return
    }
    setSaving(true)
    const supabase = createClient()
    const { error } = await supabase
      .from('nm_roles')
      .update({ name: editForm.name.trim(), slug: editForm.slug.trim() })
      .eq('id', editForm.id)
    setSaving(false)
    if (error) {
      toast('error', `No se pudo actualizar: ${error.message}`)
      return
    }
    toast('success', 'Rol actualizado')
    setEditOpen(false)
    loadAll()
  }

  // ─── Eliminar rol ────────────────────────────────────────────────────────────

  async function remove(r: Role) {
    if (r.is_system) {
      toast('warning', 'No se pueden eliminar roles del sistema')
      return
    }
    if (!confirm(`¿Eliminar el rol "${r.name}"? Los miembros asignados perderán este rol.`)) return
    const supabase = createClient()
    const { error } = await supabase.from('nm_roles').delete().eq('id', r.id)
    if (error) {
      toast('error', `No se pudo eliminar: ${error.message}`)
      return
    }
    toast('success', `Rol "${r.name}" eliminado`)
    if (selectedRoleId === r.id) setSelectedRoleId(null)
    loadAll()
  }

  // ─── Bulk: asignar/quitar todos los permisos de un módulo ───────────────────

  async function bulkModule(roleId: number, moduleKey: string, assign: boolean) {
    const role = roles.find(r => r.id === roleId)
    if (!role) return
    if (role.is_system && (role.slug === 'owner' || role.slug === 'admin')) {
      toast('warning', `Rol "${role.name}" tiene acceso completo por diseño`)
      return
    }
    const keys = permissions.filter(p => p.module === moduleKey).map(p => p.key)
    const current = matrix.get(roleId) || new Set()
    const supabase = createClient()

    if (assign) {
      const toAdd = keys.filter(k => !current.has(k))
      if (toAdd.length === 0) return
      const { error } = await supabase
        .from('nm_role_permissions')
        .insert(toAdd.map(k => ({ role_id: roleId, permission_key: k })))
      if (error) {
        toast('error', `Error al asignar bulk: ${error.message}`)
        return
      }
      toast('success', `${toAdd.length} permisos de "${MODULE_LABEL[moduleKey] ?? moduleKey}" asignados`)
    } else {
      const toRemove = keys.filter(k => current.has(k))
      if (toRemove.length === 0) return
      const { error } = await supabase
        .from('nm_role_permissions')
        .delete()
        .eq('role_id', roleId)
        .in('permission_key', toRemove)
      if (error) {
        toast('error', `Error al quitar bulk: ${error.message}`)
        return
      }
      toast('success', `${toRemove.length} permisos de "${MODULE_LABEL[moduleKey] ?? moduleKey}" quitados`)
    }
    loadAll()
  }

  // ─── Guard de permisos ───────────────────────────────────────────────────────

  if (permsLoading) {
    return <div className="p-8 text-slate-400">Cargando permisos…</div>
  }

  if (!can('config.roles')) {
    return (
      <div className="p-8">
        <Card>
          <div className="flex items-center gap-3 text-amber-400">
            <AlertTriangle size={20} />
            <div>
              <h2 className="text-base font-semibold">Sin permisos</h2>
              <p className="text-sm text-slate-400 mt-1">
                Necesitás el permiso <code>config.roles</code> para acceder a esta sección.
              </p>
            </div>
          </div>
        </Card>
      </div>
    )
  }

  const isSuperRole = selectedRole?.is_system && (selectedRole.slug === 'owner' || selectedRole.slug === 'admin')

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <ShieldCheck className="text-cyan-400" /> Roles & Permisos
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Matriz de permisos por rol · fuente de verdad de todo el control de acceso
          </p>
        </div>
        <Button onClick={openCreate} className="bg-cyan-600 hover:bg-cyan-700">
          <Plus size={16} /> Nuevo rol
        </Button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <KpiCard title="Roles" value={kpiTotalRoles} icon={<Users size={20} />} color="#06b6d4" />
        <KpiCard title="Permisos disponibles" value={kpiTotalPerms} icon={<Lock size={20} />} color="#8b5cf6" />
        <KpiCard title="Roles del sistema" value={kpiSystemRoles} icon={<ShieldCheck size={20} />} color="#10b981" />
      </div>

      {loading ? (
        <div className="p-8 text-center text-slate-400">Cargando…</div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-4">
          {/* ── Lista de roles ── */}
          <Card>
            <h3 className="text-sm font-semibold text-white mb-3">Roles</h3>
            <div className="space-y-1">
              {roles.length === 0 && (
                <p className="text-xs text-slate-500">No hay roles definidos</p>
              )}
              {roles.map(r => {
                const count = matrix.get(r.id)?.size ?? 0
                const isActive = selectedRoleId === r.id
                const superR = r.is_system && (r.slug === 'owner' || r.slug === 'admin')
                return (
                  <div
                    key={r.id}
                    className={[
                      'group rounded-lg border px-3 py-2 cursor-pointer transition-colors',
                      isActive
                        ? 'border-cyan-500/50 bg-cyan-500/10'
                        : 'border-slate-700/50 bg-slate-800/30 hover:bg-slate-800/60',
                    ].join(' ')}
                    onClick={() => setSelectedRoleId(r.id)}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className={['text-sm font-medium truncate', isActive ? 'text-white' : 'text-slate-200'].join(' ')}>
                            {r.name}
                          </p>
                          {r.is_system && (
                            <Badge variant="default">sistema</Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-2 mt-0.5">
                          <code className="text-[10px] text-slate-500">{r.slug}</code>
                          <span className="text-[10px] text-cyan-400">
                            {superR ? 'acceso total' : `${count} permisos`}
                          </span>
                        </div>
                      </div>
                      {!r.is_system && (
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={e => { e.stopPropagation(); openEdit(r) }}
                            className="p-1 text-blue-400 hover:bg-blue-500/10 rounded"
                            title="Editar"
                          >
                            <Edit3 size={13} />
                          </button>
                          <button
                            onClick={e => { e.stopPropagation(); remove(r) }}
                            className="p-1 text-red-400 hover:bg-red-500/10 rounded"
                            title="Eliminar"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </Card>

          {/* ── Matriz de permisos ── */}
          <Card>
            {!selectedRole ? (
              <div className="p-8 text-center text-slate-400">
                Seleccioná un rol para ver su matriz de permisos
              </div>
            ) : (
              <>
                <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                  <div>
                    <h3 className="text-base font-semibold text-white flex items-center gap-2">
                      {selectedRole.name}
                      {selectedRole.is_system && <Badge variant="default">sistema</Badge>}
                      {isSuperRole && <Badge variant="success">acceso total</Badge>}
                    </h3>
                    <p className="text-xs text-slate-400 mt-0.5">
                      <code>{selectedRole.slug}</code> · {selectedKeys?.size ?? 0} permisos asignados
                    </p>
                  </div>
                  <div className="flex items-center gap-2 flex-1 max-w-xs">
                    <Search size={14} className="text-slate-500" />
                    <Input
                      placeholder="Buscar permiso…"
                      value={search}
                      onChange={e => setSearch(e.target.value)}
                      className="w-full"
                    />
                  </div>
                </div>

                {isSuperRole && (
                  <div className="mb-4 p-3 rounded-lg bg-green-500/10 border border-green-500/20 text-xs text-green-300 flex items-center gap-2">
                    <ShieldCheck size={14} />
                    Este rol tiene acceso completo (<code>*</code>) por diseño — la matriz es solo informativa.
                  </div>
                )}

                <div className="space-y-4">
                  {permsByModule.length === 0 && (
                    <p className="text-sm text-slate-500">No hay permisos que coincidan con "{search}"</p>
                  )}
                  {permsByModule.map(({ module, items }) => {
                    const roleKeys = selectedKeys || new Set<string>()
                    const moduleKeys = items.map(i => i.key)
                    const allAssigned = moduleKeys.every(k => roleKeys.has(k))
                    const noneAssigned = moduleKeys.every(k => !roleKeys.has(k))

                    return (
                      <div key={module} className="rounded-lg border border-slate-700/50 overflow-hidden">
                        <div className="flex items-center justify-between bg-slate-800/60 px-4 py-2">
                          <div className="flex items-center gap-2">
                            <h4 className="text-sm font-semibold text-white">
                              {MODULE_LABEL[module] ?? module}
                            </h4>
                            <span className="text-[10px] text-slate-500">
                              {items.filter(i => roleKeys.has(i.key)).length}/{items.length}
                            </span>
                          </div>
                          {!isSuperRole && (
                            <div className="flex items-center gap-1">
                              <button
                                disabled={allAssigned}
                                onClick={() => bulkModule(selectedRole.id, module, true)}
                                className="text-[11px] px-2 py-0.5 rounded text-cyan-400 hover:bg-cyan-500/10 disabled:opacity-30 disabled:cursor-not-allowed"
                              >
                                Todos
                              </button>
                              <button
                                disabled={noneAssigned}
                                onClick={() => bulkModule(selectedRole.id, module, false)}
                                className="text-[11px] px-2 py-0.5 rounded text-slate-400 hover:bg-slate-500/10 disabled:opacity-30 disabled:cursor-not-allowed"
                              >
                                Ninguno
                              </button>
                            </div>
                          )}
                        </div>
                        <div className="divide-y divide-slate-700/30">
                          {items.map(p => {
                            const has = roleKeys.has(p.key) || isSuperRole
                            const sig = `${selectedRole.id}:${p.key}`
                            const isBusy = toggling.has(sig)
                            return (
                              <div
                                key={p.key}
                                className="flex items-center justify-between px-4 py-2 hover:bg-slate-800/30"
                              >
                                <div className="min-w-0 flex-1">
                                  <div className="flex items-center gap-2">
                                    <code className="text-xs text-cyan-400">{p.key}</code>
                                  </div>
                                  {p.description && (
                                    <p className="text-xs text-slate-500 mt-0.5">{p.description}</p>
                                  )}
                                </div>
                                <button
                                  type="button"
                                  disabled={isBusy || isSuperRole}
                                  onClick={() => togglePerm(selectedRole.id, p.key, roleKeys.has(p.key))}
                                  className={[
                                    'relative inline-flex h-5 w-10 flex-shrink-0 rounded-full border transition-colors',
                                    has
                                      ? 'bg-cyan-600 border-cyan-500'
                                      : 'bg-slate-700 border-slate-600',
                                    (isBusy || isSuperRole) ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer',
                                  ].join(' ')}
                                  title={has ? 'Quitar permiso' : 'Asignar permiso'}
                                >
                                  <span
                                    className={[
                                      'absolute top-0.5 w-3.5 h-3.5 rounded-full bg-white shadow transition-transform',
                                      has ? 'translate-x-5' : 'translate-x-0.5',
                                    ].join(' ')}
                                  />
                                </button>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </>
            )}
          </Card>
        </div>
      )}

      {/* ── Modal crear ── */}
      <Modal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Nuevo rol"
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setCreateOpen(false)}>
              <X size={14} /> Cancelar
            </Button>
            <Button loading={saving} onClick={saveCreate}>
              <Save size={14} /> Crear rol
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Input
            id="role-name"
            label="Nombre *"
            placeholder="Ej: Recepción fin de semana"
            value={createForm.name}
            onChange={e => setCreateForm(f => ({
              ...f,
              name: e.target.value,
              slug: f.slug || e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, ''),
            }))}
          />
          <Input
            id="role-slug"
            label="Slug *"
            placeholder="ej: recepcion_weekend"
            value={createForm.slug}
            onChange={e => setCreateForm(f => ({ ...f, slug: e.target.value.toLowerCase() }))}
          />
          <p className="text-xs text-slate-500">
            El slug es el identificador interno (se asigna a los miembros vía <code>nm_club_members.role</code>).
            Solo minúsculas, números y guión bajo.
          </p>
        </div>
      </Modal>

      {/* ── Modal editar ── */}
      <Modal
        open={editOpen}
        onClose={() => setEditOpen(false)}
        title="Editar rol"
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setEditOpen(false)}>
              <X size={14} /> Cancelar
            </Button>
            <Button loading={saving} onClick={saveEdit}>
              <Check size={14} /> Guardar
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Input
            id="edit-role-name"
            label="Nombre *"
            value={editForm.name}
            onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))}
          />
          <Input
            id="edit-role-slug"
            label="Slug"
            value={editForm.slug}
            onChange={e => setEditForm(f => ({ ...f, slug: e.target.value.toLowerCase() }))}
          />
          <div className="text-xs text-amber-400/80 flex items-start gap-2">
            <AlertTriangle size={12} className="mt-0.5 shrink-0" />
            <span>
              Cambiar el slug puede romper referencias existentes en <code>nm_club_members.role</code>.
              Si ya hay miembros asignados, actualizá esos registros también.
            </span>
          </div>
        </div>
      </Modal>
    </div>
  )
}
