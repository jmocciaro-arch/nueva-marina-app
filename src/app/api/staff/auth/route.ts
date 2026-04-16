import { createServiceRoleClient, createServerSupabaseClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { createHash } from 'crypto'

function hashCredential(value: string): string {
  return createHash('sha256').update(value).digest('hex')
}

/**
 * POST /api/staff/auth
 * Authenticate staff member via credential (PIN, NFC tag, etc.)
 * Body: { type: 'pin'|'nfc'|'fingerprint'|'facial', credential: string, action: 'clock_in'|'clock_out'|'break_start'|'break_end' }
 *
 * Returns: { success, user, shift, message }
 */
export async function POST(request: Request) {
  const body = await request.json()
  const { type, credential, action } = body

  if (!type || !credential || !action) {
    return NextResponse.json({ error: 'Faltan campos requeridos' }, { status: 400 })
  }

  const admin = createServiceRoleClient()
  const hashed = type === 'pin' ? hashCredential(credential) : credential

  // Find matching credential
  const { data: cred } = await admin
    .from('nm_staff_credentials')
    .select('id, user_id, type, is_active, expires_at')
    .eq('type', type)
    .eq('credential_data', hashed)
    .eq('is_active', true)
    .single()

  if (!cred) {
    return NextResponse.json({
      success: false,
      error: 'Credencial no reconocida',
    }, { status: 401 })
  }

  // Check expiration
  if (cred.expires_at && new Date(cred.expires_at) < new Date()) {
    return NextResponse.json({
      success: false,
      error: 'Credencial expirada',
    }, { status: 401 })
  }

  // Get user info
  const { data: userInfo } = await admin
    .from('nm_users')
    .select('id, full_name, email')
    .eq('id', cred.user_id)
    .single()

  if (!userInfo) {
    return NextResponse.json({ success: false, error: 'Usuario no encontrado' }, { status: 404 })
  }

  // Update last_used_at
  await admin
    .from('nm_staff_credentials')
    .update({ last_used_at: new Date().toISOString() })
    .eq('id', cred.id)

  const today = new Date().toISOString().split('T')[0]
  const now = new Date().toISOString()

  // Find today's shift for this user
  const { data: existingShift } = await admin
    .from('nm_staff_shifts')
    .select('*')
    .eq('user_id', cred.user_id)
    .eq('date', today)
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  let shift = existingShift
  let message = ''

  switch (action) {
    case 'clock_in': {
      if (shift && shift.status === 'active') {
        return NextResponse.json({
          success: false,
          error: 'Ya tenés un turno activo',
          shift,
          user: userInfo,
        })
      }

      if (shift && shift.check_in && !shift.check_out) {
        // Already clocked in today
        return NextResponse.json({
          success: false,
          error: 'Ya fichaste entrada hoy',
          shift,
          user: userInfo,
        })
      }

      // Create or update shift
      if (shift) {
        const { data: updated } = await admin
          .from('nm_staff_shifts')
          .update({
            check_in: now,
            status: 'active',
            auth_method: type,
          })
          .eq('id', shift.id)
          .select()
          .single()
        shift = updated
      } else {
        const { data: created } = await admin
          .from('nm_staff_shifts')
          .insert({
            club_id: 1,
            user_id: cred.user_id,
            date: today,
            check_in: now,
            status: 'active',
            auth_method: type,
            shift_type: 'regular',
          })
          .select()
          .single()
        shift = created
      }
      message = `Entrada registrada: ${userInfo.full_name}`
      break
    }

    case 'clock_out': {
      if (!shift || shift.status !== 'active') {
        return NextResponse.json({
          success: false,
          error: 'No hay turno activo para cerrar',
          user: userInfo,
        })
      }

      const { data: updated } = await admin
        .from('nm_staff_shifts')
        .update({
          check_out: now,
          status: 'completed',
        })
        .eq('id', shift.id)
        .select()
        .single()
      shift = updated
      message = `Salida registrada: ${userInfo.full_name}`
      break
    }

    case 'break_start': {
      if (!shift || shift.status !== 'active') {
        return NextResponse.json({
          success: false,
          error: 'No hay turno activo',
          user: userInfo,
        })
      }

      const { data: updated } = await admin
        .from('nm_staff_shifts')
        .update({ break_start: now })
        .eq('id', shift.id)
        .select()
        .single()
      shift = updated
      message = `Pausa iniciada: ${userInfo.full_name}`
      break
    }

    case 'break_end': {
      if (!shift || !shift.break_start) {
        return NextResponse.json({
          success: false,
          error: 'No hay pausa activa',
          user: userInfo,
        })
      }

      const breakStart = new Date(shift.break_start as string).getTime()
      const breakDuration = Math.floor((Date.now() - breakStart) / 60000)
      const totalBreak = (shift.break_minutes || 0) + breakDuration

      const { data: updated } = await admin
        .from('nm_staff_shifts')
        .update({
          break_end: now,
          break_minutes: totalBreak,
        })
        .eq('id', shift.id)
        .select()
        .single()
      shift = updated
      message = `Pausa finalizada (${breakDuration} min): ${userInfo.full_name}`
      break
    }

    default:
      return NextResponse.json({ error: 'Acción inválida' }, { status: 400 })
  }

  return NextResponse.json({
    success: true,
    message,
    user: userInfo,
    shift,
    auth_method: type,
  })
}

/**
 * PUT /api/staff/auth
 * Register a new credential for a staff member
 * Body: { user_id: string, type: 'pin'|'nfc'|'fingerprint'|'facial', credential: string }
 * Requires admin auth
 */
export async function PUT(request: Request) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  // Check admin
  const { data: membership } = await supabase
    .from('nm_club_members')
    .select('role')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .in('role', ['owner', 'admin'])
    .single()
  if (!membership) return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

  const body = await request.json()
  const { user_id, type, credential } = body

  if (!user_id || !type || !credential) {
    return NextResponse.json({ error: 'Faltan campos' }, { status: 400 })
  }

  const admin = createServiceRoleClient()
  const hashed = type === 'pin' ? hashCredential(credential) : credential

  // Upsert (deactivate old, create new)
  await admin
    .from('nm_staff_credentials')
    .update({ is_active: false })
    .eq('user_id', user_id)
    .eq('type', type)

  const { data, error } = await admin
    .from('nm_staff_credentials')
    .insert({
      club_id: 1,
      user_id,
      type,
      credential_data: hashed,
      is_active: true,
    })
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true, credential: data })
}
