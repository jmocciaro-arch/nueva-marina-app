-- Habilita Supabase Realtime para todas las tablas que la app escucha en vivo.
-- Este script es idempotente: podés correrlo varias veces sin problema.
-- Solo agrega las tablas que existen y que no estén ya en la publicación.
--
-- Cómo correr: SQL Editor del dashboard de Supabase → New query → pegar todo → Run.

DO $$
DECLARE
  t text;
  tables text[] := ARRAY[
    -- Reservas
    'nm_bookings',
    'nm_courts',
    'nm_court_schedules',
    -- Caja
    'nm_cash_register',
    'nm_cash_entries',
    -- Gimnasio
    'nm_gym_memberships',
    'nm_gym_classes',
    'nm_gym_sessions',
    'nm_gym_access_logs',
    'nm_recovery_sessions',
    -- Tienda
    'nm_products',
    'nm_product_categories',
    'nm_sales',
    -- Jugadores / personas
    'nm_users',
    'nm_club_members',
    'nm_player_profiles',
    -- Ligas
    'nm_leagues',
    'nm_league_categories',
    'nm_league_teams',
    'nm_league_rounds',
    'nm_league_matches',
    -- Torneos
    'nm_tournaments',
    'nm_tournament_matches',
    'nm_tournament_teams',
    -- Pricing y configuración
    'nm_price_rules',
    'nm_clubs',
    'nm_club_modules',
    'nm_roles',
    'nm_permissions',
    'nm_role_permissions'
  ];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    IF EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = t
    )
    AND NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime' AND tablename = t
    )
    THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
      RAISE NOTICE 'Realtime habilitado en %', t;
    END IF;
  END LOOP;
END $$;
