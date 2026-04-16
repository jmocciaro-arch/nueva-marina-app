import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: {
    default: 'Torneo',
    template: '%s | Nueva Marina',
  },
  description: 'Bracket y resultados del torneo en Nueva Marina Padel & Sport.',
}

export default function TorneoLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <>{children}</>
}
