-- =============================================
-- NUEVA MARINA — Migración Expansión Virtuagym
-- 22 tablas nuevas + 9 columnas en nm_users + RLS
-- Ejecutar en SQL Editor de Supabase
-- =============================================

-- ========== FASE 1: CAMPOS NUEVOS EN USUARIOS ==========

ALTER TABLE nm_users ADD COLUMN IF NOT EXISTS emergency_contact text;
ALTER TABLE nm_users ADD COLUMN IF NOT EXISTS medical_notes text;
ALTER TABLE nm_users ADD COLUMN IF NOT EXISTS document_type text;
ALTER TABLE nm_users ADD COLUMN IF NOT EXISTS document_number text;
ALTER TABLE nm_users ADD COLUMN IF NOT EXISTS address text;
ALTER TABLE nm_users ADD COLUMN IF NOT EXISTS postal_code text;
ALTER TABLE nm_users ADD COLUMN IF NOT EXISTS iban text;
ALTER TABLE nm_users ADD COLUMN IF NOT EXISTS virtuagym_id text;
ALTER TABLE nm_users ADD COLUMN IF NOT EXISTS notes text;

-- ========== FASE 1: VIRTUAGYM SYNC ==========

CREATE TABLE IF NOT EXISTS nm_virtuagym_sync (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  club_id bigint REFERENCES nm_clubs(id) ON DELETE CASCADE,
  entity_type text NOT NULL,
  virtuagym_id text NOT NULL,
  nm_entity_type text NOT NULL,
  nm_entity_id text NOT NULL,
  last_synced_at timestamptz DEFAULT now(),
  sync_status text DEFAULT 'synced',
  sync_data jsonb,
  UNIQUE(club_id, entity_type, virtuagym_id)
);

-- ========== FASE 2: CONTROL DE ACCESO ==========

CREATE TABLE IF NOT EXISTS nm_access_points (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  club_id bigint REFERENCES nm_clubs(id) ON DELETE CASCADE,
  name text NOT NULL,
  type text NOT NULL DEFAULT 'turnstile',
  location text,
  hardware_id text,
  relay_endpoint text,
  relay_method text DEFAULT 'http',
  is_active boolean DEFAULT true,
  config jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS nm_access_credentials (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  club_id bigint REFERENCES nm_clubs(id) ON DELETE CASCADE,
  user_id uuid REFERENCES nm_users(id) ON DELETE CASCADE,
  type text NOT NULL,
  credential_data text NOT NULL,
  is_active boolean DEFAULT true,
  expires_at timestamptz,
  created_at timestamptz DEFAULT now(),
  last_used_at timestamptz,
  UNIQUE(club_id, user_id, type)
);

CREATE TABLE IF NOT EXISTS nm_access_logs (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  club_id bigint REFERENCES nm_clubs(id) ON DELETE CASCADE,
  user_id uuid REFERENCES nm_users(id),
  access_point_id bigint REFERENCES nm_access_points(id),
  credential_type text,
  direction text DEFAULT 'in',
  granted boolean NOT NULL,
  denial_reason text,
  timestamp timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_nm_access_logs_user ON nm_access_logs(user_id, timestamp);
CREATE INDEX IF NOT EXISTS idx_nm_access_logs_point ON nm_access_logs(access_point_id, timestamp);

-- ========== FASE 3: FACTURACIÓN Y CRÉDITOS ==========

CREATE TABLE IF NOT EXISTS nm_subscription_plans (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  club_id bigint REFERENCES nm_clubs(id) ON DELETE CASCADE,
  name text NOT NULL,
  slug text,
  description text,
  price numeric(8,2) NOT NULL,
  billing_cycle text NOT NULL DEFAULT 'monthly',
  features jsonb DEFAULT '[]'::jsonb,
  includes_gym boolean DEFAULT false,
  includes_courts boolean DEFAULT false,
  court_discount_pct numeric(4,2) DEFAULT 0,
  max_classes_per_week int,
  max_bookings_per_week int,
  access_hours jsonb,
  is_active boolean DEFAULT true,
  sort_order int DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS nm_subscriptions (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  club_id bigint REFERENCES nm_clubs(id) ON DELETE CASCADE,
  user_id uuid REFERENCES nm_users(id) ON DELETE CASCADE,
  plan_id bigint REFERENCES nm_subscription_plans(id),
  status text DEFAULT 'active',
  start_date date NOT NULL,
  current_period_start date,
  current_period_end date,
  cancel_at_period_end boolean DEFAULT false,
  cancelled_at timestamptz,
  payment_method text,
  stripe_subscription_id text,
  notes text,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS nm_invoices (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  club_id bigint REFERENCES nm_clubs(id) ON DELETE CASCADE,
  user_id uuid REFERENCES nm_users(id),
  invoice_number text NOT NULL,
  subscription_id bigint REFERENCES nm_subscriptions(id),
  items jsonb NOT NULL,
  subtotal numeric(10,2),
  tax numeric(10,2),
  total numeric(10,2),
  status text DEFAULT 'pending',
  due_date date,
  paid_at timestamptz,
  payment_method text,
  payment_reference text,
  pdf_url text,
  notes text,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS nm_credit_packs (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  club_id bigint REFERENCES nm_clubs(id) ON DELETE CASCADE,
  name text NOT NULL,
  type text NOT NULL,
  credits int NOT NULL,
  price numeric(8,2) NOT NULL,
  valid_days int DEFAULT 90,
  applicable_to jsonb,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS nm_user_credits (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  club_id bigint REFERENCES nm_clubs(id) ON DELETE CASCADE,
  user_id uuid REFERENCES nm_users(id) ON DELETE CASCADE,
  pack_id bigint REFERENCES nm_credit_packs(id),
  total_credits int NOT NULL,
  used_credits int DEFAULT 0,
  purchased_at timestamptz DEFAULT now(),
  expires_at timestamptz,
  status text DEFAULT 'active'
);

CREATE TABLE IF NOT EXISTS nm_credit_usage (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_credit_id bigint REFERENCES nm_user_credits(id),
  user_id uuid REFERENCES nm_users(id),
  usage_type text NOT NULL,
  reference_id bigint,
  credits_used int DEFAULT 1,
  used_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_nm_subscriptions_user ON nm_subscriptions(user_id, status);
CREATE INDEX IF NOT EXISTS idx_nm_invoices_user ON nm_invoices(user_id, status);
CREATE INDEX IF NOT EXISTS idx_nm_user_credits_user ON nm_user_credits(user_id, status);

-- ========== FASE 4: COMUNIDAD ==========

CREATE TABLE IF NOT EXISTS nm_posts (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  club_id bigint REFERENCES nm_clubs(id) ON DELETE CASCADE,
  author_id uuid REFERENCES nm_users(id),
  type text DEFAULT 'post',
  content text NOT NULL,
  images jsonb DEFAULT '[]'::jsonb,
  link_url text,
  link_preview jsonb,
  is_pinned boolean DEFAULT false,
  visibility text DEFAULT 'members',
  likes_count int DEFAULT 0,
  comments_count int DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS nm_post_likes (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  post_id bigint REFERENCES nm_posts(id) ON DELETE CASCADE,
  user_id uuid REFERENCES nm_users(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE(post_id, user_id)
);

CREATE TABLE IF NOT EXISTS nm_post_comments (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  post_id bigint REFERENCES nm_posts(id) ON DELETE CASCADE,
  author_id uuid REFERENCES nm_users(id),
  content text NOT NULL,
  parent_id bigint REFERENCES nm_post_comments(id),
  likes_count int DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_nm_posts_club ON nm_posts(club_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_nm_post_likes_post ON nm_post_likes(post_id);
CREATE INDEX IF NOT EXISTS idx_nm_post_comments_post ON nm_post_comments(post_id, created_at);

-- ========== FASE 5: RETOS / GAMIFICACIÓN ==========

CREATE TABLE IF NOT EXISTS nm_challenges (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  club_id bigint REFERENCES nm_clubs(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  type text NOT NULL,
  category text,
  metric text NOT NULL,
  target_value int NOT NULL,
  start_date date,
  end_date date,
  reward_type text,
  reward_value text,
  banner_url text,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS nm_challenge_participants (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  challenge_id bigint REFERENCES nm_challenges(id) ON DELETE CASCADE,
  user_id uuid REFERENCES nm_users(id) ON DELETE CASCADE,
  current_value int DEFAULT 0,
  completed boolean DEFAULT false,
  completed_at timestamptz,
  joined_at timestamptz DEFAULT now(),
  UNIQUE(challenge_id, user_id)
);

CREATE TABLE IF NOT EXISTS nm_badges (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  club_id bigint REFERENCES nm_clubs(id) ON DELETE CASCADE,
  name text NOT NULL,
  slug text NOT NULL,
  description text,
  icon_url text,
  category text,
  criteria jsonb,
  UNIQUE(club_id, slug)
);

CREATE TABLE IF NOT EXISTS nm_user_badges (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id uuid REFERENCES nm_users(id) ON DELETE CASCADE,
  badge_id bigint REFERENCES nm_badges(id) ON DELETE CASCADE,
  awarded_at timestamptz DEFAULT now(),
  UNIQUE(user_id, badge_id)
);

-- ========== FASE 6: ENTRENAMIENTO + CATEGORÍAS + STAFF ==========

CREATE TABLE IF NOT EXISTS nm_training_plans (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  club_id bigint REFERENCES nm_clubs(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  created_by uuid REFERENCES nm_users(id),
  target_level text,
  duration_weeks int,
  goal text,
  schedule jsonb NOT NULL DEFAULT '[]'::jsonb,
  is_template boolean DEFAULT false,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS nm_user_training_plans (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id uuid REFERENCES nm_users(id) ON DELETE CASCADE,
  plan_id bigint REFERENCES nm_training_plans(id) ON DELETE CASCADE,
  assigned_by uuid REFERENCES nm_users(id),
  start_date date,
  status text DEFAULT 'active',
  progress jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS nm_product_categories (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  club_id bigint REFERENCES nm_clubs(id) ON DELETE CASCADE,
  name text NOT NULL,
  slug text,
  parent_id bigint REFERENCES nm_product_categories(id),
  image_url text,
  sort_order int DEFAULT 0,
  is_active boolean DEFAULT true
);

ALTER TABLE nm_products ADD COLUMN IF NOT EXISTS category_id bigint REFERENCES nm_product_categories(id);

CREATE TABLE IF NOT EXISTS nm_staff_schedules (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  club_id bigint REFERENCES nm_clubs(id) ON DELETE CASCADE,
  user_id uuid REFERENCES nm_users(id) ON DELETE CASCADE,
  day_of_week int NOT NULL,
  start_time time NOT NULL,
  end_time time NOT NULL,
  role text,
  is_active boolean DEFAULT true
);

CREATE TABLE IF NOT EXISTS nm_staff_shifts (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  club_id bigint REFERENCES nm_clubs(id) ON DELETE CASCADE,
  user_id uuid REFERENCES nm_users(id),
  date date NOT NULL,
  check_in timestamptz,
  check_out timestamptz,
  scheduled_start time,
  scheduled_end time,
  notes text,
  status text DEFAULT 'scheduled'
);

-- ========== RLS PARA TODAS LAS TABLAS NUEVAS ==========

ALTER TABLE nm_virtuagym_sync ENABLE ROW LEVEL SECURITY;
ALTER TABLE nm_access_points ENABLE ROW LEVEL SECURITY;
ALTER TABLE nm_access_credentials ENABLE ROW LEVEL SECURITY;
ALTER TABLE nm_access_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE nm_subscription_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE nm_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE nm_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE nm_credit_packs ENABLE ROW LEVEL SECURITY;
ALTER TABLE nm_user_credits ENABLE ROW LEVEL SECURITY;
ALTER TABLE nm_credit_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE nm_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE nm_post_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE nm_post_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE nm_challenges ENABLE ROW LEVEL SECURITY;
ALTER TABLE nm_challenge_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE nm_badges ENABLE ROW LEVEL SECURITY;
ALTER TABLE nm_user_badges ENABLE ROW LEVEL SECURITY;
ALTER TABLE nm_training_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE nm_user_training_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE nm_product_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE nm_staff_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE nm_staff_shifts ENABLE ROW LEVEL SECURITY;

-- ========== POLÍTICAS RLS ==========

-- Admin-managed tables: public read, admin write
CREATE POLICY "public_read" ON nm_virtuagym_sync FOR SELECT TO authenticated USING (nm_is_admin());
CREATE POLICY "admin_all" ON nm_virtuagym_sync FOR ALL TO authenticated USING (nm_is_admin()) WITH CHECK (nm_is_admin());
CREATE POLICY "public_read" ON nm_access_points FOR SELECT TO authenticated USING (true);
CREATE POLICY "admin_all" ON nm_access_points FOR ALL TO authenticated USING (nm_is_admin()) WITH CHECK (nm_is_admin());
CREATE POLICY "public_read" ON nm_subscription_plans FOR SELECT TO authenticated USING (true);
CREATE POLICY "admin_all" ON nm_subscription_plans FOR ALL TO authenticated USING (nm_is_admin()) WITH CHECK (nm_is_admin());
CREATE POLICY "public_read" ON nm_credit_packs FOR SELECT TO authenticated USING (true);
CREATE POLICY "admin_all" ON nm_credit_packs FOR ALL TO authenticated USING (nm_is_admin()) WITH CHECK (nm_is_admin());
CREATE POLICY "public_read" ON nm_challenges FOR SELECT TO authenticated USING (true);
CREATE POLICY "admin_all" ON nm_challenges FOR ALL TO authenticated USING (nm_is_admin()) WITH CHECK (nm_is_admin());
CREATE POLICY "public_read" ON nm_badges FOR SELECT TO authenticated USING (true);
CREATE POLICY "admin_all" ON nm_badges FOR ALL TO authenticated USING (nm_is_admin()) WITH CHECK (nm_is_admin());
CREATE POLICY "public_read" ON nm_training_plans FOR SELECT TO authenticated USING (true);
CREATE POLICY "admin_all" ON nm_training_plans FOR ALL TO authenticated USING (nm_is_admin()) WITH CHECK (nm_is_admin());
CREATE POLICY "public_read" ON nm_product_categories FOR SELECT TO authenticated USING (true);
CREATE POLICY "admin_all" ON nm_product_categories FOR ALL TO authenticated USING (nm_is_admin()) WITH CHECK (nm_is_admin());
CREATE POLICY "public_read" ON nm_staff_schedules FOR SELECT TO authenticated USING (nm_is_admin());
CREATE POLICY "admin_all" ON nm_staff_schedules FOR ALL TO authenticated USING (nm_is_admin()) WITH CHECK (nm_is_admin());
CREATE POLICY "public_read" ON nm_staff_shifts FOR SELECT TO authenticated USING (nm_is_admin());
CREATE POLICY "admin_all" ON nm_staff_shifts FOR ALL TO authenticated USING (nm_is_admin()) WITH CHECK (nm_is_admin());

-- User-owned data: own read + admin all
CREATE POLICY "own_read" ON nm_access_credentials FOR SELECT TO authenticated USING (user_id = auth.uid() OR nm_is_admin());
CREATE POLICY "admin_all" ON nm_access_credentials FOR ALL TO authenticated USING (nm_is_admin()) WITH CHECK (nm_is_admin());
CREATE POLICY "own_read" ON nm_subscriptions FOR SELECT TO authenticated USING (user_id = auth.uid() OR nm_is_admin());
CREATE POLICY "admin_all" ON nm_subscriptions FOR ALL TO authenticated USING (nm_is_admin()) WITH CHECK (nm_is_admin());
CREATE POLICY "own_read" ON nm_invoices FOR SELECT TO authenticated USING (user_id = auth.uid() OR nm_is_admin());
CREATE POLICY "admin_all" ON nm_invoices FOR ALL TO authenticated USING (nm_is_admin()) WITH CHECK (nm_is_admin());
CREATE POLICY "own_read" ON nm_user_credits FOR SELECT TO authenticated USING (user_id = auth.uid() OR nm_is_admin());
CREATE POLICY "admin_all" ON nm_user_credits FOR ALL TO authenticated USING (nm_is_admin()) WITH CHECK (nm_is_admin());
CREATE POLICY "own_read" ON nm_credit_usage FOR SELECT TO authenticated USING (user_id = auth.uid() OR nm_is_admin());
CREATE POLICY "own_read" ON nm_access_logs FOR SELECT TO authenticated USING (user_id = auth.uid() OR nm_is_admin());
CREATE POLICY "admin_all" ON nm_access_logs FOR ALL TO authenticated USING (nm_is_admin()) WITH CHECK (nm_is_admin());
CREATE POLICY "own_read" ON nm_user_training_plans FOR SELECT TO authenticated USING (user_id = auth.uid() OR nm_is_admin());
CREATE POLICY "admin_all" ON nm_user_training_plans FOR ALL TO authenticated USING (nm_is_admin()) WITH CHECK (nm_is_admin());
CREATE POLICY "own_read" ON nm_user_badges FOR SELECT TO authenticated USING (user_id = auth.uid() OR nm_is_admin());

-- Community: all members can read, own write
CREATE POLICY "auth_read" ON nm_posts FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_insert" ON nm_posts FOR INSERT TO authenticated WITH CHECK (author_id = auth.uid());
CREATE POLICY "own_update" ON nm_posts FOR UPDATE TO authenticated USING (author_id = auth.uid() OR nm_is_admin());
CREATE POLICY "admin_delete" ON nm_posts FOR DELETE TO authenticated USING (author_id = auth.uid() OR nm_is_admin());
CREATE POLICY "auth_read" ON nm_post_likes FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_insert" ON nm_post_likes FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "own_delete" ON nm_post_likes FOR DELETE TO authenticated USING (user_id = auth.uid());
CREATE POLICY "auth_read" ON nm_post_comments FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_insert" ON nm_post_comments FOR INSERT TO authenticated WITH CHECK (author_id = auth.uid());
CREATE POLICY "admin_delete" ON nm_post_comments FOR DELETE TO authenticated USING (author_id = auth.uid() OR nm_is_admin());

-- Challenges: join own
CREATE POLICY "auth_insert" ON nm_challenge_participants FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "own_read" ON nm_challenge_participants FOR SELECT TO authenticated USING (true);
CREATE POLICY "own_update" ON nm_challenge_participants FOR UPDATE TO authenticated USING (user_id = auth.uid() OR nm_is_admin());
