-- =====================================================
-- MIGRACIÓN 008 — Permisos alineados al Sidebar v3
-- Agrega claves con la nomenclatura del JSON del sidebar
-- y las mapea a los 6 roles existentes.
-- Mantiene las claves previas de 007 para no romper nada.
-- =====================================================

-- ========== 1) NUEVAS CLAVES (nomenclatura v3) ==========

INSERT INTO nm_permissions (key, module, description) VALUES
  -- Operación
  ('agenda.view',              'operacion', 'Ver agenda unificada'),

  -- Pádel & Sport
  ('padel.reservas',           'padel',     'Gestionar reservas de pádel'),

  -- Gym & Wellness
  ('gym.classes',              'gym',       'Clases y asistencias'),
  ('gym.memberships',          'gym',       'Membresías de gym'),

  -- Accesos
  ('access.points',            'access',    'Gestionar puntos de acceso'),
  ('access.credentials',       'access',    'Gestionar credenciales'),
  ('access.logs',              'access',    'Ver registro en vivo'),

  -- Comercial
  ('shop.manage',              'shop',      'Administrar tienda'),
  ('shop.categories',          'shop',      'Gestionar categorías'),
  ('shop.stock',               'shop',      'Stock y compras'),
  ('shop.pos',                 'shop',      'Punto de venta'),

  -- Finanzas
  ('cash.manage',              'cash',      'Administrar caja'),
  ('billing.manage',           'billing',   'Administrar facturación'),
  ('subscriptions.manage',     'billing',   'Administrar suscripciones'),
  ('finance.reconcile',        'finance',   'Conciliación bancaria/caja'),

  -- Personas
  ('users.manage',             'users',     'Administrar usuarios'),
  ('members.manage',           'users',     'Administrar miembros del club'),
  ('staff.manage',             'users',     'Administrar staff y turnos'),
  ('coaches.manage',           'users',     'Administrar entrenadores'),

  -- Comunidad
  ('community.feed',           'community', 'Gestionar feed'),
  ('community.challenges',     'community', 'Gestionar retos y badges'),

  -- Reportes
  ('reports.operational',      'reports',   'Reportes operativos'),
  ('reports.financial',        'reports',   'Reportes financieros'),

  -- Configuración
  ('config.club',              'config',    'Datos del club'),
  ('config.modules',           'config',    'Módulos activos'),
  ('config.roles',             'config',    'Roles y permisos'),
  ('config.integrations',      'config',    'Integraciones externas'),
  ('config.audit',             'config',    'Auditoría')
ON CONFLICT (key) DO NOTHING;

-- ========== 2) ASIGNAR A ROLES ==========

-- OWNER + ADMIN: todas las nuevas claves
INSERT INTO nm_role_permissions (role_id, permission_key)
SELECT r.id, p.key
FROM nm_roles r
CROSS JOIN nm_permissions p
WHERE r.club_id = 1
  AND r.slug IN ('owner','admin')
  AND p.key IN (
    'agenda.view','padel.reservas','gym.classes','gym.memberships',
    'access.points','access.credentials','access.logs',
    'shop.manage','shop.categories','shop.stock','shop.pos',
    'cash.manage','billing.manage','subscriptions.manage','finance.reconcile',
    'users.manage','members.manage','staff.manage','coaches.manage',
    'community.feed','community.challenges',
    'reports.operational','reports.financial',
    'config.club','config.modules','config.integrations','config.audit'
  )
ON CONFLICT (role_id, permission_key) DO NOTHING;

-- OWNER además puede gestionar roles
INSERT INTO nm_role_permissions (role_id, permission_key)
SELECT r.id, 'config.roles'
FROM nm_roles r WHERE r.club_id = 1 AND r.slug = 'owner'
ON CONFLICT DO NOTHING;

-- MANAGER_FINANZAS
INSERT INTO nm_role_permissions (role_id, permission_key)
SELECT r.id, unnest(ARRAY[
  'agenda.view',
  'cash.manage','billing.manage','subscriptions.manage','finance.reconcile',
  'shop.manage','shop.categories','shop.stock','shop.pos',
  'reports.operational','reports.financial',
  'members.manage',
  'config.club'
])
FROM nm_roles r WHERE r.club_id = 1 AND r.slug = 'manager_finanzas'
ON CONFLICT DO NOTHING;

-- COACH
INSERT INTO nm_role_permissions (role_id, permission_key)
SELECT r.id, unnest(ARRAY[
  'agenda.view',
  'gym.classes','gym.memberships',
  'access.credentials',
  'community.feed','community.challenges',
  'members.manage'
])
FROM nm_roles r WHERE r.club_id = 1 AND r.slug = 'coach'
ON CONFLICT DO NOTHING;

-- RECEPTION
INSERT INTO nm_role_permissions (role_id, permission_key)
SELECT r.id, unnest(ARRAY[
  'agenda.view',
  'padel.reservas',
  'cash.manage',
  'shop.manage','shop.pos',
  'access.credentials','access.logs',
  'users.manage','members.manage'
])
FROM nm_roles r WHERE r.club_id = 1 AND r.slug = 'reception'
ON CONFLICT DO NOTHING;

-- PLAYER: ninguna de estas claves (es solo UI admin)

-- ========== FIN MIGRACIÓN 008 ==========
