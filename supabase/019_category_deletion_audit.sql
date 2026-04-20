-- ============================================================================
-- 019_category_deletion_audit.sql
-- Registro histórico inmutable de categorías de liga borradas.
-- Una categoría borrada arrastra en cascada sus equipos, jornadas, partidos
-- y grupos (vía ON DELETE CASCADE en el schema base). Este log guarda el
-- motivo, el snapshot de la categoría, la lista de equipos que tenía y los
-- conteos de partidos al momento del borrado.
-- ============================================================================

CREATE TABLE IF NOT EXISTS nm_league_category_deletions (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

  -- referencia blanda: la liga podría borrarse después
  league_id bigint REFERENCES nm_leagues(id) ON DELETE SET NULL,

  -- id original (no FK porque la categoría ya no existe)
  original_category_id bigint NOT NULL,

  -- snapshot
  category_name text,
  gender text,
  level text,
  status_at_deletion text,

  -- qué arrastró en cascada
  teams_deleted int DEFAULT 0,
  rounds_deleted int DEFAULT 0,
  matches_deleted int DEFAULT 0,
  playoff_matches_deleted int DEFAULT 0,

  -- motivo (obligatorio)
  reason text NOT NULL CHECK (length(trim(reason)) >= 3),

  -- quién
  deleted_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  deleted_by_name text,
  deleted_by_email text,

  -- snapshots ricos
  category_snapshot jsonb,        -- row completo de nm_league_categories
  teams_snapshot jsonb DEFAULT '[]'::jsonb,  -- array con los equipos que tenía

  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_category_deletions_league
  ON nm_league_category_deletions(league_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_category_deletions_deleted_by
  ON nm_league_category_deletions(deleted_by, created_at DESC);

-- ============================================================================
-- RLS: solo admin/owner lee e inserta. Update y delete BLOQUEADOS (log
-- inmutable).
-- ============================================================================
ALTER TABLE nm_league_category_deletions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS category_deletions_select ON nm_league_category_deletions;
CREATE POLICY category_deletions_select ON nm_league_category_deletions
  FOR SELECT TO authenticated
  USING (nm_is_admin());

DROP POLICY IF EXISTS category_deletions_insert ON nm_league_category_deletions;
CREATE POLICY category_deletions_insert ON nm_league_category_deletions
  FOR INSERT TO authenticated
  WITH CHECK (nm_is_admin());

COMMENT ON TABLE nm_league_category_deletions IS
  'Registro inmutable de categorías de liga borradas. Incluye snapshot, conteos de cascade y motivo.';
