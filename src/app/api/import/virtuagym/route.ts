import { createServiceRoleClient } from '@/lib/supabase/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

interface VirtuagymRow {
  member_id?: string
  first_name?: string
  last_name?: string
  email?: string
  phone?: string
  date_of_birth?: string
  gender?: string
  address?: string
  postal_code?: string
  city?: string
  membership_name?: string
  membership_start?: string
  membership_end?: string
  status?: string
  // Flexible: accept any extra fields
  [key: string]: string | undefined
}

export async function POST(request: Request) {
  // Verify caller is admin
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  }

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

  // Parse request body
  const { rows, dryRun } = await request.json() as { rows: VirtuagymRow[]; dryRun?: boolean }

  if (!rows || !Array.isArray(rows) || rows.length === 0) {
    return NextResponse.json({ error: 'No se recibieron datos' }, { status: 400 })
  }

  const admin = createServiceRoleClient()
  const results: { email: string; status: 'created' | 'updated' | 'skipped' | 'error'; message?: string }[] = []

  if (dryRun) {
    // Just validate and return preview
    const valid = rows.filter(r => r.email && r.email.includes('@'))
    const invalid = rows.filter(r => !r.email || !r.email.includes('@'))
    return NextResponse.json({
      total: rows.length,
      valid: valid.length,
      invalid: invalid.length,
      invalidRows: invalid.slice(0, 10),
      preview: valid.slice(0, 5),
    })
  }

  for (const row of rows) {
    const email = row.email?.trim().toLowerCase()
    if (!email || !email.includes('@')) {
      results.push({ email: email || '(vacío)', status: 'skipped', message: 'Email inválido' })
      continue
    }

    try {
      const fullName = [row.first_name, row.last_name].filter(Boolean).join(' ') || email.split('@')[0]

      // Check if user already exists in nm_users
      const { data: existingUser } = await admin
        .from('nm_users')
        .select('id')
        .eq('email', email)
        .single()

      let userId: string

      if (existingUser) {
        // Update existing user with VG data
        userId = existingUser.id
        await admin.from('nm_users').update({
          full_name: fullName,
          first_name: row.first_name || undefined,
          last_name: row.last_name || undefined,
          phone: row.phone || undefined,
          date_of_birth: row.date_of_birth || undefined,
          gender: row.gender || undefined,
          address: row.address || undefined,
          postal_code: row.postal_code || undefined,
          city: row.city || undefined,
          virtuagym_id: row.member_id || undefined,
        }).eq('id', userId)

        results.push({ email, status: 'updated', message: 'Usuario existente actualizado' })
      } else {
        // Create auth user
        const tempPassword = `NM_${Math.random().toString(36).slice(2, 10)}!${Date.now().toString(36)}`
        const { data: authUser, error: authError } = await admin.auth.admin.createUser({
          email,
          password: tempPassword,
          email_confirm: true,
          user_metadata: { full_name: fullName },
        })

        if (authError) {
          // User might exist in auth but not in nm_users
          if (authError.message?.includes('already been registered')) {
            const { data: { users } } = await admin.auth.admin.listUsers()
            const existingAuth = users?.find((u: { email?: string }) => u.email === email)
            if (existingAuth) {
              userId = existingAuth.id
            } else {
              results.push({ email, status: 'error', message: authError.message })
              continue
            }
          } else {
            results.push({ email, status: 'error', message: authError.message })
            continue
          }
        } else {
          userId = authUser.user.id
        }

        // Create nm_users profile
        await admin.from('nm_users').upsert({
          id: userId,
          email,
          full_name: fullName,
          first_name: row.first_name || null,
          last_name: row.last_name || null,
          phone: row.phone || null,
          date_of_birth: row.date_of_birth || null,
          gender: row.gender || null,
          address: row.address || null,
          postal_code: row.postal_code || null,
          city: row.city || null,
          virtuagym_id: row.member_id || null,
        })

        // Create club membership
        await admin.from('nm_club_members').upsert({
          club_id: 1,
          user_id: userId,
          role: 'player',
          is_active: row.status?.toLowerCase() !== 'inactive',
        }, { onConflict: 'club_id,user_id' })

        // Create gym membership if VG has one
        if (row.membership_name) {
          await admin.from('nm_gym_memberships').insert({
            club_id: 1,
            user_id: userId,
            plan: row.membership_name,
            start_date: row.membership_start || new Date().toISOString().split('T')[0],
            end_date: row.membership_end || null,
            status: row.status?.toLowerCase() === 'inactive' ? 'cancelled' : 'active',
          })
        }

        // Record sync mapping
        if (row.member_id) {
          await admin.from('nm_virtuagym_sync').upsert({
            club_id: 1,
            entity_type: 'user',
            virtuagym_id: row.member_id,
            nm_entity_type: 'nm_users',
            nm_entity_id: userId,
          }, { onConflict: 'club_id,entity_type,virtuagym_id' })
        }

        results.push({ email, status: 'created' })
      }
    } catch (err) {
      results.push({ email: email || '(vacío)', status: 'error', message: String(err) })
    }
  }

  const created = results.filter(r => r.status === 'created').length
  const updated = results.filter(r => r.status === 'updated').length
  const skipped = results.filter(r => r.status === 'skipped').length
  const errors = results.filter(r => r.status === 'error').length

  return NextResponse.json({
    total: rows.length,
    created,
    updated,
    skipped,
    errors,
    results,
  })
}
