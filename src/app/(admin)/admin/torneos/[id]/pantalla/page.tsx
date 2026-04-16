'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import {
  ArrowLeft,
  Monitor,
  ExternalLink,
  Copy,
  Check,
  RotateCcw,
  Save,
  Tv2,
  Globe,
  LayoutDashboard,
  AlignJustify,
  Table2,
  SquareStack,
  Minimize2,
  GitBranch,
  Clock,
  Type,
  Rows3,
} from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useToast } from '@/components/ui/toast'

// ─── Types ────────────────────────────────────────────────────────────────────

type Theme = 'dark' | 'neon' | 'classic' | 'padel'
type ViewMode = 'tree' | 'table' | 'cards' | 'compact' | 'timeline'
type CardSize = 'sm' | 'md' | 'lg'

interface DisplayConfig {
  theme: Theme
  showScores: boolean
  showTimers: boolean
  showCourts: boolean
  showRounds: boolean
  hideByes: boolean
  animations: boolean
  autoRotate: boolean
  rotateInterval: number
  cardSize: CardSize
  viewMode: ViewMode
  clubName: string
  clubSubtitle: string
  primaryColor: string
  logoUrl: string
}

const DEFAULTS: DisplayConfig = {
  theme: 'dark',
  showScores: true,
  showTimers: true,
  showCourts: true,
  showRounds: true,
  hideByes: true,
  animations: true,
  autoRotate: false,
  rotateInterval: 30,
  cardSize: 'md',
  viewMode: 'tree',
  clubName: '',
  clubSubtitle: '',
  primaryColor: '#06b6d4',
  logoUrl: '',
}

// ─── Theme Definitions ─────────────────────────────────────────────────────────

const THEMES: { id: Theme; label: string; colors: string[] }[] = [
  { id: 'dark',    label: 'Oscuro',   colors: ['#0f172a', '#1e293b', '#94a3b8'] },
  { id: 'neon',    label: 'Neón',     colors: ['#0a0a0a', '#06b6d4', '#10b981'] },
  { id: 'classic', label: 'Clásico',  colors: ['#f8fafc', '#3b82f6', '#1e40af'] },
  { id: 'padel',   label: 'Pádel',    colors: ['#052e16', '#84cc16', '#22c55e'] },
]

// ─── Interval Options ──────────────────────────────────────────────────────────

const INTERVALS = [15, 30, 45, 60, 90]

// ─── View Modes ────────────────────────────────────────────────────────────────

const VIEW_MODES: { id: ViewMode; label: string; Icon: React.ElementType }[] = [
  { id: 'tree',     label: 'Árbol',     Icon: GitBranch },
  { id: 'table',    label: 'Tabla',     Icon: Table2 },
  { id: 'cards',    label: 'Tarjetas',  Icon: SquareStack },
  { id: 'compact',  label: 'Compacto',  Icon: Minimize2 },
  { id: 'timeline', label: 'Timeline',  Icon: AlignJustify },
]

// ─── Card Sizes ────────────────────────────────────────────────────────────────

const CARD_SIZES: { id: CardSize; label: string; Icon: React.ElementType }[] = [
  { id: 'sm', label: 'Pequeño', Icon: Minimize2 },
  { id: 'md', label: 'Mediano', Icon: Rows3 },
  { id: 'lg', label: 'Grande',  Icon: Type },
]

// ─── Helpers ───────────────────────────────────────────────────────────────────

function buildLiveUrl(id: string, config: DisplayConfig): string {
  const params = new URLSearchParams({
    theme:  config.theme,
    view:   config.viewMode,
    size:   config.cardSize,
    scores: config.showScores  ? '1' : '0',
    timers: config.showTimers  ? '1' : '0',
    courts: config.showCourts  ? '1' : '0',
    rounds: config.showRounds  ? '1' : '0',
    byes:   config.hideByes    ? '0' : '1',
    anims:  config.animations  ? '1' : '0',
    cycle:  String(config.rotateInterval),
  })
  return `${typeof window !== 'undefined' ? window.location.origin : ''}/torneo/${id}/live?${params.toString()}`
}

function storageKey(id: string) {
  return `torneo-display-${id}`
}

// ─── Section wrapper ──────────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3">
      <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-400">{title}</h2>
      {children}
    </div>
  )
}

// ─── Toggle Button ─────────────────────────────────────────────────────────────

function ToggleSwitch({
  label,
  checked,
  onChange,
}: {
  label: string
  checked: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={`flex items-center justify-between w-full px-4 py-3 rounded-xl border transition-all ${
        checked
          ? 'bg-cyan-500/10 border-cyan-500/40 text-white'
          : 'bg-slate-800/60 border-slate-700/50 text-slate-400'
      }`}
    >
      <span className="text-sm">{label}</span>
      <span
        className={`relative inline-flex h-5 w-9 shrink-0 rounded-full transition-colors ${
          checked ? 'bg-cyan-500' : 'bg-slate-600'
        }`}
      >
        <span
          className={`inline-block h-4 w-4 mt-0.5 rounded-full bg-white shadow transition-transform ${
            checked ? 'translate-x-4' : 'translate-x-0.5'
          }`}
        />
      </span>
    </button>
  )
}

// ─── Main Component ────────────────────────────────────────────────────────────

export default function ConfigurarPantallaPage() {
  const params = useParams()
  const id = String(params.id)
  const { toast } = useToast()

  const [config, setConfig] = useState<DisplayConfig>(DEFAULTS)
  const [copied, setCopied] = useState(false)

  // Load from localStorage on mount
  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey(id))
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<DisplayConfig>
        setConfig(prev => ({ ...prev, ...parsed }))
      }
    } catch {
      // ignorar errores de parseo
    }
  }, [id])

  const update = useCallback(<K extends keyof DisplayConfig>(key: K, value: DisplayConfig[K]) => {
    setConfig(prev => ({ ...prev, [key]: value }))
  }, [])

  const handleSave = useCallback(() => {
    localStorage.setItem(storageKey(id), JSON.stringify(config))
    toast('success', 'Configuración guardada correctamente')
  }, [id, config, toast])

  const handleReset = useCallback(() => {
    setConfig(DEFAULTS)
    localStorage.removeItem(storageKey(id))
    toast('info', 'Configuración restablecida a los valores por defecto')
  }, [id, toast])

  const liveUrl = buildLiveUrl(id, config)

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(liveUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
      toast('success', 'Enlace copiado al portapapeles')
    } catch {
      toast('error', 'No se pudo copiar el enlace')
    }
  }, [liveUrl, toast])

  return (
    <div className="min-h-screen bg-slate-900 text-white">
      <div className="max-w-4xl mx-auto px-4 py-6 space-y-8">

        {/* ── Header ── */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <Link
              href={`/admin/torneos/${id}`}
              className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 transition-colors text-slate-400 hover:text-white"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div className="flex items-center gap-2">
              <Monitor className="w-6 h-6 text-cyan-400" />
              <h1 className="text-xl font-bold">Configuración de Pantalla</h1>
            </div>
          </div>
          <a
            href={`/torneo/${id}/live`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-cyan-500/15 border border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/25 transition-colors text-sm font-medium"
          >
            <ExternalLink className="w-4 h-4" />
            Vista previa
          </a>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

          {/* ── Section 1: Tema ── */}
          <div className="md:col-span-2">
            <Section title="Tema de pantalla">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {THEMES.map(theme => (
                  <button
                    key={theme.id}
                    type="button"
                    onClick={() => update('theme', theme.id)}
                    className={`p-4 rounded-xl border transition-all text-left space-y-3 ${
                      config.theme === theme.id
                        ? 'border-cyan-500 ring-2 ring-cyan-500/40 bg-cyan-500/10'
                        : 'border-slate-700 bg-slate-800/60 hover:border-slate-500'
                    }`}
                  >
                    <span className="text-sm font-medium text-white">{theme.label}</span>
                    <div className="flex gap-1.5">
                      {theme.colors.map((color, i) => (
                        <span
                          key={i}
                          className="inline-block w-5 h-5 rounded-full border border-white/10"
                          style={{ backgroundColor: color }}
                        />
                      ))}
                    </div>
                  </button>
                ))}
              </div>
            </Section>
          </div>

          {/* ── Section 2: Opciones de Display ── */}
          <div>
            <Section title="Opciones de display">
              <div className="space-y-2">
                <ToggleSwitch label="Mostrar scores en vivo"        checked={config.showScores}  onChange={v => update('showScores', v)} />
                <ToggleSwitch label="Mostrar cronómetros"           checked={config.showTimers}  onChange={v => update('showTimers', v)} />
                <ToggleSwitch label="Mostrar nombre de pista"       checked={config.showCourts}  onChange={v => update('showCourts', v)} />
                <ToggleSwitch label="Mostrar cabeceras de ronda"    checked={config.showRounds}  onChange={v => update('showRounds', v)} />
                <ToggleSwitch label="Ocultar partidos BYE"          checked={config.hideByes}    onChange={v => update('hideByes', v)} />
                <ToggleSwitch label="Animaciones activadas"         checked={config.animations}  onChange={v => update('animations', v)} />
              </div>
            </Section>
          </div>

          {/* ── Section 3 + 4 + 5 ── */}
          <div className="space-y-6">

            {/* Auto-Rotación */}
            <Section title="Auto-rotación">
              <ToggleSwitch
                label="Activar rotación automática de categorías"
                checked={config.autoRotate}
                onChange={v => update('autoRotate', v)}
              />
              {config.autoRotate && (
                <div className="flex flex-wrap gap-2 pt-1">
                  {INTERVALS.map(s => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => update('rotateInterval', s)}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm border transition-all ${
                        config.rotateInterval === s
                          ? 'bg-cyan-500 border-cyan-500 text-white font-medium'
                          : 'border-slate-600 text-slate-400 hover:border-slate-400'
                      }`}
                    >
                      <Clock className="w-3.5 h-3.5" />
                      {s}s
                    </button>
                  ))}
                </div>
              )}
            </Section>

            {/* Tamaño de Cards */}
            <Section title="Tamaño de cards">
              <div className="flex gap-2">
                {CARD_SIZES.map(({ id: sizeId, label, Icon }) => (
                  <button
                    key={sizeId}
                    type="button"
                    onClick={() => update('cardSize', sizeId)}
                    className={`flex items-center gap-1.5 px-3 py-2 rounded-full text-sm border flex-1 justify-center transition-all ${
                      config.cardSize === sizeId
                        ? 'bg-cyan-500 border-cyan-500 text-white font-medium'
                        : 'border-slate-600 text-slate-400 hover:border-slate-400'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    {label}
                  </button>
                ))}
              </div>
            </Section>

            {/* Vista Predeterminada */}
            <Section title="Vista predeterminada">
              <div className="flex flex-wrap gap-2">
                {VIEW_MODES.map(({ id: viewId, label, Icon }) => (
                  <button
                    key={viewId}
                    type="button"
                    onClick={() => update('viewMode', viewId)}
                    className={`flex items-center gap-1.5 px-3 py-2 rounded-full text-sm border transition-all ${
                      config.viewMode === viewId
                        ? 'bg-cyan-500 border-cyan-500 text-white font-medium'
                        : 'border-slate-600 text-slate-400 hover:border-slate-400'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    {label}
                  </button>
                ))}
              </div>
            </Section>
          </div>

          {/* ── Section 6: Información del Club ── */}
          <div className="md:col-span-2">
            <Section title="Información del club">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-4 rounded-xl bg-slate-800/50 border border-slate-700/60">
                <div className="space-y-1.5">
                  <label className="text-xs text-slate-400 font-medium">Nombre del club</label>
                  <Input
                    value={config.clubName}
                    onChange={e => update('clubName', e.target.value)}
                    placeholder="Nueva Marina Pádel"
                    className="bg-slate-900 border-slate-600 text-white placeholder:text-slate-500"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs text-slate-400 font-medium">Subtítulo / Slogan</label>
                  <Input
                    value={config.clubSubtitle}
                    onChange={e => update('clubSubtitle', e.target.value)}
                    placeholder="El mejor pádel de la costa"
                    className="bg-slate-900 border-slate-600 text-white placeholder:text-slate-500"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs text-slate-400 font-medium">Color principal</label>
                  <div className="flex items-center gap-3">
                    <input
                      type="color"
                      value={config.primaryColor}
                      onChange={e => update('primaryColor', e.target.value)}
                      className="h-10 w-14 rounded-lg cursor-pointer border border-slate-600 bg-slate-900 p-0.5"
                    />
                    <span className="text-sm text-slate-400 font-mono">{config.primaryColor}</span>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs text-slate-400 font-medium">URL del logo</label>
                  <Input
                    value={config.logoUrl}
                    onChange={e => update('logoUrl', e.target.value)}
                    placeholder="https://..."
                    className="bg-slate-900 border-slate-600 text-white placeholder:text-slate-500"
                  />
                </div>
              </div>
            </Section>
          </div>

          {/* ── Section 7: Compartir Pantalla ── */}
          <div className="md:col-span-2">
            <Section title="Compartir pantalla">
              <div className="p-4 rounded-xl bg-slate-800/50 border border-slate-700/60 space-y-4">
                <div className="flex items-center gap-2">
                  <div className="flex-1 min-w-0 px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-slate-300 text-xs font-mono truncate select-all">
                    {liveUrl}
                  </div>
                  <button
                    type="button"
                    onClick={handleCopy}
                    className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 border border-slate-600 text-sm text-white transition-colors shrink-0"
                  >
                    {copied ? (
                      <>
                        <Check className="w-4 h-4 text-emerald-400" />
                        <span className="text-emerald-400">Copiado</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-4 h-4" />
                        Copiar enlace
                      </>
                    )}
                  </button>
                </div>
                {/* QR placeholder */}
                <div className="flex items-center justify-center w-28 h-28 rounded-xl bg-white text-slate-900 font-bold text-sm select-none border-2 border-slate-600">
                  QR
                </div>
                <p className="text-xs text-slate-500">
                  El código QR completo estará disponible próximamente con qrcode.react.
                </p>
              </div>
            </Section>
          </div>

          {/* ── Section 8: Quick Links ── */}
          <div className="md:col-span-2">
            <Section title="Accesos rápidos">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <a
                  href={`/torneo/${id}/live`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20 transition-colors"
                >
                  <Tv2 className="w-5 h-5 shrink-0" />
                  <div>
                    <p className="text-sm font-semibold">Pantalla en vivo</p>
                    <p className="text-xs text-emerald-500/70">/torneo/{id}/live</p>
                  </div>
                </a>
                <a
                  href={`/torneo/${id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 p-4 rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/20 transition-colors"
                >
                  <Globe className="w-5 h-5 shrink-0" />
                  <div>
                    <p className="text-sm font-semibold">Vista pública</p>
                    <p className="text-xs text-cyan-500/70">/torneo/{id}</p>
                  </div>
                </a>
                <Link
                  href={`/admin/torneos/${id}`}
                  className="flex items-center gap-3 p-4 rounded-xl bg-slate-700/50 border border-slate-600/50 text-slate-300 hover:bg-slate-700 transition-colors"
                >
                  <LayoutDashboard className="w-5 h-5 shrink-0" />
                  <div>
                    <p className="text-sm font-semibold">Panel de control</p>
                    <p className="text-xs text-slate-500">/admin/torneos/{id}</p>
                  </div>
                </Link>
              </div>
            </Section>
          </div>

        </div>

        {/* ── Save / Reset Bar ── */}
        <div className="flex items-center justify-between gap-3 pt-2 pb-8 border-t border-slate-800">
          <button
            type="button"
            onClick={handleReset}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-700 text-slate-400 hover:text-white hover:border-slate-500 transition-colors text-sm"
          >
            <RotateCcw className="w-4 h-4" />
            Restablecer
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-900 font-semibold text-sm transition-colors"
          >
            <Save className="w-4 h-4" />
            Guardar cambios
          </button>
        </div>

      </div>
    </div>
  )
}
