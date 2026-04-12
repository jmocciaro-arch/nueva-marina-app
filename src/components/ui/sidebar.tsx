'use client'

import { cn } from '@/lib/utils'
import {
  LayoutDashboard, Calendar, Trophy, Medal, Dumbbell, ShoppingBag,
  Users, Banknote, Settings, ChevronLeft, ChevronRight, LogOut,
  Swords, BarChart3, Bell, Lightbulb, Search, Menu, X,
  Receipt, DoorOpen, MessageSquare, Target, ClipboardList, UserCog,
  QrCode, CreditCard
} from 'lucide-react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'

interface NavItem {
  icon: React.ReactNode
  label: string
  href: string
  badge?: number
}

const playerNav: NavItem[] = [
  { icon: <LayoutDashboard size={20} />, label: 'Dashboard', href: '/dashboard' },
  { icon: <Calendar size={20} />, label: 'Mis Reservas', href: '/mis-reservas' },
  { icon: <Swords size={20} />, label: 'Mis Partidos', href: '/mis-partidos' },
  { icon: <Trophy size={20} />, label: 'Mis Torneos', href: '/mis-torneos' },
  { icon: <Medal size={20} />, label: 'Mis Ligas', href: '/mis-ligas' },
  { icon: <BarChart3 size={20} />, label: 'Ranking', href: '/ranking' },
  { icon: <Dumbbell size={20} />, label: 'Gimnasio', href: '/gimnasio' },
  { icon: <ClipboardList size={20} />, label: 'Mi Entrenamiento', href: '/mi-entrenamiento' },
  { icon: <CreditCard size={20} />, label: 'Mi Suscripcion', href: '/mi-suscripcion' },
  { icon: <ShoppingBag size={20} />, label: 'Tienda', href: '/tienda' },
  { icon: <Search size={20} />, label: 'Buscar Partido', href: '/buscar-partido' },
  { icon: <QrCode size={20} />, label: 'Mi Acceso', href: '/mi-acceso' },
  { icon: <MessageSquare size={20} />, label: 'Comunidad', href: '/comunidad' },
  { icon: <Target size={20} />, label: 'Retos', href: '/retos' },
]

const adminNav: NavItem[] = [
  { icon: <LayoutDashboard size={20} />, label: 'Dashboard', href: '/admin' },
  { icon: <Calendar size={20} />, label: 'Reservas', href: '/admin/reservas' },
  { icon: <Banknote size={20} />, label: 'Caja', href: '/admin/caja' },
  { icon: <Receipt size={20} />, label: 'Facturacion', href: '/admin/facturacion' },
  { icon: <Users size={20} />, label: 'Usuarios', href: '/admin/usuarios' },
  { icon: <Users size={20} />, label: 'Jugadores', href: '/admin/jugadores' },
  { icon: <Settings size={20} />, label: 'Pistas', href: '/admin/pistas' },
  { icon: <Trophy size={20} />, label: 'Torneos', href: '/admin/torneos' },
  { icon: <Medal size={20} />, label: 'Ligas', href: '/admin/ligas' },
  { icon: <Dumbbell size={20} />, label: 'Gimnasio', href: '/admin/gimnasio' },
  { icon: <ClipboardList size={20} />, label: 'Entrenamiento', href: '/admin/entrenamiento' },
  { icon: <ShoppingBag size={20} />, label: 'Tienda', href: '/admin/tienda' },
  { icon: <DoorOpen size={20} />, label: 'Accesos', href: '/admin/accesos' },
  { icon: <MessageSquare size={20} />, label: 'Comunidad', href: '/admin/comunidad' },
  { icon: <Target size={20} />, label: 'Retos', href: '/admin/retos' },
  { icon: <UserCog size={20} />, label: 'Staff', href: '/admin/staff' },
  { icon: <Lightbulb size={20} />, label: 'Innovacion', href: '/admin/innovacion' },
  { icon: <BarChart3 size={20} />, label: 'Reportes', href: '/admin/reportes' },
  { icon: <Settings size={20} />, label: 'Config', href: '/admin/config' },
]

interface SidebarProps {
  isAdmin?: boolean
  user?: { full_name?: string; email: string; avatar_url?: string }
  onLogout?: () => void
}

export function Sidebar({ isAdmin, user, onLogout }: SidebarProps) {
  const pathname = usePathname()
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const nav = isAdmin ? adminNav : playerNav

  const NavContent = () => (
    <>
      {/* Logo */}
      <div className="flex items-center gap-3 px-4 py-5 border-b border-slate-700/50">
        <div className="w-9 h-9 rounded-lg bg-cyan-600 flex items-center justify-center text-white font-bold text-sm shrink-0">
          NM
        </div>
        {!collapsed && (
          <div className="overflow-hidden">
            <p className="text-sm font-bold text-white truncate">Nueva Marina</p>
            <p className="text-[10px] text-slate-500 truncate">{isAdmin ? 'Admin Panel' : 'Padel & Sport'}</p>
          </div>
        )}
      </div>

      {/* Nav items */}
      <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-0.5">
        {nav.map(item => {
          const active = pathname === item.href || (item.href !== '/dashboard' && item.href !== '/admin' && pathname.startsWith(item.href))
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setMobileOpen(false)}
              className={cn(
                'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                active
                  ? 'bg-cyan-600/20 text-cyan-400'
                  : 'text-slate-400 hover:text-white hover:bg-slate-700/50'
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
              <button onClick={onLogout} className="text-slate-500 hover:text-red-400 transition-colors" title="Cerrar sesion">
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
