import { createServiceRoleClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

/**
 * POST /api/access/relay
 * Called by hardware (Raspberry Pi, ESP32) after reading a credential.
 * The hardware sends: { hardware_id, credential_type, credential_data }
 * We look up the access point by hardware_id, validate, and respond with open/deny.
 *
 * This is a simplified webhook for dumb scanners that can only POST what they read.
 */
export async function POST(request: Request) {
  const body = await request.json()
  const { hardware_id, credential_type, credential_data } = body

  if (!hardware_id || !credential_data) {
    return NextResponse.json({ action: 'deny', reason: 'missing_fields' }, { status: 400 })
  }

  const supabase = createServiceRoleClient()

  // Find the access point by hardware_id
  const { data: accessPoint } = await supabase
    .from('nm_access_points')
    .select('id')
    .eq('hardware_id', hardware_id)
    .eq('club_id', 1)
    .eq('is_active', true)
    .single()

  if (!accessPoint) {
    return NextResponse.json({ action: 'deny', reason: 'unknown_hardware' }, { status: 404 })
  }

  // Proxy to the validate endpoint
  const origin = request.headers.get('origin') || process.env.NEXT_PUBLIC_APP_URL || 'https://nuevamarina.es'
  const validateRes = await fetch(`${origin}/api/access/validate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      credential_type: credential_type || 'qr',
      credential_data,
      access_point_id: accessPoint.id,
    }),
  })

  const result = await validateRes.json()

  if (result.granted) {
    return NextResponse.json({
      action: 'open',
      user_name: result.user_name,
      duration_ms: 5000,
    })
  }

  return NextResponse.json({
    action: 'deny',
    reason: result.reason,
  })
}
