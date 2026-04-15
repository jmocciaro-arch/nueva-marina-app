'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/lib/auth-context'

/**
 * Hook que devuelve el set de permission keys del usuario actual.
 * Fuente de verdad: nm_role_permissions (vía nm_roles + nm_club_members.role).
 *
 * Bypass: owner / admin tienen TODOS los permisos (no necesita query).
 */
export function usePermissions() {
  const { member, loading: authLoading } = useAuth()
  const [perms, setPerms] = useState<Set<string> | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (authLoading) return
    if (!member) {
      setPerms(new Set())
      setLoading(false)
      return
    }

    // Bypass full admins: asumimos "all permissions"
    if (member.role === 'owner' || member.role === 'admin') {
      setPerms(new Set(['*']))
      setLoading(false)
      return
    }

    let cancelled = false
    ;(async () => {
      const supabase = createClient()
      // Join: roles (por slug = member.role) → role_permissions
      const { data } = await supabase
        .from('nm_role_permissions')
        .select('permission_key, nm_roles!inner(slug, club_id)')
        .eq('nm_roles.slug', member.role)
        .eq('nm_roles.club_id', member.club_id ?? 1)

      if (cancelled) return
      const keys = new Set<string>((data || []).map((r: { permission_key: string }) => r.permission_key))
      setPerms(keys)
      setLoading(false)
    })()

    return () => {
      cancelled = true
    }
  }, [member, authLoading])

  const can = (key: string) => {
    if (!perms) return false
    if (perms.has('*')) return true
    return perms.has(key)
  }

  return { perms, can, loading: loading || authLoading }
}
