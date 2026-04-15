'use client'

import { useEffect } from 'react'
import { AlertTriangle, RefreshCw } from 'lucide-react'

export default function AdminError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error('[AdminError]', error)
  }, [error])

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] px-4 text-center">
      <div className="w-16 h-16 rounded-2xl bg-red-500/10 flex items-center justify-center mb-4">
        <AlertTriangle size={32} className="text-red-400" />
      </div>
      <h2 className="text-xl font-bold text-white mb-2">Error en el panel admin</h2>
      <p className="text-sm text-slate-400 mb-6 max-w-md">
        Algo falló al cargar esta sección. Podés reintentar o volver al dashboard.
      </p>
      <div className="flex gap-3">
        <button
          onClick={reset}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-cyan-600 text-white text-sm font-medium hover:bg-cyan-500 transition-colors"
        >
          <RefreshCw size={16} /> Reintentar
        </button>
        <a
          href="/admin"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-700 text-white text-sm font-medium hover:bg-slate-600 transition-colors"
        >
          Dashboard Admin
        </a>
      </div>
      {error.digest && (
        <p className="text-xs text-slate-600 mt-4">Error ID: {error.digest}</p>
      )}
    </div>
  )
}
