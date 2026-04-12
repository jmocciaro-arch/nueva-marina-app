'use client'

import { useState, useCallback, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/lib/auth-context'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { QRCodeDisplay } from '@/components/qr-code'
import { useToast } from '@/components/ui/toast'
import { QrCode, RefreshCw, Clock, CheckCircle, XCircle, Maximize2, Minimize2 } from 'lucide-react'
import type { AccessLog } from '@/types'

export default function MiAccesoPage() {
  const { user } = useAuth()
  const { toast } = useToast()
  const [qrValue, setQrValue] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [logs, setLogs] = useState<AccessLog[]>([])
  const [loadingLogs, setLoadingLogs] = useState(true)
  const [fullScreen, setFullScreen] = useState(false)

  const loadCredential = useCallback(async () => {
    if (!user) return
    setLoading(true)
    const supabase = createClient()
    const { data } = await supabase
      .from('nm_access_credentials')
      .select('credential_data')
      .eq('user_id', user.id)
      .eq('club_id', 1)
      .eq('type', 'qr')
      .eq('is_active', true)
      .single()

    if (data) {
      setQrValue(`${window.location.origin}/api/access/validate?t=${data.credential_data}`)
    }
    setLoading(false)
  }, [user])

  const loadLogs = useCallback(async () => {
    if (!user) return
    setLoadingLogs(true)
    const supabase = createClient()
    const { data } = await supabase
      .from('nm_access_logs')
      .select('*, access_point:nm_access_points(name)')
      .eq('user_id', user.id)
      .eq('club_id', 1)
      .order('timestamp', { ascending: false })
      .limit(50)
    setLogs((data || []) as unknown as AccessLog[])
    setLoadingLogs(false)
  }, [user])

  useEffect(() => {
    loadCredential()
    loadLogs()
  }, [loadCredential, loadLogs])

  async function generateQR() {
    setGenerating(true)
    try {
      const res = await fetch('/api/access/qr/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
      const data = await res.json()
      if (data.error) {
        toast('error', data.error)
      } else {
        setQrValue(data.qr_value)
        toast('success', 'QR generado correctamente')
      }
    } catch {
      toast('error', 'Error al generar QR')
    }
    setGenerating(false)
  }

  // Full screen QR mode
  if (fullScreen && qrValue) {
    return (
      <div className="fixed inset-0 z-50 bg-black flex flex-col items-center justify-center" onClick={() => setFullScreen(false)}>
        <div className="bg-white p-6 rounded-3xl shadow-2xl">
          <QRCodeDisplay value={qrValue} size={320} />
        </div>
        <p className="text-xl font-bold text-white mt-6">{user?.full_name || user?.email}</p>
        <p className="text-sm text-slate-400 mt-2">Mostrá este código en el lector del molinete</p>
        <button
          onClick={() => setFullScreen(false)}
          className="mt-8 flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700 transition-colors"
        >
          <Minimize2 size={16} /> Salir de pantalla completa
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Mi Acceso</h1>
        <p className="text-sm text-slate-400 mt-1">Tu código QR para acceder al club</p>
      </div>

      {/* QR Card */}
      <Card>
        <div className="flex flex-col items-center py-8">
          {loading ? (
            <div className="w-64 h-64 bg-slate-800 rounded-2xl animate-pulse" />
          ) : qrValue ? (
            <>
              <QRCodeDisplay
                value={qrValue}
                size={240}
                title={user?.full_name || user?.email || ''}
                subtitle="Mostrá este código en el lector del molinete"
              />
              <div className="flex items-center gap-3 mt-6">
                <Button variant="secondary" size="sm" onClick={() => setFullScreen(true)}>
                  <Maximize2 size={14} className="mr-1" /> Pantalla completa
                </Button>
                <Button variant="ghost" size="sm" onClick={generateQR} loading={generating}>
                  <RefreshCw size={14} className="mr-1" /> Regenerar
                </Button>
              </div>
            </>
          ) : (
            <div className="text-center">
              <div className="w-20 h-20 rounded-2xl bg-cyan-600/10 flex items-center justify-center mx-auto mb-4">
                <QrCode size={40} className="text-cyan-500" />
              </div>
              <h3 className="text-lg font-semibold text-white">No tenés QR de acceso</h3>
              <p className="text-sm text-slate-400 mt-2 mb-6">Generá tu código QR para acceder al club con el molinete</p>
              <Button onClick={generateQR} loading={generating}>
                <QrCode size={16} className="mr-1" /> Generar mi QR
              </Button>
            </div>
          )}
        </div>
      </Card>

      {/* Access History */}
      <div>
        <h2 className="text-lg font-semibold text-white mb-4">Historial de accesos</h2>
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-700">
                  <th className="text-left text-xs font-medium text-slate-400 pb-3 pl-2">Fecha y hora</th>
                  <th className="text-left text-xs font-medium text-slate-400 pb-3">Punto</th>
                  <th className="text-left text-xs font-medium text-slate-400 pb-3">Resultado</th>
                </tr>
              </thead>
              <tbody>
                {loadingLogs ? (
                  <tr><td colSpan={3} className="text-center py-8 text-slate-500">Cargando...</td></tr>
                ) : logs.length === 0 ? (
                  <tr><td colSpan={3} className="text-center py-8 text-slate-500">No hay registros de acceso todavía</td></tr>
                ) : logs.map(log => {
                  const ap = log.access_point as unknown as { name?: string } | null
                  return (
                    <tr key={log.id} className="border-b border-slate-800">
                      <td className="py-3 pl-2">
                        <div className="flex items-center gap-2 text-sm text-white">
                          <Clock size={14} className="text-slate-500" />
                          {new Date(log.timestamp).toLocaleString('es-ES', {
                            day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit'
                          })}
                        </div>
                      </td>
                      <td className="py-3 text-sm text-slate-400">{ap?.name || '—'}</td>
                      <td className="py-3">
                        <div className="flex items-center gap-1.5">
                          {log.granted ? (
                            <><CheckCircle size={14} className="text-green-400" /><span className="text-sm text-green-400">Permitido</span></>
                          ) : (
                            <><XCircle size={14} className="text-red-400" /><span className="text-sm text-red-400">Denegado</span></>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </div>
  )
}
