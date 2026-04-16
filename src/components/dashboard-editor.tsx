'use client'

import React, { useState, useMemo, useCallback } from 'react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Modal } from '@/components/ui/modal'
import { Badge } from '@/components/ui/badge'
import {
  X,
  Settings,
  Palette,
  LayoutGrid,
  Eye,
  EyeOff,
  ChevronUp,
  ChevronDown,
  GripVertical,
  Check,
} from 'lucide-react'

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

export interface DashboardLayoutConfig {
  widgets: { id: string; visible: boolean; order: number; size?: 'sm' | 'md' | 'lg' }[]
  theme: DashboardThemeConfig
  quickActions: { id: string; visible: boolean; order: number }[]
}

export interface DashboardThemeConfig {
  accentColor: string
  columns: 2 | 3 | 4
  cardStyle: 'default' | 'glass' | 'bordered'
  compactKpis: boolean
  animations: boolean
}

export interface DashboardWidgetDef {
  id: string
  name: string
  category: 'kpi' | 'live' | 'chart' | 'list'
  icon: string
  defaultVisible: boolean
}

export interface QuickActionConfig {
  id: string
  label: string
  visible: boolean
  order: number
}

// ─────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────

const ACCENT_PRESETS = [
  { key: 'cyan', cls: 'bg-cyan-500' },
  { key: 'green', cls: 'bg-green-500' },
  { key: 'amber', cls: 'bg-amber-500' },
  { key: 'purple', cls: 'bg-purple-500' },
  { key: 'pink', cls: 'bg-pink-500' },
  { key: 'lime', cls: 'bg-lime-500' },
]

const CATEGORY_LABELS: Record<string, string> = {
  kpi: 'KPIs',
  live: 'En Vivo',
  chart: 'Graficos',
  list: 'Listas',
}

const CATEGORY_ORDER: DashboardWidgetDef['category'][] = ['kpi', 'live', 'chart', 'list']

// ─────────────────────────────────────────────
// WidgetGallery
// ─────────────────────────────────────────────

interface WidgetGalleryProps {
  widgets: DashboardWidgetDef[]
  activeIds: string[]
  onToggle: (id: string) => void
}

export function WidgetGallery({ widgets, activeIds, onToggle }: WidgetGalleryProps) {
  const byCategory = useMemo(() => {
    const map = new Map<string, DashboardWidgetDef[]>()
    for (const cat of CATEGORY_ORDER) {
      const items = widgets.filter((w) => w.category === cat)
      if (items.length > 0) map.set(cat, items)
    }
    return map
  }, [widgets])

  return (
    <div className="space-y-5">
      {Array.from(byCategory.entries()).map(([cat, items]) => (
        <div key={cat}>
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
            {CATEGORY_LABELS[cat] ?? cat}
          </p>
          <div className="space-y-1">
            {items.map((w) => {
              const active = activeIds.includes(w.id)
              return (
                <button
                  key={w.id}
                  onClick={() => onToggle(w.id)}
                  className={cn(
                    'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg border text-left transition-colors',
                    active
                      ? 'border-cyan-500/40 bg-cyan-500/10'
                      : 'border-slate-800 bg-slate-800/40 hover:border-slate-700',
                  )}
                >
                  <span className="text-base shrink-0">{w.icon}</span>
                  <span className="flex-1 text-sm text-white truncate">{w.name}</span>
                  <div
                    className={cn(
                      'relative w-9 h-5 rounded-full transition-colors',
                      active ? 'bg-cyan-600' : 'bg-slate-700',
                    )}
                  >
                    <span
                      className={cn(
                        'absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform',
                        active && 'translate-x-4',
                      )}
                    />
                  </div>
                </button>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}

// ─────────────────────────────────────────────
// DashboardThemePanel
// ─────────────────────────────────────────────

interface DashboardThemePanelProps {
  theme: DashboardThemeConfig
  onChange: (theme: DashboardThemeConfig) => void
}

export function DashboardThemePanel({ theme, onChange }: DashboardThemePanelProps) {
  const set = <K extends keyof DashboardThemeConfig>(key: K, value: DashboardThemeConfig[K]) => {
    onChange({ ...theme, [key]: value })
  }

  const Toggle = ({ checked, onToggle, label, desc }: { checked: boolean; onToggle: () => void; label: string; desc: string }) => (
    <label className="flex items-center justify-between cursor-pointer py-1">
      <div>
        <p className="text-sm text-slate-300">{label}</p>
        <p className="text-xs text-slate-500">{desc}</p>
      </div>
      <button
        onClick={onToggle}
        className={cn(
          'relative w-9 h-5 rounded-full transition-colors shrink-0 ml-3',
          checked ? 'bg-cyan-600' : 'bg-slate-700',
        )}
      >
        <span
          className={cn(
            'absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform',
            checked && 'translate-x-4',
          )}
        />
      </button>
    </label>
  )

  return (
    <div className="space-y-6">
      {/* Accent color */}
      <div>
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Color de acento</p>
        <div className="flex items-center gap-3">
          {ACCENT_PRESETS.map((p) => (
            <button
              key={p.key}
              onClick={() => set('accentColor', p.key)}
              className={cn(
                'w-7 h-7 rounded-full transition-all',
                p.cls,
                theme.accentColor === p.key
                  ? 'ring-2 ring-white ring-offset-2 ring-offset-slate-900 scale-110'
                  : 'opacity-60 hover:opacity-100',
              )}
            />
          ))}
        </div>
      </div>

      {/* Columns */}
      <div>
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Columnas</p>
        <div className="flex items-center gap-2">
          {([2, 3, 4] as const).map((col) => (
            <button
              key={col}
              onClick={() => set('columns', col)}
              className={cn(
                'px-4 py-1.5 rounded-lg border text-sm font-medium transition-colors',
                theme.columns === col
                  ? 'border-cyan-500/50 bg-cyan-500/10 text-cyan-400'
                  : 'border-slate-700 text-slate-400 hover:border-slate-600',
              )}
            >
              {col}
            </button>
          ))}
        </div>
      </div>

      {/* Card style */}
      <div>
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Estilo de cards</p>
        <div className="flex flex-col gap-1.5">
          {(['default', 'glass', 'bordered'] as const).map((style) => (
            <button
              key={style}
              onClick={() => set('cardStyle', style)}
              className={cn(
                'flex items-center gap-3 px-3 py-2 rounded-lg border text-left text-sm transition-colors',
                theme.cardStyle === style
                  ? 'border-cyan-500/50 bg-cyan-500/10 text-white'
                  : 'border-slate-800 text-slate-400 hover:border-slate-700',
              )}
            >
              {theme.cardStyle === style && <Check size={14} className="text-cyan-400 shrink-0" />}
              <span className="capitalize">{style}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Toggles */}
      <div className="space-y-3 pt-2 border-t border-slate-800">
        <Toggle
          checked={theme.compactKpis}
          onToggle={() => set('compactKpis', !theme.compactKpis)}
          label="KPIs compactos"
          desc="Reduce el tamanio de los indicadores"
        />
        <Toggle
          checked={theme.animations}
          onToggle={() => set('animations', !theme.animations)}
          label="Animaciones"
          desc="Transiciones suaves entre estados"
        />
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────
// QuickActionsEditor
// ─────────────────────────────────────────────

interface QuickActionsEditorProps {
  actions: QuickActionConfig[]
  onChange: (actions: QuickActionConfig[]) => void
}

export function QuickActionsEditor({ actions, onChange }: QuickActionsEditorProps) {
  const sorted = useMemo(() => [...actions].sort((a, b) => a.order - b.order), [actions])

  const move = useCallback(
    (index: number, dir: 'up' | 'down') => {
      const target = dir === 'up' ? index - 1 : index + 1
      if (target < 0 || target >= sorted.length) return
      const next = [...sorted]
      const tmpOrder = next[index].order
      next[index] = { ...next[index], order: next[target].order }
      next[target] = { ...next[target], order: tmpOrder }
      onChange(next)
    },
    [sorted, onChange],
  )

  const toggleVisible = useCallback(
    (id: string) => {
      onChange(actions.map((a) => (a.id === id ? { ...a, visible: !a.visible } : a)))
    },
    [actions, onChange],
  )

  return (
    <div className="space-y-1">
      {sorted.length === 0 && (
        <p className="text-slate-500 text-sm text-center py-6">Sin acciones configuradas</p>
      )}
      {sorted.map((action, idx) => (
        <div
          key={action.id}
          className={cn(
            'flex items-center gap-2 px-3 py-2.5 rounded-lg border transition-colors',
            action.visible
              ? 'border-slate-800 bg-slate-800/40'
              : 'border-slate-800/50 bg-slate-900/40 opacity-50',
          )}
        >
          <GripVertical size={14} className="text-slate-600 shrink-0" />
          <span className="flex-1 text-sm text-white truncate">{action.label}</span>

          <button
            onClick={() => toggleVisible(action.id)}
            className="p-1 text-slate-500 hover:text-slate-300 transition-colors"
          >
            {action.visible ? <Eye size={14} /> : <EyeOff size={14} />}
          </button>

          <div className="flex flex-col gap-px">
            <button
              onClick={() => move(idx, 'up')}
              disabled={idx === 0}
              className="p-0.5 text-slate-500 hover:text-slate-300 disabled:opacity-20 disabled:cursor-not-allowed"
            >
              <ChevronUp size={12} />
            </button>
            <button
              onClick={() => move(idx, 'down')}
              disabled={idx === sorted.length - 1}
              className="p-0.5 text-slate-500 hover:text-slate-300 disabled:opacity-20 disabled:cursor-not-allowed"
            >
              <ChevronDown size={12} />
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}

// ─────────────────────────────────────────────
// DashboardEditor (main wrapper)
// ─────────────────────────────────────────────

interface DashboardEditorProps {
  userId: string
  role: 'admin' | 'player'
  isOpen: boolean
  onClose: () => void
  onSave: (config: DashboardLayoutConfig) => void
  currentConfig: DashboardLayoutConfig
}

export function DashboardEditor({
  userId,
  role,
  isOpen,
  onClose,
  onSave,
  currentConfig,
}: DashboardEditorProps) {
  const [config, setConfig] = useState<DashboardLayoutConfig>(currentConfig)
  const [section, setSection] = useState<'widgets' | 'theme' | 'actions'>('widgets')

  // Sync draft when panel opens with new config
  React.useEffect(() => {
    if (isOpen) setConfig(currentConfig)
  }, [isOpen, currentConfig])

  const activeWidgetIds = useMemo(
    () => config.widgets.filter((w) => w.visible).map((w) => w.id),
    [config.widgets],
  )

  const handleToggleWidget = useCallback(
    (id: string) => {
      setConfig((prev) => ({
        ...prev,
        widgets: prev.widgets.map((w) =>
          w.id === id ? { ...w, visible: !w.visible } : w,
        ),
      }))
    },
    [],
  )

  const handleThemeChange = useCallback((theme: DashboardThemeConfig) => {
    setConfig((prev) => ({ ...prev, theme }))
  }, [])

  const handleActionsChange = useCallback((quickActions: QuickActionConfig[]) => {
    setConfig((prev) => ({
      ...prev,
      quickActions: quickActions.map((a) => ({ id: a.id, visible: a.visible, order: a.order })),
    }))
  }, [])

  const handleSave = useCallback(() => {
    onSave(config)
    onClose()
  }, [config, onSave, onClose])

  const tabs = [
    { key: 'widgets' as const, label: 'Widgets', icon: LayoutGrid },
    { key: 'theme' as const, label: 'Tema', icon: Palette },
    { key: 'actions' as const, label: 'Acciones', icon: Settings },
  ]

  return (
    <>
      {/* Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
          onClick={onClose}
        />
      )}

      {/* Slide-over panel */}
      <div
        className={cn(
          'fixed top-0 right-0 z-50 h-full w-[400px] max-w-full bg-slate-900 border-l border-slate-800 shadow-2xl shadow-black/50 flex flex-col transition-transform duration-300',
          isOpen ? 'translate-x-0' : 'translate-x-full',
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800">
          <div>
            <h2 className="text-base font-semibold text-white">Editor de Dashboard</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              {role === 'admin' ? 'Panel Admin' : 'Panel Jugador'}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-500 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Section tabs */}
        <div className="flex border-b border-slate-800">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setSection(tab.key)}
              className={cn(
                'flex-1 flex items-center justify-center gap-1.5 py-3 text-xs font-medium transition-colors border-b-2',
                section === tab.key
                  ? 'text-cyan-400 border-cyan-400'
                  : 'text-slate-500 border-transparent hover:text-slate-300',
              )}
            >
              <tab.icon size={14} />
              {tab.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {section === 'widgets' && (
            <WidgetGallery
              widgets={[]}
              activeIds={activeWidgetIds}
              onToggle={handleToggleWidget}
            />
          )}
          {section === 'theme' && (
            <DashboardThemePanel
              theme={config.theme}
              onChange={handleThemeChange}
            />
          )}
          {section === 'actions' && (
            <QuickActionsEditor
              actions={config.quickActions.map((a) => ({
                ...a,
                label: a.id,
              }))}
              onChange={handleActionsChange}
            />
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center gap-2 px-5 py-4 border-t border-slate-800">
          <Button variant="ghost" size="sm" onClick={onClose} className="flex-1">
            Cancelar
          </Button>
          <Button variant="primary" size="sm" onClick={handleSave} className="flex-1">
            Guardar
          </Button>
        </div>
      </div>
    </>
  )
}

export default DashboardEditor
