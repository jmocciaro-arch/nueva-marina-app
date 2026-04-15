-- Habilita Supabase Realtime para las tablas de ligas
-- Corré esto desde el SQL Editor de Supabase (dashboard)
-- Si alguna tabla ya está en la publicación, el statement da error pero es seguro ignorarlo.

ALTER PUBLICATION supabase_realtime ADD TABLE nm_leagues;
ALTER PUBLICATION supabase_realtime ADD TABLE nm_league_categories;
ALTER PUBLICATION supabase_realtime ADD TABLE nm_league_teams;
ALTER PUBLICATION supabase_realtime ADD TABLE nm_league_rounds;
ALTER PUBLICATION supabase_realtime ADD TABLE nm_league_matches;

-- Tablas de otros módulos que el admin usa frecuentemente:
ALTER PUBLICATION supabase_realtime ADD TABLE nm_bookings;
ALTER PUBLICATION supabase_realtime ADD TABLE nm_users;
ALTER PUBLICATION supabase_realtime ADD TABLE nm_gym_memberships;
ALTER PUBLICATION supabase_realtime ADD TABLE nm_gym_sessions;
ALTER PUBLICATION supabase_realtime ADD TABLE nm_recovery_sessions;
ALTER PUBLICATION supabase_realtime ADD TABLE nm_products;
ALTER PUBLICATION supabase_realtime ADD TABLE nm_sales;
ALTER PUBLICATION supabase_realtime ADD TABLE nm_cash_entries;
ALTER PUBLICATION supabase_realtime ADD TABLE nm_price_rules;
