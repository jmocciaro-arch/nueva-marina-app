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
  // Nuevos campos capturados del export Virtuagym
  document_number?: string  // DNI/NIE
  vat_number?: string       // NIF empresa
  iban?: string
  card_number?: string      // RFID card
  tags?: string
  registration_date?: string
  last_check_in?: string
  // Flexible: accept any extra fields
  [key: string]: string | undefined
}

/** Convierte fecha "DD-MM-YYYY" o "DD-MM-YYYY HH:MM:SS" a ISO "YYYY-MM-DD". Null si inválida. */
function toIsoDate(input: string | undefined): string | null {
  if (!input || input.trim() === '' || input === '-') return null
  // Ya está en formato ISO
  if (/^\d{4}-\d{2}-\d{2}/.test(input)) return input.slice(0, 10)
  // Formato Virtuagym: DD-MM-YYYY
  const m = input.match(/^(\d{2})-(\d{2})-(\d{4})/)
  if (m) return `${m[3]}-${m[2]}-${m[1]}`
  return null
}

/** Detecta el tipo de documento por el patrón. */
function detectDocumentType(doc: string | undefined): string | null {
  if (!doc) return null
  const clean = doc.trim().toUpperCase()
  if (/^[XYZ]\d{7,8}[A-Z]$/.test(clean)) return 'NIE'
  if (/^\d{8}[A-Z]$/.test(clean)) return 'DNI'
  if (/^[A-Z]\d{8}$/.test(clean)) return 'NIF'
  return clean.length > 4 ? 'OTRO' : null
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

      // Preparar datos comunes (para create y update)
      const docNumber = row.document_number?.trim() || undefined
      const docType = detectDocumentType(docNumber) || (row.vat_number ? 'NIF' : null)
      const vatAsDoc = !docNumber && row.vat_number ? row.vat_number.trim() : undefined
      const birth = toIsoDate(row.date_of_birth)
      const memberSince = toIsoDate(row.membership_start)
      const memberEnd = toIsoDate(row.membership_end)

      // Notas: concatenamos datos útiles no mapeados (tags, registration_date, last_check_in)
      const noteParts: string[] = []
      if (row.tags && row.tags !== '-') noteParts.push(`Tags: ${row.tags}`)
      if (row.registration_date) noteParts.push(`Alta VG: ${row.registration_date}`)
      if (row.last_check_in && row.last_check_in !== '-') noteParts.push(`Último check-in: ${row.last_check_in}`)
      const notes = noteParts.length > 0 ? noteParts.join(' · ') : undefined

      if (existingUser) {
        // Update existing user with VG data
        userId = existingUser.id
        await admin.from('nm_users').update({
          full_name: fullName,
          first_name: row.first_name || undefined,
          last_name: row.last_name || undefined,
          phone: row.phone || undefined,
          date_of_birth: birth || undefined,
          birth_date: birth || undefined,
          gender: row.gender || undefined,
          address: row.address || undefined,
          postal_code: row.postal_code || undefined,
          city: row.city || undefined,
          virtuagym_id: row.member_id || undefined,
          document_number: docNumber || vatAsDoc || undefined,
          document_type: docType || undefined,
          dni_nie: docNumber || undefined,
          iban: row.iban || undefined,
          notes: notes,
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
          date_of_birth: birth,
          birth_date: birth,
          gender: row.gender || null,
          address: row.address || null,
          postal_code: row.postal_code || null,
          city: row.city || null,
          virtuagym_id: row.member_id || null,
          document_number: docNumber || vatAsDoc || null,
          document_type: docType || null,
          dni_nie: docNumber || null,
          iban: row.iban || null,
          notes: notes || null,
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
            start_date: memberSince || new Date().toISOString().split('T')[0],
            end_date: memberEnd,
            status: row.status?.toLowerCase() === 'inactive' ? 'cancelled' : 'active',
          })
        }

        // Tarjeta RFID → guardar en credenciales de acceso
        if (row.card_number && row.card_number !== '-' && row.card_number.trim() !== '') {
          await admin.from('nm_access_credentials').upsert({
            club_id: 1,
            user_id: userId,
            type: 'rfid',
            credential_data: row.card_number.trim(),
            is_active: true,
          }, { onConflict: 'club_id,user_id,type' })
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
