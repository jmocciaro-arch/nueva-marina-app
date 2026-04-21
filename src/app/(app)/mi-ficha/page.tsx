'use client'

import { useEffect, useRef, useState } from 'react'
import { useAuth } from '@/lib/auth-context'
import { createClient } from '@/lib/supabase/client'
import { useToast } from '@/components/ui/toast'
import { Camera, Check, Loader2, Shield, User as UserIcon } from 'lucide-react'

interface UserData {
  full_name: string | null
  email: string | null
  phone: string | null
  avatar_url: string | null
  birth_date: string | null
  city: string | null
  address: string | null
  postal_code: string | null
  padel_position: 'drive' | 'reves' | 'ambos' | null
  padel_level: string | null
  emergency_contact: string | null
  medical_notes: string | null
  consent_image_use: boolean | null
  consent_data_public: boolean | null
  profile_completed_at: string | null
}

export default function MiFichaPage() {
  const { user } = useAuth()
  const { toast } = useToast()
  const fileRef = useRef<HTMLInputElement>(null)

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [birthDate, setBirthDate] = useState('')
  const [city, setCity] = useState('')
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
  const [completed, setCompleted] = useState<string | null>(null)

  useEffect(() => {
    if (!user) return
    const supabase = createClient()
    supabase
      .from('nm_users')
      .select('full_name, email, phone, avatar_url, birth_date, city, address, postal_code, padel_position, padel_level, emergency_contact, medical_notes, consent_image_use, consent_data_public, profile_completed_at')
      .eq('id', user.id)
      .single()
      .then(({ data }) => {
        if (data) {
          const u = data as UserData
          setFullName(u.full_name ?? '')
          setEmail(u.email ?? '')
          setPhone(u.phone ?? '')
          setBirthDate(u.birth_date ?? '')
          setCity(u.city ?? '')
          setAddress(u.address ?? '')
          setPostalCode(u.postal_code ?? '')
          setPadelPosition((u.padel_position as 'drive' | 'reves' | 'ambos' | null) ?? '')
          setPadelLevel(u.padel_level ?? '')
          setEmergencyContact(u.emergency_contact ?? '')
          setMedicalNotes(u.medical_notes ?? '')
          setConsentImage(u.consent_image_use)
          setConsentData(u.consent_data_public)
          setAvatarPreview(u.avatar_url)
          setCompleted(u.profile_completed_at)
        }
        setLoading(false)
      })
  }, [user])

  async function onPickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    if (!f) return
    if (f.size > 8 * 1024 * 1024) { toast('warning', 'Foto demasiado grande (máx 8MB)'); return }
    const dataUrl = await resizeImage(f, 720)
    setAvatarPreview(dataUrl)
    setAvatarBase64(dataUrl)
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!user) return
    if (consentImage === null || consentData === null) {
      toast('warning', 'Tenés que responder a los dos consentimientos')
      return
    }
    if (!fullName.trim()) { toast('warning', 'Poné tu nombre'); return }
    setSaving(true)
    try {
      const res = await fetch('/api/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: user.id,
          full_name: fullName.trim(),
          phone: phone.trim() || null,
          birth_date: birthDate || null,
          city: city || null,
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
      toast('success', '¡Ficha actualizada!')
      setAvatarBase64(null)
    } catch (err) {
      toast('error', (err as Error).message)
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return <div className="flex items-center justify-center py-20 text-white"><Loader2 className="animate-spin" size={32} /></div>
  }

  return (
    <div className="max-w-2xl mx-auto pb-10 space-y-6">
      <div className="flex items-center gap-3">
        <UserIcon size={28} className="text-cyan-400" />
        <div>
          <h1 className="text-2xl font-bold text-white">Mi ficha</h1>
          <p className="text-sm text-slate-400">
            {completed ? `Completada el ${new Date(completed).toLocaleDateString('es-ES')} — podés actualizarla cuando quieras.` : 'Completá tu ficha para jugar la liga.'}
          </p>
        </div>
      </div>

      <form onSubmit={onSubmit} className="space-y-5">
        <Section title="Foto de perfil">
          <div className="flex items-center gap-4">
            <div className="w-24 h-24 rounded-full bg-slate-800 border-2 border-slate-700 overflow-hidden flex items-center justify-center">
              {avatarPreview ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={avatarPreview} alt="" className="w-full h-full object-cover" />
              ) : <Camera size={32} className="text-slate-500" />}
            </div>
            <div>
              <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" capture="user" onChange={onPickFile} className="hidden" />
              <button type="button" onClick={() => fileRef.current?.click()} className="px-4 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-sm font-medium flex items-center gap-2">
                <Camera size={16} /> {avatarPreview ? 'Cambiar' : 'Subir foto'}
              </button>
              <p className="text-xs text-slate-500 mt-1">JPG, PNG o WEBP · máx 8MB</p>
            </div>
          </div>
        </Section>

        <Section title="Datos personales">
          <Field label="Nombre completo *">
            <input value={fullName} onChange={e => setFullName(e.target.value)} required className={inputCls} />
          </Field>
          <Field label="Email (cuenta)">
            <input value={email} disabled className={`${inputCls} opacity-60 cursor-not-allowed`} />
            <p className="text-[11px] text-slate-500 mt-1">
              El email es el de tu cuenta. Para cambiarlo tenés que contactar con el club.
            </p>
          </Field>
          <Field label="Teléfono">
            <input value={phone} onChange={e => setPhone(e.target.value)} type="tel" className={inputCls} />
          </Field>
          <Field label="Fecha de nacimiento">
            <input value={birthDate} onChange={e => setBirthDate(e.target.value)} type="date" className={inputCls} />
          </Field>
          <Field label="Zona / localidad">
            <select value={city} onChange={e => setCity(e.target.value)} className={inputCls}>
              <option value="">Elegí tu zona…</option>
              <option value="Motril">Motril</option>
              <option value="Granada">Granada</option>
              <option value="Málaga">Málaga</option>
              <option value="Almería">Almería</option>
              <option value="Sevilla">Sevilla</option>
              <option value="Madrid">Madrid</option>
              <option value="Barcelona">Barcelona</option>
              <option value="Valencia">Valencia</option>
              <option value="Murcia">Murcia</option>
              <option value="Bilbao">Bilbao</option>
              <option value="Zaragoza">Zaragoza</option>
              <option value="Palma de Mallorca">Palma de Mallorca</option>
              <option value="Las Palmas">Las Palmas</option>
              <option value="Otra">Otra</option>
            </select>
          </Field>
          <Field label="Dirección (opcional)">
            <input value={address} onChange={e => setAddress(e.target.value)} className={inputCls} placeholder="Calle, número…" />
          </Field>
          <Field label="Código postal (opcional)">
            <input value={postalCode} onChange={e => setPostalCode(e.target.value)} className={inputCls} placeholder="18600" />
          </Field>
        </Section>

        <Section title="Pádel">
          <Field label="Posición">
            <div className="grid grid-cols-3 gap-2">
              {([['drive', 'Drive'], ['reves', 'Revés'], ['ambos', 'Ambos']] as const).map(([val, lbl]) => (
                <button key={val} type="button" onClick={() => setPadelPosition(val)}
                  className={`py-2 rounded-lg text-sm font-medium border ${padelPosition === val ? 'bg-cyan-600 border-cyan-500 text-white' : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700'}`}>
                  {lbl}
                </button>
              ))}
            </div>
          </Field>
          <Field label="Categorías que jugás">
            <p className="text-[11px] text-slate-500 mb-2">Marcá todas las categorías en las que competís.</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {['Iniciación', '2ª', '3ª', '4ª', '5ª', '6ª', '45+', '50+'].map(cat => {
                const current = padelLevel ? padelLevel.split(',').map(s => s.trim()).filter(Boolean) : []
                const selected = current.includes(cat)
                return (
                  <label
                    key={cat}
                    className={[
                      'flex items-center gap-2 rounded-lg border px-3 py-2 text-sm cursor-pointer transition-colors',
                      selected
                        ? 'border-cyan-500 bg-cyan-500/10 text-cyan-300'
                        : 'border-slate-700 bg-slate-800 text-slate-300 hover:border-slate-500',
                    ].join(' ')}
                  >
                    <input
                      type="checkbox"
                      checked={selected}
                      onChange={e => {
                        const next = e.target.checked
                          ? [...current, cat]
                          : current.filter(c => c !== cat)
                        setPadelLevel(next.join(','))
                      }}
                      className="w-4 h-4 rounded border-slate-600 bg-slate-900 text-cyan-500 focus:ring-cyan-500/40"
                    />
                    <span>{cat}</span>
                  </label>
                )
              })}
            </div>
          </Field>
        </Section>

        <Section title="Contacto de emergencia">
          <Field label="Nombre y teléfono">
            <input value={emergencyContact} onChange={e => setEmergencyContact(e.target.value)} className={inputCls} />
          </Field>
          <Field label="Lesiones / alergias / notas médicas">
            <textarea value={medicalNotes} onChange={e => setMedicalNotes(e.target.value)} rows={3} className={inputCls} />
          </Field>
        </Section>

        <Section title="Consentimientos (RGPD / LOPDGDD)" subtitle="Podés cambiar tu respuesta cuando quieras.">
          <ConsentToggle title="Uso de imagen" description="¿Autorizás a usar tu imagen en la web y redes del club?" value={consentImage} onChange={setConsentImage} />
          <ConsentToggle title="Datos públicos" description="¿Autorizás a mostrar tu nombre y categoría en rankings públicos?" value={consentData} onChange={setConsentData} />
          <div className="rounded-lg bg-slate-800/50 border border-slate-700 p-3 text-xs text-slate-400 flex gap-2">
            <Shield size={16} className="shrink-0 mt-0.5 text-cyan-400" />
            <p>Tus datos de contacto (teléfono, dirección) son de uso interno del club.</p>
          </div>
        </Section>

        <button type="submit" disabled={saving} className="w-full py-3 rounded-xl bg-green-600 hover:bg-green-500 text-white font-bold flex items-center justify-center gap-2 disabled:opacity-60">
          {saving ? <Loader2 className="animate-spin" size={18} /> : <Check size={18} />}
          {saving ? 'Guardando...' : 'Guardar cambios'}
        </button>
      </form>
    </div>
  )
}

// ─── helpers ──────────────────────────────────────────────

const inputCls = 'w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-white placeholder-slate-500 focus:border-cyan-500 focus:outline-none'

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

function ConsentToggle({ title, description, value, onChange }: { title: string; description: string; value: boolean | null; onChange: (v: boolean) => void }) {
  return (
    <div className="rounded-lg border border-slate-700 bg-slate-800/30 p-3 space-y-2">
      <div>
        <div className="text-sm font-semibold text-white">{title}</div>
        <div className="text-xs text-slate-400 mt-0.5">{description}</div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <button type="button" onClick={() => onChange(true)} className={`py-2 rounded-lg text-sm font-medium border ${value === true ? 'bg-green-600 border-green-500 text-white' : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700'}`}>Sí, autorizo</button>
        <button type="button" onClick={() => onChange(false)} className={`py-2 rounded-lg text-sm font-medium border ${value === false ? 'bg-red-600 border-red-500 text-white' : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700'}`}>No autorizo</button>
      </div>
    </div>
  )
}

async function resizeImage(file: File, maxSide: number): Promise<string> {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const r = new FileReader(); r.onload = () => resolve(r.result as string); r.onerror = reject; r.readAsDataURL(file)
  })
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const i = new Image(); i.onload = () => resolve(i); i.onerror = reject; i.src = dataUrl
  })
  let w = img.width, h = img.height
  if (w > maxSide || h > maxSide) {
    if (w > h) { h = Math.round((h * maxSide) / w); w = maxSide }
    else { w = Math.round((w * maxSide) / h); h = maxSide }
  }
  const canvas = document.createElement('canvas'); canvas.width = w; canvas.height = h
  canvas.getContext('2d')!.drawImage(img, 0, 0, w, h)
  return canvas.toDataURL('image/jpeg', 0.85)
}
