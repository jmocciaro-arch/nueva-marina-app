'use client'

import { useCallback, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { fetchFormats, fetchAllFormats, FALLBACK_FORMATS, type FormatDef } from '@/lib/tournament-formats'
import { useRealtimeRefresh } from './use-realtime-refresh'

/**
 * Hook que carga los formatos desde nm_game_formats con suscripción Realtime.
 *
 * @param scope        'tournament' | 'league' | 'all' — filtro inicial
 * @param includeInactive  Si true, trae también los is_active=false (para el admin)
 */
export function useGameFormats(
  scope: 'tournament' | 'league' | 'all' = 'all',
  includeInactive = false,
) {
  const [formats, setFormats] = useState<FormatDef[]>(FALLBACK_FORMATS)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    const supabase = createClient()
    setLoading(true)
    setError(null)
    try {
      const data = includeInactive
        ? await fetchAllFormats(supabase)
        : await fetchFormats(supabase)
      const filtered = scope === 'all'
        ? data
        : data.filter(f => f.applicableTo === scope || f.applicableTo === 'both')
      setFormats(filtered)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }, [scope, includeInactive])

  useEffect(() => { load() }, [load])

  useRealtimeRefresh(['nm_game_formats'], load)

  return { formats, loading, error, reload: load }
}
