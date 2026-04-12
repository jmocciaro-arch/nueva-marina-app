import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

// Public routes that don't need auth
const PUBLIC_ROUTES = ['/', '/login', '/api/auth']

function isPublicRoute(pathname: string) {
  return PUBLIC_ROUTES.some(route =>
    pathname === route || pathname.startsWith(route + '/')
  )
}

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // IMPORTANT: call getUser() to refresh the session token
  const { data: { user } } = await supabase.auth.getUser()

  const pathname = request.nextUrl.pathname

  // Public routes — allow through
  if (isPublicRoute(pathname)) {
    return supabaseResponse
  }

  // API routes (except auth) — allow through but check auth in the handler
  if (pathname.startsWith('/api/')) {
    return supabaseResponse
  }

  // All other routes need authentication
  if (!user) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    url.searchParams.set('redirect', pathname)
    return NextResponse.redirect(url)
  }

  // Admin routes need admin/staff/owner role
  if (pathname.startsWith('/admin')) {
    const { data: member } = await supabase
      .from('nm_club_members')
      .select('role')
      .eq('user_id', user.id)
      .in('role', ['owner', 'admin', 'staff'])
      .single()

    if (!member) {
      const url = request.nextUrl.clone()
      url.pathname = '/dashboard'
      return NextResponse.redirect(url)
    }
  }

  return supabaseResponse
}
