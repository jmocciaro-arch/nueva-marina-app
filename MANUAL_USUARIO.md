# Manual de Usuario — Nueva Marina Padel & Sport

> Guia completa para crear videos explicativos de cada funcion del software.
> Organizado por ROL (Admin vs Jugador) y por MODULO.

---

## INDICE

### PARTE 1: ACCESO Y NAVEGACION
1. [Login y registro](#1-login-y-registro)
2. [Navegacion del sidebar](#2-navegacion-del-sidebar)
3. [Dashboard personalizable](#3-dashboard-personalizable)

### PARTE 2: PANEL DE ADMINISTRACION
4. [Reservas](#4-reservas)
5. [Caja registradora](#5-caja-registradora)
6. [Torneos](#6-torneos)
7. [Ligas](#7-ligas)
8. [Gimnasio](#8-gimnasio)
9. [Entrenamiento](#9-entrenamiento)
10. [Recuperacion deportiva](#10-recuperacion-deportiva)
11. [Tienda / Punto de venta](#11-tienda--punto-de-venta)
12. [Control de acceso](#12-control-de-acceso)
13. [Facturacion y suscripciones](#13-facturacion-y-suscripciones)
14. [Precios y reglas de pricing](#14-precios-y-reglas-de-pricing)
15. [Usuarios](#15-usuarios)
16. [Jugadores y miembros](#16-jugadores-y-miembros)
17. [Staff y turnos](#17-staff-y-turnos)
18. [Comunidad / Feed social](#18-comunidad--feed-social)
19. [Retos y badges](#19-retos-y-badges)
20. [Reportes](#20-reportes)
21. [Pistas](#21-pistas)
22. [Innovacion (buzon de ideas)](#22-innovacion-buzon-de-ideas)
23. [Importar usuarios (Virtuagym)](#23-importar-usuarios-virtuagym)
24. [Configuracion del club](#24-configuracion-del-club)

### PARTE 3: PANEL DEL JUGADOR
25. [Mis Reservas](#25-mis-reservas)
26. [Mis Partidos](#26-mis-partidos)
27. [Buscar Partido](#27-buscar-partido)
28. [Mis Torneos](#28-mis-torneos)
29. [Mis Ligas](#29-mis-ligas)
30. [Ranking](#30-ranking)
31. [Gimnasio (jugador)](#31-gimnasio-jugador)
32. [Mi Entrenamiento](#32-mi-entrenamiento)
33. [Mi Recuperacion](#33-mi-recuperacion)
34. [Comunidad (jugador)](#34-comunidad-jugador)
35. [Retos (jugador)](#35-retos-jugador)
36. [Mi Ficha personal](#36-mi-ficha-personal)
37. [Mi Suscripcion](#37-mi-suscripcion)
38. [Mi Acceso (QR)](#38-mi-acceso-qr)
39. [Tienda (jugador)](#39-tienda-jugador)
40. [Perfil](#40-perfil)
41. [Notificaciones](#41-notificaciones)

### PARTE 4: FUNCIONES ESPECIALES
42. [Fichaje de staff (kiosk)](#42-fichaje-de-staff-kiosk)
43. [Pagina publica de torneo](#43-pagina-publica-de-torneo)
44. [Pagina publica de liga](#44-pagina-publica-de-liga)
45. [PWA (instalacion en movil)](#45-pwa-instalacion-en-movil)

---

# PARTE 1: ACCESO Y NAVEGACION

---

## 1. Login y registro

**URL:** `nuevamarina.es/login`

**Video sugerido:** "Como acceder a Nueva Marina App" (2-3 min)

### Para entrar con cuenta existente:
1. Abri la app en tu navegador o desde el icono de la PWA
2. Ingresa tu **email** y **contrasena**
3. Toca **"Iniciar sesion"**
4. Si sos admin, vas al panel de administracion. Si sos jugador, vas a tu dashboard

### Para crear cuenta nueva:
1. En la pantalla de login, toca **"Registro"** (toggle arriba)
2. Completa: **nombre completo**, **telefono**, **email** y **contrasena**
3. Toca **"Crear cuenta"**
4. Vas a recibir acceso como jugador. Un admin puede cambiarte el rol despues

### Contrasena olvidada:
- Contacta al club para que un admin te envie un email de restablecimiento desde el panel de Usuarios

---

## 2. Navegacion del sidebar

**Video sugerido:** "Tour por la interfaz" (3-4 min)

### Sidebar izquierdo:
- Se puede **colapsar** tocando el icono de hamburguesa (arriba a la izquierda)
- En version movil se abre como **drawer** deslizando o tocando el icono
- Los menus estan agrupados por **seccion** (colapsables):
  - **Admin:** Operacion, Padel & Sport, Gimnasio, Control de acceso, Comercial, Finanzas, Pricing, Personas, Comunidad, Reportes, Configuracion
  - **Jugador:** Principal, Padel, Gimnasio, Social, Mi Cuenta

### Permisos:
- Cada item del sidebar esta controlado por **permisos de rol**
- Si no ves un menu, es porque tu rol no tiene acceso a esa funcion
- Los roles son: **Propietario** (todo), **Admin** (casi todo), **Staff** (reservas y caja), **Jugador** (su panel)

---

## 3. Dashboard personalizable

**Video sugerido:** "Como personalizar tu dashboard" (4-5 min)

### Admin Dashboard (`/admin`):
1. Toca el boton **"Personalizar"** arriba a la derecha
2. Aparece el modo edicion con borde cyan
3. **Lo que podes hacer:**
   - **KPIs (indicadores):** Hay 26 indicadores disponibles organizados por categoria (Padel, Gimnasio, Finanzas, Acceso, Tienda, Social, Staff). Pasa el mouse por encima y usa las flechas para reordenar o el ojo para ocultar
   - **Quick Actions (accesos rapidos):** 15 botones de colores que te llevan directo a cada modulo (Reservas, Caja, Torneos, etc.)
   - **Live Widgets (datos en vivo):** 12 widgets con datos actualizados: reservas del dia, caja, accesos, facturas, staff activo, torneos, ligas, stock bajo, posts, retos, gym, proximos eventos
4. Toca **"Galeria"** para ver TODOS los widgets disponibles, buscar por nombre y activar/desactivar con un switch
5. Toca **"Tema"** para cambiar: color de acento (6 opciones), cantidad de columnas, tamano de KPIs, estilo de tarjetas (normal/glass/bordes), animaciones
6. Toca **"Guardar"** para aplicar los cambios
7. Toca **"Restablecer"** para volver a los valores por defecto
8. Toca **"Cancelar"** para descartar cambios

### Player Dashboard (`/dashboard`):
- Funciona igual que el admin pero con widgets orientados al jugador:
  - **16 KPIs:** Reservas, partidos, ranking, win rate, torneos, ligas, gym, entrenamiento, retos, badges, posts
  - **14 Quick Actions:** Reservar, Buscar partido, Mi acceso, Entrenamiento, Retos, Comunidad, Torneos, Ligas, Ranking, Gym, Recuperacion, Tienda, Suscripcion, Mi Ficha
  - **10 Live Widgets:** Reservas proximas, suscripcion, retos, perfil, torneos, ligas, gym, entrenamiento, posts, ranking
  - **Tema personalizable** con mismas opciones

### La configuracion se guarda por usuario
- Cada persona tiene su propio layout
- Se persiste automaticamente (localStorage + base de datos)
- Si cambias de dispositivo, se restaura tu config

---

# PARTE 2: PANEL DE ADMINISTRACION

---

## 4. Reservas

**URL:** `/admin/reservas`
**Video sugerido:** "Gestion de reservas paso a paso" (5-6 min)

### Vista principal:
- Grilla visual tipo calendario con las **pistas como columnas** y los **horarios como filas**
- Cada pista tiene su propio **color** (configurable desde Pistas)
- Los slots ocupados muestran nombre del cliente, hora y estado

### Crear una reserva:
1. Hace clic en un **slot libre** de la grilla — se abre el modal pre-cargado con pista, fecha y hora
2. O toca **"Nueva Reserva"** arriba a la derecha
3. Completa: **nombre del cliente**, telefono, email, pista, fecha, hora, duracion (1h / 1.5h / 2h), notas
4. El precio se calcula automaticamente segun las reglas de pricing
5. Toca **"Confirmar"** — la reserva aparece en la grilla y se suma a la caja

### Editar una reserva:
1. Hace clic sobre una reserva existente en la grilla
2. Se abre el modal con los datos cargados
3. Podes cambiar cualquier campo
4. Guardar

### Cancelar una reserva:
1. Abri la reserva haciendo clic
2. Cambia el estado a **"Cancelada"**
3. El monto se resta automaticamente de la caja

---

## 5. Caja registradora

**URL:** `/admin/caja`
**Video sugerido:** "Control de caja diaria" (4-5 min)

### Vista principal:
- Navegacion por **dia** (flechas izquierda/derecha)
- **4 KPIs principales:** Ingresos del dia, Gastos del dia, Neto del dia, Desglose por metodo de pago
- Tabla de **movimientos** del dia

### Tipos de movimiento:
- Reserva, Tienda, Torneo, Liga, Gimnasio, Clase, Suscripcion, Bono de creditos, Otro

### Metodos de pago:
- Efectivo, Tarjeta, Transferencia, Bizum

### Agregar movimiento manual:
1. Toca **"Agregar ingreso"** o **"Agregar gasto"**
2. Completa: tipo, descripcion, monto, metodo de pago
3. Guardar — aparece en la tabla del dia

### Editar o eliminar:
- Cada movimiento tiene botones de editar (lapiz) y eliminar (papelera) en su fila

### Importante:
- Las reservas, ventas de tienda, inscripciones a torneos, etc. se agregan **automaticamente** a la caja
- Los movimientos manuales son para cosas que no entran por otro modulo (alquiler de palas, vending, etc.)

---

## 6. Torneos

**URL:** `/admin/torneos` y `/admin/torneos/[id]`
**Video sugerido:** "Crear y gestionar un torneo completo" (8-10 min)

### Listado de torneos:
- Filtros por estado: Todos, Borrador, Inscripcion, En Curso, Finalizado
- KPIs: total torneos, equipos inscritos, recaudacion

### Crear torneo:
1. Toca **"Nuevo torneo"**
2. Completa: nombre, formato, fechas, cupos maximos, precio inscripcion, premio, descripcion
3. **Formatos disponibles:**
   - **Eliminacion directa** — llaves clasicas, el que pierde se va
   - **Doble eliminacion** — dos oportunidades
   - **Americano** — rotacion de parejas al azar
   - **Mexicano** — similar al americano con sistema de puntos
   - **Round Robin** — todos contra todos
   - **Premier** — fase de grupos + eliminacion

### Detalle del torneo (`/admin/torneos/[id]`):
- **Pestanas:** Info general, Equipos inscritos, Cuadro/Bracket, Resultados
- **Bracket visual** con 5 modos de vista:
  - Arbol (SVG con conectores)
  - Tabla
  - Tarjetas
  - Compacto
  - Linea de tiempo
- **4 temas visuales:** Oscuro, Neon, Clasico, Padel
- **Configuracion de pantalla TV:** Para proyectar el bracket en una pantalla del club (`/admin/torneos/[id]/pantalla`)
- **Link publico:** Para compartir por WhatsApp/email (`/torneo/[id]`)

### Cargar resultados:
1. En la pestana Bracket, toca un partido
2. Ingresa los sets (set 1, set 2, set 3 si hay)
3. El ganador se calcula automaticamente y avanza en el cuadro

---

## 7. Ligas

**URL:** `/admin/ligas` y `/admin/ligas/[id]`
**Video sugerido:** "Configurar una liga de padel" (7-8 min)

### Crear liga:
1. Toca **"Nueva liga"**
2. Completa: nombre, temporada, formato (Round Robin), fechas, precio inscripcion
3. Configura reglas: sets para ganar, juegos por set, golden point, tiene playoffs

### Detalle de liga (`/admin/ligas/[id]`):
- **Categorias:** Ej. Masculina A, Masculina B, Femenina, Mixta — cada una con sus propios equipos y jornadas
- **Tabla de posiciones:** Automatica con PJ, PG, PP, Sets, Puntos
- **Equipos:** Lista con jugadores, vinculacion con usuarios del sistema
  - **Auto-vincular:** El sistema busca automaticamente coincidencias por nombre
  - **Vincular manual:** Toca el slot del jugador y buscalo en el listado
  - **Crear usuario nuevo:** Si el jugador no existe, crealo directamente desde ahi
- **Jornadas:** Partidos generados automaticamente, con fecha editable
- **Cargar resultado:** Toca un partido, ingresa los sets
- **Vista visual de partidos** con 3 modos:
  - **Cuadro cruzado (Matrix):** Tabla equipo vs equipo
  - **Por jornada (Rounds):** Columnas por jornada con mini-cards
  - **Linea de resultados (Timeline):** Filas por equipo, V/D por jornada, racha de ultimos 5

### Importar desde Excel:
- Toca **"Actualizar desde Excel"** para importar equipos y resultados desde una planilla

### Link publico:
- Comparte `/liga/[id]` por WhatsApp. Los jugadores que no autorizaron publicar sus datos aparecen anonimizados (cumplimiento RGPD)

---

## 8. Gimnasio

**URL:** `/admin/gimnasio`
**Video sugerido:** "Gestion completa del gimnasio" (6-7 min)

### 4 pestanas:

**Membresias:**
- ABM de membresias de gym
- Planes: Mensual, Trimestral, Semestral, Anual
- Zonas: Sala Musculacion, Cardio, Piscina, Spa/Sauna, Sala de Clases
- Estados: Activa, Vencida, Suspendida, Cancelada
- El precio se busca automaticamente desde las reglas de pricing

**Clases grupales:**
- Gestion de clases (nombre, instructor, horario, capacidad, zona)
- Inscripcion de miembros a clases

**Sesiones:**
- Registro de check-in / check-out del gimnasio
- Metodos: QR, NFC, PIN, Huella, Facial, Manual
- Historial por dia

**Control de Personal:**
- Personal presente ahora (cards con timer en vivo)
- Accesos del dia con KPIs
- Registro de actividad del staff
- Formulario para registrar acceso manual

---

## 9. Entrenamiento

**URL:** `/admin/entrenamiento`
**Video sugerido:** "Planes de entrenamiento para socios" (4-5 min)

### 2 pestanas:

**Planes:**
- Crear planes de entrenamiento (nombre, descripcion, nivel, duracion en semanas, objetivo)
- Niveles: Principiante, Intermedio, Avanzado
- Pueden ser **templates** (reutilizables) o planes individuales
- Cada plan tiene un schedule con ejercicios por dia (nombre, series x reps, descanso, notas)

**Asignaciones:**
- Asignar un plan a un usuario con fecha de inicio
- El jugador ve su plan en "Mi Entrenamiento"

---

## 10. Recuperacion deportiva

**URL:** `/admin/recuperacion`
**Video sugerido:** "Gestionar sesiones de recuperacion" (3-4 min)

### 3 filtros: Hoy, Proximas, Historial

### Tipos de servicio:
- Crioterapia, Hidroterapia, Masaje, Estiramiento, Fisioterapia

### Crear sesion:
1. Toca **"Nueva sesion"**
2. Selecciona: usuario, tipo, fecha/hora, duracion (en minutos), precio, notas
3. El precio se auto-completa desde las reglas de pricing

### Estados:
- Agendada → Completada / Cancelada / No presentado

---

## 11. Tienda / Punto de venta

**URL:** `/admin/tienda`
**Video sugerido:** "Administrar la tienda del club" (5-6 min)

### 2 pestanas:

**Productos:**
- ABM completo: nombre, categoria, marca, precio, costo, IVA, SKU, stock actual, stock minimo
- Categorias: Palas, Zapatillas, Accesorios, Pelotas, Textil, Otros
- Producto **destacado** (aparece primero en la tienda del jugador)
- Alertas de stock bajo
- KPIs: total productos, stock bajo, ventas

**Categorias:**
- ABM de categorias: nombre, slug, orden, activo

### Venta:
- Cuando un jugador solicita un producto, se notifica a los admins
- El admin registra la venta manualmente y se descuenta el stock

---

## 12. Control de acceso

**URL:** `/admin/accesos`
**Video sugerido:** "Sistema de control de acceso al club" (5-6 min)

### 3 pestanas:

**Puntos de acceso:**
- Configurar dispositivos fisicos: molinetes, portones, puertas
- Datos: nombre, tipo, ubicacion, hardware_id, relay_endpoint (URL del hardware)
- Activo / inactivo

**Credenciales:**
- Lista de credenciales de cada usuario
- Tipos: QR, NFC, PIN, Huella digital, Reconocimiento facial
- Generar QR nuevo para un usuario
- Buscar por nombre/email

**Registro (logs):**
- Historial de entradas/salidas por dia
- Datos: usuario, punto de acceso, tipo credencial, direccion (IN/OUT), concedido/denegado, timestamp
- KPIs: total accesos, concedidos, denegados

### Como funciona el flujo:
1. El usuario muestra su QR / acerca su tag NFC / ingresa PIN / pone el dedo / mira la camara
2. El escaner envia la credencial a `/api/access/validate`
3. La API valida: credencial activa + membresia vigente
4. Si es valido, envia senal al relay del molinete para abrir
5. Se registra el log en `nm_access_logs`

---

## 13. Facturacion y suscripciones

**URL:** `/admin/facturacion`
**Video sugerido:** "Planes, suscripciones, facturas y bonos" (7-8 min)

### 4 pestanas:

**Planes:**
- ABM de planes de suscripcion
- Datos: nombre, descripcion, precio, ciclo (mensual/trimestral/semestral/anual)
- Incluye: gym si/no, pistas si/no, descuento en pistas (%), max clases por semana, horario de acceso

**Suscripciones:**
- Asignar plan a un usuario
- Estados: Activa, Vencida, Cancelada, Pausada, Expirada
- Periodo actual con fecha de inicio y fin

**Facturas:**
- Crear factura manual o automatica (se generan con las suscripciones)
- Estados: Pendiente, Pagada, Vencida, Anulada, Reembolsada
- Numero de factura, items, subtotal, impuesto, total

**Bonos / Creditos:**
- Packs de creditos: nombre, tipo (clase/reserva/mixto), cantidad, precio, dias de validez
- Los jugadores compran un bono y tienen creditos para gastar en reservas o clases

---

## 14. Precios y reglas de pricing

**URL:** `/admin/pricing` y `/admin/precios`
**Video sugerido:** "Configurar precios del club" (5-6 min)

### Sistema unificado (`/admin/pricing`):
- Reglas de precio basadas en **scopes**: Pistas, Planes gym, Recuperacion, Clases, Bar, Tienda, Bonos, Temporadas, Descuentos, Servicios especiales
- Cada regla define: ambito, nombre, precio, condiciones

### Sistema detallado (`/admin/precios`):
7 pestanas con configuracion granular:
- **Tarifas:** Precio por duracion y tipo de reserva + recargos
- **Franjas horarias:** Multiplicadores por hora del dia (ej. 1.5x en hora pico)
- **Bonos:** Packs de horas/sesiones con descuento
- **Temporadas:** Periodos especiales (verano, navidad) con precios distintos
- **Descuentos:** Porcentaje, monto fijo o precio fijo
- **Pistas:** Asignacion de grupo de pista para pricing diferencial
- **Config:** IVA, horarios pico, iluminacion, precios con/sin IVA

---

## 15. Usuarios

**URL:** `/admin/usuarios`
**Video sugerido:** "Gestion de usuarios del sistema" (4-5 min)

### Funciones:
- Listado completo de todos los usuarios con busqueda
- KPIs: total, activos, inactivos
- Ver detalle completo: datos personales, medicos, contacto emergencia, Virtuagym ID
- Cambiar rol: Propietario, Administrador, Staff, Jugador
- Activar / desactivar usuario
- Enviar email de **restablecimiento de contrasena**
- Crear usuario nuevo (invitar por email)

### Datos disponibles por usuario:
- Nombre, email, telefono, pais, ciudad, DNI/NIE, direccion, codigo postal, IBAN
- Peso, nivel de padel, posicion preferida
- Consentimiento de imagen y datos publicos
- Contacto de emergencia, notas medicas

---

## 16. Jugadores y miembros

**URL:** `/admin/jugadores`
**Video sugerido:** "Administrar miembros del club" (3-4 min)

### Funciones:
- Listado de miembros del club con perfil de jugador
- Busqueda por nombre/email
- KPIs: total miembros
- Editar rol de cada miembro: Dueno, Admin, Staff, Entrenador, Jugador, Invitado
- Activar / desactivar membresia
- Agregar nuevo miembro buscando por email

---

## 17. Staff y turnos

**URL:** `/admin/staff`
**Video sugerido:** "Control completo del staff" (8-10 min)

### 6 pestanas:

**Panel de control:**
- KPIs del staff: total en turno, horas acumuladas, etc.
- Cards del personal activo ahora con timer en vivo
- Linea de tiempo de turnos del dia

**Turnos del dia:**
- Navegacion por fecha
- 6 KPIs (presentes, pausas, ausentes, horas totales, overtime, etc.)
- Tabla con acciones: marcar entrada, pausa, salida, ausencia
- Metodo de autenticacion registrado (PIN, NFC, huella, facial, manual)

**Cierre de caja:**
- Banner de caja activa sin cerrar
- Modal de cierre: montos **esperados** (calculados del sistema) vs **reales** (ingresados por el staff)
- Desglose por metodo de pago: efectivo, tarjeta, transferencia, bizum
- Diferencias calculadas automaticamente
- Historial de cierres

**Control de stock:**
- Snapshot de inventario: lista de productos con stock esperado vs real
- Diferencias se calculan automaticamente
- Al guardar, el stock se actualiza en el sistema
- Historial de snapshots

**Horarios semanales:**
- Grilla visual lunes a domingo
- Barras de color por rol (Recepcion, Entrenador, Mantenimiento, Limpieza, Gerente)
- Configurar horario de cada empleado

**Credenciales:**
- Estado de credenciales de cada staff: PIN, NFC, Huella, Facial
- Registrar nueva credencial
- Desactivar credencial

### Cierre de turno (wizard):
Al cerrar un turno, se ejecuta un wizard de 5 pasos:
1. Resumen del turno (horas, actividades)
2. Cuadre de caja (esperado vs real)
3. Control de stock (snapshot)
4. Checklist de tareas (limpieza, cierre puertas, etc.)
5. Notas para el siguiente turno

---

## 18. Comunidad / Feed social

**URL:** `/admin/comunidad`
**Video sugerido:** "Administrar el feed social del club" (3-4 min)

### Funciones:
- Muro de publicaciones del club
- **Tipos:** Anuncio, Evento, Publicacion, Logro, Resultado
- **Visibilidad:** Publico, Solo miembros, Solo admins
- Crear publicaciones oficiales del club
- **Fijar** publicaciones importantes (quedan arriba del feed)
- Eliminar publicaciones inapropiadas
- Sistema de likes
- Busqueda por contenido o autor
- KPIs: total posts, fijados, anuncios, total likes

---

## 19. Retos y badges

**URL:** `/admin/retos`
**Video sugerido:** "Crear retos y badges para gamificacion" (5-6 min)

### 2 pestanas:

**Retos/Challenges:**
- Crear desafios: nombre, descripcion, tipo (Individual/Equipo/Club), categoria
- **Metricas:** Reservas, partidos ganados, partidos jugados, visitas al gym, clases, torneos, publicaciones, dias consecutivos, personalizada
- **Recompensas:** Badge, creditos, descuento, reserva gratis, merchandising
- Fechas de inicio y fin
- Ver participantes con su progreso

**Badges/Insignias:**
- Crear insignias: nombre, slug, descripcion, icono, categoria
- Se otorgan automaticamente cuando se completa un reto
- O manualmente desde el panel

---

## 20. Reportes

**URL:** `/admin/reportes`
**Video sugerido:** "Reportes financieros y operativos" (4-5 min)

### Funciones:
- Selector de periodo: Hoy, Esta semana, Este mes, Ultimo mes
- **KPIs:** Total ingresos, total gastos, neto, cantidad de transacciones
- **Desglose por tipo:** Reservas, Tienda, Torneos, Gimnasio, Liga, Suscripciones, etc.
- **Desglose por metodo de pago:** Efectivo, Tarjeta, Transferencia, Bizum
- **Stats por pista:** Reservas y revenue por cada pista
- **Ranking de jugadores:** Mas reservas, mayor gasto total
- Boton de exportar datos

---

## 21. Pistas

**URL:** `/admin/pistas`
**Video sugerido:** "Configurar las pistas del club" (3-4 min)

### 2 secciones:

**Pistas:**
- ABM: nombre, tipo (Indoor/Outdoor/Panoramica), superficie (Cristal, Cesped artificial, Hormigon, Moqueta, Tierra batida)
- Iluminacion: si/no
- Color personalizado (para la grilla de reservas)
- Activa / inactiva

**Horarios por pista:**
- Dia de la semana, hora apertura, hora cierre, duracion del slot, precio por hora
- Cada pista puede tener horarios distintos

---

## 22. Innovacion (buzon de ideas)

**URL:** `/admin/innovacion`
**Video sugerido:** "Buzon de ideas y mejoras" (2-3 min)

### Funciones:
- Cualquier usuario puede enviar una idea/sugerencia
- **Categorias:** Mejora, Bug, Feature, Otro
- **Prioridades:** Alta, Media, Baja
- Sistema de **votos** (los usuarios votan ideas que les gustan)
- Workflow de estados: Enviada → En revision → Aprobada/Rechazada → Completada
- Asignar responsable
- KPIs: total ideas, en revision, aprobadas

---

## 23. Importar usuarios (Virtuagym)

**URL:** `/admin/importar`
**Video sugerido:** "Importar miembros desde Virtuagym" (3-4 min)

### Wizard de 4 pasos:
1. **Subir CSV:** Exporta el CSV desde Virtuagym (Settings > Members > Export) y subilo
2. **Preview:** Tabla con los datos parseados. Revisa que todo este bien
3. **Importar:** El sistema crea los usuarios (auth + perfil + membresia de club)
4. **Resultado:** Resumen — creados, actualizados, saltados, errores

### Notas:
- Los usuarios reciben un email de restablecimiento de contrasena en su primer login
- El mapeo de campos es automatico (soporta headers en espanol e ingles)
- ~325 usuarios se importan en ~65 segundos

---

## 24. Configuracion del club

**URL:** `/admin/config`
**Video sugerido:** "Configuracion general del club" (3-4 min)

### 3 secciones independientes:

**Datos del club:**
- Nombre legal, CIF, direccion, ciudad, telefono, email, web

**Reservas:**
- Duracion del slot: 60, 90 o 120 minutos
- Dias de anticipacion para reservar
- Horas minimas para cancelar

**Modulos:**
- Activar/desactivar: Gimnasio, Tienda, Torneos, Ligas, Innovacion, IA
- Si desactivas un modulo, desaparece del sidebar

### Subsecciones:
- `/admin/config/modulos` — Toggle de modulos activos
- `/admin/config/roles` — Gestion de roles y permisos detallados

---

# PARTE 3: PANEL DEL JUGADOR

---

## 25. Mis Reservas

**URL:** `/mis-reservas`
**Video sugerido:** "Como reservar una pista" (3-4 min)

### 2 pestanas: Calendario | Mis proximas

**Reservar:**
1. Ve a la pestana **"Calendario"**
2. Navega por la semana hasta encontrar el horario que queres
3. Toca un **slot libre** (verde)
4. Completa tus datos y confirma
5. La reserva aparece en "Mis proximas"

**Cancelar:**
- En "Mis proximas", toca la reserva y selecciona "Cancelar"

---

## 26. Mis Partidos

**URL:** `/mis-partidos`
**Video sugerido:** "Historial de partidos" (2-3 min)

### 2 pestanas: Proximos | Historial
- **Proximos:** Partidos agendados con fecha, hora, rival
- **Historial:** Partidos jugados con marcador set por set (ej. 6-3, 4-6, 7-5), resultado victoria/derrota

---

## 27. Buscar Partido

**URL:** `/buscar-partido`
**Video sugerido:** "Como encontrar compaNeros para jugar" (3-4 min)

### Funciones:
- Lista de reservas **abiertas** que necesitan jugadores
- Cada card muestra: pista, fecha, hora, organizador, plazas disponibles
- Toca **"Unirme"** para sumarte a un partido

### Crear partido abierto:
1. Toca **"Crear partido"**
2. Completa: descripcion, fecha, hora, pista
3. Se publica para que otros jugadores se sumen

---

## 28. Mis Torneos

**URL:** `/mis-torneos`
**Video sugerido:** "Inscribirte en un torneo" (3-4 min)

### 2 pestanas: Disponibles | Inscripciones

**Inscribirse:**
1. Ve a la pestana **"Disponibles"**
2. Busca el torneo que te interesa
3. Toca **"Inscribirme"**
4. Ingresa: nombre del equipo, nombre de tu compaNero/a
5. Tu inscripcion aparece en la pestana "Inscripciones"

**Ver bracket:**
- Toca **"Bracket"** en cualquier torneo para ver el cuadro visual con los resultados en vivo

---

## 29. Mis Ligas

**URL:** `/mis-ligas`
**Video sugerido:** "Unirte a una liga" (3-4 min)

### 2 pestanas: Disponibles | Mis Ligas

**Inscribirse:**
1. Selecciona la liga
2. Elegir categoria (ej. Masculina A)
3. Indicar tu posicion (Drive/Reves)
4. Nombre de tu compaNero/a y su posicion

---

## 30. Ranking

**URL:** `/ranking`
**Video sugerido:** "El ranking del club" (2-3 min)

### Funciones:
- **Podio top 3** con cards destacadas (oro, plata, bronce)
- Tabla del ranking completo: posicion, nombre, partidos jugados/ganados, win rate, puntos
- Nivel del jugador: Iniciacion, Basico, Intermedio, Avanzado, Elite
- Solo lectura — se actualiza automaticamente con los resultados de torneos y ligas

---

## 31. Gimnasio (jugador)

**URL:** `/gimnasio`
**Video sugerido:** "Tu membresia y clases de gym" (3-4 min)

### 3 secciones:
- **Membresia activa:** Tu plan, precio, fechas, dias restantes
- **Horario de clases:** Grilla semanal (lunes a sabado) con las clases disponibles
- **Historial de sesiones:** Ultimos 10 check-ins/check-outs

---

## 32. Mi Entrenamiento

**URL:** `/mi-entrenamiento`
**Video sugerido:** "Tu plan de entrenamiento personalizado" (2-3 min)

### Funciones:
- Ver el plan de entrenamiento que te asigno tu entrenador
- Rutina dia por dia: ejercicios, series, repeticiones, descanso, notas
- Nivel del plan y objetivo
- Solo lectura — el entrenador lo carga desde el admin

---

## 33. Mi Recuperacion

**URL:** `/mi-recuperacion`
**Video sugerido:** "Sesiones de recuperacion deportiva" (2-3 min)

### Funciones:
- Solicitar sesiones de: Crioterapia, Hidroterapia, Masaje, Estiramiento, Fisioterapia
- Toca **"+"** para solicitar: tipo, fecha/hora, duracion, notas
- Ver historial de sesiones con estados: Agendada, Completada, Cancelada, No presentado

---

## 34. Comunidad (jugador)

**URL:** `/comunidad`
**Video sugerido:** "El feed social del club" (2-3 min)

### Funciones:
- Feed cronologico de publicaciones del club
- Publicaciones fijadas aparecen arriba
- **Escribir post:** Textarea para componer + boton Publicar
- **Dar like:** Toca el corazon en cualquier publicacion
- Paginacion infinita (se van cargando mas posts al scrollear)

---

## 35. Retos (jugador)

**URL:** `/retos`
**Video sugerido:** "Participa en retos y gana badges" (3-4 min)

### 2 secciones:

**Retos activos:**
- Cards con nombre, meta, barra de progreso, participantes
- Toca **"Unirme"** para participar
- Tu progreso se actualiza automaticamente (ej. cada vez que reservas una pista, sube el contador)

**Mis insignias:**
- Badges que ganaste al completar retos
- Nombre, icono, descripcion, categoria

---

## 36. Mi Ficha personal

**URL:** `/mi-ficha`
**Video sugerido:** "Completa tu ficha de socio" (4-5 min)

### Formulario completo:
- **Datos personales:** Nombre, email, telefono, fecha de nacimiento, DNI/NIE, direccion, codigo postal
- **Padel:** Posicion preferida (Drive/Reves/Ambos), nivel
- **Salud:** Contacto de emergencia, notas medicas
- **Consentimientos:** Uso de imagen, publicacion de datos (obligatorios para publicar ranking/ligas)
- **Foto de avatar:** Subi tu foto (max 8MB, se redimensiona automaticamente)
- Al completar todo, aparece el badge **"Ficha completada"**

### Importante para RGPD:
- Si NO autorizas la publicacion de datos, tu nombre aparece como "Jugador N" en las ligas/torneos publicos
- Esto cumple con la RGPD / LOPDGDD espanola

---

## 37. Mi Suscripcion

**URL:** `/mi-suscripcion`
**Video sugerido:** "Tu plan y facturas" (3-4 min)

### 3 secciones:

**Plan activo:**
- Nombre del plan, precio, ciclo, que incluye (gym, pistas, descuentos)
- Fecha de renovacion
- Boton **"Cancelar suscripcion"** (cancela al final del periodo)

**Creditos:**
- Bonos activos con creditos restantes
- Nombre del pack, total/usados/restantes, fecha de vencimiento

**Facturas:**
- Ultimas 20 facturas con numero, fecha, monto, estado (Pendiente/Pagada/Vencida)

---

## 38. Mi Acceso (QR)

**URL:** `/mi-acceso`
**Video sugerido:** "Tu codigo QR de acceso al club" (2-3 min)

### Funciones:
- Muestra tu **codigo QR personal** para pasar el molinete
- Boton **"Pantalla completa"** — agranda el QR a toda la pantalla (ideal en el movil)
- Boton **"Generar nuevo QR"** si necesitas renovar el codigo
- **Historial de accesos:** Ultimos 50 registros con fecha, hora, punto de acceso, concedido/denegado

### Como usarlo:
1. Abri la app en el celular
2. Anda a "Mi Acceso"
3. Toca "Pantalla completa"
4. Mostra el QR al escaner del molinete
5. Si tu membresia esta vigente, se abre

---

## 39. Tienda (jugador)

**URL:** `/tienda`
**Video sugerido:** "La tienda del club" (2-3 min)

### Funciones:
- Catalogo de productos: Palas, Zapatillas, Accesorios, Pelotas, Textil
- Filtro por **categoria** y **busqueda** por nombre
- Toca un producto para ver detalle (descripcion, precio, stock)
- Boton **"Solicitar"** — notifica a recepcion que queres ese producto
- No es e-commerce: la compra se realiza en el mostrador

---

## 40. Perfil

**URL:** `/perfil`
**Video sugerido:** "Editar tu perfil de jugador" (3-4 min)

### 3 secciones editables:

**Datos personales:** Nombre, telefono, ciudad
**Datos de atleta:** DNI, peso actual, lesiones (agregar/eliminar)
**Perfil de padel:**
- Posicion preferida (Drive/Reves/Ambos)
- Mano dominante (Derecha/Izquierda)
- Nivel (1 a 10)
- Marca y modelo de la paleta
- Bio personal
- Toggle: perfil publico si/no
- Barras de skills (0 a 5 estrellas)

**Stats:**
- Partidos jugados, ganados, win rate, puntos ranking, reputacion

---

## 41. Notificaciones

**URL:** `/notificaciones`
**Video sugerido:** "Tus notificaciones" (1-2 min)

### Funciones:
- Lista cronologica de todas las notificaciones
- Iconos por tipo: partido, reserva, torneo, gym, alerta, mensaje
- Tiempo relativo ("Hace 5 min", "Ayer")
- Toca una notificacion para marcarla como leida
- Boton **"Marcar todas como leidas"**
- Contador de no leidas en el titulo

---

# PARTE 4: FUNCIONES ESPECIALES

---

## 42. Fichaje de staff (kiosk)

**URL:** `/fichaje`
**Video sugerido:** "Terminal de fichaje para empleados" (3-4 min)

### Que es:
- Pantalla completa tipo kiosk para que los empleados fichen (marcar entrada/salida/pausa)
- Se usa en una tablet fija en recepcion o en la puerta

### Como funciona:
1. **Elegir metodo de autenticacion:**
   - **PIN:** Teclado numerico grande, ingresa tu codigo de 6 digitos
   - **NFC:** Acerca tu tag al lector (necesita hardware)
   - **Huella digital:** Pon el dedo en el sensor (necesita hardware)
   - **Facial:** Mira a la camara (necesita hardware)
2. **Elegir accion:** Entrada (verde), Salida (rojo), Pausa (amarillo)
3. **Resultado:** Pantalla de confirmacion con hora registrada
4. Vuelve automaticamente a la pantalla de inicio en 5 segundos

### Reloj en vivo:
- Arriba se muestra la hora actual actualizada cada segundo

---

## 43. Pagina publica de torneo

**URL:** `/torneo/[id]`
**Video sugerido:** "Compartir el cuadro de un torneo" (2-3 min)

### Funciones:
- Vista publica del cuadro del torneo (sin necesidad de login)
- Bracket visual interactivo con 5 modos de vista y 4 temas
- Actualizacion en **tiempo real** (via Supabase Realtime)
- Panel de configuracion visual (tema, tamano, opciones)
- Ideal para compartir por WhatsApp, email o proyectar en TV

### Pantalla TV (`/torneo/[id]/live`):
- Vista optimizada para pantallas grandes
- Auto-rotacion de vistas configurable
- Tema Neon por defecto (alto contraste)

---

## 44. Pagina publica de liga

**URL:** `/liga/[id]`
**Video sugerido:** "Compartir la liga publica" (2-3 min)

### Funciones:
- Vista publica de la liga (sin login)
- **Tabla de posiciones** por categoria
- **Equipos** con jugadores (anonimizados si no autorizaron RGPD)
- **Jornadas** con partidos y resultados set por set
- **Vista visual** con 3 modos: Matrix, Por jornada, Timeline
- KPIs: categorias, equipos, jornadas, partidos

---

## 45. PWA (instalacion en movil)

**Video sugerido:** "Instalar la app en tu celular" (1-2 min)

### En iPhone (Safari):
1. Abri `nuevamarina.es` en Safari
2. Toca el icono de **compartir** (cuadrado con flecha)
3. Selecciona **"Agregar a pantalla de inicio"**
4. Confirma el nombre y toca **"Agregar"**
5. La app aparece como un icono en tu pantalla

### En Android (Chrome):
1. Abri `nuevamarina.es` en Chrome
2. Toca el menu de 3 puntos
3. Selecciona **"Instalar app"** o **"Agregar a pantalla de inicio"**
4. Confirma
5. La app aparece como un icono en tu pantalla

### Ventajas de la PWA:
- Se abre en pantalla completa (sin barra de navegador)
- Mas rapida (cacheo local)
- Recibis notificaciones push (si las activas)
- Funciona parcialmente sin internet

---

# APENDICE: ROLES Y PERMISOS

| Rol | Acceso Admin | Acceso Player | Descripcion |
|-----|-------------|--------------|-------------|
| Propietario | Todo | Todo | Control total del club |
| Administrador | Casi todo | Todo | Gestion operativa |
| Staff | Reservas + Caja | Su perfil | Recepcion, mantenimiento |
| Entrenador | Entrenamiento | Su perfil | Gestion de planes |
| Jugador | Nada | Todo player | Socio regular del club |
| Invitado | Nada | Limitado | Acceso basico |

---

# APENDICE: GUIA RAPIDA POR VIDEO

| # | Video | Duracion | Audiencia |
|---|-------|----------|-----------|
| 1 | Acceso y login | 2-3 min | Todos |
| 2 | Tour por la interfaz | 3-4 min | Todos |
| 3 | Personalizar dashboard | 4-5 min | Todos |
| 4 | Reservar una pista | 3-4 min | Jugadores |
| 5 | Gestion de reservas (admin) | 5-6 min | Admins |
| 6 | Control de caja | 4-5 min | Admins |
| 7 | Crear un torneo | 8-10 min | Admins |
| 8 | Configurar una liga | 7-8 min | Admins |
| 9 | Gestion del gimnasio | 6-7 min | Admins |
| 10 | Planes de entrenamiento | 4-5 min | Admins |
| 11 | Recuperacion deportiva | 3-4 min | Admins + Jugadores |
| 12 | Tienda del club | 5-6 min | Admins |
| 13 | Control de acceso | 5-6 min | Admins |
| 14 | Facturacion y suscripciones | 7-8 min | Admins |
| 15 | Precios y pricing | 5-6 min | Admins |
| 16 | Usuarios y miembros | 4-5 min | Admins |
| 17 | Staff y turnos | 8-10 min | Admins |
| 18 | Comunidad social | 3-4 min | Todos |
| 19 | Retos y badges | 5-6 min | Admins + Jugadores |
| 20 | Reportes financieros | 4-5 min | Admins |
| 21 | Configuracion del club | 3-4 min | Admins |
| 22 | Importar desde Virtuagym | 3-4 min | Admins |
| 23 | Inscribirte en un torneo | 3-4 min | Jugadores |
| 24 | Unirte a una liga | 3-4 min | Jugadores |
| 25 | Ranking del club | 2-3 min | Jugadores |
| 26 | Buscar partido | 3-4 min | Jugadores |
| 27 | Ficha personal y RGPD | 4-5 min | Jugadores |
| 28 | Suscripcion y facturas | 3-4 min | Jugadores |
| 29 | Acceso QR al club | 2-3 min | Jugadores |
| 30 | Fichaje de staff | 3-4 min | Staff |
| 31 | Instalar la app (PWA) | 1-2 min | Todos |
| **Total** | | **~120-140 min** | |

---

*Manual generado el 16 de abril de 2026*
*Nueva Marina Padel & Sport — nuevamarina.es*
