'use client'

import { useEffect, useState, useCallback } from 'react'
import { PlaySquare, Plus, X, ExternalLink, Radio, Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Modal } from '@/components/ui/modal'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/components/ui/toast'
import { extractYouTubeId, getYouTubeEmbedUrl, getYouTubeThumbnailUrl } from '@/lib/youtube/client'

interface Stream {
  id: number
  session_id: number | null
  match_type: string
  match_id: number | null
  platform: string
  stream_url: string
  video_id: string | null
  embed_url: string | null
  thumbnail_url: string | null
  title: string | null
  is_live: boolean
}

interface Props {
  matchType: 'tournament' | 'league' | 'friendly'
  matchId?: number
  sessionId?: number
  canEdit?: boolean
}

export function YouTubeLivestreamLink({ matchType, matchId, sessionId, canEdit = true }: Props) {
  const { toast } = useToast()
  const supabase = createClient()
  const [streams, setStreams] = useState<Stream[]>([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [showBroadcasts, setShowBroadcasts] = useState(false)
  const [url, setUrl] = useState('')
  const [title, setTitle] = useState('')
  const [saving, setSaving] = useState(false)
  const [broadcasts, setBroadcasts] = useState<{ id: string; title: string; thumbnail: string; embedUrl: string; watchUrl: string }[]>([])
  const [loadingBroadcasts, setLoadingBroadcasts] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    let query = supabase.from('nm_match_livestreams').select('*').eq('is_live', true)
    if (sessionId) query = query.eq('session_id', sessionId)
    else if (matchId) query = query.eq('match_type', matchType).eq('match_id', matchId)
    const { data } = await query.order('created_at', { ascending: false })
    setStreams((data ?? []) as Stream[])
    setLoading(false)
  }, [matchType, matchId, sessionId, supabase])

  useEffect(() => {
    load()
    const channel = supabase
      .channel(`streams-${matchType}-${matchId ?? sessionId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'nm_match_livestreams' }, () => load())
      .subscribe()
    return () => { channel.unsubscribe() }
  }, [supabase, load, matchType, matchId, sessionId])

  async function addStream(streamUrl: string, streamTitle: string) {
    const videoId = extractYouTubeId(streamUrl)
    if (!videoId) {
      toast('error', 'URL de YouTube inválida')
      return
    }
    setSaving(true)
    const { error } = await supabase.from('nm_match_livestreams').insert({
      session_id: sessionId ?? null,
      match_type: matchType,
      match_id: matchId ?? null,
      platform: 'youtube',
      stream_url: streamUrl,
      video_id: videoId,
      embed_url: getYouTubeEmbedUrl(videoId, { autoplay: true }),
      thumbnail_url: getYouTubeThumbnailUrl(videoId, 'high'),
      title: streamTitle || null,
      is_live: true,
    })
    setSaving(false)
    if (error) {
      toast('error', error.message)
      return
    }
    toast('success', 'Stream linkeado')
    setUrl('')
    setTitle('')
    setShowAdd(false)
  }

  async function removeStream(streamId: number) {
    if (!confirm('¿Quitar este stream?')) return
    await supabase.from('nm_match_livestreams').update({ is_live: false, ended_at: new Date().toISOString() }).eq('id', streamId)
    toast('info', 'Stream quitado')
  }

  async function loadBroadcasts() {
    setLoadingBroadcasts(true)
    try {
      const res = await fetch('/api/youtube/livestreams')
      const j = await res.json()
      if (!res.ok) throw new Error(j.error ?? 'Error')
      setBroadcasts(j.broadcasts ?? [])
      if ((j.broadcasts ?? []).length === 0) {
        toast('info', 'No hay streams en vivo en tu canal de YouTube ahora mismo')
      }
    } catch (e) {
      toast('error', (e as Error).message)
    } finally {
      setLoadingBroadcasts(false)
    }
  }

  if (loading && streams.length === 0) return null

  return (
    <div className="space-y-3">
      {/* Streams activos */}
      {streams.map(s => (
        <div key={s.id} className="rounded-2xl overflow-hidden border-2 border-red-500/40 bg-slate-900">
          <div className="flex items-center justify-between bg-red-500/10 border-b border-red-500/30 px-3 py-2">
            <div className="flex items-center gap-2">
              <Radio size={14} className="text-red-400 animate-pulse" />
              <Badge variant="danger">EN VIVO</Badge>
              <span className="text-xs text-white truncate flex-1">{s.title ?? 'Stream de YouTube'}</span>
            </div>
            <div className="flex items-center gap-1">
              <a href={s.stream_url} target="_blank" rel="noopener noreferrer" className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800" title="Abrir en YouTube">
                <ExternalLink size={14} />
              </a>
              {canEdit && (
                <button onClick={() => removeStream(s.id)} className="p-1.5 rounded-lg text-red-400 hover:bg-red-500/10" title="Quitar">
                  <X size={14} />
                </button>
              )}
            </div>
          </div>
          {s.embed_url && (
            <div className="aspect-video bg-black">
              <iframe
                src={s.embed_url}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                className="w-full h-full"
              />
            </div>
          )}
        </div>
      ))}

      {/* Botón agregar */}
      {canEdit && streams.length === 0 && (
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" onClick={() => setShowAdd(true)} className="gap-1.5 text-red-400 border-red-500/40">
            <PlaySquare size={14} /> Linkear stream de YouTube
          </Button>
          <Button size="sm" variant="ghost" onClick={() => { loadBroadcasts(); setShowBroadcasts(true) }} className="gap-1.5">
            <Radio size={14} /> Ver mis lives activos
          </Button>
        </div>
      )}

      {/* Modal: agregar URL manualmente */}
      {showAdd && (
        <Modal open onClose={() => setShowAdd(false)} title="Linkear stream de YouTube" size="md">
          <div className="space-y-3">
            <p className="text-xs text-slate-400">
              Pegá el link del stream o video. Se va a embeber en la página del partido para que el público lo vea.
            </p>
            <Input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://www.youtube.com/watch?v=..."
              autoFocus
            />
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Título (opcional)"
            />
            <div className="flex gap-2">
              <Button variant="ghost" onClick={() => setShowAdd(false)} className="flex-1" disabled={saving}>Cancelar</Button>
              <Button onClick={() => addStream(url, title)} disabled={saving || !url} className="flex-1 gap-1.5">
                {saving ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                Linkear
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Modal: lista de broadcasts del canal */}
      {showBroadcasts && (
        <Modal open onClose={() => setShowBroadcasts(false)} title="Streams en vivo de tu canal" size="lg">
          {loadingBroadcasts ? (
            <div className="text-center py-8"><Loader2 className="animate-spin mx-auto text-slate-400" /></div>
          ) : broadcasts.length === 0 ? (
            <div className="text-center py-8 text-slate-500 text-sm">
              <Radio size={32} className="mx-auto mb-2 opacity-50" />
              No hay streams en vivo en tu canal ahora mismo.
              <p className="mt-2 text-xs">Si recién iniciaste el live, esperá unos segundos y refrescá.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {broadcasts.map(b => (
                <button
                  key={b.id}
                  onClick={() => addStream(b.watchUrl, b.title)}
                  className="w-full flex items-center gap-3 p-2 rounded-xl bg-slate-800/50 hover:bg-slate-800 border border-slate-700 text-left"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={b.thumbnail} alt="" className="w-24 aspect-video rounded object-cover" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white truncate">{b.title}</p>
                    <Badge variant="danger">EN VIVO</Badge>
                  </div>
                  <Plus size={20} className="text-cyan-400 shrink-0" />
                </button>
              ))}
            </div>
          )}
        </Modal>
      )}
    </div>
  )
}
