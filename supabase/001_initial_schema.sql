-- =============================================
-- NUEVA MARINA — SCHEMA COMPLETO
-- Prefijo: nm_
-- Ejecutar en Supabase SQL Editor
-- =============================================

-- ========== CORE ==========

CREATE TABLE IF NOT EXISTS nm_clubs (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name text NOT NULL,
  slug text UNIQUE NOT NULL,
  legal_name text,
  tax_id text,
  country text DEFAULT 'ES',
  city text,
  address text,
  phone text,
  email text,
  website text,
  logo_url text,
  banner_url text,
  timezone text DEFAULT 'Europe/Madrid',
  currency text DEFAULT 'EUR',
  config jsonb DEFAULT '{}'::jsonb,
  subscription_plan text DEFAULT 'free',
  subscription_status text DEFAULT 'active',
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS nm_users (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text UNIQUE NOT NULL,
  full_name text,
  first_name text,
  last_name text,
  phone text,
  avatar_url text,
  date_of_birth date,
  gender text,
  country text DEFAULT 'ES',
  city text,
  preferred_language text DEFAULT 'es',
  is_active boolean DEFAULT true,
  last_login_at timestamptz,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS nm_club_members (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  club_id bigint REFERENCES nm_clubs(id) ON DELETE CASCADE,
  user_id uuid REFERENCES nm_users(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'player',
  membership_type text,
  membership_start date,
  membership_end date,
  is_active boolean DEFAULT true,
  permissions jsonb DEFAULT '[]'::jsonb,
  joined_at timestamptz DEFAULT now(),
  UNIQUE(club_id, user_id)
);

-- ========== RBAC ==========

CREATE TABLE IF NOT EXISTS nm_roles (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  club_id bigint REFERENCES nm_clubs(id) ON DELETE CASCADE,
  name text NOT NULL,
  slug text NOT NULL,
  permissions text[] DEFAULT '{}',
  is_system boolean DEFAULT false,
  UNIQUE(club_id, slug)
);

CREATE TABLE IF NOT EXISTS nm_permissions (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  key text UNIQUE NOT NULL,
  module text NOT NULL,
  description text
);

-- ========== VENUES & COURTS ==========

CREATE TABLE IF NOT EXISTS nm_sports (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name text NOT NULL,
  slug text UNIQUE NOT NULL,
  icon text,
  config jsonb DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS nm_venues (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  club_id bigint REFERENCES nm_clubs(id) ON DELETE CASCADE,
  name text NOT NULL,
  address text,
  lat numeric,
  lng numeric,
  config jsonb DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS nm_courts (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  club_id bigint REFERENCES nm_clubs(id) ON DELETE CASCADE,
  venue_id bigint REFERENCES nm_venues(id),
  sport_id bigint REFERENCES nm_sports(id),
  name text NOT NULL,
  type text,
  surface text,
  has_lighting boolean DEFAULT true,
  is_active boolean DEFAULT true,
  color text DEFAULT '#06b6d4',
  sort_order int DEFAULT 0,
  config jsonb DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS nm_court_schedules (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  court_id bigint REFERENCES nm_courts(id) ON DELETE CASCADE,
  day_of_week int NOT NULL,
  open_time time NOT NULL,
  close_time time NOT NULL,
  slot_duration int DEFAULT 90,
  price_per_slot numeric(8,2),
  is_peak boolean DEFAULT false,
  peak_price numeric(8,2),
  peak_start time,
  peak_end time
);

-- ========== PLAYER PROFILES ==========

CREATE TABLE IF NOT EXISTS nm_player_profiles (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id uuid REFERENCES nm_users(id) ON DELETE CASCADE,
  club_id bigint REFERENCES nm_clubs(id) ON DELETE CASCADE,
  preferred_position text DEFAULT 'drive',
  secondary_position text,
  dominant_hand text DEFAULT 'right',
  level numeric(3,1),
  category text,
  racket_brand text,
  racket_model text,
  matches_played int DEFAULT 0,
  matches_won int DEFAULT 0,
  win_rate numeric(5,2) DEFAULT 0,
  sets_won int DEFAULT 0,
  sets_lost int DEFAULT 0,
  games_won int DEFAULT 0,
  games_lost int DEFAULT 0,
  ranking_points int DEFAULT 1000,
  ranking_position int,
  best_ranking int,
  reputation_score numeric(3,1) DEFAULT 5.0,
  punctuality_score numeric(3,1) DEFAULT 5.0,
  sportsmanship_score numeric(3,1) DEFAULT 5.0,
  cancellation_rate numeric(5,2) DEFAULT 0,
  total_cancellations int DEFAULT 0,
  total_no_shows int DEFAULT 0,
  availability jsonb DEFAULT '{}'::jsonb,
  bio text,
  photo_url text,
  is_public boolean DEFAULT true,
  UNIQUE(user_id, club_id)
);

-- ========== BOOKINGS ==========

CREATE TABLE IF NOT EXISTS nm_bookings (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  club_id bigint REFERENCES nm_clubs(id) ON DELETE CASCADE,
  court_id bigint REFERENCES nm_courts(id),
  booked_by uuid REFERENCES nm_users(id),
  date date NOT NULL,
  start_time time NOT NULL,
  end_time time NOT NULL,
  duration_minutes int NOT NULL DEFAULT 90,
  status text DEFAULT 'confirmed',
  type text DEFAULT 'regular',
  price numeric(8,2),
  payment_status text DEFAULT 'pending',
  payment_method text,
  stripe_payment_id text,
  players jsonb DEFAULT '[]'::jsonb,
  needs_players int DEFAULT 0,
  is_open boolean DEFAULT false,
  notes text,
  cancelled_at timestamptz,
  cancelled_by uuid,
  cancellation_reason text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- ========== MATCHES ==========

CREATE TABLE IF NOT EXISTS nm_matches (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  club_id bigint REFERENCES nm_clubs(id) ON DELETE CASCADE,
  booking_id bigint REFERENCES nm_bookings(id),
  sport_id bigint REFERENCES nm_sports(id),
  match_type text DEFAULT 'friendly',
  team1_player1 uuid REFERENCES nm_users(id),
  team1_player2 uuid REFERENCES nm_users(id),
  team2_player1 uuid REFERENCES nm_users(id),
  team2_player2 uuid REFERENCES nm_users(id),
  team1_set1 int, team2_set1 int,
  team1_set2 int, team2_set2 int,
  team1_set3 int, team2_set3 int,
  sets_team1 int DEFAULT 0,
  sets_team2 int DEFAULT 0,
  games_team1 int DEFAULT 0,
  games_team2 int DEFAULT 0,
  winner_team int,
  ranking_points_change jsonb,
  status text DEFAULT 'scheduled',
  played_at timestamptz,
  duration_minutes int,
  video_url text,
  notes text,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS nm_rankings (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  club_id bigint REFERENCES nm_clubs(id) ON DELETE CASCADE,
  user_id uuid REFERENCES nm_users(id),
  sport_id bigint REFERENCES nm_sports(id),
  category text,
  gender text,
  points int DEFAULT 1000,
  position int,
  matches_played int DEFAULT 0,
  wins int DEFAULT 0,
  losses int DEFAULT 0,
  streak int DEFAULT 0,
  last_match_at timestamptz,
  updated_at timestamptz DEFAULT now(),
  UNIQUE(club_id, user_id, sport_id, category, gender)
);

-- ========== TOURNAMENTS ==========

CREATE TABLE IF NOT EXISTS nm_tournaments (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  club_id bigint REFERENCES nm_clubs(id) ON DELETE CASCADE,
  name text NOT NULL,
  slug text,
  format text NOT NULL,
  sport_id bigint REFERENCES nm_sports(id),
  start_date date,
  end_date date,
  registration_deadline date,
  max_teams int,
  min_teams int DEFAULT 4,
  entry_fee numeric(8,2) DEFAULT 0,
  prize_pool numeric(8,2) DEFAULT 0,
  prize_description text,
  sets_to_win int DEFAULT 2,
  games_per_set int DEFAULT 6,
  golden_point boolean DEFAULT true,
  third_place_match boolean DEFAULT true,
  banner_url text,
  description text,
  rules_text text,
  sponsor text,
  status text DEFAULT 'draft',
  categories jsonb DEFAULT '[]'::jsonb,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS nm_tournament_teams (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  tournament_id bigint REFERENCES nm_tournaments(id) ON DELETE CASCADE,
  category text,
  team_name text,
  player1_id uuid REFERENCES nm_users(id),
  player1_name text NOT NULL,
  player2_id uuid REFERENCES nm_users(id),
  player2_name text NOT NULL,
  seed int,
  status text DEFAULT 'registered',
  paid boolean DEFAULT false,
  registered_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS nm_tournament_matches (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  tournament_id bigint REFERENCES nm_tournaments(id) ON DELETE CASCADE,
  category text,
  round text,
  match_number int,
  court_id bigint REFERENCES nm_courts(id),
  scheduled_at timestamptz,
  team1_id bigint REFERENCES nm_tournament_teams(id),
  team2_id bigint REFERENCES nm_tournament_teams(id),
  team1_source text,
  team2_source text,
  team1_set1 int, team2_set1 int,
  team1_set2 int, team2_set2 int,
  team1_set3 int, team2_set3 int,
  sets_team1 int DEFAULT 0,
  sets_team2 int DEFAULT 0,
  games_team1 int DEFAULT 0,
  games_team2 int DEFAULT 0,
  winner_team_id bigint,
  status text DEFAULT 'pending',
  played_at timestamptz
);

-- ========== LEAGUES ==========

CREATE TABLE IF NOT EXISTS nm_leagues (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  club_id bigint REFERENCES nm_clubs(id) ON DELETE CASCADE,
  name text NOT NULL,
  slug text,
  format text NOT NULL,
  sport_id bigint REFERENCES nm_sports(id),
  season text,
  sponsor text,
  banner_url text,
  start_date date,
  end_date date,
  registration_deadline date,
  entry_fee numeric(8,2) DEFAULT 0,
  scoring_rules jsonb DEFAULT '{"win_2_0":3,"win_2_1":2,"loss_1_2":1,"loss_0_2":0,"walkover_win":3,"walkover_loss":-1,"punctuality_bonus":2,"max_pending_for_bonus":1,"tiebreakers":["head_to_head","set_difference","game_difference","wins","draw"]}'::jsonb,
  sets_to_win int DEFAULT 2,
  games_per_set int DEFAULT 6,
  golden_point boolean DEFAULT true,
  has_playoffs boolean DEFAULT false,
  playoff_format text DEFAULT 'cross_group',
  description text,
  rules_text text,
  status text DEFAULT 'draft',
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS nm_league_categories (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  league_id bigint REFERENCES nm_leagues(id) ON DELETE CASCADE,
  name text NOT NULL,
  gender text DEFAULT 'mixed',
  level text,
  max_teams int DEFAULT 12,
  num_groups int DEFAULT 1,
  play_days text[],
  play_time_start time,
  play_time_end time,
  status text DEFAULT 'registration',
  sort_order int DEFAULT 0
);

CREATE TABLE IF NOT EXISTS nm_league_groups (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  category_id bigint REFERENCES nm_league_categories(id) ON DELETE CASCADE,
  name text NOT NULL,
  sort_order int DEFAULT 0
);

CREATE TABLE IF NOT EXISTS nm_league_teams (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  category_id bigint REFERENCES nm_league_categories(id) ON DELETE CASCADE,
  group_id bigint REFERENCES nm_league_groups(id) ON DELETE SET NULL,
  team_name text,
  player1_id uuid REFERENCES nm_users(id),
  player1_name text NOT NULL,
  player1_position text DEFAULT 'drive',
  player2_id uuid REFERENCES nm_users(id),
  player2_name text NOT NULL,
  player2_position text DEFAULT 'reves',
  player3_id uuid REFERENCES nm_users(id),
  player3_name text,
  player3_position text,
  seed int,
  is_active boolean DEFAULT true,
  registered_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS nm_league_rounds (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  category_id bigint REFERENCES nm_league_categories(id) ON DELETE CASCADE,
  group_id bigint REFERENCES nm_league_groups(id),
  round_number int NOT NULL,
  scheduled_date date,
  deadline_date date,
  status text DEFAULT 'pending',
  is_playoff boolean DEFAULT false
);

CREATE TABLE IF NOT EXISTS nm_league_matches (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  round_id bigint REFERENCES nm_league_rounds(id) ON DELETE CASCADE,
  category_id bigint REFERENCES nm_league_categories(id) ON DELETE CASCADE,
  group_id bigint REFERENCES nm_league_groups(id),
  team1_id bigint REFERENCES nm_league_teams(id),
  team2_id bigint REFERENCES nm_league_teams(id),
  court_id bigint REFERENCES nm_courts(id),
  team1_set1 int, team2_set1 int,
  team1_set2 int, team2_set2 int,
  team1_set3 int, team2_set3 int,
  sets_team1 int DEFAULT 0,
  sets_team2 int DEFAULT 0,
  games_team1 int DEFAULT 0,
  games_team2 int DEFAULT 0,
  winner_team_id bigint,
  status text DEFAULT 'scheduled',
  walkover_team_id bigint,
  played_date date,
  reported_by uuid,
  notes text,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS nm_league_playoff_matches (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  category_id bigint REFERENCES nm_league_categories(id) ON DELETE CASCADE,
  stage text NOT NULL,
  match_number int,
  team1_id bigint REFERENCES nm_league_teams(id),
  team2_id bigint REFERENCES nm_league_teams(id),
  team1_source text,
  team2_source text,
  team1_set1 int, team2_set1 int,
  team1_set2 int, team2_set2 int,
  team1_set3 int, team2_set3 int,
  sets_team1 int DEFAULT 0,
  sets_team2 int DEFAULT 0,
  games_team1 int DEFAULT 0,
  games_team2 int DEFAULT 0,
  winner_team_id bigint,
  status text DEFAULT 'pending',
  played_date date
);

-- ========== GYM ==========

CREATE TABLE IF NOT EXISTS nm_gym_memberships (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  club_id bigint REFERENCES nm_clubs(id) ON DELETE CASCADE,
  user_id uuid REFERENCES nm_users(id),
  plan text NOT NULL,
  price numeric(8,2),
  billing_cycle text DEFAULT 'monthly',
  start_date date NOT NULL,
  end_date date,
  status text DEFAULT 'active',
  stripe_subscription_id text,
  auto_renew boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS nm_gym_sessions (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  club_id bigint REFERENCES nm_clubs(id) ON DELETE CASCADE,
  user_id uuid REFERENCES nm_users(id),
  check_in timestamptz NOT NULL,
  check_out timestamptz,
  duration_minutes int,
  type text DEFAULT 'free',
  class_id bigint,
  trainer_id uuid REFERENCES nm_users(id)
);

CREATE TABLE IF NOT EXISTS nm_gym_classes (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  club_id bigint REFERENCES nm_clubs(id) ON DELETE CASCADE,
  name text NOT NULL,
  instructor_id uuid REFERENCES nm_users(id),
  day_of_week int,
  start_time time,
  end_time time,
  max_capacity int DEFAULT 15,
  sport_id bigint REFERENCES nm_sports(id),
  is_recurring boolean DEFAULT true,
  is_active boolean DEFAULT true
);

CREATE TABLE IF NOT EXISTS nm_exercises (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name text NOT NULL,
  muscle_group text,
  equipment text,
  description text,
  video_url text,
  padel_benefit text,
  difficulty text DEFAULT 'intermediate'
);

CREATE TABLE IF NOT EXISTS nm_workouts (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  club_id bigint REFERENCES nm_clubs(id) ON DELETE CASCADE,
  user_id uuid REFERENCES nm_users(id),
  name text,
  type text,
  exercises jsonb NOT NULL,
  source text,
  ai_context text,
  completed_at timestamptz,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS nm_body_metrics (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id uuid REFERENCES nm_users(id) ON DELETE CASCADE,
  club_id bigint REFERENCES nm_clubs(id),
  date date NOT NULL,
  weight numeric(5,1),
  height numeric(5,1),
  body_fat numeric(4,1),
  muscle_mass numeric(4,1),
  resting_hr int,
  notes text
);

-- ========== E-COMMERCE ==========

CREATE TABLE IF NOT EXISTS nm_products (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  club_id bigint REFERENCES nm_clubs(id) ON DELETE CASCADE,
  name text NOT NULL,
  slug text,
  category text,
  brand text,
  description text,
  price numeric(8,2) NOT NULL,
  cost numeric(8,2),
  tax_rate numeric(4,2) DEFAULT 21,
  sku text,
  barcode text,
  stock int DEFAULT 0,
  min_stock int DEFAULT 0,
  images jsonb DEFAULT '[]'::jsonb,
  specs jsonb DEFAULT '{}'::jsonb,
  is_active boolean DEFAULT true,
  is_featured boolean DEFAULT false,
  sort_order int DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS nm_orders (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  club_id bigint REFERENCES nm_clubs(id) ON DELETE CASCADE,
  user_id uuid REFERENCES nm_users(id),
  order_number text NOT NULL,
  items jsonb NOT NULL,
  subtotal numeric(10,2),
  tax numeric(10,2),
  total numeric(10,2),
  payment_method text,
  payment_status text DEFAULT 'pending',
  stripe_payment_id text,
  status text DEFAULT 'pending',
  shipping_address jsonb,
  notes text,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS nm_cash_register (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  club_id bigint REFERENCES nm_clubs(id) ON DELETE CASCADE,
  type text NOT NULL,
  description text,
  amount numeric(10,2) NOT NULL,
  payment_method text NOT NULL,
  reference_type text,
  reference_id bigint,
  staff_id uuid REFERENCES nm_users(id),
  date date DEFAULT CURRENT_DATE,
  created_at timestamptz DEFAULT now()
);

-- ========== INNOVATION ==========

CREATE TABLE IF NOT EXISTS nm_videos (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  club_id bigint REFERENCES nm_clubs(id) ON DELETE CASCADE,
  user_id uuid REFERENCES nm_users(id),
  match_id bigint REFERENCES nm_matches(id),
  title text,
  video_url text NOT NULL,
  thumbnail_url text,
  duration_seconds int,
  type text DEFAULT 'match',
  status text DEFAULT 'uploaded',
  analysis jsonb,
  tags text[],
  is_public boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS nm_ai_recommendations (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  club_id bigint REFERENCES nm_clubs(id),
  user_id uuid REFERENCES nm_users(id),
  type text NOT NULL,
  source text,
  title text NOT NULL,
  description text,
  data jsonb NOT NULL,
  status text DEFAULT 'active',
  dismissed_at timestamptz,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS nm_innovation_ideas (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  club_id bigint REFERENCES nm_clubs(id) ON DELETE CASCADE,
  submitted_by uuid REFERENCES nm_users(id),
  title text NOT NULL,
  description text,
  category text,
  status text DEFAULT 'submitted',
  assigned_to uuid REFERENCES nm_users(id),
  priority text DEFAULT 'medium',
  votes int DEFAULT 0,
  comments jsonb DEFAULT '[]'::jsonb,
  created_at timestamptz DEFAULT now()
);

-- ========== SYSTEM ==========

CREATE TABLE IF NOT EXISTS nm_notifications (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  club_id bigint REFERENCES nm_clubs(id),
  user_id uuid REFERENCES nm_users(id),
  type text NOT NULL,
  channel text DEFAULT 'in_app',
  title text NOT NULL,
  body text,
  data jsonb,
  is_read boolean DEFAULT false,
  sent_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS nm_payments (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  club_id bigint REFERENCES nm_clubs(id) ON DELETE CASCADE,
  user_id uuid REFERENCES nm_users(id),
  type text NOT NULL,
  reference_id bigint,
  amount numeric(10,2) NOT NULL,
  currency text DEFAULT 'EUR',
  method text NOT NULL,
  stripe_payment_id text,
  status text DEFAULT 'completed',
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS nm_audit_log (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  club_id bigint REFERENCES nm_clubs(id),
  user_id uuid REFERENCES nm_users(id),
  entity_type text NOT NULL,
  entity_id bigint,
  action text NOT NULL,
  changes jsonb,
  ip_address text,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS nm_consents (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id uuid REFERENCES nm_users(id) ON DELETE CASCADE,
  type text NOT NULL,
  accepted boolean NOT NULL,
  version text,
  accepted_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS nm_events (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  club_id bigint REFERENCES nm_clubs(id) ON DELETE CASCADE,
  name text NOT NULL,
  type text NOT NULL,
  description text,
  date date,
  start_time time,
  end_time time,
  location text,
  max_capacity int,
  price numeric(8,2) DEFAULT 0,
  banner_url text,
  status text DEFAULT 'upcoming',
  registrations jsonb DEFAULT '[]'::jsonb,
  created_at timestamptz DEFAULT now()
);

-- ========== INDEXES ==========

CREATE INDEX IF NOT EXISTS idx_nm_bookings_club_date ON nm_bookings(club_id, date);
CREATE INDEX IF NOT EXISTS idx_nm_bookings_court_date ON nm_bookings(court_id, date, start_time);
CREATE INDEX IF NOT EXISTS idx_nm_bookings_user ON nm_bookings(booked_by);
CREATE INDEX IF NOT EXISTS idx_nm_matches_club ON nm_matches(club_id);
CREATE INDEX IF NOT EXISTS idx_nm_rankings_club ON nm_rankings(club_id, sport_id, category);
CREATE INDEX IF NOT EXISTS idx_nm_player_profiles_club ON nm_player_profiles(club_id, user_id);
CREATE INDEX IF NOT EXISTS idx_nm_cash_club_date ON nm_cash_register(club_id, date);
CREATE INDEX IF NOT EXISTS idx_nm_notifications_user ON nm_notifications(user_id, is_read);
CREATE INDEX IF NOT EXISTS idx_nm_audit_club ON nm_audit_log(club_id, created_at);
CREATE INDEX IF NOT EXISTS idx_nm_league_matches_round ON nm_league_matches(round_id);
CREATE INDEX IF NOT EXISTS idx_nm_league_teams_cat ON nm_league_teams(category_id);
CREATE INDEX IF NOT EXISTS idx_nm_club_members_user ON nm_club_members(user_id);

-- ========== SEED DATA ==========

-- Insert Nueva Marina club
INSERT INTO nm_clubs (name, slug, legal_name, tax_id, country, city, address, phone, email, website, timezone, currency, config)
VALUES (
  'Nueva Marina Padel & Sport',
  'nueva-marina',
  'FALTA ENVIDO SL',
  'B12345678',
  'ES',
  'Motril',
  'Motril, Granada, España',
  '+34 600 000 000',
  'nuevamarina.padel@gmail.com',
  'https://www.nuevamarina.es',
  'Europe/Madrid',
  'EUR',
  '{"theme":{"primary_color":"#06b6d4"},"features":{"gym":true,"shop":true,"tournaments":true,"leagues":true,"innovation":false,"ai":false},"booking":{"slot_duration":90,"max_advance_days":14,"cancellation_hours":24}}'::jsonb
) ON CONFLICT (slug) DO NOTHING;

-- Insert padel sport
INSERT INTO nm_sports (name, slug, icon, config)
VALUES ('Padel', 'padel', '🎾', '{}')
ON CONFLICT (slug) DO NOTHING;

-- Insert venue
INSERT INTO nm_venues (club_id, name, address)
VALUES (1, 'Sede Principal', 'Motril, Granada')
ON CONFLICT DO NOTHING;

-- Insert 4 courts
INSERT INTO nm_courts (club_id, venue_id, sport_id, name, type, surface, has_lighting, color, sort_order) VALUES
(1, 1, 1, 'Pista 1', 'outdoor', 'crystal', true, '#06b6d4', 1),
(1, 1, 1, 'Pista 2', 'outdoor', 'crystal', true, '#8b5cf6', 2),
(1, 1, 1, 'Pista 3', 'outdoor', 'crystal', true, '#f59e0b', 3),
(1, 1, 1, 'Pista 4', 'outdoor', 'crystal', true, '#10b981', 4)
ON CONFLICT DO NOTHING;

-- Insert court schedules (all 4 courts, Mon-Sun, 08:00-00:00)
DO $$
DECLARE
  court_rec RECORD;
  d int;
BEGIN
  FOR court_rec IN SELECT id FROM nm_courts WHERE club_id = 1 LOOP
    FOR d IN 0..6 LOOP
      INSERT INTO nm_court_schedules (court_id, day_of_week, open_time, close_time, slot_duration, price_per_slot, is_peak, peak_price, peak_start, peak_end)
      VALUES (court_rec.id, d, '08:00', '00:00', 90, 24.00, true, 30.00, '18:00', '22:00')
      ON CONFLICT DO NOTHING;
    END LOOP;
  END LOOP;
END $$;

-- Insert default permissions
INSERT INTO nm_permissions (key, module, description) VALUES
('manage_club', 'admin', 'Gestionar configuracion del club'),
('manage_users', 'admin', 'Gestionar usuarios y roles'),
('manage_courts', 'admin', 'Gestionar pistas y horarios'),
('view_bookings', 'bookings', 'Ver reservas'),
('manage_bookings', 'bookings', 'Crear/editar/cancelar reservas'),
('view_cash', 'cash', 'Ver caja registradora'),
('manage_cash', 'cash', 'Registrar movimientos de caja'),
('manage_tournaments', 'tournaments', 'Gestionar torneos'),
('manage_leagues', 'leagues', 'Gestionar ligas'),
('manage_gym', 'gym', 'Gestionar gimnasio'),
('manage_shop', 'shop', 'Gestionar tienda'),
('manage_players', 'players', 'Gestionar jugadores'),
('view_reports', 'reports', 'Ver reportes y analytics'),
('manage_events', 'events', 'Gestionar eventos'),
('manage_innovation', 'innovation', 'Gestionar innovacion')
ON CONFLICT (key) DO NOTHING;

-- Insert default roles for club 1
INSERT INTO nm_roles (club_id, name, slug, permissions, is_system) VALUES
(1, 'Administrador', 'admin', ARRAY['manage_club','manage_users','manage_courts','view_bookings','manage_bookings','view_cash','manage_cash','manage_tournaments','manage_leagues','manage_gym','manage_shop','manage_players','view_reports','manage_events','manage_innovation'], true),
(1, 'Staff', 'staff', ARRAY['view_bookings','manage_bookings','view_cash','manage_cash','manage_tournaments','manage_leagues','manage_players'], true),
(1, 'Entrenador', 'coach', ARRAY['view_bookings','manage_players','manage_gym'], true),
(1, 'Jugador', 'player', ARRAY['view_bookings'], true)
ON CONFLICT (club_id, slug) DO NOTHING;

-- ========== RLS POLICIES ==========

-- Enable RLS on all tables
ALTER TABLE nm_clubs ENABLE ROW LEVEL SECURITY;
ALTER TABLE nm_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE nm_club_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE nm_courts ENABLE ROW LEVEL SECURITY;
ALTER TABLE nm_court_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE nm_bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE nm_player_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE nm_matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE nm_rankings ENABLE ROW LEVEL SECURITY;
ALTER TABLE nm_tournaments ENABLE ROW LEVEL SECURITY;
ALTER TABLE nm_tournament_teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE nm_tournament_matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE nm_leagues ENABLE ROW LEVEL SECURITY;
ALTER TABLE nm_league_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE nm_league_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE nm_league_teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE nm_league_rounds ENABLE ROW LEVEL SECURITY;
ALTER TABLE nm_league_matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE nm_league_playoff_matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE nm_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE nm_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE nm_cash_register ENABLE ROW LEVEL SECURITY;
ALTER TABLE nm_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE nm_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE nm_audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE nm_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE nm_gym_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE nm_gym_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE nm_gym_classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE nm_workouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE nm_body_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE nm_videos ENABLE ROW LEVEL SECURITY;
ALTER TABLE nm_ai_recommendations ENABLE ROW LEVEL SECURITY;
ALTER TABLE nm_innovation_ideas ENABLE ROW LEVEL SECURITY;

-- Helper function to get user role without RLS recursion
CREATE OR REPLACE FUNCTION nm_get_user_role()
RETURNS text
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT role FROM nm_club_members
  WHERE user_id = auth.uid() AND is_active = true
  LIMIT 1
$$;

CREATE OR REPLACE FUNCTION nm_is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS(
    SELECT 1 FROM nm_club_members
    WHERE user_id = auth.uid() AND is_active = true
    AND role IN ('owner', 'admin', 'staff')
  )
$$;

-- PUBLIC READ policies (everyone can see these)
CREATE POLICY "public_read" ON nm_clubs FOR SELECT USING (true);
CREATE POLICY "public_read" ON nm_sports FOR SELECT USING (true);
CREATE POLICY "public_read" ON nm_courts FOR SELECT USING (true);
CREATE POLICY "public_read" ON nm_court_schedules FOR SELECT USING (true);
CREATE POLICY "public_read" ON nm_tournaments FOR SELECT USING (true);
CREATE POLICY "public_read" ON nm_tournament_teams FOR SELECT USING (true);
CREATE POLICY "public_read" ON nm_tournament_matches FOR SELECT USING (true);
CREATE POLICY "public_read" ON nm_leagues FOR SELECT USING (true);
CREATE POLICY "public_read" ON nm_league_categories FOR SELECT USING (true);
CREATE POLICY "public_read" ON nm_league_groups FOR SELECT USING (true);
CREATE POLICY "public_read" ON nm_league_teams FOR SELECT USING (true);
CREATE POLICY "public_read" ON nm_league_rounds FOR SELECT USING (true);
CREATE POLICY "public_read" ON nm_league_matches FOR SELECT USING (true);
CREATE POLICY "public_read" ON nm_league_playoff_matches FOR SELECT USING (true);
CREATE POLICY "public_read" ON nm_rankings FOR SELECT USING (true);
CREATE POLICY "public_read" ON nm_products FOR SELECT USING (is_active = true);
CREATE POLICY "public_read" ON nm_events FOR SELECT USING (true);
CREATE POLICY "public_read" ON nm_gym_classes FOR SELECT USING (is_active = true);

-- AUTH READ policies (logged in users)
CREATE POLICY "auth_read" ON nm_users FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_read" ON nm_club_members FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_read" ON nm_bookings FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_read" ON nm_matches FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_read" ON nm_player_profiles FOR SELECT TO authenticated USING (is_public = true OR user_id = auth.uid());
CREATE POLICY "auth_read" ON nm_cash_register FOR SELECT TO authenticated USING (nm_is_admin());
CREATE POLICY "auth_read" ON nm_audit_log FOR SELECT TO authenticated USING (nm_is_admin());

-- OWN DATA policies
CREATE POLICY "own_read" ON nm_notifications FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "own_read" ON nm_orders FOR SELECT TO authenticated USING (user_id = auth.uid() OR nm_is_admin());
CREATE POLICY "own_read" ON nm_payments FOR SELECT TO authenticated USING (user_id = auth.uid() OR nm_is_admin());
CREATE POLICY "own_read" ON nm_gym_memberships FOR SELECT TO authenticated USING (user_id = auth.uid() OR nm_is_admin());
CREATE POLICY "own_read" ON nm_gym_sessions FOR SELECT TO authenticated USING (user_id = auth.uid() OR nm_is_admin());
CREATE POLICY "own_read" ON nm_workouts FOR SELECT TO authenticated USING (user_id = auth.uid() OR nm_is_admin());
CREATE POLICY "own_read" ON nm_body_metrics FOR SELECT TO authenticated USING (user_id = auth.uid() OR nm_is_admin());
CREATE POLICY "own_read" ON nm_videos FOR SELECT TO authenticated USING (is_public = true OR user_id = auth.uid() OR nm_is_admin());
CREATE POLICY "own_read" ON nm_ai_recommendations FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "own_read" ON nm_innovation_ideas FOR SELECT TO authenticated USING (true);

-- INSERT policies
CREATE POLICY "auth_insert" ON nm_users FOR INSERT TO authenticated WITH CHECK (id = auth.uid());
CREATE POLICY "auth_insert" ON nm_club_members FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "auth_insert" ON nm_bookings FOR INSERT TO authenticated WITH CHECK (booked_by = auth.uid() OR nm_is_admin());
CREATE POLICY "auth_insert" ON nm_player_profiles FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "auth_insert" ON nm_matches FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "auth_insert" ON nm_notifications FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "auth_insert" ON nm_orders FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "auth_insert" ON nm_videos FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "auth_insert" ON nm_innovation_ideas FOR INSERT TO authenticated WITH CHECK (submitted_by = auth.uid());
CREATE POLICY "auth_insert" ON nm_workouts FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "auth_insert" ON nm_body_metrics FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

-- ADMIN INSERT/UPDATE/DELETE
CREATE POLICY "admin_all" ON nm_courts FOR ALL TO authenticated USING (nm_is_admin()) WITH CHECK (nm_is_admin());
CREATE POLICY "admin_all" ON nm_court_schedules FOR ALL TO authenticated USING (nm_is_admin()) WITH CHECK (nm_is_admin());
CREATE POLICY "admin_insert" ON nm_cash_register FOR INSERT TO authenticated WITH CHECK (nm_is_admin());
CREATE POLICY "admin_all" ON nm_tournaments FOR ALL TO authenticated USING (nm_is_admin()) WITH CHECK (nm_is_admin());
CREATE POLICY "admin_all" ON nm_tournament_teams FOR ALL TO authenticated USING (nm_is_admin()) WITH CHECK (nm_is_admin());
CREATE POLICY "admin_all" ON nm_tournament_matches FOR ALL TO authenticated USING (nm_is_admin()) WITH CHECK (nm_is_admin());
CREATE POLICY "admin_all" ON nm_leagues FOR ALL TO authenticated USING (nm_is_admin()) WITH CHECK (nm_is_admin());
CREATE POLICY "admin_all" ON nm_league_categories FOR ALL TO authenticated USING (nm_is_admin()) WITH CHECK (nm_is_admin());
CREATE POLICY "admin_all" ON nm_league_groups FOR ALL TO authenticated USING (nm_is_admin()) WITH CHECK (nm_is_admin());
CREATE POLICY "admin_all" ON nm_league_teams FOR ALL TO authenticated USING (nm_is_admin()) WITH CHECK (nm_is_admin());
CREATE POLICY "admin_all" ON nm_league_rounds FOR ALL TO authenticated USING (nm_is_admin()) WITH CHECK (nm_is_admin());
CREATE POLICY "admin_all" ON nm_league_matches FOR ALL TO authenticated USING (nm_is_admin()) WITH CHECK (nm_is_admin());
CREATE POLICY "admin_all" ON nm_league_playoff_matches FOR ALL TO authenticated USING (nm_is_admin()) WITH CHECK (nm_is_admin());
CREATE POLICY "admin_all" ON nm_products FOR ALL TO authenticated USING (nm_is_admin()) WITH CHECK (nm_is_admin());
CREATE POLICY "admin_all" ON nm_events FOR ALL TO authenticated USING (nm_is_admin()) WITH CHECK (nm_is_admin());
CREATE POLICY "admin_all" ON nm_gym_classes FOR ALL TO authenticated USING (nm_is_admin()) WITH CHECK (nm_is_admin());
CREATE POLICY "admin_all" ON nm_gym_memberships FOR ALL TO authenticated USING (nm_is_admin()) WITH CHECK (nm_is_admin());

-- UPDATE own data
CREATE POLICY "own_update" ON nm_users FOR UPDATE TO authenticated USING (id = auth.uid()) WITH CHECK (id = auth.uid());
CREATE POLICY "own_update" ON nm_player_profiles FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "own_update" ON nm_bookings FOR UPDATE TO authenticated USING (booked_by = auth.uid() OR nm_is_admin());
CREATE POLICY "own_update" ON nm_notifications FOR UPDATE TO authenticated USING (user_id = auth.uid());

-- DELETE
CREATE POLICY "own_delete" ON nm_bookings FOR DELETE TO authenticated USING (booked_by = auth.uid() OR nm_is_admin());

-- Tournament/league team registration (players can insert their own)
CREATE POLICY "player_register" ON nm_tournament_teams FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "player_register" ON nm_league_teams FOR INSERT TO authenticated WITH CHECK (true);

-- =============================================
-- EXPANSIÓN VIRTUAGYM — NUEVAS TABLAS
-- =============================================

-- ========== FASE 1: VIRTUAGYM SYNC ==========

ALTER TABLE nm_users ADD COLUMN IF NOT EXISTS emergency_contact text;
ALTER TABLE nm_users ADD COLUMN IF NOT EXISTS medical_notes text;
ALTER TABLE nm_users ADD COLUMN IF NOT EXISTS document_type text;
ALTER TABLE nm_users ADD COLUMN IF NOT EXISTS document_number text;
ALTER TABLE nm_users ADD COLUMN IF NOT EXISTS address text;
ALTER TABLE nm_users ADD COLUMN IF NOT EXISTS postal_code text;
ALTER TABLE nm_users ADD COLUMN IF NOT EXISTS iban text;
ALTER TABLE nm_users ADD COLUMN IF NOT EXISTS virtuagym_id text;
ALTER TABLE nm_users ADD COLUMN IF NOT EXISTS notes text;

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

-- ========== RLS PARA NUEVAS TABLAS ==========

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
