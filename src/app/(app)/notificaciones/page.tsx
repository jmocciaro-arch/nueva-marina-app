'use client'

import { useState, useCallback, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/lib/auth-context'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  CheckCheck, Trophy, Calendar, Info,
  AlertCircle, MessageSquare, Star, Dumbbell, BellOff,
} from 'lucide-react'

interface Notification {
  id: string
  type: string
  title: string
  body: string
  is_read: boolean
  sent_at: string
}

function NotifIcon({ type }: { type: string }) {
  const sz = { size: 16 }
  const base = 'w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0'
  if (type === 'match' || type === 'partido')
    return <div className={`${base} bg-cyan-500/20`}><Trophy {...sz} className="text-cyan-400" /></div>
  if (type === 'booking' || type === 'reserva')
    return <div className={`${base} bg-blue-500/20`}><Calendar {...sz} className="text-blue-400" /></div>
  if (type === 'tournament' || type === 'torneo')
    return <div className={`${base} bg-amber-500/20`}><Star {...sz} className="text-amber-400" /></div>
  if (type === 'gym' || type === 'gimnasio')
    return <div className={`${base} bg-green-500/20`}><Dumbbell {...sz} className="text-green-400" /></div>
  if (type === 'alert' || type === 'alerta')
    return <div className={`${base} bg-red-500/20`}><AlertCircle {...sz} className="text-red-400" /></div>
  if (type === 'message' || type === 'mensaje')
    return <div className={`${base} bg-purple-500/20`}><MessageSquare {...sz} className="text-purple-400" /></div>
  return <div className={`${base} bg-slate-700/60`}><Info {...sz} className="text-slate-400" /></div>
}

function timeAgo(dateStr: string): string {
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000)
  if (diff < 60) return 'Hace un momento'
  if (diff < 3600) return `Hace ${Math.floor(diff / 60)} min`
  if (diff < 86400) return `Hace ${Math.floor(diff / 3600)} h`
  if (diff < 604800) return `Hace ${Math.floor(diff / 86400)} dias`
  return new Date(dateStr).toLocaleDateString('es-AR', { day: '2-digit', month: 'short' })
}

export default function NotificacionesPage() {
  const { user } = useAuth()
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [loading, setLoading] = useState(true)
  const [markingAll, setMarkingAll] = useState(false)

  const loadNotifications = useCallback(async () => {
    const supabase = createClient()
    if (!user) return
    setLoading(true)
    const { data } = await supabase
      .from('nm_notifications')
      .select('*')
      .eq('user_id', user.id)
      .order('sent_at', { ascending: false })
    setNotifications((data || []) as Notification[])
    setLoading(false)
  }, [user])

  useEffect(() => { loadNotifications() }, [loadNotifications])

  async function markAsRead(id: string) {
    const notif = notifications.find(n => n.id === id)
    if (!notif || notif.is_read) return
    const supabase = createClient()
    await supabase.from('nm_notifications').update({ is_read: true }).eq('id', id)
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n))
  }

  async function markAllAsRead() {
    if (!user) return
    setMarkingAll(true)
    const supabase = createClient()
    await supabase
      .from('nm_notifications')
      .update({ is_read: true })
      .eq('user_id', user.id)
      .eq('is_read', false)
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })))
    setMarkingAll(false)
  }

  const unreadCount = notifications.filter(n => !n.is_read).length

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            Notificaciones
            {unreadCount > 0 && (
              <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-cyan-500 text-white text-xs font-bold">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </h1>
          <p className="text-sm text-slate-400 mt-1">Alertas, mensajes y avisos del club</p>
        </div>
        {unreadCount > 0 && (
          <Button variant="outline" size="sm" loading={markingAll} onClick={markAllAsRead}>
            <CheckCheck size={14} />
            Marcar todo como leido
          </Button>
        )}
      </div>

      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3, 4, 5].map(i => (
            <div key={i} className="h-20 rounded-xl bg-slate-800/50 border border-slate-700/50 animate-pulse" />
          ))}
        </div>
      ) : notifications.length === 0 ? (
        <Card>
          <div className="text-center py-14">
            <BellOff size={40} className="mx-auto text-slate-600 mb-3" />
            <p className="text-slate-300 font-medium mb-1">Sin notificaciones</p>
            <p className="text-slate-500 text-sm">Cuando el club te envie alertas o mensajes, aparecen aca.</p>
          </div>
        </Card>
      ) : (
        <div className="space-y-1.5">
          {notifications.map(notif => (
            <div
              key={notif.id}
              onClick={() => markAsRead(notif.id)}
              className={`flex items-start gap-3 rounded-xl border px-4 py-3.5 transition-all cursor-pointer ${
                notif.is_read
                  ? 'border-slate-700/30 bg-slate-800/30 hover:bg-slate-800/50'
                  : 'border-cyan-500/20 bg-slate-800/70 hover:bg-slate-800'
              }`}
            >
              <NotifIcon type={notif.type} />
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <p className={`text-sm font-medium leading-tight ${notif.is_read ? 'text-slate-300' : 'text-white'}`}>
                    {notif.title}
                  </p>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className="text-xs text-slate-500 whitespace-nowrap">{timeAgo(notif.sent_at)}</span>
                    {!notif.is_read && <span className="w-2 h-2 rounded-full bg-cyan-400 flex-shrink-0" />}
                  </div>
                </div>
                {notif.body && (
                  <p className="text-xs text-slate-400 mt-1 line-clamp-2">{notif.body}</p>
                )}
                {!notif.is_read && <Badge variant="cyan" className="mt-2">Nuevo</Badge>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
