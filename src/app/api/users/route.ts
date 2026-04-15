import { createServiceRoleClient } from '@/lib/supabase/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  // Verify caller is admin
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
  const {
    email, password, full_name, phone, role,
    document_type, document_number, address, postal_code,
    emergency_contact, medical_notes, notes,
    dni, current_weight, injuries,
  } = body

  if (!email || !password || !full_name || !role) {
    return NextResponse.json({ error: 'Faltan campos obligatorios (email, password, full_name, role)' }, { status: 400 })
  }

  const adminClient = createServiceRoleClient()

  // 1. Create auth user
  const { data: authData, error: authError } = await adminClient.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name },
  })

  if (authError) {
    return NextResponse.json({ error: authError.message }, { status: 400 })
  }

  const newUserId = authData.user.id

  // 2. Create nm_users profile
  const { error: profileError } = await adminClient
    .from('nm_users')
    .insert({
      id: newUserId,
      email,
      full_name,
      phone: phone || null,
      country: 'ES',
      preferred_language: 'es',
      is_active: true,
      document_type: document_type || null,
      document_number: document_number || null,
      address: address || null,
      postal_code: postal_code || null,
      emergency_contact: emergency_contact || null,
      medical_notes: medical_notes || null,
      notes: notes || null,
      dni: dni || null,
      current_weight: current_weight ? Number(current_weight) : null,
      injuries: Array.isArray(injuries) ? injuries : [],
    })

  if (profileError) {
    // Cleanup: delete auth user if profile fails
    await adminClient.auth.admin.deleteUser(newUserId)
    return NextResponse.json({ error: 'Error creando perfil: ' + profileError.message }, { status: 500 })
  }

  // 3. Create club membership with role
  const { error: memberError } = await adminClient
    .from('nm_club_members')
    .insert({
      club_id: 1,
      user_id: newUserId,
      role,
      is_active: true,
    })

  if (memberError) {
    return NextResponse.json({ error: 'Error asignando rol: ' + memberError.message }, { status: 500 })
  }

  return NextResponse.json({ success: true, user_id: newUserId })
}

// Update user role
export async function PATCH(request: Request) {
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

  const body = await request.json()
  const {
    user_id, role, full_name, phone, document_type, document_number, address, postal_code,
    emergency_contact, medical_notes, notes, dni, current_weight, injuries,
    birth_date, dni_nie, padel_position, padel_level,
    consent_image_use, consent_data_public,
    avatar_base64, avatar_url,
  } = body

  if (!user_id) {
    return NextResponse.json({ error: 'Falta user_id' }, { status: 400 })
  }

  const isAdmin = !!callerMember && ['owner', 'admin'].includes(callerMember.role)
  const isSelf = user.id === user_id
  if (!isAdmin && !isSelf) {
    return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
  }
  // Solo admin puede cambiar rol
  if (role && !isAdmin) {
    return NextResponse.json({ error: 'No podés cambiar tu rol' }, { status: 403 })
  }

  const adminClient = createServiceRoleClient()

  // Update profile fields if provided
  const profileUpdates: Record<string, unknown> = {}
  if (full_name !== undefined) profileUpdates.full_name = full_name
  if (phone !== undefined) profileUpdates.phone = phone
  if (document_type !== undefined) profileUpdates.document_type = document_type
  if (document_number !== undefined) profileUpdates.document_number = document_number
  if (address !== undefined) profileUpdates.address = address
  if (postal_code !== undefined) profileUpdates.postal_code = postal_code
  if (emergency_contact !== undefined) profileUpdates.emergency_contact = emergency_contact
  if (medical_notes !== undefined) profileUpdates.medical_notes = medical_notes
  if (notes !== undefined) profileUpdates.notes = notes
  if (dni !== undefined) profileUpdates.dni = dni
  if (current_weight !== undefined) profileUpdates.current_weight = current_weight === null || current_weight === '' ? null : Number(current_weight)
  if (injuries !== undefined) profileUpdates.injuries = Array.isArray(injuries) ? injuries : []
  if (birth_date !== undefined) profileUpdates.birth_date = birth_date || null
  if (dni_nie !== undefined) profileUpdates.dni_nie = dni_nie || null
  if (padel_position !== undefined) profileUpdates.padel_position = padel_position || null
  if (padel_level !== undefined) profileUpdates.padel_level = padel_level || null
  if (consent_image_use !== undefined) profileUpdates.consent_image_use = consent_image_use
  if (consent_data_public !== undefined) profileUpdates.consent_data_public = consent_data_public
  if (avatar_url !== undefined) profileUpdates.avatar_url = avatar_url

  // Avatar upload (base64 data URL)
  if (avatar_base64 && typeof avatar_base64 === 'string' && avatar_base64.startsWith('data:image/')) {
    const match = /^data:(image\/(?:jpeg|jpg|png|webp));base64,(.+)$/.exec(avatar_base64)
    if (match) {
      const mime = match[1]
      const ext = mime.includes('png') ? 'png' : mime.includes('webp') ? 'webp' : 'jpg'
      const buf = Buffer.from(match[2], 'base64')
      if (buf.byteLength > 5 * 1024 * 1024) {
        return NextResponse.json({ error: 'La foto pesa más de 5MB' }, { status: 400 })
      }
      const path = `${user_id}/${Date.now()}.${ext}`
      const { error: upErr } = await adminClient.storage.from('avatars').upload(path, buf, { contentType: mime, upsert: true })
      if (upErr) {
        return NextResponse.json({ error: 'Error subiendo foto: ' + upErr.message }, { status: 500 })
      }
      const { data: pub } = adminClient.storage.from('avatars').getPublicUrl(path)
      profileUpdates.avatar_url = pub.publicUrl
    }
  }

  if (Object.keys(profileUpdates).length > 0) {
    const { error } = await adminClient.from('nm_users').update(profileUpdates).eq('id', user_id)
    if (error) {
      return NextResponse.json({ error: 'Error actualizando perfil: ' + error.message }, { status: 500 })
    }
  }

  // Update role if provided
  if (role) {
    const { error } = await adminClient
      .from('nm_club_members')
      .update({ role })
      .eq('user_id', user_id)
      .eq('club_id', 1)

    if (error) {
      return NextResponse.json({ error: 'Error actualizando rol: ' + error.message }, { status: 500 })
    }
  }

  return NextResponse.json({ success: true })
}
