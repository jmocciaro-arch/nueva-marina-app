// ─── Utilidades de YouTube ──────────────────────────────────────────────────

/**
 * Extrae el ID de video de cualquier URL de YouTube.
 * Soporta:
 * - https://www.youtube.com/watch?v=ID
 * - https://youtu.be/ID
 * - https://www.youtube.com/embed/ID
 * - https://www.youtube.com/live/ID
 * - https://www.youtube.com/shorts/ID
 */
export function extractYouTubeId(url: string): string | null {
  if (!url) return null
  const patterns = [
    /youtube\.com\/watch\?v=([a-zA-Z0-9_-]{11})/,
    /youtu\.be\/([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/embed\/([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/live\/([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/v\/([a-zA-Z0-9_-]{11})/,
  ]
  for (const p of patterns) {
    const m = url.match(p)
    if (m) return m[1]
  }
  return null
}

export function getYouTubeEmbedUrl(videoId: string, options?: { autoplay?: boolean; muted?: boolean }): string {
  const params = new URLSearchParams()
  if (options?.autoplay) params.set('autoplay', '1')
  if (options?.muted) params.set('mute', '1')
  params.set('rel', '0') // no mostrar videos relacionados
  return `https://www.youtube.com/embed/${videoId}${params.toString() ? '?' + params.toString() : ''}`
}

export function getYouTubeThumbnailUrl(videoId: string, quality: 'default' | 'medium' | 'high' | 'maxres' = 'high'): string {
  const qualityMap = {
    default: 'default',
    medium: 'mqdefault',
    high: 'hqdefault',
    maxres: 'maxresdefault',
  }
  return `https://i.ytimg.com/vi/${videoId}/${qualityMap[quality]}.jpg`
}

export function getYouTubeWatchUrl(videoId: string): string {
  return `https://www.youtube.com/watch?v=${videoId}`
}

// ─── OAuth helpers ──────────────────────────────────────────────────────────

export const YOUTUBE_OAUTH_SCOPES = [
  'https://www.googleapis.com/auth/youtube.upload',
  'https://www.googleapis.com/auth/youtube.readonly',
].join(' ')

export function getYouTubeAuthUrl(clientId: string, redirectUri: string, state?: string): string {
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: YOUTUBE_OAUTH_SCOPES,
    access_type: 'offline',
    prompt: 'consent',
    ...(state ? { state } : {}),
  })
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`
}

// ─── Token refresh ──────────────────────────────────────────────────────────

export async function refreshAccessToken(refreshToken: string, clientId: string, clientSecret: string): Promise<{
  access_token: string
  expires_in: number
}> {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }).toString(),
  })
  if (!res.ok) throw new Error('Error al refrescar token de YouTube')
  return res.json()
}

// ─── Exchange code for tokens ───────────────────────────────────────────────

export async function exchangeCodeForTokens(code: string, clientId: string, clientSecret: string, redirectUri: string): Promise<{
  access_token: string
  refresh_token: string
  expires_in: number
  scope: string
}> {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    }).toString(),
  })
  if (!res.ok) {
    const error = await res.text()
    throw new Error(`Error en OAuth: ${error}`)
  }
  return res.json()
}

// ─── Get channel info ───────────────────────────────────────────────────────

export async function getChannelInfo(accessToken: string): Promise<{
  id: string
  title: string
  thumbnail: string
} | null> {
  const res = await fetch(
    'https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true',
    { headers: { Authorization: `Bearer ${accessToken}` } }
  )
  if (!res.ok) return null
  const data = await res.json()
  const channel = data.items?.[0]
  if (!channel) return null
  return {
    id: channel.id,
    title: channel.snippet.title,
    thumbnail: channel.snippet.thumbnails?.default?.url ?? '',
  }
}

// ─── Get active live broadcasts ─────────────────────────────────────────────

export interface LiveBroadcast {
  id: string
  title: string
  description: string
  thumbnail: string
  isLive: boolean
  watchUrl: string
  embedUrl: string
}

export async function getLiveBroadcasts(accessToken: string): Promise<LiveBroadcast[]> {
  // Obtiene livestreams activos del canal autenticado
  const res = await fetch(
    'https://www.googleapis.com/youtube/v3/liveBroadcasts?part=snippet,status&broadcastStatus=active&maxResults=10',
    { headers: { Authorization: `Bearer ${accessToken}` } }
  )
  if (!res.ok) return []
  const data = await res.json()
  return (data.items ?? []).map((item: { id: string; snippet: { title: string; description: string; thumbnails?: { high?: { url: string }; default?: { url: string } } } }) => ({
    id: item.id,
    title: item.snippet.title,
    description: item.snippet.description,
    thumbnail: item.snippet.thumbnails?.high?.url ?? item.snippet.thumbnails?.default?.url ?? '',
    isLive: true,
    watchUrl: getYouTubeWatchUrl(item.id),
    embedUrl: getYouTubeEmbedUrl(item.id),
  }))
}

// ─── Upload video to YouTube ───────────────────────────────────────────────

export interface UploadVideoOptions {
  accessToken: string
  videoBlob: Blob | ArrayBuffer
  title: string
  description?: string
  tags?: string[]
  categoryId?: string
  privacy?: 'public' | 'unlisted' | 'private'
  onProgress?: (percent: number) => void
}

/**
 * Upload usando resumable upload de YouTube Data API v3.
 * 1. POST a /videos con metadata → obtiene upload URL
 * 2. PUT del video al upload URL
 */
export async function uploadVideoToYouTube({
  accessToken, videoBlob, title, description = '', tags = [], categoryId = '17', privacy = 'unlisted',
}: UploadVideoOptions): Promise<{ id: string; url: string }> {
  // Paso 1: Iniciar upload resumable
  const metadata = {
    snippet: { title, description, tags, categoryId },
    status: { privacyStatus: privacy, selfDeclaredMadeForKids: false },
  }

  const initRes = await fetch(
    'https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'X-Upload-Content-Type': 'video/*',
      },
      body: JSON.stringify(metadata),
    }
  )

  if (!initRes.ok) {
    const err = await initRes.text()
    throw new Error(`Error iniciando upload: ${err}`)
  }

  const uploadUrl = initRes.headers.get('Location')
  if (!uploadUrl) throw new Error('No se obtuvo URL de upload')

  // Paso 2: Subir el video
  const uploadRes = await fetch(uploadUrl, {
    method: 'PUT',
    headers: { 'Content-Type': 'video/*' },
    body: videoBlob,
  })

  if (!uploadRes.ok) {
    const err = await uploadRes.text()
    throw new Error(`Error subiendo video: ${err}`)
  }

  const result = await uploadRes.json()
  return {
    id: result.id,
    url: getYouTubeWatchUrl(result.id),
  }
}
