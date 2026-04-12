'use client'

import { useState, useCallback, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Card } from '@/components/ui/card'
import { Modal } from '@/components/ui/modal'
import { Badge } from '@/components/ui/badge'
import { KpiCard } from '@/components/ui/kpi-card'
import { useToast } from '@/components/ui/toast'
import { QRCodeDisplay } from '@/components/qr-code'
import {
  DoorOpen, Plus, QrCode, Nfc, Users, CheckCircle, XCircle,
  Trash2, ChevronLeft, ChevronRight, Shield, Clock, Search,
  Wifi, Settings2, Eye
} from 'lucide-react'
import type { AccessPoint, AccessCredential, AccessLog } from '@/types'

const TABS = ['Puntos de Acceso', 'Credenciales', 'Registro'] as const
type Tab = typeof TABS[number]

const ACCESS_TYPES = [
  { value: 'turnstile', label: 'Molinete' },
  { value: 'gate', label: 'Portón' },
  { value: 'door', label: 'Puerta' },
]

const CREDENTIAL_TYPES: Record<string, { label: string; icon: React.ReactNode }> = {
  qr: { label: 'QR', icon: <QrCode size={14} /> },
  nfc: { label: 'NFC', icon: <Nfc size={14} /> },
  pin: { label: 'PIN', icon: <Shield size={14} /> },
  fingerprint: { label: 'Huella', icon: <Shield size={14} /> },
  facial: { label: 'Facial', icon: <Eye size={14} /> },
}

export default function AccesosPage() {
  const { toast } = useToast()
  const [tab, setTab] = useState<Tab>('Puntos de Acceso')

  // ─── Access Points ───
  const [points, setPoints] = useState<AccessPoint[]>([])
  const [loadingPoints, setLoadingPoints] = useState(true)
  const [pointModal, setPointModal] = useState(false)
  const [editingPoint, setEditingPoint] = useState<AccessPoint | null>(null)
  const [savingPoint, setSavingPoint] = useState(false)
  const [pointForm, setPointForm] = useState({ name: '', type: 'turnstile', location: '', hardware_id: '', relay_endpoint: '' })

  // ─── Credentials ───
  const [credentials, setCredentials] = useState<AccessCredential[]>([])
  const [loadingCreds, setLoadingCreds] = useState(true)
  const [credSearch, setCredSearch] = useState('')
  const [qrModal, setQrModal] = useState<{ token: string; userName: string } | null>(null)
  const [generatingQr, setGeneratingQr] = useState<string | null>(null)

  // ─── Access Logs ───
  const [logs, setLogs] = useState<AccessLog[]>([])
  const [loadingLogs, setLoadingLogs] = useState(true)
  const [logDate, setLogDate] = useState(() => new Date().toISOString().split('T')[0])

  // ─── Load data ───
  const loadPoints = useCallback(async () => {
    setLoadingPoints(true)
    const supabase = createClient()
    const { data } = await supabase
      .from('nm_access_points')
      .select('*')
      .eq('club_id', 1)
      .order('created_at', { ascending: false })
    setPoints((data || []) as AccessPoint[])
    setLoadingPoints(false)
  }, [])

  const loadCredentials = useCallback(async () => {
    setLoadingCreds(true)
    const supabase = createClient()
    const { data } = await supabase
      .from('nm_access_credentials')
      .select('*, user:nm_users(id, full_name, email)')
      .eq('club_id', 1)
      .order('created_at', { ascending: false })
    setCredentials((data || []) as unknown as AccessCredential[])
    setLoadingCreds(false)
  }, [])

  const loadLogs = useCallback(async () => {
    setLoadingLogs(true)
    const supabase = createClient()
    const startOfDay = `${logDate}T00:00:00`
    const endOfDay = `${logDate}T23:59:59`
    const { data } = await supabase
      .from('nm_access_logs')
      .select('*, user:nm_users(id, full_name, email), access_point:nm_access_points(id, name)')
      .eq('club_id', 1)
      .gte('timestamp', startOfDay)
      .lte('timestamp', endOfDay)
      .order('timestamp', { ascending: false })
      .limit(200)
    setLogs((data || []) as unknown as AccessLog[])
    setLoadingLogs(false)
  }, [logDate])

  useEffect(() => {
    if (tab === 'Puntos de Acceso') loadPoints()
    else if (tab === 'Credenciales') loadCredentials()
    else if (tab === 'Registro') loadLogs()
  }, [tab, loadPoints, loadCredentials, loadLogs])

  // ─── KPIs ───
  const totalToday = logs.length
  const grantedToday = logs.filter(l => l.granted).length
  const deniedToday = logs.filter(l => !l.granted).length
  const uniqueUsers = new Set(logs.filter(l => l.user_id && l.granted).map(l => l.user_id)).size

  // ─── Access Point CRUD ───
  function openNewPoint() {
    setEditingPoint(null)
    setPointForm({ name: '', type: 'turnstile', location: '', hardware_id: '', relay_endpoint: '' })
    setPointModal(true)
  }

  function openEditPoint(p: AccessPoint) {
    setEditingPoint(p)
    setPointForm({ name: p.name, type: p.type, location: p.location || '', hardware_id: p.hardware_id || '', relay_endpoint: p.relay_endpoint || '' })
    setPointModal(true)
  }

  async function savePoint(e: React.FormEvent) {
    e.preventDefault()
    if (!pointForm.name) return
    setSavingPoint(true)
    const supabase = createClient()

    const payload = {
      club_id: 1,
      name: pointForm.name,
      type: pointForm.type,
      location: pointForm.location || null,
      hardware_id: pointForm.hardware_id || null,
      relay_endpoint: pointForm.relay_endpoint || null,
    }

    if (editingPoint) {
      const { error } = await supabase.from('nm_access_points').update(payload).eq('id', editingPoint.id)
      if (error) toast('error', error.message)
      else { toast('success', 'Punto de acceso actualizado'); setPointModal(false); loadPoints() }
    } else {
      const { error } = await supabase.from('nm_access_points').insert(payload)
      if (error) toast('error', error.message)
      else { toast('success', 'Punto de acceso creado'); setPointModal(false); loadPoints() }
    }
    setSavingPoint(false)
  }

  async function deletePoint(id: number) {
    if (!confirm('¿Eliminar este punto de acceso?')) return
    const supabase = createClient()
    const { error } = await supabase.from('nm_access_points').delete().eq('id', id)
    if (error) toast('error', error.message)
    else { toast('info', 'Punto eliminado'); loadPoints() }
  }

  // ─── QR Generation ───
  async function generateQR(userId: string, userName: string) {
    setGeneratingQr(userId)
    try {
      const res = await fetch('/api/access/qr/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId }),
      })
      const data = await res.json()
      if (data.error) {
        toast('error', data.error)
      } else {
        setQrModal({ token: data.qr_value, userName })
        loadCredentials()
        toast('success', 'QR generado correctamente')
      }
    } catch {
      toast('error', 'Error al generar QR')
    }
    setGeneratingQr(null)
  }

  async function deleteCredential(id: number) {
    if (!confirm('¿Eliminar esta credencial?')) return
    const supabase = createClient()
    const { error } = await supabase.from('nm_access_credentials').delete().eq('id', id)
    if (error) toast('error', error.message)
    else { toast('info', 'Credencial eliminada'); loadCredentials() }
  }

  // ─── Filtered credentials ───
  const filteredCreds = credentials.filter(c => {
    if (!credSearch.trim()) return true
    const q = credSearch.toLowerCase()
    const u = c.user as unknown as { full_name?: string; email?: string } | null
    return (u?.full_name || '').toLowerCase().includes(q) || (u?.email || '').toLowerCase().includes(q)
  })

  // ─── Log date navigation ───
  function changeLogDate(delta: number) {
    const d = new Date(logDate + 'T12:00:00')
    d.setDate(d.getDate() + delta)
    setLogDate(d.toISOString().split('T')[0])
  }
  const isToday = logDate === new Date().toISOString().split('T')[0]
  const dateLabel = new Date(logDate + 'T12:00:00').toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Control de Accesos</h1>
          <p className="text-sm text-slate-400 mt-1">Molinetes, credenciales QR/NFC y registro de entradas</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex bg-slate-800/50 rounded-lg p-1 gap-1">
        {TABS.map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 py-2 px-3 rounded-md text-sm font-medium transition-colors ${tab === t ? 'bg-cyan-600 text-white' : 'text-slate-400 hover:text-white'}`}
          >
            {t}
          </button>
        ))}
      </div>

      {/* ═══════════ TAB: Puntos de Acceso ═══════════ */}
      {tab === 'Puntos de Acceso' && (
        <>
          <div className="flex justify-end">
            <Button onClick={openNewPoint}>
              <Plus size={16} className="mr-1" /> Nuevo Punto
            </Button>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {loadingPoints ? (
              <p className="text-slate-500 col-span-full text-center py-12">Cargando...</p>
            ) : points.length === 0 ? (
              <p className="text-slate-500 col-span-full text-center py-12">No hay puntos de acceso configurados</p>
            ) : points.map(p => (
              <Card key={p.id}>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${p.is_active ? 'bg-green-500/10' : 'bg-slate-700'}`}>
                      <DoorOpen size={20} className={p.is_active ? 'text-green-400' : 'text-slate-500'} />
                    </div>
                    <div>
                      <p className="font-semibold text-white">{p.name}</p>
                      <p className="text-xs text-slate-400">{ACCESS_TYPES.find(t => t.value === p.type)?.label || p.type}</p>
                    </div>
                  </div>
                  <Badge variant={p.is_active ? 'success' : 'danger'}>
                    {p.is_active ? 'Activo' : 'Inactivo'}
                  </Badge>
                </div>
                {p.location && (
                  <p className="text-xs text-slate-500 mt-3">📍 {p.location}</p>
                )}
                <div className="mt-3 flex items-center gap-2 text-xs text-slate-500">
                  {p.hardware_id && <span className="flex items-center gap-1"><Settings2 size={12} /> {p.hardware_id}</span>}
                  {p.relay_endpoint && <span className="flex items-center gap-1"><Wifi size={12} /> Relay configurado</span>}
                </div>
                <div className="mt-4 flex items-center gap-2">
                  <Button variant="ghost" size="sm" onClick={() => openEditPoint(p)}>Editar</Button>
                  <button onClick={() => deletePoint(p.id)} className="p-1.5 rounded text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-colors">
                    <Trash2 size={14} />
                  </button>
                </div>
              </Card>
            ))}
          </div>

          {/* Point Modal */}
          <Modal
            open={pointModal}
            onClose={() => setPointModal(false)}
            title={editingPoint ? 'Editar Punto de Acceso' : 'Nuevo Punto de Acceso'}
            footer={
              <div className="flex items-center gap-3">
                <Button variant="ghost" onClick={() => setPointModal(false)}>Cancelar</Button>
                <Button onClick={savePoint} loading={savingPoint}>Guardar</Button>
              </div>
            }
          >
            <form onSubmit={savePoint} className="space-y-4">
              <Input label="Nombre" placeholder="Entrada Principal" value={pointForm.name} onChange={e => setPointForm(f => ({ ...f, name: e.target.value }))} required />
              <Select label="Tipo" value={pointForm.type} onChange={e => setPointForm(f => ({ ...f, type: e.target.value }))} options={ACCESS_TYPES} />
              <Input label="Ubicación" placeholder="Planta baja, recepción..." value={pointForm.location} onChange={e => setPointForm(f => ({ ...f, location: e.target.value }))} />
              <Input label="Hardware ID" placeholder="rpi-entrada-01" value={pointForm.hardware_id} onChange={e => setPointForm(f => ({ ...f, hardware_id: e.target.value }))} />
              <Input label="Relay Endpoint" placeholder="http://192.168.1.100:8080/open" value={pointForm.relay_endpoint} onChange={e => setPointForm(f => ({ ...f, relay_endpoint: e.target.value }))} />
            </form>
          </Modal>
        </>
      )}

      {/* ═══════════ TAB: Credenciales ═══════════ */}
      {tab === 'Credenciales' && (
        <>
          <div className="flex items-center gap-4">
            <div className="relative flex-1 max-w-sm">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Buscar por nombre o email..."
                value={credSearch}
                onChange={e => setCredSearch(e.target.value)}
                className="w-full rounded-lg border border-slate-600 bg-slate-800 pl-9 pr-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/40"
              />
            </div>
          </div>

          <Card>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-700">
                    <th className="text-left text-xs font-medium text-slate-400 pb-3 pl-2">Usuario</th>
                    <th className="text-left text-xs font-medium text-slate-400 pb-3">Tipo</th>
                    <th className="text-left text-xs font-medium text-slate-400 pb-3">Estado</th>
                    <th className="text-left text-xs font-medium text-slate-400 pb-3">Último uso</th>
                    <th className="text-right text-xs font-medium text-slate-400 pb-3 pr-2">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {loadingCreds ? (
                    <tr><td colSpan={5} className="text-center py-8 text-slate-500">Cargando...</td></tr>
                  ) : filteredCreds.length === 0 ? (
                    <tr><td colSpan={5} className="text-center py-8 text-slate-500">No hay credenciales registradas</td></tr>
                  ) : filteredCreds.map(c => {
                    const u = c.user as unknown as { full_name?: string; email?: string } | null
                    return (
                      <tr key={c.id} className="border-b border-slate-800 hover:bg-slate-800/30">
                        <td className="py-3 pl-2">
                          <p className="text-sm text-white">{u?.full_name || 'Sin nombre'}</p>
                          <p className="text-xs text-slate-500">{u?.email}</p>
                        </td>
                        <td className="py-3">
                          <div className="flex items-center gap-1.5 text-sm text-slate-300">
                            {CREDENTIAL_TYPES[c.type]?.icon}
                            {CREDENTIAL_TYPES[c.type]?.label || c.type}
                          </div>
                        </td>
                        <td className="py-3">
                          <Badge variant={c.is_active ? 'success' : 'danger'}>
                            {c.is_active ? 'Activa' : 'Inactiva'}
                          </Badge>
                        </td>
                        <td className="py-3 text-sm text-slate-400">
                          {c.last_used_at ? new Date(c.last_used_at).toLocaleString('es-ES', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : 'Nunca'}
                        </td>
                        <td className="py-3 pr-2 text-right">
                          <div className="flex items-center justify-end gap-1">
                            {c.type === 'qr' && (
                              <button
                                onClick={() => setQrModal({ token: `${window.location.origin}/api/access/validate?t=${c.credential_data}`, userName: u?.full_name || '' })}
                                className="p-1.5 rounded text-cyan-400 hover:bg-cyan-500/10 transition-colors"
                                title="Ver QR"
                              >
                                <QrCode size={14} />
                              </button>
                            )}
                            <button onClick={() => deleteCredential(c.id)} className="p-1.5 rounded text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-colors">
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </Card>

          {/* QR View Modal */}
          <Modal open={!!qrModal} onClose={() => setQrModal(null)} title="Código QR de Acceso" size="sm">
            {qrModal && (
              <div className="flex flex-col items-center py-4">
                <QRCodeDisplay
                  value={qrModal.token}
                  size={220}
                  title={qrModal.userName}
                  subtitle="Mostrá este código en el lector"
                />
              </div>
            )}
          </Modal>
        </>
      )}

      {/* ═══════════ TAB: Registro ═══════════ */}
      {tab === 'Registro' && (
        <>
          {/* Date nav */}
          <div className="flex items-center gap-2">
            <button onClick={() => changeLogDate(-1)} className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors">
              <ChevronLeft size={20} />
            </button>
            <button onClick={() => setLogDate(new Date().toISOString().split('T')[0])} className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${isToday ? 'bg-cyan-600 text-white' : 'bg-slate-800 hover:bg-slate-700 text-slate-300'}`}>
              Hoy
            </button>
            <button onClick={() => changeLogDate(1)} className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors">
              <ChevronRight size={20} />
            </button>
            <span className="text-lg font-semibold text-white capitalize ml-2">{dateLabel}</span>
            <input type="date" value={logDate} onChange={e => setLogDate(e.target.value)} className="ml-auto bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-white" />
          </div>

          {/* KPIs */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <KpiCard title="Total accesos" value={totalToday} icon={<DoorOpen size={20} />} />
            <KpiCard title="Permitidos" value={grantedToday} icon={<CheckCircle size={20} />} color="#10b981" />
            <KpiCard title="Denegados" value={deniedToday} icon={<XCircle size={20} />} color="#ef4444" />
            <KpiCard title="Usuarios únicos" value={uniqueUsers} icon={<Users size={20} />} color="#6366f1" />
          </div>

          {/* Log table */}
          <Card>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-700">
                    <th className="text-left text-xs font-medium text-slate-400 pb-3 pl-2">Hora</th>
                    <th className="text-left text-xs font-medium text-slate-400 pb-3">Usuario</th>
                    <th className="text-left text-xs font-medium text-slate-400 pb-3">Punto</th>
                    <th className="text-left text-xs font-medium text-slate-400 pb-3">Método</th>
                    <th className="text-left text-xs font-medium text-slate-400 pb-3">Resultado</th>
                    <th className="text-left text-xs font-medium text-slate-400 pb-3">Motivo</th>
                  </tr>
                </thead>
                <tbody>
                  {loadingLogs ? (
                    <tr><td colSpan={6} className="text-center py-8 text-slate-500">Cargando...</td></tr>
                  ) : logs.length === 0 ? (
                    <tr><td colSpan={6} className="text-center py-8 text-slate-500">No hay registros para este día</td></tr>
                  ) : logs.map(log => {
                    const u = log.user as unknown as { full_name?: string; email?: string } | null
                    const ap = log.access_point as unknown as { name?: string } | null
                    return (
                      <tr key={log.id} className="border-b border-slate-800 hover:bg-slate-800/30">
                        <td className="py-3 pl-2 text-sm text-slate-400 tabular-nums">
                          {new Date(log.timestamp).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                        </td>
                        <td className="py-3">
                          <p className="text-sm text-white">{u?.full_name || 'Desconocido'}</p>
                          {u?.email && <p className="text-xs text-slate-500">{u.email}</p>}
                        </td>
                        <td className="py-3 text-sm text-slate-400">{ap?.name || '—'}</td>
                        <td className="py-3">
                          <div className="flex items-center gap-1.5 text-sm text-slate-300">
                            {CREDENTIAL_TYPES[log.credential_type || '']?.icon || <Shield size={14} />}
                            {CREDENTIAL_TYPES[log.credential_type || '']?.label || log.credential_type || '—'}
                          </div>
                        </td>
                        <td className="py-3">
                          <Badge variant={log.granted ? 'success' : 'danger'}>
                            {log.granted ? 'Permitido' : 'Denegado'}
                          </Badge>
                        </td>
                        <td className="py-3 text-xs text-slate-500">
                          {log.denial_reason ? log.denial_reason.replace(/_/g, ' ') : '—'}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}
    </div>
  )
}
