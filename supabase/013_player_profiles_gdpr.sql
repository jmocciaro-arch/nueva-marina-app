-- Fichas de jugadores + consentimientos GDPR (España / LOPDGDD)
-- Corré esto en el SQL Editor de Supabase.

-- Columnas nuevas en nm_users
ALTER TABLE nm_users ADD COLUMN IF NOT EXISTS avatar_url text;
ALTER TABLE nm_users ADD COLUMN IF NOT EXISTS birth_date date;
ALTER TABLE nm_users ADD COLUMN IF NOT EXISTS dni_nie text;
ALTER TABLE nm_users ADD COLUMN IF NOT EXISTS padel_position text CHECK (padel_position IS NULL OR padel_position IN ('drive', 'reves', 'ambos'));
ALTER TABLE nm_users ADD COLUMN IF NOT EXISTS padel_level text;

-- Consentimientos GDPR: si el jugador acepta, podemos mostrar su imagen/video en la web
ALTER TABLE nm_users ADD COLUMN IF NOT EXISTS consent_image_use boolean;       -- uso de foto y video en web
ALTER TABLE nm_users ADD COLUMN IF NOT EXISTS consent_data_public boolean;     -- mostrar datos del jugador (nombre, categoría) en rankings públicos
ALTER TABLE nm_users ADD COLUMN IF NOT EXISTS consent_accepted_at timestamptz; -- cuándo firmó los consentimientos
ALTER TABLE nm_users ADD COLUMN IF NOT EXISTS consent_ip inet;                 -- IP desde la que firmó (evidencia)
ALTER TABLE nm_users ADD COLUMN IF NOT EXISTS profile_completed_at timestamptz;

COMMENT ON COLUMN nm_users.consent_image_use IS
  'TRUE = el jugador autoriza a usar su imagen (fotos/videos de partidos) en el sitio web y redes sociales del club. FALSE o NULL = solo uso interno.';
COMMENT ON COLUMN nm_users.consent_data_public IS
  'TRUE = el jugador autoriza a mostrar su nombre y categoría en rankings/ligas públicas. FALSE = visible solo para uso interno.';

-- Tabla de pedidos de ficha (un token por pedido, caduca en 30 días)
CREATE TABLE IF NOT EXISTS nm_profile_requests (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id uuid REFERENCES nm_users(id) ON DELETE CASCADE NOT NULL,
  token uuid DEFAULT gen_random_uuid() UNIQUE NOT NULL,
  channel text CHECK (channel IN ('email', 'whatsapp', 'manual', 'link')),
  created_by uuid REFERENCES nm_users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  sent_at timestamptz,
  completed_at timestamptz,
  expires_at timestamptz DEFAULT (now() + interval '30 days')
);

CREATE INDEX IF NOT EXISTS idx_nm_profile_requests_user ON nm_profile_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_nm_profile_requests_token ON nm_profile_requests(token);

ALTER TABLE nm_profile_requests ENABLE ROW LEVEL SECURITY;
-- Solo admin/service role puede leer/escribir. El endpoint público usa service_role con validación de token.
CREATE POLICY "admin_all" ON nm_profile_requests FOR ALL TO authenticated
  USING (nm_is_admin()) WITH CHECK (nm_is_admin());

-- Bucket para avatares (público de lectura)
INSERT INTO storage.buckets (id, name, public)
  VALUES ('avatars', 'avatars', true)
  ON CONFLICT (id) DO UPDATE SET public = true;

-- Política de lectura pública
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='avatars_public_read') THEN
    CREATE POLICY "avatars_public_read" ON storage.objects
      FOR SELECT USING (bucket_id = 'avatars');
  END IF;
END$$;

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE nm_profile_requests;
