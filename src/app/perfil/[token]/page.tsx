'use client'

import { useEffect, useRef, useState } from 'react'
import { useParams } from 'next/navigation'
import { Camera, Check, Loader2, Shield, User as UserIcon, AlertTriangle } from 'lucide-react'

interface UserData {
  id: string
  full_name: string | null
  email: string | null
  phone: string | null
  avatar_url: string | null
  birth_date: string | null
  dni_nie: string | null
  address: string | null
  postal_code: string | null
  padel_position: 'drive' | 'reves' | 'ambos' | null
  padel_level: string | null
  emergency_contact: string | null
  medical_notes: string | null
  consent_image_use: boolean | null
  consent_data_public: boolean | null
}

export default function PerfilTokenPage() {
  const params = useParams<{ token: string }>()
  const token = params.token

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [success, setSuccess] = useState(false)
  const [user, setUser] = useState<UserData | null>(null)

  // form state
  const [fullName, setFullName] = useState('')
  const [phone, setPhone] = useState('')
  const [birthDate, setBirthDate] = useState('')
  const [dniNie, setDniNie] = useState('')
  const [address, setAddress] = useState('')
  const [postalCode, setPostalCode] = useState('')
  const [padelPosition, setPadelPosition] = useState<'drive' | 'reves' | 'ambos' | ''>('')
  const [padelLevel, setPadelLevel] = useState('')
  const [emergencyContact, setEmergencyContact] = useState('')
  const [medicalNotes, setMedicalNotes] = useState('')
  const [consentImage, setConsentImage] = useState<boolean | null>(null)
  const [consentData, setConsentData] = useState<boolean | null>(null)
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null)
  const [avatarBase64, setAvatarBase64] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!token) return
    fetch(`/api/profile/token/${token}`)
      .then(async r => {
        const j = await r.json()
        if (!r.ok) throw new Error(j.error ?? 'Error')
        const u = j.user as UserData
        setUser(u)
        setFullName(u.full_name ?? '')
        setPhone(u.phone ?? '')
        setBirthDate(u.birth_date ?? '')
        setDniNie(u.dni_nie ?? '')
        setAddress(u.address ?? '')
        setPostalCode(u.postal_code ?? '')
        setPadelPosition((u.padel_position as 'drive' | 'reves' | 'ambos' | null) ?? '')
        setPadelLevel(u.padel_level ?? '')
        setEmergencyContact(u.emergency_contact ?? '')
        setMedicalNotes(u.medical_notes ?? '')
        setConsentImage(u.consent_image_use)
        setConsentData(u.consent_data_public)
        setAvatarPreview(u.avatar_url)
      })
      .catch(e => setError((e as Error).message))
      .finally(() => setLoading(false))
  }, [token])

  async function onPickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    if (!f) return
    if (f.size > 8 * 1024 * 1024) {
      alert('La foto pesa más de 8MB, elegí una más chica.')
      return
    }
    // resize a ~720px max para bajar peso
    const dataUrl = await resizeImage(f, 720)
    setAvatarPreview(dataUrl)
    setAvatarBase64(dataUrl)
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (consentImage === null || consentData === null) {
      alert('Tenés que responder a los dos consentimientos (Sí o No).')
      return
    }
    if (!fullName.trim()) {
      alert('Poné tu nombre completo.')
      return
    }
    setSaving(true)
    try {
      const res = await fetch(`/api/profile/token/${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          full_name: fullName.trim(),
          phone: phone.trim() || null,
          birth_date: birthDate || null,
          dni_nie: dniNie.trim() || null,
          address: address.trim() || null,
          postal_code: postalCode.trim() || null,
          padel_position: padelPosition || null,
          padel_level: padelLevel.trim() || null,
          emergency_contact: emergencyContact.trim() || null,
          medical_notes: medicalNotes.trim() || null,
          consent_image_use: consentImage,
          consent_data_public: consentData,
          avatar_base64: avatarBase64,
        }),
      })
      const j = await res.json()
      if (!res.ok) throw new Error(j.error ?? 'Error')
      setSuccess(true)
    } catch (err) {
      alert('Error: ' + (err as Error).message)
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950 text-white">
        <Loader2 className="animate-spin" size={32} />
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950 p-4">
        <div className="max-w-md w-full bg-slate-900 border border-red-500/30 rounded-2xl p-6 text-center">
          <AlertTriangle size={40} className="text-red-400 mx-auto mb-3" />
          <h1 className="text-xl font-bold text-white mb-2">Link no disponible</h1>
          <p className="text-slate-300">{error}</p>
          <p className="text-xs text-slate-500 mt-4">Si creés que es un error, contactá con el club.</p>
        </div>
      </div>
    )
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950 p-4">
        <div className="max-w-md w-full bg-slate-900 border border-green-500/30 rounded-2xl p-6 text-center">
          <div className="w-16 h-16 rounded-full bg-green-500/20 flex items-center justify-center mx-auto mb-3">
            <Check size={32} className="text-green-400" />
          </div>
          <h1 className="text-xl font-bold text-white mb-2">¡Ficha completada!</h1>
          <p className="text-slate-300">Gracias {fullName.split(' ')[0] || ''}, ya podemos inscribirte en la liga.</p>
          <p className="text-xs text-slate-500 mt-4">Podés cerrar esta página.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white pb-24">
      {/* Header */}
      <div className="bg-gradient-to-br from-cyan-900 to-slate-900 border-b border-cyan-500/20 px-4 py-5">
        <div className="max-w-xl mx-auto">
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <UserIcon size={26} className="text-cyan-400" /> Completá tu ficha
          </h1>
          <p className="text-sm text-slate-300 mt-1">
            Para poder jugar la liga necesitamos unos datos. Te toma menos de 2 minutos.
          </p>
        </div>
      </div>

      <form onSubmit={onSubmit} className="max-w-xl mx-auto px-4 py-6 space-y-6">
        {/* Foto */}
        <Section title="Foto de perfil" subtitle="Una foto tuya, así te reconocen en la web del club.">
          <div className="flex items-center gap-4">
            <div className="w-24 h-24 rounded-full bg-slate-800 border-2 border-slate-700 overflow-hidden flex items-center justify-center">
              {avatarPreview ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={avatarPreview} alt="avatar" className="w-full h-full object-cover" />
              ) : (
                <Camera size={32} className="text-slate-500" />
              )}
            </div>
            <div>
              <input
                ref={fileRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                capture="user"
                onChange={onPickFile}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="px-4 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-sm font-medium flex items-center gap-2"
              >
                <Camera size={16} /> {avatarPreview ? 'Cambiar foto' : 'Sacar / subir foto'}
              </button>
              <p className="text-xs text-slate-500 mt-1">JPG, PNG o WEBP · máx 8MB</p>
            </div>
          </div>
        </Section>

        {/* Datos personales */}
        <Section title="Datos personales">
          <Field label="Nombre completo *">
            <input value={fullName} onChange={e => setFullName(e.target.value)} required className={inputCls} placeholder="Juan Pérez" />
          </Field>
          <Field label="Email">
            <input value={user?.email ?? ''} disabled className={`${inputCls} opacity-60`} />
          </Field>
          <Field label="Teléfono">
            <input value={phone} onChange={e => setPhone(e.target.value)} type="tel" className={inputCls} placeholder="+34 600 000 000" />
          </Field>
          <Field label="Fecha de nacimiento">
            <input value={birthDate} onChange={e => setBirthDate(e.target.value)} type="date" className={inputCls} />
          </Field>
          <Field label="DNI / NIE">
            <input value={dniNie} onChange={e => setDniNie(e.target.value)} className={inputCls} placeholder="12345678X" />
          </Field>
          <Field label="Dirección">
            <input value={address} onChange={e => setAddress(e.target.value)} className={inputCls} placeholder="Calle, número, piso" />
          </Field>
          <Field label="Código postal">
            <input value={postalCode} onChange={e => setPostalCode(e.target.value)} className={inputCls} placeholder="18001" />
          </Field>
        </Section>

        {/* Pádel */}
        <Section title="Pádel" subtitle="Para armar parejas y categorías.">
          <Field label="Posición">
            <div className="grid grid-cols-3 gap-2">
              {([
                ['drive', 'Drive'],
                ['reves', 'Revés'],
                ['ambos', 'Ambos'],
              ] as const).map(([val, lbl]) => (
                <button
                  key={val}
                  type="button"
                  onClick={() => setPadelPosition(val)}
                  className={`py-2 rounded-lg text-sm font-medium border ${
                    padelPosition === val
                      ? 'bg-cyan-600 border-cyan-500 text-white'
                      : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700'
                  }`}
                >
                  {lbl}
                </button>
              ))}
            </div>
          </Field>
          <Field label="Nivel / categoría">
            <input value={padelLevel} onChange={e => setPadelLevel(e.target.value)} className={inputCls} placeholder="5ta, 4ta, 45+..." />
          </Field>
        </Section>

        {/* Contacto emergencia */}
        <Section title="Contacto de emergencia">
          <Field label="Nombre y teléfono">
            <input value={emergencyContact} onChange={e => setEmergencyContact(e.target.value)} className={inputCls} placeholder="María Pérez 600 000 000" />
          </Field>
          <Field label="Lesiones / alergias / notas médicas">
            <textarea value={medicalNotes} onChange={e => setMedicalNotes(e.target.value)} rows={3} className={inputCls} placeholder="Opcional — solo el club verá esto" />
          </Field>
        </Section>

        {/* GDPR */}
        <Section
          title="Consentimientos (obligatorios)"
          subtitle="Según la ley española de protección de datos (LOPDGDD / RGPD) necesitamos tu respuesta a cada punto."
        >
          <ConsentToggle
            title="Uso de imagen"
            description="¿Autorizás al club a usar tu imagen (fotos y videos de partidos) en nuestra web y redes sociales? Solo para contenido del club."
            value={consentImage}
            onChange={setConsentImage}
          />
          <ConsentToggle
            title="Datos públicos"
            description="¿Autorizás a mostrar tu nombre y categoría en los rankings y ligas públicas de la web? Si decís que no, solo se ven internamente."
            value={consentData}
            onChange={setConsentData}
          />

          <div className="rounded-lg bg-slate-800/50 border border-slate-700 p-3 text-xs text-slate-400 flex gap-2">
            <Shield size={16} className="shrink-0 mt-0.5 text-cyan-400" />
            <p>
              Tus datos (teléfono, DNI, dirección, notas médicas) <strong>nunca</strong> se muestran públicamente — son de uso interno del club y se tratan según
              la normativa española (LOPDGDD / RGPD). Podés pedir su modificación o borrado escribiéndonos.
            </p>
          </div>
        </Section>

        <button
          type="submit"
          disabled={saving}
          className="w-full py-4 rounded-xl bg-green-600 hover:bg-green-500 text-white font-bold text-lg flex items-center justify-center gap-2 disabled:opacity-60"
        >
          {saving ? <Loader2 className="animate-spin" size={20} /> : <Check size={20} />}
          {saving ? 'Guardando...' : 'Guardar ficha'}
        </button>
      </form>
    </div>
  )
}

// ─── helpers UI ───────────────────────────────────────────────

const inputCls =
  'w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-white placeholder-slate-500 focus:border-cyan-500 focus:outline-none'

function Section({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-3">
      <div>
        <h2 className="text-lg font-semibold text-white">{title}</h2>
        {subtitle && <p className="text-xs text-slate-400 mt-0.5">{subtitle}</p>}
      </div>
      <div className="space-y-3">{children}</div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-sm text-slate-300 mb-1">{label}</span>
      {children}
    </label>
  )
}

function ConsentToggle({
  title,
  description,
  value,
  onChange,
}: {
  title: string
  description: string
  value: boolean | null
  onChange: (v: boolean) => void
}) {
  return (
    <div className="rounded-lg border border-slate-700 bg-slate-800/30 p-3 space-y-2">
      <div>
        <div className="text-sm font-semibold text-white">{title}</div>
        <div className="text-xs text-slate-400 mt-0.5">{description}</div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => onChange(true)}
          className={`py-2 rounded-lg text-sm font-medium border ${
            value === true ? 'bg-green-600 border-green-500 text-white' : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700'
          }`}
        >
          Sí, autorizo
        </button>
        <button
          type="button"
          onClick={() => onChange(false)}
          className={`py-2 rounded-lg text-sm font-medium border ${
            value === false ? 'bg-red-600 border-red-500 text-white' : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700'
          }`}
        >
          No autorizo
        </button>
      </div>
    </div>
  )
}

// Resize image to maxSide px (keeps aspect ratio) and return JPEG data URL ~0.85 quality
async function resizeImage(file: File, maxSide: number): Promise<string> {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(r.result as string)
    r.onerror = reject
    r.readAsDataURL(file)
  })
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const i = new Image()
    i.onload = () => resolve(i)
    i.onerror = reject
    i.src = dataUrl
  })
  let w = img.width
  let h = img.height
  if (w > maxSide || h > maxSide) {
    if (w > h) {
      h = Math.round((h * maxSide) / w)
      w = maxSide
    } else {
      w = Math.round((w * maxSide) / h)
      h = maxSide
    }
  }
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')!
  ctx.drawImage(img, 0, 0, w, h)
  return canvas.toDataURL('image/jpeg', 0.85)
}
