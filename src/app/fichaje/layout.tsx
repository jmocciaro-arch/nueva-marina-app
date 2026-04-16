import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Fichaje — Nueva Marina',
}

export default function FichajeLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen bg-[#0a0a0f]">
      {children}
    </div>
  )
}
