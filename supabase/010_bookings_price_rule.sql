-- =====================================================
-- MIGRACIÓN 010 — Trazabilidad de pricing en reservas pádel
-- Vincula cada nm_bookings con la regla aplicada.
-- =====================================================

ALTER TABLE nm_bookings
  ADD COLUMN IF NOT EXISTS price_rule_id bigint REFERENCES nm_price_rules(id) ON DELETE SET NULL;

COMMENT ON COLUMN nm_bookings.price IS 'Importe final cobrado (sinónimo de price_amount)';
COMMENT ON COLUMN nm_bookings.price_rule_id IS 'Regla de nm_price_rules aplicada al calcular el precio';

CREATE INDEX IF NOT EXISTS idx_bookings_price_rule ON nm_bookings(price_rule_id);

-- ========== FIN MIGRACIÓN 010 ==========
