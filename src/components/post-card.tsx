'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Heart, MessageCircle, Pin, Trash2, Send, MoreVertical, Megaphone, Trophy, Calendar, Star } from 'lucide-react'
import type { Post, PostComment, User } from '@/types'

const TYPE_CONFIG: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  post: { label: 'Publicación', icon: <MessageCircle size={12} />, color: 'bg-slate-600' },
  announcement: { label: 'Anuncio', icon: <Megaphone size={12} />, color: 'bg-cyan-600' },
  event: { label: 'Evento', icon: <Calendar size={12} />, color: 'bg-indigo-600' },
  achievement: { label: 'Logro', icon: <Star size={12} />, color: 'bg-yellow-600' },
  result: { label: 'Resultado', icon: <Trophy size={12} />, color: 'bg-green-600' },
}

interface PostCardProps {
  post: Post & { author?: { full_name: string; avatar_url?: string } }
  currentUserId: string
  isAdmin?: boolean
  onDelete?: (id: number) => void
  onPin?: (id: number, pinned: boolean) => void
  onRefresh?: () => void
}

export function PostCard({ post, currentUserId, isAdmin, onDelete, onPin, onRefresh }: PostCardProps) {
  const [liked, setLiked] = useState(post.user_liked || false)
  const [likesCount, setLikesCount] = useState(post.likes_count || 0)
  const [showComments, setShowComments] = useState(false)
  const [comments, setComments] = useState<(PostComment & { author?: { full_name: string; avatar_url?: string } })[]>([])
  const [commentText, setCommentText] = useState('')
  const [loadingComments, setLoadingComments] = useState(false)
  const [showMenu, setShowMenu] = useState(false)

  const typeConf = TYPE_CONFIG[post.type] || TYPE_CONFIG.post

  async function toggleLike() {
    const supabase = createClient()
    if (liked) {
      await supabase.from('nm_post_likes').delete().eq('post_id', post.id).eq('user_id', currentUserId)
      setLiked(false)
      setLikesCount(c => c - 1)
    } else {
      await supabase.from('nm_post_likes').insert({ post_id: post.id, user_id: currentUserId })
      setLiked(true)
      setLikesCount(c => c + 1)
    }
  }

  async function loadComments() {
    if (showComments) { setShowComments(false); return }
    setLoadingComments(true)
    const supabase = createClient()
    const { data } = await supabase
      .from('nm_post_comments')
      .select('*, author:nm_users(full_name, avatar_url)')
      .eq('post_id', post.id)
      .order('created_at', { ascending: true })
      .limit(50)
    setComments((data || []) as typeof comments)
    setShowComments(true)
    setLoadingComments(false)
  }

  async function sendComment(e: React.FormEvent) {
    e.preventDefault()
    if (!commentText.trim()) return
    const supabase = createClient()
    await supabase.from('nm_post_comments').insert({
      post_id: post.id,
      author_id: currentUserId,
      content: commentText.trim(),
    })
    setCommentText('')
    // Reload comments
    const { data } = await supabase
      .from('nm_post_comments')
      .select('*, author:nm_users(full_name, avatar_url)')
      .eq('post_id', post.id)
      .order('created_at', { ascending: true })
      .limit(50)
    setComments((data || []) as typeof comments)
    onRefresh?.()
  }

  const timeAgo = getTimeAgo(post.created_at)

  return (
    <div className={`rounded-xl border ${post.is_pinned ? 'border-cyan-500/50 bg-cyan-950/10' : 'border-slate-700/50 bg-slate-800/50'} overflow-hidden`}>
      {/* Pinned badge */}
      {post.is_pinned && (
        <div className="flex items-center gap-1.5 px-4 py-1.5 bg-cyan-600/10 border-b border-cyan-500/20 text-cyan-400 text-xs font-medium">
          <Pin size={12} /> Fijado
        </div>
      )}

      <div className="p-4">
        {/* Header */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center text-white font-bold text-sm">
              {post.author?.full_name?.charAt(0)?.toUpperCase() || '?'}
            </div>
            <div>
              <p className="text-sm font-semibold text-white">{post.author?.full_name || 'Usuario'}</p>
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-500">{timeAgo}</span>
                <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium text-white ${typeConf.color}`}>
                  {typeConf.icon} {typeConf.label}
                </span>
              </div>
            </div>
          </div>
          {(isAdmin || post.author_id === currentUserId) && (
            <div className="relative">
              <button onClick={() => setShowMenu(!showMenu)} className="p-1 rounded text-slate-500 hover:text-white hover:bg-slate-700 transition-colors">
                <MoreVertical size={16} />
              </button>
              {showMenu && (
                <div className="absolute right-0 top-8 w-44 rounded-lg bg-slate-800 border border-slate-700 shadow-xl z-20 py-1">
                  {isAdmin && (
                    <button onClick={() => { onPin?.(post.id, !post.is_pinned); setShowMenu(false) }} className="w-full px-3 py-2 text-left text-sm text-slate-300 hover:bg-slate-700 flex items-center gap-2">
                      <Pin size={14} /> {post.is_pinned ? 'Desfijar' : 'Fijar arriba'}
                    </button>
                  )}
                  <button onClick={() => { onDelete?.(post.id); setShowMenu(false) }} className="w-full px-3 py-2 text-left text-sm text-red-400 hover:bg-slate-700 flex items-center gap-2">
                    <Trash2 size={14} /> Eliminar
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Content */}
        <div className="text-sm text-slate-200 whitespace-pre-wrap mb-3 leading-relaxed">{post.content}</div>

        {/* Images */}
        {post.images && post.images.length > 0 && (
          <div className={`grid gap-2 mb-3 ${post.images.length === 1 ? 'grid-cols-1' : 'grid-cols-2'}`}>
            {post.images.map((img, i) => (
              <img key={i} src={img} alt="" className="rounded-lg w-full h-48 object-cover border border-slate-700" />
            ))}
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center gap-1 pt-2 border-t border-slate-700/50">
          <button onClick={toggleLike} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-colors ${liked ? 'text-red-400 bg-red-500/10' : 'text-slate-400 hover:text-red-400 hover:bg-red-500/10'}`}>
            <Heart size={16} fill={liked ? 'currentColor' : 'none'} /> {likesCount > 0 && likesCount}
          </button>
          <button onClick={loadComments} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-colors ${showComments ? 'text-cyan-400 bg-cyan-500/10' : 'text-slate-400 hover:text-cyan-400 hover:bg-cyan-500/10'}`}>
            <MessageCircle size={16} /> {post.comments_count > 0 && post.comments_count}
          </button>
        </div>

        {/* Comments section */}
        {showComments && (
          <div className="mt-3 pt-3 border-t border-slate-700/50 space-y-3">
            {loadingComments ? (
              <p className="text-xs text-slate-500 text-center py-2">Cargando comentarios...</p>
            ) : comments.length === 0 ? (
              <p className="text-xs text-slate-500 text-center py-2">Sin comentarios aún</p>
            ) : comments.map(c => (
              <div key={c.id} className="flex gap-2">
                <div className="w-7 h-7 rounded-full bg-slate-700 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                  {c.author?.full_name?.charAt(0)?.toUpperCase() || '?'}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="bg-slate-900/50 rounded-lg px-3 py-2">
                    <p className="text-xs font-semibold text-white">{c.author?.full_name || 'Usuario'}</p>
                    <p className="text-xs text-slate-300 mt-0.5">{c.content}</p>
                  </div>
                  <p className="text-[10px] text-slate-600 mt-0.5 ml-1">{getTimeAgo(c.created_at)}</p>
                </div>
              </div>
            ))}
            {/* Comment input */}
            <form onSubmit={sendComment} className="flex gap-2">
              <input
                type="text"
                value={commentText}
                onChange={e => setCommentText(e.target.value)}
                placeholder="Escribí un comentario..."
                className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:border-cyan-500 focus:outline-none"
              />
              <button type="submit" disabled={!commentText.trim()} className="p-2 rounded-lg bg-cyan-600 text-white hover:bg-cyan-500 disabled:opacity-30 transition-colors">
                <Send size={16} />
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  )
}

function getTimeAgo(dateStr: string): string {
  const now = Date.now()
  const then = new Date(dateStr).getTime()
  const diff = now - then
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'Ahora'
  if (mins < 60) return `Hace ${mins} min`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `Hace ${hours}h`
  const days = Math.floor(hours / 24)
  if (days < 7) return `Hace ${days}d`
  return new Date(dateStr).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })
}
