'use client'

import { useEffect, useState, useCallback } from 'react'
import { useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/components/ui/toast'
import { PlaySquare, CheckCircle2, XCircle, ExternalLink, Settings, Trash2 } from 'lucide-react'

interface YouTubeCredentials {
  id: number
  channel_id: string | null
  channel_title: string | null
  channel_thumbnail_url: string | null
  default_privacy: string
  auto_upload_highlights: boolean
  authorized_at: string
  last_used_at: string | null
}

export default function YouTubeConfigPage() {
  const supabase = createClient()
  const { toast } = useToast()
  const params = useSearchParams()
  const [creds, setCreds] = useState<YouTubeCredentials | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase.from('nm_youtube_credentials').select('*').eq('club_id', 1).maybeSingle()
    setCreds(data as YouTubeCredentials | null)
    setLoading(false)
  }, [supabase])

  useEffect(() => {
    load()
    if (params.get('success')) toast('success', '¡YouTube conectado!')
    if (params.get('error')) toast('error', `Error: ${params.get('error')}`)
  }, [load, params, toast])

  async function disconnect() {
    if (!confirm('¿Desconectar YouTube? Tendrás que volver a autorizar para subir videos.')) return
    await supabase.from('nm_youtube_credentials').delete().eq('club_id', 1)
    toast('info', 'YouTube desconectado')
    load()
  }

  async function updateSettings(updates: Partial<YouTubeCredentials>) {
    if (!creds) return
    await supabase.from('nm_youtube_credentials').update(updates).eq('id', creds.id)
    load()
  }

  if (loading) return <div className="text-slate-400 p-8">Cargando...</div>

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center gap-3">
        <PlaySquare size={28} className="text-red-500" />
        <div>
          <h1 className="text-2xl font-bold text-white">YouTube</h1>
          <p className="text-sm text-slate-400">Conectá el canal del club para subir highlights y embeber lives</p>
        </div>
      </div>

      {!creds ? (
        // ── No conectado ──
        <Card>
          <div className="text-center py-8 space-y-4">
            <PlaySquare size={64} className="mx-auto text-red-500/30" />
            <div>
              <p className="text-lg font-bold text-white">No conectaste YouTube todavía</p>
              <p className="text-sm text-slate-400 mt-1">Autorizá el canal del club para empezar</p>
            </div>
            <a href="/api/youtube/auth">
              <Button className="gap-2 bg-red-500 hover:bg-red-600">
                <PlaySquare size={16} /> Conectar canal de YouTube
              </Button>
            </a>
          </div>
        </Card>
      ) : (
        // ── Conectado ──
        <>
          <Card>
            <div className="flex items-start gap-4">
              {creds.channel_thumbnail_url && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={creds.channel_thumbnail_url} alt="" className="w-16 h-16 rounded-full" />
              )}
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <CheckCircle2 size={18} className="text-emerald-400" />
                  <span className="text-xs font-bold text-emerald-400 uppercase">Conectado</span>
                </div>
                <h2 className="text-lg font-bold text-white">{creds.channel_title}</h2>
                <p className="text-xs text-slate-500 font-mono">{creds.channel_id}</p>
                <p className="text-xs text-slate-400 mt-2">
                  Autorizado: {new Date(creds.authorized_at).toLocaleString('es-AR')}
                </p>
                {creds.last_used_at && (
                  <p className="text-xs text-slate-500">
                    Último upload: {new Date(creds.last_used_at).toLocaleString('es-AR')}
                  </p>
                )}
              </div>
              <a
                href={`https://youtube.com/channel/${creds.channel_id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-cyan-400 hover:text-cyan-300 flex items-center gap-1"
              >
                Ver canal <ExternalLink size={12} />
              </a>
            </div>
          </Card>

          <Card>
            <h3 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
              <Settings size={16} /> Configuración de uploads
            </h3>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-slate-400 mb-2 block">Privacidad por defecto</label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { value: 'public', label: 'Público', desc: 'Todos lo encuentran' },
                    { value: 'unlisted', label: 'Oculto', desc: 'Solo con link' },
                    { value: 'private', label: 'Privado', desc: 'Solo el club' },
                  ].map(opt => (
                    <button
                      key={opt.value}
                      onClick={() => updateSettings({ default_privacy: opt.value })}
                      className={`p-2 rounded-lg border text-left text-xs ${
                        creds.default_privacy === opt.value
                          ? 'bg-red-500/20 border-red-500/50 text-white'
                          : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-white'
                      }`}
                    >
                      <div className="font-bold">{opt.label}</div>
                      <div className="text-[10px] opacity-70">{opt.desc}</div>
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-between bg-slate-800/50 rounded-lg p-3">
                <div>
                  <p className="text-sm text-white font-medium">Auto-subir highlights</p>
                  <p className="text-xs text-slate-500">Cuando guardás un highlight, se sube a YouTube automáticamente</p>
                </div>
                <button
                  onClick={() => updateSettings({ auto_upload_highlights: !creds.auto_upload_highlights })}
                  className={`w-12 h-6 rounded-full transition-colors relative ${creds.auto_upload_highlights ? 'bg-red-500' : 'bg-slate-700'}`}
                >
                  <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-transform ${creds.auto_upload_highlights ? 'translate-x-6' : 'translate-x-0.5'}`} />
                </button>
              </div>
            </div>
          </Card>

          <div className="flex gap-2">
            <a href="/api/youtube/auth">
              <Button variant="ghost" className="gap-2"><PlaySquare size={14} /> Re-autorizar</Button>
            </a>
            <Button variant="danger" onClick={disconnect} className="gap-2">
              <Trash2 size={14} /> Desconectar
            </Button>
          </div>
        </>
      )}

      {/* Setup guide */}
      <Card>
        <h3 className="text-sm font-bold text-white mb-3">📋 Cómo configurar (primera vez)</h3>
        <ol className="text-xs text-slate-300 space-y-2 list-decimal list-inside">
          <li>Andá a <a href="https://console.cloud.google.com" target="_blank" rel="noopener noreferrer" className="text-cyan-400 hover:underline">Google Cloud Console</a> y creá un proyecto (ej: &quot;Nueva Marina YouTube&quot;)</li>
          <li>Activá la <span className="text-cyan-400">YouTube Data API v3</span> en APIs &amp; Services</li>
          <li>Configurá la pantalla de consentimiento OAuth (External, datos del club)</li>
          <li>Creá credenciales OAuth 2.0 Client ID (Web application)</li>
          <li>Agregá las URIs de redirect:
            <ul className="ml-6 mt-1 space-y-0.5 text-slate-400">
              <li>• <span className="text-cyan-400">https://nuevamarina.es/api/youtube/callback</span></li>
              <li>• <span className="text-cyan-400">https://nueva-marina-app.vercel.app/api/youtube/callback</span></li>
            </ul>
          </li>
          <li>Copiá el Client ID y Client Secret</li>
          <li>En Vercel (Settings → Environment Variables), agregá:
            <ul className="ml-6 mt-1 space-y-0.5 text-slate-400 font-mono text-[10px]">
              <li>GOOGLE_CLIENT_ID = tu_client_id</li>
              <li>GOOGLE_CLIENT_SECRET = tu_client_secret</li>
            </ul>
          </li>
          <li>Volvé acá y tocá &quot;Conectar canal de YouTube&quot;</li>
          <li>Iniciá sesión con la cuenta del canal del club</li>
          <li>Aceptá los permisos: subir videos + ver canal</li>
        </ol>
      </Card>
    </div>
  )
}
