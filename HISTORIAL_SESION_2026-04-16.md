# Historial de sesion — 16/17 abril 2026

## Resumen ejecutivo
Sesion larga donde se implementaron 3 grandes bloques de funcionalidad: (1) sistema visual de brackets/vistas para torneos y ligas, (2) control completo de staff con fichaje, cierre de caja, stock y credenciales multi-metodo, (3) dashboards totalmente editables y personalizables por usuario. Al final se genero un manual de usuario completo y archivos de contexto del proyecto. En la continuacion del 17/04 se agrego el modulo de **Analisis IA de partidos por video** (bloque 7) — el ultimo componente del blueprint de producto que faltaba, con pipeline mock listo para enchufar proveedor real.

---

## Cambios realizados (en orden cronologico)

### BLOQUE 1: Brackets de torneos — vistas multiples y configuracion

**Archivos creados/modificados:**

1. **`src/components/tournament-bracket.tsx`** — REESCRITO (~1426 lineas)
   - 5 modos de vista: tree (SVG), table, cards, compact, timeline
   - 4 temas: dark, neon, classic, padel
   - BracketConfigPanel: botones de vista, temas, tamano, 6 toggles
   - Exports: TournamentBracket, BracketConfigPanel, BracketConfig, BracketViewMode, BracketTheme, BracketCardSize

2. **`src/app/(admin)/admin/torneos/[id]/page.tsx`** — MODIFICADO
   - Agregado BracketConfigPanel + config state
   - Header con 4 botones: status, Publico, TV en Vivo, Configurar

3. **`src/app/torneo/[id]/page.tsx`** — MODIFICADO
   - Agregado BracketConfigPanel + config prop

4. **`src/app/torneo/[id]/live/page.tsx`** — MODIFICADO
   - Config panel colapsable, soporte URL query params (?theme=neon&cycle=10)
   - Auto-cycle interval configurable

5. **`src/app/(admin)/admin/torneos/[id]/pantalla/page.tsx`** — NUEVO
   - Pagina de configuracion de pantalla TV para admins
   - 8 secciones de config + URL compartible con query params

6. **`src/app/(admin)/admin/torneos/[id]/pantalla/layout.tsx`** — NUEVO
   - Layout con metadata

---

### BLOQUE 2: Control de staff, fichaje, cierre de caja, stock

**Migracion SQL:**

7. **`supabase/016_staff_control_dashboards.sql`** — NUEVO (~300+ lineas)
   - 9 tablas nuevas: nm_dashboard_configs, nm_dashboard_widgets, nm_staff_credentials, nm_cash_closings, nm_stock_snapshots, nm_shift_handovers, nm_gym_access_logs, nm_gym_staff_activity, nm_staff_time_summary
   - ALTER TABLE nm_staff_shifts: auth_method, shift_type, break_start/end, net_minutes, overtime, approved_by
   - nm_cash_closings con columnas GENERATED para diferencias
   - 3 triggers: net_minutes, gym_access_duration, gym_activity_log
   - RLS policies para las 9 tablas
   - 36 seed widgets (25 admin, 11 player)
   - Realtime habilitado para shifts, cash_closings, gym_access_logs

**API Routes:**

8. **`src/app/api/staff/auth/route.ts`** — NUEVO
   - POST: autenticar staff via PIN (SHA-256), NFC, huella, facial
   - Acciones: clock_in, clock_out, break_start, break_end
   - PUT: registrar credencial nueva (admin-only)

9. **`src/app/api/staff/cash-closing/route.ts`** — NUEVO
   - GET: calcular totales esperados desde nm_cash_register
   - POST: crear cierre de caja con esperado vs real

10. **`src/app/api/staff/stock-snapshot/route.ts`** — NUEVO
    - GET: cargar productos activos con stock actual
    - POST: guardar snapshot + auto-actualizar stock en nm_products

11. **`src/app/api/staff/handover/route.ts`** — NUEVO
    - POST: crear cambio de turno + cerrar turno saliente
    - GET: historial de handovers por fecha

12. **`src/app/api/dashboard/config/route.ts`** — NUEVO
    - GET: config del usuario + widgets disponibles
    - POST: upsert config dashboard

**Paginas:**

13. **`src/app/(admin)/admin/staff/page.tsx`** — REESCRITO COMPLETO (~1975 lineas)
    - 6 tabs: Panel de Control, Turnos del Dia, Cierre de Caja, Control Stock, Horarios Semanales, Credenciales
    - Panel: 4 KPIs, strip de staff activo con timers en vivo, timeline
    - Turnos: navegacion por fecha, 6 KPIs, tabla con acciones
    - Cierre de Caja: modal con esperado vs real por metodo de pago
    - Stock: snapshot modal, historial
    - Horarios: grilla visual semanal con barras por rol
    - Credenciales: tabla con status PIN/NFC/Huella/Facial
    - Wizard cierre de turno: 5 pasos (resumen, caja, stock, checklist, notas)

14. **`src/app/fichaje/page.tsx`** — NUEVO (~704 lineas)
    - Terminal kiosk fullscreen para fichaje de staff
    - 4 metodos auth: PIN (teclado numerico), NFC, Huella, Facial
    - Flujo: select_method → enter_credential → select_action → result
    - Reloj en vivo, auto-retorno a inicio en 5 segundos
    - Inactividad: timeout 30s en estados intermedios

15. **`src/app/fichaje/layout.tsx`** — NUEVO
    - Layout sin sidebar/header, fondo oscuro

16. **`src/app/(admin)/admin/gimnasio/page.tsx`** — MODIFICADO (~1851 lineas)
    - Agregado 4to tab "Control de Personal"
    - Personal presente con timers en vivo
    - Accesos del dia con KPIs y tabla
    - Actividad del staff con colores por accion
    - Formulario de registro de acceso manual

---

### BLOQUE 3: Dashboards editables — primera version

**Componente:**

17. **`src/components/dashboard-editor.tsx`** — NUEVO (~503 lineas)
    - DashboardEditor: slide-over panel con tabs Widgets/Tema/Acciones
    - WidgetGallery: widgets por categoria con toggle
    - DashboardThemePanel: 6 colores, columnas, card style, toggles
    - QuickActionsEditor: reordenar y toggle visibilidad

18. **`src/types/index.ts`** — MODIFICADO (~1022 lineas total)
    - ~15 interfaces nuevas: DashboardConfig, DashboardWidgetLayout, DashboardThemeConfig, QuickAction, DashboardWidgetDef, StaffCredential, CashClosing, StockSnapshot, StockSnapshotItem, ShiftHandover, HandoverChecklistItem, GymAccessLog, GymStaffActivity, StaffTimeSummary

**Dashboards (primera version basica):**

19. **`src/app/(admin)/admin/page.tsx`** — MODIFICADO (primera version)
    - 13 KPIs editables + 4 live widgets + modal tema basico

20. **`src/app/(app)/dashboard/page.tsx`** — MODIFICADO (primera version)
    - Quick actions editables + live widgets con show/hide/reorder

---

### BLOQUE 4: Liga match grid visual

21. **`src/components/league-match-grid.tsx`** — NUEVO (~563 lineas)
    - 3 modos de vista: Matrix (cuadro cruzado), Rounds (por jornada), Timeline (resultados)
    - Toggle con iconos Grid3X3/Columns/BarChart3
    - Matrix: tabla equipo vs equipo, V/D/pendiente
    - Rounds: scroll horizontal, mini-cards por jornada
    - Timeline: filas por equipo, V/D por jornada, racha ultimos 5

22. **`src/app/(admin)/admin/ligas/[id]/page.tsx`** — MODIFICADO
    - Agregado LeagueMatchGrid antes de la seccion Jornadas
    - onMatchClick abre modal de edicion

23. **`src/app/liga/[id]/page.tsx`** — MODIFICADO
    - Agregado LeagueMatchGrid (solo lectura)

---

### BLOQUE 5: Dashboards FULL — reescritura completa

24. **`src/app/(admin)/admin/page.tsx`** — REESCRITO COMPLETO (~1252 lineas)
    - 26 KPIs organizados por: Padel, Gimnasio, Finanzas, Acceso, Tienda, Social, Staff
    - 12 live widgets: reservas, caja, accesos, facturas, staff, torneos, ligas, stock bajo, posts, retos, gym, eventos
    - 15 quick actions: enlace a cada modulo admin
    - Widget Gallery modal: tabs KPIs/En vivo/Acciones, buscador, toggles
    - Theme modal: color acento (6), columnas live (2/3/4), columnas KPI (4/5/6/7), estilo card (default/glass/bordered), KPIs compactos, animaciones
    - Config en localStorage + DB upsert
    - Default: 7 KPIs, 4 live, 6 quick actions visibles

25. **`src/app/(app)/dashboard/page.tsx`** — REESCRITO COMPLETO (~1012 lineas)
    - 16 KPIs editables: reservas, partidos, ranking, win rate, torneos, ligas, gym, entrenamiento, retos, badges, posts
    - 14 quick actions: cada modulo player
    - 10 live widgets: reservas, suscripcion, retos, perfil, torneos, ligas, gym, entrenamiento, comunidad, ranking
    - Widget Gallery modal + Theme modal (NUEVOS)
    - mergeWidgets() para forward-compatibility
    - Config en localStorage + DB upsert

---

### BLOQUE 6: Documentacion

26. **`MANUAL_USUARIO.md`** — NUEVO
    - 45 secciones cubriendo TODAS las funciones
    - 31 videos sugeridos (~120-140 min total)
    - Organizado por: Acceso, Admin (22 modulos), Player (17 modulos), Funciones Especiales
    - Apendice: roles/permisos + guia rapida de videos

27. **`CONTEXTO_PROYECTO.md`** — NUEVO
    - Datos de acceso completos (Supabase, Vercel, WebEmpresa, WordPress, admins)
    - Tech stack, estructura de archivos, API routes, componentes, hooks, libs
    - Migraciones SQL, patrones de codigo, roles, URLs publicas, colores

28. **`HISTORIAL_SESION_2026-04-16.md`** — NUEVO (este archivo)

---

### BLOQUE 7: Analisis IA de partidos por video (17 abril 2026)

Feature nueva inspirada en el blueprint de producto (matchmaking + reservas + IA coaching). Se agrega el modulo de **Analisis IA** — lo unico del blueprint que no existia todavia en el sistema. El matchmaking basico (`buscar-partido`) y las reservas ya estaban implementados desde antes.

**Migracion SQL:**

29. **`supabase/017_ai_video_analysis.sql`** — NUEVO
    - 3 tablas nuevas: `nm_ai_videos`, `nm_ai_reports`, `nm_ai_highlights`
    - `nm_ai_videos`: id uuid, user_id, title, source (upload/club_camera/external_url), video_url, thumbnail_url, duration_seconds, match_type (singles/dobles), court_side (derecha/reves), status (pending/processing/completed/failed), ai_provider (mock_v1/openai_vision/...), coach_id, is_public, shared_with_coach
    - `nm_ai_reports`: overall_score, skill_score, positioning_score, consistency_score, shots_total + 7 tipos de golpes (forehand, backhand, volley, smash, serve, bandeja, vibora), winners_count, errors_count, unforced_errors, distance_meters, avg/max_speed_kmh, heatmap_data jsonb, improvements jsonb (3-4 recomendaciones con priority), summary
    - `nm_ai_highlights`: timestamp_sec, shot_type, outcome (winner/error/neutral), quality (excellent/good/regular/poor), note, coach_note
    - Trigger `trg_nm_ai_videos_updated_at` para actualizar updated_at
    - RLS completo: usuario ve solo los suyos (o los que le compartio un alumno via coach_id), admin/owner ven todos los del club. Reutiliza `nm_is_admin()` existente
    - Permiso nuevo `ai.analysis.manage` (modulo padel) asignado a owner y admin (sistema) via INSERT en nm_role_permissions

**API Routes:**

30. **`src/app/api/ai-analysis/upload/route.ts`** — NUEVO
    - POST: crea registro nm_ai_videos con status=pending
    - Valida auth del usuario, valida title obligatorio
    - Campos opcionales: description, video_url, thumbnail_url, duration_seconds, file_size_mb, match_type, court_side, match_context, opponents, partner, court_id, source, shared_with_coach, coach_id
    - Devuelve `{ video_id }` para encadenar con /process

31. **`src/app/api/ai-analysis/process/route.ts`** — NUEVO
    - POST: pipeline **mock v1** — pasa video a processing, genera informe plausible y vuelve a completed
    - Generador deterministico con mulberry32 sembrado por hash del video_id (mismo video → mismo informe, util para testing)
    - Calcula: 7 tipos de golpes con rangos realistas, ganadores 6-12%, errores no forzados 8-15%, distancia ~140-200m/min, velocidades 7-15 km/h, heatmap 6x10 con pesos
    - `buildImprovements()`: genera 3-4 recomendaciones priorizadas segun puntos debiles detectados (posicionamiento bajo → subir a red, errores no forzados altos → salidas de pared, etc.)
    - Crea 6-10 highlights con timestamps distribuidos por la duracion
    - Si falla, marca status=failed con error_message
    - Listo para enchufar proveedor real de IA reemplazando la seccion MOCK sin tocar el schema

**Pagina Player:**

32. **`src/app/(app)/analisis-ia/page.tsx`** — NUEVO (~460 lineas)
    - Header con titulo + CTA "Nuevo analisis" (icono Sparkles)
    - 3 KPIs: total, completados, en proceso
    - Empty state con icono grande y copy explicativo
    - Grid de cards de videos (3 columnas en desktop) con thumbnail placeholder, badge de status (Pendiente/Procesando/Completado/Error), fecha, tipo (dobles/singles), lado, duracion
    - Modal "Nuevo analisis" (size lg): titulo, tipo, lado de pista, pareja, rivales, duracion, notas + aviso MVP de que el video es opcional
    - Modal detalle (size xl) con componente ReportView:
      - Circulo SVG con score global animado
      - Summary en card cyan
      - 4 mini-stats (golpes, ganadores, no forzados, distancia)
      - BarChart de golpes por tipo (Recharts)
      - RadarChart 5 metricas: tecnica, posicion, consistencia, ataque, defensa (Recharts)
      - HeatmapMini: grid 10x6 con pesos traducidos a opacity cyan sobre fondo verde pista
      - Lista de mejoras con dots priority (rojo/ambar/verde)
      - Lista de highlights con timestamp fmt `m:ss`, nota, badge de outcome
    - Flujo: al hacer click en "Analizar partido" → POST /upload → toast "Analizando..." → POST /process → toast con score → recarga lista
    - Estados vacios y de error manejados

**Pagina Admin:**

33. **`src/app/(admin)/admin/analisis-ia/page.tsx`** — NUEVO (~230 lineas)
    - 5 KPIs: total analisis, completados, hoy, score medio del club, con error
    - Card con BarChart de analisis por dia (ultimos 14 dias)
    - Filtros: busqueda por titulo/jugador/email + Select de estado (all/completed/processing/pending/failed)
    - Tabla completa: jugador (nombre + email), titulo, tipo/lado, estado, score, golpes, fecha
    - Carga 500 ultimos videos + join manual con nm_users y nm_ai_reports

**Sidebar:**

34. **`src/components/ui/sidebar.tsx`** — MODIFICADO
    - Agregado icono `Sparkles` a los imports de lucide-react
    - Player: nuevo item "Analisis IA" en grupo "Padel" (href: `/analisis-ia`)
    - Admin: nuevo item "Analisis IA" en grupo "Padel & Sport" con permission: `ai.analysis.manage` (href: `/admin/analisis-ia`)

**Estado:**
- `npx tsc --noEmit` → **0 errores** (exit 0)
- Migracion 017 **pendiente de aplicar en Supabase** (supabase db push o SQL editor)
- Sin commit todavia

**Decisiones clave:**
- Video upload pospuesto: el MVP crea analisis sin archivo (usa el mock). Para enchufar Storage real hay que crear bucket `ai-videos` y llamar `supabase.storage.upload()` desde el modal antes del POST. Se evito para no comprometer el plan FREE de Supabase.
- Mock deterministico (no random puro): permite que un mismo video siempre genere el mismo informe → util para desarrollo y tests sin flakiness.
- Reutiliza helper `nm_is_admin()` del proyecto en vez de inventar uno nuevo.
- Schema de permisos usa tablas reales: `nm_permissions(key, module, description)` y `nm_role_permissions(role_id, permission_key)` — no strings sueltos.

---

## Archivos tocados — resumen rapido

### Nuevos (21 archivos):
- `supabase/016_staff_control_dashboards.sql`
- `supabase/017_ai_video_analysis.sql`
- `src/app/api/staff/auth/route.ts`
- `src/app/api/staff/cash-closing/route.ts`
- `src/app/api/staff/stock-snapshot/route.ts`
- `src/app/api/staff/handover/route.ts`
- `src/app/api/dashboard/config/route.ts`
- `src/app/api/ai-analysis/upload/route.ts`
- `src/app/api/ai-analysis/process/route.ts`
- `src/app/fichaje/page.tsx`
- `src/app/fichaje/layout.tsx`
- `src/app/(admin)/admin/torneos/[id]/pantalla/page.tsx`
- `src/app/(admin)/admin/torneos/[id]/pantalla/layout.tsx`
- `src/app/(admin)/admin/analisis-ia/page.tsx`
- `src/app/(app)/analisis-ia/page.tsx`
- `src/components/dashboard-editor.tsx`
- `src/components/league-match-grid.tsx`
- `MANUAL_USUARIO.md`
- `CONTEXTO_PROYECTO.md`
- `HISTORIAL_SESION_2026-04-16.md`

### Reescritos (5 archivos):
- `src/components/tournament-bracket.tsx` (1426 lineas)
- `src/app/(admin)/admin/staff/page.tsx` (1975 lineas)
- `src/app/(admin)/admin/page.tsx` (1252 lineas)
- `src/app/(app)/dashboard/page.tsx` (1012 lineas)
- `src/app/fichaje/page.tsx` (704 lineas)

### Modificados (8 archivos):
- `src/app/(admin)/admin/torneos/[id]/page.tsx`
- `src/app/torneo/[id]/page.tsx`
- `src/app/torneo/[id]/live/page.tsx`
- `src/app/(admin)/admin/gimnasio/page.tsx`
- `src/app/(admin)/admin/ligas/[id]/page.tsx`
- `src/app/liga/[id]/page.tsx`
- `src/types/index.ts`
- `src/components/ui/sidebar.tsx` (Sparkles import + 2 items nuevos)

---

## Estado del build al cerrar sesion

- `npx tsc --noEmit` → **0 errores** (verificado tras agregar Analisis IA)
- `npm run build` → **EXIT:0** (todas las 54 paginas compilan al cierre del bloque 6; bloque 7 agrega 2 paginas mas → 56 paginas, build no reejecutado pero typecheck limpio)
- Ultimo commit: `feat: dashboards editables, staff control, fichaje, liga publica, manual`
- Cambios del BLOQUE 7 (Analisis IA) **sin commitear todavia**

---

## Pendientes / notas para proxima sesion

1. **Link publico `/liga/4`** — el usuario menciono que debe ser publico sin contrasena. La ruta `/liga/[id]` ya usa `/api/public/liga/[id]` que NO requiere auth, pero podria haber un middleware redirigiendo a login. Verificar que el middleware excluya `/liga/*` y `/torneo/*`.

2. **Deploy a Vercel** — los cambios no fueron pusheados a produccion en esta sesion. Hacer `git push` cuando esten listos.

3. **Migrar SQL 016 y 017** — las migraciones `016_staff_control_dashboards.sql` y `017_ai_video_analysis.sql` necesitan ejecutarse en Supabase si no se hicieron aun (supabase db push o SQL editor).

4. **Datos de prueba** — las tablas nuevas (staff_credentials, cash_closings, ai_videos, ai_reports, etc.) estan vacias. Podria convenir crear datos seed para probar.

5. **Hardware real** — NFC, huella digital y facial en fichaje estan simulados. Necesitan integracion con hardware real (Web NFC API, sensores biometricos, webcam).

6. **Dashboard DB sync** — los dashboards guardan en localStorage + intentan upsert en nm_dashboard_configs, pero si la tabla no existe todavia (migracion 016 pendiente), funciona igual con localStorage solamente.

7. **Subida real de video en Analisis IA** — el MVP crea el analisis sin archivo. Para produccion hay que:
   - Crear bucket `ai-videos` en Supabase Storage (con RLS por user_id)
   - Agregar input `type="file"` al modal y llamar `supabase.storage.from('ai-videos').upload()` antes del POST /upload
   - Generar signed URL de vida 7 dias para `video_url`
   - Considerar limites del plan FREE (1 GB total).

8. **Proveedor de IA real para Analisis** — reemplazar la seccion MOCK en `src/app/api/ai-analysis/process/route.ts` por integracion real. Opciones:
   - OpenAI Vision con frames extraidos del video (barato, limitado en deteccion de movimiento)
   - Proveedor especializado tipo SportAI/PlaySight/Decathlon Coach (caro, mejor precision)
   - Modelo propio (MediaPipe pose estimation + heuristicas)
   - El campo `nm_ai_videos.ai_provider` ya esta preparado para multi-proveedor.

9. **Player de video inline con highlights clickables** — el detalle del informe en `/analisis-ia` muestra los highlights como lista pero no reproduce video. Agregar `<video>` con timestamps clickables que hagan `video.currentTime = highlight.timestamp_sec`.

10. **Notificaciones de analisis completado** — enganchar con sistema de notificaciones existente (`nm_notifications` + triggers) para avisar al usuario cuando su analisis pasa de processing a completed.
