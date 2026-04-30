'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  Building2, Calendar, Puzzle, Palette, Save,
  Dumbbell, ShoppingBag, Trophy, Users, Lightbulb, Bot,
  Check,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Card } from '@/components/ui/card'
import { useToast } from '@/components/ui/toast'
import type { Club, ClubConfig } from '@/types'

// ─── Constants ────────────────────────────────────────────────────────────────

const CLUB_ID = 1

const SLOT_DURATION_OPTIONS = [
  { value: '60', label: '60 minutos' },
  { value: '90', label: '90 minutos' },
  { value: '120', label: '120 minutos' },
]

const COLOR_PRESETS = [
  { hex: '#06b6d4', label: 'Cyan' },
  { hex: '#8b5cf6', label: 'Violeta' },
  { hex: '#f59e0b', label: 'Ambar' },
  { hex: '#10b981', label: 'Esmeralda' },
  { hex: '#ef4444', label: 'Rojo' },
  { hex: '#3b82f6', label: 'Azul' },
  { hex: '#ec4899', label: 'Rosa' },
  { hex: '#f97316', label: 'Naranja' },
  { hex: '#14b8a6', label: 'Teal' },
  { hex: '#a855f7', label: 'Purpura' },
]

const FEATURE_LIST: {
  key: keyof NonNullable<ClubConfig['features']>
  label: string
  description: string
  icon: React.ReactNode
}[] = [
  {
    key: 'gym',
    label: 'Gimnasio',
    description: 'Gestión de membresías y acceso al gym',
    icon: <Dumbbell size={18} className="text-cyan-400" />,
  },
  {
    key: 'shop',
    label: 'Tienda',
    description: 'Venta de productos y equipamiento',
    icon: <ShoppingBag size={18} className="text-cyan-400" />,
  },
  {
    key: 'tournaments',
    label: 'Torneos',
    description: 'Organización y gestión de torneos',
    icon: <Trophy size={18} className="text-cyan-400" />,
  },
  {
    key: 'leagues',
    label: 'Ligas',
    description: 'Ligas y campeonatos por temporada',
    icon: <Users size={18} className="text-cyan-400" />,
  },
  {
    key: 'innovation',
    label: 'Innovación',
    description: 'Panel de funcionalidades experimentales',
    icon: <Lightbulb size={18} className="text-cyan-400" />,
  },
  {
    key: 'ai',
    label: 'Inteligencia Artificial',
    description: 'Asistente IA y sugerencias automáticas',
    icon: <Bot size={18} className="text-cyan-400" />,
  },
]

// ─── Default states ────────────────────────────────────────────────────────────

const DEFAULT_CLUB_FORM = {
  name: '',
  legal_name: '',
  tax_id: '',
  address: '',
  city: '',
  phone: '',
  email: '',
  website: '',
}

const DEFAULT_BOOKING_FORM = {
  slot_duration: 90,
  max_advance_days: 14,
  cancellation_hours: 2,
}

const DEFAULT_FEATURES = {
  gym: false,
  shop: false,
  tournaments: false,
  leagues: false,
  innovation: false,
  ai: false,
}

// ─── Toggle component ──────────────────────────────────────────────────────────

function Toggle({
  checked,
  onChange,
}: {
  checked: boolean
  onChange: (val: boolean) => void
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 flex-shrink-0 rounded-full border-2 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-cyan-500/40 ${
        checked
          ? 'bg-cyan-600 border-cyan-600'
          : 'bg-slate-700 border-slate-600'
      }`}
    >
      <span
        className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform duration-200 mt-0.5 ${
          checked ? 'translate-x-5' : 'translate-x-0.5'
        }`}
      />
    </button>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ConfiguracionClubPage() {
  const { toast } = useToast()

  // Estado carga
  const [loading, setLoading] = useState(true)

  // Estados de guardado por sección
  const [savingClub, setSavingClub] = useState(false)
  const [savingBooking, setSavingBooking] = useState(false)
  const [savingFeatures, setSavingFeatures] = useState(false)
  const [savingTheme, setSavingTheme] = useState(false)

  // Formulario datos del club
  const [clubForm, setClubForm] = useState(DEFAULT_CLUB_FORM)

  // Formulario reservas
  const [bookingForm, setBookingForm] = useState(DEFAULT_BOOKING_FORM)

  // Módulos activos
  const [features, setFeatures] = useState(DEFAULT_FEATURES)

  // Tema
  const [primaryColor, setPrimaryColor] = useState('#06b6d4')
  const [customColor, setCustomColor] = useState('#06b6d4')

  // ─── Carga inicial ─────────────────────────────────────────────────────────

  const loadClub = useCallback(async () => {
    const supabase = createClient()
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('nm_clubs')
        .select('*')
        .eq('id', CLUB_ID)
        .maybeSingle()

      if (error) throw error

      if (!data) {
        console.warn(`[config/club] No existe un club con id=${CLUB_ID}. Renderizando formulario vacío para creación inicial.`)
        setLoading(false)
        return
      }

      const club = data as Club

      setClubForm({
        name: club.name ?? '',
        legal_name: club.legal_name ?? '',
        tax_id: club.tax_id ?? '',
        address: club.address ?? '',
        city: club.city ?? '',
        phone: club.phone ?? '',
        email: club.email ?? '',
        website: club.website ?? '',
      })

      const cfg: ClubConfig = club.config ?? {}

      setBookingForm({
        slot_duration: cfg.booking?.slot_duration ?? 90,
        max_advance_days: cfg.booking?.max_advance_days ?? 14,
        cancellation_hours: cfg.booking?.cancellation_hours ?? 2,
      })

      setFeatures({
        gym: cfg.features?.gym ?? false,
        shop: cfg.features?.shop ?? false,
        tournaments: cfg.features?.tournaments ?? false,
        leagues: cfg.features?.leagues ?? false,
        innovation: cfg.features?.innovation ?? false,
        ai: cfg.features?.ai ?? false,
      })

      const color = cfg.theme?.primary_color ?? '#06b6d4'
      setPrimaryColor(color)
      setCustomColor(color)
    } catch (err) {
      console.error(err)
      toast('error', 'No se pudo cargar la configuración del club')
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => {
    loadClub()
  }, [loadClub])

  // ─── Helpers para obtener config actual y mergear ──────────────────────────

  async function getCurrentConfig(): Promise<ClubConfig> {
    const supabase = createClient()
    const { data } = await supabase
      .from('nm_clubs')
      .select('config')
      .eq('id', CLUB_ID)
      .single()
    return (data?.config as ClubConfig) ?? {}
  }

  // ─── Guardar datos del club ────────────────────────────────────────────────

  async function handleSaveClub() {
    const supabase = createClient()
    setSavingClub(true)
    try {
      const { error } = await supabase
        .from('nm_clubs')
        .update({
          name: clubForm.name,
          legal_name: clubForm.legal_name || null,
          tax_id: clubForm.tax_id || null,
          address: clubForm.address || null,
          city: clubForm.city || null,
          phone: clubForm.phone || null,
          email: clubForm.email || null,
          website: clubForm.website || null,
        })
        .eq('id', CLUB_ID)

      if (error) throw error
      toast('success', 'Datos del club guardados correctamente')
    } catch (err) {
      console.error(err)
      toast('error', 'Error al guardar los datos del club')
    } finally {
      setSavingClub(false)
    }
  }

  // ─── Guardar configuración de reservas ────────────────────────────────────

  async function handleSaveBooking() {
    const supabase = createClient()
    setSavingBooking(true)
    try {
      const currentConfig = await getCurrentConfig()
      const { error } = await supabase
        .from('nm_clubs')
        .update({
          config: {
            ...currentConfig,
            booking: {
              slot_duration: bookingForm.slot_duration,
              max_advance_days: bookingForm.max_advance_days,
              cancellation_hours: bookingForm.cancellation_hours,
            },
          },
        })
        .eq('id', CLUB_ID)

      if (error) throw error
      toast('success', 'Configuración de reservas guardada')
    } catch (err) {
      console.error(err)
      toast('error', 'Error al guardar la configuración de reservas')
    } finally {
      setSavingBooking(false)
    }
  }

  // ─── Guardar módulos ───────────────────────────────────────────────────────

  async function handleSaveFeatures() {
    const supabase = createClient()
    setSavingFeatures(true)
    try {
      const currentConfig = await getCurrentConfig()
      const { error } = await supabase
        .from('nm_clubs')
        .update({
          config: {
            ...currentConfig,
            features: { ...features },
          },
        })
        .eq('id', CLUB_ID)

      if (error) throw error
      toast('success', 'Módulos actualizados correctamente')
    } catch (err) {
      console.error(err)
      toast('error', 'Error al guardar los módulos')
    } finally {
      setSavingFeatures(false)
    }
  }

  // ─── Guardar tema ──────────────────────────────────────────────────────────

  async function handleSaveTheme() {
    const supabase = createClient()
    setSavingTheme(true)
    try {
      const currentConfig = await getCurrentConfig()
      const { error } = await supabase
        .from('nm_clubs')
        .update({
          config: {
            ...currentConfig,
            theme: {
              ...(currentConfig.theme ?? {}),
              primary_color: primaryColor,
            },
          },
        })
        .eq('id', CLUB_ID)

      if (error) throw error
      toast('success', 'Tema guardado correctamente')
    } catch (err) {
      console.error(err)
      toast('error', 'Error al guardar el tema')
    } finally {
      setSavingTheme(false)
    }
  }

  // ─── Render ────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Configuración del Club</h1>
          <p className="text-sm text-slate-400 mt-1">Ajustes generales, datos del club y preferencias</p>
        </div>
        <div className="flex items-center justify-center py-20">
          <svg className="animate-spin h-8 w-8 text-cyan-500" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">Configuración del Club</h1>
        <p className="text-sm text-slate-400 mt-1">
          Ajustes generales, datos del club y preferencias del sistema
        </p>
      </div>

      {/* ── 1. Datos del Club ────────────────────────────────────────────────── */}
      <Card>
        <div className="flex items-center gap-3 mb-5">
          <div className="p-2 rounded-lg bg-cyan-500/10">
            <Building2 size={20} className="text-cyan-400" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-white">Datos del Club</h2>
            <p className="text-xs text-slate-400">Información principal e identificación fiscal</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input
            id="club-name"
            label="Nombre del club"
            value={clubForm.name}
            onChange={e => setClubForm(f => ({ ...f, name: e.target.value }))}
            placeholder="Nueva Marina Pádel"
          />
          <Input
            id="club-legal-name"
            label="Razón social"
            value={clubForm.legal_name}
            onChange={e => setClubForm(f => ({ ...f, legal_name: e.target.value }))}
            placeholder="Nueva Marina Pádel S.L."
          />
          <Input
            id="club-tax-id"
            label="CIF / NIF"
            value={clubForm.tax_id}
            onChange={e => setClubForm(f => ({ ...f, tax_id: e.target.value }))}
            placeholder="B12345678"
          />
          <Input
            id="club-city"
            label="Ciudad"
            value={clubForm.city}
            onChange={e => setClubForm(f => ({ ...f, city: e.target.value }))}
            placeholder="Torrevieja"
          />
          <Input
            id="club-address"
            label="Dirección"
            value={clubForm.address}
            onChange={e => setClubForm(f => ({ ...f, address: e.target.value }))}
            placeholder="Calle Mayor 1"
            className="md:col-span-2"
          />
          <Input
            id="club-phone"
            label="Teléfono"
            value={clubForm.phone}
            onChange={e => setClubForm(f => ({ ...f, phone: e.target.value }))}
            placeholder="+34 600 000 000"
          />
          <Input
            id="club-email"
            label="Email de contacto"
            value={clubForm.email}
            onChange={e => setClubForm(f => ({ ...f, email: e.target.value }))}
            placeholder="info@nuevamarina.es"
          />
          <Input
            id="club-website"
            label="Sitio web"
            value={clubForm.website}
            onChange={e => setClubForm(f => ({ ...f, website: e.target.value }))}
            placeholder="https://nuevamarina.es"
            className="md:col-span-2"
          />
        </div>

        <div className="flex justify-end mt-5">
          <Button onClick={handleSaveClub} loading={savingClub}>
            <Save size={15} />
            Guardar datos del club
          </Button>
        </div>
      </Card>

      {/* ── 2. Configuración de Reservas ─────────────────────────────────────── */}
      <Card>
        <div className="flex items-center gap-3 mb-5">
          <div className="p-2 rounded-lg bg-cyan-500/10">
            <Calendar size={20} className="text-cyan-400" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-white">Configuración de Reservas</h2>
            <p className="text-xs text-slate-400">Duración de turnos, anticipación y cancelaciones</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Select
            id="slot-duration"
            label="Duración de turno"
            value={String(bookingForm.slot_duration)}
            options={SLOT_DURATION_OPTIONS}
            onChange={e =>
              setBookingForm(f => ({ ...f, slot_duration: Number(e.target.value) }))
            }
          />
          <Input
            id="max-advance-days"
            label="Días máximos de anticipación"
            type="number"
            min={1}
            max={365}
            value={bookingForm.max_advance_days}
            onChange={e =>
              setBookingForm(f => ({ ...f, max_advance_days: Number(e.target.value) }))
            }
          />
          <Input
            id="cancellation-hours"
            label="Horas mínimas para cancelar"
            type="number"
            min={0}
            max={72}
            value={bookingForm.cancellation_hours}
            onChange={e =>
              setBookingForm(f => ({ ...f, cancellation_hours: Number(e.target.value) }))
            }
          />
        </div>

        <div className="mt-4 p-3 rounded-lg bg-slate-900/50 border border-slate-700/50">
          <p className="text-xs text-slate-400">
            <span className="text-slate-300 font-medium">Resumen: </span>
            Turnos de <span className="text-cyan-400">{bookingForm.slot_duration} min</span> — Reservas
            con hasta <span className="text-cyan-400">{bookingForm.max_advance_days} días</span> de anticipación
            — Cancelación hasta <span className="text-cyan-400">{bookingForm.cancellation_hours}hs</span> antes
          </p>
        </div>

        <div className="flex justify-end mt-5">
          <Button onClick={handleSaveBooking} loading={savingBooking}>
            <Save size={15} />
            Guardar reservas
          </Button>
        </div>
      </Card>

      {/* ── 3. Módulos Activos ───────────────────────────────────────────────── */}
      <Card>
        <div className="flex items-center gap-3 mb-5">
          <div className="p-2 rounded-lg bg-cyan-500/10">
            <Puzzle size={20} className="text-cyan-400" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-white">Módulos Activos</h2>
            <p className="text-xs text-slate-400">
              Activá o desactivá funcionalidades del club
            </p>
          </div>
        </div>

        <div className="divide-y divide-slate-700/50">
          {FEATURE_LIST.map(feat => (
            <div
              key={feat.key}
              className="flex items-center justify-between py-3 first:pt-0 last:pb-0"
            >
              <div className="flex items-center gap-3">
                <div className="p-1.5 rounded-lg bg-slate-700/50">
                  {feat.icon}
                </div>
                <div>
                  <p className="text-sm font-medium text-white">{feat.label}</p>
                  <p className="text-xs text-slate-400">{feat.description}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 ml-4 flex-shrink-0">
                <span
                  className={`text-xs font-medium ${
                    features[feat.key] ? 'text-cyan-400' : 'text-slate-500'
                  }`}
                >
                  {features[feat.key] ? 'Activo' : 'Inactivo'}
                </span>
                <Toggle
                  checked={features[feat.key]}
                  onChange={val =>
                    setFeatures(f => ({ ...f, [feat.key]: val }))
                  }
                />
              </div>
            </div>
          ))}
        </div>

        <div className="flex justify-end mt-5">
          <Button onClick={handleSaveFeatures} loading={savingFeatures}>
            <Save size={15} />
            Guardar módulos
          </Button>
        </div>
      </Card>

      {/* ── 4. Tema ──────────────────────────────────────────────────────────── */}
      <Card>
        <div className="flex items-center gap-3 mb-5">
          <div className="p-2 rounded-lg bg-cyan-500/10">
            <Palette size={20} className="text-cyan-400" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-white">Tema</h2>
            <p className="text-xs text-slate-400">Color principal de la interfaz del club</p>
          </div>
        </div>

        <div className="space-y-4">
          {/* Colores predefinidos */}
          <div>
            <p className="text-sm font-medium text-slate-300 mb-3">Colores predefinidos</p>
            <div className="flex flex-wrap gap-2">
              {COLOR_PRESETS.map(preset => (
                <button
                  key={preset.hex}
                  type="button"
                  title={preset.label}
                  onClick={() => {
                    setPrimaryColor(preset.hex)
                    setCustomColor(preset.hex)
                  }}
                  className="relative w-9 h-9 rounded-lg border-2 transition-all focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-offset-slate-900"
                  style={{
                    backgroundColor: preset.hex,
                    borderColor:
                      primaryColor === preset.hex ? '#ffffff' : 'transparent',
                  }}
                >
                  {primaryColor === preset.hex && (
                    <Check
                      size={14}
                      className="absolute inset-0 m-auto text-white drop-shadow"
                    />
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Color personalizado */}
          <div className="flex items-end gap-3">
            <div className="flex-1">
              <Input
                id="custom-color-text"
                label="Color personalizado (HEX)"
                value={customColor}
                onChange={e => setCustomColor(e.target.value)}
                onBlur={() => {
                  if (/^#[0-9A-Fa-f]{6}$/.test(customColor)) {
                    setPrimaryColor(customColor)
                  }
                }}
                placeholder="#06b6d4"
                maxLength={7}
              />
            </div>
            <div className="flex items-center gap-2 mb-1">
              <input
                type="color"
                value={primaryColor}
                onChange={e => {
                  setPrimaryColor(e.target.value)
                  setCustomColor(e.target.value)
                }}
                className="w-10 h-9 rounded-lg border border-slate-600 bg-slate-800 cursor-pointer p-0.5"
                title="Selector de color"
              />
            </div>
          </div>

          {/* Preview */}
          <div className="p-4 rounded-lg bg-slate-900/50 border border-slate-700/50">
            <p className="text-xs text-slate-400 mb-3">Vista previa</p>
            <div className="flex items-center gap-3 flex-wrap">
              <button
                className="px-4 py-2 rounded-lg text-sm font-medium text-white transition-opacity hover:opacity-90"
                style={{ backgroundColor: primaryColor }}
              >
                Reservar pista
              </button>
              <div
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: primaryColor }}
              />
              <span
                className="text-sm font-semibold"
                style={{ color: primaryColor }}
              >
                Nueva Marina
              </span>
              <div
                className="h-0.5 flex-1 min-w-16 rounded"
                style={{ backgroundColor: primaryColor, opacity: 0.4 }}
              />
            </div>
          </div>
        </div>

        <div className="flex justify-end mt-5">
          <Button onClick={handleSaveTheme} loading={savingTheme}>
            <Save size={15} />
            Guardar tema
          </Button>
        </div>
      </Card>
    </div>
  )
}
