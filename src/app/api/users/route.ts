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

  if (!callerMember || !['owner', 'admin'].includes(callerMember.role)) {
    return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
  }

  const body = await request.json()
  const { user_id, role, full_name, phone, document_type, document_number, address, postal_code, emergency_contact, medical_notes, notes, dni, current_weight, injuries } = body

  if (!user_id) {
    return NextResponse.json({ error: 'Falta user_id' }, { status: 400 })
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
