-- ============================================================================
-- 017_ai_video_analysis.sql
-- Análisis de partidos con IA a partir de videos subidos por el jugador.
-- Estado inicial: MVP con pipeline mock. El campo `ai_provider` y la tabla
-- `nm_ai_reports` están diseñados para enchufar un servicio real (OpenAI Vision,
-- pipeline dedicado de análisis deportivo, etc.) sin romper el schema.
-- ============================================================================

-- ============================================================================
-- 1. VIDEOS SUBIDOS POR EL JUGADOR
-- ============================================================================
CREATE TABLE IF NOT EXISTS nm_ai_videos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id int NOT NULL DEFAULT 1,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  title text NOT NULL,
  description text,

  -- origen del video
  source text NOT NULL DEFAULT 'upload', -- 'upload' | 'club_camera' | 'external_url'
  video_url text, -- URL pública/firmada si ya está en storage
  thumbnail_url text,
  duration_seconds int,
  file_size_mb numeric(10,2),

  -- metadata del partido
  match_type text DEFAULT 'dobles', -- 'singles' | 'dobles'
  court_side text DEFAULT 'derecha', -- 'derecha' | 'reves'
  match_context text, -- texto libre: "Amistoso vs Juan y Marta"
  opponents text,
  partner text,
  court_id bigint REFERENCES nm_courts(id),

  -- proceso de análisis
  status text NOT NULL DEFAULT 'pending', -- 'pending' | 'processing' | 'completed' | 'failed'
  ai_provider text DEFAULT 'mock_v1', -- 'mock_v1' | 'openai_vision' | 'sportai_pro' | ...
  processing_started_at timestamptz,
  processing_completed_at timestamptz,
  error_message text,

  -- visibilidad
  is_public boolean DEFAULT false,
  shared_with_coach boolean DEFAULT false,
  coach_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,

  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_videos_user ON nm_ai_videos(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_videos_status ON nm_ai_videos(status);
CREATE INDEX IF NOT EXISTS idx_ai_videos_club ON nm_ai_videos(club_id, created_at DESC);

-- ============================================================================
-- 2. INFORME DE ANÁLISIS (1:1 con video cuando status=completed)
-- ============================================================================
CREATE TABLE IF NOT EXISTS nm_ai_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  video_id uuid NOT NULL UNIQUE REFERENCES nm_ai_videos(id) ON DELETE CASCADE,
  club_id int NOT NULL DEFAULT 1,

  -- score global 0-100
  overall_score int NOT NULL DEFAULT 0,
  skill_score int DEFAULT 0,        -- técnica
  positioning_score int DEFAULT 0,  -- posicionamiento
  consistency_score int DEFAULT 0,  -- consistencia

  -- conteo de golpes
  shots_total int DEFAULT 0,
  shots_forehand int DEFAULT 0,
  shots_backhand int DEFAULT 0,
  shots_volley int DEFAULT 0,
  shots_smash int DEFAULT 0,
  shots_serve int DEFAULT 0,
  shots_bandeja int DEFAULT 0,
  shots_vibora int DEFAULT 0,

  -- resultado
  winners_count int DEFAULT 0,
  errors_count int DEFAULT 0,
  unforced_errors int DEFAULT 0,

  -- movimiento
  distance_meters numeric(10,2) DEFAULT 0,
  avg_speed_kmh numeric(5,2) DEFAULT 0,
  max_speed_kmh numeric(5,2) DEFAULT 0,

  -- heatmap serializado (array de celdas {x,y,weight})
  heatmap_data jsonb DEFAULT '[]'::jsonb,

  -- 3-4 recomendaciones principales generadas por IA
  improvements jsonb DEFAULT '[]'::jsonb,
  -- estructura: [{ title, description, priority: 'high'|'med'|'low', shot_type? }]

  -- resumen corto generado por IA
  summary text,

  processed_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_reports_video ON nm_ai_reports(video_id);
CREATE INDEX IF NOT EXISTS idx_ai_reports_club ON nm_ai_reports(club_id, processed_at DESC);

-- ============================================================================
-- 3. MOMENTOS DESTACADOS (timestamps clickables dentro del video)
-- ============================================================================
CREATE TABLE IF NOT EXISTS nm_ai_highlights (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  video_id uuid NOT NULL REFERENCES nm_ai_videos(id) ON DELETE CASCADE,

  timestamp_sec int NOT NULL,
  duration_sec int DEFAULT 5,

  shot_type text, -- 'forehand' | 'backhand' | 'volley' | 'smash' | 'serve' | 'bandeja' | 'vibora'
  outcome text,   -- 'winner' | 'error' | 'neutral'
  quality text,   -- 'excellent' | 'good' | 'regular' | 'poor'

  note text,                     -- nota automática de la IA
  coach_note text,               -- nota del entrenador (opcional)

  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_highlights_video ON nm_ai_highlights(video_id, timestamp_sec);

-- ============================================================================
-- 4. TRIGGER updated_at en nm_ai_videos
-- ============================================================================
CREATE OR REPLACE FUNCTION nm_ai_videos_set_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_nm_ai_videos_updated_at ON nm_ai_videos;
CREATE TRIGGER trg_nm_ai_videos_updated_at
  BEFORE UPDATE ON nm_ai_videos
  FOR EACH ROW
  EXECUTE FUNCTION nm_ai_videos_set_updated_at();

-- ============================================================================
-- 5. RLS — el jugador ve solo los suyos (y los de alumnos que le comparten el
-- coach), admin/owner ven todos los del club. Reutiliza nm_is_admin().
-- ============================================================================
ALTER TABLE nm_ai_videos ENABLE ROW LEVEL SECURITY;
ALTER TABLE nm_ai_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE nm_ai_highlights ENABLE ROW LEVEL SECURITY;

-- políticas videos
DROP POLICY IF EXISTS ai_videos_select ON nm_ai_videos;
CREATE POLICY ai_videos_select ON nm_ai_videos
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR coach_id = auth.uid()
    OR is_public = true
    OR nm_is_admin()
  );

DROP POLICY IF EXISTS ai_videos_insert ON nm_ai_videos;
CREATE POLICY ai_videos_insert ON nm_ai_videos
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() OR nm_is_admin());

DROP POLICY IF EXISTS ai_videos_update ON nm_ai_videos;
CREATE POLICY ai_videos_update ON nm_ai_videos
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid() OR nm_is_admin());

DROP POLICY IF EXISTS ai_videos_delete ON nm_ai_videos;
CREATE POLICY ai_videos_delete ON nm_ai_videos
  FOR DELETE TO authenticated
  USING (user_id = auth.uid() OR nm_is_admin());

-- políticas reports (solo lectura para el dueño; admin puede todo)
DROP POLICY IF EXISTS ai_reports_select ON nm_ai_reports;
CREATE POLICY ai_reports_select ON nm_ai_reports
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM nm_ai_videos v
      WHERE v.id = nm_ai_reports.video_id
        AND (
          v.user_id = auth.uid()
          OR v.coach_id = auth.uid()
          OR v.is_public = true
          OR nm_is_admin()
        )
    )
  );

DROP POLICY IF EXISTS ai_reports_all ON nm_ai_reports;
CREATE POLICY ai_reports_all ON nm_ai_reports
  FOR ALL TO authenticated
  USING (nm_is_admin())
  WITH CHECK (nm_is_admin());

-- políticas highlights
DROP POLICY IF EXISTS ai_highlights_select ON nm_ai_highlights;
CREATE POLICY ai_highlights_select ON nm_ai_highlights
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM nm_ai_videos v
      WHERE v.id = nm_ai_highlights.video_id
        AND (
          v.user_id = auth.uid()
          OR v.coach_id = auth.uid()
          OR v.is_public = true
          OR nm_is_admin()
        )
    )
  );

DROP POLICY IF EXISTS ai_highlights_all ON nm_ai_highlights;
CREATE POLICY ai_highlights_all ON nm_ai_highlights
  FOR ALL TO authenticated
  USING (nm_is_admin())
  WITH CHECK (nm_is_admin());

-- ============================================================================
-- 6. PERMISO NUEVO PARA EL SIDEBAR ADMIN
-- schema real: nm_permissions(key, module, description)
--             nm_role_permissions(role_id, permission_key)
-- Condicional: solo se aplican si las tablas existen (el proyecto pudo no
-- haber aplicado las migraciones 001/006 vía CLI).
-- ============================================================================
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'nm_permissions') THEN
    INSERT INTO nm_permissions (key, module, description)
    VALUES ('ai.analysis.manage', 'padel', 'Análisis IA — gestión de análisis de video de socios')
    ON CONFLICT (key) DO NOTHING;
  END IF;

  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'nm_role_permissions')
     AND EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'nm_roles') THEN
    INSERT INTO nm_role_permissions (role_id, permission_key)
    SELECT r.id, 'ai.analysis.manage'
    FROM nm_roles r
    WHERE r.slug IN ('owner', 'admin') AND r.is_system = true
    ON CONFLICT DO NOTHING;
  END IF;
END $$;
