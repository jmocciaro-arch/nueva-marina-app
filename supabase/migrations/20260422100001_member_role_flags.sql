-- ============================================================================
-- 021_member_role_flags.sql
-- Soporte de roles múltiples por persona (una misma persona puede ser
-- jugador + socio del gym + staff al mismo tiempo).
-- ============================================================================

-- 1) Flags nuevos en nm_club_members
ALTER TABLE nm_club_members ADD COLUMN IF NOT EXISTS is_player boolean DEFAULT false;
ALTER TABLE nm_club_members ADD COLUMN IF NOT EXISTS is_gym_member boolean DEFAULT false;
ALTER TABLE nm_club_members ADD COLUMN IF NOT EXISTS is_staff boolean DEFAULT false;
ALTER TABLE nm_club_members ADD COLUMN IF NOT EXISTS staff_role text;
-- staff_role: 'owner' | 'admin' | 'monitor' | 'camarero' | 'limpieza' | 'gestor' | 'vendedor' | 'coach'

COMMENT ON COLUMN nm_club_members.is_player IS
  'TRUE si la persona juega pádel (aparece en /admin/jugadores)';
COMMENT ON COLUMN nm_club_members.is_gym_member IS
  'TRUE si la persona es socio del gimnasio (aparece en /admin/gimnasio/socios)';
COMMENT ON COLUMN nm_club_members.is_staff IS
  'TRUE si la persona es personal del club (aparece en /admin/staff)';
COMMENT ON COLUMN nm_club_members.staff_role IS
  'Rol específico dentro del staff: monitor, camarero, limpieza, admin, gestor, vendedor, coach, owner';

-- ============================================================================
-- 2) Backfill: inicializar flags según el estado actual
-- ============================================================================

-- Todos los que tenían role='player' son jugadores
UPDATE nm_club_members SET is_player = true WHERE role = 'player';

-- Todos los que tienen una membresía de gym (activa o histórica) son socios gym
UPDATE nm_club_members cm SET is_gym_member = true
WHERE EXISTS (
  SELECT 1 FROM nm_gym_memberships gm WHERE gm.user_id = cm.user_id
);

-- Todos los que tienen role de staff/admin/owner/coach → is_staff + staff_role
UPDATE nm_club_members SET is_staff = true, staff_role = role
WHERE role IN ('owner', 'admin', 'staff', 'coach', 'manager_finanzas');

-- ============================================================================
-- 3) Indexes para queries rápidas por flag
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_members_is_player
  ON nm_club_members(club_id, is_player) WHERE is_player = true;
CREATE INDEX IF NOT EXISTS idx_members_is_gym
  ON nm_club_members(club_id, is_gym_member) WHERE is_gym_member = true;
CREATE INDEX IF NOT EXISTS idx_members_is_staff
  ON nm_club_members(club_id, is_staff) WHERE is_staff = true;

NOTIFY pgrst, 'reload schema';
