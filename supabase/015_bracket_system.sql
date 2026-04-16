-- ============================================================================
-- 015_bracket_system.sql
-- Sistema de bracket/fixture con timer, propagación automática de ganadores,
-- y soporte para pantalla en vivo (Realtime).
-- ============================================================================

-- Nuevas columnas en nm_tournament_matches para bracket
ALTER TABLE nm_tournament_matches
  ADD COLUMN IF NOT EXISTS next_match_id bigint REFERENCES nm_tournament_matches(id),
  ADD COLUMN IF NOT EXISTS bracket_position int DEFAULT 0,
  ADD COLUMN IF NOT EXISTS round_number int DEFAULT 1,
  ADD COLUMN IF NOT EXISTS slot_in_next int,  -- 1 = team1 del siguiente, 2 = team2
  ADD COLUMN IF NOT EXISTS started_at timestamptz,
  ADD COLUMN IF NOT EXISTS finished_at timestamptz,
  ADD COLUMN IF NOT EXISTS duration_seconds int,
  ADD COLUMN IF NOT EXISTS is_bye boolean DEFAULT false;

-- Índice para acelerar queries de bracket por torneo
CREATE INDEX IF NOT EXISTS idx_nm_tm_bracket
  ON nm_tournament_matches(tournament_id, category, round_number, bracket_position);

-- FK explícita para winner_team_id
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'nm_tournament_matches_winner_fk'
  ) THEN
    ALTER TABLE nm_tournament_matches
      ADD CONSTRAINT nm_tournament_matches_winner_fk
      FOREIGN KEY (winner_team_id) REFERENCES nm_tournament_teams(id);
  END IF;
END $$;

-- ============================================================================
-- Trigger: cuando se setea winner_team_id, propagar al siguiente partido
-- ============================================================================
CREATE OR REPLACE FUNCTION nm_trigger_bracket_propagate()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  v_next_id bigint;
  v_slot int;
BEGIN
  -- Solo actuar cuando se setea un ganador
  IF NEW.winner_team_id IS NULL THEN RETURN NEW; END IF;
  IF OLD.winner_team_id IS NOT NULL AND OLD.winner_team_id = NEW.winner_team_id THEN RETURN NEW; END IF;

  v_next_id := NEW.next_match_id;
  v_slot := NEW.slot_in_next;

  IF v_next_id IS NULL OR v_slot IS NULL THEN RETURN NEW; END IF;

  -- Propagar ganador al slot correspondiente del siguiente partido
  IF v_slot = 1 THEN
    UPDATE nm_tournament_matches SET team1_id = NEW.winner_team_id WHERE id = v_next_id;
  ELSIF v_slot = 2 THEN
    UPDATE nm_tournament_matches SET team2_id = NEW.winner_team_id WHERE id = v_next_id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_nm_bracket_propagate ON nm_tournament_matches;
CREATE TRIGGER tr_nm_bracket_propagate
AFTER UPDATE ON nm_tournament_matches
FOR EACH ROW EXECUTE FUNCTION nm_trigger_bracket_propagate();

-- ============================================================================
-- Trigger: calcular duration_seconds al setear finished_at
-- ============================================================================
CREATE OR REPLACE FUNCTION nm_trigger_match_duration()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.finished_at IS NOT NULL AND NEW.started_at IS NOT NULL THEN
    NEW.duration_seconds := EXTRACT(EPOCH FROM (NEW.finished_at - NEW.started_at))::int;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_nm_match_duration ON nm_tournament_matches;
CREATE TRIGGER tr_nm_match_duration
BEFORE UPDATE ON nm_tournament_matches
FOR EACH ROW EXECUTE FUNCTION nm_trigger_match_duration();

-- ============================================================================
-- Habilitar Realtime para partidos de torneo (pantalla en vivo)
-- ============================================================================
ALTER PUBLICATION supabase_realtime ADD TABLE nm_tournament_matches;

-- RLS: cualquiera puede VER partidos (es público)
CREATE POLICY "public_read_tournament_matches"
  ON nm_tournament_matches FOR SELECT
  TO authenticated, anon
  USING (true);
