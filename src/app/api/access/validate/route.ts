import { createServiceRoleClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

/**
 * POST /api/access/validate
 * Validates an access credential and triggers the relay if granted.
 * Called by hardware scanners (QR reader, NFC reader) or the app itself.
 *
 * Body: { credential_type: 'qr' | 'nfc' | 'pin', credential_data: string, access_point_id?: number }
 * Also supports GET with query params: ?t={token}&ap={access_point_id} (for simple QR scanners)
 */
export async function POST(request: Request) {
  const body = await request.json()
  return handleValidation(body)
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const token = searchParams.get('t')
  const apId = searchParams.get('ap')

  if (!token) {
    return NextResponse.json({ granted: false, reason: 'missing_token' }, { status: 400 })
  }

  return handleValidation({
    credential_type: 'qr',
    credential_data: token,
    access_point_id: apId ? Number(apId) : undefined,
  })
}

async function handleValidation(params: {
  credential_type: string
  credential_data: string
  access_point_id?: number
}) {
  const { credential_type, credential_data, access_point_id } = params
  const supabase = createServiceRoleClient()

  if (!credential_type || !credential_data) {
    return NextResponse.json({ granted: false, reason: 'invalid_request' }, { status: 400 })
  }

  // 1. Find the credential
  const { data: credential } = await supabase
    .from('nm_access_credentials')
    .select('id, user_id, type, is_active, expires_at')
    .eq('type', credential_type)
    .eq('credential_data', credential_data)
    .eq('club_id', 1)
    .single()

  if (!credential) {
    await logAccess(supabase, { access_point_id, credential_type, granted: false, denial_reason: 'invalid_credential' })
    return NextResponse.json({ granted: false, reason: 'invalid_credential' })
  }

  if (!credential.is_active) {
    await logAccess(supabase, { user_id: credential.user_id, access_point_id, credential_type, granted: false, denial_reason: 'credential_disabled' })
    return NextResponse.json({ granted: false, reason: 'credential_disabled' })
  }

  if (credential.expires_at && new Date(credential.expires_at) < new Date()) {
    await logAccess(supabase, { user_id: credential.user_id, access_point_id, credential_type, granted: false, denial_reason: 'credential_expired' })
    return NextResponse.json({ granted: false, reason: 'credential_expired' })
  }

  // 2. Check user is active
  const { data: user } = await supabase
    .from('nm_users')
    .select('id, full_name, is_active, avatar_url')
    .eq('id', credential.user_id)
    .single()

  if (!user || !user.is_active) {
    await logAccess(supabase, { user_id: credential.user_id, access_point_id, credential_type, granted: false, denial_reason: 'user_inactive' })
    return NextResponse.json({ granted: false, reason: 'user_inactive', user_name: user?.full_name, avatar_url: user?.avatar_url })
  }

  // 3. Check user has active membership or subscription
  const { data: membership } = await supabase
    .from('nm_club_members')
    .select('id, is_active, membership_type, membership_end')
    .eq('user_id', credential.user_id)
    .eq('club_id', 1)
    .eq('is_active', true)
    .single()

  if (!membership) {
    await logAccess(supabase, { user_id: credential.user_id, access_point_id, credential_type, granted: false, denial_reason: 'no_active_membership' })
    return NextResponse.json({
      granted: false,
      reason: 'no_active_membership',
      user_name: user.full_name,
      avatar_url: user.avatar_url,
    })
  }

  // Optional: check gym membership if access point is gym-specific
  // (can be expanded later based on access_point config)

  // 4. Grant access - log and trigger relay
  await logAccess(supabase, { user_id: credential.user_id, access_point_id, credential_type, granted: true })

  // Update last_used_at on credential
  await supabase
    .from('nm_access_credentials')
    .update({ last_used_at: new Date().toISOString() })
    .eq('id', credential.id)

  // 5. Trigger relay if access point has relay_endpoint
  if (access_point_id) {
    const { data: accessPoint } = await supabase
      .from('nm_access_points')
      .select('relay_endpoint, relay_method, config')
      .eq('id', access_point_id)
      .eq('is_active', true)
      .single()

    if (accessPoint?.relay_endpoint) {
      try {
        const openDuration = (accessPoint.config as Record<string, number>)?.open_duration_ms || 5000
        await fetch(accessPoint.relay_endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'open', duration_ms: openDuration }),
          signal: AbortSignal.timeout(5000),
        })
      } catch {
        // Relay failure shouldn't deny access — it's already logged
        console.error('Relay trigger failed for access point', access_point_id)
      }
    }
  }

  return NextResponse.json({
    granted: true,
    user_id: credential.user_id,
    user_name: user.full_name,
    avatar_url: user.avatar_url,
    membership_type: membership.membership_type,
    membership_end: membership.membership_end,
  })
}

async function logAccess(
  supabase: ReturnType<typeof createServiceRoleClient>,
  params: {
    user_id?: string
    access_point_id?: number
    credential_type: string
    granted: boolean
    denial_reason?: string
  }
) {
  await supabase.from('nm_access_logs').insert({
    club_id: 1,
    user_id: params.user_id || null,
    access_point_id: params.access_point_id || null,
    credential_type: params.credential_type,
    direction: 'in',
    granted: params.granted,
    denial_reason: params.denial_reason || null,
  })
}
