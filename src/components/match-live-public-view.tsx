'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Play, Star, Eye, Volleyball, Trophy, ExternalLink, Film, Radio } from 'lucide-react'
import { Modal } from '@/components/ui/modal'

interface Session {
  id: number
  status: string
  team1_player1_name: string
  team1_player2_name: string
  team2_player1_name: string
  team2_player2_name: string
  current_set: number
  current_game_team1: number
  current_game_team2: number
  current_point_team1: string
  current_point_team2: string
  sets_team1: number
  sets_team2: number
  serving_team: number
  in_tiebreak: boolean
  tiebreak_team1: number
  tiebreak_team2: number
  winner_team: number | null
}

interface Highlight {
  id: number
  video_url: string
  thumbnail_url: string | null
  scoring_team: number | null
  scoring_player_name: string | null
  point_type: string | null
  is_featured: boolean
  view_count: number
  created_at: string
  youtube_url?: string | null
}

interface Stream {
  id: number
  embed_url: string | null
  stream_url: string
  title: string | null
}

interface Props {
  matchType: 'tournament' | 'league'
  matchId: number
  compact?: boolean
}

export function MatchLivePublicView({ matchType, matchId, compact = false }: Props) {
  const supabase = createClient()
  const [session, setSession] = useState<Session | null>(null)
  const [highlights, setHighlights] = useState<Highlight[]>([])
  const [streams, setStreams] = useState<Stream[]>([])
  const [loading, setLoading] = useState(true)
  const [playing, setPlaying] = useState<Highlight | null>(null)

  const load = useCallback(async () => {
    const { data: ses } = await supabase
      .from('nm_live_match_sessions')
      .select('*')
      .eq('match_type', matchType)
      .eq('match_id', matchId)
      .maybeSingle()

    setSession(ses as Session | null)

    // Streams en vivo linkeados a este match
    const { data: strms } = await supabase
      .from('nm_match_livestreams')
      .select('id, embed_url, stream_url, title')
      .eq('match_type', matchType)
      .eq('match_id', matchId)
      .eq('is_live', true)
    setStreams((strms ?? []) as Stream[])

    if (ses) {
      const { data: hls } = await supabase
        .from('nm_match_highlights')
        .select('*')
        .eq('session_id', ses.id)
        .order('is_featured', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(compact ? 3 : 12)
      setHighlights((hls ?? []) as Highlight[])
    }
    setLoading(false)
  }, [matchType, matchId, supabase, compact])

  useEffect(() => {
    load()
    if (!session) return

    const channel = supabase
      .channel(`match-public-${matchType}-${matchId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'nm_live_match_sessions', filter: `id=eq.${session.id}` }, () => load())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'nm_match_highlights', filter: `session_id=eq.${session.id}` }, () => load())
      .subscribe()
    return () => { channel.unsubscribe() }
  }, [matchType, matchId, supabase, load, session])

  if (loading) return null
  if (!session) return null

  const isLive = session.status === 'live'
  const isCompleted = session.status === 'completed'

  return (
    <Card className="!p-0 overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-cyan-500/10 via-slate-800/50 to-rose-500/10 border-b border-slate-700/50 px-4 py-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Volleyball size={14} className="text-cyan-400" />
          <span className="text-xs font-bold text-white">Marcador del partido</span>
        </div>
        <div className="flex items-center gap-2">
          {isLive && <Badge variant="cyan">● EN VIVO</Badge>}
          {isCompleted && <Badge variant="success">FINAL</Badge>}
          {session.in_tiebreak && <Badge variant="warning">TIEBREAK</Badge>}
          <Link href={`/match/${session.id}?readonly=1`} className="text-xs text-cyan-400 hover:text-cyan-300 flex items-center gap-1">
            Ver completo <ExternalLink size={10} />
          </Link>
        </div>
      </div>

      {/* Marcador compacto */}
      <div className="grid grid-cols-2 divide-x divide-slate-700/50">
        {/* Equipo CYAN */}
        <div className={`p-4 ${session.winner_team === 1 ? 'bg-amber-500/10' : 'bg-cyan-500/5'}`}>
          <div className="flex items-center gap-2 mb-2">
            <div className={`w-2 h-2 rounded-full bg-cyan-400 ${session.serving_team === 1 ? 'animate-pulse' : ''}`} />
            <span className="text-xs font-bold uppercase text-cyan-300">CYAN</span>
            {session.serving_team === 1 && <Volleyball size={10} className="text-cyan-400" />}
            {session.winner_team === 1 && <Trophy size={12} className="text-amber-400" />}
          </div>
          <div className="text-xs text-slate-300 truncate">{session.team1_player1_name}</div>
          <div className="text-xs text-slate-300 truncate">{session.team1_player2_name}</div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-3xl font-black font-mono text-cyan-300">
              {session.in_tiebreak ? session.tiebreak_team1 : session.current_point_team1}
            </span>
            <span className="text-xs text-slate-500">
              · {session.current_game_team1} games · {session.sets_team1} sets
            </span>
          </div>
        </div>

        {/* Equipo ROSA */}
        <div className={`p-4 ${session.winner_team === 2 ? 'bg-amber-500/10' : 'bg-rose-500/5'}`}>
          <div className="flex items-center gap-2 mb-2">
            <div className={`w-2 h-2 rounded-full bg-rose-400 ${session.serving_team === 2 ? 'animate-pulse' : ''}`} />
            <span className="text-xs font-bold uppercase text-rose-300">ROSA</span>
            {session.serving_team === 2 && <Volleyball size={10} className="text-rose-400" />}
            {session.winner_team === 2 && <Trophy size={12} className="text-amber-400" />}
          </div>
          <div className="text-xs text-slate-300 truncate">{session.team2_player1_name}</div>
          <div className="text-xs text-slate-300 truncate">{session.team2_player2_name}</div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-3xl font-black font-mono text-rose-300">
              {session.in_tiebreak ? session.tiebreak_team2 : session.current_point_team2}
            </span>
            <span className="text-xs text-slate-500">
              · {session.current_game_team2} games · {session.sets_team2} sets
            </span>
          </div>
        </div>
      </div>

      {/* Stream en vivo de YouTube */}
      {streams.length > 0 && streams[0].embed_url && (
        <div className="border-t border-slate-700/50">
          <div className="flex items-center gap-2 px-3 py-2 bg-red-500/10 border-b border-red-500/20">
            <Radio size={12} className="text-red-400 animate-pulse" />
            <span className="text-xs font-bold text-red-300 uppercase">Stream en vivo</span>
            <span className="text-xs text-white truncate flex-1">{streams[0].title ?? 'YouTube Live'}</span>
            <a href={streams[0].stream_url} target="_blank" rel="noopener noreferrer" className="text-xs text-cyan-400 hover:text-cyan-300 flex items-center gap-1">
              YouTube <ExternalLink size={10} />
            </a>
          </div>
          <div className="aspect-video bg-black">
            <iframe
              src={streams[0].embed_url}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              className="w-full h-full"
            />
          </div>
        </div>
      )}

      {/* Highlights */}
      {highlights.length > 0 && (
        <div className="border-t border-slate-700/50 p-3">
          <div className="flex items-center gap-2 mb-2">
            <Film size={14} className="text-amber-400" />
            <span className="text-xs font-bold text-white">Mejores momentos ({highlights.length})</span>
          </div>
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-1.5">
            {highlights.map(h => (
              <button
                key={h.id}
                onClick={() => setPlaying(h)}
                className="group relative aspect-video bg-slate-800 rounded overflow-hidden hover:ring-2 hover:ring-cyan-500"
              >
                {h.thumbnail_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={h.thumbnail_url} alt="" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <Film size={20} className="text-slate-600" />
                  </div>
                )}
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                  <Play size={20} className="text-white" fill="white" />
                </div>
                {h.is_featured && (
                  <div className="absolute top-0.5 left-0.5 bg-amber-500 rounded-full p-0.5">
                    <Star size={8} className="text-white" fill="white" />
                  </div>
                )}
                {h.scoring_team && (
                  <div className={`absolute bottom-0 left-0 right-0 h-1 ${h.scoring_team === 1 ? 'bg-cyan-500' : 'bg-rose-500'}`} />
                )}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Modal player */}
      {playing && (
        <Modal open onClose={() => setPlaying(null)} title="Highlight" size="lg">
          <div className="space-y-3">
            <video src={playing.video_url} controls autoPlay loop className="w-full rounded-xl bg-black aspect-video" />
            <div className="flex items-center justify-between text-xs">
              {playing.scoring_player_name && (
                <span className="text-white">
                  Punto de <span className="font-bold">{playing.scoring_player_name}</span>
                </span>
              )}
              {playing.point_type && (
                <Badge variant="cyan">{playing.point_type.replace('_', ' ')}</Badge>
              )}
              <span className="text-slate-500 flex items-center gap-1">
                <Eye size={10} /> {playing.view_count}
              </span>
            </div>
          </div>
        </Modal>
      )}
    </Card>
  )
}
