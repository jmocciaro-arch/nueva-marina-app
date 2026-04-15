-- =====================================================
-- MIGRACIÓN 005 — Recuperación + Reglas de negocio + Perfil extendido
-- Basado en JSON Master Spec adaptado al stack Next.js+Supabase
-- =====================================================

-- ========== 1) COLUMNAS NUEVAS EN nm_users ==========

ALTER TABLE nm_users
  ADD COLUMN IF NOT EXISTS dni text,
  ADD COLUMN IF NOT EXISTS current_weight numeric(5,2),
  ADD COLUMN IF NOT EXISTS injuries jsonb DEFAULT '[]'::jsonb;

COMMENT ON COLUMN nm_users.dni IS 'Documento de identidad (NIE/DNI/Pasaporte)';
COMMENT ON COLUMN nm_users.current_weight IS 'Peso actual en kg';
COMMENT ON COLUMN nm_users.injuries IS 'Array de lesiones: [{tipo, fecha, descripcion, activa}]';

-- ========== 2) TABLA NUEVA: nm_recovery_sessions ==========

CREATE TABLE IF NOT EXISTS nm_recovery_sessions (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  club_id bigint REFERENCES nm_clubs(id) ON DELETE CASCADE,
  user_id uuid REFERENCES nm_users(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('crio', 'hidro', 'masaje', 'estiramiento', 'fisio')),
  scheduled_at timestamptz NOT NULL,
  duration_minutes int DEFAULT 30,
  status text DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'completed', 'cancelled', 'no_show')),
  assigned_staff_id uuid REFERENCES nm_users(id),
  price numeric(10,2),
  payment_status text DEFAULT 'pending' CHECK (payment_status IN ('pending', 'paid', 'included')),
  notes text,
  completed_at timestamptz,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_recovery_user ON nm_recovery_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_recovery_scheduled ON nm_recovery_sessions(scheduled_at);
CREATE INDEX IF NOT EXISTS idx_recovery_status ON nm_recovery_sessions(status);

ALTER TABLE nm_recovery_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "recovery_own_read" ON nm_recovery_sessions;
CREATE POLICY "recovery_own_read" ON nm_recovery_sessions
  FOR SELECT USING (user_id = auth.uid() OR nm_is_admin());

DROP POLICY IF EXISTS "recovery_own_insert" ON nm_recovery_sessions;
CREATE POLICY "recovery_own_insert" ON nm_recovery_sessions
  FOR INSERT WITH CHECK (user_id = auth.uid() OR nm_is_admin());

DROP POLICY IF EXISTS "recovery_admin_all" ON nm_recovery_sessions;
CREATE POLICY "recovery_admin_all" ON nm_recovery_sessions
  FOR ALL USING (nm_is_admin());

-- ========== 3) REGLAS DE NEGOCIO EN nm_pricing_config ==========
-- La tabla nm_pricing_config tiene columnas dedicadas (no es key-value).
-- Agregamos max_bookings_per_day y ajustamos cancellation_hours = 4 (JSON spec).

ALTER TABLE nm_pricing_config
  ADD COLUMN IF NOT EXISTS max_bookings_per_day int DEFAULT 2;

COMMENT ON COLUMN nm_pricing_config.max_bookings_per_day IS 'Máximo de reservas confirmadas por usuario por día (JSON spec: 2)';

-- Actualizar cancellation_hours al valor del JSON spec (4h)
UPDATE nm_pricing_config SET cancellation_hours = 4 WHERE cancellation_hours = 12;

-- ========== 4) FUNCIÓN + TRIGGER: MÁX 2 RESERVAS/DÍA ==========

CREATE OR REPLACE FUNCTION nm_check_max_bookings_per_day()
RETURNS TRIGGER AS $$
DECLARE
  max_allowed int;
  current_count int;
BEGIN
  -- Admins bypass
  IF nm_is_admin() THEN
    RETURN NEW;
  END IF;

  -- Obtener el límite configurado (o 2 por defecto)
  SELECT max_bookings_per_day INTO max_allowed
  FROM nm_pricing_config
  WHERE club_id = NEW.club_id
  LIMIT 1;

  IF max_allowed IS NULL THEN
    max_allowed := 2;
  END IF;

  -- Contar reservas confirmadas del usuario ese día
  SELECT COUNT(*) INTO current_count
  FROM nm_bookings
  WHERE user_id = NEW.user_id
    AND booking_date = NEW.booking_date
    AND status IN ('confirmed', 'pending')
    AND id != COALESCE(NEW.id, -1);

  IF current_count >= max_allowed THEN
    RAISE EXCEPTION 'Límite alcanzado: máximo % reservas por día', max_allowed
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_max_bookings_per_day ON nm_bookings;
CREATE TRIGGER trg_max_bookings_per_day
  BEFORE INSERT OR UPDATE ON nm_bookings
  FOR EACH ROW
  WHEN (NEW.status IN ('confirmed', 'pending'))
  EXECUTE FUNCTION nm_check_max_bookings_per_day();

-- ========== 5) FUNCIÓN + TRIGGER: CANCELACIÓN CON HORAS MÍNIMAS ==========

CREATE OR REPLACE FUNCTION nm_check_cancellation_window()
RETURNS TRIGGER AS $$
DECLARE
  hours_required int;
  booking_start timestamptz;
BEGIN
  -- Sólo validar cuando cambia a 'cancelled'
  IF NEW.status != 'cancelled' OR OLD.status = 'cancelled' THEN
    RETURN NEW;
  END IF;

  -- Admins/staff bypass
  IF nm_is_admin() THEN
    RETURN NEW;
  END IF;

  SELECT cancellation_hours INTO hours_required
  FROM nm_pricing_config
  WHERE club_id = NEW.club_id
  LIMIT 1;

  IF hours_required IS NULL THEN
    hours_required := 4;
  END IF;

  -- Calcular momento de inicio de la reserva
  booking_start := (NEW.booking_date::text || ' ' || NEW.start_time::text)::timestamptz;

  IF booking_start - now() < (hours_required || ' hours')::interval THEN
    RAISE EXCEPTION 'Cancelación no permitida: deben faltar al menos % horas', hours_required
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_cancellation_window ON nm_bookings;
CREATE TRIGGER trg_cancellation_window
  BEFORE UPDATE ON nm_bookings
  FOR EACH ROW
  EXECUTE FUNCTION nm_check_cancellation_window();

-- ========== FIN MIGRACIÓN 005 ==========
