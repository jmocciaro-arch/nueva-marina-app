'use client'

import { useEffect, useState } from 'react'

export interface SponsorItem {
  image_url: string
  link?: string | null
  alt?: string | null
}

interface Props {
  sponsors: SponsorItem[]
  /** Tiempo entre rotaciones en ms. Default 5000 (5s) */
  intervalMs?: number
  /** Variante visual: portrait (sidebar vertical) o landscape (banner horizontal) */
  variant?: 'portrait' | 'landscape'
  className?: string
}

export function SponsorBanner({ sponsors, intervalMs = 5000, variant = 'portrait', className = '' }: Props) {
  const [idx, setIdx] = useState(0)

  useEffect(() => {
    if (sponsors.length <= 1) return
    const t = setInterval(() => setIdx(i => (i + 1) % sponsors.length), intervalMs)
    return () => clearInterval(t)
  }, [sponsors.length, intervalMs])

  if (sponsors.length === 0) return null

  const aspect = variant === 'portrait' ? 'aspect-[3/4]' : 'aspect-[16/9]'

  return (
    <div className={className}>
      <div className={`relative w-full ${aspect} rounded-2xl overflow-hidden bg-slate-900 border border-slate-800 shadow-xl`}>
        {sponsors.map((s, i) => {
          const inner = (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={s.image_url}
              alt={s.alt || 'Sponsor'}
              className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-700 ${i === idx ? 'opacity-100' : 'opacity-0'}`}
            />
          )
          return s.link ? (
            <a key={i} href={s.link} target="_blank" rel="noopener noreferrer" className={`absolute inset-0 ${i === idx ? 'pointer-events-auto' : 'pointer-events-none'}`}>
              {inner}
            </a>
          ) : (
            <div key={i} className="absolute inset-0">{inner}</div>
          )
        })}
      </div>
      {sponsors.length > 1 && (
        <div className="flex justify-center gap-1.5 mt-3">
          {sponsors.map((_, i) => (
            <button
              key={i}
              onClick={() => setIdx(i)}
              className={`h-1.5 rounded-full transition-all ${i === idx ? 'w-6 bg-cyan-400' : 'w-1.5 bg-slate-600 hover:bg-slate-500'}`}
              aria-label={`Sponsor ${i + 1}`}
            />
          ))}
        </div>
      )}
    </div>
  )
}
