'use client'

import { cn } from '@/lib/utils'
import { CheckCircle, XCircle, Info, AlertTriangle, X } from 'lucide-react'
import { createContext, useCallback, useContext, useState } from 'react'

type ToastType = 'success' | 'error' | 'info' | 'warning'

interface Toast {
  id: string
  type: ToastType
  message: string
}

interface ToastContextValue {
  toast: (type: ToastType, message: string) => void
}

const ToastContext = createContext<ToastContextValue>({ toast: () => {} })

export function useToast() {
  return useContext(ToastContext)
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const toast = useCallback((type: ToastType, message: string) => {
    const id = Math.random().toString(36).slice(2)
    setToasts(prev => [...prev, { id, type, message }])
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id))
    }, 4000)
  }, [])

  const dismiss = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id))
  }, [])

  const icons = {
    success: <CheckCircle size={18} />,
    error: <XCircle size={18} />,
    info: <Info size={18} />,
    warning: <AlertTriangle size={18} />,
  }

  const colors = {
    success: 'border-green-500/30 text-green-400',
    error: 'border-red-500/30 text-red-400',
    info: 'border-cyan-500/30 text-cyan-400',
    warning: 'border-amber-500/30 text-amber-400',
  }

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2">
        {toasts.map(t => (
          <div
            key={t.id}
            className={cn(
              'flex items-center gap-3 rounded-lg border bg-slate-800 px-4 py-3 shadow-lg animate-in slide-in-from-right',
              colors[t.type]
            )}
          >
            {icons[t.type]}
            <span className="text-sm text-slate-200">{t.message}</span>
            <button onClick={() => dismiss(t.id)} className="ml-2 text-slate-500 hover:text-white">
              <X size={14} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}
