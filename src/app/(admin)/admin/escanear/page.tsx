'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Camera, CameraOff, CheckCircle, XCircle, Nfc, QrCode, RefreshCw } from 'lucide-react'

type ScanResult = {
  granted: boolean
  user_name?: string
  reason?: string
  at: number
}

const RESULT_DISPLAY_MS = 4000
const SCAN_DEBOUNCE_MS = 2500

export default function EscanearPage() {
  const videoRef = useRef<HTMLVideoElement>(null)
  const detectorRef = useRef<unknown>(null)
  const lastScanRef = useRef<{ value: string; at: number }>({ value: '', at: 0 })
  const rafRef = useRef<number | null>(null)
  const streamRef = useRef<MediaStream | null>(null)

  const [cameraOn, setCameraOn] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<ScanResult | null>(null)
  const [scanning, setScanning] = useState(false)
  const [nfcSupported, setNfcSupported] = useState(false)
  const [nfcActive, setNfcActive] = useState(false)
  const [barcodeApiSupported, setBarcodeApiSupported] = useState<boolean | null>(null)

  // Detectar capacidades del navegador
  useEffect(() => {
    setBarcodeApiSupported('BarcodeDetector' in window)
    setNfcSupported('NDEFReader' in window)
  }, [])

  // Validar credencial contra el backend
  const validate = useCallback(async (rawValue: string, type: 'qr' | 'nfc') => {
    let credentialData = rawValue
    // Si el QR es la URL completa, extraer el token del query string
    if (type === 'qr' && rawValue.includes('?t=')) {
      try {
        const url = new URL(rawValue)
        const t = url.searchParams.get('t')
        if (t) credentialData = t
      } catch {
        // si no es URL válida, dejar el valor crudo
      }
    }

    setScanning(true)
    try {
      const res = await fetch('/api/access/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          credential_type: type,
          credential_data: credentialData,
        }),
      })
      const data = await res.json()
      setResult({
        granted: !!data.granted,
        user_name: data.user_name,
        reason: data.reason,
        at: Date.now(),
      })
    } catch {
      setResult({ granted: false, reason: 'network_error', at: Date.now() })
    } finally {
      setScanning(false)
    }
  }, [])

  // Loop de detección de QR usando BarcodeDetector
  const detectLoop = useCallback(async () => {
    const video = videoRef.current
    const detector = detectorRef.current as { detect: (v: HTMLVideoElement) => Promise<Array<{ rawValue: string }>> } | null
    if (!video || !detector || video.readyState < 2) {
      rafRef.current = requestAnimationFrame(detectLoop)
      return
    }
    try {
      const codes = await detector.detect(video)
      if (codes.length > 0) {
        const value = codes[0].rawValue
        const now = Date.now()
        // Debounce: ignorar el mismo valor si fue escaneado hace poco
        if (value !== lastScanRef.current.value || now - lastScanRef.current.at > SCAN_DEBOUNCE_MS) {
          lastScanRef.current = { value, at: now }
          await validate(value, 'qr')
        }
      }
    } catch {
      // detect() falla a veces durante transiciones de la cámara, no romper el loop
    }
    rafRef.current = requestAnimationFrame(detectLoop)
  }, [validate])

  // Encender cámara
  const startCamera = useCallback(async () => {
    setError(null)
    if (!barcodeApiSupported) {
      setError('Tu navegador no soporta el escáner nativo. Usá Chrome, Edge o Safari 17+.')
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
      // @ts-expect-error BarcodeDetector no está en los typings DOM estándar todavía
      detectorRef.current = new window.BarcodeDetector({ formats: ['qr_code'] })
      setCameraOn(true)
      detectLoop()
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'desconocido'
      setError(`No pude abrir la cámara: ${msg}`)
    }
  }, [barcodeApiSupported, detectLoop])

  // Apagar cámara
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

  // Limpiar al desmontar
  useEffect(() => () => stopCamera(), [stopCamera])

  // Limpiar resultado después de un rato
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
        // El UID del tag suele venir en event.serialNumber (formato hex con dos puntos)
        const uid = (event.serialNumber || '').replace(/:/g, '').toUpperCase()
        if (uid) validate(uid, 'nfc')
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'desconocido'
      setError(`No pude iniciar NFC: ${msg}`)
    }
  }, [nfcSupported, validate])

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-white">Escanear acceso</h1>
        <p className="text-sm text-slate-400 mt-1">
          Validá un socio escaneando su QR con la cámara, o leyendo su tag con NFC.
        </p>
      </div>

      {/* Capacidades del navegador */}
      <div className="flex flex-wrap gap-2">
        <Badge variant={barcodeApiSupported ? 'success' : 'danger'}>
          {barcodeApiSupported === null ? 'Detectando…' : barcodeApiSupported ? 'Cámara/QR: OK' : 'Cámara/QR: no soportado'}
        </Badge>
        <Badge variant={nfcSupported ? 'success' : 'default'}>
          {nfcSupported ? 'NFC: disponible' : 'NFC: no disponible (usá Android Chrome)'}
        </Badge>
      </div>

      {/* Controles */}
      <div className="flex flex-wrap gap-3">
        {!cameraOn ? (
          <Button onClick={startCamera} disabled={barcodeApiSupported === false}>
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
        <Card>
          <div className="p-4 text-sm text-red-400">{error}</div>
        </Card>
      )}

      {/* Vista de cámara */}
      <Card>
        <div className="relative aspect-video bg-black rounded-xl overflow-hidden">
          <video
            ref={videoRef}
            playsInline
            muted
            className="w-full h-full object-cover"
          />
          {!cameraOn && (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-500 gap-2">
              <QrCode size={48} />
              <p className="text-sm">Apretá &ldquo;Iniciar cámara&rdquo; y apuntá al QR</p>
            </div>
          )}
          {scanning && (
            <div className="absolute top-3 right-3 bg-cyan-500/20 border border-cyan-500/40 rounded-full px-3 py-1 text-xs text-cyan-300 flex items-center gap-2">
              <RefreshCw size={12} className="animate-spin" /> Validando…
            </div>
          )}

          {/* Overlay de resultado */}
          {result && (
            <div
              className={`absolute inset-0 flex flex-col items-center justify-center backdrop-blur-sm ${
                result.granted ? 'bg-green-500/40' : 'bg-red-500/40'
              }`}
            >
              {result.granted ? (
                <CheckCircle size={96} className="text-green-300" />
              ) : (
                <XCircle size={96} className="text-red-300" />
              )}
              <p className="mt-4 text-3xl font-bold text-white">
                {result.granted ? 'PERMITIDO' : 'DENEGADO'}
              </p>
              <p className="mt-2 text-lg text-white/90">
                {result.granted
                  ? result.user_name || 'Socio'
                  : friendlyReason(result.reason)}
              </p>
            </div>
          )}
        </div>
      </Card>

      <p className="text-xs text-slate-500 text-center">
        Truco: en pantalla completa del celular, esto funciona como un lector portátil de mesa.
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
