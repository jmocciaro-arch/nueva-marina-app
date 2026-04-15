import { NextResponse } from 'next/server'
import { createServerSupabaseClient, createServiceRoleClient } from '@/lib/supabase/server'

/**
 * POST /api/profile/request
 * Body: { user_id: uuid, channel?: 'email'|'whatsapp'|'manual'|'link' }
 *
 * Admin only. Genera (o reutiliza el más reciente no usado) un token para que
 * el jugador complete su ficha desde una URL pública.
 *
 * Devuelve: { token, url, whatsapp_url, mailto_url, expires_at }
 */
export async function POST(request: Request) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const { data: member } = await supabase
    .from('nm_club_members')
    .select('role')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .single()
  if (!member || !['owner', 'admin'].includes(member.role)) {
    return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
  }

  const body = await request.json().catch(() => ({}))
  const { user_id, channel = 'link' } = body
  if (!user_id) return NextResponse.json({ error: 'Falta user_id' }, { status: 400 })

  const admin = createServiceRoleClient()
  const { data: target } = await admin
    .from('nm_users')
    .select('id, full_name, email, phone')
    .eq('id', user_id)
    .single()
  if (!target) return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 })

  // Crear nuevo pedido
  const { data: req, error } = await admin
    .from('nm_profile_requests')
    .insert({ user_id, channel, created_by: user.id })
    .select('token, expires_at')
    .single()
  if (error || !req) {
    return NextResponse.json({ error: 'No se pudo crear el pedido: ' + (error?.message ?? '?') }, { status: 500 })
  }

  const origin = request.headers.get('origin') ?? new URL(request.url).origin
  const url = `${origin}/perfil/${req.token}`
  const shortName = (target.full_name ?? '').split(' ')[0] || 'jugador'
  const message = `Hola ${shortName}! Para poder jugar la liga necesitamos que completes tu ficha (foto, DNI, datos) acá: ${url} — el link caduca en 30 días.`
  const waPhone = (target.phone ?? '').toString().replace(/[^\d]/g, '')
  const whatsappUrl = waPhone ? `https://wa.me/${waPhone}?text=${encodeURIComponent(message)}` : null
  const mailtoUrl = target.email
    ? `mailto:${target.email}?subject=${encodeURIComponent('Completá tu ficha de jugador')}&body=${encodeURIComponent(message)}`
    : null

  return NextResponse.json({
    success: true,
    token: req.token,
    url,
    whatsapp_url: whatsappUrl,
    mailto_url: mailtoUrl,
    expires_at: req.expires_at,
    target: { full_name: target.full_name, email: target.email, phone: target.phone },
  })
}
