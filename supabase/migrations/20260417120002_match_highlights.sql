-- ─── Migración 018: Highlights de partidos en vivo ──────────────────────────
-- Guarda clips de video de cada punto importante (auto o manual)

CREATE TABLE IF NOT EXISTS nm_match_highlights (
  id bigserial PRIMARY KEY,
  session_id bigint NOT NULL REFERENCES nm_live_match_sessions(id) ON DELETE CASCADE,
  point_id bigint REFERENCES nm_live_match_points(id) ON DELETE SET NULL,

  -- Video
  video_url text NOT NULL,                        -- URL en Supabase Storage
  thumbnail_url text,
  duration_seconds numeric(5,2),
  file_size_bytes bigint,

  -- Contexto del momento
  set_number int,
  game_score text,                                -- "3-2"
  point_score text,                               -- "30-15"
  scoring_team int CHECK (scoring_team IN (1, 2)),
  scoring_player_name text,
  point_type text,

  -- Tags y metadata
  tags text[] DEFAULT ARRAY[]::text[],            -- ['ace', 'set_point', 'match_point']
  is_featured boolean DEFAULT false,              -- highlight destacado
  view_count int DEFAULT 0,
  notes text,

  created_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES nm_users(id)
);

CREATE INDEX IF NOT EXISTS idx_highlights_session ON nm_match_highlights(session_id);
CREATE INDEX IF NOT EXISTS idx_highlights_featured ON nm_match_highlights(is_featured) WHERE is_featured = true;

-- ─── Comandos de voz registrados ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS nm_voice_commands (
  id bigserial PRIMARY KEY,
  session_id bigint REFERENCES nm_live_match_sessions(id) ON DELETE CASCADE,
  raw_transcript text NOT NULL,
  recognized_command text,                        -- 'point_team1', 'ace', 'undo', etc.
  confidence numeric(3,2),                        -- 0.00 a 1.00
  executed boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_voice_session ON nm_voice_commands(session_id);

-- ─── RLS ─────────────────────────────────────────────────────────────────────
ALTER TABLE nm_match_highlights ENABLE ROW LEVEL SECURITY;
ALTER TABLE nm_voice_commands ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "highlights_read_all" ON nm_match_highlights;
CREATE POLICY "highlights_read_all" ON nm_match_highlights FOR SELECT USING (true);

DROP POLICY IF EXISTS "highlights_write_auth" ON nm_match_highlights;
CREATE POLICY "highlights_write_auth" ON nm_match_highlights FOR ALL USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "voice_read_auth" ON nm_voice_commands;
CREATE POLICY "voice_read_auth" ON nm_voice_commands FOR SELECT USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "voice_write_auth" ON nm_voice_commands;
CREATE POLICY "voice_write_auth" ON nm_voice_commands FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- Realtime para highlights
ALTER PUBLICATION supabase_realtime ADD TABLE nm_match_highlights;

-- ─── Storage bucket para los clips ───────────────────────────────────────────
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'match-highlights',
  'match-highlights',
  true,
  52428800, -- 50 MB max por archivo
  ARRAY['video/webm', 'video/mp4', 'image/jpeg', 'image/png']
)
ON CONFLICT (id) DO NOTHING;

-- Policies del bucket (lectura pública, escritura autenticados)
DROP POLICY IF EXISTS "highlights_storage_read" ON storage.objects;
CREATE POLICY "highlights_storage_read" ON storage.objects
  FOR SELECT USING (bucket_id = 'match-highlights');

DROP POLICY IF EXISTS "highlights_storage_write" ON storage.objects;
CREATE POLICY "highlights_storage_write" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'match-highlights' AND auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "highlights_storage_delete" ON storage.objects;
CREATE POLICY "highlights_storage_delete" ON storage.objects
  FOR DELETE USING (bucket_id = 'match-highlights' AND auth.uid() IS NOT NULL);
