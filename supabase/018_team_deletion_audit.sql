-- ============================================================================
-- 018_team_deletion_audit.sql
-- Registro histórico inmutable de equipos de liga borrados.
-- Cada DELETE de nm_league_teams debe acompañarse de un INSERT acá con la
-- razón del borrado y un snapshot completo del equipo, para auditoría y
-- estadísticas (duplicados, abandonos, errores de carga, etc.).
-- ============================================================================

CREATE TABLE IF NOT EXISTS nm_league_team_deletions (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

  -- referencias "blandas": los equipos y categorías pueden haber cambiado
  league_id bigint REFERENCES nm_leagues(id) ON DELETE SET NULL,
  category_id bigint REFERENCES nm_league_categories(id) ON DELETE SET NULL,

  -- id original del equipo (no es FK — el equipo ya no existe)
  original_team_id bigint NOT NULL,

  -- snapshot de los datos del equipo al momento del borrado
  team_name text,
  player1_name text,
  player2_name text,
  player3_name text,
  player1_id uuid,
  player2_id uuid,
  player3_id uuid,

  -- partidos que se borraron en cascada
  matches_deleted int DEFAULT 0,
  playoff_matches_deleted int DEFAULT 0,

  -- motivo (obligatorio)
  reason text NOT NULL CHECK (length(trim(reason)) >= 3),

  -- auditoría de quién lo hizo
  deleted_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  deleted_by_name text,
  deleted_by_email text,

  -- snapshot completo del row de nm_league_teams (por si se agregan columnas luego)
  snapshot jsonb,

  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_team_deletions_league
  ON nm_league_team_deletions(league_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_team_deletions_category
  ON nm_league_team_deletions(category_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_team_deletions_deleted_by
  ON nm_league_team_deletions(deleted_by, created_at DESC);

-- ============================================================================
-- RLS — solo admin/owner pueden leer e insertar. Update y delete BLOQUEADOS
-- para que el log sea inmutable (si hace falta corregir, se hace vía SQL
-- directo en el dashboard de Supabase).
-- ============================================================================
ALTER TABLE nm_league_team_deletions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS team_deletions_select ON nm_league_team_deletions;
CREATE POLICY team_deletions_select ON nm_league_team_deletions
  FOR SELECT TO authenticated
  USING (nm_is_admin());

DROP POLICY IF EXISTS team_deletions_insert ON nm_league_team_deletions;
CREATE POLICY team_deletions_insert ON nm_league_team_deletions
  FOR INSERT TO authenticated
  WITH CHECK (nm_is_admin());

-- NO policies para UPDATE ni DELETE → el log es inmutable por defecto.

COMMENT ON TABLE nm_league_team_deletions IS
  'Registro inmutable de equipos de liga borrados. Cada row documenta un borrado con razón, snapshot y cantidad de partidos borrados en cascada.';
