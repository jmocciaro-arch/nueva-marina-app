'use client'

import { useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'

/**
 * Escucha cambios en tiempo real sobre una o más tablas de Supabase
 * y dispara el callback `onChange` cada vez que hay INSERT/UPDATE/DELETE.
 *
 * Además refresca cuando el usuario vuelve a la pestaña (visibilitychange + focus),
 * por si Realtime no estuviera habilitado en la tabla.
 *
 * Uso:
 *   useRealtimeRefresh(['nm_leagues'], load)
 *   useRealtimeRefresh(['nm_league_matches', 'nm_league_rounds'], load)
 */
export function useRealtimeRefresh(tables: string[], onChange: () => void) {
  // Ref estable para que el efecto no se desuscriba en cada render
  const cbRef = useRef(onChange)
  useEffect(() => { cbRef.current = onChange }, [onChange])

  useEffect(() => {
    if (tables.length === 0) return
    const supabase = createClient()

    const channel = supabase.channel('auto-refresh-' + tables.join('-'))
    for (const tbl of tables) {
      channel.on(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        'postgres_changes' as any,
        { event: '*', schema: 'public', table: tbl },
        () => cbRef.current(),
      )
    }
    channel.subscribe()

    // Fallback: refresco al volver a la pestaña
    const onVisible = () => {
      if (document.visibilityState === 'visible') cbRef.current()
    }
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('focus', () => cbRef.current())

    return () => {
      supabase.removeChannel(channel)
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('focus', () => cbRef.current())
    }
    // tables es estable porque son strings literales, pero para evitar re-suscripciones usamos JSON
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tables.join('|')])
}
