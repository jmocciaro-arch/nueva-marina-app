import { createServerSupabaseClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

/**
 * GET /api/dashboard/config?type=admin|player
 * Returns the user's dashboard config + available widgets
 */
export async function GET(request: Request) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const url = new URL(request.url)
  const dashboardType = url.searchParams.get('type') || 'player'

  // Get user's config
  const { data: config } = await supabase
    .from('nm_dashboard_configs')
    .select('*')
    .eq('user_id', user.id)
    .eq('dashboard_type', dashboardType)
    .single()

  // Get available widgets
  const { data: widgets } = await supabase
    .from('nm_dashboard_widgets')
    .select('*')
    .eq('dashboard_type', dashboardType)
    .eq('is_active', true)
    .order('default_order')

  return NextResponse.json({
    config: config || null,
    widgets: widgets || [],
  })
}

/**
 * POST /api/dashboard/config
 * Saves the user's dashboard config (upsert)
 * Body: { dashboard_type, layout, theme, quick_actions, sidebar_collapsed, default_page }
 */
export async function POST(request: Request) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const body = await request.json()
  const { dashboard_type, layout, theme, quick_actions, sidebar_collapsed, default_page } = body

  if (!dashboard_type) {
    return NextResponse.json({ error: 'Falta dashboard_type' }, { status: 400 })
  }

  // Upsert
  const { data, error } = await supabase
    .from('nm_dashboard_configs')
    .upsert(
      {
        user_id: user.id,
        club_id: 1,
        dashboard_type,
        layout: layout || [],
        theme: theme || {},
        quick_actions: quick_actions || [],
        sidebar_collapsed: sidebar_collapsed ?? false,
        default_page: default_page ?? null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,dashboard_type' }
    )
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ config: data })
}
