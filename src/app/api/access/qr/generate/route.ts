import { createServerSupabaseClient, createServiceRoleClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { randomUUID } from 'crypto'

/**
 * POST /api/access/qr/generate
 * Generates a QR access token for a user.
 * Admin can generate for any user (body: { user_id }), regular users generate for themselves.
 */
export async function POST(request: Request) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  }

  const body = await request.json().catch(() => ({}))
  let targetUserId = user.id

  // If admin is generating for another user
  if (body.user_id && body.user_id !== user.id) {
    const { data: membership } = await supabase
      .from('nm_club_members')
      .select('role')
      .eq('user_id', user.id)
      .eq('club_id', 1)
      .in('role', ['owner', 'admin'])
      .single()

    if (!membership) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
    }
    targetUserId = body.user_id
  }

  // Generate a unique QR token
  const token = randomUUID()

  // Upsert credential (one QR per user)
  const admin = createServiceRoleClient()
  const { data: credential, error } = await admin
    .from('nm_access_credentials')
    .upsert({
      club_id: 1,
      user_id: targetUserId,
      type: 'qr',
      credential_data: token,
      is_active: true,
      expires_at: null, // QR tokens don't expire by default
    }, { onConflict: 'club_id,user_id,type' })
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Build the QR value — the URL that the scanner will read
  const origin = request.headers.get('origin') || process.env.NEXT_PUBLIC_APP_URL || 'https://nuevamarina.es'
  const qrValue = `${origin}/api/access/validate?t=${token}`

  return NextResponse.json({
    credential_id: credential.id,
    token,
    qr_value: qrValue,
    user_id: targetUserId,
  })
}
