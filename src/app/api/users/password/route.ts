import { createServiceRoleClient, createServerSupabaseClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

/**
 * Gestión de contraseñas por admin.
 *
 * POST body:
 *   { action: 'reset_email', user_id }  → manda email de reset (Supabase Auth)
 *   { action: 'set_password', user_id, new_password }  → admin setea password directo (service_role)
 *
 * Seguridad:
 * - Solo owner / admin del club
 * - NO existe forma de "leer" una contraseña existente: Supabase las guarda hasheadas.
 */
export async function POST(request: Request) {
  // Verificar que el caller sea admin
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  }

  const { data: callerMember } = await supabase
    .from('nm_club_members')
    .select('role')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .single()

  if (!callerMember || !['owner', 'admin'].includes(callerMember.role)) {
    return NextResponse.json({ error: 'Sin permisos de administrador' }, { status: 403 })
  }

  const body = await request.json()
  const { action, user_id, new_password } = body

  if (!user_id) {
    return NextResponse.json({ error: 'Falta user_id' }, { status: 400 })
  }

  const adminClient = createServiceRoleClient()

  // ── Obtener email del usuario destino ────────────────────────────────────
  const { data: targetUser, error: targetErr } = await adminClient
    .from('nm_users')
    .select('email, full_name')
    .eq('id', user_id)
    .single()

  if (targetErr || !targetUser) {
    return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 })
  }

  // ── Acción: enviar email de reset ────────────────────────────────────────
  if (action === 'reset_email') {
    // Generar link de recuperación. El email lo envía Supabase Auth.
    const { error } = await adminClient.auth.resetPasswordForEmail(targetUser.email, {
      redirectTo: `${request.headers.get('origin') ?? ''}/login`,
    })

    if (error) {
      return NextResponse.json({ error: 'Error enviando email: ' + error.message }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      message: `Email de reset enviado a ${targetUser.email}`,
    })
  }

  // ── Acción: cambiar password directo ─────────────────────────────────────
  if (action === 'set_password') {
    if (!new_password || typeof new_password !== 'string') {
      return NextResponse.json({ error: 'Falta new_password' }, { status: 400 })
    }
    if (new_password.length < 6) {
      return NextResponse.json({ error: 'La contraseña debe tener al menos 6 caracteres' }, { status: 400 })
    }

    const { error } = await adminClient.auth.admin.updateUserById(user_id, {
      password: new_password,
    })

    if (error) {
      return NextResponse.json({ error: 'Error cambiando contraseña: ' + error.message }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      message: `Contraseña actualizada para ${targetUser.full_name || targetUser.email}`,
    })
  }

  return NextResponse.json({ error: 'Acción no válida' }, { status: 400 })
}
