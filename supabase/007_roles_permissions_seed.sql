-- =====================================================
-- MIGRACIÓN 007 — Seed de Roles y Permisos (v3)
-- 6 roles: owner · admin · manager_finanzas · coach · reception · player
-- Matriz completa de permisos por módulo
-- =====================================================

-- ========== 1) CATÁLOGO DE PERMISOS ==========

INSERT INTO nm_permissions (key, module, description) VALUES
  -- Dashboard / Reportes
  ('dashboard.view',              'dashboard', 'Ver dashboard general'),
  ('reports.view',                'reports',   'Ver reportes'),
  ('reports.export',              'reports',   'Exportar reportes (CSV/PDF)'),

  -- Reservas pádel
  ('bookings.view',               'padel',     'Ver reservas'),
  ('bookings.create',             'padel',     'Crear reservas'),
  ('bookings.edit',               'padel',     'Editar reservas'),
  ('bookings.cancel',             'padel',     'Cancelar reservas'),
  ('bookings.override_rules',     'padel',     'Saltar reglas (cancelación, máx/día)'),

  -- Caja
  ('cash.view',                   'cash',      'Ver caja'),
  ('cash.create_movement',        'cash',      'Registrar movimiento'),
  ('cash.open_shift',             'cash',      'Abrir turno'),
  ('cash.close_shift',            'cash',      'Cerrar turno'),
  ('cash.reconcile',              'cash',      'Conciliar diferencias'),
  ('cash.delete_movement',        'cash',      'Borrar movimiento'),

  -- Usuarios / Staff
  ('users.view',                  'users',     'Ver usuarios'),
  ('users.create',                'users',     'Crear usuario'),
  ('users.edit',                  'users',     'Editar usuario'),
  ('users.delete',                'users',     'Borrar usuario'),
  ('users.assign_role',           'users',     'Asignar rol'),
  ('users.view_medical',          'users',     'Ver datos médicos/lesiones'),

  -- Pistas
  ('courts.view',                 'courts',    'Ver pistas'),
  ('courts.manage',                'courts',   'Gestionar pistas y horarios'),

  -- Torneos / Ligas / Ranking
  ('tournaments.view',            'tournaments','Ver torneos'),
  ('tournaments.manage',          'tournaments','Gestionar torneos'),
  ('leagues.view',                'leagues',   'Ver ligas'),
  ('leagues.manage',              'leagues',   'Gestionar ligas'),
  ('ranking.view',                'ranking',   'Ver ranking'),
  ('ranking.manage',              'ranking',   'Ajustar ranking'),

  -- Gimnasio / Entrenamiento
  ('gym.view',                    'gym',       'Ver gimnasio'),
  ('gym.manage_classes',          'gym',       'Gestionar clases'),
  ('gym.manage_memberships',      'gym',       'Gestionar abonos'),
  ('training.view',               'training',  'Ver planes entrenamiento'),
  ('training.assign',             'training',  'Asignar planes a atletas'),
  ('training.manage',             'training',  'Crear/editar planes'),

  -- Recuperación
  ('recovery.view',               'recovery',  'Ver sesiones recuperación'),
  ('recovery.book',               'recovery',  'Reservar sesión'),
  ('recovery.manage',             'recovery',  'Gestionar sesiones'),

  -- Tienda / Bar
  ('shop.view',                   'shop',      'Ver tienda'),
  ('shop.sell',                   'shop',      'Registrar venta'),
  ('shop.manage_products',        'shop',      'Gestionar productos'),
  ('shop.manage_categories',      'shop',      'Gestionar categorías'),

  -- Pricing
  ('pricing.view',                'pricing',   'Ver reglas de precios'),
  ('pricing.manage',              'pricing',   'Crear/editar reglas de precios'),

  -- Control de acceso
  ('access.view_logs',            'access',    'Ver registro de accesos'),
  ('access.manage_points',        'access',    'Gestionar puntos de acceso'),
  ('access.manage_credentials',   'access',    'Gestionar credenciales'),
  ('access.generate_qr',          'access',    'Generar QR propio'),
  ('access.validate',             'access',    'Validar paso por molinete'),

  -- Innovación / Comunidad
  ('innovation.view',             'innovation','Ver ideas'),
  ('innovation.submit',           'innovation','Enviar idea'),
  ('innovation.moderate',         'innovation','Moderar ideas'),
  ('community.view',              'community', 'Ver feed'),
  ('community.post',              'community', 'Publicar'),
  ('community.moderate',          'community', 'Moderar posts/comentarios'),

  -- Configuración
  ('config.view',                 'config',    'Ver configuración'),
  ('config.manage_club',          'config',    'Editar datos del club'),
  ('config.manage_modules',       'config',    'Habilitar/deshabilitar módulos'),
  ('config.manage_integrations',  'config',    'Configurar integraciones externas'),
  ('config.manage_roles',         'config',    'Gestionar roles y permisos'),

  -- Perfil propio
  ('profile.view_own',            'profile',   'Ver perfil propio'),
  ('profile.edit_own',            'profile',   'Editar perfil propio')
ON CONFLICT (key) DO NOTHING;

-- ========== 2) ROLES DE SISTEMA (por club_id=1) ==========

INSERT INTO nm_roles (club_id, name, slug, is_system) VALUES
  (1, 'Owner',             'owner',             true),
  (1, 'Admin',             'admin',             true),
  (1, 'Manager Finanzas',  'manager_finanzas',  true),
  (1, 'Coach',             'coach',             true),
  (1, 'Recepción',         'reception',         true),
  (1, 'Player',            'player',            true)
ON CONFLICT (club_id, slug) DO NOTHING;

-- ========== 3) MATRIZ DE PERMISOS ==========

-- Helper: limpiar asignaciones previas de estos roles (idempotencia)
DELETE FROM nm_role_permissions
WHERE role_id IN (SELECT id FROM nm_roles WHERE club_id = 1 AND slug IN
  ('owner','admin','manager_finanzas','coach','reception','player'));

-- OWNER: TODO
INSERT INTO nm_role_permissions (role_id, permission_key)
SELECT r.id, p.key
FROM nm_roles r CROSS JOIN nm_permissions p
WHERE r.club_id = 1 AND r.slug = 'owner';

-- ADMIN: TODO excepto config.manage_roles (solo owner cambia roles del sistema)
INSERT INTO nm_role_permissions (role_id, permission_key)
SELECT r.id, p.key
FROM nm_roles r CROSS JOIN nm_permissions p
WHERE r.club_id = 1 AND r.slug = 'admin'
  AND p.key NOT IN ('config.manage_roles');

-- MANAGER FINANZAS
INSERT INTO nm_role_permissions (role_id, permission_key)
SELECT r.id, unnest(ARRAY[
  'dashboard.view','reports.view','reports.export',
  'cash.view','cash.create_movement','cash.open_shift','cash.close_shift','cash.reconcile','cash.delete_movement',
  'pricing.view','pricing.manage',
  'shop.view','shop.sell','shop.manage_products','shop.manage_categories',
  'users.view',
  'bookings.view','gym.view','recovery.view',
  'profile.view_own','profile.edit_own'
])
FROM nm_roles r WHERE r.club_id = 1 AND r.slug = 'manager_finanzas';

-- COACH
INSERT INTO nm_role_permissions (role_id, permission_key)
SELECT r.id, unnest(ARRAY[
  'dashboard.view',
  'users.view','users.view_medical',
  'bookings.view','bookings.create',
  'gym.view','gym.manage_classes',
  'training.view','training.assign','training.manage',
  'recovery.view','recovery.book','recovery.manage',
  'ranking.view','tournaments.view','leagues.view',
  'access.generate_qr','access.validate',
  'community.view','community.post',
  'profile.view_own','profile.edit_own'
])
FROM nm_roles r WHERE r.club_id = 1 AND r.slug = 'coach';

-- RECEPTION
INSERT INTO nm_role_permissions (role_id, permission_key)
SELECT r.id, unnest(ARRAY[
  'dashboard.view',
  'users.view','users.create','users.edit',
  'bookings.view','bookings.create','bookings.edit','bookings.cancel',
  'cash.view','cash.create_movement','cash.open_shift','cash.close_shift',
  'shop.view','shop.sell',
  'gym.view','recovery.view','recovery.book',
  'tournaments.view','leagues.view','ranking.view',
  'access.view_logs','access.manage_credentials','access.validate',
  'courts.view',
  'profile.view_own','profile.edit_own'
])
FROM nm_roles r WHERE r.club_id = 1 AND r.slug = 'reception';

-- PLAYER
INSERT INTO nm_role_permissions (role_id, permission_key)
SELECT r.id, unnest(ARRAY[
  'dashboard.view',
  'bookings.view','bookings.create','bookings.cancel',
  'gym.view',
  'recovery.view','recovery.book',
  'training.view',
  'tournaments.view','leagues.view','ranking.view',
  'shop.view',
  'access.generate_qr',
  'community.view','community.post',
  'innovation.view','innovation.submit',
  'profile.view_own','profile.edit_own'
])
FROM nm_roles r WHERE r.club_id = 1 AND r.slug = 'player';

-- ========== 4) ACTUALIZAR nm_is_admin PARA INCLUIR NUEVOS ROLES ==========
-- (owner + admin + manager_finanzas tienen acceso admin a políticas existentes;
--  coach y reception solo por permiso granular vía nm_has_permission)

CREATE OR REPLACE FUNCTION nm_is_admin()
RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1 FROM nm_club_members
    WHERE user_id = auth.uid()
      AND is_active = true
      AND role IN ('owner','admin','manager_finanzas')
  );
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- Helper adicional: verificar rol específico
CREATE OR REPLACE FUNCTION nm_has_role(p_slug text)
RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1 FROM nm_club_members
    WHERE user_id = auth.uid() AND is_active = true AND role = p_slug
  );
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- ========== FIN MIGRACIÓN 007 ==========
