-- ─── Migración 017: Live Scoring (marcador en vivo punto a punto) ────────────
-- Permite registrar cada punto de un partido (torneo o liga) con:
-- - Quién metió el punto (player_id)
-- - Equipo del que saca (serving_team)
-- - Tiempo del punto
-- Y reconstruir el marcador en tiempo real

-- ─── Sesiones de partido en vivo ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS nm_live_match_sessions (
  id bigserial PRIMARY KEY,
  match_type text NOT NULL CHECK (match_type IN ('tournament', 'league')),
  match_id bigint NOT NULL,                       -- nm_tournament_matches.id O nm_league_matches.id

  -- Equipos (denormalizado para acceso rápido)
  team1_id bigint,
  team2_id bigint,
  team1_player1_name text,
  team1_player2_name text,
  team2_player1_name text,
  team2_player2_name text,

  -- Estado del partido
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'live', 'paused', 'completed', 'cancelled')),

  -- Reglas del partido
  sets_to_win int DEFAULT 2,                      -- mejor de 3 (gana al ganar 2 sets)
  games_per_set int DEFAULT 6,                    -- 6 juegos por set
  golden_point boolean DEFAULT false,             -- punto de oro en deuce
  tiebreak_at int DEFAULT 6,                      -- tiebreak a 6-6
  super_tiebreak_final boolean DEFAULT false,    -- super tiebreak en lugar de 3er set

  -- Marcador actual
  current_set int DEFAULT 1,                      -- set actual (1, 2, 3)
  current_game_team1 int DEFAULT 0,               -- juegos en el set actual
  current_game_team2 int DEFAULT 0,
  current_point_team1 text DEFAULT '0',           -- '0', '15', '30', '40', 'ADV', 'GAME'
  current_point_team2 text DEFAULT '0',

  -- Sets completados
  sets_team1 int DEFAULT 0,
  sets_team2 int DEFAULT 0,

  -- Saque
  serving_team int DEFAULT 1,                     -- 1 o 2
  serving_player int DEFAULT 1,                   -- 1 o 2 (jugador que saca dentro del equipo)
  serving_side text DEFAULT 'right' CHECK (serving_side IN ('right', 'left')),

  -- Tiebreak en curso
  in_tiebreak boolean DEFAULT false,
  tiebreak_team1 int DEFAULT 0,
  tiebreak_team2 int DEFAULT 0,

  -- Metadata
  started_at timestamptz,
  paused_at timestamptz,
  completed_at timestamptz,
  winner_team int,                                -- 1 o 2
  total_duration_minutes int,

  created_by uuid REFERENCES nm_users(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),

  CONSTRAINT unique_live_match UNIQUE (match_type, match_id)
);

CREATE INDEX IF NOT EXISTS idx_live_match_status ON nm_live_match_sessions(status);
CREATE INDEX IF NOT EXISTS idx_live_match_type_id ON nm_live_match_sessions(match_type, match_id);

-- ─── Puntos individuales del partido ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS nm_live_match_points (
  id bigserial PRIMARY KEY,
  session_id bigint NOT NULL REFERENCES nm_live_match_sessions(id) ON DELETE CASCADE,

  -- Quién hizo el punto
  scoring_team int NOT NULL CHECK (scoring_team IN (1, 2)),
  scoring_player_id uuid REFERENCES nm_users(id),
  scoring_player_name text,                       -- por si no está vinculado a usuario
  scoring_player_number int CHECK (scoring_player_number IN (1, 2)),

  -- Tipo de punto
  point_type text DEFAULT 'normal' CHECK (point_type IN (
    'normal',           -- punto normal
    'ace',              -- ace (saque ganador)
    'winner',           -- winner (golpe ganador)
    'unforced_error',   -- error no forzado del rival
    'forced_error',     -- error forzado
    'double_fault',     -- doble falta del que saca (regala el punto)
    'volley_winner',    -- volea ganadora
    'smash',            -- remate
    'lob_winner',       -- globo ganador
    'fault'             -- error directo
  )),

  -- Contexto del punto
  set_number int NOT NULL,
  game_team1_before int NOT NULL,
  game_team2_before int NOT NULL,
  point_team1_before text NOT NULL,
  point_team2_before text NOT NULL,

  -- Saque al momento del punto
  serving_team int NOT NULL,
  serving_player int,
  serving_side text,

  -- Tiebreak
  is_tiebreak_point boolean DEFAULT false,
  tiebreak_team1_before int,
  tiebreak_team2_before int,

  -- ¿Este punto cerró el game/set/match?
  closed_game boolean DEFAULT false,
  closed_set boolean DEFAULT false,
  closed_match boolean DEFAULT false,

  -- Notas opcionales
  notes text,

  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_live_points_session ON nm_live_match_points(session_id);
CREATE INDEX IF NOT EXISTS idx_live_points_player ON nm_live_match_points(scoring_player_id);
CREATE INDEX IF NOT EXISTS idx_live_points_set ON nm_live_match_points(session_id, set_number);

-- ─── Sets completados (snapshot) ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS nm_live_match_sets (
  id bigserial PRIMARY KEY,
  session_id bigint NOT NULL REFERENCES nm_live_match_sessions(id) ON DELETE CASCADE,
  set_number int NOT NULL,
  games_team1 int NOT NULL,
  games_team2 int NOT NULL,
  tiebreak_team1 int,
  tiebreak_team2 int,
  winner_team int CHECK (winner_team IN (1, 2)),
  duration_minutes int,
  completed_at timestamptz DEFAULT now(),

  CONSTRAINT unique_session_set UNIQUE (session_id, set_number)
);

-- ─── Estadísticas por jugador en el partido ──────────────────────────────────
CREATE OR REPLACE VIEW nm_live_match_player_stats AS
SELECT
  p.session_id,
  p.scoring_player_id,
  p.scoring_player_name,
  p.scoring_team,
  COUNT(*) AS total_points,
  COUNT(*) FILTER (WHERE p.point_type = 'ace') AS aces,
  COUNT(*) FILTER (WHERE p.point_type IN ('winner', 'volley_winner', 'smash', 'lob_winner')) AS winners,
  COUNT(*) FILTER (WHERE p.point_type = 'unforced_error') AS unforced_errors,
  COUNT(*) FILTER (WHERE p.point_type = 'double_fault') AS double_faults,
  COUNT(*) FILTER (WHERE p.closed_game = true) AS games_won_by_player,
  COUNT(*) FILTER (WHERE p.closed_set = true) AS sets_won_by_player
FROM nm_live_match_points p
WHERE p.scoring_player_id IS NOT NULL
GROUP BY p.session_id, p.scoring_player_id, p.scoring_player_name, p.scoring_team;

-- ─── RLS ─────────────────────────────────────────────────────────────────────
ALTER TABLE nm_live_match_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE nm_live_match_points ENABLE ROW LEVEL SECURITY;
ALTER TABLE nm_live_match_sets ENABLE ROW LEVEL SECURITY;

-- Lectura pública (todos pueden ver el marcador en vivo)
DROP POLICY IF EXISTS "live_match_sessions_read_all" ON nm_live_match_sessions;
CREATE POLICY "live_match_sessions_read_all" ON nm_live_match_sessions
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "live_match_points_read_all" ON nm_live_match_points;
CREATE POLICY "live_match_points_read_all" ON nm_live_match_points
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "live_match_sets_read_all" ON nm_live_match_sets;
CREATE POLICY "live_match_sets_read_all" ON nm_live_match_sets
  FOR SELECT USING (true);

-- Escritura solo autenticados (admin/staff/jugadores del partido)
DROP POLICY IF EXISTS "live_match_sessions_write_auth" ON nm_live_match_sessions;
CREATE POLICY "live_match_sessions_write_auth" ON nm_live_match_sessions
  FOR ALL USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "live_match_points_write_auth" ON nm_live_match_points;
CREATE POLICY "live_match_points_write_auth" ON nm_live_match_points
  FOR ALL USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "live_match_sets_write_auth" ON nm_live_match_sets;
CREATE POLICY "live_match_sets_write_auth" ON nm_live_match_sets
  FOR ALL USING (auth.uid() IS NOT NULL);

-- ─── Realtime ────────────────────────────────────────────────────────────────
ALTER PUBLICATION supabase_realtime ADD TABLE nm_live_match_sessions;
ALTER PUBLICATION supabase_realtime ADD TABLE nm_live_match_points;
ALTER PUBLICATION supabase_realtime ADD TABLE nm_live_match_sets;
