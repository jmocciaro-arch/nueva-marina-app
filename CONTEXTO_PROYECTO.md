# NUEVA MARINA PADEL & SPORT — Contexto completo del proyecto

## Info general
- **App:** Nueva Marina Padel & Sport — plataforma completa de gestion de club deportivo (padel + gimnasio + tienda + comunidad)
- **Cliente:** FALTA ENVIDO SL (Espana)
- **Dominio:** https://www.nuevamarina.es/
- **Deploy:** Vercel → https://nueva-marina-app.vercel.app
- **Repo local:** `/Users/juanmanueljesusmocciaro/nueva-marina-app`

---

## Datos de acceso

### Supabase (base de datos + auth)
- **URL:** https://vsgrwnfjzmovmnxjzkea.supabase.co
- **Dashboard:** https://supabase.com/dashboard/project/vsgrwnfjzmovmnxjzkea
- **Org:** Nueva Marina (plan FREE)
- **Region:** West EU (Ireland)

### Admins del sistema
- **JMJM:** faltaenvidosl@gmail.com / 009413 (propietario)
- **Chris:** nuevamarina.padel@gmail.com / 001010 (admin)

### Vercel (deploy)
- **Cuenta:** jmocciaro-3358
- **Proyecto:** nueva-marina-app
- **URL prod:** https://nueva-marina-app.vercel.app

### WebEmpresa (hosting WordPress)
- **Panel cPanel:** https://cp7120.webempresa.eu:2443/
- **Usuario cPanel:** eppindus
- **IP servidor:** 213.158.86.61
- **Gestor de Archivos, FTP, DNS disponibles**

### WordPress (nuevamarina.es)
- **Admin:** https://www.nuevamarina.es/wp-admin/
- **Usuario WP:** autopackswe
- **Plugins activos:** WooCommerce, Yoast SEO

### Email del club
- **Email confirmaciones:** nuevamarina.padel@gmail.com

### Usuario del desarrollador
- **Email:** jmocciaro@gmail.com

---

## Tech Stack

| Tecnologia | Version | Uso |
|------------|---------|-----|
| Next.js | 16.2.3 | Framework (App Router) |
| React | 19.2.4 | UI |
| TypeScript | strict | Tipado |
| Tailwind CSS | v4 | Estilos |
| Supabase | latest | DB + Auth + RLS + Realtime |
| Recharts | 3.8.1 | Graficos |
| jsPDF | 4.2.1 | PDF facturas |
| qrcode.react | 4.2.0 | Codigos QR acceso |
| lucide-react | 1.8.0 | Iconos |
| xlsx | 0.18.5 | Import/export Excel |
| react-google-recaptcha-v3 | 1.11.0 | Captcha login |

---

## Numeros del proyecto

- **54 paginas** (29 admin + 18 player + 5 publicas + 2 especiales)
- **22 API routes**
- **18 componentes** (8 UI base + 10 feature)
- **3 hooks** custom
- **161 archivos** TypeScript/TSX
- **~40,500 lineas** de codigo total
- **~108 tablas** en la DB
- **16 migraciones** SQL

---

## Estructura de archivos completa

### Paginas Admin (`src/app/(admin)/admin/`)

| Archivo | Lineas | Descripcion |
|---------|--------|-------------|
| `page.tsx` | 1252 | Dashboard admin — full editable: 26 KPIs, 12 live widgets, 15 quick actions, galeria de widgets, tema personalizable |
| `reservas/page.tsx` | ~400 | Gestion de reservas con grilla visual tipo calendario |
| `caja/page.tsx` | ~500 | Caja registradora diaria — ingresos/gastos/metodos de pago |
| `torneos/page.tsx` | ~400 | Listado de torneos con filtros por estado |
| `torneos/[id]/page.tsx` | ~700 | Detalle de torneo — equipos, bracket visual, resultados |
| `torneos/[id]/pantalla/page.tsx` | ~300 | Configuracion de pantalla TV para brackets |
| `ligas/page.tsx` | ~400 | Listado de ligas con filtros |
| `ligas/[id]/page.tsx` | ~963 | Detalle de liga — categorias, equipos, jornadas, match grid, vinculacion jugadores |
| `ligas/importar/page.tsx` | ~300 | Importar liga desde Excel |
| `gimnasio/page.tsx` | 1851 | 4 tabs: Membresias, Clases, Sesiones, Control de Personal |
| `staff/page.tsx` | 1975 | 6 tabs: Panel, Turnos, Caja, Stock, Horarios, Credenciales |
| `tienda/page.tsx` | ~500 | Productos y categorias — ABM completo |
| `accesos/page.tsx` | ~600 | Puntos de acceso, credenciales, logs de entrada/salida |
| `facturacion/page.tsx` | ~800 | 4 tabs: Planes, Suscripciones, Facturas, Bonos |
| `entrenamiento/page.tsx` | ~400 | Planes de entrenamiento y asignaciones |
| `recuperacion/page.tsx` | ~400 | Sesiones de recuperacion deportiva |
| `comunidad/page.tsx` | ~400 | Feed social admin — posts, likes, fijar publicaciones |
| `retos/page.tsx` | ~500 | Challenges y badges — gamificacion |
| `reportes/page.tsx` | ~400 | Reportes financieros y operativos por periodo |
| `usuarios/page.tsx` | ~500 | ABM de usuarios — roles, reset password |
| `jugadores/page.tsx` | ~300 | Miembros del club — roles, estados |
| `pistas/page.tsx` | ~400 | Config de pistas y horarios por dia |
| `precios/page.tsx` | ~800 | Sistema de pricing — 7 tabs (tarifas, franjas, bonos, temporadas, descuentos, pistas, config) |
| `pricing/page.tsx` | ~300 | Pricing unificado por scopes |
| `innovacion/page.tsx` | ~400 | Buzon de ideas — workflow de estados |
| `importar/page.tsx` | ~400 | Import CSV Virtuagym — wizard 4 pasos |
| `config/page.tsx` | ~300 | Config general del club |
| `config/modulos/page.tsx` | ~200 | Toggle de modulos activos |
| `config/roles/page.tsx` | ~400 | Gestion de roles y permisos |

### Paginas Player (`src/app/(app)/`)

| Archivo | Lineas | Descripcion |
|---------|--------|-------------|
| `dashboard/page.tsx` | 1012 | Dashboard player — full editable: 16 KPIs, 10 live widgets, 14 quick actions, tema |
| `mis-reservas/page.tsx` | ~400 | 2 tabs: Calendario (grilla) + Mis proximas |
| `mis-partidos/page.tsx` | ~300 | 2 tabs: Proximos + Historial con scores set por set |
| `buscar-partido/page.tsx` | ~300 | Partidos abiertos para unirse + crear partido |
| `mis-torneos/page.tsx` | ~400 | 2 tabs: Disponibles + Inscripciones |
| `mis-ligas/page.tsx` | ~350 | 2 tabs: Disponibles + Mis Ligas |
| `ranking/page.tsx` | ~300 | Podio top 3 + tabla ranking completa |
| `gimnasio/page.tsx` | ~350 | Membresia + clases + sesiones |
| `mi-entrenamiento/page.tsx` | ~250 | Plan de entrenamiento asignado |
| `mi-recuperacion/page.tsx` | ~300 | Solicitar/ver sesiones de recuperacion |
| `comunidad/page.tsx` | ~300 | Feed social — posts, likes, publicar |
| `retos/page.tsx` | ~350 | Retos activos + badges ganados |
| `mi-ficha/page.tsx` | ~500 | Formulario GDPR completo + avatar upload |
| `mi-suscripcion/page.tsx` | ~400 | Plan + creditos + facturas |
| `mi-acceso/page.tsx` | ~350 | QR personal + historial accesos |
| `tienda/page.tsx` | ~300 | Catalogo productos + solicitar |
| `perfil/page.tsx` | ~500 | 3 secciones: datos personales, atleta, padel |
| `notificaciones/page.tsx` | ~250 | Lista notificaciones + marcar leidas |

### Paginas Publicas (sin auth)

| Archivo | Descripcion |
|---------|-------------|
| `fichaje/page.tsx` (704 lineas) | Terminal kiosk staff — PIN/NFC/huella/facial |
| `torneo/[id]/page.tsx` | Bracket publico de torneo |
| `torneo/[id]/live/page.tsx` | Modo TV en vivo para torneos |
| `liga/[id]/page.tsx` | Liga publica — posiciones + match grid |
| `login/page.tsx` | Login + registro |
| `perfil/[token]/page.tsx` | Completar ficha por link |

### API Routes (`src/app/api/`)

| Ruta | Metodo | Descripcion |
|------|--------|-------------|
| `/api/access/qr/generate` | POST | Generar QR de acceso |
| `/api/access/relay` | POST | Senal al molinete/relay |
| `/api/access/validate` | POST | Validar credencial de acceso |
| `/api/auth/callback` | GET | OAuth callback |
| `/api/billing/generate-invoices` | POST | Generar facturas automaticas |
| `/api/billing/invoice-pdf` | GET | Generar PDF de factura |
| `/api/cron/daily` | GET | Tarea diaria (facturas, suscripciones, credenciales) |
| `/api/dashboard/config` | GET/POST | Config dashboard por usuario |
| `/api/import/liga` | POST | Importar liga desde Excel |
| `/api/import/virtuagym` | POST | Importar usuarios desde CSV Virtuagym |
| `/api/ligas/[id]/export` | GET | Exportar liga a Excel |
| `/api/ligas/template` | GET | Template Excel para ligas |
| `/api/profile/request` | POST | Solicitar completar ficha |
| `/api/profile/token/[token]` | GET/POST | Ficha por token |
| `/api/public/liga/[id]` | GET | API publica liga (sin auth) |
| `/api/staff/auth` | POST/PUT | Auth staff (PIN/NFC/huella/facial) + registrar credencial |
| `/api/staff/cash-closing` | GET/POST | Cierre de caja |
| `/api/staff/handover` | GET/POST | Cambio de turno |
| `/api/staff/stock-snapshot` | GET/POST | Snapshot de inventario |
| `/api/torneos/[id]/bracket` | GET/POST | API bracket torneo |
| `/api/users` | GET/POST | CRUD usuarios |
| `/api/users/password` | POST | Reset password |

### Componentes (`src/components/`)

| Archivo | Lineas | Descripcion |
|---------|--------|-------------|
| `tournament-bracket.tsx` | 1426 | Bracket visual — 5 vistas (tree/table/cards/compact/timeline), 4 temas (dark/neon/classic/padel), config panel |
| `league-match-grid.tsx` | 563 | Grid de partidos de liga — 3 vistas (matrix/rounds/timeline) |
| `dashboard-editor.tsx` | 503 | Editor avanzado de dashboard — galeria widgets, temas, quick actions |
| `booking-grid.tsx` | ~400 | Grilla visual de reservas por pista/horario |
| `booking-modal.tsx` | ~300 | Modal crear/editar reserva |
| `post-card.tsx` | ~150 | Card de publicacion social |
| `qr-code.tsx` | ~100 | QRCodeDisplay component |
| `pwa-register.tsx` | ~50 | Registro service worker PWA |
| **UI base:** | | |
| `ui/badge.tsx` | ~60 | Badge con variants: default/success/warning/danger/info/cyan |
| `ui/button.tsx` | ~80 | Button con variants: primary/secondary/danger/ghost/outline + sizes: sm/md/lg |
| `ui/card.tsx` | ~30 | Card dark (bg-slate-900 border-slate-800) |
| `ui/input.tsx` | ~50 | Input dark styled |
| `ui/kpi-card.tsx` | ~60 | KPI card con icono, titulo, valor, color |
| `ui/modal.tsx` | ~80 | Modal overlay con sizes: sm/md/lg/xl |
| `ui/select.tsx` | ~50 | Select dark styled |
| `ui/sidebar.tsx` | ~350 | Sidebar responsive con permisos por rol |
| `ui/toast.tsx` | ~100 | Toast notifications (success/error/info) |
| `ui/topbar.tsx` | ~150 | Topbar con notificaciones y menu usuario |

### Hooks (`src/hooks/`)

| Archivo | Descripcion |
|---------|-------------|
| `use-price-lookup.ts` | Buscar precio segun reglas de pricing |
| `use-pricing-rules.ts` | CRUD reglas de pricing |
| `use-realtime-refresh.ts` | Refrescar datos con Supabase Realtime |

### Lib (`src/lib/`)

| Archivo | Descripcion |
|---------|-------------|
| `auth-context.tsx` | AuthProvider + useAuth hook (user, role, loading) |
| `use-permissions.ts` | Hook de permisos por rol |
| `utils.ts` | formatDate, formatCurrency, cn (classnames) |
| `api/pricing.ts` | lookupPrice server-side |
| `supabase/client.ts` | Supabase browser client |
| `supabase/server.ts` | Supabase server client |
| `supabase/middleware.ts` | Auth middleware |

---

## Migraciones SQL (`supabase/`)

| Archivo | Contenido |
|---------|-----------|
| `001_initial_schema.sql` | Schema inicial: users, clubs, courts, bookings, cash, access, gym, tournaments, leagues, etc. |
| `002_virtuagym_expansion.sql` | Expansion para importacion Virtuagym |
| `003_pricing_rules.sql` | Reglas de precio |
| `004_pricing_extended.sql` | Pricing extendido (franjas, temporadas, descuentos) |
| `005_recuperacion_business_rules.sql` | Reglas de negocio recuperacion |
| `006_architecture_v3.sql` | Arquitectura v3 (refactor tablas) |
| `007_roles_permissions_seed.sql` | Seed roles y permisos |
| `008_permissions_v3_sidebar.sql` | Permisos v3 con sidebar |
| `009_price_rules_align.sql` | Alineacion price rules |
| `010_bookings_price_rule.sql` | Price rule para bookings |
| `011_gym_recovery_price_rule.sql` | Price rule para gym/recuperacion |
| `012_realtime_ligas.sql` | Realtime para ligas |
| `013_player_profiles_gdpr.sql` | Perfiles GDPR/LOPDGDD |
| `014_notifications_triggers.sql` | Triggers de notificaciones |
| `015_bracket_system.sql` | Sistema de brackets para torneos |
| `016_staff_control_dashboards.sql` | Staff control + dashboards editables (9 tablas nuevas, triggers, RLS) |

---

## Patrones del codigo

### Imports estandar
```tsx
'use client'
import { useAuth } from '@/lib/auth-context'
import { createClient } from '@/lib/supabase/client'
import { KpiCard } from '@/components/ui/kpi-card'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Modal } from '@/components/ui/modal'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { useToast } from '@/components/ui/toast'
import { formatDate, formatCurrency } from '@/lib/utils'
import Link from 'next/link'
```

### Toast
```tsx
const { toast } = useToast()
toast('success', 'Guardado correctamente')
toast('error', 'Error al guardar')
toast('info', 'Informacion')
```

### Supabase queries
```tsx
const supabase = createClient()
const { data, error, count } = await supabase
  .from('nm_tabla')
  .select('*', { count: 'exact' })
  .eq('campo', valor)
  .order('created_at', { ascending: false })
  .limit(10)
```

### Reglas estrictas
- **NUNCA** poner `supabase` como dependencia de `useCallback`
- **NUNCA** poner `return` antes de hooks
- Terminar y seguir sin pedir confirmacion, solo parar si hay blocker
- Responder siempre en **espanol rioplatense** (voseo)

---

## Roles y permisos

| Rol | Admin | Player | Descripcion |
|-----|-------|--------|-------------|
| Propietario | Todo | Todo | Control total |
| Administrador | Casi todo | Todo | Gestion operativa |
| Staff | Reservas + Caja | Su perfil | Recepcion, mantenimiento |
| Entrenador | Entrenamiento | Su perfil | Planes de entrenamiento |
| Jugador | Nada | Todo player | Socio regular |
| Invitado | Nada | Limitado | Acceso basico |

---

## URLs publicas (sin auth requerido)

- `/liga/[id]` — usa `/api/public/liga/[id]`
- `/torneo/[id]` — pagina publica del torneo
- `/torneo/[id]/live` — modo TV en vivo
- `/fichaje` — terminal kiosk staff
- `/login` — login/registro
- `/perfil/[token]` — completar ficha por link

---

## Estado actual

- **Build:** PASA LIMPIO (`tsc --noEmit` + `npm run build`)
- **Ultimo commit:** `feat: dashboards editables, staff control, fichaje, liga publica, manual`
- **Archivos extra en raiz:**
  - `MANUAL_USUARIO.md` — Manual de usuario completo (45 secciones, 31 videos sugeridos)
  - `CONTEXTO_PROYECTO.md` — Este archivo

---

## Colores y tema

- **Fondo:** slate-950 (#0a0a23) / slate-900 (#0f172a)
- **Acento principal:** cyan-500 (#06b6d4)
- **Acento secundario:** lime/verde (#ccff00) en fichaje
- **Cards:** bg-slate-900 border-slate-800
- **Texto:** white / slate-400 / slate-500
- **Exito:** emerald-500 (#10b981)
- **Error:** red-500 (#ef4444)
- **Warning:** amber-500 (#f59e0b)
- **Info:** cyan-400 (#22d3ee)
