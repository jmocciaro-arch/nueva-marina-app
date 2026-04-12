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
import type { ClubMember, User, PlayerProfile } from '@/types'
import {
  Users,
  UserCheck,
  ShieldCheck,
  Search,
  UserPlus,
  Pencil,
  RefreshCw,
} from 'lucide-react'

const CLUB_ID = 1

// ─────────────────────────────────────────────────────────────
// Tipos compuestos
// ─────────────────────────────────────────────────────────────
type MemberRow = ClubMember & {
  user: User
  player_profile: PlayerProfile | null
}

type RoleType = ClubMember['role']

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────
function roleBadgeVariant(role: RoleType) {
  switch (role) {
    case 'owner':
    case 'admin':
      return 'cyan' as const
    case 'staff':
      return 'info' as const
    case 'coach':
      return 'warning' as const
    default:
      return 'default' as const
  }
}

function roleLabel(role: RoleType) {
  const map: Record<RoleType, string> = {
    owner: 'Dueño',
    admin: 'Admin',
    staff: 'Staff',
    coach: 'Entrenador',
    player: 'Jugador',
    guest: 'Invitado',
  }
  return map[role] ?? role
}

function statusBadgeVariant(isActive: boolean) {
  return isActive ? ('success' as const) : ('danger' as const)
}

// ─────────────────────────────────────────────────────────────
// Página principal
// ─────────────────────────────────────────────────────────────
export default function GestionJugadoresPage() {
  const { toast } = useToast()

  // ── Estado principal ──
  const [members, setMembers] = useState<MemberRow[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  // ── Modal edición ──
  const [editTarget, setEditTarget] = useState<MemberRow | null>(null)
  const [editRole, setEditRole] = useState<RoleType>('player')
  const [editActive, setEditActive] = useState(true)
  const [saving, setSaving] = useState(false)

  // ── Modal agregar miembro ──
  const [showAddModal, setShowAddModal] = useState(false)
  const [searchEmail, setSearchEmail] = useState('')
  const [foundUser, setFoundUser] = useState<User | null>(null)
  const [searchingUser, setSearchingUser] = useState(false)
  const [newRole, setNewRole] = useState<RoleType>('player')
  const [adding, setAdding] = useState(false)

  // ─────────────────────────────────────────────────────────────
  // Carga de datos
  // ─────────────────────────────────────────────────────────────
  const loadMembers = useCallback(async () => {
    setLoading(true)
    try {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('nm_club_members')
        .select(`
          *,
          user:nm_users(*),
          player_profile:nm_player_profiles(*)
        `)
        .eq('club_id', CLUB_ID)
        .order('joined_at', { ascending: false })

      if (error) throw error

      // Supabase devuelve player_profile como array (relación 1-a-1 vía FK)
      const rows: MemberRow[] = (data ?? []).map((row: unknown) => {
        const r = row as Record<string, unknown>
        return {
          ...(r as unknown as ClubMember),
          user: r.user as User,
          player_profile: Array.isArray(r.player_profile)
            ? ((r.player_profile[0] ?? null) as PlayerProfile | null)
            : (r.player_profile as PlayerProfile | null),
        }
      })

      setMembers(rows)
    } catch (err) {
      console.error(err)
      toast('error', 'No se pudieron cargar los miembros')
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => {
    loadMembers()
  }, [loadMembers])

  // ─────────────────────────────────────────────────────────────
  // KPIs derivados
  // ─────────────────────────────────────────────────────────────
  const totalMembers = members.length
  const activePlayers = members.filter(
    m => m.is_active && m.role === 'player'
  ).length
  const staffCount = members.filter(
    m => m.role === 'admin' || m.role === 'staff' || m.role === 'owner' || m.role === 'coach'
  ).length

  // ─────────────────────────────────────────────────────────────
  // Filtrado por búsqueda
  // ─────────────────────────────────────────────────────────────
  const filtered = members.filter(m => {
    if (!search.trim()) return true
    const q = search.toLowerCase()
    const name = m.user?.full_name ?? `${m.user?.first_name ?? ''} ${m.user?.last_name ?? ''}`.trim()
    return (
      name.toLowerCase().includes(q) ||
      (m.user?.email ?? '').toLowerCase().includes(q) ||
      (m.user?.phone ?? '').includes(q) ||
      m.role.includes(q)
    )
  })

  // ─────────────────────────────────────────────────────────────
  // Abrir modal de edición
  // ─────────────────────────────────────────────────────────────
  function openEdit(member: MemberRow) {
    setEditTarget(member)
    setEditRole(member.role)
    setEditActive(member.is_active)
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
        .from('nm_club_members')
        .update({ role: editRole, is_active: editActive })
        .eq('id', editTarget.id)

      if (error) throw error

      toast('success', 'Miembro actualizado correctamente')
      closeEdit()
      loadMembers()
    } catch (err) {
      console.error(err)
      toast('error', 'Error al guardar los cambios')
    } finally {
      setSaving(false)
    }
  }

  // ─────────────────────────────────────────────────────────────
  // Buscar usuario por email (modal agregar)
  // ─────────────────────────────────────────────────────────────
  async function handleSearchUser() {
    if (!searchEmail.trim()) return
    setSearchingUser(true)
    setFoundUser(null)
    try {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('nm_users')
        .select('*')
        .eq('email', searchEmail.trim().toLowerCase())
        .single()

      if (error || !data) {
        toast('warning', 'No se encontró ningún usuario con ese email')
        return
      }
      setFoundUser(data as User)
    } catch (err) {
      console.error(err)
      toast('error', 'Error al buscar el usuario')
    } finally {
      setSearchingUser(false)
    }
  }

  // ─────────────────────────────────────────────────────────────
  // Agregar miembro al club
  // ─────────────────────────────────────────────────────────────
  async function handleAddMember() {
    if (!foundUser) return
    setAdding(true)
    try {
      const supabase = createClient()

      // Verificar si ya es miembro
      const { data: existing } = await supabase
        .from('nm_club_members')
        .select('id')
        .eq('club_id', CLUB_ID)
        .eq('user_id', foundUser.id)
        .maybeSingle()

      if (existing) {
        toast('warning', 'Este usuario ya es miembro del club')
        return
      }

      const { error } = await supabase
        .from('nm_club_members')
        .insert({
          club_id: CLUB_ID,
          user_id: foundUser.id,
          role: newRole,
          is_active: true,
          permissions: [],
        })

      if (error) throw error

      toast('success', `${foundUser.full_name ?? foundUser.email} agregado al club`)
      setShowAddModal(false)
      setSearchEmail('')
      setFoundUser(null)
      setNewRole('player')
      loadMembers()
    } catch (err) {
      console.error(err)
      toast('error', 'Error al agregar el miembro')
    } finally {
      setAdding(false)
    }
  }

  function closeAddModal() {
    setShowAddModal(false)
    setSearchEmail('')
    setFoundUser(null)
    setNewRole('player')
  }

  // ─────────────────────────────────────────────────────────────
  // Opciones de selects
  // ─────────────────────────────────────────────────────────────
  const roleOptions: { value: string; label: string }[] = [
    { value: 'owner', label: 'Dueño' },
    { value: 'admin', label: 'Admin' },
    { value: 'staff', label: 'Staff' },
    { value: 'coach', label: 'Entrenador' },
    { value: 'player', label: 'Jugador' },
    { value: 'guest', label: 'Invitado' },
  ]

  const statusOptions: { value: string; label: string }[] = [
    { value: 'true', label: 'Activo' },
    { value: 'false', label: 'Inactivo' },
  ]

  // ─────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">

      {/* Encabezado */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Gestión de Jugadores</h1>
          <p className="text-sm text-slate-400 mt-1">
            Fichas de socios, roles y estado de membresía
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={loadMembers}
            loading={loading}
          >
            <RefreshCw size={14} />
            Actualizar
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={() => setShowAddModal(true)}
          >
            <UserPlus size={14} />
            Agregar socio
          </Button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <KpiCard
          title="Total socios"
          value={totalMembers}
          subtitle="registrados en el club"
          icon={<Users size={20} />}
          color="#06b6d4"
        />
        <KpiCard
          title="Jugadores activos"
          value={activePlayers}
          subtitle="con membresía vigente"
          icon={<UserCheck size={20} />}
          color="#22c55e"
        />
        <KpiCard
          title="Admins / Staff"
          value={staffCount}
          subtitle="con permisos elevados"
          icon={<ShieldCheck size={20} />}
          color="#f59e0b"
        />
      </div>

      {/* Barra de búsqueda */}
      <div className="relative max-w-sm">
        <Search
          size={16}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
        />
        <input
          type="text"
          placeholder="Buscar por nombre, email o rol..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full rounded-lg border border-slate-600 bg-slate-800 pl-9 pr-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/40 focus:border-cyan-500"
        />
      </div>

      {/* Tabla */}
      <div className="rounded-xl border border-slate-700/50 bg-slate-800/50 overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-slate-400 text-sm">
            Cargando socios...
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center">
            <p className="text-slate-400 text-sm">
              {search ? 'No se encontraron resultados para tu búsqueda.' : 'Todavía no hay socios registrados.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-700/60">
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                    Socio
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                    Email
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider hidden md:table-cell">
                    Teléfono
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                    Rol
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider hidden lg:table-cell">
                    Nivel
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider hidden lg:table-cell">
                    Puntos
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                    Estado
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-slate-400 uppercase tracking-wider">
                    Acciones
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/40">
                {filtered.map(member => {
                  const displayName =
                    (member.user?.full_name ??
                    `${member.user?.first_name ?? ''} ${member.user?.last_name ?? ''}`.trim()) ||
                    '—'
                  const profile = member.player_profile

                  return (
                    <tr
                      key={member.id}
                      className="hover:bg-slate-700/30 transition-colors"
                    >
                      {/* Nombre */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="h-8 w-8 rounded-full bg-slate-700 flex items-center justify-center text-xs font-bold text-cyan-400 shrink-0">
                            {displayName.charAt(0).toUpperCase()}
                          </div>
                          <span className="font-medium text-white">{displayName}</span>
                        </div>
                      </td>

                      {/* Email */}
                      <td className="px-4 py-3 text-slate-300">
                        {member.user?.email ?? '—'}
                      </td>

                      {/* Teléfono */}
                      <td className="px-4 py-3 text-slate-400 hidden md:table-cell">
                        {member.user?.phone ?? '—'}
                      </td>

                      {/* Rol */}
                      <td className="px-4 py-3">
                        <Badge variant={roleBadgeVariant(member.role)}>
                          {roleLabel(member.role)}
                        </Badge>
                      </td>

                      {/* Nivel */}
                      <td className="px-4 py-3 text-slate-300 hidden lg:table-cell">
                        {profile?.level != null ? (
                          <span className="font-mono">{profile.level.toFixed(1)}</span>
                        ) : (
                          <span className="text-slate-500">—</span>
                        )}
                      </td>

                      {/* Ranking points */}
                      <td className="px-4 py-3 hidden lg:table-cell">
                        {profile?.ranking_points != null ? (
                          <span className="font-mono text-cyan-400">
                            {profile.ranking_points.toLocaleString('es-AR')}
                          </span>
                        ) : (
                          <span className="text-slate-500">—</span>
                        )}
                      </td>

                      {/* Estado */}
                      <td className="px-4 py-3">
                        <Badge variant={statusBadgeVariant(member.is_active)}>
                          {member.is_active ? 'Activo' : 'Inactivo'}
                        </Badge>
                      </td>

                      {/* Acciones */}
                      <td className="px-4 py-3 text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openEdit(member)}
                        >
                          <Pencil size={13} />
                          Editar
                        </Button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Footer con conteo */}
        {!loading && filtered.length > 0 && (
          <div className="px-4 py-3 border-t border-slate-700/40 text-xs text-slate-500">
            Mostrando {filtered.length} de {totalMembers} socios
          </div>
        )}
      </div>

      {/* ─── Modal: Editar miembro ─── */}
      <Modal
        open={!!editTarget}
        onClose={closeEdit}
        title="Editar socio"
        size="sm"
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
            {/* Info del socio */}
            <div className="rounded-lg bg-slate-700/40 px-4 py-3">
              <p className="text-sm font-medium text-white">
                {(editTarget.user?.full_name ??
                  `${editTarget.user?.first_name ?? ''} ${editTarget.user?.last_name ?? ''}`.trim()) ||
                  '—'}
              </p>
              <p className="text-xs text-slate-400 mt-0.5">{editTarget.user?.email ?? '—'}</p>
            </div>

            {/* Rol */}
            <Select
              id="edit-role"
              label="Rol"
              value={editRole}
              options={roleOptions}
              onChange={e => setEditRole(e.target.value as RoleType)}
            />

            {/* Estado */}
            <Select
              id="edit-status"
              label="Estado de membresía"
              value={editActive ? 'true' : 'false'}
              options={statusOptions}
              onChange={e => setEditActive(e.target.value === 'true')}
            />
          </div>
        )}
      </Modal>

      {/* ─── Modal: Agregar socio ─── */}
      <Modal
        open={showAddModal}
        onClose={closeAddModal}
        title="Agregar nuevo socio"
        size="sm"
        footer={
          <>
            <Button variant="secondary" size="sm" onClick={closeAddModal} disabled={adding}>
              Cancelar
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={handleAddMember}
              loading={adding}
              disabled={!foundUser}
            >
              Agregar al club
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <p className="text-sm text-slate-400">
            Buscá al usuario por su email registrado en la plataforma.
          </p>

          {/* Búsqueda */}
          <div className="flex gap-2">
            <div className="flex-1">
              <Input
                id="search-email"
                placeholder="correo@ejemplo.com"
                type="email"
                value={searchEmail}
                onChange={e => {
                  setSearchEmail(e.target.value)
                  setFoundUser(null)
                }}
                onKeyDown={e => {
                  if (e.key === 'Enter') handleSearchUser()
                }}
              />
            </div>
            <Button
              variant="secondary"
              size="md"
              onClick={handleSearchUser}
              loading={searchingUser}
            >
              <Search size={14} />
            </Button>
          </div>

          {/* Usuario encontrado */}
          {foundUser && (
            <div className="rounded-lg border border-cyan-500/30 bg-cyan-500/10 px-4 py-3 space-y-1">
              <p className="text-sm font-medium text-white">
                {(foundUser.full_name ??
                  `${foundUser.first_name ?? ''} ${foundUser.last_name ?? ''}`.trim()) ||
                  foundUser.email}
              </p>
              <p className="text-xs text-slate-400">{foundUser.email}</p>
              {foundUser.phone && (
                <p className="text-xs text-slate-400">{foundUser.phone}</p>
              )}
            </div>
          )}

          {/* Rol a asignar */}
          <Select
            id="new-role"
            label="Rol a asignar"
            value={newRole}
            options={roleOptions}
            onChange={e => setNewRole(e.target.value as RoleType)}
          />
        </div>
      </Modal>
    </div>
  )
}
