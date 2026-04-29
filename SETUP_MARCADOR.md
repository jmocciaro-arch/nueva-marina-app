# 🚀 SETUP MARCADOR EN VIVO + YOUTUBE — Lo que falta

## ✅ Ya está hecho automáticamente

- ✅ Código integrado (botón "Marcador en vivo" en torneo y liga del admin)
- ✅ Build verificado limpio
- ✅ Commit + push a GitHub
- ✅ Vercel deployando ahora mismo (mirá https://vercel.com/jmocciaro-3358/nueva-marina-app)

---

## ⚠️ Lo que NECESITÁS hacer vos (no lo puedo hacer yo)

### 🔹 Tarea 1: Aplicar migraciones SQL (2 minutos)

Abrí terminal y pegá:

```bash
cd /Users/juanmanueljesusmocciaro/nueva-marina-app
supabase login
```

Esto abre el navegador. Iniciá sesión con `faltaenvidosl@gmail.com`.

Después:

```bash
supabase db push
```

Te va a decir que va a aplicar 3 migraciones nuevas:
- `20260417120001_live_scoring.sql`
- `20260417120002_match_highlights.sql`
- `20260417120003_youtube_integration.sql`

Confirmá con **Y** y esperá. Listo, base de datos actualizada.

---

### 🔹 Tarea 2: Configurar Google Cloud para YouTube (10 minutos)

1. **Andá a:** https://console.cloud.google.com
2. Iniciá sesión con la cuenta del **canal de YouTube del club**
3. **Crear proyecto** → nombre: `Nueva Marina YouTube`
4. **Activar API:** buscá "YouTube Data API v3" → ENABLE
5. **OAuth Consent Screen:**
   - User Type: **External** → CREATE
   - App name: `Nueva Marina Pádel`
   - Support email: `nuevamarina.padel@gmail.com`
   - SAVE AND CONTINUE (3 veces)
6. **Credenciales OAuth:**
   - APIs & Services → Credentials → CREATE CREDENTIALS → OAuth client ID
   - Application type: Web application
   - Name: `Nueva Marina Web`
   - **Authorized redirect URIs:**
     ```
     https://nuevamarina.es/api/youtube/callback
     https://nueva-marina-app.vercel.app/api/youtube/callback
     ```
   - CREATE
7. **Copiá** `Client ID` y `Client Secret`

---

### 🔹 Tarea 3: Agregar env vars a Vercel (2 minutos)

Andá a: https://vercel.com/jmocciaro-3358/nueva-marina-app/settings/environment-variables

Agregá:

| Key | Value |
|-----|-------|
| `GOOGLE_CLIENT_ID` | (lo que copiaste) |
| `GOOGLE_CLIENT_SECRET` | (lo que copiaste) |

Marcá las 3 environments (Production, Preview, Development).

Después en Vercel → **Deployments** → último deploy → **Redeploy** (para que tome las env vars).

---

### 🔹 Tarea 4: Conectar tu canal de YouTube (1 minuto)

1. Andá a: https://nueva-marina-app.vercel.app/admin/config/youtube
2. Iniciá sesión como admin: `faltaenvidosl@gmail.com` / `009413`
3. Click **"Conectar canal de YouTube"**
4. Autorizá con la cuenta del canal
5. ¡Listo!

---

## 🎾 Cómo usarlo en la cancha

### Iniciar marcador de un partido

**Opción A — Desde admin de torneos:**
1. Andá a `/admin/torneos/[id]`
2. Click en el partido que se va a jugar
3. Si está pending: vas a ver botón verde "Iniciar Partido" + abajo "📊 Marcador en vivo"
4. Si está en vivo: botón "🎾 Abrir marcador punto a punto"
5. Tap → elegís reglas (sets, punto oro, etc.) → Iniciar
6. Te lleva a `/match/[sessionId]`

**Opción B — Desde admin de ligas:**
1. Andá a `/admin/ligas/[id]`
2. Click en cualquier partido
3. Botón "🎾 Abrir marcador en vivo" arriba del modal
4. Igual que opción A

### Una vez en el marcador

- Activá **✨ Pro** arriba a la derecha
- **🎤 Voz**: permitir mic → decí "punto cyan", "ace rosa", "deshacer"
- **📹 Cámara**: permitir cam → graba 15s en buffer
- Botón **REPLAY**: ver últimos 15s
- **Guardar como highlight** → se sube a Supabase
- Click en el highlight → **Subir a YouTube** (si configuraste el OAuth)

### Linkear stream de YouTube

Arriba del marcador, en la página `/match/[id]`:
- "Linkear stream de YouTube" → pegás URL de tu live
- O "Ver mis lives activos" si conectaste OAuth → seleccionás uno

### El público lo ve en:

- `/torneo/[id]` y `/liga/[id]` — automáticamente aparece banner "Partidos en vivo ahora" cuando hay alguno
- Sin necesidad de login

---

## 🆘 Troubleshooting

| Problema | Solución |
|----------|----------|
| `supabase login` falla | Probá `npm install -g supabase` y volvé a intentar |
| `supabase db push` da error de migración duplicada | Está OK, ya aplicada. Saltala con `--include-all` |
| Bucket `match-highlights` no aparece | En Supabase Dashboard → Storage → New bucket → public |
| YouTube callback da "redirect_uri_mismatch" | Verificá que las URIs en Google Cloud sean **exactas** (sin `/` final) |
| Vercel build falla por env vars | Re-deployá desde Vercel después de agregar las vars |

---

## 📞 Contacto rápido

- Repo: https://github.com/jmocciaro-arch/nueva-marina-app
- Supabase: https://supabase.com/dashboard/project/vsgrwnfjzmovmnxjzkea
- Vercel: https://vercel.com/jmocciaro-3358/nueva-marina-app
- App: https://nueva-marina-app.vercel.app
