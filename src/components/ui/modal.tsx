'use client'

import { cn } from '@/lib/utils'
import { X } from 'lucide-react'
import { useEffect } from 'react'

interface ModalProps {
  open: boolean
  onClose: () => void
  title: string
  children: React.ReactNode
  size?: 'sm' | 'md' | 'lg' | 'xl'
  footer?: React.ReactNode
}

export function Modal({ open, onClose, title, children, size = 'md', footer }: ModalProps) {
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => { document.body.style.overflow = '' }
  }, [open])

  useEffect(() => {
    function handleEscape(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    if (open) window.addEventListener('keydown', handleEscape)
    return () => window.removeEventListener('keydown', handleEscape)
  }, [open, onClose])

  if (!open) return null

  const sizes = {
    sm: 'max-w-md',
    md: 'max-w-lg',
    lg: 'max-w-2xl',
    xl: 'max-w-4xl',
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className={cn(
        'relative w-full bg-slate-800 border-slate-700 shadow-2xl flex flex-col',
        'sm:rounded-xl sm:border sm:mx-4 sm:max-h-[90vh]',
        'rounded-t-2xl border-t max-h-[95vh]',
        sizes[size],
      )}>
        <div className="flex items-center justify-between px-4 sm:px-6 py-3 sm:py-4 border-b border-slate-700 shrink-0">
          <h2 className="text-base sm:text-lg font-semibold text-white">{title}</h2>
          <button onClick={onClose} className="p-2 -mr-2 text-slate-400 hover:text-white transition-colors">
            <X size={22} />
          </button>
        </div>
        <div className="px-4 sm:px-6 py-4 overflow-y-auto flex-1">
          {children}
        </div>
        {footer && (
          <div className="flex items-center justify-end gap-3 px-4 sm:px-6 py-3 sm:py-4 border-t border-slate-700 shrink-0">
            {footer}
          </div>
        )}
      </div>
    </div>
  )
}
