import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'

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
      </body>
    </html>
  )
}
