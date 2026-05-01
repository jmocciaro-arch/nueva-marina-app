/**
 * Catálogo de formatos de competición.
 *
 * Los formatos viven en la tabla `nm_game_formats` y son editables desde
 * `/admin/config/formatos`. Este archivo expone:
 *
 *  - Tipos TypeScript del modelo (FormatDef).
 *  - Helpers para fetchear desde Supabase.
 *  - Un FALLBACK hardcoded que se usa solo si la query a BD falla
 *    (para que la UI nunca quede sin opciones).
 */

import type { SupabaseClient } from '@supabase/supabase-js'

export type FormatGenerator =
  | 'round_robin'
  | 'single_elimination'
  | 'double_elimination'
  | 'pool_bracket'
  | 'americano'
  | 'mexicano'
  | 'king_of_court'
  | 'swiss'
  | 'box_league'
  | 'league_playoffs'
  | 'manual'

export type FormatScope = 'tournament' | 'league' | 'both'

export interface FormatDef {
  id?: number
  value: string         // = slug en BD
  label: string
  description: string
  applicableTo: FormatScope
  generator: FormatGenerator
  minTeams: number
  maxTeams?: number
  usesGroups?: boolean
  defaultGroupSize?: number
  ready: boolean
  isSystem?: boolean
  isActive?: boolean
  sortOrder?: number
}

interface DbRow {
  id: number
  slug: string
  label: string
  description: string | null
  applicable_to: string
  generator: string
  min_teams: number
  max_teams: number | null
  uses_groups: boolean
  default_group_size: number | null
  ready: boolean
  is_system: boolean
  is_active: boolean
  sort_order: number
}

function rowToFormat(row: DbRow): FormatDef {
  return {
    id: row.id,
    value: row.slug,
    label: row.label,
    description: row.description ?? '',
    applicableTo: (row.applicable_to as FormatScope) || 'tournament',
    generator: (row.generator as FormatGenerator) || 'manual',
    minTeams: row.min_teams,
    maxTeams: row.max_teams ?? undefined,
    usesGroups: row.uses_groups,
    defaultGroupSize: row.default_group_size ?? 4,
    ready: row.ready,
    isSystem: row.is_system,
    isActive: row.is_active,
    sortOrder: row.sort_order,
  }
}

export async function fetchFormats(supabase: SupabaseClient): Promise<FormatDef[]> {
  const { data, error } = await supabase
    .from('nm_game_formats')
    .select('*')
    .eq('is_active', true)
    .order('sort_order', { ascending: true })

  if (error || !data) {
    console.warn('[tournament-formats] usando fallback:', error?.message)
    return FALLBACK_FORMATS
  }
  return (data as DbRow[]).map(rowToFormat)
}

export async function fetchAllFormats(supabase: SupabaseClient): Promise<FormatDef[]> {
  // Igual que fetchFormats pero incluye los is_active=false (para la pantalla admin)
  const { data, error } = await supabase
    .from('nm_game_formats')
    .select('*')
    .order('sort_order', { ascending: true })

  if (error || !data) {
    console.warn('[tournament-formats] fetchAll fallback:', error?.message)
    return FALLBACK_FORMATS
  }
  return (data as DbRow[]).map(rowToFormat)
}

// ── Helpers locales sobre un array ──────────────────────────────────────────

export function getFormatFrom(formats: FormatDef[], value: string): FormatDef | undefined {
  return formats.find(f => f.value === value)
}

export function formatsForScopeFrom(formats: FormatDef[], scope: 'tournament' | 'league'): FormatDef[] {
  return formats.filter(f => f.applicableTo === scope || f.applicableTo === 'both')
}

// ── Fallback hardcoded (espejo del seed de la migración) ────────────────────
// Si la BD no responde, mantenemos la app funcionando con estos.

export const FALLBACK_FORMATS: FormatDef[] = [
  { value: 'eliminacion_directa', label: 'Eliminación Directa', applicableTo: 'tournament',
    description: 'Bracket clásico tipo Wimbledon: perdés y quedás afuera.',
    generator: 'single_elimination', minTeams: 2, ready: true, sortOrder: 10 },
  { value: 'doble_eliminacion', label: 'Doble Eliminación', applicableTo: 'tournament',
    description: 'Bracket con repechaje: tenés dos vidas.',
    generator: 'double_elimination', minTeams: 4, ready: false, sortOrder: 20 },
  { value: 'round_robin', label: 'Round Robin (todos contra todos)', applicableTo: 'both',
    description: 'Cada equipo juega contra todos los demás una vez.',
    generator: 'round_robin', minTeams: 3, maxTeams: 12, ready: true, sortOrder: 30 },
  { value: 'pool_bracket', label: 'Pool + Bracket', applicableTo: 'tournament',
    description: 'Fase de grupos + eliminación directa.',
    generator: 'pool_bracket', minTeams: 8, usesGroups: true, defaultGroupSize: 4, ready: true, sortOrder: 40 },
  { value: 'premier', label: 'Premier', applicableTo: 'tournament',
    description: 'Formato profesional tipo Premier Padel.',
    generator: 'manual', minTeams: 8, ready: false, sortOrder: 50 },
  { value: 'americano', label: 'Americano (rotación individual)', applicableTo: 'tournament',
    description: 'Inscripción individual con rotación de parejas y rivales.',
    generator: 'americano', minTeams: 4, maxTeams: 24, ready: false, sortOrder: 60 },
  { value: 'mexicano', label: 'Mexicano (pairing por ranking)', applicableTo: 'tournament',
    description: 'Variante del Americano con emparejamiento por puntos.',
    generator: 'mexicano', minTeams: 4, maxTeams: 24, ready: false, sortOrder: 70 },
  { value: 'mixin', label: 'Mixín (americano por niveles)', applicableTo: 'tournament',
    description: 'Americano con emparejamiento por nivel del jugador.',
    generator: 'americano', minTeams: 8, maxTeams: 24, ready: false, sortOrder: 80 },
  { value: 'king_of_court', label: 'King of the Court / El Pozo', applicableTo: 'tournament',
    description: 'Pistas con jerarquía. Ganador sube, perdedor baja.',
    generator: 'king_of_court', minTeams: 4, ready: false, sortOrder: 90 },
  { value: 'suizo', label: 'Sistema Suizo', applicableTo: 'tournament',
    description: 'Pairing por puntaje similar, sin rematches.',
    generator: 'swiss', minTeams: 6, ready: false, sortOrder: 100 },
  { value: 'padel_social', label: 'Pádel Social / Pádel Mix', applicableTo: 'tournament',
    description: 'Día social sin formato fijo, partidos a mano.',
    generator: 'manual', minTeams: 4, ready: true, sortOrder: 110 },
  { value: 'league', label: 'Liga regular', applicableTo: 'league',
    description: 'Todos contra todos en jornadas semanales.',
    generator: 'round_robin', minTeams: 4, ready: true, sortOrder: 200 },
  { value: 'league_playoffs', label: 'Liga + Playoffs', applicableTo: 'league',
    description: 'Liga regular + bracket final con los mejores.',
    generator: 'league_playoffs', minTeams: 6, ready: false, sortOrder: 210 },
  { value: 'box_league', label: 'Box League / Cajas', applicableTo: 'league',
    description: 'Equipos divididos en cajas con ascenso y descenso.',
    generator: 'box_league', minTeams: 6, usesGroups: true, defaultGroupSize: 4, ready: false, sortOrder: 220 },
  { value: 'mexicano_jornadas', label: 'Mexicano por jornadas', applicableTo: 'league',
    description: 'Mexicano repartido en jornadas semanales.',
    generator: 'mexicano', minTeams: 8, ready: false, sortOrder: 230 },
]

// ── Aliases sync para compat hacia atrás (usan el fallback) ─────────────────
// Las pantallas que usan estos pueden migrar al hook useGameFormats() cuando
// quieran reflejar los cambios del admin en vivo.

export const FORMATS = FALLBACK_FORMATS

export function getFormat(value: string): FormatDef | undefined {
  return getFormatFrom(FALLBACK_FORMATS, value)
}

export function formatsForScope(scope: 'tournament' | 'league'): FormatDef[] {
  return formatsForScopeFrom(FALLBACK_FORMATS, scope)
}

export function isFormatReady(value: string): boolean {
  return getFormat(value)?.ready === true
}
