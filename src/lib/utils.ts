import { clsx, type ClassValue } from 'clsx'

export function cn(...inputs: ClassValue[]) {
  return clsx(inputs)
}

export function formatCurrency(amount: number, currency = 'EUR'): string {
  return new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
  }).format(amount)
}

export function formatDate(date: string | Date, options?: Intl.DateTimeFormatOptions): string {
  const d = typeof date === 'string' ? new Date(date) : date
  return d.toLocaleDateString('es-ES', options || {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

export function formatTime(time: string): string {
  return time.slice(0, 5) // "08:00:00" → "08:00"
}

export function formatDateShort(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date
  return d.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })
}

export function generateTimeSlots(start: string, end: string, durationMinutes: number): string[] {
  const slots: string[] = []
  const [startH, startM] = start.split(':').map(Number)
  const [endH, endM] = end.split(':').map(Number)
  let current = startH * 60 + startM
  const endMin = (endH === 0 ? 24 : endH) * 60 + endM

  while (current < endMin) {
    const h = Math.floor(current / 60)
    const m = current % 60
    slots.push(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`)
    current += durationMinutes
  }
  return slots
}

export const COURT_COLORS = [
  '#06b6d4', // cyan
  '#8b5cf6', // violet
  '#f59e0b', // amber
  '#10b981', // emerald
  '#ef4444', // red
  '#ec4899', // pink
]

export const STATUS_LABELS: Record<string, { label: string; class: string }> = {
  draft: { label: 'Borrador', class: 'bg-gray-500/20 text-gray-400' },
  registration: { label: 'Inscripción', class: 'bg-blue-500/20 text-blue-400' },
  upcoming: { label: 'Próxima', class: 'bg-blue-500/20 text-blue-400' },
  active: { label: 'En Curso', class: 'bg-green-500/20 text-green-400' },
  playoffs: { label: 'Playoffs', class: 'bg-amber-500/20 text-amber-400' },
  finished: { label: 'Finalizada', class: 'bg-cyan-500/20 text-cyan-400' },
  cancelled: { label: 'Cancelada', class: 'bg-red-500/20 text-red-400' },
  pending: { label: 'Pendiente', class: 'bg-yellow-500/20 text-yellow-400' },
  confirmed: { label: 'Confirmada', class: 'bg-green-500/20 text-green-400' },
  completed: { label: 'Completado', class: 'bg-cyan-500/20 text-cyan-400' },
  paid: { label: 'Pagado', class: 'bg-green-500/20 text-green-400' },
}
