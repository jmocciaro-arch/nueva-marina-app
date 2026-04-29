'use client'

import { use, useEffect, useState, useCallback } from 'react'
import { LiveMatchScorer } from '@/components/live-match-scorer'
import { MatchVoiceControl, type VoiceCommand } from '@/components/match-voice-control'
import { MatchCameraRecorder } from '@/components/match-camera-recorder'
import { MatchHighlightsGallery } from '@/components/match-highlights-gallery'
import { YouTubeLivestreamLink } from '@/components/youtube-livestream-link'
import { Button } from '@/components/ui/button'
import { ArrowLeft, Maximize2, Mic, MicOff, Camera, CameraOff, Sparkles, Film } from 'lucide-react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

interface PageProps {
  params: Promise<{ id: string }>
  searchParams: Promise<{ readonly?: string; back?: string; pro?: string }>
}

export default function MatchScorerPage({ params, searchParams }: PageProps) {
  const { id } = use(params)
  const sp = use(searchParams)
  const [fullscreen, setFullscreen] = useState(false)
  const [voiceEnabled, setVoiceEnabled] = useState(false)
  const [cameraVisible, setCameraVisible] = useState(false)
  const [showHighlights, setShowHighlights] = useState(false)
  const [proMode, setProMode] = useState(sp.pro === '1')

  const sessionId = parseInt(id, 10)
  const readOnly = sp.readonly === '1' || sp.readonly === 'true'
  const backUrl = sp.back ?? '/'
  const supabase = createClient()

  useEffect(() => {
    if (fullscreen && document.documentElement.requestFullscreen) {
      document.documentElement.requestFullscreen().catch(() => {})
    } else if (!fullscreen && document.fullscreenElement) {
      document.exitFullscreen?.().catch(() => {})
    }
  }, [fullscreen])

  // ─── Comandos de voz → ejecutar acciones ─────────────────────────────────
  const handleVoiceCommand = useCallback(async (cmd: VoiceCommand) => {
    if (cmd.type === 'unknown') return

    // Loggear comando reconocido
    await supabase.from('nm_voice_commands').insert({
      session_id: sessionId,
      raw_transcript: '',
      recognized_command: cmd.type,
      executed: true,
    })

    if (cmd.type === 'point') {
      // Cargar sesión actual y reusar la lógica del scorer
      const { data: session } = await supabase.from('nm_live_match_sessions').select('*').eq('id', sessionId).single()
      if (!session || session.status === 'completed') return

      // Insertar punto directamente vía API simple
      // (la lógica completa de cálculo está en el componente — acá disparamos un evento custom)
      window.dispatchEvent(new CustomEvent('match-voice-point', {
        detail: { team: cmd.team, pointType: cmd.pointType ?? 'normal' }
      }))
    } else if (cmd.type === 'undo') {
      window.dispatchEvent(new CustomEvent('match-voice-undo'))
    } else if (cmd.type === 'pause' || cmd.type === 'resume') {
      window.dispatchEvent(new CustomEvent('match-voice-pause'))
    }
  }, [sessionId, supabase])

  if (isNaN(sessionId)) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center text-white">
        <p>ID de sesión inválido</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-950">
      {/* Top bar */}
      <div className="bg-slate-900 border-b border-slate-800 px-3 py-2 flex items-center justify-between gap-2">
        <Link href={backUrl}>
          <Button variant="ghost" size="sm" className="gap-1">
            <ArrowLeft size={14} /> <span className="hidden sm:inline">Volver</span>
          </Button>
        </Link>

        <div className="flex items-center gap-2">
          {!readOnly && (
            <>
              <Button
                size="sm"
                variant={proMode ? 'primary' : 'ghost'}
                onClick={() => setProMode(!proMode)}
                className="gap-1"
                title="Modo Pro: voz + cámara + replay"
              >
                <Sparkles size={14} /> <span className="hidden sm:inline">Pro</span>
              </Button>
              {proMode && (
                <>
                  <Button
                    size="sm"
                    variant={voiceEnabled ? 'primary' : 'ghost'}
                    onClick={() => setVoiceEnabled(!voiceEnabled)}
                    className="gap-1"
                  >
                    {voiceEnabled ? <Mic size={14} /> : <MicOff size={14} />}
                    <span className="hidden sm:inline">Voz</span>
                  </Button>
                  <Button
                    size="sm"
                    variant={cameraVisible ? 'primary' : 'ghost'}
                    onClick={() => setCameraVisible(!cameraVisible)}
                    className="gap-1"
                  >
                    {cameraVisible ? <Camera size={14} /> : <CameraOff size={14} />}
                    <span className="hidden sm:inline">Cámara</span>
                  </Button>
                </>
              )}
              <Button size="sm" variant="ghost" onClick={() => setShowHighlights(!showHighlights)} className="gap-1">
                <Film size={14} /> <span className="hidden sm:inline">Highlights</span>
              </Button>
            </>
          )}
          <Button variant="ghost" size="sm" onClick={() => setFullscreen(!fullscreen)} className="gap-1">
            <Maximize2 size={14} />
          </Button>
        </div>
      </div>

      {/* Stream de YouTube (si hay alguno linkeado) */}
      <div className="max-w-7xl mx-auto px-3 sm:px-6 pt-4">
        <YouTubeLivestreamLink matchType="friendly" sessionId={sessionId} canEdit={!readOnly} />
      </div>

      {/* Marcador principal */}
      <LiveMatchScorer sessionId={sessionId} readOnly={readOnly} onMatchEnd={async () => {
        try {
          await fetch('/api/live-match', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ session_id: sessionId }),
          })
        } catch { /* ignore */ }
      }} />

      {/* Modo PRO: cámara + voz + highlights */}
      {!readOnly && proMode && (
        <>
          {/* Cámara fija a la izquierda en desktop, debajo en mobile */}
          {cameraVisible && (
            <div className="fixed bottom-4 right-4 w-72 sm:w-80 z-30">
              <MatchCameraRecorder sessionId={sessionId} />
            </div>
          )}

          {/* Comandos de voz */}
          <MatchVoiceControl onCommand={handleVoiceCommand} enabled={voiceEnabled} />
        </>
      )}

      {/* Galería de highlights (slideout) */}
      {showHighlights && (
        <div className="fixed inset-0 z-40 bg-black/80 backdrop-blur" onClick={() => setShowHighlights(false)}>
          <div
            className="absolute right-0 top-0 bottom-0 w-full sm:w-96 bg-slate-900 border-l border-slate-800 p-4 overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <Film size={20} className="text-cyan-400" /> Highlights del partido
              </h2>
              <button onClick={() => setShowHighlights(false)} className="text-slate-400 hover:text-white">
                ✕
              </button>
            </div>
            <MatchHighlightsGallery sessionId={sessionId} canEdit={!readOnly} />
          </div>
        </div>
      )}
    </div>
  )
}
