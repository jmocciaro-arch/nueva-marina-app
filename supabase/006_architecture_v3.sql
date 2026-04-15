-- =====================================================
-- MIGRACIÓN 006 — Arquitectura v3
-- Módulos on/off · Roles granulares · Pricing unificado
-- Turnos de caja · Categorías tienda · Integraciones
-- Heartbeat accesos · Vistas materializadas
-- =====================================================

-- ========== 1) MÓDULOS POR CLUB (on/off) ==========

CREATE TABLE IF NOT EXISTS nm_club_modules (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  club_id bigint NOT NULL REFERENCES nm_clubs(id) ON DELETE CASCADE,
  module_key text NOT NULL,             -- 'padel', 'gym', 'recovery', 'shop', 'access', 'tournaments', 'leagues', 'ranking', 'innovation', 'cash', 'reports'
  is_enabled boolean DEFAULT true,
  config jsonb DEFAULT '{}'::jsonb,
  updated_at timestamptz DEFAULT now(),
  UNIQUE(club_id, module_key)
);

COMMENT ON TABLE nm_club_modules IS 'Toggle de módulos habilitados por club (oculta tabs/rutas en UI)';

ALTER TABLE nm_club_modules ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "modules_read" ON nm_club_modules;
CREATE POLICY "modules_read" ON nm_club_modules FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "modules_admin_all" ON nm_club_modules;
CREATE POLICY "modules_admin_all" ON nm_club_modules FOR ALL TO authenticated
  USING (nm_is_admin()) WITH CHECK (nm_is_admin());

-- ========== 2) ROLE_PERMISSIONS (granular) ==========

CREATE TABLE IF NOT EXISTS nm_role_permissions (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  role_id bigint NOT NULL REFERENCES nm_roles(id) ON DELETE CASCADE,
  permission_key text NOT NULL REFERENCES nm_permissions(key) ON DELETE CASCADE,
  UNIQUE(role_id, permission_key)
);

COMMENT ON TABLE nm_role_permissions IS 'Permisos asignados a cada rol (matriz granular)';

ALTER TABLE nm_role_permissions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "role_perms_read" ON nm_role_permissions;
CREATE POLICY "role_perms_read" ON nm_role_permissions FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "role_perms_admin" ON nm_role_permissions;
CREATE POLICY "role_perms_admin" ON nm_role_permissions FOR ALL TO authenticated
  USING (nm_is_admin()) WITH CHECK (nm_is_admin());

-- Función helper: chequear permiso del usuario actual
CREATE OR REPLACE FUNCTION nm_has_permission(p_key text)
RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1
    FROM nm_club_members cm
    JOIN nm_roles r ON r.slug = cm.role AND (r.club_id = cm.club_id OR r.is_system)
    JOIN nm_role_permissions rp ON rp.role_id = r.id
    WHERE cm.user_id = auth.uid()
      AND cm.is_active = true
      AND rp.permission_key = p_key
  );
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- ========== 3) TURNOS DE CAJA ==========

CREATE TABLE IF NOT EXISTS nm_cash_shifts (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  club_id bigint NOT NULL REFERENCES nm_clubs(id) ON DELETE CASCADE,
  opened_by uuid REFERENCES nm_users(id),
  closed_by uuid REFERENCES nm_users(id),
  opened_at timestamptz NOT NULL DEFAULT now(),
  closed_at timestamptz,
  opening_cash numeric(10,2) NOT NULL DEFAULT 0,
  closing_cash numeric(10,2),
  expected_cash numeric(10,2),           -- calculado: opening + movimientos efectivo
  difference numeric(10,2),              -- closing - expected
  notes text,
  status text DEFAULT 'open' CHECK (status IN ('open','closed','reconciled')),
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cash_shifts_club_status ON nm_cash_shifts(club_id, status);
CREATE INDEX IF NOT EXISTS idx_cash_shifts_opened_at ON nm_cash_shifts(opened_at DESC);

ALTER TABLE nm_cash_shifts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "shifts_admin_all" ON nm_cash_shifts;
CREATE POLICY "shifts_admin_all" ON nm_cash_shifts FOR ALL TO authenticated
  USING (nm_is_admin()) WITH CHECK (nm_is_admin());

-- Vincular movimientos de caja al turno
ALTER TABLE nm_cash_register
  ADD COLUMN IF NOT EXISTS shift_id bigint REFERENCES nm_cash_shifts(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_cash_register_shift ON nm_cash_register(shift_id);

-- ========== 4) CATEGORÍAS DE PRODUCTO (multi-nivel) ==========

CREATE TABLE IF NOT EXISTS nm_product_categories (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  club_id bigint NOT NULL REFERENCES nm_clubs(id) ON DELETE CASCADE,
  parent_id bigint REFERENCES nm_product_categories(id) ON DELETE SET NULL,
  name text NOT NULL,
  slug text NOT NULL,
  scope text NOT NULL DEFAULT 'shop' CHECK (scope IN ('shop','bar','gym','padel','recovery')),
  icon text,
  sort_order int DEFAULT 0,
  is_active boolean DEFAULT true,
  UNIQUE(club_id, scope, slug)
);

CREATE INDEX IF NOT EXISTS idx_prod_cat_scope ON nm_product_categories(club_id, scope);

ALTER TABLE nm_product_categories ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "prod_cat_read" ON nm_product_categories;
CREATE POLICY "prod_cat_read" ON nm_product_categories FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "prod_cat_admin" ON nm_product_categories;
CREATE POLICY "prod_cat_admin" ON nm_product_categories FOR ALL TO authenticated
  USING (nm_is_admin()) WITH CHECK (nm_is_admin());

-- Vincular productos a categoría y ampliar scope del catálogo
ALTER TABLE nm_products
  ADD COLUMN IF NOT EXISTS category_id bigint REFERENCES nm_product_categories(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS scope text DEFAULT 'shop' CHECK (scope IN ('shop','bar','gym','padel','recovery'));

CREATE INDEX IF NOT EXISTS idx_products_category ON nm_products(category_id);
CREATE INDEX IF NOT EXISTS idx_products_scope ON nm_products(club_id, scope);

-- ========== 5) PRICING UNIFICADO (polimórfico) ==========

CREATE TABLE IF NOT EXISTS nm_price_rules (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  club_id bigint NOT NULL REFERENCES nm_clubs(id) ON DELETE CASCADE,
  scope text NOT NULL CHECK (scope IN (
    'court_hour',      -- precio pista × duración × franja
    'gym_class',       -- precio clase gym
    'gym_membership',  -- abono gym
    'recovery',        -- sesión recuperación
    'tournament',      -- inscripción torneo
    'league',          -- inscripción liga
    'product',         -- override de precio de producto
    'access_passcode', -- pase puntual
    'season'           -- abonos temporada
  )),
  scope_ref_id bigint,                   -- id del recurso concreto (court_id, class_id, product_id...)
  name text NOT NULL,
  amount numeric(10,2) NOT NULL,
  currency text DEFAULT 'EUR',
  duration_minutes int,                  -- para court_hour / recovery
  time_start time,                       -- franja horaria "desde"
  time_end time,                         -- franja horaria "hasta"
  day_of_week int[],                     -- {1..7} (1=lunes) NULL = todos
  valid_from date,
  valid_to date,
  member_only boolean DEFAULT false,
  role_slug text,                        -- descuento por rol ('player', 'coach', etc.)
  priority int DEFAULT 0,                -- mayor prioridad gana
  is_active boolean DEFAULT true,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_price_rules_scope ON nm_price_rules(club_id, scope, scope_ref_id) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_price_rules_validity ON nm_price_rules(valid_from, valid_to);

ALTER TABLE nm_price_rules ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "price_rules_read" ON nm_price_rules;
CREATE POLICY "price_rules_read" ON nm_price_rules FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "price_rules_admin" ON nm_price_rules;
CREATE POLICY "price_rules_admin" ON nm_price_rules FOR ALL TO authenticated
  USING (nm_is_admin()) WITH CHECK (nm_is_admin());

-- Función de lookup: devuelve la regla ganadora (mayor prioridad + más específica)
CREATE OR REPLACE FUNCTION nm_lookup_price(
  p_club_id bigint,
  p_scope text,
  p_scope_ref_id bigint,
  p_at timestamptz DEFAULT now(),
  p_duration_minutes int DEFAULT NULL,
  p_role_slug text DEFAULT NULL
) RETURNS TABLE (
  rule_id bigint,
  amount numeric,
  currency text,
  name text
) AS $$
  SELECT id, amount, currency, name
  FROM nm_price_rules
  WHERE club_id = p_club_id
    AND scope = p_scope
    AND is_active = true
    AND (scope_ref_id = p_scope_ref_id OR scope_ref_id IS NULL)
    AND (valid_from IS NULL OR valid_from <= p_at::date)
    AND (valid_to IS NULL OR valid_to >= p_at::date)
    AND (day_of_week IS NULL OR EXTRACT(ISODOW FROM p_at)::int = ANY(day_of_week))
    AND (time_start IS NULL OR time_start <= p_at::time)
    AND (time_end IS NULL OR time_end >= p_at::time)
    AND (duration_minutes IS NULL OR p_duration_minutes IS NULL OR duration_minutes = p_duration_minutes)
    AND (role_slug IS NULL OR p_role_slug IS NULL OR role_slug = p_role_slug)
  ORDER BY
    priority DESC,
    (scope_ref_id IS NOT NULL) DESC,
    (time_start IS NOT NULL) DESC,
    (day_of_week IS NOT NULL) DESC
  LIMIT 1;
$$ LANGUAGE sql STABLE;

COMMENT ON FUNCTION nm_lookup_price IS 'Busca la regla de precio aplicable. Ranking: priority DESC, más específico gana.';

-- ========== 6) INTEGRACIONES EXTERNAS ==========

CREATE TABLE IF NOT EXISTS nm_integrations (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  club_id bigint NOT NULL REFERENCES nm_clubs(id) ON DELETE CASCADE,
  provider text NOT NULL,               -- 'stripe','whatsapp','twilio','mailgun','virtuagym','facephi'
  is_enabled boolean DEFAULT false,
  credentials jsonb DEFAULT '{}'::jsonb,-- encriptar en app layer
  config jsonb DEFAULT '{}'::jsonb,
  last_sync_at timestamptz,
  last_error text,
  created_at timestamptz DEFAULT now(),
  UNIQUE(club_id, provider)
);

ALTER TABLE nm_integrations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "integrations_admin_all" ON nm_integrations;
CREATE POLICY "integrations_admin_all" ON nm_integrations FOR ALL TO authenticated
  USING (nm_is_admin()) WITH CHECK (nm_is_admin());

-- ========== 7) HEARTBEAT DE ACCESOS ==========

ALTER TABLE nm_access_points
  ADD COLUMN IF NOT EXISTS last_heartbeat_at timestamptz,
  ADD COLUMN IF NOT EXISTS status text DEFAULT 'unknown' CHECK (status IN ('online','offline','error','unknown')),
  ADD COLUMN IF NOT EXISTS firmware_version text,
  ADD COLUMN IF NOT EXISTS last_error text;

CREATE INDEX IF NOT EXISTS idx_access_points_status ON nm_access_points(status);

-- Función: marcar offline los puntos sin heartbeat >90s (se llama desde cron o edge)
CREATE OR REPLACE FUNCTION nm_mark_stale_access_points()
RETURNS int AS $$
  WITH updated AS (
    UPDATE nm_access_points
    SET status = 'offline'
    WHERE status = 'online'
      AND (last_heartbeat_at IS NULL OR last_heartbeat_at < now() - interval '90 seconds')
    RETURNING 1
  )
  SELECT COUNT(*)::int FROM updated;
$$ LANGUAGE sql;

-- ========== 8) VISTAS MATERIALIZADAS (reportes) ==========

-- 8.1) Ingresos diarios por scope
DROP MATERIALIZED VIEW IF EXISTS nm_mv_daily_revenue;
CREATE MATERIALIZED VIEW nm_mv_daily_revenue AS
SELECT
  club_id,
  date,
  COALESCE(reference_type, 'manual') AS source,
  COUNT(*) AS movements,
  SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END) AS income,
  SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END) AS expense,
  SUM(CASE WHEN type = 'income' THEN amount ELSE -amount END) AS net
FROM nm_cash_register
GROUP BY club_id, date, reference_type;

CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_daily_revenue ON nm_mv_daily_revenue(club_id, date, source);

-- 8.2) Uso por módulo (última 90 días)
DROP MATERIALIZED VIEW IF EXISTS nm_mv_module_usage;
CREATE MATERIALIZED VIEW nm_mv_module_usage AS
SELECT club_id, 'padel'::text AS module, date_trunc('day', created_at)::date AS day, COUNT(*) AS events
  FROM nm_bookings WHERE created_at >= now() - interval '90 days' GROUP BY club_id, day
UNION ALL
SELECT club_id, 'gym', date_trunc('day', created_at)::date, COUNT(*)
  FROM nm_gym_sessions WHERE created_at >= now() - interval '90 days' GROUP BY club_id, date_trunc('day', created_at)::date
UNION ALL
SELECT club_id, 'recovery', date_trunc('day', created_at)::date, COUNT(*)
  FROM nm_recovery_sessions WHERE created_at >= now() - interval '90 days' GROUP BY club_id, date_trunc('day', created_at)::date
UNION ALL
SELECT club_id, 'shop', date_trunc('day', created_at)::date, COUNT(*)
  FROM nm_orders WHERE created_at >= now() - interval '90 days' GROUP BY club_id, date_trunc('day', created_at)::date
UNION ALL
SELECT club_id, 'access', date_trunc('day', timestamp)::date, COUNT(*)
  FROM nm_access_logs WHERE timestamp >= now() - interval '90 days' GROUP BY club_id, date_trunc('day', timestamp)::date;

CREATE INDEX IF NOT EXISTS idx_mv_module_usage ON nm_mv_module_usage(club_id, module, day);

-- 8.3) Actividad de accesos (horas pico, granted vs denied)
DROP MATERIALIZED VIEW IF EXISTS nm_mv_access_activity;
CREATE MATERIALIZED VIEW nm_mv_access_activity AS
SELECT
  club_id,
  date_trunc('hour', timestamp)::timestamptz AS hour,
  access_point_id,
  credential_type,
  COUNT(*) FILTER (WHERE granted = true)  AS granted_count,
  COUNT(*) FILTER (WHERE granted = false) AS denied_count
FROM nm_access_logs
WHERE timestamp >= now() - interval '30 days'
GROUP BY club_id, hour, access_point_id, credential_type;

CREATE INDEX IF NOT EXISTS idx_mv_access_activity ON nm_mv_access_activity(club_id, hour);

-- Helper para refrescar todas las MVs
CREATE OR REPLACE FUNCTION nm_refresh_reports()
RETURNS void AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY nm_mv_daily_revenue;
  REFRESH MATERIALIZED VIEW nm_mv_module_usage;
  REFRESH MATERIALIZED VIEW nm_mv_access_activity;
END;
$$ LANGUAGE plpgsql;

-- ========== 9) SEED DE MÓDULOS POR DEFECTO ==========

INSERT INTO nm_club_modules (club_id, module_key, is_enabled)
SELECT c.id, m.key, true
FROM nm_clubs c
CROSS JOIN (VALUES
  ('padel'),('gym'),('recovery'),('shop'),('access'),
  ('tournaments'),('leagues'),('ranking'),('innovation'),
  ('cash'),('reports'),('training'),('community')
) AS m(key)
ON CONFLICT (club_id, module_key) DO NOTHING;

-- ========== FIN MIGRACIÓN 006 ==========
