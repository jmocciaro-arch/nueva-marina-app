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
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'inactive'>('all')
  const [filterCategory, setFilterCategory] = useState('all')
  const [filterPosition, setFilterPosition] = useState('all')
  const [hideEmpty, setHideEmpty] = useState(true)   // Ocultar sin nombre/email
  const [page, setPage] = useState(1)
  const PAGE_SIZE = 15

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

      // 1) Traer solo miembros marcados como jugadores (is_player=true)
      const { data: membersData, error: membersError } = await supabase
        .from('nm_club_members')
        .select('*')
        .eq('club_id', CLUB_ID)
        .eq('is_player', true)
        .order('joined_at', { ascending: false })

      if (membersError) {
        console.error('Error cargando members:', membersError)
        toast('error', `No se pudieron cargar los socios: ${membersError.message}`)
        return
      }

      if (!membersData || membersData.length === 0) {
        setMembers([])
        return
      }

      // 2) Traer usuarios de esos miembros
      const userIds = [...new Set(membersData.map(m => m.user_id))]
      const { data: usersData } = await supabase
        .from('nm_users')
        .select('*')
        .in('id', userIds)

      const userMap: Record<string, User> = {}
      for (const u of usersData ?? []) userMap[u.id] = u as User

      // 3) Traer player_profiles (opcional — si la tabla existe/tiene acceso)
      const profileMap: Record<string, PlayerProfile> = {}
      try {
        const { data: profilesData } = await supabase
          .from('nm_player_profiles')
          .select('*')
          .in('user_id', userIds)
        for (const p of profilesData ?? []) {
          const pp = p as PlayerProfile
          profileMap[pp.user_id] = pp
        }
      } catch {
        // silenciar: si falla el profile, igual mostramos la lista
      }

      // 4) Combinar
      const rows: MemberRow[] = membersData.map(m => ({
        ...(m as ClubMember),
        user: userMap[m.user_id] ?? ({ id: m.user_id, email: '(sin datos)' } as unknown as User),
        player_profile: profileMap[m.user_id] ?? null,
      }))

      setMembers(rows)
    } catch (err) {
      console.error(err)
      const msg = err instanceof Error ? err.message : String(err)
      toast('error', `No se pudieron cargar los socios: ${msg}`)
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
  const activePlayers = members.filter(m => m.is_active).length
  const inactivePlayers = members.filter(m => !m.is_active).length

  // ─────────────────────────────────────────────────────────────
  // Filtrado por búsqueda
  // ─────────────────────────────────────────────────────────────
  const filtered = members.filter(m => {
    // Sin datos (ocultar por default)
    if (hideEmpty) {
      const hasName = m.user?.full_name && m.user.full_name.trim() !== ''
      const hasEmail = m.user?.email && m.user.email.includes('@')
      if (!hasName && !hasEmail) return false
    }

    // Estado
    if (filterStatus === 'active' && !m.is_active) return false
    if (filterStatus === 'inactive' && m.is_active) return false

    // Categoría (padel_level se guarda como CSV)
    if (filterCategory !== 'all') {
      const userLevel = (m.user as User & { padel_level?: string })?.padel_level
      const levels = userLevel ? userLevel.split(',').map(s => s.trim()) : []
      if (filterCategory === 'none') {
        if (levels.length > 0) return false
      } else {
        if (!levels.includes(filterCategory)) return false
      }
    }

    // Posición
    if (filterPosition !== 'all') {
      const userPos = (m.user as User & { padel_position?: string })?.padel_position
      if (userPos !== filterPosition) return false
    }

    // Búsqueda texto
    if (search.trim()) {
      const q = search.toLowerCase()
      const name = m.user?.full_name ?? `${m.user?.first_name ?? ''} ${m.user?.last_name ?? ''}`.trim()
      if (
        !name.toLowerCase().includes(q) &&
        !(m.user?.email ?? '').toLowerCase().includes(q) &&
        !(m.user?.phone ?? '').includes(q)
      ) return false
    }

    return true
  })

  // Paginación
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const currentPage = Math.min(page, totalPages)
  const paged = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)

  // Reset de página cuando cambian los filtros
  useEffect(() => { setPage(1) }, [search, filterStatus, filterCategory, filterPosition])

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
  async function toggleGymMember(memberId: number, current: boolean) {
    const supabase = createClient()
    const { error } = await supabase
      .from('nm_club_members')
      .update({ is_gym_member: !current })
      .eq('id', memberId)
    if (error) { toast('error', error.message); return }
    toast('success', current ? 'Quitado de socios gym' : 'Habilitado como socio gym')
    loadMembers()
  }

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
        // Ya es miembro: solo marcarlo como jugador
        const { error } = await supabase
          .from('nm_club_members')
          .update({ is_player: true })
          .eq('id', existing.id)
        if (error) throw error
        toast('success', `${foundUser.full_name ?? foundUser.email} ya era miembro · habilitado como jugador`)
      } else {
        const { error } = await supabase
          .from('nm_club_members')
          .insert({
            club_id: CLUB_ID,
            user_id: foundUser.id,
            role: newRole,
            is_active: true,
            is_player: true,
            permissions: [],
          })
        if (error) throw error
        toast('success', `${foundUser.full_name ?? foundUser.email} agregado al club como jugador`)
      }
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
          title="Total jugadores"
          value={totalMembers}
          subtitle="registrados en el club"
          icon={<Users size={20} />}
          color="#06b6d4"
        />
        <KpiCard
          title="Activos"
          value={activePlayers}
          subtitle="con membresía vigente"
          icon={<UserCheck size={20} />}
          color="#22c55e"
        />
        <KpiCard
          title="Inactivos"
          value={inactivePlayers}
          subtitle="sin membresía"
          icon={<ShieldCheck size={20} />}
          color="#f59e0b"
        />
      </div>

      {/* Filtros */}
      <div className="flex flex-col md:flex-row gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
          />
          <input
            type="text"
            placeholder="Buscar por nombre, email o teléfono..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full rounded-lg border border-slate-600 bg-slate-800 pl-9 pr-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/40 focus:border-cyan-500"
          />
        </div>

        <select
          value={filterStatus}
          onChange={e => setFilterStatus(e.target.value as 'all' | 'active' | 'inactive')}
          className="rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-cyan-500/40 focus:border-cyan-500"
        >
          <option value="all">Todos los estados</option>
          <option value="active">Solo activos</option>
          <option value="inactive">Solo inactivos</option>
        </select>

        <select
          value={filterCategory}
          onChange={e => setFilterCategory(e.target.value)}
          className="rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-cyan-500/40 focus:border-cyan-500"
        >
          <option value="all">Todas las categorías</option>
          <option value="Iniciación">Iniciación</option>
          <option value="2ª">2ª</option>
          <option value="3ª">3ª</option>
          <option value="4ª">4ª</option>
          <option value="5ª">5ª</option>
          <option value="6ª">6ª</option>
          <option value="45+">45+</option>
          <option value="50+">50+</option>
          <option value="none">Sin categoría</option>
        </select>

        <select
          value={filterPosition}
          onChange={e => setFilterPosition(e.target.value)}
          className="rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-cyan-500/40 focus:border-cyan-500"
        >
          <option value="all">Cualquier lado</option>
          <option value="drive">Drive</option>
          <option value="reves">Revés</option>
          <option value="ambos">Ambos</option>
        </select>

        {(filterStatus !== 'all' || filterCategory !== 'all' || filterPosition !== 'all' || search) && (
          <button
            onClick={() => { setFilterStatus('all'); setFilterCategory('all'); setFilterPosition('all'); setSearch('') }}
            className="px-3 py-2 text-xs text-slate-400 hover:text-red-400 transition-colors"
          >
            Limpiar
          </button>
        )}

        <label className="flex items-center gap-2 text-xs text-slate-400 cursor-pointer select-none px-3">
          <input
            type="checkbox"
            checked={hideEmpty}
            onChange={e => { setHideEmpty(e.target.checked); setPage(1) }}
            className="w-4 h-4 rounded border-slate-600 bg-slate-800 text-cyan-500 focus:ring-cyan-500/40"
          />
          Ocultar sin datos
        </label>
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
                  <th className="px-4 py-3 text-center text-xs font-medium text-slate-400 uppercase tracking-wider">
                    Gym
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-slate-400 uppercase tracking-wider">
                    Acciones
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/40">
                {paged.map(member => {
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

                      {/* Toggle Gym */}
                      <td className="px-4 py-3 text-center">
                        <button
                          onClick={() => toggleGymMember(member.id, !!(member as ClubMember & { is_gym_member?: boolean }).is_gym_member)}
                          className={`px-2 py-1 text-xs rounded transition-colors ${
                            (member as ClubMember & { is_gym_member?: boolean }).is_gym_member
                              ? 'bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30'
                              : 'bg-slate-700 text-slate-400 hover:bg-slate-600'
                          }`}
                        >
                          {(member as ClubMember & { is_gym_member?: boolean }).is_gym_member ? '✓ Sí' : 'Habilitar'}
                        </button>
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
          <div className="px-4 py-3 border-t border-slate-700/40 flex items-center justify-between flex-wrap gap-2">
            <span className="text-xs text-slate-500">
              Mostrando {(currentPage - 1) * PAGE_SIZE + 1}–{Math.min(currentPage * PAGE_SIZE, filtered.length)} de {filtered.length}
              {hideEmpty ? ' con datos' : ''} · <a href="/admin/usuarios" className="text-cyan-400 hover:underline">Gestionar admins/staff</a>
            </span>

            {totalPages > 1 && (
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setPage(Math.max(1, currentPage - 1))}
                  disabled={currentPage === 1}
                  className="px-2 py-1 text-xs rounded text-slate-400 hover:text-white hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  ← Anterior
                </button>
                <span className="text-xs text-slate-400 px-2">
                  Página {currentPage} de {totalPages}
                </span>
                <button
                  onClick={() => setPage(Math.min(totalPages, currentPage + 1))}
                  disabled={currentPage === totalPages}
                  className="px-2 py-1 text-xs rounded text-slate-400 hover:text-white hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Siguiente →
                </button>
              </div>
            )}
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
