'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import {
  KeyRound,
  Nfc,
  Fingerprint,
  ScanFace,
  LogIn,
  LogOut,
  Coffee,
  ChevronLeft,
  CheckCircle2,
  XCircle,
  Delete,
  CornerDownLeft,
  RefreshCw,
} from 'lucide-react'

// ─── Types ────────────────────────────────────────────────────────────────────

type AuthMethod = 'pin' | 'nfc' | 'fingerprint' | 'facial'
type ClockAction = 'clock_in' | 'clock_out' | 'break_start'
type FlowState = 'select_method' | 'enter_credential' | 'select_action' | 'result'

interface StaffUser {
  full_name: string
}

interface ResultData {
  success: boolean
  message: string
  action?: ClockAction
  timestamp?: string
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const ACTION_LABELS: Record<ClockAction, string> = {
  clock_in: 'Entrada registrada',
  clock_out: 'Salida registrada',
  break_start: 'Pausa registrada',
}

function formatTime(d: Date): string {
  return d.toLocaleTimeString('es-AR', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
}

function formatFullTime(d: Date): string {
  return d.toLocaleTimeString('es-AR', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  })
}

// ─── Live Clock ───────────────────────────────────────────────────────────────

function LiveClock() {
  const [now, setNow] = useState<Date>(new Date())

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(id)
  }, [])

  return (
    <div className="text-center select-none">
      <div className="text-5xl font-mono font-bold text-white tracking-widest tabular-nums">
        {formatFullTime(now)}
      </div>
      <p className="text-sm text-slate-500 mt-1">
        {now.toLocaleDateString('es-AR', {
          weekday: 'long',
          day: 'numeric',
          month: 'long',
          year: 'numeric',
        })}
      </p>
    </div>
  )
}

// ─── Numeric Keypad ───────────────────────────────────────────────────────────

const KEYPAD_KEYS = [
  ['1', '2', '3'],
  ['4', '5', '6'],
  ['7', '8', '9'],
  ['backspace', '0', 'enter'],
]

interface KeypadProps {
  pin: string
  onDigit: (d: string) => void
  onBackspace: () => void
  onEnter: () => void
  disabled: boolean
}

function Keypad({ pin, onDigit, onBackspace, onEnter, disabled }: KeypadProps) {
  // Keyboard support
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (disabled) return
      if (e.key >= '0' && e.key <= '9') onDigit(e.key)
      else if (e.key === 'Backspace') onBackspace()
      else if (e.key === 'Enter') onEnter()
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [disabled, onDigit, onBackspace, onEnter])

  return (
    <div className="flex flex-col items-center gap-6">
      {/* PIN dots */}
      <div className="flex gap-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className={`w-5 h-5 rounded-full border-2 transition-all duration-150 ${
              i < pin.length
                ? 'bg-[#ccff00] border-[#ccff00] scale-110'
                : 'bg-transparent border-slate-600'
            }`}
          />
        ))}
      </div>

      {/* Grid */}
      <div className="grid grid-cols-3 gap-3">
        {KEYPAD_KEYS.flat().map((key) => {
          const isBackspace = key === 'backspace'
          const isEnter = key === 'enter'

          return (
            <button
              key={key}
              disabled={disabled}
              onClick={() => {
                if (isBackspace) onBackspace()
                else if (isEnter) onEnter()
                else onDigit(key)
              }}
              className={`
                w-[72px] h-[72px] rounded-2xl text-2xl font-bold
                flex items-center justify-center
                transition-all duration-100 active:scale-95 select-none
                disabled:opacity-40
                ${isEnter
                  ? 'bg-[#ccff00] hover:bg-[#d9ff4d] text-[#0a0a0f] shadow-lg shadow-[#ccff00]/20'
                  : isBackspace
                    ? 'bg-slate-700/60 hover:bg-slate-600 text-slate-300'
                    : 'bg-slate-800 hover:bg-slate-700 text-white border border-slate-700/50'
                }
              `}
            >
              {isBackspace ? (
                <Delete size={22} />
              ) : isEnter ? (
                <CornerDownLeft size={22} />
              ) : (
                key
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ─── Waiting Screen (NFC, Huella, Facial) ─────────────────────────────────────

interface WaitingScreenProps {
  icon: React.ReactNode
  title: string
  subtitle: string
  color: string
}

function WaitingScreen({ icon, title, subtitle, color }: WaitingScreenProps) {
  return (
    <div className="flex flex-col items-center gap-6">
      <div className="relative flex items-center justify-center w-40 h-40">
        <span
          className="absolute inset-0 rounded-full opacity-20 animate-ping"
          style={{ backgroundColor: color }}
        />
        <span
          className="absolute inset-4 rounded-full opacity-15 animate-ping"
          style={{ backgroundColor: color, animationDelay: '0.4s' }}
        />
        <div
          className="relative z-10 w-24 h-24 rounded-full flex items-center justify-center"
          style={{ backgroundColor: `${color}18`, border: `2px solid ${color}44` }}
        >
          <div style={{ color }}>{icon}</div>
        </div>
      </div>
      <div className="text-center">
        <p className="text-2xl font-semibold text-white">{title}</p>
        <p className="text-slate-400 mt-1">{subtitle}</p>
      </div>
    </div>
  )
}

// ─── Main Page Component ──────────────────────────────────────────────────────

export default function FichajePage() {
  const [flow, setFlow] = useState<FlowState>('select_method')
  const [method, setMethod] = useState<AuthMethod | null>(null)
  const [pin, setPin] = useState('')
  const [staffUser, setStaffUser] = useState<StaffUser | null>(null)
  const [result, setResult] = useState<ResultData | null>(null)
  const [loading, setLoading] = useState(false)
  const [sensorError, setSensorError] = useState<string | null>(null)

  const credentialRef = useRef<{ type: AuthMethod; credential: string } | null>(null)
  const sensorTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // ── Reset everything ────────────────────────────────────────────────────
  const resetAll = useCallback(() => {
    setFlow('select_method')
    setMethod(null)
    setPin('')
    setStaffUser(null)
    setResult(null)
    setLoading(false)
    setSensorError(null)
    credentialRef.current = null
    if (sensorTimerRef.current) clearTimeout(sensorTimerRef.current)
  }, [])

  // ── Auto-return from result after 5 seconds ─────────────────────────────
  useEffect(() => {
    if (flow === 'result') {
      const id = setTimeout(resetAll, 5000)
      return () => clearTimeout(id)
    }
  }, [flow, resetAll])

  // ── Sensor simulation: show error after 3 seconds ───────────────────────
  useEffect(() => {
    if (flow === 'enter_credential' && method && method !== 'pin') {
      setSensorError(null)
      sensorTimerRef.current = setTimeout(() => {
        const messages: Record<string, string> = {
          nfc: 'NFC no disponible en este dispositivo',
          fingerprint: 'Sensor de huella no disponible',
          facial: 'Camara no disponible',
        }
        setSensorError(messages[method] ?? 'Sensor no disponible')
      }, 3000)
      return () => {
        if (sensorTimerRef.current) clearTimeout(sensorTimerRef.current)
      }
    }
  }, [flow, method])

  // ── Select auth method ──────────────────────────────────────────────────
  const selectMethod = useCallback((m: AuthMethod) => {
    setMethod(m)
    setPin('')
    setSensorError(null)
    setFlow('enter_credential')
  }, [])

  // ── Authenticate credential and go to action select ─────────────────────
  const authenticate = useCallback(async (type: AuthMethod, credential: string) => {
    credentialRef.current = { type, credential }
    setFlow('select_action')
  }, [])

  // ── Confirm action: POST to API ────────────────────────────────────────
  const confirmAction = useCallback(async (action: ClockAction) => {
    if (!credentialRef.current) return
    setLoading(true)
    const { type, credential } = credentialRef.current

    try {
      const res = await fetch('/api/staff/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, credential, action }),
      })
      const data = await res.json()

      if (data.success) {
        setStaffUser(data.user ?? null)
        const now = new Date()
        setResult({
          success: true,
          message: `${ACTION_LABELS[action]} a las ${formatTime(now)}`,
          action,
          timestamp: formatTime(now),
        })
      } else {
        setResult({
          success: false,
          message: data.error ?? 'Error desconocido',
        })
      }
    } catch {
      setResult({
        success: false,
        message: 'Error de conexion. Intenta de nuevo.',
      })
    } finally {
      setLoading(false)
      setFlow('result')
    }
  }, [])

  // ── PIN handlers ────────────────────────────────────────────────────────
  const handlePinDigit = useCallback((d: string) => {
    setPin((prev) => (prev.length < 6 ? prev + d : prev))
  }, [])

  const handlePinBackspace = useCallback(() => {
    setPin((prev) => prev.slice(0, -1))
  }, [])

  const handlePinEnter = useCallback(() => {
    if (pin.length >= 4) {
      authenticate('pin', pin)
    }
  }, [pin, authenticate])

  // ─── AUTH METHOD CARDS ──────────────────────────────────────────────────

  const authMethods = [
    {
      id: 'pin' as AuthMethod,
      label: 'PIN',
      Icon: KeyRound,
      gradient: 'from-blue-600 to-blue-700',
      ring: 'hover:ring-blue-500/40',
      bg: 'bg-blue-950/30',
    },
    {
      id: 'nfc' as AuthMethod,
      label: 'NFC',
      Icon: Nfc,
      gradient: 'from-emerald-600 to-emerald-700',
      ring: 'hover:ring-emerald-500/40',
      bg: 'bg-emerald-950/30',
    },
    {
      id: 'fingerprint' as AuthMethod,
      label: 'Huella',
      Icon: Fingerprint,
      gradient: 'from-purple-600 to-purple-700',
      ring: 'hover:ring-purple-500/40',
      bg: 'bg-purple-950/30',
    },
    {
      id: 'facial' as AuthMethod,
      label: 'Facial',
      Icon: ScanFace,
      gradient: 'from-amber-500 to-amber-600',
      ring: 'hover:ring-amber-500/40',
      bg: 'bg-amber-950/30',
    },
  ]

  // ─── ACTION BUTTONS ─────────────────────────────────────────────────────

  const actionButtons = [
    {
      action: 'clock_in' as ClockAction,
      label: 'Entrada',
      Icon: LogIn,
      gradient: 'from-emerald-600 to-green-700',
      ring: 'hover:ring-emerald-500/50',
      bg: 'bg-emerald-950/30',
    },
    {
      action: 'clock_out' as ClockAction,
      label: 'Salida',
      Icon: LogOut,
      gradient: 'from-red-600 to-rose-700',
      ring: 'hover:ring-red-500/50',
      bg: 'bg-red-950/30',
    },
    {
      action: 'break_start' as ClockAction,
      label: 'Pausa',
      Icon: Coffee,
      gradient: 'from-amber-500 to-orange-600',
      ring: 'hover:ring-amber-500/50',
      bg: 'bg-amber-950/30',
    },
  ]

  // ─── RENDER ─────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white flex flex-col select-none overflow-hidden">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <header className="flex items-center justify-between px-8 py-5 border-b border-slate-800/40">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[#ccff00] to-green-500 flex items-center justify-center font-black text-[#0a0a0f] text-lg shadow-lg shadow-[#ccff00]/20">
            NM
          </div>
          <div>
            <p className="text-lg font-bold text-white leading-tight">Nueva Marina Padel & Sport</p>
            <p className="text-xs text-slate-500">Terminal de Fichaje</p>
          </div>
        </div>
        <LiveClock />
      </header>

      {/* ── Main Content ───────────────────────────────────────────────────── */}
      <main className="flex-1 flex items-center justify-center px-6 py-10 relative">

        {/* ── FLOW: select_method ───────────────────────────────────────────── */}
        {flow === 'select_method' && (
          <div className="flex flex-col items-center gap-10 w-full max-w-xl animate-in fade-in duration-300">
            <div className="text-center">
              <h1 className="text-4xl font-bold text-white tracking-tight">
                Fichar Entrada / Salida
              </h1>
              <p className="text-slate-400 mt-2">Elegi tu metodo de identificacion</p>
            </div>

            <div className="grid grid-cols-2 gap-4 w-full">
              {authMethods.map(({ id, label, Icon, gradient, ring, bg }) => (
                <button
                  key={id}
                  onClick={() => selectMethod(id)}
                  className={`
                    ${bg} ${ring}
                    group relative flex flex-col items-center justify-center gap-4
                    h-[160px] rounded-2xl border border-slate-700/50
                    hover:border-transparent hover:ring-2
                    transition-all duration-200 active:scale-[0.97]
                  `}
                >
                  <div
                    className={`w-16 h-16 rounded-xl bg-gradient-to-br ${gradient} flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform duration-200`}
                  >
                    <Icon size={32} className="text-white" />
                  </div>
                  <span className="text-sm font-semibold text-slate-200">{label}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ── FLOW: enter_credential (PIN) ─────────────────────────────────── */}
        {flow === 'enter_credential' && method === 'pin' && (
          <div className="flex flex-col items-center gap-8 w-full max-w-sm animate-in fade-in duration-300">
            <div className="text-center">
              <div className="inline-flex w-14 h-14 rounded-xl bg-blue-900/40 items-center justify-center mb-3">
                <KeyRound size={28} className="text-blue-400" />
              </div>
              <h2 className="text-2xl font-bold text-white">Ingresa tu PIN</h2>
              <p className="text-slate-400 text-sm mt-1">4 a 6 digitos</p>
            </div>

            <Keypad
              pin={pin}
              onDigit={handlePinDigit}
              onBackspace={handlePinBackspace}
              onEnter={handlePinEnter}
              disabled={loading}
            />

            <button
              onClick={resetAll}
              className="flex items-center gap-2 text-slate-500 hover:text-slate-300 transition-colors text-sm mt-2"
            >
              <ChevronLeft size={16} />
              Volver
            </button>
          </div>
        )}

        {/* ── FLOW: enter_credential (NFC) ─────────────────────────────────── */}
        {flow === 'enter_credential' && method === 'nfc' && (
          <div className="flex flex-col items-center gap-8 animate-in fade-in duration-300">
            {!sensorError ? (
              <WaitingScreen
                icon={<Nfc size={48} />}
                title="Acerca tu tag NFC al lector..."
                subtitle="Apoya el chip sobre el sensor"
                color="#10b981"
              />
            ) : (
              <div className="flex flex-col items-center gap-6">
                <div className="w-20 h-20 rounded-full bg-red-950/40 border border-red-800/40 flex items-center justify-center">
                  <XCircle size={40} className="text-red-400" />
                </div>
                <p className="text-xl font-semibold text-white">{sensorError}</p>
                <Button
                  variant="outline"
                  onClick={() => {
                    setSensorError(null)
                    // Re-trigger the 3s timer
                    setFlow('select_method')
                    setTimeout(() => selectMethod('nfc'), 50)
                  }}
                  className="gap-2 border-slate-700 text-slate-300 hover:bg-slate-800 h-12 px-6"
                >
                  <RefreshCw size={16} />
                  Reintentar
                </Button>
              </div>
            )}
            <button
              onClick={resetAll}
              className="flex items-center gap-2 text-slate-500 hover:text-slate-300 transition-colors text-sm mt-4"
            >
              <ChevronLeft size={16} />
              Volver
            </button>
          </div>
        )}

        {/* ── FLOW: enter_credential (Fingerprint) ─────────────────────────── */}
        {flow === 'enter_credential' && method === 'fingerprint' && (
          <div className="flex flex-col items-center gap-8 animate-in fade-in duration-300">
            {!sensorError ? (
              <WaitingScreen
                icon={<Fingerprint size={48} />}
                title="Coloca el dedo en el sensor..."
                subtitle="Mantene el dedo apoyado"
                color="#a855f7"
              />
            ) : (
              <div className="flex flex-col items-center gap-6">
                <div className="w-20 h-20 rounded-full bg-red-950/40 border border-red-800/40 flex items-center justify-center">
                  <XCircle size={40} className="text-red-400" />
                </div>
                <p className="text-xl font-semibold text-white">{sensorError}</p>
                <Button
                  variant="outline"
                  onClick={() => {
                    setSensorError(null)
                    setFlow('select_method')
                    setTimeout(() => selectMethod('fingerprint'), 50)
                  }}
                  className="gap-2 border-slate-700 text-slate-300 hover:bg-slate-800 h-12 px-6"
                >
                  <RefreshCw size={16} />
                  Reintentar
                </Button>
              </div>
            )}
            <button
              onClick={resetAll}
              className="flex items-center gap-2 text-slate-500 hover:text-slate-300 transition-colors text-sm mt-4"
            >
              <ChevronLeft size={16} />
              Volver
            </button>
          </div>
        )}

        {/* ── FLOW: enter_credential (Facial) ──────────────────────────────── */}
        {flow === 'enter_credential' && method === 'facial' && (
          <div className="flex flex-col items-center gap-8 animate-in fade-in duration-300">
            {!sensorError ? (
              <WaitingScreen
                icon={<ScanFace size={48} />}
                title="Mira a la camara..."
                subtitle="Mantene la cara frente al sensor"
                color="#f59e0b"
              />
            ) : (
              <div className="flex flex-col items-center gap-6">
                <div className="w-20 h-20 rounded-full bg-red-950/40 border border-red-800/40 flex items-center justify-center">
                  <XCircle size={40} className="text-red-400" />
                </div>
                <p className="text-xl font-semibold text-white">{sensorError}</p>
                <Button
                  variant="outline"
                  onClick={() => {
                    setSensorError(null)
                    setFlow('select_method')
                    setTimeout(() => selectMethod('facial'), 50)
                  }}
                  className="gap-2 border-slate-700 text-slate-300 hover:bg-slate-800 h-12 px-6"
                >
                  <RefreshCw size={16} />
                  Reintentar
                </Button>
              </div>
            )}
            <button
              onClick={resetAll}
              className="flex items-center gap-2 text-slate-500 hover:text-slate-300 transition-colors text-sm mt-4"
            >
              <ChevronLeft size={16} />
              Volver
            </button>
          </div>
        )}

        {/* ── FLOW: select_action ──────────────────────────────────────────── */}
        {flow === 'select_action' && (
          <div className="flex flex-col items-center gap-8 w-full max-w-lg animate-in fade-in duration-300">
            <div className="text-center">
              <h2 className="text-3xl font-bold text-white">
                {staffUser ? `Hola, ${staffUser.full_name.split(' ')[0]}!` : 'Identidad verificada'}
              </h2>
              <p className="text-slate-400 mt-1">Que queres registrar?</p>
            </div>

            <div className="grid grid-cols-3 gap-4 w-full">
              {actionButtons.map(({ action, label, Icon, gradient, ring, bg }) => (
                <button
                  key={action}
                  disabled={loading}
                  onClick={() => confirmAction(action)}
                  className={`
                    ${bg} ${ring}
                    group flex flex-col items-center justify-center gap-4
                    h-[160px] rounded-2xl border border-slate-700/50
                    hover:border-transparent hover:ring-2
                    transition-all duration-200 active:scale-[0.97]
                    disabled:opacity-40
                  `}
                >
                  <div
                    className={`w-14 h-14 rounded-xl bg-gradient-to-br ${gradient} flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform duration-200`}
                  >
                    <Icon size={28} className="text-white" />
                  </div>
                  <span className="text-sm font-semibold text-slate-200">{label}</span>
                </button>
              ))}
            </div>

            <button
              onClick={resetAll}
              disabled={loading}
              className="flex items-center gap-2 text-slate-500 hover:text-slate-300 transition-colors text-sm mt-2"
            >
              <ChevronLeft size={16} />
              Cancelar
            </button>
          </div>
        )}

        {/* ── FLOW: result ─────────────────────────────────────────────────── */}
        {flow === 'result' && result && (
          <div className="flex flex-col items-center gap-8 animate-in fade-in duration-300">
            {result.success ? (
              <>
                <div className="relative">
                  <div className="absolute inset-0 rounded-full bg-emerald-500/20 animate-ping" />
                  <CheckCircle2
                    size={96}
                    className="relative text-emerald-400 drop-shadow-[0_0_30px_rgba(52,211,153,0.5)]"
                  />
                </div>
                <div className="text-center">
                  <p className="text-3xl font-bold text-white">{result.message}</p>
                  {staffUser && (
                    <p className="text-slate-400 mt-2">{staffUser.full_name}</p>
                  )}
                </div>
              </>
            ) : (
              <>
                <div className="relative">
                  <div className="absolute inset-0 rounded-full bg-red-500/20 animate-ping" />
                  <XCircle
                    size={96}
                    className="relative text-red-400 drop-shadow-[0_0_30px_rgba(248,113,113,0.5)]"
                  />
                </div>
                <div className="text-center">
                  <p className="text-3xl font-bold text-white">Error</p>
                  <p className="text-slate-400 mt-2 text-lg">{result.message}</p>
                </div>
              </>
            )}
            <p className="text-slate-600 text-sm animate-pulse">Volviendo al inicio...</p>
          </div>
        )}

        {/* ── Loading overlay ──────────────────────────────────────────────── */}
        {loading && (
          <div className="absolute inset-0 bg-[#0a0a0f]/80 flex items-center justify-center z-50">
            <div className="w-14 h-14 rounded-full border-4 border-slate-700 border-t-[#ccff00] animate-spin" />
          </div>
        )}
      </main>
    </div>
  )
}
