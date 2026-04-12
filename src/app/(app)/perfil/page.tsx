'use client'

import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '@/lib/auth-context'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { useToast } from '@/components/ui/toast'
import type { PlayerProfile } from '@/types'
import {
  User,
  Mail,
  Phone,
  MapPin,
  Trophy,
  Target,
  Star,
  Clock,
  Handshake,
  ChevronRight,
  Eye,
  EyeOff,
  Save,
  TrendingUp,
} from 'lucide-react'

// ─── helpers ──────────────────────────────────────────────
const CLUB_ID = 1

function ScoreBar({ label, icon, value }: { label: string; icon: React.ReactNode; value: number }) {
  // value viene en escala 0-5 (con decimales)
  const pct = Math.min(100, Math.max(0, (value / 5) * 100))
  const color =
    pct >= 80 ? 'bg-green-500' : pct >= 55 ? 'bg-cyan-500' : pct >= 35 ? 'bg-amber-500' : 'bg-red-500'

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm text-slate-300">
          {icon}
          {label}
        </div>
        <span className="text-sm font-semibold text-white">{value.toFixed(1)} / 5</span>
      </div>
      <div className="h-2 w-full rounded-full bg-slate-700">
        <div
          className={`h-2 rounded-full transition-all duration-500 ${color}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}

function StatCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="rounded-xl border border-slate-700/50 bg-slate-800/60 p-4 text-center">
      <p className="text-2xl font-bold text-white">{value}</p>
      <p className="mt-0.5 text-xs font-medium text-slate-400">{label}</p>
      {sub && <p className="mt-1 text-xs text-slate-500">{sub}</p>}
    </div>
  )
}

// ─── page ──────────────────────────────────────────────────
export default function MiPerfilPage() {
  const { user, refresh } = useAuth()
  const { toast } = useToast()

  // padel profile
  const [profile, setProfile] = useState<PlayerProfile | null>(null)
  const [profileLoading, setProfileLoading] = useState(true)

  // editable personal fields
  const [personalForm, setPersonalForm] = useState({ full_name: '', phone: '', city: '' })
  const [savingPersonal, setSavingPersonal] = useState(false)

  // editable padel fields
  const [padelForm, setPadelForm] = useState({
    preferred_position: 'both' as 'drive' | 'reves' | 'both',
    dominant_hand: 'right' as 'right' | 'left',
    level: 5,
    racket_brand: '',
    racket_model: '',
    bio: '',
    is_public: true,
  })
  const [savingPadel, setSavingPadel] = useState(false)

  // ── load player profile ─────────────────────────────────
  const loadProfile = useCallback(async () => {
    if (!user) return
    const supabase = createClient()
    setProfileLoading(true)
    const { data } = await supabase
      .from('nm_player_profiles')
      .select('*')
      .eq('user_id', user.id)
      .eq('club_id', CLUB_ID)
      .single()
    setProfile(data ?? null)
    if (data) {
      setPadelForm({
        preferred_position: data.preferred_position ?? 'both',
        dominant_hand: data.dominant_hand ?? 'right',
        level: data.level ?? 5,
        racket_brand: data.racket_brand ?? '',
        racket_model: data.racket_model ?? '',
        bio: data.bio ?? '',
        is_public: data.is_public ?? true,
      })
    }
    setProfileLoading(false)
  }, [user])

  useEffect(() => {
    if (user) {
      setPersonalForm({
        full_name: user.full_name ?? '',
        phone: user.phone ?? '',
        city: user.city ?? '',
      })
      loadProfile()
    }
  }, [user, loadProfile])

  // ── save personal info ──────────────────────────────────
  const savePersonal = useCallback(async () => {
    if (!user) return
    setSavingPersonal(true)
    try {
      const supabase = createClient()
      const { error } = await supabase
        .from('nm_users')
        .update({
          full_name: personalForm.full_name,
          phone: personalForm.phone || null,
          city: personalForm.city || null,
        })
        .eq('id', user.id)
      if (error) throw error
      await refresh()
      toast('success', 'Datos personales actualizados')
    } catch {
      toast('error', 'No se pudieron guardar los cambios')
    } finally {
      setSavingPersonal(false)
    }
  }, [user, personalForm, refresh, toast])

  // ── save padel profile ──────────────────────────────────
  const savePadel = useCallback(async () => {
    if (!user) return
    setSavingPadel(true)
    try {
      const supabase = createClient()
      const payload = {
        user_id: user.id,
        club_id: CLUB_ID,
        preferred_position: padelForm.preferred_position,
        dominant_hand: padelForm.dominant_hand,
        level: padelForm.level,
        racket_brand: padelForm.racket_brand || null,
        racket_model: padelForm.racket_model || null,
        bio: padelForm.bio || null,
        is_public: padelForm.is_public,
      }
      if (profile) {
        const { error } = await supabase
          .from('nm_player_profiles')
          .update(payload)
          .eq('id', profile.id)
        if (error) throw error
      } else {
        const { error } = await supabase.from('nm_player_profiles').insert(payload)
        if (error) throw error
      }
      await loadProfile()
      toast('success', 'Perfil padelístico guardado')
    } catch {
      toast('error', 'No se pudieron guardar los cambios')
    } finally {
      setSavingPadel(false)
    }
  }, [user, padelForm, profile, loadProfile, toast])

  // ── ui ──────────────────────────────────────────────────
  if (!user) {
    return (
      <div className="flex h-48 items-center justify-center">
        <p className="text-slate-400">Cargando perfil…</p>
      </div>
    )
  }

  const displayName = user.full_name || user.email
  const initials = (user.full_name ?? user.email)
    .split(' ')
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase() ?? '')
    .join('')

  return (
    <div className="space-y-6 pb-10">
      {/* ── Header ── */}
      <div>
        <h1 className="text-2xl font-bold text-white">Mi Perfil</h1>
        <p className="mt-1 text-sm text-slate-400">Tu información personal, estadísticas y preferencias</p>
      </div>

      {/* ── Identity card ── */}
      <div className="rounded-xl border border-slate-700/50 bg-slate-800/50 p-5">
        <div className="flex items-center gap-4">
          {user.avatar_url ? (
            <img
              src={user.avatar_url}
              alt={displayName}
              className="h-16 w-16 rounded-full object-cover ring-2 ring-cyan-500/40"
            />
          ) : (
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-cyan-600/20 ring-2 ring-cyan-500/40 text-xl font-bold text-cyan-400">
              {initials}
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className="text-lg font-semibold text-white truncate">{displayName}</p>
            <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-400">
              <span className="flex items-center gap-1.5">
                <Mail size={13} />
                {user.email}
              </span>
              {user.phone && (
                <span className="flex items-center gap-1.5">
                  <Phone size={13} />
                  {user.phone}
                </span>
              )}
              {user.city && (
                <span className="flex items-center gap-1.5">
                  <MapPin size={13} />
                  {user.city}
                </span>
              )}
            </div>
          </div>
          {profile && (
            <div className="hidden sm:flex flex-col items-end gap-1">
              <span className="rounded-full bg-cyan-600/20 px-3 py-1 text-xs font-semibold text-cyan-400">
                Nivel {profile.level}
              </span>
              {profile.ranking_position && (
                <span className="text-xs text-slate-400">Ranking #{profile.ranking_position}</span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── Stats ── */}
      {!profileLoading && profile && (
        <div>
          <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-slate-400">
            <TrendingUp size={15} />
            Estadísticas
          </h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
            <StatCard label="Partidos jugados" value={profile.matches_played} />
            <StatCard label="Partidos ganados" value={profile.matches_won} />
            <StatCard
              label="% victorias"
              value={`${profile.win_rate.toFixed(0)}%`}
            />
            <StatCard label="Puntos ranking" value={profile.ranking_points} />
            <StatCard
              label="Posición"
              value={profile.ranking_position ? `#${profile.ranking_position}` : '—'}
            />
          </div>
        </div>
      )}

      {/* ── Reputation ── */}
      {!profileLoading && profile && (
        <div className="rounded-xl border border-slate-700/50 bg-slate-800/50 p-5">
          <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-slate-400">
            <Star size={15} />
            Reputación
          </h2>
          <div className="space-y-4">
            <ScoreBar
              label="Reputación general"
              icon={<Star size={14} />}
              value={profile.reputation_score}
            />
            <ScoreBar
              label="Puntualidad"
              icon={<Clock size={14} />}
              value={profile.punctuality_score}
            />
            <ScoreBar
              label="Deportividad"
              icon={<Handshake size={14} />}
              value={profile.sportsmanship_score}
            />
          </div>
        </div>
      )}

      {/* ── Personal info (editable) ── */}
      <div className="rounded-xl border border-slate-700/50 bg-slate-800/50 p-5">
        <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-slate-400">
          <User size={15} />
          Datos personales
        </h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Input
              id="full_name"
              label="Nombre completo"
              value={personalForm.full_name}
              onChange={(e) => setPersonalForm((p) => ({ ...p, full_name: e.target.value }))}
              placeholder="Tu nombre"
            />
          </div>
          <Input
            id="phone"
            label="Teléfono"
            value={personalForm.phone}
            onChange={(e) => setPersonalForm((p) => ({ ...p, phone: e.target.value }))}
            placeholder="+34 600 000 000"
          />
          <Input
            id="city"
            label="Ciudad"
            value={personalForm.city}
            onChange={(e) => setPersonalForm((p) => ({ ...p, city: e.target.value }))}
            placeholder="Tu ciudad"
          />
        </div>
        <div className="mt-4 flex justify-end">
          <Button onClick={savePersonal} loading={savingPersonal} size="sm">
            <Save size={14} />
            Guardar datos
          </Button>
        </div>
      </div>

      {/* ── Padel profile (editable) ── */}
      <div className="rounded-xl border border-slate-700/50 bg-slate-800/50 p-5">
        <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-slate-400">
          <Target size={15} />
          Perfil padelístico
        </h2>

        {profileLoading ? (
          <p className="text-sm text-slate-400">Cargando…</p>
        ) : (
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Select
                id="preferred_position"
                label="Posición preferida"
                value={padelForm.preferred_position}
                onChange={(e) =>
                  setPadelForm((p) => ({
                    ...p,
                    preferred_position: e.target.value as 'drive' | 'reves' | 'both',
                  }))
                }
                options={[
                  { value: 'drive', label: 'Drive' },
                  { value: 'reves', label: 'Revés' },
                  { value: 'both', label: 'Ambas' },
                ]}
              />
              <Select
                id="dominant_hand"
                label="Mano dominante"
                value={padelForm.dominant_hand}
                onChange={(e) =>
                  setPadelForm((p) => ({
                    ...p,
                    dominant_hand: e.target.value as 'right' | 'left',
                  }))
                }
                options={[
                  { value: 'right', label: 'Derecha' },
                  { value: 'left', label: 'Izquierda' },
                ]}
              />
            </div>

            {/* Level slider */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="block text-sm font-medium text-slate-300">
                  Nivel de juego
                </label>
                <span className="rounded-full bg-cyan-600/20 px-2.5 py-0.5 text-sm font-bold text-cyan-400">
                  {padelForm.level} / 10
                </span>
              </div>
              <input
                type="range"
                min={1}
                max={10}
                step={1}
                value={padelForm.level}
                onChange={(e) => setPadelForm((p) => ({ ...p, level: Number(e.target.value) }))}
                className="w-full accent-cyan-500"
              />
              <div className="flex justify-between text-xs text-slate-500">
                <span>Iniciación (1)</span>
                <span>Intermedio (5)</span>
                <span>Élite (10)</span>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <Input
                id="racket_brand"
                label="Marca de pala"
                value={padelForm.racket_brand}
                onChange={(e) => setPadelForm((p) => ({ ...p, racket_brand: e.target.value }))}
                placeholder="Ej. Bullpadel, Adidas…"
              />
              <Input
                id="racket_model"
                label="Modelo de pala"
                value={padelForm.racket_model}
                onChange={(e) => setPadelForm((p) => ({ ...p, racket_model: e.target.value }))}
                placeholder="Ej. Hack 03"
              />
            </div>

            {/* Bio */}
            <div className="space-y-1">
              <label className="block text-sm font-medium text-slate-300">Bio</label>
              <textarea
                rows={3}
                value={padelForm.bio}
                onChange={(e) => setPadelForm((p) => ({ ...p, bio: e.target.value }))}
                placeholder="Contale algo a tus futuros compañeros de partido…"
                className="w-full rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-white placeholder-slate-500 transition-colors focus:border-cyan-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/40 resize-none"
              />
            </div>

            {/* Visibility toggle */}
            <div
              className="flex cursor-pointer items-center justify-between rounded-lg border border-slate-700 bg-slate-800/60 px-4 py-3"
              onClick={() => setPadelForm((p) => ({ ...p, is_public: !p.is_public }))}
            >
              <div className="flex items-center gap-3">
                {padelForm.is_public ? (
                  <Eye size={16} className="text-cyan-400" />
                ) : (
                  <EyeOff size={16} className="text-slate-400" />
                )}
                <div>
                  <p className="text-sm font-medium text-white">
                    Perfil {padelForm.is_public ? 'público' : 'privado'}
                  </p>
                  <p className="text-xs text-slate-400">
                    {padelForm.is_public
                      ? 'Otros jugadores pueden ver tu perfil'
                      : 'Tu perfil no aparece en búsquedas'}
                  </p>
                </div>
              </div>
              <div
                className={`relative h-6 w-11 rounded-full transition-colors ${
                  padelForm.is_public ? 'bg-cyan-600' : 'bg-slate-600'
                }`}
              >
                <span
                  className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
                    padelForm.is_public ? 'translate-x-5' : 'translate-x-0.5'
                  }`}
                />
              </div>
            </div>

            <div className="flex justify-end">
              <Button onClick={savePadel} loading={savingPadel} size="sm">
                <Save size={14} />
                Guardar perfil
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
