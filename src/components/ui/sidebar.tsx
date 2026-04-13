'use client'

import { cn } from '@/lib/utils'
import {
  LayoutDashboard, Calendar, Trophy, Medal, Dumbbell, ShoppingBag,
  Users, Banknote, Settings, ChevronLeft, ChevronRight, LogOut,
  Swords, BarChart3, Lightbulb, Search, Menu, X, ChevronDown,
  Receipt, DoorOpen, MessageSquare, Target, ClipboardList, UserCog,
  QrCode, CreditCard, CircleDot, Activity, Heart, Store
} from 'lucide-react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState, useEffect } from 'react'

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────
interface NavItem {
  icon: React.ReactNode
  label: string
  href: string
  badge?: number
}

interface NavGroup {
  id: string
  label: string
  icon: React.ReactNode
  items: NavItem[]
  staffVisible?: boolean // if true, staff role can see this group
}

// ─────────────────────────────────────────────────────────────
// Player navigation (flat, simpler)
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
    ],
  },
  {
    id: 'gym',
    label: 'Gimnasio',
    icon: <Dumbbell size={16} />,
    items: [
      { icon: <Dumbbell size={18} />, label: 'Gimnasio', href: '/gimnasio' },
      { icon: <ClipboardList size={18} />, label: 'Mi Entrenamiento', href: '/mi-entrenamiento' },
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
      { icon: <CreditCard size={18} />, label: 'Mi Suscripción', href: '/mi-suscripcion' },
      { icon: <QrCode size={18} />, label: 'Mi Acceso', href: '/mi-acceso' },
      { icon: <ShoppingBag size={18} />, label: 'Tienda', href: '/tienda' },
    ],
  },
]

// ─────────────────────────────────────────────────────────────
// Admin navigation (grouped by area)
// ─────────────────────────────────────────────────────────────
const adminGroups: NavGroup[] = [
  {
    id: 'main',
    label: 'General',
    icon: <LayoutDashboard size={16} />,
    staffVisible: true,
    items: [
      { icon: <LayoutDashboard size={18} />, label: 'Dashboard', href: '/admin' },
    ],
  },
  {
    id: 'padel',
    label: 'Pádel & Sport',
    icon: <CircleDot size={16} />,
    staffVisible: true,
    items: [
      { icon: <Calendar size={18} />, label: 'Reservas', href: '/admin/reservas' },
      { icon: <Users size={18} />, label: 'Jugadores', href: '/admin/jugadores' },
      { icon: <Trophy size={18} />, label: 'Torneos', href: '/admin/torneos' },
      { icon: <Medal size={18} />, label: 'Ligas', href: '/admin/ligas' },
    ],
  },
  {
    id: 'gym',
    label: 'Gimnasio',
    icon: <Dumbbell size={16} />,
    staffVisible: true,
    items: [
      { icon: <Dumbbell size={18} />, label: 'Clases & Gym', href: '/admin/gimnasio' },
      { icon: <ClipboardList size={18} />, label: 'Entrenamiento', href: '/admin/entrenamiento' },
      { icon: <DoorOpen size={18} />, label: 'Control Acceso', href: '/admin/accesos' },
    ],
  },
  {
    id: 'comunidad',
    label: 'Comunidad',
    icon: <Heart size={16} />,
    staffVisible: true,
    items: [
      { icon: <MessageSquare size={18} />, label: 'Feed Social', href: '/admin/comunidad' },
      { icon: <Target size={18} />, label: 'Retos & Badges', href: '/admin/retos' },
    ],
  },
  {
    id: 'finanzas',
    label: 'Finanzas',
    icon: <Banknote size={16} />,
    staffVisible: true,
    items: [
      { icon: <Banknote size={18} />, label: 'Caja', href: '/admin/caja' },
      { icon: <Receipt size={18} />, label: 'Facturación', href: '/admin/facturacion' },
      { icon: <CreditCard size={18} />, label: 'Precios', href: '/admin/precios' },
      { icon: <ShoppingBag size={18} />, label: 'Tienda', href: '/admin/tienda' },
    ],
  },
  {
    id: 'admin',
    label: 'Administración',
    icon: <Settings size={16} />,
    staffVisible: false,
    items: [
      { icon: <Users size={18} />, label: 'Usuarios', href: '/admin/usuarios' },
      { icon: <UserCog size={18} />, label: 'Staff', href: '/admin/staff' },
      { icon: <Activity size={18} />, label: 'Pistas', href: '/admin/pistas' },
      { icon: <BarChart3 size={18} />, label: 'Reportes', href: '/admin/reportes' },
      { icon: <Lightbulb size={18} />, label: 'Innovación', href: '/admin/innovacion' },
      { icon: <Settings size={18} />, label: 'Configuración', href: '/admin/config' },
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

export function Sidebar({ isAdmin, memberRole, user, onLogout }: SidebarProps) {
  const pathname = usePathname()
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [openSections, setOpenSections] = useState<Set<string>>(new Set())

  // Determine which groups to show
  let groups: NavGroup[]
  if (!isAdmin) {
    groups = playerGroups
  } else if (memberRole === 'staff') {
    groups = adminGroups.filter(g => g.staffVisible)
  } else {
    groups = adminGroups
  }

  // Auto-open the section that contains the current path
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
        <div className="w-9 h-9 rounded-lg bg-cyan-600 flex items-center justify-center text-white font-bold text-sm shrink-0">
          NM
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
        {groups.map((group) => {
          const isOpen = openSections.has(group.id)
          const hasActive = group.items.some(item =>
            pathname === item.href ||
            (item.href !== '/dashboard' && item.href !== '/admin' && pathname.startsWith(item.href))
          )

          // If only 1 item (like Dashboard), render directly without group header
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
              {/* Group header */}
              {!collapsed ? (
                <button
                  onClick={() => toggleSection(group.id)}
                  className={cn(
                    'w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-semibold uppercase tracking-wider transition-colors',
                    hasActive
                      ? 'text-cyan-400'
                      : 'text-slate-500 hover:text-slate-300'
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
                  <div className={cn(
                    'w-6 h-[1px]',
                    hasActive ? 'bg-cyan-500/50' : 'bg-slate-700/50'
                  )} />
                </div>
              )}

              {/* Group items */}
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
      {/* Mobile toggle */}
      <button
        onClick={() => setMobileOpen(true)}
        className="fixed top-4 left-4 z-50 lg:hidden bg-slate-800 border border-slate-700 rounded-lg p-2 text-slate-400"
      >
        <Menu size={20} />
      </button>

      {/* Mobile overlay */}
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

      {/* Desktop sidebar */}
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
