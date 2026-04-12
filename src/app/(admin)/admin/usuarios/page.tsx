'use client'

import { useCallback, useEffect, useState } from 'react'
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
  // Virtuagym expansion fields
  emergency_contact: string | null
  medical_notes: string | null
  document_type: string | null
  document_number: string | null
  address: string | null
  postal_code: string | null
  iban: string | null
  virtuagym_id: string | null
  notes: string | null
}

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────
function formatDate(iso: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('es-AR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

function formatDateTime(iso: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('es-AR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
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
  return parts.length >= 2
    ? `${parts[0][0]}${parts[1][0]}`.toUpperCase()
    : name.charAt(0).toUpperCase()
}

// ─────────────────────────────────────────────────────────────
// Página principal
// ─────────────────────────────────────────────────────────────
export default function GestionUsuariosPage() {
  const { toast } = useToast()

  // ── Estado principal ──
  const [users, setUsers] = useState<NmUser[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  // ── Modal detalle ──
  const [detailUser, setDetailUser] = useState<NmUser | null>(null)
  const [toggling, setToggling] = useState(false)

  // ─────────────────────────────────────────────────────────────
  // Carga de datos
  // ─────────────────────────────────────────────────────────────
  const loadUsers = useCallback(async () => {
    setLoading(true)
    try {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('nm_users')
        .select('id, full_name, email, phone, country, city, is_active, last_login_at, created_at, emergency_contact, medical_notes, document_type, document_number, address, postal_code, iban, virtuagym_id, notes')
        .order('created_at', { ascending: false })

      if (error) throw error
      setUsers((data ?? []) as NmUser[])
    } catch (err) {
      console.error(err)
      toast('error', 'No se pudieron cargar los usuarios')
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => {
    loadUsers()
  }, [loadUsers])

  // ─────────────────────────────────────────────────────────────
  // KPIs derivados
  // ─────────────────────────────────────────────────────────────
  const totalUsers = users.length
  const activeUsers = users.filter(u => u.is_active).length
  const newThisMonth = users.filter(u => isThisMonth(u.created_at)).length

  // ─────────────────────────────────────────────────────────────
  // Filtrado por búsqueda
  // ─────────────────────────────────────────────────────────────
  const filtered = users.filter(u => {
    if (!search.trim()) return true
    const q = search.toLowerCase()
    return (
      (u.full_name ?? '').toLowerCase().includes(q) ||
      u.email.toLowerCase().includes(q)
    )
  })

  // ─────────────────────────────────────────────────────────────
  // Abrir modal detalle
  // ─────────────────────────────────────────────────────────────
  function openDetail(user: NmUser) {
    setDetailUser(user)
  }

  function closeDetail() {
    setDetailUser(null)
  }

  // ─────────────────────────────────────────────────────────────
  // Toggle is_active
  // ─────────────────────────────────────────────────────────────
  async function toggleActive() {
    if (!detailUser) return
    setToggling(true)
    try {
      const supabase = createClient()
      const newValue = !detailUser.is_active
      const { error } = await supabase
        .from('nm_users')
        .update({ is_active: newValue })
        .eq('id', detailUser.id)

      if (error) throw error

      const label = newValue ? 'activado' : 'desactivado'
      toast('success', `Usuario ${label} correctamente`)

      // Actualizar estado local sin recargar
      setDetailUser(prev => prev ? { ...prev, is_active: newValue } : null)
      setUsers(prev => prev.map(u => u.id === detailUser.id ? { ...u, is_active: newValue } : u))
    } catch (err) {
      console.error(err)
      toast('error', 'Error al cambiar el estado del usuario')
    } finally {
      setToggling(false)
    }
  }

  // ─────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">

      {/* Encabezado */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Gestión de Usuarios</h1>
          <p className="text-sm text-slate-400 mt-1">
            Cuentas registradas en la plataforma
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/admin/importar">
            <Button variant="secondary" size="sm">
              <Upload size={14} />
              Importar Virtuagym
            </Button>
          </Link>
          <Button variant="secondary" size="sm" onClick={loadUsers} loading={loading}>
            <RefreshCw size={14} />
            Actualizar
          </Button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <KpiCard
          title="Total usuarios"
          value={totalUsers}
          subtitle="registrados en la plataforma"
          icon={<Users size={20} />}
          color="#06b6d4"
        />
        <KpiCard
          title="Usuarios activos"
          value={activeUsers}
          subtitle="con acceso habilitado"
          icon={<UserCheck size={20} />}
          color="#22c55e"
        />
        <KpiCard
          title="Nuevos este mes"
          value={newThisMonth}
          subtitle="se registraron en abril"
          icon={<Calendar size={20} />}
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
          placeholder="Buscar por nombre o email..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full rounded-lg border border-slate-600 bg-slate-800 pl-9 pr-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/40 focus:border-cyan-500"
        />
      </div>

      {/* Tabla */}
      <div className="rounded-xl border border-slate-700/50 bg-slate-800/50 overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-slate-400 text-sm">
            Cargando usuarios...
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center">
            <p className="text-slate-400 text-sm">
              {search
                ? 'No se encontraron resultados para tu búsqueda.'
                : 'No hay usuarios registrados todavía.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-700/60">
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                    Usuario
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider hidden md:table-cell">
                    Teléfono
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider hidden lg:table-cell">
                    País / Ciudad
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                    Estado
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider hidden xl:table-cell">
                    Último acceso
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider hidden lg:table-cell">
                    Registro
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/40">
                {filtered.map(user => (
                  <tr
                    key={user.id}
                    onClick={() => openDetail(user)}
                    className="hover:bg-slate-700/30 transition-colors cursor-pointer"
                  >
                    {/* Usuario */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-full bg-slate-700 flex items-center justify-center text-xs font-bold text-cyan-400 shrink-0">
                          {initials(user)}
                        </div>
                        <div className="min-w-0">
                          <p className="font-medium text-white truncate">
                            {displayName(user)}
                          </p>
                          <p className="text-xs text-slate-500 truncate">{user.email}</p>
                        </div>
                      </div>
                    </td>

                    {/* Teléfono */}
                    <td className="px-4 py-3 text-slate-400 hidden md:table-cell">
                      {user.phone ?? '—'}
                    </td>

                    {/* País / Ciudad */}
                    <td className="px-4 py-3 text-slate-400 hidden lg:table-cell">
                      {user.country || user.city
                        ? [user.city, user.country].filter(Boolean).join(', ')
                        : '—'}
                    </td>

                    {/* Estado */}
                    <td className="px-4 py-3">
                      <Badge variant={user.is_active ? 'success' : 'danger'}>
                        {user.is_active ? 'Activo' : 'Inactivo'}
                      </Badge>
                    </td>

                    {/* Último acceso */}
                    <td className="px-4 py-3 text-slate-400 text-xs hidden xl:table-cell">
                      {formatDateTime(user.last_login_at)}
                    </td>

                    {/* Registro */}
                    <td className="px-4 py-3 text-slate-400 text-xs hidden lg:table-cell">
                      {formatDate(user.created_at)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Footer con conteo */}
        {!loading && filtered.length > 0 && (
          <div className="px-4 py-3 border-t border-slate-700/40 text-xs text-slate-500">
            Mostrando {filtered.length} de {totalUsers} usuarios
          </div>
        )}
      </div>

      {/* ─── Modal: Detalle de usuario ─── */}
      <Modal
        open={!!detailUser}
        onClose={closeDetail}
        title="Detalle de usuario"
        size="sm"
        footer={
          <>
            <Button variant="secondary" size="sm" onClick={closeDetail} disabled={toggling}>
              Cerrar
            </Button>
            <Button
              variant={detailUser?.is_active ? 'danger' : 'primary'}
              size="sm"
              onClick={toggleActive}
              loading={toggling}
            >
              {detailUser?.is_active ? (
                <>
                  <UserX size={14} />
                  Desactivar cuenta
                </>
              ) : (
                <>
                  <UserCheck size={14} />
                  Activar cuenta
                </>
              )}
            </Button>
          </>
        }
      >
        {detailUser && (
          <div className="space-y-4">
            {/* Avatar + nombre */}
            <div className="flex items-center gap-4">
              <div className="h-14 w-14 rounded-full bg-slate-700 flex items-center justify-center text-xl font-bold text-cyan-400 shrink-0">
                {initials(detailUser)}
              </div>
              <div>
                <p className="text-base font-semibold text-white">
                  {detailUser.full_name?.trim() || '(Sin nombre)'}
                </p>
                <Badge variant={detailUser.is_active ? 'success' : 'danger'} className="mt-1">
                  {detailUser.is_active ? 'Cuenta activa' : 'Cuenta inactiva'}
                </Badge>
              </div>
            </div>

            {/* Datos */}
            <div className="rounded-lg bg-slate-700/40 divide-y divide-slate-700/60">
              <DetailRow icon={<Mail size={14} />} label="Email" value={detailUser.email} />
              <DetailRow icon={<Phone size={14} />} label="Teléfono" value={detailUser.phone ?? '—'} />
              <DetailRow
                icon={<Globe size={14} />}
                label="País"
                value={detailUser.country ?? '—'}
              />
              <DetailRow
                icon={<MapPin size={14} />}
                label="Ciudad"
                value={detailUser.city ?? '—'}
              />
              <DetailRow
                icon={<Clock size={14} />}
                label="Último acceso"
                value={formatDateTime(detailUser.last_login_at)}
              />
              <DetailRow
                icon={<Calendar size={14} />}
                label="Registro"
                value={formatDateTime(detailUser.created_at)}
              />
            </div>

            {/* Datos adicionales (Virtuagym) */}
            {(detailUser.document_type || detailUser.address || detailUser.emergency_contact || detailUser.iban || detailUser.notes) && (
              <div className="rounded-lg bg-slate-700/40 divide-y divide-slate-700/60">
                {(detailUser.document_type || detailUser.document_number) && (
                  <DetailRow icon={<FileText size={14} />} label="Documento" value={[detailUser.document_type, detailUser.document_number].filter(Boolean).join(': ') || '—'} />
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

            {/* ID técnico */}
            <p className="text-xs text-slate-600 font-mono break-all">
              ID: {detailUser.id}{detailUser.virtuagym_id ? ` | VG: ${detailUser.virtuagym_id}` : ''}
            </p>
          </div>
        )}
      </Modal>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// Componente auxiliar para filas del modal
// ─────────────────────────────────────────────────────────────
function DetailRow({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode
  label: string
  value: string
}) {
  return (
    <div className="flex items-center gap-3 px-4 py-2.5">
      <span className="text-slate-500 shrink-0">{icon}</span>
      <span className="text-xs text-slate-400 w-24 shrink-0">{label}</span>
      <span className="text-sm text-white truncate">{value}</span>
    </div>
  )
}
