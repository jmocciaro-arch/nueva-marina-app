'use client'

import { cn } from '@/lib/utils'
import {
  LayoutDashboard, Calendar, Trophy, Medal, Dumbbell, ShoppingBag,
  Users, Banknote, Settings, ChevronLeft, ChevronRight, LogOut,
  Swords, BarChart3, Lightbulb, Search, Menu, X, ChevronDown,
  Receipt, DoorOpen, MessageSquare, Target, ClipboardList, UserCog,
  QrCode, CreditCard, CircleDot, Activity, Heart, Store, Droplets,
  Tag, Layers, ShieldCheck, Upload, Sparkles
} from 'lucide-react'
import Image from 'next/image'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState, useEffect } from 'react'
import { usePermissions } from '@/lib/use-permissions'

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────
interface NavItem {
  icon: React.ReactNode
  label: string
  href: string
  badge?: number
  permission?: string // clave requerida; si falta, ver siempre
}

interface NavGroup {
  id: string
  label: string
  icon: React.ReactNode
  items: NavItem[]
}

// ─────────────────────────────────────────────────────────────
// Player navigation (no permissions — el player ve su mundo)
// ─────────────────────────────────────────────────────────────
const playerGroups: NavGroup[] = [
  {
    id: 'main',
    label: 'Principal',
    icon: <LayoutDashboard size={16} />,
    items: [
      { icon: <LayoutDashboard size={18} />, label: 'Dashboard', href: '/dashboard' },
    ],
  },
  {
    id: 'padel',
    label: 'Pádel',
    icon: <CircleDot size={16} />,
    items: [
      { icon: <Calendar size={18} />, label: 'Mis Reservas', href: '/mis-reservas' },
      { icon: <Swords size={18} />, label: 'Mis Partidos', href: '/mis-partidos' },
      { icon: <Search size={18} />, label: 'Buscar Partido', href: '/buscar-partido' },
      { icon: <Trophy size={18} />, label: 'Mis Torneos', href: '/mis-torneos' },
      { icon: <Medal size={18} />, label: 'Mis Ligas', href: '/mis-ligas' },
      { icon: <BarChart3 size={18} />, label: 'Ranking', href: '/ranking' },
      { icon: <Sparkles size={18} />, label: 'Análisis IA', href: '/analisis-ia' },
    ],
  },
  {
    id: 'gym',
    label: 'Gimnasio',
    icon: <Dumbbell size={16} />,
    items: [
      { icon: <Dumbbell size={18} />, label: 'Gimnasio', href: '/gimnasio' },
      { icon: <ClipboardList size={18} />, label: 'Mi Entrenamiento', href: '/mi-entrenamiento' },
      { icon: <Droplets size={18} />, label: 'Mi Recuperación', href: '/mi-recuperacion' },
    ],
  },
  {
    id: 'social',
    label: 'Social',
    icon: <Heart size={16} />,
    items: [
      { icon: <MessageSquare size={18} />, label: 'Comunidad', href: '/comunidad' },
      { icon: <Target size={18} />, label: 'Retos', href: '/retos' },
    ],
  },
  {
    id: 'cuenta',
    label: 'Mi Cuenta',
    icon: <Users size={16} />,
    items: [
      { icon: <Users size={18} />, label: 'Mi Ficha', href: '/mi-ficha' },
      { icon: <CreditCard size={18} />, label: 'Mi Suscripción', href: '/mi-suscripcion' },
      { icon: <QrCode size={18} />, label: 'Mi Acceso', href: '/mi-acceso' },
      { icon: <ShoppingBag size={18} />, label: 'Tienda', href: '/tienda' },
    ],
  },
]

// ─────────────────────────────────────────────────────────────
// Admin navigation v3 (11 grupos, cada item con permission key)
// Fuente: JSON AdminSidebarV3
// ─────────────────────────────────────────────────────────────
const adminGroups: NavGroup[] = [
  {
    id: 'operacion',
    label: 'Operación',
    icon: <LayoutDashboard size={16} />,
    items: [
      { icon: <LayoutDashboard size={18} />, label: 'Dashboard', href: '/admin', permission: 'dashboard.view' },
    ],
  },
  {
    id: 'deporte',
    label: 'Pádel & Sport',
    icon: <CircleDot size={16} />,
    items: [
      { icon: <Calendar size={18} />, label: 'Reservas', href: '/admin/reservas', permission: 'padel.reservas' },
      { icon: <Activity size={18} />, label: 'Pistas', href: '/admin/pistas', permission: 'courts.manage' },
      { icon: <Trophy size={18} />, label: 'Torneos', href: '/admin/torneos', permission: 'tournaments.manage' },
      { icon: <Medal size={18} />, label: 'Ligas', href: '/admin/ligas', permission: 'leagues.manage' },
      { icon: <Users size={18} />, label: 'Jugadores', href: '/admin/jugadores', permission: 'ranking.view' },
      { icon: <Sparkles size={18} />, label: 'Análisis IA', href: '/admin/analisis-ia', permission: 'ai.analysis.manage' },
    ],
  },
  {
    id: 'gym',
    label: 'Gimnasio & Wellness',
    icon: <Dumbbell size={16} />,
    items: [
      { icon: <Dumbbell size={18} />, label: 'Gimnasio', href: '/admin/gimnasio', permission: 'gym.classes' },
      { icon: <Users size={18} />, label: 'Socios del gym', href: '/admin/gimnasio/socios', permission: 'gym.classes' },
      { icon: <ClipboardList size={18} />, label: 'Planes de entrenamiento', href: '/admin/entrenamiento', permission: 'training.manage' },
      { icon: <Droplets size={18} />, label: 'Recuperación', href: '/admin/recuperacion', permission: 'recovery.manage' },
    ],
  },
  {
    id: 'acceso',
    label: 'Control de acceso',
    icon: <DoorOpen size={16} />,
    items: [
      { icon: <DoorOpen size={18} />, label: 'Control de acceso', href: '/admin/accesos', permission: 'access.logs' },
      { icon: <QrCode size={18} />, label: 'Escanear (QR/NFC)', href: '/admin/escanear', permission: 'access.logs' },
    ],
  },
  {
    id: 'comercial',
    label: 'Comercial',
    icon: <Store size={16} />,
    items: [
      { icon: <ShoppingBag size={18} />, label: 'Tienda', href: '/admin/tienda', permission: 'shop.manage' },
    ],
  },
  {
    id: 'finanzas',
    label: 'Finanzas',
    icon: <Banknote size={16} />,
    items: [
      { icon: <Banknote size={18} />, label: 'Caja', href: '/admin/caja', permission: 'cash.manage' },
      { icon: <Receipt size={18} />, label: 'Facturación & Suscripciones', href: '/admin/facturacion', permission: 'billing.manage' },
    ],
  },
  {
    id: 'pricing',
    label: 'Pricing',
    icon: <Tag size={16} />,
    items: [
      { icon: <Tag size={18} />, label: 'Reglas de precio', href: '/admin/pricing', permission: 'pricing.manage' },
      { icon: <Banknote size={18} />, label: 'Precios', href: '/admin/precios', permission: 'pricing.manage' },
    ],
  },
  {
    id: 'personas',
    label: 'Personas',
    icon: <Users size={16} />,
    items: [
      { icon: <Users size={18} />, label: 'Usuarios', href: '/admin/usuarios', permission: 'users.manage' },
      { icon: <Upload size={18} />, label: 'Importar Virtuagym', href: '/admin/importar', permission: 'users.manage' },
      { icon: <UserCog size={18} />, label: 'Staff & turnos', href: '/admin/staff', permission: 'staff.manage' },
    ],
  },
  {
    id: 'comunidad',
    label: 'Comunidad',
    icon: <MessageSquare size={16} />,
    items: [
      { icon: <MessageSquare size={18} />, label: 'Feed / Comunidad', href: '/admin/comunidad', permission: 'community.feed' },
      { icon: <Target size={18} />, label: 'Retos & badges', href: '/admin/retos', permission: 'community.challenges' },
    ],
  },
  {
    id: 'reportes',
    label: 'Reportes',
    icon: <BarChart3 size={16} />,
    items: [
      { icon: <BarChart3 size={18} />, label: 'Reportes', href: '/admin/reportes', permission: 'reports.operational' },
    ],
  },
  {
    id: 'config',
    label: 'Configuración',
    icon: <Settings size={16} />,
    items: [
      { icon: <Settings size={18} />, label: 'Club', href: '/admin/config', permission: 'config.manage_club' },
      { icon: <Layers size={18} />, label: 'Módulos activos', href: '/admin/config/modulos', permission: 'config.manage_modules' },
      { icon: <ShieldCheck size={18} />, label: 'Roles & permisos', href: '/admin/config/roles', permission: 'config.manage_roles' },
      { icon: <Trophy size={18} />, label: 'Formatos de juego', href: '/admin/config/formatos', permission: 'config.manage_formats' },
      { icon: <Lightbulb size={18} />, label: 'Innovación', href: '/admin/innovacion' },
    ],
  },
]

// ─────────────────────────────────────────────────────────────
// Sidebar Component
// ─────────────────────────────────────────────────────────────
interface SidebarProps {
  isAdmin?: boolean
  memberRole?: string
  user?: { full_name?: string; email: string; avatar_url?: string }
  onLogout?: () => void
}

export function Sidebar({ isAdmin, user, onLogout }: SidebarProps) {
  const pathname = usePathname()
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [openSections, setOpenSections] = useState<Set<string>>(new Set())
  const { can, loading: permLoading } = usePermissions()

  // Filtrar items por permiso (solo admin side)
  let groups: NavGroup[]
  if (!isAdmin) {
    groups = playerGroups
  } else {
    groups = adminGroups
      .map(g => ({
        ...g,
        items: g.items.filter(it => !it.permission || can(it.permission)),
      }))
      .filter(g => g.items.length > 0)
  }

  // Auto-abrir la sección activa
  useEffect(() => {
    for (const group of groups) {
      const hasActive = group.items.some(item =>
        pathname === item.href ||
        (item.href !== '/dashboard' && item.href !== '/admin' && pathname.startsWith(item.href))
      )
      if (hasActive) {
        setOpenSections(prev => new Set(prev).add(group.id))
        break
      }
    }
  }, [pathname]) // eslint-disable-line react-hooks/exhaustive-deps

  function toggleSection(id: string) {
    setOpenSections(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const NavContent = () => (
    <>
      {/* Logo */}
      <div className="flex items-center gap-3 px-4 py-4 border-b border-slate-700/50">
        <div className="w-9 h-9 rounded-lg bg-white flex items-center justify-center p-1 shrink-0">
          <Image src="/icons/icon-512.png" alt="Nueva Marina" width={36} height={36} className="w-full h-full object-contain" priority />
        </div>
        {!collapsed && (
          <div className="overflow-hidden">
            <p className="text-sm font-bold text-white truncate">Nueva Marina</p>
            <p className="text-[10px] text-slate-500 truncate">{isAdmin ? 'Admin Panel' : 'Pádel & Sport'}</p>
          </div>
        )}
      </div>

      {/* Grouped nav */}
      <nav className="flex-1 overflow-y-auto py-2 px-2">
        {isAdmin && permLoading && (
          <div className="px-3 py-2 text-[11px] text-slate-500">Cargando permisos…</div>
        )}
        {groups.map((group) => {
          const isOpen = openSections.has(group.id)
          const hasActive = group.items.some(item =>
            pathname === item.href ||
            (item.href !== '/dashboard' && item.href !== '/admin' && pathname.startsWith(item.href))
          )

          // Single-item grupo → render directo
          if (group.items.length === 1) {
            const item = group.items[0]
            const active = pathname === item.href
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileOpen(false)}
                className={cn(
                  'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors mb-1',
                  active
                    ? 'bg-cyan-600/20 text-cyan-400'
                    : 'text-slate-400 hover:text-white hover:bg-slate-700/50'
                )}
              >
                {item.icon}
                {!collapsed && <span>{item.label}</span>}
              </Link>
            )
          }

          return (
            <div key={group.id} className="mb-1">
              {!collapsed ? (
                <button
                  onClick={() => toggleSection(group.id)}
                  className={cn(
                    'w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-semibold uppercase tracking-wider transition-colors',
                    hasActive ? 'text-cyan-400' : 'text-slate-500 hover:text-slate-300'
                  )}
                >
                  <div className="flex items-center gap-2">
                    {group.icon}
                    <span>{group.label}</span>
                  </div>
                  <ChevronDown
                    size={12}
                    className={cn('transition-transform', isOpen ? 'rotate-0' : '-rotate-90')}
                  />
                </button>
              ) : (
                <div className="flex justify-center py-2">
                  <div className={cn('w-6 h-[1px]', hasActive ? 'bg-cyan-500/50' : 'bg-slate-700/50')} />
                </div>
              )}

              {(isOpen || collapsed) && (
                <div className={cn(!collapsed && 'ml-1 mb-2')}>
                  {group.items.map(item => {
                    const active = pathname === item.href ||
                      (item.href !== '/dashboard' && item.href !== '/admin' && pathname.startsWith(item.href))
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        onClick={() => setMobileOpen(false)}
                        className={cn(
                          'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                          active
                            ? 'bg-cyan-600/15 text-cyan-400 border-l-2 border-cyan-400'
                            : 'text-slate-400 hover:text-white hover:bg-slate-700/40'
                        )}
                      >
                        {item.icon}
                        {!collapsed && <span>{item.label}</span>}
                        {!collapsed && item.badge && (
                          <span className="ml-auto bg-cyan-600 text-white text-[10px] px-1.5 py-0.5 rounded-full">
                            {item.badge}
                          </span>
                        )}
                      </Link>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
      </nav>

      {/* User */}
      {user && (
        <div className="border-t border-slate-700/50 px-3 py-3">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-slate-600 flex items-center justify-center text-xs text-white shrink-0">
              {user.full_name?.[0] || user.email[0].toUpperCase()}
            </div>
            {!collapsed && (
              <div className="flex-1 overflow-hidden">
                <p className="text-xs font-medium text-white truncate">{user.full_name || user.email}</p>
                <p className="text-[10px] text-slate-500 truncate">{user.email}</p>
              </div>
            )}
            {!collapsed && onLogout && (
              <button onClick={onLogout} className="text-slate-500 hover:text-red-400 transition-colors" title="Cerrar sesión">
                <LogOut size={16} />
              </button>
            )}
          </div>
        </div>
      )}
    </>
  )

  return (
    <>
      <button
        onClick={() => setMobileOpen(true)}
        className="fixed top-4 left-4 z-50 lg:hidden bg-slate-800 border border-slate-700 rounded-lg p-2 text-slate-400"
      >
        <Menu size={20} />
      </button>

      {mobileOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="fixed inset-0 bg-black/60" onClick={() => setMobileOpen(false)} />
          <div className="fixed left-0 top-0 bottom-0 w-64 bg-slate-900 border-r border-slate-700 flex flex-col z-50">
            <button
              onClick={() => setMobileOpen(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white"
            >
              <X size={20} />
            </button>
            <NavContent />
          </div>
        </div>
      )}

      <aside className={cn(
        'hidden lg:flex flex-col h-screen bg-slate-900 border-r border-slate-700/50 sticky top-0 transition-all duration-200',
        collapsed ? 'w-16' : 'w-60'
      )}>
        <NavContent />
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="absolute -right-3 top-8 bg-slate-800 border border-slate-700 rounded-full p-1 text-slate-400 hover:text-white"
        >
          {collapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
        </button>
      </aside>
    </>
  )
}
