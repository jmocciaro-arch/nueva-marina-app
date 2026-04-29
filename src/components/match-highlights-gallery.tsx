'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Modal } from '@/components/ui/modal'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Play, Star, Eye, Trash2, Film, PlaySquare } from 'lucide-react'
import { useToast } from '@/components/ui/toast'
import { YouTubeUploadButton } from './youtube-upload-button'

interface Highlight {
  id: number
  session_id: number
  video_url: string
  thumbnail_url: string | null
  duration_seconds: number | null
  scoring_team: number | null
  scoring_player_name: string | null
  point_type: string | null
  game_score: string | null
  point_score: string | null
  set_number: number | null
  is_featured: boolean
  view_count: number
  notes: string | null
  created_at: string
  youtube_video_id?: string | null
  youtube_url?: string | null
  youtube_status?: string | null
}

interface Props {
  sessionId: number
  canEdit?: boolean
}

export function MatchHighlightsGallery({ sessionId, canEdit = true }: Props) {
  const { toast } = useToast()
  const supabase = createClient()
  const [highlights, setHighlights] = useState<Highlight[]>([])
  const [loading, setLoading] = useState(true)
  const [playing, setPlaying] = useState<Highlight | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase
      .from('nm_match_highlights')
      .select('*')
      .eq('session_id', sessionId)
      .order('created_at', { ascending: false })
    setHighlights((data ?? []) as Highlight[])
    setLoading(false)
  }, [sessionId, supabase])

  useEffect(() => {
    load()
    const channel = supabase
      .channel(`highlights-${sessionId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'nm_match_highlights', filter: `session_id=eq.${sessionId}` }, () => load())
      .subscribe()
    return () => { channel.unsubscribe() }
  }, [sessionId, supabase, load])

  const toggleFeatured = async (h: Highlight) => {
    await supabase.from('nm_match_highlights').update({ is_featured: !h.is_featured }).eq('id', h.id)
  }

  const deleteHighlight = async (h: Highlight) => {
    if (!confirm('¿Eliminar este highlight?')) return
    await supabase.from('nm_match_highlights').delete().eq('id', h.id)
    toast('info', 'Highlight eliminado')
  }

  const incrementView = async (h: Highlight) => {
    await supabase.from('nm_match_highlights').update({ view_count: h.view_count + 1 }).eq('id', h.id)
  }

  if (loading) return null
  if (highlights.length === 0) {
    return (
      <div className="text-center py-8 text-slate-500 text-sm">
        <Film size={24} className="mx-auto mb-2 opacity-50" />
        Sin highlights todavía. Capturá un replay para guardarlo acá.
      </div>
    )
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-bold text-white flex items-center gap-2">
          <Film size={16} className="text-cyan-400" /> Highlights ({highlights.length})
        </h3>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {highlights.map(h => (
          <button
            key={h.id}
            onClick={() => { setPlaying(h); incrementView(h) }}
            className="group relative aspect-video bg-slate-800 rounded-lg overflow-hidden hover:ring-2 hover:ring-cyan-500 transition-all"
          >
            {h.thumbnail_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={h.thumbnail_url} alt="" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full bg-slate-800 flex items-center justify-center">
                <Film size={32} className="text-slate-600" />
              </div>
            )}
            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
              <Play size={32} className="text-white" fill="white" />
            </div>
            {h.is_featured && (
              <div className="absolute top-1 left-1 bg-amber-500 rounded-full p-1">
                <Star size={10} className="text-white" fill="white" />
              </div>
            )}
            {h.youtube_video_id && (
              <div className="absolute top-1 right-1 bg-red-600 rounded p-0.5" title="Subido a YouTube">
                <PlaySquare size={10} className="text-white" />
              </div>
            )}
            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-1.5">
              <div className="text-[10px] text-white flex items-center justify-between">
                {h.scoring_team && (
                  <Badge variant={h.scoring_team === 1 ? 'cyan' : 'danger'}>E{h.scoring_team}</Badge>
                )}
                <span className="text-slate-300 flex items-center gap-1">
                  <Eye size={9} /> {h.view_count}
                </span>
              </div>
            </div>
          </button>
        ))}
      </div>

      {/* Player modal */}
      {playing && (
        <Modal open onClose={() => setPlaying(null)} title={`Highlight #${playing.id}`} size="lg">
          <div className="space-y-3">
            <video src={playing.video_url} controls autoPlay loop className="w-full rounded-xl bg-black aspect-video" />

            {/* Metadata */}
            <div className="grid grid-cols-2 gap-2 text-xs">
              {playing.set_number && (
                <div className="bg-slate-800/50 rounded-lg p-2">
                  <div className="text-slate-500">Set</div>
                  <div className="text-white font-bold">{playing.set_number}</div>
                </div>
              )}
              {playing.game_score && (
                <div className="bg-slate-800/50 rounded-lg p-2">
                  <div className="text-slate-500">Marcador</div>
                  <div className="text-white font-bold">{playing.game_score}</div>
                </div>
              )}
              {playing.scoring_player_name && (
                <div className="bg-slate-800/50 rounded-lg p-2 col-span-2">
                  <div className="text-slate-500">Punto de</div>
                  <div className="text-white font-bold">{playing.scoring_player_name}</div>
                </div>
              )}
              {playing.point_type && (
                <div className="bg-slate-800/50 rounded-lg p-2 col-span-2">
                  <div className="text-slate-500">Tipo</div>
                  <div className="text-white font-bold capitalize">{playing.point_type.replace('_', ' ')}</div>
                </div>
              )}
            </div>

            {playing.notes && (
              <div className="bg-slate-800/50 rounded-lg p-3 text-sm text-slate-300">
                {playing.notes}
              </div>
            )}

            {/* YouTube section */}
            {canEdit && (
              <div className="bg-red-500/5 border border-red-500/20 rounded-lg p-3 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <PlaySquare size={18} className="text-red-500" />
                  <div className="text-xs">
                    {playing.youtube_url ? (
                      <span className="text-emerald-400">✓ Subido a YouTube</span>
                    ) : playing.youtube_status === 'uploading' ? (
                      <span className="text-amber-400">⏳ Subiendo...</span>
                    ) : (
                      <span className="text-slate-400">No subido a YouTube</span>
                    )}
                  </div>
                </div>
                <YouTubeUploadButton
                  highlightId={playing.id}
                  isUploaded={!!playing.youtube_url}
                  youtubeUrl={playing.youtube_url}
                  defaultTitle={`${playing.scoring_player_name ?? 'Punto'} - Nueva Marina Pádel`}
                />
              </div>
            )}

            {canEdit && (
              <div className="flex gap-2 pt-2">
                <Button
                  variant="ghost"
                  onClick={() => toggleFeatured(playing)}
                  className="flex-1 gap-1.5"
                >
                  <Star size={14} fill={playing.is_featured ? 'currentColor' : 'none'} />
                  {playing.is_featured ? 'Quitar destacado' : 'Destacar'}
                </Button>
                <Button
                  variant="danger"
                  onClick={() => { deleteHighlight(playing); setPlaying(null) }}
                  className="gap-1.5"
                >
                  <Trash2 size={14} />
                </Button>
              </div>
            )}
          </div>
        </Modal>
      )}
    </div>
  )
}
