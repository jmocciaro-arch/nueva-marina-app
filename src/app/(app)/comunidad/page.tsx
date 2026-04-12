'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/lib/auth-context'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { PostCard } from '@/components/post-card'
import { useToast } from '@/components/ui/toast'
import { MessageSquare, Send, Image, Megaphone } from 'lucide-react'
import type { Post } from '@/types'

export default function ComunidadPlayerPage() {
  const { user } = useAuth()
  const { toast } = useToast()
  const [posts, setPosts] = useState<(Post & { author?: { full_name: string; avatar_url?: string } })[]>([])
  const [loading, setLoading] = useState(true)
  const [hasMore, setHasMore] = useState(true)
  const [page, setPage] = useState(0)
  const PAGE_SIZE = 20

  // Compose
  const [composeOpen, setComposeOpen] = useState(false)
  const [composeText, setComposeText] = useState('')
  const [publishing, setPublishing] = useState(false)

  const loadPosts = useCallback(async (pageNum: number, append = false) => {
    if (!append) setLoading(true)
    const supabase = createClient()

    const { data } = await supabase
      .from('nm_posts')
      .select('*, author:nm_users(full_name, avatar_url)')
      .eq('club_id', 1)
      .in('visibility', ['public', 'members'])
      .order('is_pinned', { ascending: false })
      .order('created_at', { ascending: false })
      .range(pageNum * PAGE_SIZE, (pageNum + 1) * PAGE_SIZE - 1)

    const newPosts = (data || []) as typeof posts
    if (append) {
      setPosts(prev => [...prev, ...newPosts])
    } else {
      setPosts(newPosts)
    }
    setHasMore(newPosts.length === PAGE_SIZE)
    setLoading(false)
  }, [])

  useEffect(() => { loadPosts(0) }, [loadPosts])

  // User likes
  const [userLikes, setUserLikes] = useState<Set<number>>(new Set())
  useEffect(() => {
    if (!user || posts.length === 0) return
    const supabase = createClient()
    supabase
      .from('nm_post_likes')
      .select('post_id')
      .eq('user_id', user.id)
      .in('post_id', posts.map(p => p.id))
      .then(({ data }) => {
        setUserLikes(new Set((data || []).map(l => l.post_id)))
      })
  }, [user, posts])

  function loadMore() {
    const nextPage = page + 1
    setPage(nextPage)
    loadPosts(nextPage, true)
  }

  async function handlePublish(e: React.FormEvent) {
    e.preventDefault()
    if (!composeText.trim() || !user) return
    setPublishing(true)
    const supabase = createClient()

    const { error } = await supabase.from('nm_posts').insert({
      club_id: 1,
      author_id: user.id,
      type: 'post',
      content: composeText.trim(),
      images: [],
      visibility: 'members',
      is_pinned: false,
    })

    if (error) {
      toast('error', 'Error: ' + error.message)
    } else {
      toast('success', 'Publicación creada')
      setComposeText('')
      setComposeOpen(false)
      setPage(0)
      loadPosts(0)
    }
    setPublishing(false)
  }

  async function handleDelete(postId: number) {
    if (!confirm('¿Eliminar tu publicación?')) return
    const supabase = createClient()
    await supabase.from('nm_post_likes').delete().eq('post_id', postId)
    await supabase.from('nm_post_comments').delete().eq('post_id', postId)
    const { error } = await supabase.from('nm_posts').delete().eq('id', postId)
    if (error) {
      toast('error', 'Error: ' + error.message)
    } else {
      toast('info', 'Publicación eliminada')
      setPage(0)
      loadPosts(0)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Comunidad</h1>
        <p className="text-sm text-slate-400 mt-1">Publicaciones, anuncios y noticias del club</p>
      </div>

      {/* Compose area */}
      <div className="rounded-xl border border-slate-700/50 bg-slate-800/50 p-4">
        {!composeOpen ? (
          <button
            onClick={() => setComposeOpen(true)}
            className="w-full flex items-center gap-3 text-left"
          >
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
              {user?.full_name?.charAt(0)?.toUpperCase() || '?'}
            </div>
            <div className="flex-1 bg-slate-900 border border-slate-700 rounded-full px-4 py-2.5 text-sm text-slate-500">
              ¿Qué querés compartir?
            </div>
          </button>
        ) : (
          <form onSubmit={handlePublish} className="space-y-3">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                {user?.full_name?.charAt(0)?.toUpperCase() || '?'}
              </div>
              <textarea
                value={composeText}
                onChange={e => setComposeText(e.target.value)}
                placeholder="Compartí algo con la comunidad..."
                rows={3}
                autoFocus
                className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:border-cyan-500 focus:outline-none resize-none"
              />
            </div>
            <div className="flex items-center justify-end gap-2">
              <Button variant="ghost" type="button" onClick={() => { setComposeOpen(false); setComposeText('') }}>
                Cancelar
              </Button>
              <Button type="submit" loading={publishing} disabled={!composeText.trim()}>
                <Send size={14} className="mr-1" /> Publicar
              </Button>
            </div>
          </form>
        )}
      </div>

      {/* Feed */}
      {loading ? (
        <div className="text-center py-12 text-slate-500">Cargando...</div>
      ) : posts.length === 0 ? (
        <Card>
          <div className="flex flex-col items-center py-12">
            <div className="w-16 h-16 rounded-2xl bg-slate-700/50 flex items-center justify-center mb-4">
              <MessageSquare size={32} className="text-slate-500" />
            </div>
            <h3 className="text-lg font-semibold text-white">Sin publicaciones</h3>
            <p className="text-sm text-slate-400 mt-2">Sé el primero en compartir algo con la comunidad</p>
          </div>
        </Card>
      ) : (
        <div className="space-y-4">
          {posts.map(post => (
            <PostCard
              key={post.id}
              post={{ ...post, user_liked: userLikes.has(post.id) }}
              currentUserId={user?.id || ''}
              isAdmin={false}
              onDelete={post.author_id === user?.id ? handleDelete : undefined}
              onRefresh={() => { setPage(0); loadPosts(0) }}
            />
          ))}
          {hasMore && (
            <div className="text-center pt-2">
              <Button variant="ghost" onClick={loadMore}>
                Cargar más publicaciones
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
