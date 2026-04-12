'use client'

import { Sidebar } from '@/components/ui/sidebar'
import { Topbar } from '@/components/ui/topbar'
import { AuthProvider, useAuth } from '@/lib/auth-context'
import { ToastProvider } from '@/components/ui/toast'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'

function AdminShell({ children }: { children: React.ReactNode }) {
  const { user, member, loading, isAdmin, logout } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!loading && !isAdmin) {
      router.push('/dashboard')
    }
  }, [loading, isAdmin, router])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="w-8 h-8 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!isAdmin) return null

  return (
    <div className="flex min-h-screen">
      <Sidebar
        isAdmin
        memberRole={member?.role}
        user={user ? { full_name: user.full_name, email: user.email, avatar_url: user.avatar_url } : undefined}
        onLogout={logout}
      />
      <main className="flex-1 min-w-0">
        <Topbar />
        <div className="p-4 lg:p-6">
          {children}
        </div>
      </main>
    </div>
  )
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <ToastProvider>
        <AdminShell>{children}</AdminShell>
      </ToastProvider>
    </AuthProvider>
  )
}
