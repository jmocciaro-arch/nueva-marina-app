'use client'

import { createClient } from '@/lib/supabase/client'
import type { User, ClubMember } from '@/types'
import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

interface AuthState {
  user: User | null
  member: ClubMember | null
  loading: boolean
  isAdmin: boolean
  logout: () => Promise<void>
  refresh: () => Promise<void>
}

const AuthContext = createContext<AuthState>({
  user: null,
  member: null,
  loading: true,
  isAdmin: false,
  logout: async () => {},
  refresh: async () => {},
})

export function useAuth() {
  return useContext(AuthContext)
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [member, setMember] = useState<ClubMember | null>(null)
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  const loadUser = useCallback(async () => {
    const supabase = createClient()
    const { data: { user: authUser } } = await supabase.auth.getUser()

    if (!authUser) {
      setUser(null)
      setMember(null)
      setLoading(false)
      return
    }

    const { data: profile } = await supabase
      .from('nm_users')
      .select('*')
      .eq('id', authUser.id)
      .single()

    const { data: membership } = await supabase
      .from('nm_club_members')
      .select('*')
      .eq('user_id', authUser.id)
      .eq('is_active', true)
      .single()

    setUser(profile || {
      id: authUser.id,
      email: authUser.email!,
      full_name: authUser.user_metadata?.full_name,
      is_active: true,
      country: 'ES',
      preferred_language: 'es',
      created_at: authUser.created_at,
    })
    setMember(membership || null)
    setLoading(false)
  }, [])

  useEffect(() => {
    loadUser()

    const supabase = createClient()
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        loadUser()
      } else if (event === 'SIGNED_OUT') {
        setUser(null)
        setMember(null)
      }
    })

    return () => subscription.unsubscribe()
  }, [loadUser])

  const logout = useCallback(async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    setUser(null)
    setMember(null)
    router.push('/')
  }, [router])

  const isAdmin = member?.role === 'owner' || member?.role === 'admin' || member?.role === 'staff'

  return (
    <AuthContext.Provider value={{ user, member, loading, isAdmin, logout, refresh: loadUser }}>
      {children}
    </AuthContext.Provider>
  )
}
