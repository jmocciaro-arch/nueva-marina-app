-- =============================================
-- NUEVA MARINA — Sistema de Precios Configurable
-- =============================================

-- Tabla principal de reglas de precios
CREATE TABLE IF NOT EXISTS nm_pricing_rules (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  club_id bigint REFERENCES nm_clubs(id) ON DELETE CASCADE,
  name text NOT NULL,
  duration_minutes int NOT NULL,
  base_price numeric(8,2) NOT NULL,
  lighting_surcharge numeric(8,2) DEFAULT 0,
  booking_type text NOT NULL DEFAULT 'normal',
  -- booking_type: normal, abono, liga, torneo, clase, evento
  discount_pct numeric(5,2) DEFAULT 0,
  -- Si discount_pct > 0, se aplica sobre base_price
  fixed_price numeric(8,2),
  -- Si fixed_price es NOT NULL, ignora base_price y discount
  peak_surcharge numeric(8,2) DEFAULT 0,
  -- Recargo adicional en horario pico
  is_active boolean DEFAULT true,
  priority int DEFAULT 0,
  -- Mayor priority = se aplica primero (más específico gana)
  notes text,
  created_at timestamptz DEFAULT now()
);

-- Config general del club (horario pico, recargos globales)
CREATE TABLE IF NOT EXISTS nm_pricing_config (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  club_id bigint REFERENCES nm_clubs(id) ON DELETE CASCADE UNIQUE,
  peak_start time DEFAULT '17:00',
  peak_end time DEFAULT '21:00',
  peak_days int[] DEFAULT '{1,2,3,4,5}',
  -- 1=Lun..0=Dom — días en los que aplica horario pico
  weekend_surcharge numeric(8,2) DEFAULT 0,
  holiday_surcharge numeric(8,2) DEFAULT 0,
  min_advance_hours int DEFAULT 2,
  -- Mínimo de horas de antelación para reservar
  max_advance_days int DEFAULT 14,
  -- Máximo de días de antelación
  cancellation_hours int DEFAULT 12,
  -- Horas antes para cancelar sin penalización
  notes text,
  updated_at timestamptz DEFAULT now()
);

-- RLS
ALTER TABLE nm_pricing_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE nm_pricing_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "public_read" ON nm_pricing_rules;
DROP POLICY IF EXISTS "admin_all" ON nm_pricing_rules;
DROP POLICY IF EXISTS "public_read" ON nm_pricing_config;
DROP POLICY IF EXISTS "admin_all" ON nm_pricing_config;

CREATE POLICY "public_read" ON nm_pricing_rules FOR SELECT TO authenticated USING (true);
CREATE POLICY "admin_all" ON nm_pricing_rules FOR ALL TO authenticated USING (nm_is_admin()) WITH CHECK (nm_is_admin());
CREATE POLICY "public_read" ON nm_pricing_config FOR SELECT TO authenticated USING (true);
CREATE POLICY "admin_all" ON nm_pricing_config FOR ALL TO authenticated USING (nm_is_admin()) WITH CHECK (nm_is_admin());

-- Insertar config inicial del club
INSERT INTO nm_pricing_config (club_id, peak_start, peak_end, peak_days)
VALUES (1, '17:00', '21:00', '{1,2,3,4,5}')
ON CONFLICT (club_id) DO NOTHING;

-- Insertar las reglas de precio que indicó el usuario
-- Normal
INSERT INTO nm_pricing_rules (club_id, name, duration_minutes, base_price, lighting_surcharge, booking_type, priority)
VALUES
  (1, '1 hora', 60, 12.00, 4.00, 'normal', 0),
  (1, '1 hora y media', 90, 18.00, 4.00, 'normal', 0),
  (1, '2 horas', 120, 22.00, 4.00, 'normal', 0);
