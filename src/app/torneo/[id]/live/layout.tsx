import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Torneo en vivo | Nueva Marina',
  description: 'Bracket en tiempo real para pantalla del club.',
}

// This layout sits inside the root layout (html/body already provided).
// It simply passes children through — no sidebar, no topbar.
export default function LiveLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <>{children}</>
}
