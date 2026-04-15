import type { Metadata, Viewport } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { PWARegister } from '@/components/pwa-register'

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
})

export const metadata: Metadata = {
  title: {
    default: 'Nueva Marina Padel & Sport',
    template: '%s | Nueva Marina',
  },
  description: 'Reserva pistas de padel, torneos, ligas, gimnasio y tienda deportiva en Nueva Marina, Motril.',
  keywords: ['padel', 'reservas', 'torneos', 'ligas', 'gimnasio', 'motril', 'granada'],
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Nueva Marina',
  },
  icons: {
    icon: [
      { url: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: [{ url: '/icons/icon-192.png', sizes: '192x192' }],
  },
}

export const viewport: Viewport = {
  themeColor: '#0891b2',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="es" className={`${inter.variable} dark`}>
      <body className="min-h-screen bg-[#0b1120] text-slate-200 antialiased">
        {children}
        <PWARegister />
      </body>
    </html>
  )
}
