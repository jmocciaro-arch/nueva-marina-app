'use client'

import { useState, useCallback, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/lib/auth-context'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Card } from '@/components/ui/card'
import { Modal } from '@/components/ui/modal'
import { Badge } from '@/components/ui/badge'
import { KpiCard } from '@/components/ui/kpi-card'
import { PostCard } from '@/components/post-card'
import { useToast } from '@/components/ui/toast'
import { MessageSquare, Plus, Pin, Megaphone, Users, TrendingUp, Trash2, Search } from 'lucide-react'
import type { Post } from '@/types'

const VISIBILITY_OPTIONS = [
  { value: 'public', label: 'Público' },
  { value: 'members', label: 'Solo miembros' },
  { value: 'admin_only', label: 'Solo admins' },
]

const TYPE_OPTIONS = [
  { value: 'announcement', label: 'Anuncio' },
  { value: 'event', label: 'Evento' },
  { value: 'post', label: 'Publicación' },
  { value: 'achievement', label: 'Logro' },
  { value: 'result', label: 'Resultado' },
]

export default function AdminComunidadPage() {
  const { user } = useAuth()
  const { toast } = useToast()
  const [posts, setPosts] = useState<(Post & { author?: { full_name: string; avatar_url?: string } })[]>([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [search, setSearch] = useState('')
  const [filterType, setFilterType] = useState('all')

  const [formType, setFormType] = useState('announcement')
  const [formContent, setFormContent] = useState('')
  const [formVisibility, setFormVisibility] = useState('public')

  const loadPosts = useCallback(async () => {
    setLoading(true)
    const supabase = createClient()
    let query = supabase
      .from('nm_posts')
      .select('*, author:nm_users(full_name, avatar_url)')
      .eq('club_id', 1)
      .order('is_pinned', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(100)

    if (filterType !== 'all') {
      query = query.eq('type', filterType)
    }

    const { data } = await query
    setPosts((data || []) as typeof posts)
    setLoading(false)
  }, [filterType])

  useEffect(() => { loadPosts() }, [loadPosts])

  // Check user likes
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

  const totalPosts = posts.length
  const pinnedPosts = posts.filter(p => p.is_pinned).length
  const announcements = posts.filter(p => p.type === 'announcement').length
  const totalLikes = posts.reduce((s, p) => s + (p.likes_count || 0), 0)

  const filteredPosts = search
    ? posts.filter(p => p.content.toLowerCase().includes(search.toLowerCase()) || p.author?.full_name?.toLowerCase().includes(search.toLowerCase()))
    : posts

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!formContent.trim() || !user) return
    setSaving(true)
    const supabase = createClient()

    const { error } = await supabase.from('nm_posts').insert({
      club_id: 1,
      author_id: user.id,
      type: formType,
      content: formContent.trim(),
      images: [],
      visibility: formVisibility,
      is_pinned: false,
    })

    if (error) {
      toast('error', 'Error: ' + error.message)
    } else {
      toast('success', 'Publicación creada')
      setFormContent('')
      setFormType('announcement')
      setFormVisibility('public')
      setModalOpen(false)
      loadPosts()
    }
    setSaving(false)
  }

  async function handleDelete(postId: number) {
    if (!confirm('¿Eliminar esta publicación?')) return
    const supabase = createClient()
    // Delete likes and comments first
    await supabase.from('nm_post_likes').delete().eq('post_id', postId)
    await supabase.from('nm_post_comments').delete().eq('post_id', postId)
    const { error } = await supabase.from('nm_posts').delete().eq('id', postId)
    if (error) {
      toast('error', 'Error: ' + error.message)
    } else {
      toast('info', 'Publicación eliminada')
      loadPosts()
    }
  }

  async function handlePin(postId: number, pinned: boolean) {
    const supabase = createClient()
    const { error } = await supabase.from('nm_posts').update({ is_pinned: pinned }).eq('id', postId)
    if (error) {
      toast('error', 'Error: ' + error.message)
    } else {
      toast('success', pinned ? 'Publicación fijada' : 'Publicación desfijada')
      loadPosts()
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Comunidad</h1>
          <p className="text-sm text-slate-400 mt-1">Moderación del feed social, anuncios y publicaciones</p>
        </div>
        <Button onClick={() => setModalOpen(true)}>
          <Plus size={16} className="mr-1" />
          Nueva Publicación
        </Button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard title="Publicaciones" value={totalPosts} icon={<MessageSquare size={20} />} />
        <KpiCard title="Fijadas" value={pinnedPosts} icon={<Pin size={20} />} color="#06b6d4" />
        <KpiCard title="Anuncios" value={announcements} icon={<Megaphone size={20} />} color="#8b5cf6" />
        <KpiCard title="Total Likes" value={totalLikes} icon={<TrendingUp size={20} />} color="#ef4444" />
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar publicaciones..."
            className="w-full bg-slate-800 border border-slate-700 rounded-lg pl-9 pr-3 py-2 text-sm text-white placeholder:text-slate-500 focus:border-cyan-500 focus:outline-none"
          />
        </div>
        <div className="flex gap-1">
          {[{ v: 'all', l: 'Todas' }, { v: 'announcement', l: 'Anuncios' }, { v: 'post', l: 'Posts' }, { v: 'event', l: 'Eventos' }, { v: 'achievement', l: 'Logros' }, { v: 'result', l: 'Resultados' }].map(f => (
            <button key={f.v} onClick={() => setFilterType(f.v)} className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${filterType === f.v ? 'bg-cyan-600 text-white' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'}`}>
              {f.l}
            </button>
          ))}
        </div>
      </div>

      {/* Posts Feed */}
      {loading ? (
        <div className="text-center py-12 text-slate-500">Cargando...</div>
      ) : filteredPosts.length === 0 ? (
        <Card>
          <div className="text-center py-12">
            <MessageSquare size={48} className="text-slate-600 mx-auto mb-3" />
            <p className="text-slate-500">No hay publicaciones</p>
          </div>
        </Card>
      ) : (
        <div className="space-y-4">
          {filteredPosts.map(post => (
            <PostCard
              key={post.id}
              post={{ ...post, user_liked: userLikes.has(post.id) }}
              currentUserId={user?.id || ''}
              isAdmin
              onDelete={handleDelete}
              onPin={handlePin}
              onRefresh={loadPosts}
            />
          ))}
        </div>
      )}

      {/* New Post Modal */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Nueva Publicación"
        footer={
          <div className="flex items-center gap-3">
            <Button variant="ghost" onClick={() => setModalOpen(false)}>Cancelar</Button>
            <Button onClick={handleCreate} loading={saving}>Publicar</Button>
          </div>
        }
      >
        <form onSubmit={handleCreate} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Select label="Tipo" value={formType} onChange={e => setFormType(e.target.value)} options={TYPE_OPTIONS} />
            <Select label="Visibilidad" value={formVisibility} onChange={e => setFormVisibility(e.target.value)} options={VISIBILITY_OPTIONS} />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">Contenido</label>
            <textarea
              value={formContent}
              onChange={e => setFormContent(e.target.value)}
              placeholder="Escribí tu publicación..."
              rows={5}
              required
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:border-cyan-500 focus:outline-none resize-none"
            />
          </div>
        </form>
      </Modal>
    </div>
  )
}
