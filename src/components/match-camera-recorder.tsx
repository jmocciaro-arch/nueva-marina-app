'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { Camera, CameraOff, Play, Save, X, Video, RotateCcw, Maximize2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useToast } from '@/components/ui/toast'
import { Button } from '@/components/ui/button'
import { Modal } from '@/components/ui/modal'

interface MatchCameraRecorderProps {
  sessionId: number
  onHighlightSaved?: (highlight: { video_url: string; thumbnail_url: string }) => void
}

const REPLAY_BUFFER_SECONDS = 15  // mantenemos los últimos 15 seg para "VAR"

export function MatchCameraRecorder({ sessionId, onHighlightSaved }: MatchCameraRecorderProps) {
  const { toast } = useToast()
  const supabase = createClient()
  const videoRef = useRef<HTMLVideoElement>(null)
  const replayVideoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const [active, setActive] = useState(false)
  const [showReplay, setShowReplay] = useState(false)
  const [replayBlob, setReplayBlob] = useState<Blob | null>(null)
  const [savingHighlight, setSavingHighlight] = useState(false)
  const [showFullscreen, setShowFullscreen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('environment')

  // ─── Iniciar cámara ───────────────────────────────────────────────────────

  const startCamera = useCallback(async () => {
    try {
      // Cámara trasera (cancha) por defecto
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode, width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
      }

      // MediaRecorder con buffer circular
      const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
        ? 'video/webm;codecs=vp9'
        : 'video/webm'
      const recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 1_500_000 })

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          chunksRef.current.push(e.data)
          // Mantener solo últimos N segundos (~ N chunks de 1 seg)
          if (chunksRef.current.length > REPLAY_BUFFER_SECONDS) {
            chunksRef.current.shift()
          }
        }
      }

      recorder.start(1000) // chunk cada 1 segundo
      recorderRef.current = recorder
      setActive(true)
      setError(null)
    } catch (e) {
      setError('No se pudo acceder a la cámara: ' + (e as Error).message)
      setActive(false)
    }
  }, [facingMode])

  const stopCamera = useCallback(() => {
    if (recorderRef.current && recorderRef.current.state !== 'inactive') {
      recorderRef.current.stop()
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop())
      streamRef.current = null
    }
    chunksRef.current = []
    setActive(false)
  }, [])

  useEffect(() => {
    return () => stopCamera()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ─── Capturar replay (últimos N seg) ─────────────────────────────────────

  const captureReplay = useCallback(() => {
    if (chunksRef.current.length === 0) {
      toast('error', 'Sin video disponible aún')
      return
    }
    const blob = new Blob([...chunksRef.current], { type: 'video/webm' })
    setReplayBlob(blob)
    setShowReplay(true)

    // Reproducir en el modal
    setTimeout(() => {
      if (replayVideoRef.current) {
        replayVideoRef.current.src = URL.createObjectURL(blob)
        replayVideoRef.current.play().catch(() => {})
      }
    }, 100)
  }, [toast])

  // ─── Guardar como highlight ──────────────────────────────────────────────

  const saveHighlight = useCallback(async (notes?: string) => {
    if (!replayBlob) return
    setSavingHighlight(true)
    try {
      const filename = `highlight-${sessionId}-${Date.now()}.webm`
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('match-highlights')
        .upload(filename, replayBlob, {
          contentType: 'video/webm',
          cacheControl: '3600',
        })

      if (uploadError) {
        toast('error', `Error subiendo: ${uploadError.message}`)
        setSavingHighlight(false)
        return
      }

      const { data: { publicUrl } } = supabase.storage
        .from('match-highlights')
        .getPublicUrl(uploadData.path)

      // Generar thumbnail (frame del video)
      const thumbnail = await captureThumbnail(replayBlob)
      let thumbnailUrl = ''
      if (thumbnail) {
        const thumbName = `thumb-${sessionId}-${Date.now()}.jpg`
        const { data: thumbData } = await supabase.storage
          .from('match-highlights')
          .upload(thumbName, thumbnail, { contentType: 'image/jpeg' })
        if (thumbData) {
          thumbnailUrl = supabase.storage.from('match-highlights').getPublicUrl(thumbData.path).data.publicUrl
        }
      }

      // Crear registro en DB
      await supabase.from('nm_match_highlights').insert({
        session_id: sessionId,
        video_url: publicUrl,
        thumbnail_url: thumbnailUrl,
        duration_seconds: REPLAY_BUFFER_SECONDS,
        file_size_bytes: replayBlob.size,
        notes: notes ?? null,
      })

      toast('success', '¡Highlight guardado!')
      onHighlightSaved?.({ video_url: publicUrl, thumbnail_url: thumbnailUrl })
      setShowReplay(false)
      setReplayBlob(null)
    } catch (e) {
      toast('error', (e as Error).message)
    } finally {
      setSavingHighlight(false)
    }
  }, [replayBlob, sessionId, supabase, toast, onHighlightSaved])

  return (
    <>
      {/* ── Card de la cámara (mini preview) ──────────────────────── */}
      <div className="bg-slate-900/80 backdrop-blur border border-slate-700 rounded-2xl overflow-hidden">
        <div className="flex items-center justify-between px-3 py-2 bg-slate-800/50 border-b border-slate-700">
          <div className="flex items-center gap-2 text-sm">
            <div className={`w-2 h-2 rounded-full ${active ? 'bg-red-500 animate-pulse' : 'bg-slate-600'}`} />
            <Video size={14} className={active ? 'text-red-400' : 'text-slate-500'} />
            <span className="text-white font-medium">{active ? 'Grabando' : 'Cámara apagada'}</span>
            {active && <span className="text-[10px] text-slate-500">Buffer: {REPLAY_BUFFER_SECONDS}s</span>}
          </div>
          <div className="flex items-center gap-1">
            {active && (
              <>
                <button
                  onClick={() => setFacingMode(facingMode === 'user' ? 'environment' : 'user')}
                  className="p-1.5 rounded-lg hover:bg-slate-700 text-slate-400 hover:text-white"
                  title="Cambiar cámara"
                >
                  <RotateCcw size={14} />
                </button>
                <button
                  onClick={() => setShowFullscreen(true)}
                  className="p-1.5 rounded-lg hover:bg-slate-700 text-slate-400 hover:text-white"
                  title="Pantalla completa"
                >
                  <Maximize2 size={14} />
                </button>
              </>
            )}
            <button
              onClick={active ? stopCamera : startCamera}
              className={`p-1.5 rounded-lg ${active ? 'text-red-400 hover:bg-red-500/20' : 'text-emerald-400 hover:bg-emerald-500/20'}`}
            >
              {active ? <CameraOff size={16} /> : <Camera size={16} />}
            </button>
          </div>
        </div>

        <div className="relative aspect-video bg-black">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="w-full h-full object-cover"
          />
          {!active && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-slate-500">
              <Camera size={32} />
              <p className="text-xs">Tocá el ícono para iniciar</p>
            </div>
          )}
          {error && (
            <div className="absolute inset-0 flex items-center justify-center bg-red-900/30 p-4 text-center">
              <p className="text-xs text-red-300">{error}</p>
            </div>
          )}
          {active && (
            <button
              onClick={captureReplay}
              className="absolute bottom-2 right-2 bg-red-500 hover:bg-red-600 text-white rounded-full px-3 py-1.5 text-xs font-bold flex items-center gap-1.5 shadow-lg"
            >
              <Play size={12} fill="white" /> REPLAY ({REPLAY_BUFFER_SECONDS}s)
            </button>
          )}
        </div>
      </div>

      {/* ── Modal: replay + guardar ──────────────────────────────── */}
      {showReplay && replayBlob && (
        <Modal open onClose={() => setShowReplay(false)} title="Replay del punto" size="lg">
          <div className="space-y-3">
            <video
              ref={replayVideoRef}
              controls
              autoPlay
              loop
              className="w-full rounded-xl bg-black aspect-video"
            />
            <div className="text-xs text-slate-400 text-center">
              Últimos {REPLAY_BUFFER_SECONDS} segundos · Tamaño: {(replayBlob.size / 1024 / 1024).toFixed(2)} MB
            </div>
            <div className="flex gap-2">
              <Button variant="ghost" onClick={() => setShowReplay(false)} className="flex-1">
                <X size={14} className="mr-1" /> Descartar
              </Button>
              <Button onClick={() => saveHighlight()} disabled={savingHighlight} className="flex-1 gap-1.5">
                <Save size={14} /> {savingHighlight ? 'Guardando...' : 'Guardar como highlight'}
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* ── Modal: pantalla completa ─────────────────────────────── */}
      {showFullscreen && (
        <Modal open onClose={() => setShowFullscreen(false)} title="" size="xl">
          <div className="relative -m-4 sm:-m-6">
            <video
              autoPlay
              playsInline
              muted
              className="w-full bg-black aspect-video"
              ref={(el) => {
                if (el && streamRef.current) el.srcObject = streamRef.current
              }}
            />
            <button
              onClick={captureReplay}
              className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-red-500 hover:bg-red-600 text-white rounded-full px-6 py-3 text-base font-bold flex items-center gap-2 shadow-2xl"
            >
              <Play size={20} fill="white" /> REPLAY
            </button>
          </div>
        </Modal>
      )}
    </>
  )
}

// ─── Helper: capturar thumbnail desde un blob de video ─────────────────────

async function captureThumbnail(videoBlob: Blob): Promise<Blob | null> {
  return new Promise((resolve) => {
    const video = document.createElement('video')
    video.src = URL.createObjectURL(videoBlob)
    video.muted = true
    video.playsInline = true

    video.addEventListener('loadeddata', () => {
      video.currentTime = Math.min(2, video.duration / 2)
    })

    video.addEventListener('seeked', () => {
      const canvas = document.createElement('canvas')
      canvas.width = video.videoWidth || 640
      canvas.height = video.videoHeight || 360
      const ctx = canvas.getContext('2d')
      if (!ctx) {
        resolve(null)
        return
      }
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
      canvas.toBlob((blob) => {
        URL.revokeObjectURL(video.src)
        resolve(blob)
      }, 'image/jpeg', 0.8)
    }, { once: true })

    video.addEventListener('error', () => {
      URL.revokeObjectURL(video.src)
      resolve(null)
    })
  })
}
