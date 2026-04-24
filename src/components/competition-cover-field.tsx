'use client'

import { useState } from 'react'
import { Image as ImageIcon, Link as LinkIcon, Upload, Loader2, X } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

interface Props {
  value: string
  onChange: (url: string) => void
}

export function CompetitionCoverField({ value, onChange }: Props) {
  const [mode, setMode] = useState<'url' | 'upload'>('url')
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const supabase = createClient()

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setError(null)
    if (!file.type.startsWith('image/')) { setError('El archivo debe ser una imagen'); return }
    if (file.size > 5 * 1024 * 1024) { setError('La imagen no debe superar 5 MB'); return }
    setUploading(true)
    try {
      const ext = file.name.split('.').pop() || 'jpg'
      const path = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`
      const { error: upErr } = await supabase.storage.from('tournament-covers').upload(path, file, { upsert: false })
      if (upErr) { setError(upErr.message); return }
      const { data: pub } = supabase.storage.from('tournament-covers').getPublicUrl(path)
      onChange(pub.publicUrl)
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-slate-300 flex items-center gap-2">
        <ImageIcon size={14} /> Portada
      </label>
      <div className="flex gap-2">
        <button type="button" onClick={() => setMode('url')}
          className={`flex-1 py-1.5 px-3 rounded-md text-xs font-medium flex items-center justify-center gap-1.5 transition-colors ${
            mode === 'url' ? 'bg-cyan-600 text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
          }`}>
          <LinkIcon size={12} /> Desde URL
        </button>
        <button type="button" onClick={() => setMode('upload')}
          className={`flex-1 py-1.5 px-3 rounded-md text-xs font-medium flex items-center justify-center gap-1.5 transition-colors ${
            mode === 'upload' ? 'bg-cyan-600 text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
          }`}>
          <Upload size={12} /> Subir foto
        </button>
      </div>
      {mode === 'url' ? (
        <input type="url" value={value}
          onChange={e => onChange(e.target.value)}
          placeholder="https://..."
          className="w-full rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/40 focus:border-cyan-500" />
      ) : (
        <label className="flex items-center justify-center gap-2 py-2.5 px-4 bg-slate-800 hover:bg-slate-700 border border-dashed border-slate-500 rounded-lg cursor-pointer text-sm text-slate-300 transition-colors">
          {uploading ? <><Loader2 size={14} className="animate-spin" /> Subiendo...</> : <><Upload size={14} /> Elegir imagen (máx 5 MB)</>}
          <input type="file" accept="image/*" onChange={handleUpload} className="hidden" disabled={uploading} />
        </label>
      )}
      {error && <p className="text-xs text-red-400">{error}</p>}
      {value && (
        <div className="relative">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={value} alt="Portada" className="w-full h-28 object-cover rounded-lg border border-slate-600" />
          <button type="button" onClick={() => onChange('')}
            className="absolute top-1.5 right-1.5 p-1 bg-black/70 hover:bg-red-500 rounded-md text-white transition-colors">
            <X size={12} />
          </button>
        </div>
      )}
    </div>
  )
}
