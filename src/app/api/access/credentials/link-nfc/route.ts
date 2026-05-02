import { createServerSupabaseClient, createServiceRoleClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

/**
 * POST /api/access/credentials/link-nfc
 * Vincula un tag NFC (UID en hex) a un usuario. Solo admins.
 *
 * Body: { user_id: string, uid: string }
 * - El UID se normaliza a mayúsculas, sin separadores.
 * - Si ya hay una credencial NFC para ese usuario, se reemplaza (upsert).
 * - Si el UID ya está vinculado a OTRO usuario, devuelve 409.
 */
export async function POST(request: Request) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  }

  // Solo admin u owner puede vincular tags
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

  const body = await request.json().catch(() => ({}))
  const targetUserId: string | undefined = body.user_id
  const rawUid: string | undefined = body.uid

  if (!targetUserId || !rawUid) {
    return NextResponse.json({ error: 'Faltan user_id o uid' }, { status: 400 })
  }

  // Normalizar UID: mayúsculas, sin espacios ni dos puntos ni guiones
  const uid = rawUid.replace(/[\s:-]/g, '').toUpperCase()
  if (!/^[0-9A-F]+$/.test(uid) || uid.length < 8 || uid.length > 32) {
    return NextResponse.json({ error: 'UID inválido (debe ser hexadecimal de 8 a 32 caracteres)' }, { status: 400 })
  }

  const admin = createServiceRoleClient()

  // Chequear conflicto: ¿este UID ya está vinculado a otro usuario?
  const { data: existing } = await admin
    .from('nm_access_credentials')
    .select('id, user_id')
    .eq('club_id', 1)
    .eq('type', 'nfc')
    .eq('credential_data', uid)
    .maybeSingle()

  if (existing && existing.user_id !== targetUserId) {
    return NextResponse.json({
      error: 'Este tag ya está vinculado a otro socio',
      existing_user_id: existing.user_id,
    }, { status: 409 })
  }

  // Upsert: un usuario tiene como máximo 1 credencial NFC (por la UNIQUE de la tabla)
  const { data: credential, error } = await admin
    .from('nm_access_credentials')
    .upsert({
      club_id: 1,
      user_id: targetUserId,
      type: 'nfc',
      credential_data: uid,
      is_active: true,
      expires_at: null,
    }, { onConflict: 'club_id,user_id,type' })
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({
    credential_id: credential.id,
    user_id: targetUserId,
    uid,
  })
}
