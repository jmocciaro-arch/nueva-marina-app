-- =====================================================
-- MIGRACIÓN 011 — Trazabilidad de pricing en gym + recuperación
-- Añade price_rule_id (y price_amount donde falte) para que
-- nm_gym_memberships, nm_gym_sessions y nm_recovery_sessions
-- registren qué regla de nm_price_rules aplicaron.
-- =====================================================

-- ========== GYM MEMBERSHIPS ==========
ALTER TABLE nm_gym_memberships
  ADD COLUMN IF NOT EXISTS price_rule_id bigint REFERENCES nm_price_rules(id) ON DELETE SET NULL;

COMMENT ON COLUMN nm_gym_memberships.price IS 'Importe final cobrado (sinónimo de price_amount)';
COMMENT ON COLUMN nm_gym_memberships.price_rule_id IS 'Regla de nm_price_rules scope=gym_plan aplicada';

CREATE INDEX IF NOT EXISTS idx_gym_memberships_price_rule ON nm_gym_memberships(price_rule_id);

-- ========== GYM SESSIONS (check-in a clases) ==========
ALTER TABLE nm_gym_sessions
  ADD COLUMN IF NOT EXISTS price_amount numeric(8,2),
  ADD COLUMN IF NOT EXISTS price_rule_id bigint REFERENCES nm_price_rules(id) ON DELETE SET NULL;

COMMENT ON COLUMN nm_gym_sessions.price_amount IS 'Importe cobrado por la sesión/clase (null si está incluida en un plan)';
COMMENT ON COLUMN nm_gym_sessions.price_rule_id IS 'Regla de nm_price_rules scope=class aplicada';

CREATE INDEX IF NOT EXISTS idx_gym_sessions_price_rule ON nm_gym_sessions(price_rule_id);

-- ========== RECOVERY SESSIONS ==========
ALTER TABLE nm_recovery_sessions
  ADD COLUMN IF NOT EXISTS price_rule_id bigint REFERENCES nm_price_rules(id) ON DELETE SET NULL;

COMMENT ON COLUMN nm_recovery_sessions.price IS 'Importe final cobrado (sinónimo de price_amount)';
COMMENT ON COLUMN nm_recovery_sessions.price_rule_id IS 'Regla de nm_price_rules scope=recovery_type aplicada';

CREATE INDEX IF NOT EXISTS idx_recovery_sessions_price_rule ON nm_recovery_sessions(price_rule_id);

-- ========== FIN MIGRACIÓN 011 ==========
