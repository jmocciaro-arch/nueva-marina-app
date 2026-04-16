import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Configurar Pantalla — Nueva Marina',
}

export default function PantallaLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
