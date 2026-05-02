'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import jsQR from 'jsqr'
import { createClient } from '@/lib/supabase/client'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Camera, CameraOff, CheckCircle, XCircle, Nfc, QrCode, RefreshCw, Link2, Search } from 'lucide-react'
import { FichaSocio } from '@/components/access/ficha-socio'

type Mode = 'validate' | 'link-nfc'

type ScanResult = {
  ok: boolean
  title: string
  subtitle: string
  avatar_url?: string | null
  user_id?: string | null
  reason?: string | null
  at: number
}

type SocioLite = { id: string; full_name: string | null; email: string | null }

const RESULT_DISPLAY_MS = 10000  // 10 segundos
const SCAN_DEBOUNCE_MS = 2500

export default function EscanearPage() {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const lastScanRef = useRef<{ value: string; at: number }>({ value: '', at: 0 })
  const rafRef = useRef<number | null>(null)
  const streamRef = useRef<MediaStream | null>(null)

  const [mode, setMode] = useState<Mode>('validate')
  const [cameraOn, setCameraOn] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<ScanResult | null>(null)
  const [busy, setBusy] = useState(false)
  const [nfcSupported, setNfcSupported] = useState(false)
  const [nfcActive, setNfcActive] = useState(false)
  const [cameraSupported, setCameraSupported] = useState<boolean | null>(null)

  // Estado del modo "Vincular tag"
  const [socios, setSocios] = useState<SocioLite[]>([])
  const [socioFilter, setSocioFilter] = useState('')
  const [selectedSocio, setSelectedSocio] = useState<SocioLite | null>(null)

  // Detectar capacidades del navegador
  useEffect(() => {
    setCameraSupported(!!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia))
    setNfcSupported('NDEFReader' in window)
  }, [])

  // Cargar socios cuando se entra al modo vincular
  useEffect(() => {
    if (mode !== 'link-nfc') return
    const load = async () => {
      const supabase = createClient()
      const { data } = await supabase
        .from('nm_users')
        .select('id, full_name, email')
        .eq('is_active', true)
        .order('full_name', { ascending: true })
        .limit(500)
      setSocios((data || []) as SocioLite[])
    }
    load()
  }, [mode])

  const showResult = useCallback((r: Omit<ScanResult, 'at'>) => {
    setResult({ ...r, at: Date.now() })
  }, [])

  // ─── Modo Validar ─────────────────────────────────────────
  const validate = useCallback(async (rawValue: string, type: 'qr' | 'nfc') => {
    let credentialData = rawValue
    if (type === 'qr' && rawValue.includes('?t=')) {
      try {
        const url = new URL(rawValue)
        const t = url.searchParams.get('t')
        if (t) credentialData = t
      } catch { /* QR no es URL */ }
    }

    setBusy(true)
    try {
      const res = await fetch('/api/access/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ credential_type: type, credential_data: credentialData }),
      })
      const data = await res.json()
      showResult({
        ok: !!data.granted,
        title: data.granted ? 'PERMITIDO' : 'DENEGADO',
        subtitle: data.granted ? (data.user_name || 'Socio') : `${data.user_name ? data.user_name + ' — ' : ''}${friendlyReason(data.reason)}`,
        avatar_url: data.avatar_url,
        user_id: data.user_id,
        reason: data.reason ? friendlyReason(data.reason) : null,
      })
    } catch {
      showResult({ ok: false, title: 'ERROR', subtitle: 'Error de conexión' })
    } finally {
      setBusy(false)
    }
  }, [showResult])

  // ─── Modo Vincular tag ────────────────────────────────────
  const linkTag = useCallback(async (uid: string) => {
    if (!selectedSocio) {
      showResult({ ok: false, title: 'ATENCIÓN', subtitle: 'Seleccioná un socio primero' })
      return
    }
    setBusy(true)
    try {
      const res = await fetch('/api/access/credentials/link-nfc', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: selectedSocio.id, uid }),
      })
      const data = await res.json()
      if (res.ok) {
        showResult({
          ok: true,
          title: 'TAG VINCULADO',
          subtitle: `${selectedSocio.full_name || selectedSocio.email} → ${data.uid}`,
        })
      } else {
        showResult({
          ok: false,
          title: 'ERROR',
          subtitle: data.error || 'No se pudo vincular',
        })
      }
    } catch {
      showResult({ ok: false, title: 'ERROR', subtitle: 'Error de conexión' })
    } finally {
      setBusy(false)
    }
  }, [selectedSocio, showResult])

  // Loop de detección de QR usando jsQR (funciona en cualquier navegador)
  const detectLoop = useCallback(() => {
    const video = videoRef.current
    if (!video || video.readyState < 2) {
      rafRef.current = requestAnimationFrame(detectLoop)
      return
    }
    try {
      // Reusar el canvas oculto para sacar frames del video
      let canvas = canvasRef.current
      if (!canvas) {
        canvas = document.createElement('canvas')
        canvasRef.current = canvas
      }
      const w = video.videoWidth
      const h = video.videoHeight
      if (w === 0 || h === 0) {
        rafRef.current = requestAnimationFrame(detectLoop)
        return
      }
      canvas.width = w
      canvas.height = h
      const ctx = canvas.getContext('2d', { willReadFrequently: true })
      if (!ctx) {
        rafRef.current = requestAnimationFrame(detectLoop)
        return
      }
      ctx.drawImage(video, 0, 0, w, h)
      const imageData = ctx.getImageData(0, 0, w, h)
      const code = jsQR(imageData.data, w, h, { inversionAttempts: 'dontInvert' })

      if (code && code.data) {
        const value = code.data
        const now = Date.now()
        if (value !== lastScanRef.current.value || now - lastScanRef.current.at > SCAN_DEBOUNCE_MS) {
          lastScanRef.current = { value, at: now }
          if (mode === 'validate') {
            void validate(value, 'qr')
          } else {
            showResult({ ok: false, title: 'IGNORADO', subtitle: 'En modo vincular se usa solo NFC, no QR' })
          }
        }
      }
    } catch {
      /* fallos puntuales del decoder, no romper el loop */
    }
    rafRef.current = requestAnimationFrame(detectLoop)
  }, [mode, validate, showResult])

  // Encender cámara
  const startCamera = useCallback(async () => {
    setError(null)
    if (!cameraSupported) {
      setError('Tu navegador no permite acceder a la cámara. Probá Chrome o Edge actualizado.')
      return
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play()
      }
      setCameraOn(true)
      detectLoop()
    } catch (e) {
      const err = e as { name?: string; message?: string }
      const friendly =
        err.name === 'NotAllowedError' ? 'Permiso denegado. Permití el acceso a la cámara en el navegador y recargá.' :
        err.name === 'NotFoundError' ? 'No hay cámara conectada.' :
        err.name === 'NotReadableError' ? 'Otra app está usando la cámara (Zoom, Meet, etc). Cerrala y reintentá.' :
        `No pude abrir la cámara: ${err.message || err.name}`
      setError(friendly)
    }
  }, [cameraSupported, detectLoop])

  const stopCamera = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current)
    rafRef.current = null
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop())
      streamRef.current = null
    }
    if (videoRef.current) videoRef.current.srcObject = null
    setCameraOn(false)
  }, [])

  useEffect(() => () => stopCamera(), [stopCamera])

  useEffect(() => {
    if (!result) return
    const id = setTimeout(() => setResult(null), RESULT_DISPLAY_MS)
    return () => clearTimeout(id)
  }, [result])

  // Lectura NFC (solo Android Chrome)
  const startNfc = useCallback(async () => {
    setError(null)
    if (!nfcSupported) {
      setError('NFC no disponible. Solo funciona en Android con Chrome.')
      return
    }
    try {
      // @ts-expect-error NDEFReader no está en typings estándar
      const reader = new window.NDEFReader()
      await reader.scan()
      setNfcActive(true)
      // @ts-expect-error event types no estándar
      reader.onreading = (event) => {
        const uid = (event.serialNumber || '').replace(/:/g, '').toUpperCase()
        if (!uid) return
        if (mode === 'validate') {
          validate(uid, 'nfc')
        } else {
          linkTag(uid)
        }
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'desconocido'
      setError(`No pude iniciar NFC: ${msg}`)
    }
  }, [nfcSupported, mode, validate, linkTag])

  const filteredSocios = socios.filter(s => {
    if (!socioFilter) return true
    const q = socioFilter.toLowerCase()
    return (s.full_name || '').toLowerCase().includes(q) || (s.email || '').toLowerCase().includes(q)
  }).slice(0, 50)

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-white">Escanear acceso</h1>
        <p className="text-sm text-slate-400 mt-1">
          Validá un socio o vinculá un tag NFC nuevo a su perfil.
        </p>
      </div>

      {/* Modo */}
      <div className="flex flex-wrap gap-2 p-1 bg-slate-800/50 rounded-lg w-fit">
        <button
          onClick={() => setMode('validate')}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            mode === 'validate' ? 'bg-cyan-600 text-white' : 'text-slate-400 hover:text-white'
          }`}
        >
          <QrCode size={14} className="inline mr-1" /> Validar acceso
        </button>
        <button
          onClick={() => setMode('link-nfc')}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            mode === 'link-nfc' ? 'bg-cyan-600 text-white' : 'text-slate-400 hover:text-white'
          }`}
        >
          <Link2 size={14} className="inline mr-1" /> Vincular tag NFC
        </button>
      </div>

      {/* Capacidades */}
      <div className="flex flex-wrap gap-2">
        <Badge variant={cameraSupported ? 'success' : 'danger'}>
          {cameraSupported === null ? 'Detectando…' : cameraSupported ? 'Cámara/QR: OK' : 'Cámara/QR: no soportado'}
        </Badge>
        <Badge variant={nfcSupported ? 'success' : 'default'}>
          {nfcSupported ? 'NFC: disponible' : 'NFC: no disponible (usá Android Chrome)'}
        </Badge>
      </div>

      {/* Modo Vincular: selector de socio */}
      {mode === 'link-nfc' && (
        <Card>
          <div className="p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Search size={16} className="text-slate-500" />
              <input
                type="text"
                placeholder="Buscar socio por nombre o email…"
                value={socioFilter}
                onChange={e => setSocioFilter(e.target.value)}
                className="flex-1 bg-slate-900 border border-slate-700 rounded-md px-3 py-2 text-sm text-white placeholder:text-slate-500"
              />
            </div>
            {selectedSocio ? (
              <div className="flex items-center justify-between p-3 bg-cyan-500/10 border border-cyan-500/30 rounded-lg">
                <div>
                  <div className="text-sm font-medium text-white">{selectedSocio.full_name || '(sin nombre)'}</div>
                  <div className="text-xs text-slate-400">{selectedSocio.email}</div>
                </div>
                <Button variant="ghost" size="sm" onClick={() => setSelectedSocio(null)}>Cambiar</Button>
              </div>
            ) : (
              <div className="max-h-60 overflow-y-auto divide-y divide-slate-800 border border-slate-800 rounded-lg">
                {filteredSocios.length === 0 ? (
                  <div className="text-center text-sm text-slate-500 py-6">
                    {socioFilter ? 'Sin resultados' : 'Cargando socios…'}
                  </div>
                ) : filteredSocios.map(s => (
                  <button
                    key={s.id}
                    onClick={() => setSelectedSocio(s)}
                    className="w-full text-left px-3 py-2 hover:bg-slate-800/50 transition-colors"
                  >
                    <div className="text-sm text-white">{s.full_name || '(sin nombre)'}</div>
                    <div className="text-xs text-slate-500">{s.email}</div>
                  </button>
                ))}
              </div>
            )}
            <p className="text-xs text-slate-500">
              {selectedSocio
                ? '✓ Apoyá el tag en el lector NFC para vincularlo a este socio.'
                : 'Elegí primero un socio, después apoyá el tag.'}
            </p>
          </div>
        </Card>
      )}

      {/* Controles cámara/NFC */}
      <div className="flex flex-wrap gap-3">
        {!cameraOn ? (
          <Button onClick={startCamera} disabled={cameraSupported === false}>
            <Camera size={16} className="mr-2" /> Iniciar cámara
          </Button>
        ) : (
          <Button variant="secondary" onClick={stopCamera}>
            <CameraOff size={16} className="mr-2" /> Apagar cámara
          </Button>
        )}
        {nfcSupported && (
          <Button variant={nfcActive ? 'secondary' : 'outline'} onClick={startNfc} disabled={nfcActive}>
            <Nfc size={16} className="mr-2" /> {nfcActive ? 'NFC escuchando' : 'Iniciar NFC'}
          </Button>
        )}
      </div>

      {error && (
        <Card><div className="p-4 text-sm text-red-400">{error}</div></Card>
      )}

      {/* Vista de cámara */}
      <Card>
        <div className="relative aspect-video bg-black rounded-xl overflow-hidden">
          <video ref={videoRef} playsInline muted className="w-full h-full object-cover" />
          {!cameraOn && (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-500 gap-2">
              <QrCode size={48} />
              <p className="text-sm">Apretá &ldquo;Iniciar cámara&rdquo;</p>
            </div>
          )}
          {busy && (
            <div className="absolute top-3 right-3 bg-cyan-500/20 border border-cyan-500/40 rounded-full px-3 py-1 text-xs text-cyan-300 flex items-center gap-2">
              <RefreshCw size={12} className="animate-spin" /> Procesando…
            </div>
          )}

          {result && !result.user_id && (
            <div className={`absolute inset-0 flex flex-col items-center justify-center backdrop-blur-sm ${
              result.ok ? 'bg-green-500/40' : 'bg-red-500/40'
            }`}>
              {result.ok
                ? <CheckCircle size={96} className="text-green-300" />
                : <XCircle size={96} className="text-red-300" />}
              <p className="mt-4 text-3xl font-bold text-white">{result.title}</p>
              <p className="mt-2 text-lg text-white/90 px-4 text-center">{result.subtitle}</p>
            </div>
          )}
        </div>
      </Card>

      {/* Ficha rápida del socio (10 seg) si validate devolvió user_id */}
      {result?.user_id && (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-300">
          <FichaSocio
            userId={result.user_id}
            granted={result.ok}
            reason={result.reason || undefined}
            variant="overlay"
            onClose={() => setResult(null)}
          />
        </div>
      )}

      <p className="text-xs text-slate-500 text-center">
        En pantalla completa del celular, esto funciona como un lector portátil de mesa.
      </p>
    </div>
  )
}

function friendlyReason(reason?: string): string {
  switch (reason) {
    case 'invalid_credential': return 'Credencial no encontrada'
    case 'credential_disabled': return 'Credencial desactivada'
    case 'credential_expired': return 'Credencial vencida'
    case 'user_inactive': return 'Socio inactivo'
    case 'no_active_membership': return 'Sin membresía activa'
    case 'network_error': return 'Error de conexión'
    case 'missing_token': return 'Token vacío'
    case 'invalid_request': return 'Solicitud inválida'
    default: return reason || 'Motivo desconocido'
  }
}
