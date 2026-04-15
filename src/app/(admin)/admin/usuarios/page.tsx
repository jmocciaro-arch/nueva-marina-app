'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { KpiCard } from '@/components/ui/kpi-card'
import { Modal } from '@/components/ui/modal'
import { useToast } from '@/components/ui/toast'
import {
  Users,
  UserCheck,
  UserX,
  Search,
  RefreshCw,
  Calendar,
  Globe,
  MapPin,
  Phone,
  Mail,
  Clock,
  Upload,
  FileText,
  Shield,
  Home,
  CreditCard,
  Heart,
  StickyNote,
  UserPlus,
  Edit2,
  Activity,
  KeyRound,
  Send,
  Eye,
  EyeOff,
  Dice5,
} from 'lucide-react'
import Link from 'next/link'

// ─────────────────────────────────────────────────────────────
// Tipos
// ─────────────────────────────────────────────────────────────
interface NmUser {
  id: string
  full_name: string | null
  email: string
  phone: string | null
  country: string | null
  city: string | null
  is_active: boolean
  last_login_at: string | null
  created_at: string
  emergency_contact: string | null
  medical_notes: string | null
  document_type: string | null
  document_number: string | null
  address: string | null
  postal_code: string | null
  iban: string | null
  virtuagym_id: string | null
  notes: string | null
  dni: string | null
  current_weight: number | null
  avatar_url: string | null
  birth_date: string | null
  dni_nie: string | null
  padel_position: 'drive' | 'reves' | 'ambos' | null
  padel_level: string | null
  consent_image_use: boolean | null
  consent_data_public: boolean | null
  consent_accepted_at: string | null
  profile_completed_at: string | null
}

interface ClubMember {
  user_id: string
  role: string
}

const ROLE_LABELS: Record<string, string> = {
  owner: 'Propietario',
  admin: 'Administrador',
  staff: 'Staff',
  player: 'Jugador',
}

const ROLE_COLORS: Record<string, 'default' | 'info' | 'success' | 'warning' | 'danger'> = {
  owner: 'danger',
  admin: 'warning',
  staff: 'info',
  player: 'default',
}

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────
function formatDate(iso: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: 'numeric' })
}

function formatDateTime(iso: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('es-AR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function isThisMonth(iso: string) {
  const d = new Date(iso)
  const now = new Date()
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth()
}

function displayName(user: NmUser) {
  return user.full_name?.trim() || user.email
}

function initials(user: NmUser) {
  const name = user.full_name?.trim()
  if (!name) return user.email.charAt(0).toUpperCase()
  const parts = name.split(' ')
  return parts.length >= 2 ? `${parts[0][0]}${parts[1][0]}`.toUpperCase() : name.charAt(0).toUpperCase()
}

// ─────────────────────────────────────────────────────────────
// Página principal
// ─────────────────────────────────────────────────────────────
export default function GestionUsuariosPage() {
  const { toast } = useToast()

  const [users, setUsers] = useState<NmUser[]>([])
  const [members, setMembers] = useState<ClubMember[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterRole, setFilterRole] = useState<string>('all')

  // Modal detalle
  const [detailUser, setDetailUser] = useState<NmUser | null>(null)
  const [toggling, setToggling] = useState(false)
  const [editingRole, setEditingRole] = useState(false)
  const [selectedRole, setSelectedRole] = useState('')

  // Modal crear usuario
  const [createOpen, setCreateOpen] = useState(false)
  const [creating, setCreating] = useState(false)
  const [form, setForm] = useState({
    email: '', password: '', full_name: '', phone: '', role: 'player',
    document_type: '', document_number: '', address: '', postal_code: '',
    emergency_contact: '', medical_notes: '', notes: '',
    dni: '', current_weight: '',
    iban: '',
  })

  // Toggle mostrar/ocultar password en modal crear
  const [showCreatePassword, setShowCreatePassword] = useState(false)

  // Modal cambiar contraseña
  const [passwordModalOpen, setPasswordModalOpen] = useState(false)
  const [passwordTargetUser, setPasswordTargetUser] = useState<NmUser | null>(null)
  const [newPassword, setNewPassword] = useState('')
  const [showNewPassword, setShowNewPassword] = useState(false)
  const [savingPassword, setSavingPassword] = useState(false)
  const [sendingReset, setSendingReset] = useState(false)

  // Modal pedir ficha (GDPR)
  const [fichaOpen, setFichaOpen] = useState(false)
  const [fichaLoading, setFichaLoading] = useState(false)
  const [fichaData, setFichaData] = useState<{ url: string; whatsapp_url: string | null; mailto_url: string | null; target: { full_name: string | null; email: string | null; phone: string | null } } | null>(null)

  // Modal editar usuario
  const [editOpen, setEditOpen] = useState(false)
  const [editing, setEditing] = useState(false)
  const [editForm, setEditForm] = useState({
    full_name: '', phone: '', role: 'player',
    document_type: '', document_number: '', address: '', postal_code: '',
    emergency_contact: '', medical_notes: '', notes: '',
    dni: '', current_weight: '',
    iban: '', virtuagym_id: '',
    birth_date: '', dni_nie: '', padel_position: '' as '' | 'drive' | 'reves' | 'ambos', padel_level: '',
    consent_image_use: null as boolean | null,
    consent_data_public: null as boolean | null,
    avatar_url: null as string | null,
    avatar_base64: null as string | null,
  })
  const [editUserId, setEditUserId] = useState('')
  const [editConsentAcceptedAt, setEditConsentAcceptedAt] = useState<string | null>(null)
  const editFileRef = useRef<HTMLInputElement | null>(null)

  // ─────────────────────────────────────────────────────────────
  // Carga de datos
  // ─────────────────────────────────────────────────────────────
  const loadUsers = useCallback(async () => {
    setLoading(true)
    const supabase = createClient()
    const [usersRes, membersRes] = await Promise.all([
      supabase.from('nm_users').select('id, full_name, email, phone, country, city, is_active, last_login_at, created_at, emergency_contact, medical_notes, document_type, document_number, address, postal_code, iban, virtuagym_id, notes, dni, current_weight, avatar_url, birth_date, dni_nie, padel_position, padel_level, consent_image_use, consent_data_public, consent_accepted_at, profile_completed_at').order('created_at', { ascending: false }),
      supabase.from('nm_club_members').select('user_id, role').eq('club_id', 1).eq('is_active', true),
    ])
    setUsers((usersRes.data ?? []) as NmUser[])
    setMembers((membersRes.data ?? []) as ClubMember[])
    setLoading(false)
  }, [])

  useEffect(() => { loadUsers() }, [loadUsers])

  function getUserRole(userId: string): string {
    return members.find(m => m.user_id === userId)?.role || 'player'
  }

  // ─────────────────────────────────────────────────────────────
  // KPIs
  // ─────────────────────────────────────────────────────────────
  const totalUsers = users.length
  const activeUsers = users.filter(u => u.is_active).length
  const staffCount = members.filter(m => m.role === 'staff' || m.role === 'admin' || m.role === 'owner').length
  const newThisMonth = users.filter(u => isThisMonth(u.created_at)).length

  // ─────────────────────────────────────────────────────────────
  // Filtrado
  // ─────────────────────────────────────────────────────────────
  const filtered = users.filter(u => {
    if (filterRole !== 'all' && getUserRole(u.id) !== filterRole) return false
    if (!search.trim()) return true
    const q = search.toLowerCase()
    return (u.full_name ?? '').toLowerCase().includes(q) || u.email.toLowerCase().includes(q)
  })

  // ─────────────────────────────────────────────────────────────
  // Toggle activo/inactivo
  // ─────────────────────────────────────────────────────────────
  async function toggleActive() {
    if (!detailUser) return
    setToggling(true)
    const supabase = createClient()
    const newValue = !detailUser.is_active
    const { error } = await supabase.from('nm_users').update({ is_active: newValue }).eq('id', detailUser.id)
    if (error) {
      toast('error', 'Error al cambiar el estado')
    } else {
      toast('success', `Usuario ${newValue ? 'activado' : 'desactivado'}`)
      setDetailUser(prev => prev ? { ...prev, is_active: newValue } : null)
      setUsers(prev => prev.map(u => u.id === detailUser.id ? { ...u, is_active: newValue } : u))
    }
    setToggling(false)
  }

  // ─────────────────────────────────────────────────────────────
  // Cambiar rol desde detalle
  // ─────────────────────────────────────────────────────────────
  async function handleChangeRole() {
    if (!detailUser || !selectedRole) return
    setEditingRole(true)
    const res = await fetch('/api/users', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: detailUser.id, role: selectedRole }),
    })
    const data = await res.json()
    if (!res.ok) {
      toast('error', data.error || 'Error cambiando rol')
    } else {
      toast('success', `Rol cambiado a ${ROLE_LABELS[selectedRole]}`)
      setMembers(prev => {
        const exists = prev.find(m => m.user_id === detailUser.id)
        if (exists) return prev.map(m => m.user_id === detailUser.id ? { ...m, role: selectedRole } : m)
        return [...prev, { user_id: detailUser.id, role: selectedRole }]
      })
    }
    setEditingRole(false)
  }

  // ─────────────────────────────────────────────────────────────
  // Crear usuario
  // ─────────────────────────────────────────────────────────────
  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!form.email || !form.password || !form.full_name) {
      toast('error', 'Completá email, contraseña y nombre')
      return
    }
    setCreating(true)
    const res = await fetch('/api/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    const data = await res.json()
    if (!res.ok) {
      toast('error', data.error || 'Error creando usuario')
    } else {
      toast('success', 'Usuario creado correctamente')
      setCreateOpen(false)
      setForm({ email: '', password: '', full_name: '', phone: '', role: 'player', document_type: '', document_number: '', address: '', postal_code: '', emergency_contact: '', medical_notes: '', notes: '', dni: '', current_weight: '', iban: '' })
      loadUsers()
    }
    setCreating(false)
  }

  // ─────────────────────────────────────────────────────────────
  // Editar usuario
  // ─────────────────────────────────────────────────────────────
  function openEdit(user: NmUser) {
    setEditUserId(user.id)
    setEditForm({
      full_name: user.full_name || '',
      phone: user.phone || '',
      role: getUserRole(user.id),
      document_type: user.document_type || '',
      document_number: user.document_number || '',
      address: user.address || '',
      postal_code: user.postal_code || '',
      emergency_contact: user.emergency_contact || '',
      medical_notes: user.medical_notes || '',
      notes: user.notes || '',
      dni: user.dni || '',
      current_weight: user.current_weight?.toString() || '',
      iban: user.iban || '',
      virtuagym_id: user.virtuagym_id || '',
      birth_date: user.birth_date || '',
      dni_nie: user.dni_nie || '',
      padel_position: (user.padel_position as '' | 'drive' | 'reves' | 'ambos') || '',
      padel_level: user.padel_level || '',
      consent_image_use: user.consent_image_use,
      consent_data_public: user.consent_data_public,
      avatar_url: user.avatar_url,
      avatar_base64: null,
    })
    setEditConsentAcceptedAt(user.consent_accepted_at)
    setDetailUser(null)
    setEditOpen(true)
  }

  async function onPickEditAvatar(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    if (!f) return
    if (f.size > 8 * 1024 * 1024) { toast('warning', 'Foto demasiado grande (máx 8MB)'); return }
    const dataUrl = await resizeImageFile(f, 720)
    setEditForm(prev => ({ ...prev, avatar_base64: dataUrl, avatar_url: dataUrl }))
  }

  async function handleEdit(e: React.FormEvent) {
    e.preventDefault()
    setEditing(true)
    // Si no se seleccionó foto nueva pero se quitó, mandamos avatar_url=null
    const payload: Record<string, unknown> = { user_id: editUserId, ...editForm }
    // Si avatar_base64 viene seteado, lo mandamos para que el backend haga upload; si es null y editForm.avatar_url es una URL remota, no tocamos
    if (!editForm.avatar_base64) delete payload.avatar_base64
    const res = await fetch('/api/users', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    const data = await res.json()
    if (!res.ok) {
      toast('error', data.error || 'Error actualizando')
    } else {
      toast('success', 'Usuario actualizado')
      setEditOpen(false)
      loadUsers()
    }
    setEditing(false)
  }

  // ─────────────────────────────────────────────────────────────
  // Gestión de contraseñas
  // ─────────────────────────────────────────────────────────────
  async function handleSendResetEmail() {
    if (!detailUser) return
    if (!confirm(`¿Enviar email de restablecimiento de contraseña a ${detailUser.email}?`)) return
    setSendingReset(true)
    const res = await fetch('/api/users/password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'reset_email', user_id: detailUser.id }),
    })
    const data = await res.json()
    if (!res.ok) {
      toast('error', data.error || 'Error enviando email')
    } else {
      toast('success', data.message || 'Email enviado')
    }
    setSendingReset(false)
  }

  async function handlePedirFicha() {
    if (!detailUser) return
    setFichaLoading(true)
    try {
      const res = await fetch('/api/profile/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: detailUser.id, channel: 'link' }),
      })
      const j = await res.json()
      if (!res.ok) throw new Error(j.error ?? 'Error')
      setFichaData({ url: j.url, whatsapp_url: j.whatsapp_url, mailto_url: j.mailto_url, target: j.target })
      setDetailUser(null)
      setFichaOpen(true)
    } catch (e) {
      toast('error', (e as Error).message)
    } finally {
      setFichaLoading(false)
    }
  }

  function openChangePassword(user: NmUser) {
    setPasswordTargetUser(user)
    setNewPassword('')
    setShowNewPassword(false)
    setDetailUser(null)
    setPasswordModalOpen(true)
  }

  function generateSecurePassword() {
    // Genera password de 12 chars con mayúsculas, minúsculas, números y símbolos
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%'
    let pwd = ''
    const cryptoObj = typeof window !== 'undefined' ? window.crypto : null
    if (cryptoObj) {
      const arr = new Uint32Array(12)
      cryptoObj.getRandomValues(arr)
      for (let i = 0; i < 12; i++) pwd += chars[arr[i] % chars.length]
    } else {
      for (let i = 0; i < 12; i++) pwd += chars[Math.floor(Math.random() * chars.length)]
    }
    setNewPassword(pwd)
    setShowNewPassword(true)
  }

  async function handleChangePassword() {
    if (!passwordTargetUser) return
    if (!newPassword || newPassword.length < 6) {
      toast('error', 'La contraseña debe tener al menos 6 caracteres')
      return
    }
    setSavingPassword(true)
    const res = await fetch('/api/users/password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'set_password',
        user_id: passwordTargetUser.id,
        new_password: newPassword,
      }),
    })
    const data = await res.json()
    if (!res.ok) {
      toast('error', data.error || 'Error cambiando contraseña')
    } else {
      toast('success', data.message || 'Contraseña actualizada')
      setPasswordModalOpen(false)
      setNewPassword('')
      setShowNewPassword(false)
    }
    setSavingPassword(false)
  }

  // ─────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white">Gestión de Usuarios</h1>
          <p className="text-sm text-slate-400 mt-1">Cuentas, roles y permisos</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="primary" size="sm" onClick={() => setCreateOpen(true)}>
            <UserPlus size={14} />
            Nuevo Usuario
          </Button>
          <Link href="/admin/importar">
            <Button variant="secondary" size="sm">
              <Upload size={14} />
              Importar CSV
            </Button>
          </Link>
          <Button variant="secondary" size="sm" onClick={loadUsers} loading={loading}>
            <RefreshCw size={14} />
          </Button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <KpiCard title="Total" value={totalUsers} subtitle="usuarios" icon={<Users size={20} />} color="#06b6d4" />
        <KpiCard title="Activos" value={activeUsers} subtitle="habilitados" icon={<UserCheck size={20} />} color="#22c55e" />
        <KpiCard title="Staff / Admin" value={staffCount} subtitle="con acceso admin" icon={<Shield size={20} />} color="#f59e0b" />
        <KpiCard title="Nuevos" value={newThisMonth} subtitle="este mes" icon={<Calendar size={20} />} color="#8b5cf6" />
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          <input
            type="text"
            placeholder="Buscar por nombre o email..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full rounded-lg border border-slate-600 bg-slate-800 pl-9 pr-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/40 focus:border-cyan-500"
          />
        </div>
        <div className="flex gap-1">
          {['all', 'owner', 'admin', 'staff', 'player'].map(r => (
            <button
              key={r}
              onClick={() => setFilterRole(r)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${filterRole === r ? 'bg-cyan-600 text-white' : 'bg-slate-700/50 text-slate-400 hover:text-white'}`}
            >
              {r === 'all' ? 'Todos' : ROLE_LABELS[r]}
            </button>
          ))}
        </div>
      </div>

      {/* Tabla */}
      <div className="rounded-xl border border-slate-700/50 bg-slate-800/50 overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-slate-400 text-sm">Cargando usuarios...</div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center">
            <p className="text-slate-400 text-sm">
              {search || filterRole !== 'all' ? 'No se encontraron resultados.' : 'No hay usuarios registrados.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-700/60">
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Usuario</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Rol</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider hidden md:table-cell">Teléfono</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Estado</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider hidden lg:table-cell">Registro</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/40">
                {filtered.map(user => {
                  const role = getUserRole(user.id)
                  return (
                    <tr key={user.id} onClick={() => { setDetailUser(user); setSelectedRole(role) }} className="hover:bg-slate-700/30 transition-colors cursor-pointer">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="h-8 w-8 rounded-full bg-slate-700 flex items-center justify-center text-xs font-bold text-cyan-400 shrink-0">{initials(user)}</div>
                          <div className="min-w-0">
                            <p className="font-medium text-white truncate">{displayName(user)}</p>
                            <p className="text-xs text-slate-500 truncate">{user.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={ROLE_COLORS[role] || 'default'}>{ROLE_LABELS[role] || role}</Badge>
                      </td>
                      <td className="px-4 py-3 text-slate-400 hidden md:table-cell">{user.phone ?? '—'}</td>
                      <td className="px-4 py-3">
                        <Badge variant={user.is_active ? 'success' : 'danger'}>{user.is_active ? 'Activo' : 'Inactivo'}</Badge>
                      </td>
                      <td className="px-4 py-3 text-slate-400 text-xs hidden lg:table-cell">{formatDate(user.created_at)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
        {!loading && filtered.length > 0 && (
          <div className="px-4 py-3 border-t border-slate-700/40 text-xs text-slate-500">
            Mostrando {filtered.length} de {totalUsers} usuarios
          </div>
        )}
      </div>

      {/* ─── Modal: Detalle ─── */}
      <Modal
        open={!!detailUser}
        onClose={() => setDetailUser(null)}
        title="Detalle de usuario"
        size="sm"
        footer={
          <>
            <Button variant="secondary" size="sm" onClick={() => setDetailUser(null)}>Cerrar</Button>
            <Button variant="secondary" size="sm" onClick={() => detailUser && openEdit(detailUser)}>
              <Edit2 size={14} /> Editar
            </Button>
            <Button
              variant={detailUser?.is_active ? 'danger' : 'primary'}
              size="sm"
              onClick={toggleActive}
              loading={toggling}
            >
              {detailUser?.is_active ? <><UserX size={14} /> Desactivar</> : <><UserCheck size={14} /> Activar</>}
            </Button>
          </>
        }
      >
        {detailUser && (
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <div className="h-14 w-14 rounded-full bg-slate-700 flex items-center justify-center text-xl font-bold text-cyan-400 shrink-0">{initials(detailUser)}</div>
              <div>
                <p className="text-base font-semibold text-white">{detailUser.full_name?.trim() || '(Sin nombre)'}</p>
                <div className="flex items-center gap-2 mt-1">
                  <Badge variant={detailUser.is_active ? 'success' : 'danger'}>{detailUser.is_active ? 'Activo' : 'Inactivo'}</Badge>
                  <Badge variant={ROLE_COLORS[getUserRole(detailUser.id)] || 'default'}>{ROLE_LABELS[getUserRole(detailUser.id)] || getUserRole(detailUser.id)}</Badge>
                </div>
              </div>
            </div>

            {/* Cambiar rol inline */}
            <div className="flex items-center gap-2 px-3 py-2 bg-slate-700/30 rounded-lg">
              <span className="text-xs text-slate-400">Rol:</span>
              <select
                value={selectedRole}
                onChange={e => setSelectedRole(e.target.value)}
                className="bg-slate-800 border border-slate-600 rounded px-2 py-1 text-sm text-white flex-1"
              >
                <option value="player">Jugador</option>
                <option value="staff">Staff</option>
                <option value="admin">Administrador</option>
                <option value="owner">Propietario</option>
              </select>
              <Button size="sm" onClick={handleChangeRole} loading={editingRole} disabled={selectedRole === getUserRole(detailUser.id)}>
                Cambiar
              </Button>
            </div>

            <div className="rounded-lg bg-slate-700/40 divide-y divide-slate-700/60">
              <DetailRow icon={<Mail size={14} />} label="Email" value={detailUser.email} />
              <DetailRow icon={<Phone size={14} />} label="Teléfono" value={detailUser.phone ?? '—'} />
              <DetailRow icon={<Globe size={14} />} label="País" value={detailUser.country ?? '—'} />
              <DetailRow icon={<MapPin size={14} />} label="Ciudad" value={detailUser.city ?? '—'} />
              <DetailRow icon={<Clock size={14} />} label="Último acceso" value={formatDateTime(detailUser.last_login_at)} />
              <DetailRow icon={<Calendar size={14} />} label="Registro" value={formatDateTime(detailUser.created_at)} />
            </div>

            {(detailUser.document_type || detailUser.address || detailUser.emergency_contact || detailUser.iban || detailUser.notes || detailUser.dni || detailUser.current_weight) && (
              <div className="rounded-lg bg-slate-700/40 divide-y divide-slate-700/60">
                {(detailUser.document_type || detailUser.document_number) && (
                  <DetailRow icon={<FileText size={14} />} label="Documento" value={[detailUser.document_type, detailUser.document_number].filter(Boolean).join(': ') || '—'} />
                )}
                {detailUser.dni && (
                  <DetailRow icon={<FileText size={14} />} label="DNI / NIE" value={detailUser.dni} />
                )}
                {detailUser.current_weight && (
                  <DetailRow icon={<Activity size={14} />} label="Peso" value={`${detailUser.current_weight} kg`} />
                )}
                {detailUser.address && (
                  <DetailRow icon={<Home size={14} />} label="Dirección" value={[detailUser.address, detailUser.postal_code].filter(Boolean).join(', ')} />
                )}
                {detailUser.emergency_contact && (
                  <DetailRow icon={<Heart size={14} />} label="Emergencia" value={detailUser.emergency_contact} />
                )}
                {detailUser.medical_notes && (
                  <DetailRow icon={<Shield size={14} />} label="Médico" value={detailUser.medical_notes} />
                )}
                {detailUser.iban && (
                  <DetailRow icon={<CreditCard size={14} />} label="IBAN" value={detailUser.iban} />
                )}
                {detailUser.notes && (
                  <DetailRow icon={<StickyNote size={14} />} label="Notas" value={detailUser.notes} />
                )}
              </div>
            )}

            <p className="text-xs text-slate-600 font-mono break-all">
              ID: {detailUser.id}{detailUser.virtuagym_id ? ` | VG: ${detailUser.virtuagym_id}` : ''}
            </p>

            {/* Gestión de contraseña */}
            <div className="bg-amber-500/5 border border-amber-500/20 rounded-lg p-3 space-y-2">
              <p className="text-xs font-medium text-amber-400 uppercase flex items-center gap-1.5">
                <KeyRound size={12} /> Contraseña
              </p>
              <p className="text-xs text-slate-500">
                Las contraseñas se guardan hasheadas — no es posible verlas.
                Podés enviar un reset por email o asignar una nueva manualmente.
              </p>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={handleSendResetEmail}
                  loading={sendingReset}
                >
                  <Send size={13} /> Resetear (email)
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => detailUser && openChangePassword(detailUser)}
                >
                  <KeyRound size={13} /> Cambiar manualmente
                </Button>
              </div>
            </div>

            {/* Ficha de jugador (GDPR) */}
            <div className="bg-cyan-500/5 border border-cyan-500/20 rounded-lg p-3 space-y-2">
              <p className="text-xs font-medium text-cyan-400 uppercase flex items-center gap-1.5">
                <FileText size={12} /> Ficha de jugador
              </p>
              {detailUser.profile_completed_at ? (
                <div className="text-xs space-y-1">
                  <p className="text-green-400 flex items-center gap-1">
                    <UserCheck size={12} /> Ficha completada el {formatDateTime(detailUser.profile_completed_at)}
                  </p>
                  <div className="flex flex-wrap gap-2 text-[11px] text-slate-400">
                    <span>Imagen: {detailUser.consent_image_use === true ? '✅ autoriza' : detailUser.consent_image_use === false ? '❌ no autoriza' : '—'}</span>
                    <span>Datos públicos: {detailUser.consent_data_public === true ? '✅ autoriza' : detailUser.consent_data_public === false ? '❌ no autoriza' : '—'}</span>
                  </div>
                  <p className="text-slate-500 pt-1">
                    Regenerá el link si el jugador tiene que actualizar datos. El link viejo queda inválido apenas complete el nuevo.
                  </p>
                </div>
              ) : (
                <p className="text-xs text-slate-500">
                  Generá un link para que el jugador complete foto, DNI, datos y consentimientos desde el celu.
                  El link caduca en 30 días.
                </p>
              )}
              <Button variant="secondary" size="sm" onClick={handlePedirFicha} loading={fichaLoading}>
                <Send size={13} /> {detailUser.profile_completed_at ? 'Regenerar link' : 'Pedir ficha'}
              </Button>
            </div>

            {/* Explicación de roles */}
            <div className="bg-slate-700/20 rounded-lg p-3 text-xs text-slate-500 space-y-1">
              <p className="font-medium text-slate-400">¿Qué puede hacer cada rol?</p>
              <p><span className="text-red-400">Propietario:</span> Acceso total, configuración del club</p>
              <p><span className="text-yellow-400">Administrador:</span> Gestión completa (usuarios, caja, reservas, torneos...)</p>
              <p><span className="text-cyan-400">Staff:</span> Reservas, caja, tienda, comunidad (sin config ni reportes)</p>
              <p><span className="text-slate-300">Jugador:</span> Solo ve su panel de jugador (reservas, torneos, gimnasio...)</p>
            </div>
          </div>
        )}
      </Modal>

      {/* ─── Modal: Crear Usuario ─── */}
      <Modal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Crear nuevo usuario"
        size="md"
        footer={
          <>
            <Button variant="secondary" size="sm" onClick={() => setCreateOpen(false)}>Cancelar</Button>
            <Button variant="primary" size="sm" onClick={handleCreate} loading={creating}>
              <UserPlus size={14} /> Crear Usuario
            </Button>
          </>
        }
      >
        <form onSubmit={handleCreate} className="space-y-4">
          {/* Datos obligatorios */}
          <div className="bg-cyan-500/5 border border-cyan-500/20 rounded-lg p-4 space-y-3">
            <p className="text-xs font-medium text-cyan-400 uppercase">Datos obligatorios</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <FormField label="Nombre completo *" value={form.full_name} onChange={v => setForm(f => ({ ...f, full_name: v }))} placeholder="Juan Pérez" />
              <FormField label="Email *" value={form.email} onChange={v => setForm(f => ({ ...f, email: v }))} placeholder="juan@email.com" type="email" />
              <div>
                <label className="block text-xs text-slate-400 mb-1">Contraseña *</label>
                <div className="relative">
                  <input
                    type={showCreatePassword ? 'text' : 'password'}
                    value={form.password}
                    onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                    placeholder="Mínimo 6 caracteres"
                    className="w-full bg-slate-800 border border-slate-600 rounded-lg pl-3 pr-20 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/40 font-mono"
                  />
                  <div className="absolute right-1 top-1/2 -translate-y-1/2 flex items-center gap-0.5">
                    <button
                      type="button"
                      title="Generar segura"
                      onClick={() => {
                        const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%'
                        let pwd = ''
                        const arr = new Uint32Array(12)
                        window.crypto.getRandomValues(arr)
                        for (let i = 0; i < 12; i++) pwd += chars[arr[i] % chars.length]
                        setForm(f => ({ ...f, password: pwd }))
                        setShowCreatePassword(true)
                      }}
                      className="p-1.5 text-cyan-400 hover:bg-cyan-500/10 rounded"
                    >
                      <Dice5 size={14} />
                    </button>
                    <button
                      type="button"
                      title={showCreatePassword ? 'Ocultar' : 'Mostrar'}
                      onClick={() => setShowCreatePassword(v => !v)}
                      className="p-1.5 text-slate-400 hover:bg-slate-600/30 rounded"
                    >
                      {showCreatePassword ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                  </div>
                </div>
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Rol *</label>
                <select
                  value={form.role}
                  onChange={e => setForm(f => ({ ...f, role: e.target.value }))}
                  className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-cyan-500/40"
                >
                  <option value="player">Jugador</option>
                  <option value="staff">Staff (acceso limitado al admin)</option>
                  <option value="admin">Administrador (acceso completo)</option>
                  <option value="owner">Propietario</option>
                </select>
              </div>
            </div>
          </div>

          {/* Datos opcionales */}
          <div className="bg-slate-700/20 rounded-lg p-4 space-y-3">
            <p className="text-xs font-medium text-slate-400 uppercase">Datos opcionales</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <FormField label="Teléfono" value={form.phone} onChange={v => setForm(f => ({ ...f, phone: v }))} placeholder="+34 600 000 000" />
              <div className="grid grid-cols-2 gap-2">
                <FormField label="Tipo doc." value={form.document_type} onChange={v => setForm(f => ({ ...f, document_type: v }))} placeholder="DNI/NIE" />
                <FormField label="Nro doc." value={form.document_number} onChange={v => setForm(f => ({ ...f, document_number: v }))} placeholder="12345678X" />
              </div>
              <FormField label="Dirección" value={form.address} onChange={v => setForm(f => ({ ...f, address: v }))} placeholder="Calle, número..." />
              <FormField label="Código postal" value={form.postal_code} onChange={v => setForm(f => ({ ...f, postal_code: v }))} placeholder="28001" />
              <FormField label="Contacto emergencia" value={form.emergency_contact} onChange={v => setForm(f => ({ ...f, emergency_contact: v }))} placeholder="Nombre - Teléfono" />
              <FormField label="Notas médicas" value={form.medical_notes} onChange={v => setForm(f => ({ ...f, medical_notes: v }))} placeholder="Alergias, condiciones..." />
              <FormField label="DNI / NIE" value={form.dni} onChange={v => setForm(f => ({ ...f, dni: v }))} placeholder="Documento atleta" />
              <FormField label="Peso actual (kg)" type="number" value={form.current_weight} onChange={v => setForm(f => ({ ...f, current_weight: v }))} placeholder="ej. 75.5" />
              <FormField label="IBAN" value={form.iban} onChange={v => setForm(f => ({ ...f, iban: v }))} placeholder="ES00 0000 0000 00 0000000000" />
            </div>
            <FormField label="Notas internas" value={form.notes} onChange={v => setForm(f => ({ ...f, notes: v }))} placeholder="Notas sobre este usuario..." />
          </div>
        </form>
      </Modal>

      {/* ─── Modal: Editar Usuario ─── */}
      <Modal
        open={editOpen}
        onClose={() => setEditOpen(false)}
        title="Editar usuario"
        size="md"
        footer={
          <>
            <Button variant="secondary" size="sm" onClick={() => setEditOpen(false)}>Cancelar</Button>
            <Button variant="primary" size="sm" onClick={handleEdit} loading={editing}>
              <Edit2 size={14} /> Guardar Cambios
            </Button>
          </>
        }
      >
        <form onSubmit={handleEdit} className="space-y-4">
          {/* Avatar */}
          <div className="flex items-center gap-4 pb-3 border-b border-slate-700/50">
            <div className="w-20 h-20 rounded-full bg-slate-800 border-2 border-slate-700 overflow-hidden flex items-center justify-center shrink-0">
              {editForm.avatar_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={editForm.avatar_url} alt="" className="w-full h-full object-cover" />
              ) : (
                <UserPlus size={24} className="text-slate-500" />
              )}
            </div>
            <div>
              <input ref={editFileRef} type="file" accept="image/jpeg,image/png,image/webp" onChange={onPickEditAvatar} className="hidden" />
              <button
                type="button"
                onClick={() => editFileRef.current?.click()}
                className="px-3 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-medium"
              >
                {editForm.avatar_url ? 'Cambiar foto' : 'Subir foto'}
              </button>
              {editForm.avatar_url && (
                <button
                  type="button"
                  onClick={() => setEditForm(f => ({ ...f, avatar_url: null, avatar_base64: null }))}
                  className="ml-2 px-3 py-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-white text-xs"
                >
                  Quitar
                </button>
              )}
              <p className="text-[11px] text-slate-500 mt-1">Se redimensiona a 720px · máx 8MB</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <FormField label="Nombre completo" value={editForm.full_name} onChange={v => setEditForm(f => ({ ...f, full_name: v }))} />
            <FormField label="Teléfono" value={editForm.phone} onChange={v => setEditForm(f => ({ ...f, phone: v }))} />
            <div>
              <label className="block text-xs text-slate-400 mb-1">Rol</label>
              <select
                value={editForm.role}
                onChange={e => setEditForm(f => ({ ...f, role: e.target.value }))}
                className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-cyan-500/40"
              >
                <option value="player">Jugador</option>
                <option value="staff">Staff</option>
                <option value="admin">Administrador</option>
                <option value="owner">Propietario</option>
              </select>
            </div>
            <FormField label="Fecha de nacimiento" type="date" value={editForm.birth_date} onChange={v => setEditForm(f => ({ ...f, birth_date: v }))} />
            <div className="grid grid-cols-2 gap-2">
              <FormField label="Tipo doc." value={editForm.document_type} onChange={v => setEditForm(f => ({ ...f, document_type: v }))} />
              <FormField label="Nro doc." value={editForm.document_number} onChange={v => setEditForm(f => ({ ...f, document_number: v }))} />
            </div>
            <FormField label="DNI / NIE (España)" value={editForm.dni_nie} onChange={v => setEditForm(f => ({ ...f, dni_nie: v }))} />
            <FormField label="Dirección" value={editForm.address} onChange={v => setEditForm(f => ({ ...f, address: v }))} />
            <FormField label="Código postal" value={editForm.postal_code} onChange={v => setEditForm(f => ({ ...f, postal_code: v }))} />
            <FormField label="Contacto emergencia" value={editForm.emergency_contact} onChange={v => setEditForm(f => ({ ...f, emergency_contact: v }))} />
            <FormField label="Notas médicas" value={editForm.medical_notes} onChange={v => setEditForm(f => ({ ...f, medical_notes: v }))} />
            <FormField label="DNI (interno)" value={editForm.dni} onChange={v => setEditForm(f => ({ ...f, dni: v }))} />
            <FormField label="Peso actual (kg)" type="number" value={editForm.current_weight} onChange={v => setEditForm(f => ({ ...f, current_weight: v }))} />
            <FormField label="IBAN" value={editForm.iban} onChange={v => setEditForm(f => ({ ...f, iban: v }))} placeholder="ES00 0000 0000 00 0000000000" />
            <FormField label="Virtuagym ID" value={editForm.virtuagym_id} onChange={v => setEditForm(f => ({ ...f, virtuagym_id: v }))} placeholder="ID del sistema Virtuagym" />
          </div>

          {/* Pádel */}
          <div className="border-t border-slate-700/50 pt-3 space-y-3">
            <p className="text-xs font-medium text-cyan-400 uppercase">Pádel</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-slate-400 mb-1">Posición</label>
                <div className="grid grid-cols-3 gap-1">
                  {(['drive', 'reves', 'ambos'] as const).map(pos => (
                    <button
                      key={pos}
                      type="button"
                      onClick={() => setEditForm(f => ({ ...f, padel_position: f.padel_position === pos ? '' : pos }))}
                      className={`py-1.5 rounded text-xs font-medium border ${
                        editForm.padel_position === pos ? 'bg-cyan-600 border-cyan-500 text-white' : 'bg-slate-800 border-slate-700 text-slate-300'
                      }`}
                    >
                      {pos === 'drive' ? 'Drive' : pos === 'reves' ? 'Revés' : 'Ambos'}
                    </button>
                  ))}
                </div>
              </div>
              <FormField label="Nivel / categoría" value={editForm.padel_level} onChange={v => setEditForm(f => ({ ...f, padel_level: v }))} />
            </div>
          </div>

          {/* Consentimientos GDPR */}
          <div className="border-t border-slate-700/50 pt-3 space-y-3">
            <p className="text-xs font-medium text-cyan-400 uppercase flex items-center gap-1.5">
              <Shield size={12} /> Consentimientos (RGPD / LOPDGDD)
            </p>
            <ConsentEditToggle
              title="Uso de imagen"
              value={editForm.consent_image_use}
              onChange={v => setEditForm(f => ({ ...f, consent_image_use: v }))}
            />
            <ConsentEditToggle
              title="Datos públicos (nombre + categoría en rankings)"
              value={editForm.consent_data_public}
              onChange={v => setEditForm(f => ({ ...f, consent_data_public: v }))}
            />
            {editConsentAcceptedAt && (
              <p className="text-[11px] text-slate-500">Última firma del jugador: {formatDateTime(editConsentAcceptedAt)}</p>
            )}
          </div>

          <FormField label="Notas internas" value={editForm.notes} onChange={v => setEditForm(f => ({ ...f, notes: v }))} />
        </form>
      </Modal>

      {/* ─── Modal: Cambiar Contraseña ─── */}
      <Modal
        open={passwordModalOpen}
        onClose={() => setPasswordModalOpen(false)}
        title="Cambiar contraseña"
        size="sm"
        footer={
          <>
            <Button variant="secondary" size="sm" onClick={() => setPasswordModalOpen(false)}>
              Cancelar
            </Button>
            <Button variant="primary" size="sm" onClick={handleChangePassword} loading={savingPassword}>
              <KeyRound size={14} /> Guardar contraseña
            </Button>
          </>
        }
      >
        {passwordTargetUser && (
          <div className="space-y-4">
            <div className="bg-slate-700/30 rounded-lg p-3 flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-slate-700 flex items-center justify-center text-sm font-bold text-cyan-400 shrink-0">
                {initials(passwordTargetUser)}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium text-white truncate">
                  {passwordTargetUser.full_name?.trim() || '(Sin nombre)'}
                </p>
                <p className="text-xs text-slate-400 truncate">{passwordTargetUser.email}</p>
              </div>
            </div>

            <div>
              <label className="block text-xs text-slate-400 mb-1">Nueva contraseña *</label>
              <div className="relative">
                <input
                  type={showNewPassword ? 'text' : 'password'}
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  placeholder="Mínimo 6 caracteres"
                  autoFocus
                  className="w-full bg-slate-800 border border-slate-600 rounded-lg pl-3 pr-20 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/40 font-mono"
                />
                <div className="absolute right-1 top-1/2 -translate-y-1/2 flex items-center gap-0.5">
                  <button
                    type="button"
                    title="Generar segura"
                    onClick={generateSecurePassword}
                    className="p-1.5 text-cyan-400 hover:bg-cyan-500/10 rounded"
                  >
                    <Dice5 size={14} />
                  </button>
                  <button
                    type="button"
                    title={showNewPassword ? 'Ocultar' : 'Mostrar'}
                    onClick={() => setShowNewPassword(v => !v)}
                    className="p-1.5 text-slate-400 hover:bg-slate-600/30 rounded"
                  >
                    {showNewPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
              </div>
              <p className="text-[11px] text-slate-500 mt-1.5">
                Tip: usá el dado 🎲 para generar una segura de 12 caracteres.
                Copiala antes de cerrar — después no se puede recuperar.
              </p>
            </div>

            <div className="bg-amber-500/5 border border-amber-500/20 rounded-lg p-3 text-xs text-amber-300/80">
              ⚠️ El usuario va a poder loguearse con esta contraseña inmediatamente.
              Las sesiones activas del usuario NO se cierran automáticamente.
            </div>
          </div>
        )}
      </Modal>

      {/* ─── Modal: Link ficha generado ─── */}
      <Modal
        open={fichaOpen}
        onClose={() => setFichaOpen(false)}
        title="Link de ficha generado"
        size="sm"
        footer={<Button variant="secondary" size="sm" onClick={() => setFichaOpen(false)}>Cerrar</Button>}
      >
        {fichaData && (
          <div className="space-y-3">
            <p className="text-sm text-slate-300">
              Enviale este link a <strong>{fichaData.target.full_name || fichaData.target.email}</strong> — caduca en 30 días.
            </p>

            <div className="bg-slate-800 border border-slate-700 rounded-lg p-2 flex items-center gap-2">
              <input
                readOnly
                value={fichaData.url}
                onClick={e => (e.target as HTMLInputElement).select()}
                className="flex-1 bg-transparent text-xs text-cyan-300 font-mono outline-none"
              />
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(fichaData.url)
                  toast('success', 'Link copiado')
                }}
                className="text-xs px-2 py-1 rounded bg-cyan-600 hover:bg-cyan-500 text-white"
              >
                Copiar
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2">
              {fichaData.whatsapp_url ? (
                <a
                  href={fichaData.whatsapp_url}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center justify-center gap-1.5 py-2 rounded-lg bg-green-600 hover:bg-green-500 text-white text-sm font-medium"
                >
                  <Send size={14} /> WhatsApp
                </a>
              ) : (
                <button disabled className="py-2 rounded-lg bg-slate-800 text-slate-500 text-sm cursor-not-allowed">Sin teléfono</button>
              )}
              {fichaData.mailto_url ? (
                <a
                  href={fichaData.mailto_url}
                  className="flex items-center justify-center gap-1.5 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-sm font-medium"
                >
                  <Mail size={14} /> Email
                </a>
              ) : (
                <button disabled className="py-2 rounded-lg bg-slate-800 text-slate-500 text-sm cursor-not-allowed">Sin email</button>
              )}
            </div>

            <p className="text-[11px] text-slate-500">
              Podés reenviar el mismo link tantas veces quieras. Una vez que el jugador completa la ficha, el link se invalida.
            </p>
          </div>
        )}
      </Modal>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// Componentes auxiliares
// ─────────────────────────────────────────────────────────────
function DetailRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3 px-4 py-2.5">
      <span className="text-slate-500 shrink-0">{icon}</span>
      <span className="text-xs text-slate-400 w-24 shrink-0">{label}</span>
      <span className="text-sm text-white truncate">{value}</span>
    </div>
  )
}

function FormField({ label, value, onChange, placeholder, type = 'text' }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; type?: string }) {
  return (
    <div>
      <label className="block text-xs text-slate-400 mb-1">{label}</label>
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/40"
      />
    </div>
  )
}

function ConsentEditToggle({ title, value, onChange }: { title: string; value: boolean | null; onChange: (v: boolean | null) => void }) {
  return (
    <div className="rounded-lg border border-slate-700 bg-slate-800/30 p-2 flex items-center justify-between gap-2">
      <span className="text-xs text-slate-300">{title}</span>
      <div className="flex gap-1">
        <button type="button" onClick={() => onChange(true)} className={`px-2 py-1 rounded text-xs border ${value === true ? 'bg-green-600 border-green-500 text-white' : 'bg-slate-800 border-slate-700 text-slate-400'}`}>Sí</button>
        <button type="button" onClick={() => onChange(false)} className={`px-2 py-1 rounded text-xs border ${value === false ? 'bg-red-600 border-red-500 text-white' : 'bg-slate-800 border-slate-700 text-slate-400'}`}>No</button>
        <button type="button" onClick={() => onChange(null)} className={`px-2 py-1 rounded text-xs border ${value === null ? 'bg-slate-600 border-slate-500 text-white' : 'bg-slate-800 border-slate-700 text-slate-400'}`}>—</button>
      </div>
    </div>
  )
}

// Redimensiona un File a maxSide px y devuelve data URL JPEG
async function resizeImageFile(file: File, maxSide: number): Promise<string> {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(r.result as string)
    r.onerror = reject
    r.readAsDataURL(file)
  })
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const i = new Image()
    i.onload = () => resolve(i)
    i.onerror = reject
    i.src = dataUrl
  })
  let w = img.width, h = img.height
  if (w > maxSide || h > maxSide) {
    if (w > h) { h = Math.round((h * maxSide) / w); w = maxSide }
    else { w = Math.round((w * maxSide) / h); h = maxSide }
  }
  const canvas = document.createElement('canvas')
  canvas.width = w; canvas.height = h
  canvas.getContext('2d')!.drawImage(img, 0, 0, w, h)
  return canvas.toDataURL('image/jpeg', 0.85)
}
