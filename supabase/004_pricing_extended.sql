-- =============================================
-- NUEVA MARINA — Sistema de Precios Extendido
-- Franjas horarias, precios por pista, bonos, temporadas, descuentos grupo
-- =============================================

-- 1. Franjas horarias (mañana/tarde/noche con precio distinto)
CREATE TABLE IF NOT EXISTS nm_pricing_time_slots (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  club_id bigint REFERENCES nm_clubs(id) ON DELETE CASCADE,
  name text NOT NULL,               -- 'Mañana', 'Tarde', 'Noche'
  start_time time NOT NULL,
  end_time time NOT NULL,
  price_multiplier numeric(4,2) DEFAULT 1.00,
  -- 1.00 = sin cambio, 1.20 = +20%, 0.80 = -20%
  is_active boolean DEFAULT true,
  sort_order int DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- 2. Precios específicos por pista (override global)
CREATE TABLE IF NOT EXISTS nm_court_pricing (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  club_id bigint REFERENCES nm_clubs(id) ON DELETE CASCADE,
  court_id bigint REFERENCES nm_courts(id) ON DELETE CASCADE,
  pricing_rule_id bigint REFERENCES nm_pricing_rules(id) ON DELETE CASCADE,
  override_price numeric(8,2),
  -- Si override_price != null, usa este en lugar del precio de la regla
  override_lighting numeric(8,2),
  is_active boolean DEFAULT true,
  UNIQUE(court_id, pricing_rule_id)
);

-- 3. Bonos / Paquetes de horas
CREATE TABLE IF NOT EXISTS nm_pricing_packs (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  club_id bigint REFERENCES nm_clubs(id) ON DELETE CASCADE,
  name text NOT NULL,                -- 'Bono 10 horas', 'Pack mensual'
  description text,
  pack_type text DEFAULT 'hours',    -- 'hours', 'sessions', 'credits'
  total_units int NOT NULL,          -- 10 horas, 20 sesiones, etc.
  price numeric(8,2) NOT NULL,       -- precio total del bono
  unit_price numeric(8,2) GENERATED ALWAYS AS (price / NULLIF(total_units, 0)) STORED,
  valid_days int DEFAULT 90,         -- días de validez desde compra
  applicable_durations int[],        -- duraciones aplicables: {60, 90, 120}
  applicable_booking_types text[],   -- tipos: {'normal', 'abono'}
  max_per_user int DEFAULT 1,        -- máximo bonos activos por usuario
  is_active boolean DEFAULT true,
  sort_order int DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- 4. Temporadas (verano/invierno con multiplicador)
CREATE TABLE IF NOT EXISTS nm_pricing_seasons (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  club_id bigint REFERENCES nm_clubs(id) ON DELETE CASCADE,
  name text NOT NULL,                -- 'Verano', 'Invierno', 'Navidad'
  start_date date NOT NULL,
  end_date date NOT NULL,
  price_multiplier numeric(4,2) DEFAULT 1.00,
  lighting_override numeric(8,2),    -- si no es null, usa este recargo luz
  is_active boolean DEFAULT true,
  color text DEFAULT '#06b6d4',
  notes text,
  created_at timestamptz DEFAULT now()
);

-- 5. Descuentos por grupo/tipo de socio
CREATE TABLE IF NOT EXISTS nm_pricing_discounts (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  club_id bigint REFERENCES nm_clubs(id) ON DELETE CASCADE,
  name text NOT NULL,                -- 'Socio Club', 'Estudiante', 'Familia', 'Senior'
  discount_type text DEFAULT 'percentage', -- 'percentage', 'fixed_amount', 'fixed_price'
  discount_value numeric(8,2) NOT NULL,    -- 15 (=15%), 3 (=3€ menos), 10 (=10€ fijo)
  applicable_booking_types text[],         -- {'normal','abono'}
  applicable_durations int[],              -- {60, 90, 120}
  min_bookings_per_month int DEFAULT 0,    -- mínimo reservas/mes para aplicar
  requires_membership boolean DEFAULT false,
  is_stackable boolean DEFAULT false,      -- se puede combinar con otros descuentos?
  is_active boolean DEFAULT true,
  sort_order int DEFAULT 0,
  valid_from date,
  valid_until date,
  notes text,
  created_at timestamptz DEFAULT now()
);

-- Agregar columnas nuevas a nm_pricing_rules
ALTER TABLE nm_pricing_rules ADD COLUMN IF NOT EXISTS time_slot_id bigint REFERENCES nm_pricing_time_slots(id) ON DELETE SET NULL;
ALTER TABLE nm_pricing_rules ADD COLUMN IF NOT EXISTS court_group text;
-- court_group: null = todas, 'indoor', 'outdoor', 'premium' — para agrupar pistas
ALTER TABLE nm_pricing_rules ADD COLUMN IF NOT EXISTS min_players int DEFAULT 0;
ALTER TABLE nm_pricing_rules ADD COLUMN IF NOT EXISTS max_daily_uses int DEFAULT 0;
-- max_daily_uses: 0 = ilimitado, >0 = máximo por usuario por día con esta tarifa
ALTER TABLE nm_pricing_rules ADD COLUMN IF NOT EXISTS valid_from date;
ALTER TABLE nm_pricing_rules ADD COLUMN IF NOT EXISTS valid_until date;

-- Agregar columnas a nm_pricing_config
ALTER TABLE nm_pricing_config ADD COLUMN IF NOT EXISTS morning_start time DEFAULT '08:00';
ALTER TABLE nm_pricing_config ADD COLUMN IF NOT EXISTS morning_end time DEFAULT '13:00';
ALTER TABLE nm_pricing_config ADD COLUMN IF NOT EXISTS afternoon_start time DEFAULT '13:00';
ALTER TABLE nm_pricing_config ADD COLUMN IF NOT EXISTS afternoon_end time DEFAULT '17:00';
ALTER TABLE nm_pricing_config ADD COLUMN IF NOT EXISTS evening_start time DEFAULT '17:00';
ALTER TABLE nm_pricing_config ADD COLUMN IF NOT EXISTS evening_end time DEFAULT '23:00';
ALTER TABLE nm_pricing_config ADD COLUMN IF NOT EXISTS auto_lighting_time time DEFAULT '20:00';
-- hora a partir de la cual se cobra luz automáticamente
ALTER TABLE nm_pricing_config ADD COLUMN IF NOT EXISTS allow_custom_duration boolean DEFAULT false;
ALTER TABLE nm_pricing_config ADD COLUMN IF NOT EXISTS custom_duration_price_per_min numeric(6,2) DEFAULT 0.20;
ALTER TABLE nm_pricing_config ADD COLUMN IF NOT EXISTS iva_pct numeric(4,2) DEFAULT 21.00;
ALTER TABLE nm_pricing_config ADD COLUMN IF NOT EXISTS show_prices_with_iva boolean DEFAULT true;

-- RLS
ALTER TABLE nm_pricing_time_slots ENABLE ROW LEVEL SECURITY;
ALTER TABLE nm_court_pricing ENABLE ROW LEVEL SECURITY;
ALTER TABLE nm_pricing_packs ENABLE ROW LEVEL SECURITY;
ALTER TABLE nm_pricing_seasons ENABLE ROW LEVEL SECURITY;
ALTER TABLE nm_pricing_discounts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "public_read" ON nm_pricing_time_slots;
DROP POLICY IF EXISTS "admin_all" ON nm_pricing_time_slots;
DROP POLICY IF EXISTS "public_read" ON nm_court_pricing;
DROP POLICY IF EXISTS "admin_all" ON nm_court_pricing;
DROP POLICY IF EXISTS "public_read" ON nm_pricing_packs;
DROP POLICY IF EXISTS "admin_all" ON nm_pricing_packs;
DROP POLICY IF EXISTS "public_read" ON nm_pricing_seasons;
DROP POLICY IF EXISTS "admin_all" ON nm_pricing_seasons;
DROP POLICY IF EXISTS "public_read" ON nm_pricing_discounts;
DROP POLICY IF EXISTS "admin_all" ON nm_pricing_discounts;

CREATE POLICY "public_read" ON nm_pricing_time_slots FOR SELECT TO authenticated USING (true);
CREATE POLICY "admin_all" ON nm_pricing_time_slots FOR ALL TO authenticated USING (nm_is_admin()) WITH CHECK (nm_is_admin());
CREATE POLICY "public_read" ON nm_court_pricing FOR SELECT TO authenticated USING (true);
CREATE POLICY "admin_all" ON nm_court_pricing FOR ALL TO authenticated USING (nm_is_admin()) WITH CHECK (nm_is_admin());
CREATE POLICY "public_read" ON nm_pricing_packs FOR SELECT TO authenticated USING (true);
CREATE POLICY "admin_all" ON nm_pricing_packs FOR ALL TO authenticated USING (nm_is_admin()) WITH CHECK (nm_is_admin());
CREATE POLICY "public_read" ON nm_pricing_seasons FOR SELECT TO authenticated USING (true);
CREATE POLICY "admin_all" ON nm_pricing_seasons FOR ALL TO authenticated USING (nm_is_admin()) WITH CHECK (nm_is_admin());
CREATE POLICY "public_read" ON nm_pricing_discounts FOR SELECT TO authenticated USING (true);
CREATE POLICY "admin_all" ON nm_pricing_discounts FOR ALL TO authenticated USING (nm_is_admin()) WITH CHECK (nm_is_admin());

-- Datos iniciales: franjas horarias
INSERT INTO nm_pricing_time_slots (club_id, name, start_time, end_time, price_multiplier, sort_order) VALUES
  (1, 'Mañana', '08:00', '13:00', 0.90, 1),
  (1, 'Tarde', '13:00', '17:00', 1.00, 2),
  (1, 'Noche', '17:00', '23:00', 1.15, 3);

-- Datos iniciales: temporada ejemplo
INSERT INTO nm_pricing_seasons (club_id, name, start_date, end_date, price_multiplier, color) VALUES
  (1, 'Verano', '2026-06-15', '2026-09-15', 1.10, '#f59e0b'),
  (1, 'Invierno', '2026-11-01', '2027-03-01', 0.95, '#3b82f6');

-- Datos iniciales: bonos
INSERT INTO nm_pricing_packs (club_id, name, description, pack_type, total_units, price, valid_days, applicable_durations, applicable_booking_types, sort_order) VALUES
  (1, 'Bono 10 horas', '10 horas de pista a precio reducido', 'hours', 10, 100.00, 90, '{60,90,120}', '{normal,abono}', 1),
  (1, 'Bono 20 horas', '20 horas con máximo descuento', 'hours', 20, 180.00, 180, '{60,90,120}', '{normal,abono}', 2);

-- Datos iniciales: descuentos
INSERT INTO nm_pricing_discounts (club_id, name, discount_type, discount_value, applicable_booking_types, sort_order) VALUES
  (1, 'Socio Club', 'percentage', 10, '{normal,abono}', 1),
  (1, 'Estudiante', 'percentage', 15, '{normal}', 2),
  (1, 'Senior +65', 'percentage', 20, '{normal}', 3),
  (1, 'Familia (2+)', 'fixed_amount', 3.00, '{normal}', 4);
