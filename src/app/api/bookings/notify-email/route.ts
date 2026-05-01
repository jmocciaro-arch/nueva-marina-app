import { NextResponse } from 'next/server'
import { Resend } from 'resend'
import { createServerSupabaseClient } from '@/lib/supabase/server'

type EventType = 'created' | 'confirmed' | 'cancelled' | 'updated' | 'assigned'

export async function POST(req: Request) {
  let payload: { booking_id?: number; event_type?: EventType }
  try {
    payload = await req.json()
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 })
  }

  const { booking_id, event_type = 'created' } = payload
  if (!booking_id) {
    return NextResponse.json({ error: 'missing_booking_id' }, { status: 400 })
  }

  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: 'resend_not_configured' }, { status: 503 })
  }

  const supabase = await createServerSupabaseClient()

  const { data: booking, error: bookingError } = await supabase
    .from('nm_bookings')
    .select('id, court_id, date, start_time, end_time, status, booked_by, price, notes, court:nm_courts(name, color)')
    .eq('id', booking_id)
    .maybeSingle()

  if (bookingError || !booking) {
    return NextResponse.json({ error: 'booking_not_found' }, { status: 404 })
  }

  if (!booking.booked_by) {
    return NextResponse.json({ skipped: 'booking_has_no_user' })
  }

  const { data: user } = await supabase
    .from('nm_users')
    .select('email, full_name, first_name')
    .eq('id', booking.booked_by)
    .maybeSingle()

  if (!user?.email) {
    return NextResponse.json({ skipped: 'user_has_no_email' })
  }

  const court = Array.isArray(booking.court) ? booking.court[0] : booking.court
  const courtName = court?.name ?? `Pista ${booking.court_id}`
  const courtColor = court?.color ?? '#06b6d4'
  const displayName = user.first_name || user.full_name?.split(' ')[0] || 'jugador'

  const fromEmail = process.env.RESEND_FROM_EMAIL || 'Nueva Marina <onboarding@resend.dev>'
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://nueva-marina-app.vercel.app'

  const subject = subjectForEvent(event_type, courtName, booking.date)
  const html = renderEmailHtml({
    event: event_type,
    name: displayName,
    courtName,
    courtColor,
    date: formatDateEs(booking.date),
    startTime: booking.start_time.slice(0, 5),
    endTime: booking.end_time.slice(0, 5),
    appUrl,
    notes: booking.notes,
    price: booking.price,
  })

  const resend = new Resend(apiKey)
  const { error: emailError } = await resend.emails.send({
    from: fromEmail,
    to: user.email,
    subject,
    html,
  })

  if (emailError) {
    console.error('[notify-email] Resend error:', emailError)
    return NextResponse.json({ error: 'send_failed', detail: emailError.message }, { status: 502 })
  }

  return NextResponse.json({ ok: true })
}

function subjectForEvent(event: EventType, courtName: string, date: string): string {
  const fecha = formatDateEs(date)
  switch (event) {
    case 'cancelled': return `Reserva cancelada · ${courtName} · ${fecha}`
    case 'updated':   return `Tu reserva se modificó · ${courtName} · ${fecha}`
    case 'confirmed': return `Reserva confirmada · ${courtName} · ${fecha}`
    case 'assigned':  return `Te asignaron una reserva · ${courtName} · ${fecha}`
    default:          return `Reserva confirmada · ${courtName} · ${fecha}`
  }
}

function formatDateEs(iso: string): string {
  const d = new Date(iso + 'T12:00:00')
  return d.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })
}

function renderEmailHtml(params: {
  event: EventType
  name: string
  courtName: string
  courtColor: string
  date: string
  startTime: string
  endTime: string
  appUrl: string
  notes: string | null
  price: number | null
}): string {
  const { event, name, courtName, courtColor, date, startTime, endTime, appUrl, notes, price } = params

  const headline = {
    cancelled: 'Tu reserva fue cancelada',
    updated:   'Tu reserva se actualizó',
    confirmed: '¡Reserva confirmada!',
    assigned:  'Te asignaron una reserva',
    created:   '¡Reserva confirmada!',
  }[event]

  const intro = {
    cancelled: 'Lamentamos avisarte que tu reserva fue cancelada. Si fue un error, contactá con el club para coordinar otro horario.',
    updated:   'Te confirmamos los nuevos datos de tu reserva.',
    confirmed: 'Te esperamos en la pista. Si necesitás cancelar, hacelo con al menos 2 horas de anticipación.',
    assigned:  'Alguien del club te incluyó en una reserva. Acá tenés los detalles.',
    created:   'Te esperamos en la pista. Si necesitás cancelar, hacelo con al menos 2 horas de anticipación.',
  }[event]

  const accentColor = event === 'cancelled' ? '#ef4444' : courtColor

  const priceRow = price != null
    ? `<tr><td style="padding:6px 0;color:#94a3b8;font-size:13px;">Precio</td><td style="padding:6px 0;color:#fff;font-weight:600;text-align:right;">€ ${price.toFixed(2)}</td></tr>`
    : ''

  const notesRow = notes
    ? `<tr><td style="padding:6px 0;color:#94a3b8;font-size:13px;">Notas</td><td style="padding:6px 0;color:#cbd5e1;font-size:13px;text-align:right;">${escapeHtml(notes)}</td></tr>`
    : ''

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${headline}</title>
</head>
<body style="margin:0;padding:0;background:#0f172a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Oxygen,Ubuntu,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0f172a;padding:40px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#1e293b;border-radius:16px;overflow:hidden;border:1px solid #334155;">
          <tr>
            <td style="height:6px;background:${accentColor};"></td>
          </tr>
          <tr>
            <td style="padding:32px 32px 8px 32px;">
              <h1 style="margin:0 0 8px 0;color:#fff;font-size:22px;font-weight:700;letter-spacing:-0.01em;">${headline}</h1>
              <p style="margin:0;color:#94a3b8;font-size:14px;line-height:1.5;">Hola ${escapeHtml(name)}, ${intro}</p>
            </td>
          </tr>
          <tr>
            <td style="padding:24px 32px 8px 32px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0f172a;border-radius:12px;padding:20px;">
                <tr>
                  <td style="padding:6px 0;color:#94a3b8;font-size:13px;">Pista</td>
                  <td style="padding:6px 0;color:#fff;font-weight:600;text-align:right;">
                    <span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${courtColor};margin-right:6px;vertical-align:middle;"></span>${escapeHtml(courtName)}
                  </td>
                </tr>
                <tr>
                  <td style="padding:6px 0;color:#94a3b8;font-size:13px;">Día</td>
                  <td style="padding:6px 0;color:#fff;font-weight:600;text-align:right;text-transform:capitalize;">${escapeHtml(date)}</td>
                </tr>
                <tr>
                  <td style="padding:6px 0;color:#94a3b8;font-size:13px;">Horario</td>
                  <td style="padding:6px 0;color:#fff;font-weight:600;text-align:right;">${startTime} - ${endTime}</td>
                </tr>
                ${priceRow}
                ${notesRow}
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:24px 32px 32px 32px;" align="center">
              <a href="${appUrl}/mis-reservas" style="display:inline-block;background:${accentColor};color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px;">Ver en la app</a>
            </td>
          </tr>
          <tr>
            <td style="padding:0 32px 24px 32px;border-top:1px solid #334155;padding-top:20px;">
              <p style="margin:0;color:#64748b;font-size:12px;line-height:1.5;text-align:center;">
                Recibís este email porque tenés una cuenta en Nueva Marina Pádel & Sport.<br/>
                Si tenés dudas, respondé este email y te ayudamos.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}
