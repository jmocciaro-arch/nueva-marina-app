'use client'

import { useCallback, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Modal } from '@/components/ui/modal'
import { Badge } from '@/components/ui/badge'
import { KpiCard } from '@/components/ui/kpi-card'
import { useToast } from '@/components/ui/toast'
import {
  DollarSign, Plus, Edit2, Trash2, Zap, Sun, Moon,
  Clock, Users, Trophy, Medal, CreditCard, Settings2,
  Lightbulb, Save, RefreshCw, Package, Calendar,
  Percent, Tag, ChevronRight, Copy, ToggleLeft, ToggleRight,
  Sunrise, Sunset, CloudSun, Snowflake, Flame, Star, Receipt
} from 'lucide-react'

const CLUB_ID = 1

// ─── Types ───────────────────────────────────────────────
const BOOKING_TYPES: Record<string, { label: string; color: 'default' | 'info' | 'success' | 'warning' | 'danger'; icon: React.ReactNode }> = {
  normal: { label: 'Normal', color: 'default', icon: <Clock size={12} /> },
  abono: { label: 'Abono', color: 'success', icon: <CreditCard size={12} /> },
  liga: { label: 'Liga', color: 'info', icon: <Medal size={12} /> },
  torneo: { label: 'Torneo', color: 'warning', icon: <Trophy size={12} /> },
  clase: { label: 'Clase', color: 'default', icon: <Users size={12} /> },
  evento: { label: 'Evento', color: 'danger', icon: <Zap size={12} /> },
}

const DURATION_OPTIONS = [
  { value: '30', label: '30 min' },
  { value: '45', label: '45 min' },
  { value: '60', label: '1 hora' },
  { value: '90', label: '1h 30min' },
  { value: '120', label: '2 horas' },
  { value: '150', label: '2h 30min' },
  { value: '180', label: '3 horas' },
]

const DAY_NAMES: Record<number, string> = { 0: 'Dom', 1: 'Lun', 2: 'Mar', 3: 'Mié', 4: 'Jue', 5: 'Vie', 6: 'Sáb' }

const DISCOUNT_TYPES: Record<string, string> = {
  percentage: 'Porcentaje (%)',
  fixed_amount: 'Monto fijo (€)',
  fixed_price: 'Precio fijo (€)',
}

interface PricingRule {
  id: number
  name: string
  duration_minutes: number
  base_price: number
  lighting_surcharge: number
  booking_type: string
  discount_pct: number
  fixed_price: number | null
  peak_surcharge: number
  is_active: boolean
  priority: number
  notes: string | null
  time_slot_id: number | null
  court_group: string | null
  min_players: number
  max_daily_uses: number
  valid_from: string | null
  valid_until: string | null
}

interface PricingConfig {
  id: number
  peak_start: string
  peak_end: string
  peak_days: number[]
  weekend_surcharge: number
  holiday_surcharge: number
  min_advance_hours: number
  max_advance_days: number
  cancellation_hours: number
  morning_start: string
  morning_end: string
  afternoon_start: string
  afternoon_end: string
  evening_start: string
  evening_end: string
  auto_lighting_time: string
  allow_custom_duration: boolean
  custom_duration_price_per_min: number
  iva_pct: number
  show_prices_with_iva: boolean
}

interface TimeSlot {
  id: number
  name: string
  start_time: string
  end_time: string
  price_multiplier: number
  is_active: boolean
  sort_order: number
}

interface PricingPack {
  id: number
  name: string
  description: string | null
  pack_type: string
  total_units: number
  price: number
  unit_price: number
  valid_days: number
  applicable_durations: number[]
  applicable_booking_types: string[]
  max_per_user: number
  is_active: boolean
  sort_order: number
}

interface PricingSeason {
  id: number
  name: string
  start_date: string
  end_date: string
  price_multiplier: number
  lighting_override: number | null
  is_active: boolean
  color: string
  notes: string | null
}

interface PricingDiscount {
  id: number
  name: string
  discount_type: string
  discount_value: number
  applicable_booking_types: string[]
  applicable_durations: number[]
  min_bookings_per_month: number
  requires_membership: boolean
  is_stackable: boolean
  is_active: boolean
  valid_from: string | null
  valid_until: string | null
  notes: string | null
}

interface Court {
  id: number
  name: string
  type: string
  surface: string
  has_lighting: boolean
  is_active: boolean
}

interface CourtPricing {
  id: number
  court_id: number
  pricing_rule_id: number
  override_price: number | null
  override_lighting: number | null
  is_active: boolean
}

type TabId = 'tarifas' | 'franjas' | 'bonos' | 'temporadas' | 'descuentos' | 'pistas' | 'config'

// ─── Main Component ──────────────────────────────────────
export default function PreciosPage() {
  const { toast } = useToast()
  const [activeTab, setActiveTab] = useState<TabId>('tarifas')

  // Data
  const [rules, setRules] = useState<PricingRule[]>([])
  const [config, setConfig] = useState<PricingConfig | null>(null)
  const [timeSlots, setTimeSlots] = useState<TimeSlot[]>([])
  const [packs, setPacks] = useState<PricingPack[]>([])
  const [seasons, setSeasons] = useState<PricingSeason[]>([])
  const [discounts, setDiscounts] = useState<PricingDiscount[]>([])
  const [courts, setCourts] = useState<Court[]>([])
  const [courtPricing, setCourtPricing] = useState<CourtPricing[]>([])
  const [loading, setLoading] = useState(true)

  // ─── Load all data ───────────────────────────────────
  const loadData = useCallback(async () => {
    setLoading(true)
    const supabase = createClient()
    const [rulesRes, configRes, slotsRes, packsRes, seasonsRes, discountsRes, courtsRes, cpRes] = await Promise.all([
      supabase.from('nm_pricing_rules').select('*').eq('club_id', CLUB_ID).order('booking_type').order('duration_minutes'),
      supabase.from('nm_pricing_config').select('*').eq('club_id', CLUB_ID).single(),
      supabase.from('nm_pricing_time_slots').select('*').eq('club_id', CLUB_ID).order('sort_order'),
      supabase.from('nm_pricing_packs').select('*').eq('club_id', CLUB_ID).order('sort_order'),
      supabase.from('nm_pricing_seasons').select('*').eq('club_id', CLUB_ID).order('start_date'),
      supabase.from('nm_pricing_discounts').select('*').eq('club_id', CLUB_ID).order('sort_order'),
      supabase.from('nm_courts').select('id, name, type, surface, has_lighting, is_active').eq('club_id', CLUB_ID).order('sort_order'),
      supabase.from('nm_court_pricing').select('*').eq('club_id', CLUB_ID),
    ])
    setRules((rulesRes.data ?? []) as PricingRule[])
    setTimeSlots((slotsRes.data ?? []) as TimeSlot[])
    setPacks((packsRes.data ?? []) as PricingPack[])
    setSeasons((seasonsRes.data ?? []) as PricingSeason[])
    setDiscounts((discountsRes.data ?? []) as PricingDiscount[])
    setCourts((courtsRes.data ?? []) as Court[])
    setCourtPricing((cpRes.data ?? []) as CourtPricing[])
    if (configRes.data) {
      const c = configRes.data as PricingConfig
      setConfig(c)
      setConfigForm({
        peak_start: c.peak_start?.slice(0, 5) || '17:00',
        peak_end: c.peak_end?.slice(0, 5) || '21:00',
        peak_days: c.peak_days || [1, 2, 3, 4, 5],
        weekend_surcharge: String(c.weekend_surcharge || 0),
        holiday_surcharge: String(c.holiday_surcharge || 0),
        min_advance_hours: String(c.min_advance_hours || 2),
        max_advance_days: String(c.max_advance_days || 14),
        cancellation_hours: String(c.cancellation_hours || 12),
        auto_lighting_time: c.auto_lighting_time?.slice(0, 5) || '20:00',
        allow_custom_duration: c.allow_custom_duration || false,
        custom_duration_price_per_min: String(c.custom_duration_price_per_min || 0.20),
        iva_pct: String(c.iva_pct || 21),
        show_prices_with_iva: c.show_prices_with_iva ?? true,
      })
    }
    setLoading(false)
  }, [])

  useEffect(() => { loadData() }, [loadData])

  // ─── Config form state ─────────────────────────────
  const [savingConfig, setSavingConfig] = useState(false)
  const [configForm, setConfigForm] = useState({
    peak_start: '17:00', peak_end: '21:00', peak_days: [1, 2, 3, 4, 5] as number[],
    weekend_surcharge: '0', holiday_surcharge: '0',
    min_advance_hours: '2', max_advance_days: '14', cancellation_hours: '12',
    auto_lighting_time: '20:00',
    allow_custom_duration: false,
    custom_duration_price_per_min: '0.20',
    iva_pct: '21', show_prices_with_iva: true,
  })

  // ─── Rule modal ────────────────────────────────────
  const [ruleOpen, setRuleOpen] = useState(false)
  const [editRule, setEditRule] = useState<PricingRule | null>(null)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    name: '', duration_minutes: '90', base_price: '', lighting_surcharge: '4',
    booking_type: 'normal', discount_pct: '0', fixed_price: '',
    peak_surcharge: '0', is_active: true, priority: '0', notes: '',
    time_slot_id: '', court_group: '', min_players: '0', max_daily_uses: '0',
    valid_from: '', valid_until: '',
  })

  // ─── Time slot modal ──────────────────────────────
  const [slotOpen, setSlotOpen] = useState(false)
  const [editSlot, setEditSlot] = useState<TimeSlot | null>(null)
  const [slotForm, setSlotForm] = useState({ name: '', start_time: '08:00', end_time: '13:00', price_multiplier: '1.00', is_active: true })

  // ─── Pack modal ───────────────────────────────────
  const [packOpen, setPackOpen] = useState(false)
  const [editPack, setEditPack] = useState<PricingPack | null>(null)
  const [packForm, setPackForm] = useState({
    name: '', description: '', pack_type: 'hours', total_units: '10', price: '',
    valid_days: '90', applicable_durations: [60, 90, 120] as number[],
    applicable_booking_types: ['normal', 'abono'] as string[], max_per_user: '1', is_active: true,
  })

  // ─── Season modal ─────────────────────────────────
  const [seasonOpen, setSeasonOpen] = useState(false)
  const [editSeason, setEditSeason] = useState<PricingSeason | null>(null)
  const [seasonForm, setSeasonForm] = useState({
    name: '', start_date: '', end_date: '', price_multiplier: '1.00',
    lighting_override: '', is_active: true, color: '#06b6d4', notes: '',
  })

  // ─── Discount modal ───────────────────────────────
  const [discountOpen, setDiscountOpen] = useState(false)
  const [editDiscount, setEditDiscount] = useState<PricingDiscount | null>(null)
  const [discountForm, setDiscountForm] = useState({
    name: '', discount_type: 'percentage', discount_value: '',
    applicable_booking_types: ['normal'] as string[], applicable_durations: [] as number[],
    min_bookings_per_month: '0', requires_membership: false, is_stackable: false,
    is_active: true, valid_from: '', valid_until: '', notes: '',
  })

  // ─── Helpers ────────────────────────────────────────
  function formatDuration(min: number) {
    if (min >= 60) { const h = Math.floor(min / 60); const m = min % 60; return m > 0 ? `${h}h${m}` : `${h}h` }
    return `${min}min`
  }

  function formatPrice(n: number) { return n.toFixed(2) + ' €' }

  const groupedRules = rules.reduce<Record<string, PricingRule[]>>((acc, r) => {
    if (!acc[r.booking_type]) acc[r.booking_type] = []
    acc[r.booking_type].push(r)
    return acc
  }, {})

  // ─── CRUD: Rules ──────────────────────────────────
  function openNewRule(type: string = 'normal') {
    setEditRule(null)
    setForm({
      name: '', duration_minutes: '90', base_price: '', lighting_surcharge: '4',
      booking_type: type, discount_pct: '0', fixed_price: '',
      peak_surcharge: '0', is_active: true, priority: '0', notes: '',
      time_slot_id: '', court_group: '', min_players: '0', max_daily_uses: '0',
      valid_from: '', valid_until: '',
    })
    setRuleOpen(true)
  }

  function openEditRule(r: PricingRule) {
    setEditRule(r)
    setForm({
      name: r.name, duration_minutes: String(r.duration_minutes),
      base_price: String(r.base_price), lighting_surcharge: String(r.lighting_surcharge),
      booking_type: r.booking_type, discount_pct: String(r.discount_pct),
      fixed_price: r.fixed_price != null ? String(r.fixed_price) : '',
      peak_surcharge: String(r.peak_surcharge), is_active: r.is_active,
      priority: String(r.priority), notes: r.notes || '',
      time_slot_id: r.time_slot_id ? String(r.time_slot_id) : '',
      court_group: r.court_group || '',
      min_players: String(r.min_players || 0), max_daily_uses: String(r.max_daily_uses || 0),
      valid_from: r.valid_from || '', valid_until: r.valid_until || '',
    })
    setRuleOpen(true)
  }

  async function duplicateRule(r: PricingRule) {
    const supabase = createClient()
    const { id, ...rest } = r
    const { error } = await supabase.from('nm_pricing_rules').insert({ ...rest, name: r.name + ' (copia)', club_id: CLUB_ID })
    if (error) toast('error', 'Error duplicando')
    else { toast('success', 'Tarifa duplicada'); loadData() }
  }

  async function toggleRuleActive(r: PricingRule) {
    const supabase = createClient()
    await supabase.from('nm_pricing_rules').update({ is_active: !r.is_active }).eq('id', r.id)
    loadData()
  }

  async function saveRule() {
    if (!form.name || !form.base_price) { toast('warning', 'Nombre y precio base son obligatorios'); return }
    setSaving(true)
    const supabase = createClient()
    const payload = {
      club_id: CLUB_ID, name: form.name,
      duration_minutes: parseInt(form.duration_minutes),
      base_price: parseFloat(form.base_price),
      lighting_surcharge: parseFloat(form.lighting_surcharge) || 0,
      booking_type: form.booking_type,
      discount_pct: parseFloat(form.discount_pct) || 0,
      fixed_price: form.fixed_price ? parseFloat(form.fixed_price) : null,
      peak_surcharge: parseFloat(form.peak_surcharge) || 0,
      is_active: form.is_active, priority: parseInt(form.priority) || 0,
      notes: form.notes || null,
      time_slot_id: form.time_slot_id ? parseInt(form.time_slot_id) : null,
      court_group: form.court_group || null,
      min_players: parseInt(form.min_players) || 0,
      max_daily_uses: parseInt(form.max_daily_uses) || 0,
      valid_from: form.valid_from || null, valid_until: form.valid_until || null,
    }
    const { error } = editRule
      ? await supabase.from('nm_pricing_rules').update(payload).eq('id', editRule.id)
      : await supabase.from('nm_pricing_rules').insert(payload)
    if (error) toast('error', 'Error guardando regla')
    else { toast('success', editRule ? 'Tarifa actualizada' : 'Tarifa creada'); setRuleOpen(false); loadData() }
    setSaving(false)
  }

  async function deleteRule() {
    if (!editRule) return
    setSaving(true)
    const supabase = createClient()
    await supabase.from('nm_pricing_rules').delete().eq('id', editRule.id)
    toast('success', 'Tarifa eliminada'); setRuleOpen(false); loadData()
    setSaving(false)
  }

  // ─── CRUD: Time slots ─────────────────────────────
  function openNewSlot() {
    setEditSlot(null)
    setSlotForm({ name: '', start_time: '08:00', end_time: '13:00', price_multiplier: '1.00', is_active: true })
    setSlotOpen(true)
  }
  function openEditSlot(s: TimeSlot) {
    setEditSlot(s)
    setSlotForm({ name: s.name, start_time: s.start_time.slice(0, 5), end_time: s.end_time.slice(0, 5), price_multiplier: String(s.price_multiplier), is_active: s.is_active })
    setSlotOpen(true)
  }
  async function saveSlot() {
    if (!slotForm.name) { toast('warning', 'Nombre requerido'); return }
    setSaving(true)
    const supabase = createClient()
    const payload = { club_id: CLUB_ID, name: slotForm.name, start_time: slotForm.start_time, end_time: slotForm.end_time, price_multiplier: parseFloat(slotForm.price_multiplier) || 1, is_active: slotForm.is_active, sort_order: timeSlots.length }
    const { error } = editSlot
      ? await supabase.from('nm_pricing_time_slots').update(payload).eq('id', editSlot.id)
      : await supabase.from('nm_pricing_time_slots').insert(payload)
    if (error) toast('error', 'Error guardando franja')
    else { toast('success', editSlot ? 'Franja actualizada' : 'Franja creada'); setSlotOpen(false); loadData() }
    setSaving(false)
  }
  async function deleteSlot() {
    if (!editSlot) return
    setSaving(true)
    const supabase = createClient()
    await supabase.from('nm_pricing_time_slots').delete().eq('id', editSlot.id)
    toast('success', 'Franja eliminada'); setSlotOpen(false); loadData()
    setSaving(false)
  }

  // ─── CRUD: Packs ──────────────────────────────────
  function openNewPack() {
    setEditPack(null)
    setPackForm({ name: '', description: '', pack_type: 'hours', total_units: '10', price: '', valid_days: '90', applicable_durations: [60, 90, 120], applicable_booking_types: ['normal', 'abono'], max_per_user: '1', is_active: true })
    setPackOpen(true)
  }
  function openEditPack(p: PricingPack) {
    setEditPack(p)
    setPackForm({ name: p.name, description: p.description || '', pack_type: p.pack_type, total_units: String(p.total_units), price: String(p.price), valid_days: String(p.valid_days), applicable_durations: p.applicable_durations || [60, 90, 120], applicable_booking_types: p.applicable_booking_types || ['normal'], max_per_user: String(p.max_per_user), is_active: p.is_active })
    setPackOpen(true)
  }
  async function savePack() {
    if (!packForm.name || !packForm.price) { toast('warning', 'Nombre y precio requeridos'); return }
    setSaving(true)
    const supabase = createClient()
    const payload = { club_id: CLUB_ID, name: packForm.name, description: packForm.description || null, pack_type: packForm.pack_type, total_units: parseInt(packForm.total_units), price: parseFloat(packForm.price), valid_days: parseInt(packForm.valid_days), applicable_durations: packForm.applicable_durations, applicable_booking_types: packForm.applicable_booking_types, max_per_user: parseInt(packForm.max_per_user), is_active: packForm.is_active, sort_order: packs.length }
    const { error } = editPack
      ? await supabase.from('nm_pricing_packs').update(payload).eq('id', editPack.id)
      : await supabase.from('nm_pricing_packs').insert(payload)
    if (error) toast('error', 'Error guardando bono')
    else { toast('success', editPack ? 'Bono actualizado' : 'Bono creado'); setPackOpen(false); loadData() }
    setSaving(false)
  }
  async function deletePack() {
    if (!editPack) return
    setSaving(true)
    const supabase = createClient()
    await supabase.from('nm_pricing_packs').delete().eq('id', editPack.id)
    toast('success', 'Bono eliminado'); setPackOpen(false); loadData()
    setSaving(false)
  }

  // ─── CRUD: Seasons ────────────────────────────────
  function openNewSeason() {
    setEditSeason(null)
    setSeasonForm({ name: '', start_date: '', end_date: '', price_multiplier: '1.00', lighting_override: '', is_active: true, color: '#06b6d4', notes: '' })
    setSeasonOpen(true)
  }
  function openEditSeason(s: PricingSeason) {
    setEditSeason(s)
    setSeasonForm({ name: s.name, start_date: s.start_date, end_date: s.end_date, price_multiplier: String(s.price_multiplier), lighting_override: s.lighting_override != null ? String(s.lighting_override) : '', is_active: s.is_active, color: s.color, notes: s.notes || '' })
    setSeasonOpen(true)
  }
  async function saveSeason() {
    if (!seasonForm.name || !seasonForm.start_date || !seasonForm.end_date) { toast('warning', 'Nombre y fechas requeridos'); return }
    setSaving(true)
    const supabase = createClient()
    const payload = { club_id: CLUB_ID, name: seasonForm.name, start_date: seasonForm.start_date, end_date: seasonForm.end_date, price_multiplier: parseFloat(seasonForm.price_multiplier) || 1, lighting_override: seasonForm.lighting_override ? parseFloat(seasonForm.lighting_override) : null, is_active: seasonForm.is_active, color: seasonForm.color, notes: seasonForm.notes || null }
    const { error } = editSeason
      ? await supabase.from('nm_pricing_seasons').update(payload).eq('id', editSeason.id)
      : await supabase.from('nm_pricing_seasons').insert(payload)
    if (error) toast('error', 'Error guardando temporada')
    else { toast('success', editSeason ? 'Temporada actualizada' : 'Temporada creada'); setSeasonOpen(false); loadData() }
    setSaving(false)
  }
  async function deleteSeason() {
    if (!editSeason) return
    setSaving(true)
    const supabase = createClient()
    await supabase.from('nm_pricing_seasons').delete().eq('id', editSeason.id)
    toast('success', 'Temporada eliminada'); setSeasonOpen(false); loadData()
    setSaving(false)
  }

  // ─── CRUD: Discounts ──────────────────────────────
  function openNewDiscount() {
    setEditDiscount(null)
    setDiscountForm({ name: '', discount_type: 'percentage', discount_value: '', applicable_booking_types: ['normal'], applicable_durations: [], min_bookings_per_month: '0', requires_membership: false, is_stackable: false, is_active: true, valid_from: '', valid_until: '', notes: '' })
    setDiscountOpen(true)
  }
  function openEditDiscount(d: PricingDiscount) {
    setEditDiscount(d)
    setDiscountForm({ name: d.name, discount_type: d.discount_type, discount_value: String(d.discount_value), applicable_booking_types: d.applicable_booking_types || ['normal'], applicable_durations: d.applicable_durations || [], min_bookings_per_month: String(d.min_bookings_per_month), requires_membership: d.requires_membership, is_stackable: d.is_stackable, is_active: d.is_active, valid_from: d.valid_from || '', valid_until: d.valid_until || '', notes: d.notes || '' })
    setDiscountOpen(true)
  }
  async function saveDiscount() {
    if (!discountForm.name || !discountForm.discount_value) { toast('warning', 'Nombre y valor requeridos'); return }
    setSaving(true)
    const supabase = createClient()
    const payload = { club_id: CLUB_ID, name: discountForm.name, discount_type: discountForm.discount_type, discount_value: parseFloat(discountForm.discount_value), applicable_booking_types: discountForm.applicable_booking_types, applicable_durations: discountForm.applicable_durations.length > 0 ? discountForm.applicable_durations : null, min_bookings_per_month: parseInt(discountForm.min_bookings_per_month) || 0, requires_membership: discountForm.requires_membership, is_stackable: discountForm.is_stackable, is_active: discountForm.is_active, valid_from: discountForm.valid_from || null, valid_until: discountForm.valid_until || null, notes: discountForm.notes || null, sort_order: discounts.length }
    const { error } = editDiscount
      ? await supabase.from('nm_pricing_discounts').update(payload).eq('id', editDiscount.id)
      : await supabase.from('nm_pricing_discounts').insert(payload)
    if (error) toast('error', 'Error guardando descuento')
    else { toast('success', editDiscount ? 'Descuento actualizado' : 'Descuento creado'); setDiscountOpen(false); loadData() }
    setSaving(false)
  }
  async function deleteDiscount() {
    if (!editDiscount) return
    setSaving(true)
    const supabase = createClient()
    await supabase.from('nm_pricing_discounts').delete().eq('id', editDiscount.id)
    toast('success', 'Descuento eliminado'); setDiscountOpen(false); loadData()
    setSaving(false)
  }

  // ─── Save config ──────────────────────────────────
  async function saveConfig() {
    setSavingConfig(true)
    const supabase = createClient()
    const payload = {
      peak_start: configForm.peak_start, peak_end: configForm.peak_end,
      peak_days: configForm.peak_days,
      weekend_surcharge: parseFloat(configForm.weekend_surcharge) || 0,
      holiday_surcharge: parseFloat(configForm.holiday_surcharge) || 0,
      min_advance_hours: parseInt(configForm.min_advance_hours) || 2,
      max_advance_days: parseInt(configForm.max_advance_days) || 14,
      cancellation_hours: parseInt(configForm.cancellation_hours) || 12,
      auto_lighting_time: configForm.auto_lighting_time,
      allow_custom_duration: configForm.allow_custom_duration,
      custom_duration_price_per_min: parseFloat(configForm.custom_duration_price_per_min) || 0.20,
      iva_pct: parseFloat(configForm.iva_pct) || 21,
      show_prices_with_iva: configForm.show_prices_with_iva,
      updated_at: new Date().toISOString(),
    }
    const { error } = config
      ? await supabase.from('nm_pricing_config').update(payload).eq('id', config.id)
      : await supabase.from('nm_pricing_config').insert({ ...payload, club_id: CLUB_ID })
    if (error) toast('error', 'Error guardando configuración')
    else { toast('success', 'Configuración guardada'); loadData() }
    setSavingConfig(false)
  }

  function togglePeakDay(day: number) {
    setConfigForm(f => ({ ...f, peak_days: f.peak_days.includes(day) ? f.peak_days.filter(d => d !== day) : [...f.peak_days, day] }))
  }

  // ─── Court pricing CRUD ───────────────────────────
  async function saveCourtOverride(courtId: number, ruleId: number, price: string, lighting: string) {
    const supabase = createClient()
    const payload = {
      club_id: CLUB_ID, court_id: courtId, pricing_rule_id: ruleId,
      override_price: price ? parseFloat(price) : null,
      override_lighting: lighting ? parseFloat(lighting) : null,
      is_active: true,
    }
    // upsert
    const existing = courtPricing.find(cp => cp.court_id === courtId && cp.pricing_rule_id === ruleId)
    if (existing) {
      await supabase.from('nm_court_pricing').update(payload).eq('id', existing.id)
    } else if (price || lighting) {
      await supabase.from('nm_court_pricing').insert(payload)
    }
    loadData()
  }

  async function removeCourtOverride(id: number) {
    const supabase = createClient()
    await supabase.from('nm_court_pricing').delete().eq('id', id)
    loadData()
  }

  // ─── Loading ──────────────────────────────────────
  if (loading) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-white">Configuración de Precios</h1>
        <div className="flex items-center justify-center py-24">
          <div className="w-8 h-8 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin" />
        </div>
      </div>
    )
  }

  // ════════════════════════════════════════════════════
  // RENDER
  // ════════════════════════════════════════════════════
  const TABS: { id: TabId; label: string; icon: React.ReactNode; count?: number }[] = [
    { id: 'tarifas', label: 'Tarifas', icon: <DollarSign size={14} />, count: rules.length },
    { id: 'franjas', label: 'Franjas Horarias', icon: <Clock size={14} />, count: timeSlots.length },
    { id: 'bonos', label: 'Bonos / Packs', icon: <Package size={14} />, count: packs.length },
    { id: 'temporadas', label: 'Temporadas', icon: <Calendar size={14} />, count: seasons.length },
    { id: 'descuentos', label: 'Descuentos', icon: <Percent size={14} />, count: discounts.length },
    { id: 'pistas', label: 'Precios por Pista', icon: <Tag size={14} />, count: courtPricing.length },
    { id: 'config', label: 'Configuración', icon: <Settings2 size={14} /> },
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Configuración de Precios</h1>
          <p className="text-sm text-slate-400 mt-1">Tarifas, franjas horarias, bonos, temporadas, descuentos y más</p>
        </div>
        <Button variant="secondary" size="sm" onClick={loadData}><RefreshCw size={14} /> Recargar</Button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
        <KpiCard title="Tarifas" value={rules.length} subtitle={`${rules.filter(r => r.is_active).length} activas`} icon={<DollarSign size={18} />} color="#06b6d4" />
        <KpiCard title="Franjas" value={timeSlots.length} subtitle="horarias" icon={<Clock size={18} />} color="#8b5cf6" />
        <KpiCard title="Bonos" value={packs.length} subtitle="disponibles" icon={<Package size={18} />} color="#22c55e" />
        <KpiCard title="Temporadas" value={seasons.filter(s => s.is_active).length} subtitle="activas" icon={<Calendar size={18} />} color="#f59e0b" />
        <KpiCard title="Descuentos" value={discounts.filter(d => d.is_active).length} subtitle="activos" icon={<Percent size={18} />} color="#ef4444" />
        <KpiCard title="Pistas" value={courts.length} subtitle={`${courtPricing.length} overrides`} icon={<Tag size={18} />} color="#ec4899" />
      </div>

      {/* ── Resumen rápido de precios ─────────────────────── */}
      <div className="rounded-xl border border-slate-700/50 bg-slate-800/50 p-4 overflow-x-auto">
        <h3 className="text-sm font-semibold text-slate-300 mb-3">Resumen de Tarifas — Precio Normal (sin luz / con luz)</h3>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-700/50">
              <th className="text-left text-xs text-slate-500 pb-2 pr-4">Duración</th>
              {Object.entries(BOOKING_TYPES).map(([type, meta]) => (
                <th key={type} className="text-center text-xs text-slate-500 pb-2 px-2">{meta.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {DURATION_OPTIONS.map(dur => {
              const durMin = parseInt(dur.value)
              const hasAny = rules.some(r => r.duration_minutes === durMin)
              if (!hasAny) return null
              return (
                <tr key={dur.value} className="border-b border-slate-700/20">
                  <td className="py-2 pr-4 text-slate-300 font-medium">{dur.label}</td>
                  {Object.keys(BOOKING_TYPES).map(type => {
                    const rule = rules.find(r => r.duration_minutes === durMin && r.booking_type === type && r.is_active)
                    if (!rule) return <td key={type} className="text-center py-2 px-2 text-slate-600">—</td>
                    const basePrice = rule.fixed_price ?? rule.base_price
                    return (
                      <td key={type} className="text-center py-2 px-2">
                        <span className="text-white font-medium">{basePrice.toFixed(0)}€</span>
                        {rule.lighting_surcharge > 0 && (
                          <span className="text-amber-400 text-xs ml-1">/ {(basePrice + rule.lighting_surcharge).toFixed(0)}€</span>
                        )}
                      </td>
                    )
                  })}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 overflow-x-auto pb-1 border-b border-slate-700/50">
        {TABS.map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium rounded-t-lg transition-colors whitespace-nowrap ${activeTab === tab.id ? 'bg-slate-800 text-cyan-400 border-b-2 border-cyan-400' : 'text-slate-400 hover:text-white hover:bg-slate-800/50'}`}>
            {tab.icon} {tab.label}
            {tab.count !== undefined && <span className="text-[10px] bg-slate-700 px-1.5 py-0.5 rounded-full ml-1">{tab.count}</span>}
          </button>
        ))}
      </div>

      {/* ══════════════════════════════════════════════════ */}
      {/* TAB: TARIFAS                                     */}
      {/* ══════════════════════════════════════════════════ */}
      {activeTab === 'tarifas' && (
        <section className="space-y-6">
          <div className="flex justify-end">
            <Button size="sm" onClick={() => openNewRule('normal')}><Plus size={14} /> Nueva Tarifa</Button>
          </div>

          {Object.entries(BOOKING_TYPES).map(([type, meta]) => {
            const typeRules = groupedRules[type]
            if (!typeRules && type !== 'normal') return null
            return (
              <div key={type} className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-slate-400">{meta.icon}</span>
                    <h3 className="text-white font-medium">{meta.label}</h3>
                    <Badge variant={meta.color}>{typeRules?.length || 0}</Badge>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => openNewRule(type)}><Plus size={12} /> Agregar</Button>
                </div>

                {typeRules && typeRules.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                    {typeRules.map(r => {
                      const slot = r.time_slot_id ? timeSlots.find(s => s.id === r.time_slot_id) : null
                      return (
                        <div key={r.id} className={`rounded-xl border p-4 transition-all ${r.is_active ? 'border-slate-700/50 bg-slate-800/60 hover:border-cyan-500/50' : 'border-slate-700/30 bg-slate-800/30 opacity-50'}`}>
                          <div className="flex items-start justify-between mb-3">
                            <div>
                              <p className="text-white font-semibold text-sm">{r.name}</p>
                              <div className="flex items-center gap-1.5 mt-0.5">
                                <span className="text-xs text-slate-500">{formatDuration(r.duration_minutes)}</span>
                                {slot && <Badge variant="info" className="text-[9px] px-1 py-0">{slot.name}</Badge>}
                                {r.valid_from && <Badge variant="warning" className="text-[9px] px-1 py-0">Temporal</Badge>}
                              </div>
                            </div>
                            <div className="flex items-center gap-1">
                              <button onClick={() => toggleRuleActive(r)} className="p-1 text-slate-500 hover:text-cyan-400" title={r.is_active ? 'Desactivar' : 'Activar'}>
                                {r.is_active ? <ToggleRight size={16} className="text-cyan-400" /> : <ToggleLeft size={16} />}
                              </button>
                              <button onClick={() => duplicateRule(r)} className="p-1 text-slate-500 hover:text-white" title="Duplicar"><Copy size={12} /></button>
                              <button onClick={() => openEditRule(r)} className="p-1 text-slate-500 hover:text-white" title="Editar"><Edit2 size={12} /></button>
                            </div>
                          </div>

                          <div className="space-y-1">
                            <div className="flex justify-between text-sm">
                              <span className="text-slate-400">Base</span>
                              <span className="text-white font-semibold">{formatPrice(r.base_price)}</span>
                            </div>
                            {r.lighting_surcharge > 0 && (
                              <div className="flex justify-between text-sm">
                                <span className="text-slate-400 flex items-center gap-1"><Lightbulb size={10} className="text-amber-400" /> Luz</span>
                                <span className="text-amber-400">+{formatPrice(r.lighting_surcharge)}</span>
                              </div>
                            )}
                            {r.peak_surcharge > 0 && (
                              <div className="flex justify-between text-sm">
                                <span className="text-slate-400 flex items-center gap-1"><Sun size={10} className="text-orange-400" /> Pico</span>
                                <span className="text-orange-400">+{formatPrice(r.peak_surcharge)}</span>
                              </div>
                            )}
                            {r.discount_pct > 0 && (
                              <div className="flex justify-between text-sm">
                                <span className="text-slate-400">Dto.</span>
                                <span className="text-green-400">-{r.discount_pct}%</span>
                              </div>
                            )}
                            {r.fixed_price != null && (
                              <div className="flex justify-between text-sm">
                                <span className="text-slate-400">Fijo</span>
                                <span className="text-cyan-400 font-bold">{formatPrice(r.fixed_price)}</span>
                              </div>
                            )}
                          </div>

                          <div className="mt-3 pt-2 border-t border-slate-700/30 grid grid-cols-2 gap-x-3 text-xs">
                            <div className="flex justify-between"><span className="text-slate-500">Sin luz</span><span className="text-white">{formatPrice(r.fixed_price ?? r.base_price)}</span></div>
                            <div className="flex justify-between"><span className="text-slate-500">Con luz</span><span className="text-white">{formatPrice((r.fixed_price ?? r.base_price) + r.lighting_surcharge)}</span></div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                ) : (
                  <div className="rounded-xl border border-dashed border-slate-700 p-6 text-center text-sm text-slate-500">
                    Sin tarifas para {meta.label.toLowerCase()} — <button onClick={() => openNewRule(type)} className="text-cyan-400 hover:underline">crear una</button>
                  </div>
                )}
              </div>
            )
          })}
        </section>
      )}

      {/* ══════════════════════════════════════════════════ */}
      {/* TAB: FRANJAS HORARIAS                            */}
      {/* ══════════════════════════════════════════════════ */}
      {activeTab === 'franjas' && (
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-slate-400">Definí franjas horarias con multiplicador de precio. Ej: Mañana ×0.90 (10% descuento), Noche ×1.15 (15% recargo)</p>
            <Button size="sm" onClick={openNewSlot}><Plus size={14} /> Nueva Franja</Button>
          </div>

          {/* Visual timeline */}
          <div className="rounded-xl border border-slate-700/50 bg-slate-800/50 p-4">
            <div className="flex items-center gap-2 mb-4">
              <Clock size={14} className="text-slate-400" />
              <span className="text-sm font-medium text-slate-300">Línea de tiempo</span>
            </div>
            <div className="relative h-16 bg-slate-700/30 rounded-lg overflow-hidden">
              {timeSlots.map((s, i) => {
                const startH = parseInt(s.start_time.split(':')[0])
                const endH = parseInt(s.end_time.split(':')[0])
                const total = 16 // 8am to midnight
                const left = ((startH - 8) / total) * 100
                const width = ((endH - startH) / total) * 100
                const colors = ['bg-blue-500/30', 'bg-amber-500/30', 'bg-purple-500/30', 'bg-green-500/30']
                return (
                  <div key={s.id} className={`absolute top-0 bottom-0 ${colors[i % colors.length]} flex flex-col items-center justify-center text-xs border-r border-slate-600/50`} style={{ left: `${Math.max(0, left)}%`, width: `${Math.min(100 - left, width)}%` }}>
                    <span className="text-white font-medium">{s.name}</span>
                    <span className="text-slate-300">×{s.price_multiplier}</span>
                    <span className="text-slate-400 text-[10px]">{s.start_time.slice(0, 5)} - {s.end_time.slice(0, 5)}</span>
                  </div>
                )
              })}
              {/* Hour marks */}
              <div className="absolute bottom-0 left-0 right-0 flex">
                {Array.from({ length: 9 }, (_, i) => (
                  <div key={i} className="flex-1 border-l border-slate-600/30 text-[8px] text-slate-500 pl-0.5">{8 + i * 2}:00</div>
                ))}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {timeSlots.map(s => {
              const icon = s.name.toLowerCase().includes('mañana') ? <Sunrise size={20} className="text-amber-400" /> :
                s.name.toLowerCase().includes('tarde') ? <CloudSun size={20} className="text-orange-400" /> :
                  <Sunset size={20} className="text-purple-400" />
              return (
                <div key={s.id} onClick={() => openEditSlot(s)} className={`rounded-xl border p-5 cursor-pointer transition-all hover:border-cyan-500/50 ${s.is_active ? 'border-slate-700/50 bg-slate-800/60' : 'border-slate-700/30 bg-slate-800/30 opacity-50'}`}>
                  <div className="flex items-center gap-3 mb-3">
                    {icon}
                    <div>
                      <p className="text-white font-semibold">{s.name}</p>
                      <p className="text-xs text-slate-500">{s.start_time.slice(0, 5)} — {s.end_time.slice(0, 5)}</p>
                    </div>
                    <div className="ml-auto">
                      <div className={`text-lg font-bold ${s.price_multiplier > 1 ? 'text-red-400' : s.price_multiplier < 1 ? 'text-green-400' : 'text-white'}`}>
                        ×{s.price_multiplier}
                      </div>
                      <p className="text-[10px] text-slate-500 text-right">
                        {s.price_multiplier > 1 ? `+${((s.price_multiplier - 1) * 100).toFixed(0)}%` : s.price_multiplier < 1 ? `-${((1 - s.price_multiplier) * 100).toFixed(0)}%` : 'base'}
                      </p>
                    </div>
                  </div>
                  {/* Price preview for 1h normal */}
                  {rules.filter(r => r.booking_type === 'normal' && r.is_active).slice(0, 3).map(r => (
                    <div key={r.id} className="flex justify-between text-xs text-slate-400 py-0.5">
                      <span>{r.name}</span>
                      <span className="text-white">{(r.base_price * s.price_multiplier).toFixed(2)} €</span>
                    </div>
                  ))}
                </div>
              )
            })}
          </div>
        </section>
      )}

      {/* ══════════════════════════════════════════════════ */}
      {/* TAB: BONOS / PACKS                               */}
      {/* ══════════════════════════════════════════════════ */}
      {activeTab === 'bonos' && (
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-slate-400">Paquetes de horas o sesiones con descuento. Los usuarios los compran y consumen al reservar.</p>
            <Button size="sm" onClick={openNewPack}><Plus size={14} /> Nuevo Bono</Button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {packs.map(p => {
              const savings = rules.find(r => r.booking_type === 'normal' && r.duration_minutes === 60 && r.is_active)
              const normalPrice = savings ? savings.base_price * p.total_units : 0
              const savedAmount = normalPrice - p.price
              return (
                <div key={p.id} onClick={() => openEditPack(p)} className={`rounded-xl border p-5 cursor-pointer transition-all hover:border-cyan-500/50 ${p.is_active ? 'border-slate-700/50 bg-slate-800/60' : 'border-slate-700/30 bg-slate-800/30 opacity-50'}`}>
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <Package size={20} className="text-green-400" />
                      <div>
                        <p className="text-white font-semibold">{p.name}</p>
                        {p.description && <p className="text-xs text-slate-500 mt-0.5">{p.description}</p>}
                      </div>
                    </div>
                    <Badge variant={p.is_active ? 'success' : 'default'}>{p.is_active ? 'Activo' : 'Inactivo'}</Badge>
                  </div>

                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-slate-400">{p.pack_type === 'hours' ? 'Horas' : p.pack_type === 'sessions' ? 'Sesiones' : 'Créditos'}</span>
                      <span className="text-white font-bold text-lg">{p.total_units}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Precio total</span>
                      <span className="text-green-400 font-bold text-lg">{formatPrice(p.price)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Precio por unidad</span>
                      <span className="text-white">{formatPrice(p.unit_price)}</span>
                    </div>
                    {savedAmount > 0 && (
                      <div className="flex justify-between bg-green-500/10 rounded-lg px-2 py-1">
                        <span className="text-green-400 text-xs">Ahorro vs. precio normal</span>
                        <span className="text-green-400 font-bold">{formatPrice(savedAmount)} ({((savedAmount / normalPrice) * 100).toFixed(0)}%)</span>
                      </div>
                    )}
                    <div className="flex justify-between text-xs text-slate-500 pt-1 border-t border-slate-700/30">
                      <span>Válido {p.valid_days} días</span>
                      <span>Máx {p.max_per_user} por usuario</span>
                    </div>
                    <div className="flex gap-1 flex-wrap">
                      {(p.applicable_durations || []).map(d => (
                        <span key={d} className="text-[10px] bg-slate-700/50 text-slate-300 px-1.5 py-0.5 rounded">{formatDuration(d)}</span>
                      ))}
                    </div>
                  </div>
                </div>
              )
            })}
            {packs.length === 0 && (
              <div className="col-span-full rounded-xl border border-dashed border-slate-700 p-8 text-center text-slate-500">
                Sin bonos configurados — <button onClick={openNewPack} className="text-cyan-400 hover:underline">crear uno</button>
              </div>
            )}
          </div>
        </section>
      )}

      {/* ══════════════════════════════════════════════════ */}
      {/* TAB: TEMPORADAS                                  */}
      {/* ══════════════════════════════════════════════════ */}
      {activeTab === 'temporadas' && (
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-slate-400">Temporadas con multiplicador de precio. Ej: Verano ×1.10 (+10%), Invierno ×0.95 (-5%)</p>
            <Button size="sm" onClick={openNewSeason}><Plus size={14} /> Nueva Temporada</Button>
          </div>

          {/* Timeline visual */}
          <div className="rounded-xl border border-slate-700/50 bg-slate-800/50 p-4">
            <div className="space-y-2">
              {seasons.map(s => {
                const start = new Date(s.start_date)
                const end = new Date(s.end_date)
                const yearStart = new Date(start.getFullYear(), 0, 1)
                const yearEnd = new Date(start.getFullYear(), 11, 31)
                const yearMs = yearEnd.getTime() - yearStart.getTime()
                const left = ((start.getTime() - yearStart.getTime()) / yearMs) * 100
                const width = ((end.getTime() - start.getTime()) / yearMs) * 100
                return (
                  <div key={s.id} className="relative h-10 rounded-lg overflow-hidden bg-slate-700/20">
                    <div className="absolute top-0 bottom-0 rounded flex items-center px-3 text-xs font-medium text-white" style={{ left: `${left}%`, width: `${width}%`, backgroundColor: s.color + '40', borderLeft: `3px solid ${s.color}` }}>
                      {s.name} (×{s.price_multiplier})
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {seasons.map(s => {
              const icon = s.name.toLowerCase().includes('verano') ? <Flame size={20} /> :
                s.name.toLowerCase().includes('invierno') ? <Snowflake size={20} /> : <Star size={20} />
              const isActive = s.is_active && new Date(s.start_date) <= new Date() && new Date(s.end_date) >= new Date()
              return (
                <div key={s.id} onClick={() => openEditSeason(s)} className={`rounded-xl border p-5 cursor-pointer transition-all hover:border-cyan-500/50 ${s.is_active ? 'border-slate-700/50 bg-slate-800/60' : 'opacity-50 bg-slate-800/30 border-slate-700/30'}`}>
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: s.color + '20', color: s.color }}>{icon}</div>
                      <div>
                        <p className="text-white font-semibold">{s.name}</p>
                        <p className="text-xs text-slate-500">{new Date(s.start_date).toLocaleDateString('es-ES')} — {new Date(s.end_date).toLocaleDateString('es-ES')}</p>
                      </div>
                    </div>
                    {isActive && <Badge variant="success">Activa ahora</Badge>}
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-400">Multiplicador</span>
                    <span className={`text-lg font-bold ${s.price_multiplier > 1 ? 'text-red-400' : s.price_multiplier < 1 ? 'text-green-400' : 'text-white'}`}>
                      ×{s.price_multiplier}
                    </span>
                  </div>
                  {s.lighting_override != null && (
                    <div className="flex items-center justify-between text-sm mt-1">
                      <span className="text-slate-400 flex items-center gap-1"><Lightbulb size={10} className="text-amber-400" /> Luz override</span>
                      <span className="text-amber-400">{formatPrice(s.lighting_override)}</span>
                    </div>
                  )}
                  {s.notes && <p className="text-xs text-slate-500 mt-2">{s.notes}</p>}
                </div>
              )
            })}
            {seasons.length === 0 && (
              <div className="col-span-full rounded-xl border border-dashed border-slate-700 p-8 text-center text-slate-500">
                Sin temporadas — <button onClick={openNewSeason} className="text-cyan-400 hover:underline">crear una</button>
              </div>
            )}
          </div>
        </section>
      )}

      {/* ══════════════════════════════════════════════════ */}
      {/* TAB: DESCUENTOS                                  */}
      {/* ══════════════════════════════════════════════════ */}
      {activeTab === 'descuentos' && (
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-slate-400">Descuentos por grupo, tipo de socio o condiciones. Se aplican automáticamente o manualmente.</p>
            <Button size="sm" onClick={openNewDiscount}><Plus size={14} /> Nuevo Descuento</Button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {discounts.map(d => (
              <div key={d.id} onClick={() => openEditDiscount(d)} className={`rounded-xl border p-5 cursor-pointer transition-all hover:border-cyan-500/50 ${d.is_active ? 'border-slate-700/50 bg-slate-800/60' : 'opacity-50 bg-slate-800/30 border-slate-700/30'}`}>
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Percent size={20} className="text-green-400" />
                    <div>
                      <p className="text-white font-semibold">{d.name}</p>
                      <p className="text-xs text-slate-500">{DISCOUNT_TYPES[d.discount_type]}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-2xl font-bold text-green-400">
                      {d.discount_type === 'percentage' ? `-${d.discount_value}%` : d.discount_type === 'fixed_amount' ? `-${formatPrice(d.discount_value)}` : formatPrice(d.discount_value)}
                    </span>
                  </div>
                </div>

                <div className="space-y-1.5 text-xs">
                  {d.requires_membership && (
                    <div className="flex items-center gap-1 text-amber-400"><CreditCard size={10} /> Requiere membresía</div>
                  )}
                  {d.min_bookings_per_month > 0 && (
                    <div className="text-slate-400">Mín. {d.min_bookings_per_month} reservas/mes</div>
                  )}
                  {d.is_stackable && (
                    <div className="text-cyan-400">Acumulable con otros descuentos</div>
                  )}
                  {d.valid_from && d.valid_until && (
                    <div className="text-slate-500">Válido: {new Date(d.valid_from).toLocaleDateString('es-ES')} — {new Date(d.valid_until).toLocaleDateString('es-ES')}</div>
                  )}
                  <div className="flex gap-1 flex-wrap pt-1">
                    {(d.applicable_booking_types || []).map(t => (
                      <Badge key={t} variant={BOOKING_TYPES[t]?.color || 'default'} className="text-[9px]">{BOOKING_TYPES[t]?.label || t}</Badge>
                    ))}
                  </div>
                </div>
              </div>
            ))}
            {discounts.length === 0 && (
              <div className="col-span-full rounded-xl border border-dashed border-slate-700 p-8 text-center text-slate-500">
                Sin descuentos — <button onClick={openNewDiscount} className="text-cyan-400 hover:underline">crear uno</button>
              </div>
            )}
          </div>
        </section>
      )}

      {/* ══════════════════════════════════════════════════ */}
      {/* TAB: PRECIOS POR PISTA                           */}
      {/* ══════════════════════════════════════════════════ */}
      {activeTab === 'pistas' && (
        <section className="space-y-4">
          <p className="text-sm text-slate-400">Precios específicos por pista. Si una pista tiene override, ese precio se usa en vez del global.</p>

          <div className="rounded-xl border border-slate-700/50 bg-slate-800/50 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-700/50">
                  <th className="text-left text-xs text-slate-500 p-3">Pista</th>
                  {rules.filter(r => r.booking_type === 'normal' && r.is_active).map(r => (
                    <th key={r.id} className="text-center text-xs text-slate-500 p-3">
                      {r.name}<br /><span className="text-slate-600">{formatDuration(r.duration_minutes)}</span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {courts.map(c => (
                  <tr key={c.id} className="border-b border-slate-700/20 hover:bg-slate-700/20">
                    <td className="p-3 text-white font-medium">
                      {c.name}
                      <span className="text-[10px] text-slate-500 ml-2">{c.surface}</span>
                    </td>
                    {rules.filter(r => r.booking_type === 'normal' && r.is_active).map(r => {
                      const cp = courtPricing.find(x => x.court_id === c.id && x.pricing_rule_id === r.id)
                      const hasOverride = cp && (cp.override_price != null || cp.override_lighting != null)
                      return (
                        <td key={r.id} className="p-3 text-center">
                          {hasOverride ? (
                            <div>
                              <span className="text-cyan-400 font-medium">{cp.override_price != null ? formatPrice(cp.override_price) : formatPrice(r.base_price)}</span>
                              <button onClick={() => removeCourtOverride(cp.id)} className="ml-1 text-red-400 hover:text-red-300 text-[10px]">✕</button>
                            </div>
                          ) : (
                            <span className="text-slate-500">{formatPrice(r.base_price)}</span>
                          )}
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p className="text-xs text-slate-500">Para crear un override, usá el formulario de tarifa y seleccioná "Grupo de pistas", o contactá soporte para asignación individual.</p>
        </section>
      )}

      {/* ══════════════════════════════════════════════════ */}
      {/* TAB: CONFIGURACIÓN                               */}
      {/* ══════════════════════════════════════════════════ */}
      {activeTab === 'config' && (
        <section className="space-y-6">
          <div className="flex justify-end">
            <Button size="sm" onClick={saveConfig} loading={savingConfig}><Save size={14} /> Guardar Configuración</Button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Horario pico */}
            <div className="rounded-xl border border-slate-700/50 bg-slate-800/50 p-5 space-y-4">
              <h3 className="text-white font-semibold flex items-center gap-2"><Sun size={16} className="text-orange-400" /> Horario Pico</h3>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Inicio</label>
                  <input type="time" value={configForm.peak_start} onChange={e => setConfigForm(f => ({ ...f, peak_start: e.target.value }))} className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white" />
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Fin</label>
                  <input type="time" value={configForm.peak_end} onChange={e => setConfigForm(f => ({ ...f, peak_end: e.target.value }))} className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white" />
                </div>
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1.5">Días con horario pico</label>
                <div className="flex gap-1.5">
                  {[1, 2, 3, 4, 5, 6, 0].map(d => (
                    <button key={d} type="button" onClick={() => togglePeakDay(d)} className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${configForm.peak_days.includes(d) ? 'bg-orange-500/20 text-orange-400 border border-orange-500/30' : 'bg-slate-700/50 text-slate-500 border border-transparent'}`}>
                      {DAY_NAMES[d]}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Recargos */}
            <div className="rounded-xl border border-slate-700/50 bg-slate-800/50 p-5 space-y-4">
              <h3 className="text-white font-semibold flex items-center gap-2"><DollarSign size={16} className="text-cyan-400" /> Recargos Adicionales</h3>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Fin de semana (€)</label>
                  <input type="number" min="0" step="0.5" value={configForm.weekend_surcharge} onChange={e => setConfigForm(f => ({ ...f, weekend_surcharge: e.target.value }))} className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white" />
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Festivos (€)</label>
                  <input type="number" min="0" step="0.5" value={configForm.holiday_surcharge} onChange={e => setConfigForm(f => ({ ...f, holiday_surcharge: e.target.value }))} className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white" />
                </div>
              </div>
            </div>

            {/* Reservas */}
            <div className="rounded-xl border border-slate-700/50 bg-slate-800/50 p-5 space-y-4">
              <h3 className="text-white font-semibold flex items-center gap-2"><Clock size={16} className="text-cyan-400" /> Reglas de Reserva</h3>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Antelación mín. (hs)</label>
                  <input type="number" min="0" value={configForm.min_advance_hours} onChange={e => setConfigForm(f => ({ ...f, min_advance_hours: e.target.value }))} className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white" />
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Máx. días adelanto</label>
                  <input type="number" min="1" value={configForm.max_advance_days} onChange={e => setConfigForm(f => ({ ...f, max_advance_days: e.target.value }))} className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white" />
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Cancelar (hs antes)</label>
                  <input type="number" min="0" value={configForm.cancellation_hours} onChange={e => setConfigForm(f => ({ ...f, cancellation_hours: e.target.value }))} className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white" />
                </div>
              </div>
            </div>

            {/* Iluminación */}
            <div className="rounded-xl border border-slate-700/50 bg-slate-800/50 p-5 space-y-4">
              <h3 className="text-white font-semibold flex items-center gap-2"><Lightbulb size={16} className="text-amber-400" /> Iluminación</h3>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Hora automática de luz</label>
                <input type="time" value={configForm.auto_lighting_time} onChange={e => setConfigForm(f => ({ ...f, auto_lighting_time: e.target.value }))} className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white" />
                <p className="text-[10px] text-slate-500 mt-1">A partir de esta hora se cobra recargo de luz automáticamente</p>
              </div>
            </div>

            {/* IVA */}
            <div className="rounded-xl border border-slate-700/50 bg-slate-800/50 p-5 space-y-4">
              <h3 className="text-white font-semibold flex items-center gap-2"><Receipt size={16} className="text-cyan-400" /> Impuestos</h3>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-slate-400 mb-1">IVA (%)</label>
                  <input type="number" min="0" max="100" step="0.5" value={configForm.iva_pct} onChange={e => setConfigForm(f => ({ ...f, iva_pct: e.target.value }))} className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white" />
                </div>
                <div className="flex items-end pb-2">
                  <label className="flex items-center gap-2 text-sm text-slate-300 cursor-pointer">
                    <input type="checkbox" checked={configForm.show_prices_with_iva} onChange={e => setConfigForm(f => ({ ...f, show_prices_with_iva: e.target.checked }))} className="rounded border-slate-600 bg-slate-800 text-cyan-500" />
                    Mostrar precios con IVA
                  </label>
                </div>
              </div>
            </div>

            {/* Duración personalizada */}
            <div className="rounded-xl border border-slate-700/50 bg-slate-800/50 p-5 space-y-4">
              <h3 className="text-white font-semibold flex items-center gap-2"><Settings2 size={16} className="text-purple-400" /> Duración Personalizada</h3>
              <label className="flex items-center gap-2 text-sm text-slate-300 cursor-pointer">
                <input type="checkbox" checked={configForm.allow_custom_duration} onChange={e => setConfigForm(f => ({ ...f, allow_custom_duration: e.target.checked }))} className="rounded border-slate-600 bg-slate-800 text-cyan-500" />
                Permitir duraciones personalizadas
              </label>
              {configForm.allow_custom_duration && (
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Precio por minuto (€)</label>
                  <input type="number" min="0" step="0.01" value={configForm.custom_duration_price_per_min} onChange={e => setConfigForm(f => ({ ...f, custom_duration_price_per_min: e.target.value }))} className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white" />
                  <p className="text-[10px] text-slate-500 mt-1">Ej: 0.20 €/min = 12€ por hora</p>
                </div>
              )}
            </div>
          </div>
        </section>
      )}

      {/* ══════════════════════════════════════════════════ */}
      {/* MODALS                                           */}
      {/* ══════════════════════════════════════════════════ */}

      {/* ── Rule Modal ──────────────────────────────────── */}
      <Modal open={ruleOpen} onClose={() => setRuleOpen(false)} title={editRule ? `Editar: ${editRule.name}` : 'Nueva Tarifa'} size="lg" footer={
        <div className="flex items-center justify-between w-full">
          <div>{editRule && <Button variant="danger" size="sm" onClick={deleteRule} disabled={saving}><Trash2 size={14} /> Eliminar</Button>}</div>
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" onClick={() => setRuleOpen(false)}>Cancelar</Button>
            <Button size="sm" onClick={saveRule} loading={saving}>{editRule ? 'Guardar' : 'Crear tarifa'}</Button>
          </div>
        </div>
      }>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Input id="rule-name" label="Nombre" placeholder="Ej: 1 hora, Abono 1h30..." value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">Duración</label>
              <select value={form.duration_minutes} onChange={e => setForm(f => ({ ...f, duration_minutes: e.target.value }))} className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white">
                {DURATION_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Tipo de reserva</label>
            <div className="flex flex-wrap gap-2">
              {Object.entries(BOOKING_TYPES).map(([type, meta]) => (
                <button key={type} type="button" onClick={() => setForm(f => ({ ...f, booking_type: type }))} className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5 ${form.booking_type === type ? 'bg-cyan-600 text-white' : 'bg-slate-700/50 text-slate-400 hover:text-white'}`}>
                  {meta.icon} {meta.label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Input id="rule-price" type="number" label="Precio base (€)" placeholder="12.00" min="0" step="0.5" value={form.base_price} onChange={e => setForm(f => ({ ...f, base_price: e.target.value }))} />
            <Input id="rule-light" type="number" label="Recargo luz (€)" placeholder="4.00" min="0" step="0.5" value={form.lighting_surcharge} onChange={e => setForm(f => ({ ...f, lighting_surcharge: e.target.value }))} />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <Input id="rule-peak" type="number" label="Recargo pico (€)" placeholder="0" min="0" step="0.5" value={form.peak_surcharge} onChange={e => setForm(f => ({ ...f, peak_surcharge: e.target.value }))} />
            <Input id="rule-discount" type="number" label="Descuento (%)" placeholder="0" min="0" max="100" value={form.discount_pct} onChange={e => setForm(f => ({ ...f, discount_pct: e.target.value }))} />
            <Input id="rule-fixed" type="number" label="Precio fijo (€)" placeholder="Vacío = usa base" min="0" step="0.5" value={form.fixed_price} onChange={e => setForm(f => ({ ...f, fixed_price: e.target.value }))} />
          </div>

          {/* Avanzado */}
          <details className="group">
            <summary className="text-sm text-cyan-400 cursor-pointer flex items-center gap-1 hover:text-cyan-300">
              <ChevronRight size={14} className="transition-transform group-open:rotate-90" /> Opciones avanzadas
            </summary>
            <div className="mt-3 space-y-3 pl-4 border-l-2 border-slate-700/50">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">Franja horaria</label>
                  <select value={form.time_slot_id} onChange={e => setForm(f => ({ ...f, time_slot_id: e.target.value }))} className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white">
                    <option value="">Todas las franjas</option>
                    {timeSlots.map(s => <option key={s.id} value={s.id}>{s.name} ({s.start_time.slice(0, 5)}-{s.end_time.slice(0, 5)})</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">Grupo de pistas</label>
                  <select value={form.court_group} onChange={e => setForm(f => ({ ...f, court_group: e.target.value }))} className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white">
                    <option value="">Todas las pistas</option>
                    <option value="indoor">Indoor</option>
                    <option value="outdoor">Outdoor</option>
                    <option value="premium">Premium</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Input id="rule-minp" type="number" label="Mín. jugadores" placeholder="0" min="0" value={form.min_players} onChange={e => setForm(f => ({ ...f, min_players: e.target.value }))} />
                <Input id="rule-maxd" type="number" label="Máx. usos/día por usuario" placeholder="0 = ilimitado" min="0" value={form.max_daily_uses} onChange={e => setForm(f => ({ ...f, max_daily_uses: e.target.value }))} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">Válido desde</label>
                  <input type="date" value={form.valid_from} onChange={e => setForm(f => ({ ...f, valid_from: e.target.value }))} className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">Válido hasta</label>
                  <input type="date" value={form.valid_until} onChange={e => setForm(f => ({ ...f, valid_until: e.target.value }))} className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white" />
                </div>
              </div>
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2 text-sm text-slate-300 cursor-pointer">
                  <input type="checkbox" checked={form.is_active} onChange={e => setForm(f => ({ ...f, is_active: e.target.checked }))} className="rounded border-slate-600 bg-slate-800 text-cyan-500" />
                  Activa
                </label>
                <div className="flex items-center gap-1.5">
                  <label className="text-xs text-slate-400">Prioridad:</label>
                  <input type="number" min="0" max="99" value={form.priority} onChange={e => setForm(f => ({ ...f, priority: e.target.value }))} className="w-14 bg-slate-800 border border-slate-600 rounded px-2 py-1 text-sm text-white text-center" />
                </div>
              </div>
              <Input id="rule-notes" label="Notas" placeholder="Observaciones internas..." value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
            </div>
          </details>

          {/* Preview */}
          <div className="bg-cyan-500/5 border border-cyan-500/20 rounded-lg p-4 text-sm">
            <p className="font-semibold text-cyan-400 mb-2">Vista previa del precio final</p>
            {(() => {
              const base = parseFloat(form.base_price) || 0
              const light = parseFloat(form.lighting_surcharge) || 0
              const peak = parseFloat(form.peak_surcharge) || 0
              const disc = parseFloat(form.discount_pct) || 0
              const fixed = form.fixed_price ? parseFloat(form.fixed_price) : null
              const effectiveBase = fixed != null ? fixed : disc > 0 ? base * (1 - disc / 100) : base
              return (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="bg-slate-800/50 rounded-lg p-3 text-center">
                    <p className="text-[10px] text-slate-500 mb-1">Sin luz</p>
                    <p className="text-white font-bold text-lg">{formatPrice(effectiveBase)}</p>
                  </div>
                  <div className="bg-slate-800/50 rounded-lg p-3 text-center">
                    <p className="text-[10px] text-amber-400 mb-1">Con luz</p>
                    <p className="text-white font-bold text-lg">{formatPrice(effectiveBase + light)}</p>
                  </div>
                  <div className="bg-slate-800/50 rounded-lg p-3 text-center">
                    <p className="text-[10px] text-orange-400 mb-1">Pico sin luz</p>
                    <p className="text-white font-bold text-lg">{formatPrice(effectiveBase + peak)}</p>
                  </div>
                  <div className="bg-slate-800/50 rounded-lg p-3 text-center">
                    <p className="text-[10px] text-red-400 mb-1">Pico + luz</p>
                    <p className="text-white font-bold text-lg">{formatPrice(effectiveBase + light + peak)}</p>
                  </div>
                </div>
              )
            })()}
          </div>
        </div>
      </Modal>

      {/* ── Time Slot Modal ─────────────────────────────── */}
      <Modal open={slotOpen} onClose={() => setSlotOpen(false)} title={editSlot ? `Editar: ${editSlot.name}` : 'Nueva Franja Horaria'} size="md" footer={
        <div className="flex items-center justify-between w-full">
          <div>{editSlot && <Button variant="danger" size="sm" onClick={deleteSlot} disabled={saving}><Trash2 size={14} /> Eliminar</Button>}</div>
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" onClick={() => setSlotOpen(false)}>Cancelar</Button>
            <Button size="sm" onClick={saveSlot} loading={saving}>{editSlot ? 'Guardar' : 'Crear'}</Button>
          </div>
        </div>
      }>
        <div className="space-y-4">
          <Input id="slot-name" label="Nombre" placeholder="Ej: Mañana, Tarde, Noche..." value={slotForm.name} onChange={e => setSlotForm(f => ({ ...f, name: e.target.value }))} />
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">Hora inicio</label>
              <input type="time" value={slotForm.start_time} onChange={e => setSlotForm(f => ({ ...f, start_time: e.target.value }))} className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">Hora fin</label>
              <input type="time" value={slotForm.end_time} onChange={e => setSlotForm(f => ({ ...f, end_time: e.target.value }))} className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Multiplicador de precio</label>
            <input type="number" min="0.01" max="5" step="0.05" value={slotForm.price_multiplier} onChange={e => setSlotForm(f => ({ ...f, price_multiplier: e.target.value }))} className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white" />
            <p className="text-xs text-slate-500 mt-1">1.00 = sin cambio | 0.90 = -10% | 1.15 = +15%</p>
            {/* Quick buttons */}
            <div className="flex gap-1.5 mt-2">
              {[0.80, 0.90, 1.00, 1.10, 1.15, 1.20, 1.50].map(v => (
                <button key={v} type="button" onClick={() => setSlotForm(f => ({ ...f, price_multiplier: String(v) }))} className={`px-2 py-1 rounded text-xs font-medium transition-colors ${parseFloat(slotForm.price_multiplier) === v ? 'bg-cyan-600 text-white' : 'bg-slate-700/50 text-slate-400'}`}>
                  ×{v}
                </button>
              ))}
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm text-slate-300 cursor-pointer">
            <input type="checkbox" checked={slotForm.is_active} onChange={e => setSlotForm(f => ({ ...f, is_active: e.target.checked }))} className="rounded border-slate-600 bg-slate-800 text-cyan-500" />
            Activa
          </label>
        </div>
      </Modal>

      {/* ── Pack Modal ──────────────────────────────────── */}
      <Modal open={packOpen} onClose={() => setPackOpen(false)} title={editPack ? `Editar: ${editPack.name}` : 'Nuevo Bono / Pack'} size="lg" footer={
        <div className="flex items-center justify-between w-full">
          <div>{editPack && <Button variant="danger" size="sm" onClick={deletePack} disabled={saving}><Trash2 size={14} /> Eliminar</Button>}</div>
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" onClick={() => setPackOpen(false)}>Cancelar</Button>
            <Button size="sm" onClick={savePack} loading={saving}>{editPack ? 'Guardar' : 'Crear bono'}</Button>
          </div>
        </div>
      }>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Input id="pack-name" label="Nombre" placeholder="Ej: Bono 10 horas" value={packForm.name} onChange={e => setPackForm(f => ({ ...f, name: e.target.value }))} />
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">Tipo</label>
              <select value={packForm.pack_type} onChange={e => setPackForm(f => ({ ...f, pack_type: e.target.value }))} className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white">
                <option value="hours">Horas</option>
                <option value="sessions">Sesiones</option>
                <option value="credits">Créditos</option>
              </select>
            </div>
          </div>
          <Input id="pack-desc" label="Descripción" placeholder="Descripción para el usuario..." value={packForm.description} onChange={e => setPackForm(f => ({ ...f, description: e.target.value }))} />
          <div className="grid grid-cols-3 gap-3">
            <Input id="pack-units" type="number" label={packForm.pack_type === 'hours' ? 'Total horas' : packForm.pack_type === 'sessions' ? 'Total sesiones' : 'Total créditos'} min="1" value={packForm.total_units} onChange={e => setPackForm(f => ({ ...f, total_units: e.target.value }))} />
            <Input id="pack-price" type="number" label="Precio total (€)" placeholder="100.00" min="0" step="1" value={packForm.price} onChange={e => setPackForm(f => ({ ...f, price: e.target.value }))} />
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">Precio/unidad</label>
              <div className="bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm text-green-400 font-bold">
                {packForm.price && packForm.total_units ? formatPrice(parseFloat(packForm.price) / parseInt(packForm.total_units)) : '—'}
              </div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input id="pack-days" type="number" label="Días de validez" min="1" value={packForm.valid_days} onChange={e => setPackForm(f => ({ ...f, valid_days: e.target.value }))} />
            <Input id="pack-max" type="number" label="Máx. por usuario" min="1" value={packForm.max_per_user} onChange={e => setPackForm(f => ({ ...f, max_per_user: e.target.value }))} />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Duraciones aplicables</label>
            <div className="flex gap-1.5 flex-wrap">
              {DURATION_OPTIONS.map(d => {
                const val = parseInt(d.value)
                const selected = packForm.applicable_durations.includes(val)
                return (
                  <button key={d.value} type="button" onClick={() => setPackForm(f => ({ ...f, applicable_durations: selected ? f.applicable_durations.filter(x => x !== val) : [...f.applicable_durations, val] }))} className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${selected ? 'bg-cyan-600 text-white' : 'bg-slate-700/50 text-slate-400'}`}>
                    {d.label}
                  </button>
                )
              })}
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Tipos de reserva</label>
            <div className="flex gap-1.5 flex-wrap">
              {Object.entries(BOOKING_TYPES).map(([type, meta]) => {
                const selected = packForm.applicable_booking_types.includes(type)
                return (
                  <button key={type} type="button" onClick={() => setPackForm(f => ({ ...f, applicable_booking_types: selected ? f.applicable_booking_types.filter(x => x !== type) : [...f.applicable_booking_types, type] }))} className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors flex items-center gap-1 ${selected ? 'bg-cyan-600 text-white' : 'bg-slate-700/50 text-slate-400'}`}>
                    {meta.icon} {meta.label}
                  </button>
                )
              })}
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm text-slate-300 cursor-pointer">
            <input type="checkbox" checked={packForm.is_active} onChange={e => setPackForm(f => ({ ...f, is_active: e.target.checked }))} className="rounded border-slate-600 bg-slate-800 text-cyan-500" />
            Activo
          </label>
        </div>
      </Modal>

      {/* ── Season Modal ────────────────────────────────── */}
      <Modal open={seasonOpen} onClose={() => setSeasonOpen(false)} title={editSeason ? `Editar: ${editSeason.name}` : 'Nueva Temporada'} size="md" footer={
        <div className="flex items-center justify-between w-full">
          <div>{editSeason && <Button variant="danger" size="sm" onClick={deleteSeason} disabled={saving}><Trash2 size={14} /> Eliminar</Button>}</div>
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" onClick={() => setSeasonOpen(false)}>Cancelar</Button>
            <Button size="sm" onClick={saveSeason} loading={saving}>{editSeason ? 'Guardar' : 'Crear'}</Button>
          </div>
        </div>
      }>
        <div className="space-y-4">
          <Input id="season-name" label="Nombre" placeholder="Ej: Verano, Invierno, Navidad..." value={seasonForm.name} onChange={e => setSeasonForm(f => ({ ...f, name: e.target.value }))} />
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">Fecha inicio</label>
              <input type="date" value={seasonForm.start_date} onChange={e => setSeasonForm(f => ({ ...f, start_date: e.target.value }))} className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">Fecha fin</label>
              <input type="date" value={seasonForm.end_date} onChange={e => setSeasonForm(f => ({ ...f, end_date: e.target.value }))} className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Multiplicador de precio</label>
            <input type="number" min="0.01" max="5" step="0.05" value={seasonForm.price_multiplier} onChange={e => setSeasonForm(f => ({ ...f, price_multiplier: e.target.value }))} className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white" />
            <div className="flex gap-1.5 mt-2">
              {[0.85, 0.90, 0.95, 1.00, 1.05, 1.10, 1.20].map(v => (
                <button key={v} type="button" onClick={() => setSeasonForm(f => ({ ...f, price_multiplier: String(v) }))} className={`px-2 py-1 rounded text-xs font-medium transition-colors ${parseFloat(seasonForm.price_multiplier) === v ? 'bg-cyan-600 text-white' : 'bg-slate-700/50 text-slate-400'}`}>
                  ×{v}
                </button>
              ))}
            </div>
          </div>
          <Input id="season-light" type="number" label="Override recargo luz (€) — vacío = usa el global" placeholder="Vacío = usa global" min="0" step="0.5" value={seasonForm.lighting_override} onChange={e => setSeasonForm(f => ({ ...f, lighting_override: e.target.value }))} />
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">Color</label>
              <div className="flex items-center gap-2">
                <input type="color" value={seasonForm.color} onChange={e => setSeasonForm(f => ({ ...f, color: e.target.value }))} className="w-10 h-10 rounded-lg border border-slate-600 cursor-pointer bg-transparent" />
                <input type="text" value={seasonForm.color} onChange={e => setSeasonForm(f => ({ ...f, color: e.target.value }))} className="flex-1 bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white" />
              </div>
            </div>
            <div className="flex items-end pb-2">
              <label className="flex items-center gap-2 text-sm text-slate-300 cursor-pointer">
                <input type="checkbox" checked={seasonForm.is_active} onChange={e => setSeasonForm(f => ({ ...f, is_active: e.target.checked }))} className="rounded border-slate-600 bg-slate-800 text-cyan-500" />
                Activa
              </label>
            </div>
          </div>
          <Input id="season-notes" label="Notas" placeholder="Observaciones..." value={seasonForm.notes} onChange={e => setSeasonForm(f => ({ ...f, notes: e.target.value }))} />
        </div>
      </Modal>

      {/* ── Discount Modal ──────────────────────────────── */}
      <Modal open={discountOpen} onClose={() => setDiscountOpen(false)} title={editDiscount ? `Editar: ${editDiscount.name}` : 'Nuevo Descuento'} size="lg" footer={
        <div className="flex items-center justify-between w-full">
          <div>{editDiscount && <Button variant="danger" size="sm" onClick={deleteDiscount} disabled={saving}><Trash2 size={14} /> Eliminar</Button>}</div>
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" onClick={() => setDiscountOpen(false)}>Cancelar</Button>
            <Button size="sm" onClick={saveDiscount} loading={saving}>{editDiscount ? 'Guardar' : 'Crear descuento'}</Button>
          </div>
        </div>
      }>
        <div className="space-y-4">
          <Input id="disc-name" label="Nombre" placeholder="Ej: Socio Club, Estudiante, Senior..." value={discountForm.name} onChange={e => setDiscountForm(f => ({ ...f, name: e.target.value }))} />
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">Tipo de descuento</label>
              <select value={discountForm.discount_type} onChange={e => setDiscountForm(f => ({ ...f, discount_type: e.target.value }))} className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white">
                {Object.entries(DISCOUNT_TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            <Input id="disc-value" type="number" label={discountForm.discount_type === 'percentage' ? 'Porcentaje (%)' : 'Valor (€)'} placeholder={discountForm.discount_type === 'percentage' ? '15' : '3.00'} min="0" step={discountForm.discount_type === 'percentage' ? '1' : '0.5'} value={discountForm.discount_value} onChange={e => setDiscountForm(f => ({ ...f, discount_value: e.target.value }))} />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Tipos de reserva aplicables</label>
            <div className="flex gap-1.5 flex-wrap">
              {Object.entries(BOOKING_TYPES).map(([type, meta]) => {
                const selected = discountForm.applicable_booking_types.includes(type)
                return (
                  <button key={type} type="button" onClick={() => setDiscountForm(f => ({ ...f, applicable_booking_types: selected ? f.applicable_booking_types.filter(x => x !== type) : [...f.applicable_booking_types, type] }))} className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors flex items-center gap-1 ${selected ? 'bg-cyan-600 text-white' : 'bg-slate-700/50 text-slate-400'}`}>
                    {meta.icon} {meta.label}
                  </button>
                )
              })}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Duraciones aplicables (vacío = todas)</label>
            <div className="flex gap-1.5 flex-wrap">
              {DURATION_OPTIONS.map(d => {
                const val = parseInt(d.value)
                const selected = discountForm.applicable_durations.includes(val)
                return (
                  <button key={d.value} type="button" onClick={() => setDiscountForm(f => ({ ...f, applicable_durations: selected ? f.applicable_durations.filter(x => x !== val) : [...f.applicable_durations, val] }))} className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${selected ? 'bg-cyan-600 text-white' : 'bg-slate-700/50 text-slate-400'}`}>
                    {d.label}
                  </button>
                )
              })}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Input id="disc-min" type="number" label="Mín. reservas/mes para aplicar" placeholder="0 = sin mínimo" min="0" value={discountForm.min_bookings_per_month} onChange={e => setDiscountForm(f => ({ ...f, min_bookings_per_month: e.target.value }))} />
            <div className="space-y-2 pt-6">
              <label className="flex items-center gap-2 text-sm text-slate-300 cursor-pointer">
                <input type="checkbox" checked={discountForm.requires_membership} onChange={e => setDiscountForm(f => ({ ...f, requires_membership: e.target.checked }))} className="rounded border-slate-600 bg-slate-800 text-cyan-500" />
                Requiere membresía activa
              </label>
              <label className="flex items-center gap-2 text-sm text-slate-300 cursor-pointer">
                <input type="checkbox" checked={discountForm.is_stackable} onChange={e => setDiscountForm(f => ({ ...f, is_stackable: e.target.checked }))} className="rounded border-slate-600 bg-slate-800 text-cyan-500" />
                Acumulable con otros descuentos
              </label>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">Válido desde</label>
              <input type="date" value={discountForm.valid_from} onChange={e => setDiscountForm(f => ({ ...f, valid_from: e.target.value }))} className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">Válido hasta</label>
              <input type="date" value={discountForm.valid_until} onChange={e => setDiscountForm(f => ({ ...f, valid_until: e.target.value }))} className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white" />
            </div>
          </div>

          <label className="flex items-center gap-2 text-sm text-slate-300 cursor-pointer">
            <input type="checkbox" checked={discountForm.is_active} onChange={e => setDiscountForm(f => ({ ...f, is_active: e.target.checked }))} className="rounded border-slate-600 bg-slate-800 text-cyan-500" />
            Activo
          </label>
          <Input id="disc-notes" label="Notas" placeholder="Observaciones..." value={discountForm.notes} onChange={e => setDiscountForm(f => ({ ...f, notes: e.target.value }))} />
        </div>
      </Modal>
    </div>
  )
}

