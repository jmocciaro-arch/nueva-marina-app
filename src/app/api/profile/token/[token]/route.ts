import { NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/server'

/**
 * Endpoint público (acceso por token) para que el jugador complete su ficha.
 *
 * GET  /api/profile/token/[token] → devuelve los datos actuales del usuario
 * POST /api/profile/token/[token] → actualiza la ficha (datos + consentimientos + avatar)
 */

async function resolveToken(token: string) {
  const admin = createServiceRoleClient()
  const { data: req } = await admin
    .from('nm_profile_requests')
    .select('id, user_id, expires_at, completed_at')
    .eq('token', token)
    .single()
  if (!req) return { error: 'Link inválido o caducado' as const }
  if (req.completed_at) return { error: 'Esta ficha ya fue completada' as const }
  if (new Date(req.expires_at).getTime() < Date.now()) return { error: 'Link caducado' as const }
  return { req, admin }
}

export async function GET(_req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const r = await resolveToken(token)
  if ('error' in r) return NextResponse.json({ error: r.error }, { status: 410 })
  const { data: user } = await r.admin
    .from('nm_users')
    .select('id, full_name, email, phone, avatar_url, birth_date, dni_nie, address, postal_code, padel_position, padel_level, emergency_contact, medical_notes, consent_image_use, consent_data_public')
    .eq('id', r.req.user_id)
    .single()
  return NextResponse.json({ user })
}

export async function POST(request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const r = await resolveToken(token)
  if ('error' in r) return NextResponse.json({ error: r.error }, { status: 410 })

  const body = await request.json()
  const {
    full_name, phone, birth_date, dni_nie,
    address, postal_code, padel_position, padel_level,
    emergency_contact, medical_notes,
    consent_image_use, consent_data_public,
    avatar_base64, // data URL (image/jpeg;base64,...) opcional
  } = body

  // Validaciones mínimas
  if (typeof consent_image_use !== 'boolean' || typeof consent_data_public !== 'boolean') {
    return NextResponse.json({ error: 'Tenés que aceptar o rechazar los consentimientos (son obligatorios)' }, { status: 400 })
  }

  const admin = r.admin
  let avatarUrl: string | null = null

  if (avatar_base64 && typeof avatar_base64 === 'string' && avatar_base64.startsWith('data:image/')) {
    try {
      const match = /^data:(image\/(?:jpeg|jpg|png|webp));base64,(.+)$/.exec(avatar_base64)
      if (match) {
        const mime = match[1]
        const ext = mime.includes('png') ? 'png' : mime.includes('webp') ? 'webp' : 'jpg'
        const buf = Buffer.from(match[2], 'base64')
        if (buf.byteLength > 5 * 1024 * 1024) {
          return NextResponse.json({ error: 'La foto pesa más de 5MB. Subí una más chica.' }, { status: 400 })
        }
        const path = `${r.req.user_id}/${Date.now()}.${ext}`
        const { error: upErr } = await admin.storage.from('avatars').upload(path, buf, {
          contentType: mime, upsert: true,
        })
        if (upErr) {
          return NextResponse.json({ error: 'Error subiendo la foto: ' + upErr.message }, { status: 500 })
        }
        const { data: pub } = admin.storage.from('avatars').getPublicUrl(path)
        avatarUrl = pub.publicUrl
      }
    } catch (e) {
      return NextResponse.json({ error: 'Foto inválida: ' + (e as Error).message }, { status: 400 })
    }
  }

  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || null

  const updates: Record<string, unknown> = {
    full_name: full_name || undefined,
    phone: phone || null,
    birth_date: birth_date || null,
    dni_nie: dni_nie || null,
    address: address || null,
    postal_code: postal_code || null,
    padel_position: padel_position || null,
    padel_level: padel_level || null,
    emergency_contact: emergency_contact || null,
    medical_notes: medical_notes || null,
    consent_image_use,
    consent_data_public,
    consent_accepted_at: new Date().toISOString(),
    consent_ip: ip,
    profile_completed_at: new Date().toISOString(),
  }
  if (avatarUrl) updates.avatar_url = avatarUrl
  // Limpiar undefined (Supabase los rechaza en update)
  Object.keys(updates).forEach(k => updates[k] === undefined && delete updates[k])

  const { error: updErr } = await admin.from('nm_users').update(updates).eq('id', r.req.user_id)
  if (updErr) return NextResponse.json({ error: 'Error actualizando: ' + updErr.message }, { status: 500 })

  await admin.from('nm_profile_requests').update({ completed_at: new Date().toISOString() }).eq('id', r.req.id)

  return NextResponse.json({ success: true })
}
