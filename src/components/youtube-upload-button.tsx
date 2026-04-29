'use client'

import { useState } from 'react'
import { PlaySquare, Loader2, ExternalLink, CheckCircle2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Modal } from '@/components/ui/modal'
import { Input } from '@/components/ui/input'
import { useToast } from '@/components/ui/toast'

interface Props {
  highlightId: number
  isUploaded?: boolean
  youtubeUrl?: string | null
  defaultTitle?: string
}

export function YouTubeUploadButton({ highlightId, isUploaded, youtubeUrl, defaultTitle }: Props) {
  const { toast } = useToast()
  const [open, setOpen] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [title, setTitle] = useState(defaultTitle ?? '')
  const [description, setDescription] = useState('')
  const [privacy, setPrivacy] = useState<'public' | 'unlisted' | 'private'>('unlisted')
  const [done, setDone] = useState<{ url: string } | null>(null)

  if (isUploaded && youtubeUrl) {
    return (
      <a href={youtubeUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-500/20 hover:bg-red-500/30 border border-red-500/40 text-red-300 text-xs font-medium">
        <PlaySquare size={14} /> Ver en YouTube <ExternalLink size={10} />
      </a>
    )
  }

  async function upload() {
    setUploading(true)
    try {
      const res = await fetch('/api/youtube/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ highlight_id: highlightId, title, description, privacy }),
      })
      const j = await res.json()
      if (!res.ok) throw new Error(j.error ?? 'Error')
      setDone({ url: j.url })
      toast('success', '¡Subido a YouTube!')
    } catch (e) {
      toast('error', (e as Error).message)
    } finally {
      setUploading(false)
    }
  }

  return (
    <>
      <Button size="sm" variant="ghost" onClick={() => setOpen(true)} className="gap-1.5 text-red-400 hover:bg-red-500/10">
        <PlaySquare size={14} /> Subir a YouTube
      </Button>

      {open && (
        <Modal open onClose={() => setOpen(false)} title="Subir highlight a YouTube" size="md">
          {done ? (
            <div className="text-center py-8 space-y-3">
              <CheckCircle2 size={48} className="mx-auto text-emerald-400" />
              <p className="text-lg font-bold text-white">¡Subido con éxito!</p>
              <a
                href={done.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-red-500 hover:bg-red-600 text-white font-medium"
              >
                <PlaySquare size={16} /> Ver en YouTube <ExternalLink size={12} />
              </a>
              <p className="text-xs text-slate-400 break-all px-4">{done.url}</p>
              <Button onClick={() => { setOpen(false); setDone(null) }} variant="ghost">Cerrar</Button>
            </div>
          ) : (
            <div className="space-y-3">
              <div>
                <label className="text-xs text-slate-400 mb-1 block">Título del video</label>
                <Input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Ej: Smash de Juan Manuel - Final Torneo Marzo"
                  maxLength={100}
                />
                <p className="text-[10px] text-slate-500 mt-1">{title.length}/100</p>
              </div>

              <div>
                <label className="text-xs text-slate-400 mb-1 block">Descripción (opcional)</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Detalles del partido..."
                  className="w-full h-20 rounded-lg bg-slate-800 border border-slate-700 text-white text-sm p-2 resize-none"
                  maxLength={5000}
                />
              </div>

              <div>
                <label className="text-xs text-slate-400 mb-1 block">Privacidad</label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { value: 'public', label: 'Público', desc: 'Cualquiera lo encuentra' },
                    { value: 'unlisted', label: 'Oculto', desc: 'Solo con el link' },
                    { value: 'private', label: 'Privado', desc: 'Solo vos' },
                  ].map(opt => (
                    <button
                      key={opt.value}
                      onClick={() => setPrivacy(opt.value as 'public' | 'unlisted' | 'private')}
                      className={`p-2 rounded-lg border text-left text-xs ${
                        privacy === opt.value
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

              <div className="flex gap-2 pt-2">
                <Button variant="ghost" onClick={() => setOpen(false)} disabled={uploading} className="flex-1">
                  Cancelar
                </Button>
                <Button onClick={upload} disabled={uploading || !title} className="flex-1 gap-1.5">
                  {uploading ? <Loader2 size={14} className="animate-spin" /> : <PlaySquare size={14} />}
                  {uploading ? 'Subiendo...' : 'Subir a YouTube'}
                </Button>
              </div>
            </div>
          )}
        </Modal>
      )}
    </>
  )
}
