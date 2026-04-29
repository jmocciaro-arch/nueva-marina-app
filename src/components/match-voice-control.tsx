'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { Mic, MicOff, Volume2 } from 'lucide-react'

// ─── Web Speech API types ───────────────────────────────────────────────────

interface ISpeechRecognitionEvent extends Event {
  results: ArrayLike<{
    isFinal: boolean
    [key: number]: { transcript: string; confidence: number }
  }>
  resultIndex: number
}

interface ISpeechRecognition extends EventTarget {
  continuous: boolean
  interimResults: boolean
  lang: string
  start: () => void
  stop: () => void
  abort: () => void
  onresult: ((event: ISpeechRecognitionEvent) => void) | null
  onerror: ((event: Event) => void) | null
  onend: (() => void) | null
}

declare global {
  interface Window {
    SpeechRecognition?: new () => ISpeechRecognition
    webkitSpeechRecognition?: new () => ISpeechRecognition
  }
}

// ─── Comandos reconocidos ────────────────────────────────────────────────────

export type VoiceCommand =
  | { type: 'point'; team: 1 | 2; pointType?: string }
  | { type: 'undo' }
  | { type: 'pause' }
  | { type: 'resume' }
  | { type: 'unknown'; transcript: string }

interface MatchVoiceControlProps {
  onCommand: (cmd: VoiceCommand) => void
  team1Label?: string
  team2Label?: string
  enabled?: boolean
}

// Diccionario de comandos en español rioplatense + español neutro
const COMMAND_PATTERNS: { pattern: RegExp; build: (m: RegExpMatchArray) => VoiceCommand }[] = [
  // Puntos al equipo 1 (cyan, azul, izquierda, casa, locales)
  { pattern: /\b(punto|tanto)\s+(cyan|cian|azul|izquierda|izq|local|locales|casa|uno|equipo\s*uno|equipo\s*1)\b/i,
    build: () => ({ type: 'point', team: 1 }) },
  { pattern: /\b(cyan|cian|azul|izquierda)\s+(punto|tanto|gan[óo])\b/i,
    build: () => ({ type: 'point', team: 1 }) },

  // Puntos al equipo 2 (rosa, rojo, derecha, visitantes, dos)
  { pattern: /\b(punto|tanto)\s+(rosa|rojo|roja|derecha|der|visitante|visitantes|dos|equipo\s*dos|equipo\s*2)\b/i,
    build: () => ({ type: 'point', team: 2 }) },
  { pattern: /\b(rosa|rojo|derecha)\s+(punto|tanto|gan[óo])\b/i,
    build: () => ({ type: 'point', team: 2 }) },

  // Tipos especiales (se asume que el siguiente comando dice el equipo)
  { pattern: /\b(ace)\s+(cyan|cian|azul|uno|1)\b/i,
    build: () => ({ type: 'point', team: 1, pointType: 'ace' }) },
  { pattern: /\b(ace)\s+(rosa|rojo|dos|2)\b/i,
    build: () => ({ type: 'point', team: 2, pointType: 'ace' }) },

  { pattern: /\b(winner|ganador)\s+(cyan|cian|azul|uno|1)\b/i,
    build: () => ({ type: 'point', team: 1, pointType: 'winner' }) },
  { pattern: /\b(winner|ganador)\s+(rosa|rojo|dos|2)\b/i,
    build: () => ({ type: 'point', team: 2, pointType: 'winner' }) },

  { pattern: /\b(error|falla|fall[óo])\s+(cyan|cian|azul|uno|1)\b/i,
    build: () => ({ type: 'point', team: 2, pointType: 'unforced_error' }) }, // error de cyan = punto a rosa
  { pattern: /\b(error|falla|fall[óo])\s+(rosa|rojo|dos|2)\b/i,
    build: () => ({ type: 'point', team: 1, pointType: 'unforced_error' }) },

  { pattern: /\b(doble\s+falta)\s+(cyan|cian|azul|uno|1)\b/i,
    build: () => ({ type: 'point', team: 2, pointType: 'double_fault' }) },
  { pattern: /\b(doble\s+falta)\s+(rosa|rojo|dos|2)\b/i,
    build: () => ({ type: 'point', team: 1, pointType: 'double_fault' }) },

  // Control
  { pattern: /\b(deshacer|cancelar|atr[áa]s|borrar\s+punto)\b/i, build: () => ({ type: 'undo' }) },
  { pattern: /\b(pausa|pausar|parar)\b/i, build: () => ({ type: 'pause' }) },
  { pattern: /\b(reanudar|continuar|seguir)\b/i, build: () => ({ type: 'resume' }) },
]

export function MatchVoiceControl({ onCommand, enabled = false }: MatchVoiceControlProps) {
  const [listening, setListening] = useState(false)
  const [transcript, setTranscript] = useState('')
  const [lastCommand, setLastCommand] = useState<string>('')
  const [error, setError] = useState<string | null>(null)
  const recognitionRef = useRef<ISpeechRecognition | null>(null)
  const enabledRef = useRef(enabled)
  enabledRef.current = enabled

  const parseTranscript = useCallback((text: string): VoiceCommand => {
    const cleaned = text.toLowerCase().trim()
    for (const { pattern, build } of COMMAND_PATTERNS) {
      const match = cleaned.match(pattern)
      if (match) return build(match)
    }
    return { type: 'unknown', transcript: cleaned }
  }, [])

  const start = useCallback(() => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SR) {
      setError('Tu navegador no soporta reconocimiento de voz. Usá Chrome o Edge.')
      return
    }
    if (recognitionRef.current) {
      try { recognitionRef.current.stop() } catch { /* ignore */ }
    }

    const recognition = new SR()
    recognition.continuous = true
    recognition.interimResults = true
    recognition.lang = 'es-ES'

    recognition.onresult = (event: ISpeechRecognitionEvent) => {
      let interim = ''
      let final = ''
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i]
        const text = result[0].transcript
        if (result.isFinal) final += text
        else interim += text
      }
      const display = (final || interim).trim()
      setTranscript(display)

      if (final) {
        const cmd = parseTranscript(final)
        if (cmd.type !== 'unknown') {
          onCommand(cmd)
          setLastCommand(final)
          setTimeout(() => setLastCommand(''), 3000)
          // Feedback sonoro
          try {
            const audio = new Audio('data:audio/wav;base64,UklGRl9vT19XQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQ==')
            audio.volume = 0.3
            audio.play().catch(() => {})
          } catch { /* ignore */ }
        }
      }
    }

    recognition.onerror = () => {
      // Errores frecuentes (no-speech, audio-capture) son normales
    }

    recognition.onend = () => {
      // Auto-reinicia mientras esté habilitado
      if (enabledRef.current) {
        setTimeout(() => {
          try { recognition.start() } catch { /* ya iniciado */ }
        }, 100)
      } else {
        setListening(false)
      }
    }

    try {
      recognition.start()
      recognitionRef.current = recognition
      setListening(true)
      setError(null)
    } catch (e) {
      setError('Error al iniciar micrófono: ' + (e as Error).message)
    }
  }, [onCommand, parseTranscript])

  const stop = useCallback(() => {
    if (recognitionRef.current) {
      try { recognitionRef.current.stop() } catch { /* ignore */ }
      recognitionRef.current = null
    }
    setListening(false)
    setTranscript('')
  }, [])

  useEffect(() => {
    if (enabled) start()
    else stop()
    return () => stop()
  }, [enabled, start, stop])

  if (!enabled) return null

  return (
    <div className="fixed bottom-4 left-4 right-4 sm:left-auto sm:right-4 sm:w-96 z-40 pointer-events-none">
      <div className={`bg-slate-900/95 backdrop-blur border-2 ${listening ? 'border-emerald-500/50' : 'border-slate-700'} rounded-2xl p-3 shadow-2xl pointer-events-auto`}>
        <div className="flex items-center gap-2">
          <div className={`w-3 h-3 rounded-full ${listening ? 'bg-emerald-500 animate-pulse' : 'bg-slate-600'}`} />
          {listening ? <Mic size={16} className="text-emerald-400" /> : <MicOff size={16} className="text-slate-500" />}
          <span className="text-xs font-medium text-white flex-1">
            {listening ? 'Escuchando comandos...' : 'Micrófono pausado'}
          </span>
        </div>

        {transcript && (
          <div className="mt-2 text-xs text-slate-300 italic">"{transcript}"</div>
        )}

        {lastCommand && (
          <div className="mt-2 text-xs text-emerald-400 flex items-center gap-1 animate-pulse">
            <Volume2 size={12} /> Comando: {lastCommand}
          </div>
        )}

        {error && (
          <div className="mt-2 text-xs text-red-400">{error}</div>
        )}

        <div className="mt-2 text-[10px] text-slate-500 leading-relaxed">
          Decí: <span className="text-cyan-400">"punto cyan"</span>, <span className="text-rose-400">"punto rosa"</span>, <span className="text-yellow-400">"ace cyan"</span>, <span className="text-red-400">"deshacer"</span>, <span className="text-amber-400">"pausa"</span>
        </div>
      </div>
    </div>
  )
}
