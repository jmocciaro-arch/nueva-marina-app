/**
 * Catálogo central de formatos de competición.
 *
 * Lo usan tanto torneos (1-3 días) como ligas (varias semanas).
 *
 * - `value`: identificador interno (no cambiar después de poner en producción).
 * - `label`: cómo se ve en pantalla.
 * - `applicableTo`: si aparece en torneos, ligas o en ambos.
 * - `description`: explicación corta para mostrar al admin.
 * - `generator`: cuál motor de fixture genera los partidos. Si es `manual`,
 *   el admin gestiona los partidos a mano (todavía no implementado).
 * - `minTeams`/`maxTeams`: rango sugerido (no es validación dura).
 * - `usesGroups`: si arma fase de grupos antes de eliminación.
 * - `defaultGroupSize`: tamaño por grupo (default 4).
 */

export type FormatGenerator =
  | 'round_robin'         // todos contra todos en 1 grupo
  | 'single_elimination'  // bracket clásico (ya implementado)
  | 'double_elimination'  // bracket con repechaje
  | 'pool_bracket'        // grupos + eliminación
  | 'americano'           // rotación de parejas individual
  | 'mexicano'            // pairing dinámico por puntos
  | 'king_of_court'       // jerarquía de pistas, ganador sube
  | 'swiss'               // pairing por puntaje similar
  | 'box_league'          // divisiones con ascenso/descenso
  | 'league_playoffs'     // liga regular + playoffs
  | 'manual'              // sin generador, partidos a mano

export type FormatScope = 'tournament' | 'league' | 'both'

export interface FormatDef {
  value: string
  label: string
  applicableTo: FormatScope
  description: string
  generator: FormatGenerator
  minTeams: number
  maxTeams?: number
  usesGroups?: boolean
  defaultGroupSize?: number
  /** Si true, ya está implementado y se puede usar al 100%. Si false, hay que gestionar partidos manualmente. */
  ready: boolean
}

export const FORMATS: FormatDef[] = [
  // ═══════════ Torneos ═══════════
  {
    value: 'eliminacion_directa',
    label: 'Eliminación Directa',
    applicableTo: 'tournament',
    description: 'Bracket clásico tipo Wimbledon: perdés y quedás afuera. Si hay un número impar o no es potencia de 2, se asignan BYEs a los cabezas de serie.',
    generator: 'single_elimination',
    minTeams: 2,
    ready: true,
  },
  {
    value: 'doble_eliminacion',
    label: 'Doble Eliminación',
    applicableTo: 'tournament',
    description: 'Bracket con repechaje: tenés dos vidas. Los que pierden en el cuadro principal pasan al cuadro de consolación y siguen compitiendo.',
    generator: 'double_elimination',
    minTeams: 4,
    ready: false,
  },
  {
    value: 'round_robin',
    label: 'Round Robin (todos contra todos)',
    applicableTo: 'both',
    description: 'Cada equipo juega contra todos los demás una vez. Gana el que más puntos suma al final. Ideal para 4 a 8 equipos.',
    generator: 'round_robin',
    minTeams: 3,
    maxTeams: 12,
    ready: true,
  },
  {
    value: 'pool_bracket',
    label: 'Pool + Bracket (grupos + eliminación)',
    applicableTo: 'tournament',
    description: 'Fase de grupos clasificatoria (todos contra todos en grupos de 4). Los 2 mejores de cada grupo pasan a un bracket de eliminación directa.',
    generator: 'pool_bracket',
    minTeams: 8,
    usesGroups: true,
    defaultGroupSize: 4,
    ready: true,
  },
  {
    value: 'premier',
    label: 'Premier',
    applicableTo: 'tournament',
    description: 'Formato profesional tipo Premier Padel: cuadro principal con previa clasificatoria. Requiere armar los partidos manualmente por ahora.',
    generator: 'manual',
    minTeams: 8,
    ready: false,
  },
  {
    value: 'americano',
    label: 'Americano (rotación individual)',
    applicableTo: 'tournament',
    description: 'Inscripción individual. Los jugadores rotan de compañero y rivales en cada partido. Se cuentan puntos personales (no por pareja). Ideal para "días de pádel" de 8-16 jugadores.',
    generator: 'americano',
    minTeams: 4,
    maxTeams: 24,
    ready: false,
  },
  {
    value: 'mexicano',
    label: 'Mexicano (pairing por ranking)',
    applicableTo: 'tournament',
    description: 'Variación del Americano. Ronda 1 aleatoria; en las siguientes, los jugadores se emparejan según los puntos acumulados (los punteros entre sí). Más competitivo que el Americano clásico.',
    generator: 'mexicano',
    minTeams: 4,
    maxTeams: 24,
    ready: false,
  },
  {
    value: 'king_of_court',
    label: 'King of the Court / El Pozo',
    applicableTo: 'tournament',
    description: 'Pistas con jerarquía (1 = la más alta). Parejas fijas. Partidos por tiempo. Al terminar, el ganador sube a la pista superior y el perdedor baja. Llena las pistas todo el día.',
    generator: 'king_of_court',
    minTeams: 4,
    ready: false,
  },
  {
    value: 'suizo',
    label: 'Sistema Suizo',
    applicableTo: 'tournament',
    description: 'En cada ronda los equipos se enfrentan con otros de puntaje similar, evitando rematches. Funciona muy bien con muchos equipos en pocas rondas (ej: 16 equipos en 4-5 rondas).',
    generator: 'swiss',
    minTeams: 6,
    ready: false,
  },
  {
    value: 'mixin',
    label: 'Mixín (americano por niveles)',
    applicableTo: 'tournament',
    description: 'Variante social del Americano: los jugadores rotan compañero y rivales, pero el emparejamiento se hace POR NIVEL (los Nivel 4 entre sí, los Nivel 3 entre sí, etc.). Garantiza partidos parejos. Ideal para clubs con socios de niveles diversos que quieren jugar el mismo día sin desniveles.',
    generator: 'americano',
    minTeams: 8,
    maxTeams: 24,
    ready: false,
  },
  {
    value: 'padel_social',
    label: 'Pádel Social / Pádel Mix',
    applicableTo: 'tournament',
    description: 'Día de pádel social sin formato competitivo fijo. El admin arma partidos a mano según quién llega, mezclando parejas y niveles libremente. Ideal para eventos abiertos, clases sociales o jornadas informales del club.',
    generator: 'manual',
    minTeams: 4,
    ready: true,
  },

  // ═══════════ Ligas ═══════════
  {
    value: 'league',
    label: 'Liga regular',
    applicableTo: 'league',
    description: 'Todos contra todos durante varias semanas. Los partidos se distribuyen en jornadas. Gana el que más puntos suma al final de la temporada.',
    generator: 'round_robin',
    minTeams: 4,
    ready: true,
  },
  {
    value: 'league_playoffs',
    label: 'Liga + Playoffs',
    applicableTo: 'league',
    description: 'Liga regular + eliminación directa al final con los X mejores. La temporada regular define los seeds del bracket.',
    generator: 'league_playoffs',
    minTeams: 6,
    ready: false,
  },
  {
    value: 'box_league',
    label: 'Box League / Cajas',
    applicableTo: 'league',
    description: 'Equipos divididos en "cajas" o divisiones por nivel (1ª, 2ª, 3ª, etc.). Round Robin dentro de cada caja. Al final, los mejores ascienden y los últimos descienden.',
    generator: 'box_league',
    minTeams: 6,
    usesGroups: true,
    defaultGroupSize: 4,
    ready: false,
  },
  {
    value: 'mexicano_jornadas',
    label: 'Mexicano por jornadas',
    applicableTo: 'league',
    description: 'En cada jornada se rearman parejas según el ranking acumulado. Variante de liga social donde los compañeros cambian semana a semana.',
    generator: 'mexicano',
    minTeams: 8,
    ready: false,
  },
]

export function getFormat(value: string): FormatDef | undefined {
  return FORMATS.find(f => f.value === value)
}

export function formatsForScope(scope: 'tournament' | 'league'): FormatDef[] {
  return FORMATS.filter(f => f.applicableTo === scope || f.applicableTo === 'both')
}

export function isFormatReady(value: string): boolean {
  return getFormat(value)?.ready === true
}
