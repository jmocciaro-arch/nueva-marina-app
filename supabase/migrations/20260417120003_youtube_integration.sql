-- ─── Migración 019: Integración con YouTube ────────────────────────────────
-- Permite linkear partidos a streams en vivo de YouTube y subir highlights
-- automáticamente al canal del club.

-- ─── Tokens OAuth del canal de YouTube del club ─────────────────────────────
CREATE TABLE IF NOT EXISTS nm_youtube_credentials (
  id bigserial PRIMARY KEY,
  club_id bigint REFERENCES nm_clubs(id) DEFAULT 1,

  -- OAuth tokens (encriptados en producción, idealmente)
  access_token text NOT NULL,
  refresh_token text NOT NULL,
  token_expires_at timestamptz,
  scope text,

  -- Info del canal
  channel_id text,
  channel_title text,
  channel_thumbnail_url text,

  -- Configuración de uploads
  default_privacy text DEFAULT 'unlisted' CHECK (default_privacy IN ('public', 'unlisted', 'private')),
  default_category_id text DEFAULT '17',  -- 17 = Sports
  auto_upload_highlights boolean DEFAULT false,
  default_title_template text DEFAULT 'Highlight {player} - {match} - Nueva Marina',

  -- Tracking
  authorized_by uuid REFERENCES nm_users(id),
  authorized_at timestamptz DEFAULT now(),
  last_used_at timestamptz,
  created_at timestamptz DEFAULT now(),

  CONSTRAINT one_per_club UNIQUE (club_id)
);

-- ─── Videos subidos / linkeados ─────────────────────────────────────────────
ALTER TABLE nm_match_highlights
  ADD COLUMN IF NOT EXISTS youtube_video_id text,
  ADD COLUMN IF NOT EXISTS youtube_url text,
  ADD COLUMN IF NOT EXISTS youtube_uploaded_at timestamptz,
  ADD COLUMN IF NOT EXISTS youtube_status text CHECK (youtube_status IN ('pending', 'uploading', 'uploaded', 'failed', NULL));

CREATE INDEX IF NOT EXISTS idx_highlights_youtube ON nm_match_highlights(youtube_video_id) WHERE youtube_video_id IS NOT NULL;

-- ─── Streams en vivo linkeados a partidos ───────────────────────────────────
CREATE TABLE IF NOT EXISTS nm_match_livestreams (
  id bigserial PRIMARY KEY,
  session_id bigint REFERENCES nm_live_match_sessions(id) ON DELETE CASCADE,
  match_type text NOT NULL CHECK (match_type IN ('tournament', 'league', 'friendly')),
  match_id bigint,

  -- Datos del stream
  platform text DEFAULT 'youtube' CHECK (platform IN ('youtube', 'twitch', 'facebook', 'instagram', 'other')),
  stream_url text NOT NULL,                       -- URL completa
  video_id text,                                  -- ID extraído (ej: dQw4w9WgXcQ)
  embed_url text,                                 -- URL para iframe
  thumbnail_url text,
  title text,

  -- Estado
  is_live boolean DEFAULT true,
  started_at timestamptz DEFAULT now(),
  ended_at timestamptz,

  -- Metadata
  added_by uuid REFERENCES nm_users(id),
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_livestreams_session ON nm_match_livestreams(session_id);
CREATE INDEX IF NOT EXISTS idx_livestreams_match ON nm_match_livestreams(match_type, match_id);
CREATE INDEX IF NOT EXISTS idx_livestreams_live ON nm_match_livestreams(is_live) WHERE is_live = true;

-- ─── Cola de uploads pendientes ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS nm_youtube_upload_queue (
  id bigserial PRIMARY KEY,
  highlight_id bigint REFERENCES nm_match_highlights(id) ON DELETE CASCADE,
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'uploading', 'completed', 'failed')),

  title text,
  description text,
  tags text[],
  privacy text DEFAULT 'unlisted',

  attempts int DEFAULT 0,
  last_error text,

  created_at timestamptz DEFAULT now(),
  started_at timestamptz,
  completed_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_upload_queue_pending ON nm_youtube_upload_queue(status) WHERE status = 'pending';

-- ─── RLS ─────────────────────────────────────────────────────────────────────
ALTER TABLE nm_youtube_credentials ENABLE ROW LEVEL SECURITY;
ALTER TABLE nm_match_livestreams ENABLE ROW LEVEL SECURITY;
ALTER TABLE nm_youtube_upload_queue ENABLE ROW LEVEL SECURITY;

-- Solo admins pueden ver credenciales
DROP POLICY IF EXISTS "youtube_creds_admin_only" ON nm_youtube_credentials;
CREATE POLICY "youtube_creds_admin_only" ON nm_youtube_credentials
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM nm_club_members cm
      WHERE cm.user_id = auth.uid()
      AND cm.role IN ('owner', 'admin')
      AND cm.is_active = true
    )
  );

-- Streams: lectura pública, escritura autenticados
DROP POLICY IF EXISTS "livestreams_read_all" ON nm_match_livestreams;
CREATE POLICY "livestreams_read_all" ON nm_match_livestreams FOR SELECT USING (true);

DROP POLICY IF EXISTS "livestreams_write_auth" ON nm_match_livestreams;
CREATE POLICY "livestreams_write_auth" ON nm_match_livestreams FOR ALL USING (auth.uid() IS NOT NULL);

-- Cola: solo admins
DROP POLICY IF EXISTS "upload_queue_admin" ON nm_youtube_upload_queue;
CREATE POLICY "upload_queue_admin" ON nm_youtube_upload_queue
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM nm_club_members cm
      WHERE cm.user_id = auth.uid()
      AND cm.role IN ('owner', 'admin')
      AND cm.is_active = true
    )
  );

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE nm_match_livestreams;
