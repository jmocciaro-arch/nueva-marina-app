'use client'

import { QRCodeSVG } from 'qrcode.react'

interface QRCodeDisplayProps {
  value: string
  size?: number
  title?: string
  subtitle?: string
  showFullScreen?: boolean
}

export function QRCodeDisplay({ value, size = 256, title, subtitle }: QRCodeDisplayProps) {
  return (
    <div className="flex flex-col items-center gap-4">
      <div className="bg-white p-4 rounded-2xl shadow-lg">
        <QRCodeSVG
          value={value}
          size={size}
          level="H"
          includeMargin={false}
          imageSettings={{
            src: '',
            height: 0,
            width: 0,
            excavate: false,
          }}
        />
      </div>
      {title && (
        <div className="text-center">
          <p className="text-lg font-semibold text-white">{title}</p>
          {subtitle && <p className="text-sm text-slate-400 mt-1">{subtitle}</p>}
        </div>
      )}
    </div>
  )
}

export function QRCodeFullScreen({ value, title, subtitle }: QRCodeDisplayProps) {
  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col items-center justify-center">
      <div className="bg-white p-6 rounded-3xl shadow-2xl">
        <QRCodeSVG
          value={value}
          size={Math.min(window?.innerWidth ? window.innerWidth - 80 : 300, 400)}
          level="H"
          includeMargin={false}
        />
      </div>
      {title && (
        <div className="text-center mt-6">
          <p className="text-xl font-bold text-white">{title}</p>
          {subtitle && <p className="text-sm text-slate-400 mt-2">{subtitle}</p>}
        </div>
      )}
      <p className="text-xs text-slate-600 mt-8">Mostrá este código en el lector del molinete</p>
    </div>
  )
}
