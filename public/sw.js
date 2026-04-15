/* Nueva Marina — Service Worker
 * Estrategias:
 * - App shell: cache-first con revalidate en background
 * - Assets Next estáticos (/_next/static): cache-first inmutables
 * - Supabase REST (GETs): stale-while-revalidate
 * - Resto de API / mutaciones: network-only (con background sync queue como fallback)
 */

const VERSION = 'nm-v1'
const STATIC_CACHE = `${VERSION}-static`
const RUNTIME_CACHE = `${VERSION}-runtime`
const API_CACHE = `${VERSION}-api`

const APP_SHELL = [
  '/',
  '/dashboard',
  '/mis-reservas',
  '/mi-acceso',
  '/mi-recuperacion',
  '/perfil',
  '/manifest.json',
]

// ─────────── Install ───────────
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then(cache =>
      cache.addAll(APP_SHELL).catch(() => { /* ignore missing */ })
    )
  )
  self.skipWaiting()
})

// ─────────── Activate ───────────
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(k => !k.startsWith(VERSION))
          .map(k => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  )
})

// ─────────── Fetch ───────────
self.addEventListener('fetch', event => {
  const { request } = event
  if (request.method !== 'GET') {
    // POST/PUT/DELETE/PATCH → network-only, si falla offline encolamos
    event.respondWith(networkWithQueue(request))
    return
  }

  const url = new URL(request.url)

  // Next static assets (immutable)
  if (url.pathname.startsWith('/_next/static')) {
    event.respondWith(cacheFirst(request, STATIC_CACHE))
    return
  }

  // Supabase REST GETs → SWR
  if (url.hostname.endsWith('.supabase.co') && url.pathname.includes('/rest/v1/')) {
    event.respondWith(staleWhileRevalidate(request, API_CACHE))
    return
  }

  // Misma origin HTML/JSON → SWR
  if (url.origin === self.location.origin) {
    event.respondWith(staleWhileRevalidate(request, RUNTIME_CACHE))
    return
  }

  // Default: network-first
  event.respondWith(
    fetch(request).catch(() => caches.match(request))
  )
})

// ─────────── Strategies ───────────
async function cacheFirst(request, cacheName) {
  const cached = await caches.match(request)
  if (cached) return cached
  try {
    const res = await fetch(request)
    if (res.ok) {
      const cache = await caches.open(cacheName)
      cache.put(request, res.clone())
    }
    return res
  } catch {
    return cached || Response.error()
  }
}

async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName)
  const cached = await cache.match(request)
  const fetchPromise = fetch(request)
    .then(res => {
      if (res.ok) cache.put(request, res.clone())
      return res
    })
    .catch(() => cached || Response.error())
  return cached || fetchPromise
}

async function networkWithQueue(request) {
  try {
    return await fetch(request.clone())
  } catch {
    // Encolamos solo si es una mutación a la API propia o a Supabase
    const url = new URL(request.url)
    const isMutable =
      url.origin === self.location.origin ||
      url.hostname.endsWith('.supabase.co')

    if (isMutable) {
      try {
        await enqueueRequest(request.clone())
        if ('sync' in self.registration) {
          await self.registration.sync.register('nm-sync-queue')
        }
        return new Response(
          JSON.stringify({ queued: true, message: 'Offline: acción encolada' }),
          { status: 202, headers: { 'Content-Type': 'application/json' } }
        )
      } catch {
        // fallthrough
      }
    }
    return new Response(
      JSON.stringify({ error: 'offline' }),
      { status: 503, headers: { 'Content-Type': 'application/json' } }
    )
  }
}

// ─────────── IndexedDB queue (background sync) ───────────
const DB_NAME = 'nm-sync-db'
const STORE = 'queue'

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1)
    req.onupgradeneeded = () => {
      req.result.createObjectStore(STORE, { keyPath: 'id', autoIncrement: true })
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

async function enqueueRequest(request) {
  const body = await request.text()
  const headers = {}
  request.headers.forEach((v, k) => { headers[k] = v })
  const record = {
    url: request.url,
    method: request.method,
    headers,
    body,
    timestamp: Date.now(),
  }
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite')
    tx.objectStore(STORE).add(record)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

async function drainQueue() {
  const db = await openDB()
  const items = await new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly')
    const req = tx.objectStore(STORE).getAll()
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })

  for (const item of items) {
    try {
      const res = await fetch(item.url, {
        method: item.method,
        headers: item.headers,
        body: item.body || undefined,
      })
      if (res.ok || res.status < 500) {
        await new Promise((resolve, reject) => {
          const tx = db.transaction(STORE, 'readwrite')
          tx.objectStore(STORE).delete(item.id)
          tx.oncomplete = () => resolve()
          tx.onerror = () => reject(tx.error)
        })
      }
    } catch {
      // Seguimos intentando en el próximo sync
    }
  }
}

self.addEventListener('sync', event => {
  if (event.tag === 'nm-sync-queue') {
    event.waitUntil(drainQueue())
  }
})

// Permitir drenar manualmente desde la UI
self.addEventListener('message', event => {
  if (event.data === 'nm-drain-queue') {
    event.waitUntil(drainQueue())
  }
})
