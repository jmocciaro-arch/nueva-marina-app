-- ============================================================================
-- 20260501100001_game_formats_table.sql
-- Tabla de formatos de competición editable desde el admin
--
-- En lugar de tenerlos hardcodeados en src/lib/tournament-formats.ts,
-- ahora viven en BD y se pueden editar/agregar/desactivar desde la UI.
-- Idempotente: corre limpio aunque ya existan datos.
-- ============================================================================

CREATE TABLE IF NOT EXISTS nm_game_formats (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  club_id bigint REFERENCES nm_clubs(id) ON DELETE CASCADE DEFAULT 1,
  slug text NOT NULL,
  label text NOT NULL,
  description text,
  applicable_to text NOT NULL DEFAULT 'tournament' CHECK (applicable_to IN ('tournament', 'league', 'both')),
  generator text NOT NULL DEFAULT 'manual',
  min_teams int NOT NULL DEFAULT 2,
  max_teams int,
  uses_groups boolean NOT NULL DEFAULT false,
  default_group_size int DEFAULT 4,
  ready boolean NOT NULL DEFAULT false,
  is_system boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  sort_order int NOT NULL DEFAULT 100,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(club_id, slug)
);

CREATE INDEX IF NOT EXISTS idx_nm_game_formats_club_active
  ON nm_game_formats(club_id, is_active, sort_order);

-- ── RLS ──────────────────────────────────────────────────────────────────────
ALTER TABLE nm_game_formats ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS nm_game_formats_select ON nm_game_formats;
CREATE POLICY nm_game_formats_select ON nm_game_formats
  FOR SELECT USING (true);

DROP POLICY IF EXISTS nm_game_formats_modify ON nm_game_formats;
CREATE POLICY nm_game_formats_modify ON nm_game_formats
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM nm_club_members
      WHERE user_id = auth.uid()
        AND club_id = nm_game_formats.club_id
        AND is_active = true
        AND role IN ('owner', 'admin')
    )
  );

-- ── Permiso ─────────────────────────────────────────────────────────────────
INSERT INTO nm_permissions (key, module, description) VALUES
  ('config.manage_formats', 'config', 'Gestionar formatos de juego')
ON CONFLICT (key) DO NOTHING;

-- ── Trigger updated_at ───────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION nm_game_formats_set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_nm_game_formats_updated_at ON nm_game_formats;
CREATE TRIGGER tr_nm_game_formats_updated_at
  BEFORE UPDATE ON nm_game_formats
  FOR EACH ROW EXECUTE FUNCTION nm_game_formats_set_updated_at();

-- ── Realtime ─────────────────────────────────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'nm_game_formats'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.nm_game_formats';
  END IF;
END $$;

-- ── Seed de los 14 formatos actuales ─────────────────────────────────────────
-- Idempotente: si ya existe el slug, no hace nada.

INSERT INTO nm_game_formats (club_id, slug, label, description, applicable_to, generator, min_teams, max_teams, uses_groups, default_group_size, ready, is_system, sort_order) VALUES
  (1, 'eliminacion_directa', 'Eliminación Directa',
   'Bracket clásico tipo Wimbledon: perdés y quedás afuera. Si hay un número impar o no es potencia de 2, se asignan BYEs a los cabezas de serie.',
   'tournament', 'single_elimination', 2, NULL, false, 4, true, true, 10),

  (1, 'doble_eliminacion', 'Doble Eliminación',
   'Bracket con repechaje: tenés dos vidas. Los que pierden en el cuadro principal pasan al cuadro de consolación y siguen compitiendo.',
   'tournament', 'double_elimination', 4, NULL, false, 4, false, true, 20),

  (1, 'round_robin', 'Round Robin (todos contra todos)',
   'Cada equipo juega contra todos los demás una vez. Gana el que más puntos suma al final. Ideal para 4 a 8 equipos.',
   'both', 'round_robin', 3, 12, false, 4, true, true, 30),

  (1, 'pool_bracket', 'Pool + Bracket (grupos + eliminación)',
   'Fase de grupos clasificatoria (todos contra todos en grupos de 4). Los 2 mejores de cada grupo pasan a un bracket de eliminación directa.',
   'tournament', 'pool_bracket', 8, NULL, true, 4, true, true, 40),

  (1, 'premier', 'Premier',
   'Formato profesional tipo Premier Padel: cuadro principal con previa clasificatoria. Requiere armar los partidos manualmente por ahora.',
   'tournament', 'manual', 8, NULL, false, 4, false, true, 50),

  (1, 'americano', 'Americano (rotación individual)',
   'Inscripción individual. Los jugadores rotan de compañero y rivales en cada partido. Se cuentan puntos personales (no por pareja). Ideal para "días de pádel" de 8-16 jugadores.',
   'tournament', 'americano', 4, 24, false, 4, false, true, 60),

  (1, 'mexicano', 'Mexicano (pairing por ranking)',
   'Variación del Americano. Ronda 1 aleatoria; en las siguientes, los jugadores se emparejan según los puntos acumulados (los punteros entre sí). Más competitivo que el Americano clásico.',
   'tournament', 'mexicano', 4, 24, false, 4, false, true, 70),

  (1, 'mixin', 'Mixín (americano por niveles)',
   'Variante social del Americano: los jugadores rotan compañero y rivales, pero el emparejamiento se hace POR NIVEL (los Nivel 4 entre sí, los Nivel 3 entre sí, etc.). Garantiza partidos parejos.',
   'tournament', 'americano', 8, 24, false, 4, false, true, 80),

  (1, 'king_of_court', 'King of the Court / El Pozo',
   'Pistas con jerarquía (1 = la más alta). Parejas fijas. Partidos por tiempo. Al terminar, el ganador sube a la pista superior y el perdedor baja. Llena las pistas todo el día.',
   'tournament', 'king_of_court', 4, NULL, false, 4, false, true, 90),

  (1, 'suizo', 'Sistema Suizo',
   'En cada ronda los equipos se enfrentan con otros de puntaje similar, evitando rematches. Funciona muy bien con muchos equipos en pocas rondas.',
   'tournament', 'swiss', 6, NULL, false, 4, false, true, 100),

  (1, 'padel_social', 'Pádel Social / Pádel Mix',
   'Día de pádel social sin formato competitivo fijo. El admin arma partidos a mano según quién llega, mezclando parejas y niveles libremente.',
   'tournament', 'manual', 4, NULL, false, 4, true, true, 110),

  (1, 'league', 'Liga regular',
   'Todos contra todos durante varias semanas. Los partidos se distribuyen en jornadas. Gana el que más puntos suma al final de la temporada.',
   'league', 'round_robin', 4, NULL, false, 4, true, true, 200),

  (1, 'league_playoffs', 'Liga + Playoffs',
   'Liga regular + eliminación directa al final con los X mejores. La temporada regular define los seeds del bracket.',
   'league', 'league_playoffs', 6, NULL, false, 4, false, true, 210),

  (1, 'box_league', 'Box League / Cajas',
   'Equipos divididos en cajas o divisiones por nivel (1ª, 2ª, 3ª, etc.). Round Robin dentro de cada caja. Al final, los mejores ascienden y los últimos descienden.',
   'league', 'box_league', 6, NULL, true, 4, false, true, 220),

  (1, 'mexicano_jornadas', 'Mexicano por jornadas',
   'En cada jornada se rearman parejas según el ranking acumulado. Variante de liga social donde los compañeros cambian semana a semana.',
   'league', 'mexicano', 8, NULL, false, 4, false, true, 230)
ON CONFLICT (club_id, slug) DO NOTHING;
