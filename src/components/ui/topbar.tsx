'use client'

import { Bell, Search } from 'lucide-react'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/lib/auth-context'

interface TopbarProps {
  title?: string
  showSearch?: boolean
}

export function Topbar({ title, showSearch = true }: TopbarProps) {
  const [searchOpen, setSearchOpen] = useState(false)
  const [unread, setUnread] = useState(0)
  const { user } = useAuth()

  useEffect(() => {
    if (!user) return
    const supabase = createClient()
    let mounted = true

    const load = async () => {
      const { count } = await supabase
        .from('nm_notifications')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('is_read', false)
      if (mounted) setUnread(count || 0)
    }
    load()

    // Realtime: escuchar nuevas notificaciones
    const channel = supabase
      .channel(`notif:${user.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'nm_notifications', filter: `user_id=eq.${user.id}` },
        () => load(),
      )
      .subscribe()

    return () => {
      mounted = false
      supabase.removeChannel(channel)
    }
  }, [user])

  return (
    <header className="sticky top-0 z-30 flex items-center justify-between h-14 px-4 lg:px-6 bg-slate-900/80 backdrop-blur-lg border-b border-slate-700/50">
      <div className="flex items-center gap-4">
        <div className="lg:hidden w-10" /> {/* Space for mobile menu button */}
        {title && <h1 className="text-lg font-semibold text-white">{title}</h1>}
      </div>

      <div className="flex items-center gap-2">
        {showSearch && (
          <button
            onClick={() => setSearchOpen(!searchOpen)}
            className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            aria-label="Buscar"
          >
            <Search size={18} />
          </button>
        )}
        <Link
          href="/notificaciones"
          className="relative p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          aria-label={`Notificaciones${unread > 0 ? ` (${unread} sin leer)` : ''}`}
        >
          <Bell size={18} />
          {unread > 0 && (
            <span className="absolute top-0.5 right-0.5 min-w-[16px] h-[16px] px-1 text-[10px] font-bold text-white bg-red-500 rounded-full flex items-center justify-center">
              {unread > 9 ? '9+' : unread}
            </span>
          )}
        </Link>
      </div>
    </header>
  )
}
