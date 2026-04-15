-- =====================================================
-- MIGRACIÓN 009 — Alineación nm_price_rules con /admin/pricing
-- Agrega billing_cycle y conditions, amplía los scopes.
-- =====================================================

-- 1) Nuevas columnas
ALTER TABLE nm_price_rules
  ADD COLUMN IF NOT EXISTS billing_cycle text CHECK (billing_cycle IN ('once','monthly','yearly')),
  ADD COLUMN IF NOT EXISTS conditions jsonb DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

-- 2) Ampliar CHECK de scope (drop + recreate)
ALTER TABLE nm_price_rules DROP CONSTRAINT IF EXISTS nm_price_rules_scope_check;

ALTER TABLE nm_price_rules
  ADD CONSTRAINT nm_price_rules_scope_check CHECK (scope IN (
    'court_hour',       -- pista × duración × franja
    'gym_plan',         -- abono gym
    'recovery_type',    -- sesión recuperación (por tipo)
    'class',            -- clase suelta
    'bar_item',         -- ítem de bar
    'product',          -- override precio producto
    'bonus',            -- bonos / packs de créditos
    'season',           -- abonos de temporada
    'discount',         -- descuentos/promos
    'special_service',  -- servicios puntuales (fisio, análisis, etc.)
    -- backward-compat con 006
    'gym_class','gym_membership','recovery','tournament','league','access_passcode'
  ));

-- 3) Trigger touch para updated_at
CREATE OR REPLACE FUNCTION nm_price_rules_touch()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_price_rules_touch ON nm_price_rules;
CREATE TRIGGER trg_price_rules_touch
  BEFORE UPDATE ON nm_price_rules
  FOR EACH ROW EXECUTE FUNCTION nm_price_rules_touch();

-- 4) Índice útil para vigencia
CREATE INDEX IF NOT EXISTS idx_price_rules_billing ON nm_price_rules(billing_cycle) WHERE billing_cycle IS NOT NULL;

-- ========== FIN MIGRACIÓN 009 ==========
