# 🔍 GAP ANALYSIS — JSON Master Spec vs Sistema Actual

Fecha: 2026-04-14
Objetivo: identificar qué del JSON Master Spec ya existe en el sistema Next.js+Supabase y qué falta implementar.

---

## Mapeo de entidades

| JSON Spec | Tabla existente | Estado | Gaps |
|---|---|---|---|
| `usuarios` | `nm_users` + `nm_player_profiles` | ✅ Parcial | Falta: `dni`, `current_weight`, `injuries jsonb` |
| `pistas` | `nm_courts` | ✅ Completo | — |
| `reservas` | `nm_bookings` | ✅ Parcial | Falta enforcement de reglas (máx 2/día, cancelación 4h) |
| `partidos` | `nm_matches` | ✅ Completo | Ya tiene `video_url`, sets, games, winner |
| `estadisticas` | `nm_player_profiles` + `nm_rankings` | ✅ Completo | Ya hay matches_played, wins, points, etc. |
| `videos` | `nm_videos` | ✅ Completo | Ya tiene `analysis jsonb`, `match_id` |
| `rutinas_gimnasio` | `nm_training_plans` + `nm_user_training_plans` + `nm_workouts` | ✅ Completo | — |
| `recuperacion` | **NO EXISTE** | ❌ Falta | Crear `nm_recovery_sessions` |
| `torneos` | `nm_tournaments` + 2 tablas | ✅ Completo | — |
| `ligas` | `nm_leagues` + 5 tablas | ✅ Completo | — |
| `logs` | `nm_audit_log` | ✅ Completo | — |

## Mapeo de roles

| JSON | Sistema actual | Mapeo |
|---|---|---|
| `admin` | `owner` + `admin` | ✅ |
| `staff` | `staff` | ✅ |
| `cliente` | `player` | ✅ |
| `jugador` | `player` con `nm_player_profiles` | ✅ (por tener perfil extendido) |
| `socio_gimnasio` | `player` con `nm_gym_memberships` activa | ✅ (derivado) |

**Conclusión**: no hace falta cambiar roles. Los privilegios de "jugador" vs "cliente" vs "socio_gimnasio" se derivan de la presencia del perfil de jugador o la membresía de gym.

## Mapeo de endpoints

| JSON endpoint | Ruta actual | Estado |
|---|---|---|
| `POST /login` | Supabase Auth directo (client) | ✅ |
| `POST /register` | `/api/users` POST | ✅ |
| `POST /refresh` | middleware refresh token | ✅ |
| `GET /pistas` | query directa a `nm_courts` desde client | ✅ |
| `POST /reservas` | insert a `nm_bookings` desde client (con RLS) | ✅ |
| `GET /reservas/mias` | query filtrada por `user_id` | ✅ |
| `PUT /reservas/:id/cancelar` | update a `nm_bookings.status` | ✅ |
| `GET /jugadores/:id` | query a `nm_users` + `nm_player_profiles` | ✅ |
| `GET /jugadores/:id/estadisticas` | derivado | ✅ |
| `GET /jugadores/:id/videos` | query a `nm_videos` | ✅ |
| `GET /rutinas/:id` | query a `nm_user_training_plans` | ✅ |
| `POST /rutinas` | insert a `nm_training_plans` | ✅ |
| `POST /recuperacion` | **FALTA** | ❌ |
| `POST /videos/upload` | Supabase Storage + `nm_videos` | ⚠️ no hay UI |
| `GET /videos/:jugador_id` | query existe | ✅ |
| `GET /torneos`, `POST /torneos` | `/admin/torneos` page | ✅ |
| `POST /torneos/:id/inscribir` | UI existe | ✅ |
| `GET /ligas`, `POST /ligas` | `/admin/ligas` page | ✅ |
| `POST /ligas/:id/resultados` | UI existe | ✅ |

## Reglas de negocio

| JSON rule | Implementada | Acción |
|---|---|---|
| Horarios 08:00–00:00 | ✅ (configurable en `nm_court_schedules`) | — |
| Precios 1h=12€ / 1.5h=18€ / 2h=22€ | ✅ (`nm_pricing_rules`) | — |
| Máx 2 turnos/día por usuario | ❌ | Agregar trigger + config |
| Cancelación hasta 4h antes | ❌ | Agregar validación + config |
| Staff puede reasignar pistas | ✅ (por RLS rol staff) | — |
| Cuadros automáticos torneos | ✅ | — |
| Ranking automático | ✅ (`nm_rankings`) | — |
| Playoffs en ligas | ✅ (`nm_league_playoff_matches`) | — |

## PWA

| Feature JSON | Estado | Acción |
|---|---|---|
| Service worker | ❌ | Crear `public/sw.js` |
| `manifest.json` | ❌ | Crear `public/manifest.json` |
| Cache offline: perfil, reservas, calendario, estadísticas, rutinas, videos_metadata | ❌ | Configurar en SW |
| Background sync | ❌ | Implementar en SW + queue en IndexedDB |
| Botón instalar | ❌ | Componente `<InstallPrompt/>` |

## Seguridad

| JSON | Estado |
|---|---|
| JWT auth | ✅ (Supabase) |
| bcrypt password | ✅ (Supabase) |
| HTTPS | ✅ (Vercel) |
| Rate limiting | ⚠️ Parcial (Vercel edge, no en app level) |
| Audit logs | ✅ (`nm_audit_log`) |
| Data encryption | ✅ (Supabase at-rest + TLS) |
| Offline sandbox | ❌ (no hay offline aún) |

---

## RESUMEN: qué hay que hacer

### Migración SQL 005
1. Columnas nuevas en `nm_users`: `dni`, `current_weight`, `injuries jsonb`
2. Tabla nueva: `nm_recovery_sessions` (crio/hidro/masaje)
3. Config: agregar keys `max_bookings_per_day`, `cancellation_hours_before` a `nm_pricing_config`
4. Trigger: enforcement de máx 2 reservas/día
5. Trigger o RLS: cancelación sólo si faltan ≥ 4h

### Páginas nuevas
- `/admin/recuperacion` — CRUD de sesiones de recuperación
- `/mi-recuperacion` — usuario reserva sesión de recuperación
- (opcional) `/admin/videos` y `/mis-videos` — UI de videos de partidos

### APIs nuevas
- `POST /api/recovery` — crear sesión de recuperación
- `GET /api/recovery/:user_id` — listar sesiones del usuario
- `POST /api/videos/upload` — subir video (Supabase Storage)

### PWA
- `public/manifest.json`
- `public/sw.js` con cache strategy + background sync
- `src/components/install-prompt.tsx`
- Registrar SW en `src/app/layout.tsx`

### Sidebar
- Admin: + "Recuperación" (icono Droplet)
- Player: + "Mi Recuperación" (icono Droplet)
