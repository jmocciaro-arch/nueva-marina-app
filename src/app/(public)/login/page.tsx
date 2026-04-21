'use client'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { createClient } from '@/lib/supabase/client'
import { Suspense, useState, useCallback, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Eye, EyeOff } from 'lucide-react'
import { GoogleReCaptchaProvider, useGoogleReCaptcha } from 'react-google-recaptcha-v3'

const RECAPTCHA_SITE_KEY = process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY || '6LeIxAcTAAAAAJcZVRqyHh71UMIEGNQ_MXjiZKhI'

export default function LoginPage() {
  return (
    <GoogleReCaptchaProvider reCaptchaKey={RECAPTCHA_SITE_KEY}>
      <Suspense fallback={<div className="min-h-screen flex items-center justify-center bg-[#0b1120]"><div className="w-8 h-8 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin" /></div>}>
        <LoginForm />
      </Suspense>
    </GoogleReCaptchaProvider>
  )
}

function LoginForm() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [isRegister, setIsRegister] = useState(false)
  const [fullName, setFullName] = useState('')
  const [phone, setPhone] = useState('')
  // Datos ficha jugador (registro)
  const [dniNie, setDniNie] = useState('')
  const [birthDate, setBirthDate] = useState('')
  const [padelLevel, setPadelLevel] = useState('')
  const [padelPosition, setPadelPosition] = useState('')
  // GDPR consents
  const [consentImage, setConsentImage] = useState(false)
  const [consentDataPublic, setConsentDataPublic] = useState(false)
  const [consentTerms, setConsentTerms] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()
  const searchParams = useSearchParams()
  const redirect = searchParams.get('redirect') || '/dashboard'
  const { executeRecaptcha } = useGoogleReCaptcha()

  // If already logged in, redirect away from login
  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        router.push(redirect)
      }
    })
  }, [router, redirect])

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    const supabase = createClient()

    if (isRegister) {
      // Validación mínima de consents obligatorios
      if (!consentTerms) {
        setError('Tenés que aceptar los términos y la política de privacidad para registrarte.')
        setLoading(false)
        return
      }

      // Verify captcha for registration
      if (!executeRecaptcha) {
        setError('Error al cargar captcha. Recarga la pagina.')
        setLoading(false)
        return
      }
      const captchaToken = await executeRecaptcha('register')
      if (!captchaToken) {
        setError('Verificacion de captcha fallida. Intenta de nuevo.')
        setLoading(false)
        return
      }

      const { data, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { full_name: fullName, phone },
          captchaToken,
        },
      })
      if (signUpError) {
        setError(signUpError.message)
        setLoading(false)
        return
      }
      if (data.user) {
        const now = new Date().toISOString()
        // Create nm_users profile con ficha completa + consents GDPR
        await supabase.from('nm_users').upsert({
          id: data.user.id,
          email,
          full_name: fullName,
          first_name: fullName.split(' ')[0],
          last_name: fullName.split(' ').slice(1).join(' '),
          phone,
          dni_nie: dniNie || null,
          birth_date: birthDate || null,
          padel_level: padelLevel || null,
          padel_position: padelPosition || null,
          consent_image_use: consentImage,
          consent_data_public: consentDataPublic,
          consent_accepted_at: now,
        })
        // Create club membership (club_id = 1 for Nueva Marina)
        await supabase.from('nm_club_members').insert({
          club_id: 1,
          user_id: data.user.id,
          role: 'player',
        })
      }
      router.push(redirect)
    } else {
      const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      })
      if (signInError) {
        setError(signInError.message === 'Invalid login credentials' ? 'Email o contrasena incorrectos' : signInError.message)
        setLoading(false)
        return
      }
      // Check if user is admin to redirect accordingly
      if (signInData.user) {
        const { data: membership } = await supabase
          .from('nm_club_members')
          .select('role')
          .eq('user_id', signInData.user.id)
          .in('role', ['owner', 'admin', 'staff'])
          .single()
        if (membership) {
          router.push('/admin')
          return
        }
      }
      router.push(redirect)
    }
  }, [
    isRegister, email, password, fullName, phone, redirect, router, executeRecaptcha,
    dniNie, birthDate, padelLevel, padelPosition,
    consentImage, consentDataPublic, consentTerms,
  ])

  async function handleGoogleLogin() {
    const supabase = createClient()
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/api/auth/callback?redirect=${redirect}`,
      },
    })
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0b1120] px-4 py-8">
      <div className={`w-full ${isRegister ? 'max-w-xl' : 'max-w-md'}`}>
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-cyan-600 mb-4">
            <span className="text-2xl font-bold text-white">NM</span>
          </div>
          <h1 className="text-2xl font-bold text-white">Nueva Marina</h1>
          <p className="text-sm text-slate-400 mt-1">Padel & Sport</p>
        </div>

        {/* Card */}
        <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-6">
          <h2 className="text-lg font-semibold text-white mb-1">
            {isRegister ? 'Crear cuenta' : 'Iniciar sesion'}
          </h2>
          {isRegister && (
            <p className="text-xs text-slate-400 mb-6">
              Completá tus datos para sumarte al club. Después podés agregar una foto en tu ficha.
            </p>
          )}

          {error && (
            <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-sm text-red-400">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {isRegister ? (
              <>
                {/* === Datos personales === */}
                <div className="pb-2 border-b border-slate-700/50">
                  <p className="text-[11px] uppercase tracking-wider text-slate-500 font-semibold">Datos personales</p>
                </div>
                <Input
                  label="Nombre completo *"
                  placeholder="Juan Pérez"
                  value={fullName}
                  onChange={e => setFullName(e.target.value)}
                  required
                />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Input
                    label="Teléfono *"
                    type="tel"
                    placeholder="+34 600 000 000"
                    value={phone}
                    onChange={e => setPhone(e.target.value)}
                    required
                  />
                  <Input
                    label="Fecha de nacimiento"
                    type="date"
                    value={birthDate}
                    onChange={e => setBirthDate(e.target.value)}
                  />
                </div>
                <Input
                  label="DNI / NIE"
                  placeholder="12345678A"
                  value={dniNie}
                  onChange={e => setDniNie(e.target.value.toUpperCase())}
                />

                {/* === Credenciales === */}
                <div className="pt-2 pb-2 border-b border-slate-700/50">
                  <p className="text-[11px] uppercase tracking-wider text-slate-500 font-semibold">Acceso</p>
                </div>
                <Input
                  label="Email *"
                  type="email"
                  placeholder="tu@email.com"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                />
                <div className="space-y-1">
                  <label className="block text-sm font-medium text-slate-300">Contraseña *</label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      placeholder="Mínimo 6 caracteres"
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      required
                      minLength={6}
                      className="w-full rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 pr-10 text-sm text-white placeholder-slate-500 transition-colors focus:outline-none focus:ring-2 focus:ring-cyan-500/40 focus:border-cyan-500"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-white transition-colors"
                      tabIndex={-1}
                    >
                      {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </div>

                {/* === Perfil de pádel === */}
                <div className="pt-2 pb-2 border-b border-slate-700/50">
                  <p className="text-[11px] uppercase tracking-wider text-slate-500 font-semibold">Perfil de pádel</p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="block text-sm font-medium text-slate-300">Nivel</label>
                    <select
                      value={padelLevel}
                      onChange={e => setPadelLevel(e.target.value)}
                      className="w-full rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-cyan-500/40 focus:border-cyan-500"
                    >
                      <option value="">Elegí tu nivel…</option>
                      <option value="iniciacion">Iniciación</option>
                      <option value="2.0">2.0 · Principiante</option>
                      <option value="3.0">3.0 · Intermedio bajo</option>
                      <option value="4.0">4.0 · Intermedio</option>
                      <option value="5.0">5.0 · Intermedio alto</option>
                      <option value="6.0">6.0 · Avanzado</option>
                      <option value="7.0">7.0+ · Competición</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="block text-sm font-medium text-slate-300">Lado de pista</label>
                    <select
                      value={padelPosition}
                      onChange={e => setPadelPosition(e.target.value)}
                      className="w-full rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-cyan-500/40 focus:border-cyan-500"
                    >
                      <option value="">Elegí un lado…</option>
                      <option value="drive">Derecha (drive)</option>
                      <option value="reves">Revés</option>
                      <option value="ambos">Ambos</option>
                    </select>
                  </div>
                </div>

                {/* === Privacidad (GDPR / LOPDGDD) === */}
                <div className="pt-4 mt-4 border-t border-slate-700/50 space-y-3">
                  <div className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      id="consent-terms"
                      checked={consentTerms}
                      onChange={e => setConsentTerms(e.target.checked)}
                      className="mt-1 w-4 h-4 rounded border-slate-600 bg-slate-800 text-cyan-500 focus:ring-cyan-500/40"
                    />
                    <label htmlFor="consent-terms" className="text-xs text-slate-300 leading-relaxed">
                      Acepto los <Link href="/terminos" className="text-cyan-400 hover:underline" target="_blank">términos y condiciones</Link> y
                      la <Link href="/privacidad" className="text-cyan-400 hover:underline" target="_blank">política de privacidad</Link> (RGPD).
                      <span className="text-red-400 ml-1">*</span>
                    </label>
                  </div>

                  <div className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      id="consent-data"
                      checked={consentDataPublic}
                      onChange={e => setConsentDataPublic(e.target.checked)}
                      className="mt-1 w-4 h-4 rounded border-slate-600 bg-slate-800 text-cyan-500 focus:ring-cyan-500/40"
                    />
                    <label htmlFor="consent-data" className="text-xs text-slate-300 leading-relaxed">
                      Autorizo mostrar <strong>mi nombre y categoría</strong> en <strong>rankings y ligas públicas</strong> del club.
                      <span className="text-slate-500 block text-[11px]">Si no aceptás, aparecés como &quot;Jugador N&quot; en las páginas públicas.</span>
                    </label>
                  </div>

                  <div className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      id="consent-image"
                      checked={consentImage}
                      onChange={e => setConsentImage(e.target.checked)}
                      className="mt-1 w-4 h-4 rounded border-slate-600 bg-slate-800 text-cyan-500 focus:ring-cyan-500/40"
                    />
                    <label htmlFor="consent-image" className="text-xs text-slate-300 leading-relaxed">
                      Autorizo el uso de <strong>mi imagen</strong> (fotos/videos de partidos y torneos) en el sitio web y redes sociales del club.
                      <span className="text-slate-500 block text-[11px]">Podés cambiar estas preferencias cuando quieras desde &quot;Mi ficha&quot;.</span>
                    </label>
                  </div>
                </div>

                <p className="text-[11px] text-slate-500 pt-2">
                  Este sitio está protegido por reCAPTCHA de Google.
                </p>
              </>
            ) : (
              <>
                <Input
                  label="Email"
                  type="email"
                  placeholder="tu@email.com"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                />
                <div className="space-y-1">
                  <label className="block text-sm font-medium text-slate-300">Contraseña</label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      placeholder="********"
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      required
                      minLength={6}
                      className="w-full rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 pr-10 text-sm text-white placeholder-slate-500 transition-colors focus:outline-none focus:ring-2 focus:ring-cyan-500/40 focus:border-cyan-500"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-white transition-colors"
                      tabIndex={-1}
                    >
                      {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </div>
              </>
            )}

            <Button type="submit" loading={loading} className="w-full">
              {isRegister ? 'Crear cuenta' : 'Entrar'}
            </Button>
          </form>

          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-slate-700" />
            </div>
            <div className="relative flex justify-center text-xs">
              <span className="bg-slate-800/50 px-2 text-slate-500">o continuar con</span>
            </div>
          </div>

          <Button variant="outline" className="w-full" onClick={handleGoogleLogin}>
            <svg className="w-4 h-4" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            Google
          </Button>

          <p className="mt-6 text-center text-sm text-slate-400">
            {isRegister ? 'Ya tenes cuenta?' : 'No tenes cuenta?'}{' '}
            <button
              onClick={() => { setIsRegister(!isRegister); setError('') }}
              className="text-cyan-400 hover:text-cyan-300 font-medium"
            >
              {isRegister ? 'Inicia sesion' : 'Registrate'}
            </button>
          </p>
        </div>

        <p className="mt-6 text-center text-xs text-slate-600">
          <Link href="/" className="hover:text-slate-400">Volver al inicio</Link>
        </p>
      </div>
    </div>
  )
}
