-- ============================================================================
-- 020_gym_member_profile.sql
-- Ficha extendida del socio de gimnasio: datos físicos (con historial),
-- objetivos personales, condiciones/problemas y notas del entrenador.
-- ============================================================================

-- ============================================================================
-- 1) DATOS FÍSICOS — con historial (cada medición es una fila)
-- Permite trackear evolución: peso, grasa, masa muscular, medidas
-- ============================================================================
CREATE TABLE IF NOT EXISTS nm_gym_physical_measurements (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  club_id int NOT NULL DEFAULT 1,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  measured_at date NOT NULL DEFAULT CURRENT_DATE,
  measured_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,

  -- Básicos
  height_cm numeric(5,1),
  weight_kg numeric(5,2),
  bmi numeric(4,2) GENERATED ALWAYS AS (
    CASE WHEN height_cm > 0 THEN weight_kg / ((height_cm / 100) * (height_cm / 100)) ELSE NULL END
  ) STORED,

  -- Composición corporal
  body_fat_pct numeric(4,1),
  muscle_mass_kg numeric(5,2),
  visceral_fat int,
  water_pct numeric(4,1),
  bone_mass_kg numeric(5,2),
  metabolic_age int,
  basal_metabolism int,

  -- Medidas corporales (cm)
  chest_cm numeric(5,1),
  waist_cm numeric(5,1),
  hip_cm numeric(5,1),
  arm_left_cm numeric(5,1),
  arm_right_cm numeric(5,1),
  thigh_left_cm numeric(5,1),
  thigh_right_cm numeric(5,1),
  calf_left_cm numeric(5,1),
  calf_right_cm numeric(5,1),

  -- Performance
  resting_heart_rate int,
  blood_pressure_systolic int,
  blood_pressure_diastolic int,
  vo2_max numeric(4,1),

  notes text,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_gym_physical_user ON nm_gym_physical_measurements(user_id, measured_at DESC);

-- ============================================================================
-- 2) OBJETIVOS DEL SOCIO
-- Qué quiere lograr, con plazo y progreso
-- ============================================================================
CREATE TABLE IF NOT EXISTS nm_gym_goals (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  club_id int NOT NULL DEFAULT 1,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  goal_type text NOT NULL,              -- 'weight_loss' | 'muscle_gain' | 'endurance' | 'strength' | 'flexibility' | 'rehabilitation' | 'other'
  title text NOT NULL,                  -- texto libre del objetivo
  description text,

  target_value numeric(10,2),           -- ej: 75 (kg objetivo)
  target_unit text,                     -- 'kg', 'cm', 'reps', 'min', etc.
  current_value numeric(10,2),
  start_value numeric(10,2),

  priority text DEFAULT 'medium',       -- 'high' | 'medium' | 'low'
  status text DEFAULT 'active',         -- 'active' | 'achieved' | 'paused' | 'abandoned'

  start_date date DEFAULT CURRENT_DATE,
  target_date date,
  achieved_at timestamptz,

  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_gym_goals_user ON nm_gym_goals(user_id, status);

-- ============================================================================
-- 3) CONDICIONES / PROBLEMAS DE SALUD
-- Lesiones, limitaciones, patologías, alergias relevantes para el entrenamiento
-- ============================================================================
CREATE TABLE IF NOT EXISTS nm_gym_health_conditions (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  club_id int NOT NULL DEFAULT 1,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  condition_type text NOT NULL,         -- 'injury' | 'chronic' | 'allergy' | 'limitation' | 'surgery' | 'other'
  title text NOT NULL,                  -- ej: "Hernia de disco L4-L5"
  description text,

  severity text,                        -- 'mild' | 'moderate' | 'severe'
  affected_area text,                   -- 'lower_back', 'knee_right', 'shoulder', etc.

  started_at date,
  resolved_at date,                     -- NULL si sigue activa
  is_active boolean DEFAULT true,

  medical_document_url text,            -- parte médico si lo hay
  restrictions text,                    -- ejercicios a evitar
  recommendations text,                 -- qué SÍ hacer

  reported_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_gym_health_user ON nm_gym_health_conditions(user_id, is_active);

-- ============================================================================
-- 4) NOTAS DEL ENTRENADOR
-- Observaciones, recomendaciones, seguimiento entre sesiones
-- ============================================================================
CREATE TABLE IF NOT EXISTS nm_gym_coach_notes (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  club_id int NOT NULL DEFAULT 1,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  coach_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  category text DEFAULT 'general',      -- 'general' | 'technique' | 'progress' | 'behavior' | 'recommendation' | 'warning'
  title text,
  content text NOT NULL,

  is_private boolean DEFAULT false,     -- true = solo visible para coaches/admin, no para el socio
  is_pinned boolean DEFAULT false,      -- notas importantes arriba

  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_gym_notes_user ON nm_gym_coach_notes(user_id, created_at DESC);

-- ============================================================================
-- 5) TRIGGERS de updated_at
-- ============================================================================
CREATE OR REPLACE FUNCTION nm_gym_set_updated_at()
RETURNS trigger AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_gym_goals_updated ON nm_gym_goals;
CREATE TRIGGER trg_gym_goals_updated BEFORE UPDATE ON nm_gym_goals
  FOR EACH ROW EXECUTE FUNCTION nm_gym_set_updated_at();

DROP TRIGGER IF EXISTS trg_gym_health_updated ON nm_gym_health_conditions;
CREATE TRIGGER trg_gym_health_updated BEFORE UPDATE ON nm_gym_health_conditions
  FOR EACH ROW EXECUTE FUNCTION nm_gym_set_updated_at();

DROP TRIGGER IF EXISTS trg_gym_notes_updated ON nm_gym_coach_notes;
CREATE TRIGGER trg_gym_notes_updated BEFORE UPDATE ON nm_gym_coach_notes
  FOR EACH ROW EXECUTE FUNCTION nm_gym_set_updated_at();

-- ============================================================================
-- 6) RLS — el socio ve lo suyo (salvo notas privadas), admin/coach ven todo
-- ============================================================================
ALTER TABLE nm_gym_physical_measurements ENABLE ROW LEVEL SECURITY;
ALTER TABLE nm_gym_goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE nm_gym_health_conditions ENABLE ROW LEVEL SECURITY;
ALTER TABLE nm_gym_coach_notes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS gym_physical_select ON nm_gym_physical_measurements;
CREATE POLICY gym_physical_select ON nm_gym_physical_measurements
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR nm_is_admin());

DROP POLICY IF EXISTS gym_physical_write ON nm_gym_physical_measurements;
CREATE POLICY gym_physical_write ON nm_gym_physical_measurements
  FOR ALL TO authenticated
  USING (nm_is_admin()) WITH CHECK (nm_is_admin());

DROP POLICY IF EXISTS gym_goals_select ON nm_gym_goals;
CREATE POLICY gym_goals_select ON nm_gym_goals
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR nm_is_admin());

DROP POLICY IF EXISTS gym_goals_write ON nm_gym_goals;
CREATE POLICY gym_goals_write ON nm_gym_goals
  FOR ALL TO authenticated
  USING (user_id = auth.uid() OR nm_is_admin())
  WITH CHECK (user_id = auth.uid() OR nm_is_admin());

DROP POLICY IF EXISTS gym_health_select ON nm_gym_health_conditions;
CREATE POLICY gym_health_select ON nm_gym_health_conditions
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR nm_is_admin());

DROP POLICY IF EXISTS gym_health_write ON nm_gym_health_conditions;
CREATE POLICY gym_health_write ON nm_gym_health_conditions
  FOR ALL TO authenticated
  USING (nm_is_admin()) WITH CHECK (nm_is_admin());

DROP POLICY IF EXISTS gym_notes_select ON nm_gym_coach_notes;
CREATE POLICY gym_notes_select ON nm_gym_coach_notes
  FOR SELECT TO authenticated
  USING (
    (user_id = auth.uid() AND is_private = false)
    OR nm_is_admin()
  );

DROP POLICY IF EXISTS gym_notes_write ON nm_gym_coach_notes;
CREATE POLICY gym_notes_write ON nm_gym_coach_notes
  FOR ALL TO authenticated
  USING (nm_is_admin()) WITH CHECK (nm_is_admin());
