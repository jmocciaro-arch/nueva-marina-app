'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Modal } from '@/components/ui/modal'
import { useToast } from '@/components/ui/toast'
import { Volleyball, Loader2 } from 'lucide-react'

interface Props {
  matchType: 'tournament' | 'league'
  matchId: number
  label?: string
  size?: 'sm' | 'md' | 'lg'
  variant?: 'primary' | 'secondary' | 'ghost' | 'outline' | 'danger'
}

export function StartLiveScorerButton({ matchType, matchId, label = 'Marcador en vivo', size = 'sm', variant = 'primary' }: Props) {
  const router = useRouter()
  const { toast } = useToast()
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)

  // Opciones del partido
  const [setsToWin, setSetsToWin] = useState(2)
  const [goldenPoint, setGoldenPoint] = useState(false)
  const [superTiebreak, setSuperTiebreak] = useState(false)

  async function start() {
    setLoading(true)
    try {
      const res = await fetch('/api/live-match', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          match_type: matchType,
          match_id: matchId,
          options: { sets_to_win: setsToWin, golden_point: goldenPoint, super_tiebreak_final: superTiebreak },
        }),
      })
      const j = await res.json()
      if (!res.ok) throw new Error(j.error ?? 'Error')
      router.push(`/match/${j.session.id}`)
    } catch (e) {
      toast('error', (e as Error).message)
      setLoading(false)
    }
  }

  return (
    <>
      <Button size={size} variant={variant} onClick={() => setOpen(true)} className="gap-1.5">
        <Volleyball size={14} /> {label}
      </Button>

      {open && (
        <Modal open onClose={() => setOpen(false)} title="Iniciar marcador en vivo" size="md">
          <div className="space-y-4">
            <p className="text-sm text-slate-400">
              Configurá las reglas del partido. Después podés llevar el marcador punto a punto desde tu celular o tablet.
            </p>

            {/* Sets para ganar */}
            <div>
              <label className="text-sm text-slate-300 font-medium mb-2 block">Sets para ganar</label>
              <div className="flex gap-2">
                {[2, 3].map(n => (
                  <button
                    key={n}
                    onClick={() => setSetsToWin(n)}
                    className={`flex-1 px-4 py-2 rounded-lg border text-sm font-medium transition-colors ${
                      setsToWin === n
                        ? 'bg-cyan-500/20 border-cyan-500/50 text-cyan-300'
                        : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-white'
                    }`}
                  >
                    Mejor de {n * 2 - 1} ({n} sets)
                  </button>
                ))}
              </div>
            </div>

            {/* Punto de oro */}
            <div className="flex items-center justify-between bg-slate-800/50 rounded-lg p-3">
              <div>
                <p className="text-sm text-slate-300 font-medium">Punto de oro</p>
                <p className="text-xs text-slate-500">En 40-40, un solo punto define el game</p>
              </div>
              <button
                onClick={() => setGoldenPoint(!goldenPoint)}
                className={`w-12 h-6 rounded-full transition-colors relative ${goldenPoint ? 'bg-cyan-500' : 'bg-slate-700'}`}
              >
                <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-transform ${goldenPoint ? 'translate-x-6' : 'translate-x-0.5'}`} />
              </button>
            </div>

            {/* Super tiebreak */}
            <div className="flex items-center justify-between bg-slate-800/50 rounded-lg p-3">
              <div>
                <p className="text-sm text-slate-300 font-medium">Super tiebreak en el último set</p>
                <p className="text-xs text-slate-500">Tiebreak a 10 en lugar del set decisivo</p>
              </div>
              <button
                onClick={() => setSuperTiebreak(!superTiebreak)}
                className={`w-12 h-6 rounded-full transition-colors relative ${superTiebreak ? 'bg-cyan-500' : 'bg-slate-700'}`}
              >
                <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-transform ${superTiebreak ? 'translate-x-6' : 'translate-x-0.5'}`} />
              </button>
            </div>

            <div className="flex gap-2 pt-2">
              <Button variant="ghost" onClick={() => setOpen(false)} className="flex-1" disabled={loading}>
                Cancelar
              </Button>
              <Button onClick={start} className="flex-1 gap-1.5" disabled={loading}>
                {loading ? <Loader2 size={14} className="animate-spin" /> : <Volleyball size={14} />}
                Iniciar marcador
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </>
  )
}
