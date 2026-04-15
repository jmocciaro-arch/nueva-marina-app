'use client'

import { useEffect, useState } from 'react'
import { Download, X } from 'lucide-react'

// Tipo mínimo del evento beforeinstallprompt
interface BIPEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

export function PWARegister() {
  const [installEvent, setInstallEvent] = useState<BIPEvent | null>(null)
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    // Registrar SW
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(err => {
        console.warn('SW register failed', err)
      })
    }

    // Capturar prompt de instalación
    const onBIP = (e: Event) => {
      e.preventDefault()
      setInstallEvent(e as BIPEvent)
    }
    window.addEventListener('beforeinstallprompt', onBIP)

    // Si el usuario ya instaló, ocultar
    const onInstalled = () => setInstallEvent(null)
    window.addEventListener('appinstalled', onInstalled)

    // Recordar "Más tarde"
    if (localStorage.getItem('nm-install-dismissed') === '1') {
      setDismissed(true)
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', onBIP)
      window.removeEventListener('appinstalled', onInstalled)
    }
  }, [])

  async function install() {
    if (!installEvent) return
    await installEvent.prompt()
    const { outcome } = await installEvent.userChoice
    if (outcome === 'accepted') setInstallEvent(null)
  }

  function dismiss() {
    localStorage.setItem('nm-install-dismissed', '1')
    setDismissed(true)
  }

  if (!installEvent || dismissed) return null

  return (
    <div className="fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:max-w-sm z-50 bg-slate-800 border border-cyan-500/40 rounded-xl shadow-lg p-4 flex items-start gap-3">
      <div className="w-10 h-10 rounded-lg bg-cyan-600/20 flex items-center justify-center shrink-0">
        <Download className="text-cyan-400" size={20} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-white">Instalá Nueva Marina</p>
        <p className="text-xs text-slate-400 mt-0.5">
          Acceso rápido, funciona offline y QR siempre a mano.
        </p>
        <div className="flex gap-2 mt-3">
          <button
            onClick={install}
            className="px-3 py-1.5 bg-cyan-600 hover:bg-cyan-700 text-white text-xs font-medium rounded-lg"
          >
            Instalar
          </button>
          <button
            onClick={dismiss}
            className="px-3 py-1.5 text-slate-400 hover:text-white text-xs font-medium"
          >
            Más tarde
          </button>
        </div>
      </div>
      <button onClick={dismiss} className="text-slate-500 hover:text-white" title="Cerrar">
        <X size={16} />
      </button>
    </div>
  )
}
