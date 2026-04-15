'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import {
  ArrowLeft, Trophy, Users, CalendarDays, Save, Loader2,
  Pencil, Layers, ListOrdered, Medal, Download, Upload,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useRealtimeRefresh } from '@/hooks/use-realtime-refresh'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Modal } from '@/components/ui/modal'
import { useToast } from '@/components/ui/toast'
import { formatDate } from '@/lib/utils'

interface League {
  id: number
  name: string
  season: string | null
  format: string
  start_date: string | null
  end_date: string | null
  status: string
  description: string | null
  sets_to_win: number
  games_per_set: number
  golden_point: boolean
}
interface Category {
  id: number
  name: string
  gender: string
  level: string | null
  status: string
  sort_order: number
}
interface Team {
  id: number
  category_id: number
  team_name: string | null
  player1_name: string
  player2_name: string
  player3_name: string | null
  player1_id: string | null
  player2_id: string | null
  player3_id: string | null
}
interface UserOption {
  id: string
  full_name: string | null
  email: string
  avatar_url: string | null
  profile_completed_at: string | null
}
interface Round {
  id: number
  category_id: number
  round_number: number
  scheduled_date: string | null
  status: string
}
interface Match {
  id: number
  round_id: number
  category_id: number
  team1_id: number | null
  team2_id: number | null
  team1_set1: number | null; team2_set1: number | null
  team1_set2: number | null; team2_set2: number | null
  team1_set3: number | null; team2_set3: number | null
  sets_team1: number; sets_team2: number
  winner_team_id: number | null
  status: string
  played_date: string | null
}

export default function LigaDetallePage() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const { toast } = useToast()
  const leagueId = Number(params.id)

  const [league, setLeague] = useState<League | null>(null)
  const [categories, setCategories] = useState<Category[]>([])
  const [teams, setTeams] = useState<Team[]>([])
  const [rounds, setRounds] = useState<Round[]>([])
  const [matches, setMatches] = useState<Match[]>([])
  const [loading, setLoading] = useState(true)
  const [activeCategoryId, setActiveCategoryId] = useState<number | null>(null)

  // Match edit modal state
  const [editingMatch, setEditingMatch] = useState<Match | null>(null)
  const [matchForm, setMatchForm] = useState({
    t1s1: '', t2s1: '', t1s2: '', t2s2: '', t1s3: '', t2s3: '',
    playedDate: '',
  })
  const [savingMatch, setSavingMatch] = useState(false)

  // Round date modal
  const [editingRound, setEditingRound] = useState<Round | null>(null)
  const [roundDate, setRoundDate] = useState('')
  const [savingRound, setSavingRound] = useState(false)

  // Link player modal
  const [linking, setLinking] = useState<{ team: Team; slot: 1 | 2 | 3 } | null>(null)
  const [linkSearch, setLinkSearch] = useState('')
  const [users, setUsers] = useState<UserOption[]>([])
  const [savingLink, setSavingLink] = useState(false)
  const [autoLinking, setAutoLinking] = useState(false)
  const [autoLinkReport, setAutoLinkReport] = useState<{ linked: number; ambiguous: number; noMatch: number; scope: string } | null>(null)

  // Crear usuario nuevo desde el modal de vincular
  const [creatingNew, setCreatingNew] = useState(false)
  const [newUserForm, setNewUserForm] = useState({ full_name: '', email: '', phone: '', password: '' })
  const [savingNewUser, setSavingNewUser] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const supabase = createClient()
    const [lRes, cRes, tRes, rRes, mRes] = await Promise.all([
      supabase.from('nm_leagues').select('*').eq('id', leagueId).single(),
      supabase.from('nm_league_categories').select('*').eq('league_id', leagueId).order('sort_order'),
      supabase.from('nm_league_teams').select('*, category_id').order('id'),
      supabase.from('nm_league_rounds').select('*').order('round_number'),
      supabase.from('nm_league_matches').select('*').order('id'),
    ])
    if (lRes.error || !lRes.data) {
      toast('error', 'Liga no encontrada')
      router.push('/admin/ligas')
      return
    }
    setLeague(lRes.data as League)
    const cats = (cRes.data ?? []) as Category[]
    setCategories(cats)
    if (cats.length > 0 && activeCategoryId === null) setActiveCategoryId(cats[0].id)

    const catIds = new Set(cats.map(c => c.id))
    setTeams((tRes.data ?? []).filter((t: Team) => catIds.has(t.category_id)) as Team[])
    setRounds((rRes.data ?? []).filter((r: Round) => catIds.has(r.category_id)) as Round[])
    setMatches((mRes.data ?? []).filter((m: Match) => catIds.has(m.category_id)) as Match[])
    setLoading(false)
  }, [leagueId, toast, router, activeCategoryId])

  useEffect(() => { load() }, [load])

  // Cargar lista de usuarios para el selector de vincular
  useEffect(() => {
    const supabase = createClient()
    supabase.from('nm_users')
      .select('id, full_name, email, avatar_url, profile_completed_at')
      .eq('is_active', true)
      .order('full_name', { ascending: true })
      .then(({ data }) => setUsers((data ?? []) as UserOption[]))
  }, [])

  async function linkPlayer(userId: string | null) {
    if (!linking) return
    setSavingLink(true)
    const supabase = createClient()
    const update: Record<string, unknown> = {}
    update[`player${linking.slot}_id`] = userId
    // Si estamos vinculando y tenemos full_name, lo usamos como nombre
    if (userId) {
      const u = users.find(x => x.id === userId)
      if (u?.full_name) update[`player${linking.slot}_name`] = u.full_name
    }
    const { error } = await supabase.from('nm_league_teams').update(update).eq('id', linking.team.id)
    if (error) { toast('error', error.message); setSavingLink(false); return }
    toast('success', userId ? 'Jugador vinculado' : 'Vínculo quitado')
    setLinking(null)
    setLinkSearch('')
    setSavingLink(false)
    load()
  }

  async function createAndLink() {
    if (!linking) return
    const full_name = newUserForm.full_name.trim()
    const email = newUserForm.email.trim().toLowerCase()
    const password = newUserForm.password.trim() || Math.random().toString(36).slice(2, 10) + 'A1'
    if (!full_name || !email) { toast('error', 'Nombre y email son obligatorios'); return }
    setSavingNewUser(true)
    const res = await fetch('/api/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email, password, full_name,
        phone: newUserForm.phone.trim() || null,
        role: 'player',
      }),
    })
    const j = await res.json()
    if (!res.ok) {
      toast('error', j.error ?? 'Error creando usuario')
      setSavingNewUser(false)
      return
    }
    const newId = j.user_id as string
    // Vincular al slot actual
    const supabase = createClient()
    const update: Record<string, unknown> = {}
    update[`player${linking.slot}_id`] = newId
    update[`player${linking.slot}_name`] = full_name
    const { error } = await supabase.from('nm_league_teams').update(update).eq('id', linking.team.id)
    if (error) { toast('error', error.message); setSavingNewUser(false); return }

    // Refrescar lista local de users
    setUsers(prev => [...prev, { id: newId, full_name, email, avatar_url: null, profile_completed_at: null }])
    toast('success', `Usuario ${full_name} creado y vinculado`)
    setCreatingNew(false)
    setNewUserForm({ full_name: '', email: '', phone: '', password: '' })
    setLinking(null)
    setLinkSearch('')
    setSavingNewUser(false)
    load()
  }

  async function autoLink(scope: 'category' | 'league') {
    setAutoLinking(true)
    const supabase = createClient()
    const teamsToProcess = scope === 'category' ? (cat ? teams.filter(t => t.category_id === cat.id) : []) : teams

    const norm = (s: string) =>
      s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim()

    // Usuarios ya vinculados en ESTA liga — evitar duplicar
    const usedIds = new Set<string>()
    for (const t of teams) {
      if (t.player1_id) usedIds.add(t.player1_id)
      if (t.player2_id) usedIds.add(t.player2_id)
      if (t.player3_id) usedIds.add(t.player3_id)
    }

    const available = users.filter(u => !usedIds.has(u.id) && u.full_name)
    const byFirst = new Map<string, UserOption[]>()
    const byFull = new Map<string, UserOption[]>()
    for (const u of available) {
      const nfull = norm(u.full_name!)
      if (!nfull) continue
      const first = nfull.split(' ')[0]
      if (!byFirst.has(first)) byFirst.set(first, [])
      byFirst.get(first)!.push(u)
      if (!byFull.has(nfull)) byFull.set(nfull, [])
      byFull.get(nfull)!.push(u)
    }

    let linked = 0, ambiguous = 0, noMatch = 0

    for (const t of teamsToProcess) {
      for (const slot of [1, 2, 3] as const) {
        const currentId = slot === 1 ? t.player1_id : slot === 2 ? t.player2_id : t.player3_id
        const name = slot === 1 ? t.player1_name : slot === 2 ? t.player2_name : t.player3_name
        if (currentId || !name) continue

        const nName = norm(name)
        if (!nName) { noMatch++; continue }

        // 1) match full exacto
        let candidates: UserOption[] = byFull.get(nName) ?? []
        // 2) si el nombre tiene un solo token, match por primer nombre del user
        if (candidates.length === 0 && !nName.includes(' ')) {
          candidates = byFirst.get(nName) ?? []
        }
        // 3) si el nombre tiene varios tokens, busco users que contengan TODOS los tokens
        if (candidates.length === 0 && nName.includes(' ')) {
          const tokens = nName.split(' ')
          candidates = available.filter(u => {
            const uTokens = norm(u.full_name!).split(' ')
            return tokens.every(tok => uTokens.includes(tok))
          })
        }
        // Filtrar los que ya usamos en esta tanda
        candidates = candidates.filter(u => !usedIds.has(u.id))

        if (candidates.length === 1) {
          const u = candidates[0]
          const update: Record<string, unknown> = {}
          update[`player${slot}_id`] = u.id
          if (u.full_name) update[`player${slot}_name`] = u.full_name
          const { error } = await supabase.from('nm_league_teams').update(update).eq('id', t.id)
          if (!error) {
            usedIds.add(u.id)
            linked++
          } else {
            noMatch++
          }
        } else if (candidates.length > 1) {
          ambiguous++
        } else {
          noMatch++
        }
      }
    }

    setAutoLinkReport({ linked, ambiguous, noMatch, scope: scope === 'category' ? (cat?.name ?? '') : 'toda la liga' })
    setAutoLinking(false)
    load()
  }

  // Auto-refresh en vivo sobre todas las tablas de la liga
  useRealtimeRefresh(
    ['nm_leagues', 'nm_league_categories', 'nm_league_teams', 'nm_league_rounds', 'nm_league_matches'],
    load,
  )

  if (loading) return <div className="p-8 text-slate-400">Cargando liga…</div>
  if (!league) return null

  const cat = categories.find(c => c.id === activeCategoryId) ?? null
  const catTeams = cat ? teams.filter(t => t.category_id === cat.id) : []
  const catRounds = cat ? rounds.filter(r => r.category_id === cat.id).sort((a, b) => a.round_number - b.round_number) : []
  const teamById = new Map(catTeams.map(t => [t.id, t]))

  function openEditMatch(m: Match) {
    setEditingMatch(m)
    setMatchForm({
      t1s1: m.team1_set1?.toString() ?? '', t2s1: m.team2_set1?.toString() ?? '',
      t1s2: m.team1_set2?.toString() ?? '', t2s2: m.team2_set2?.toString() ?? '',
      t1s3: m.team1_set3?.toString() ?? '', t2s3: m.team2_set3?.toString() ?? '',
      playedDate: m.played_date ?? new Date().toISOString().slice(0, 10),
    })
  }

  async function saveMatch() {
    if (!editingMatch) return
    setSavingMatch(true)
    const supabase = createClient()
    const n = (v: string) => v === '' ? null : Number(v)
    const t1s1 = n(matchForm.t1s1), t2s1 = n(matchForm.t2s1)
    const t1s2 = n(matchForm.t1s2), t2s2 = n(matchForm.t2s2)
    const t1s3 = n(matchForm.t1s3), t2s3 = n(matchForm.t2s3)
    let sets1 = 0, sets2 = 0, games1 = 0, games2 = 0
    const pairs: [number|null, number|null][] = [[t1s1, t2s1], [t1s2, t2s2], [t1s3, t2s3]]
    for (const [a, b] of pairs) {
      if (a == null || b == null) continue
      games1 += a; games2 += b
      if (a > b) sets1++; else if (b > a) sets2++
    }
    const winner = sets1 > sets2 ? editingMatch.team1_id : sets2 > sets1 ? editingMatch.team2_id : null
    const status = sets1 > 0 || sets2 > 0 ? 'completed' : 'scheduled'
    const { error } = await supabase.from('nm_league_matches').update({
      team1_set1: t1s1, team2_set1: t2s1,
      team1_set2: t1s2, team2_set2: t2s2,
      team1_set3: t1s3, team2_set3: t2s3,
      sets_team1: sets1, sets_team2: sets2,
      games_team1: games1, games_team2: games2,
      winner_team_id: winner,
      status,
      played_date: matchForm.playedDate || null,
    }).eq('id', editingMatch.id)
    if (error) { toast('error', error.message); setSavingMatch(false); return }
    toast('success', 'Resultado guardado')
    setEditingMatch(null); setSavingMatch(false)
    load()
  }

  function openEditRound(r: Round) {
    setEditingRound(r)
    setRoundDate(r.scheduled_date ?? '')
  }

  async function saveRoundDate() {
    if (!editingRound) return
    setSavingRound(true)
    const supabase = createClient()
    const { error } = await supabase.from('nm_league_rounds').update({
      scheduled_date: roundDate || null,
    }).eq('id', editingRound.id)
    if (error) { toast('error', error.message); setSavingRound(false); return }
    toast('success', 'Fecha actualizada')
    setEditingRound(null); setSavingRound(false)
    load()
  }

  // ── Standings ─────────────────────────────────────────────────────────────
  const standings = cat ? computeStandings(catTeams, matches.filter(m => m.category_id === cat.id)) : []

  const genderLabel: Record<string, string> = { male: 'Masculino', female: 'Femenino', mixed: 'Mixto' }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/admin/ligas" className="text-slate-400 hover:text-white">
          <ArrowLeft size={20} />
        </Link>
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-bold text-white flex items-center gap-2 flex-wrap">
            <Trophy className="text-cyan-400" /> {league.name}
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            {league.season && `Temporada ${league.season} · `}
            {league.start_date && formatDate(league.start_date)}
            {league.end_date && ` → ${formatDate(league.end_date)}`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <a
            href={`/api/ligas/${league.id}/export`}
            className="flex items-center gap-1 px-3 py-2 text-xs rounded-lg bg-slate-700 hover:bg-slate-600 text-white transition-colors"
          >
            <Download size={14} /> Exportar Excel
          </a>
          <Link
            href={`/admin/ligas/importar?league_id=${league.id}`}
            className="flex items-center gap-1 px-3 py-2 text-xs rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white transition-colors"
          >
            <Upload size={14} /> Actualizar desde Excel
          </Link>
          <Badge variant="cyan">{league.status}</Badge>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card><Kpi label="Categorías" value={categories.length} icon={<Layers size={18} />} /></Card>
        <Card><Kpi label="Equipos" value={teams.length} icon={<Users size={18} />} /></Card>
        <Card><Kpi label="Jornadas" value={rounds.length} icon={<ListOrdered size={18} />} /></Card>
        <Card><Kpi label="Partidos" value={matches.length} icon={<CalendarDays size={18} />} /></Card>
      </div>

      {/* Tabs de categorías */}
      {categories.length === 0 ? (
        <Card>
          <p className="text-slate-400 text-sm">Esta liga no tiene categorías. Importá un Excel o creá una categoría desde el backend.</p>
        </Card>
      ) : (
        <>
          <div className="flex gap-1 overflow-x-auto border-b border-slate-700/50">
            {categories.map(c => (
              <button
                key={c.id}
                onClick={() => setActiveCategoryId(c.id)}
                className={[
                  'px-3 py-2 text-sm whitespace-nowrap transition-colors',
                  activeCategoryId === c.id
                    ? 'text-cyan-400 border-b-2 border-cyan-400'
                    : 'text-slate-400 hover:text-slate-200',
                ].join(' ')}
              >
                {c.name}
                <span className="ml-1.5 text-xs text-slate-500">
                  ({teams.filter(t => t.category_id === c.id).length})
                </span>
              </button>
            ))}
          </div>

          {cat && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Standings */}
              <Card>
                <h2 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
                  <Medal size={16} className="text-cyan-400" /> Clasificación — {cat.name}
                </h2>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-slate-500 border-b border-slate-700/50">
                        <th className="text-left py-1.5 pl-2">#</th>
                        <th className="text-left py-1.5">Equipo</th>
                        <th className="text-center py-1.5">PJ</th>
                        <th className="text-center py-1.5">PG</th>
                        <th className="text-center py-1.5">PP</th>
                        <th className="text-center py-1.5">Sets</th>
                        <th className="text-center py-1.5 pr-2">Pts</th>
                      </tr>
                    </thead>
                    <tbody>
                      {standings.length === 0 && (
                        <tr><td colSpan={7} className="text-center text-slate-500 py-4">Sin partidos jugados</td></tr>
                      )}
                      {standings.map((s, i) => (
                        <tr key={s.team.id} className="border-b border-slate-800">
                          <td className="py-1.5 pl-2 text-slate-400">{i + 1}</td>
                          <td className="py-1.5 text-white">{s.team.team_name ?? '(sin nombre)'}</td>
                          <td className="py-1.5 text-center text-slate-300">{s.played}</td>
                          <td className="py-1.5 text-center text-green-400">{s.wins}</td>
                          <td className="py-1.5 text-center text-red-400">{s.losses}</td>
                          <td className="py-1.5 text-center text-slate-400">{s.setsFor}-{s.setsAgainst}</td>
                          <td className="py-1.5 pr-2 text-center font-bold text-cyan-400">{s.points}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>

              {/* Equipos */}
              <Card>
                <h2 className="text-sm font-semibold text-white mb-3 flex items-center gap-2 flex-wrap">
                  <Users size={16} className="text-cyan-400" /> Equipos
                  <Badge variant="cyan">{catTeams.length}</Badge>
                  {(() => {
                    const linked = catTeams.reduce((acc, t) => acc + [t.player1_id, t.player2_id, t.player3_id].filter(Boolean).length, 0)
                    const total = catTeams.reduce((acc, t) => acc + [t.player1_name, t.player2_name, t.player3_name].filter(Boolean).length, 0)
                    return <Badge variant={linked === total ? 'success' : 'warning'}>{linked}/{total} vinculados</Badge>
                  })()}
                  <span className="text-xs text-slate-500 ml-auto">{genderLabel[cat.gender] ?? cat.gender}</span>
                </h2>
                <div className="flex items-center gap-2 mb-3 flex-wrap">
                  <Button
                    variant="ghost"
                    onClick={() => autoLink('category')}
                    disabled={autoLinking}
                    className="text-xs flex items-center gap-1"
                  >
                    {autoLinking ? <Loader2 size={12} className="animate-spin" /> : <Users size={12} />}
                    Auto-vincular categoría
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={() => { if (confirm('Esto intenta vincular jugadores en TODAS las categorías de la liga. ¿Seguir?')) autoLink('league') }}
                    disabled={autoLinking}
                    className="text-xs flex items-center gap-1"
                  >
                    {autoLinking ? <Loader2 size={12} className="animate-spin" /> : <Users size={12} />}
                    Auto-vincular toda la liga
                  </Button>
                </div>
                <div className="space-y-2 max-h-[28rem] overflow-y-auto pr-1">
                  {catTeams.map(t => (
                    <div key={t.id} className="rounded-lg bg-slate-800/50 p-2 text-xs">
                      <div className="font-medium text-white mb-1">{t.team_name ?? '(sin nombre)'}</div>
                      <div className="space-y-1">
                        {([1, 2, 3] as const).map(slot => {
                          const name = slot === 1 ? t.player1_name : slot === 2 ? t.player2_name : t.player3_name
                          const linkedId = slot === 1 ? t.player1_id : slot === 2 ? t.player2_id : t.player3_id
                          if (!name) return null
                          const u = linkedId ? users.find(x => x.id === linkedId) : null
                          return (
                            <button
                              key={slot}
                              onClick={() => { setLinking({ team: t, slot }); setLinkSearch(name ?? '') }}
                              className={`w-full flex items-center gap-2 p-1.5 rounded text-left hover:bg-slate-700/50 transition-colors ${
                                linkedId ? 'border border-green-500/30 bg-green-500/5' : 'border border-amber-500/20'
                              }`}
                            >
                              <div className="w-7 h-7 rounded-full bg-slate-700 flex items-center justify-center shrink-0 overflow-hidden">
                                {u?.avatar_url ? (
                                  // eslint-disable-next-line @next/next/no-img-element
                                  <img src={u.avatar_url} alt="" className="w-full h-full object-cover" />
                                ) : (
                                  <span className="text-[10px] text-slate-400">{name.charAt(0)}</span>
                                )}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="text-slate-200 truncate">{u?.full_name ?? name}</div>
                                {u ? (
                                  <div className="text-[10px] text-green-400 flex items-center gap-1">
                                    ✓ Vinculado {u.profile_completed_at ? '· ficha ok' : '· ficha pendiente'}
                                  </div>
                                ) : (
                                  <div className="text-[10px] text-amber-400">Sin vincular · tocá para buscar</div>
                                )}
                              </div>
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            </div>
          )}

          {/* Jornadas */}
          {cat && catRounds.map(r => {
            const matchesOfRound = matches.filter(m => m.round_id === r.id)
            return (
              <Card key={r.id}>
                <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                  <div className="flex items-center gap-3">
                    <h3 className="text-sm font-semibold text-white">Jornada {r.round_number}</h3>
                    {r.scheduled_date ? (
                      <Badge variant="info">{formatDate(r.scheduled_date)}</Badge>
                    ) : (
                      <Badge variant="warning">Sin fecha</Badge>
                    )}
                  </div>
                  <Button variant="ghost" onClick={() => openEditRound(r)} className="flex items-center gap-1 text-xs">
                    <Pencil size={12} /> Fecha
                  </Button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {matchesOfRound.map(m => {
                    const t1 = teamById.get(m.team1_id ?? -1)
                    const t2 = teamById.get(m.team2_id ?? -1)
                    const played = m.status === 'completed'
                    return (
                      <button
                        key={m.id}
                        onClick={() => openEditMatch(m)}
                        className="text-left rounded-lg border border-slate-700/50 bg-slate-800/30 hover:bg-slate-800/70 hover:border-cyan-500/30 p-3 transition-colors"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <div className="text-xs text-slate-300 truncate">{t1?.team_name ?? '?'}</div>
                            <div className="text-xs text-slate-500 my-0.5">vs</div>
                            <div className="text-xs text-slate-300 truncate">{t2?.team_name ?? '?'}</div>
                          </div>
                          {played ? (
                            <div className="text-right text-xs font-mono">
                              <div className={m.winner_team_id === m.team1_id ? 'text-green-400 font-bold' : 'text-slate-400'}>
                                {m.team1_set1 ?? '-'} / {m.team1_set2 ?? '-'}{m.team1_set3 != null ? ` / ${m.team1_set3}` : ''}
                              </div>
                              <div className={m.winner_team_id === m.team2_id ? 'text-green-400 font-bold' : 'text-slate-400'}>
                                {m.team2_set1 ?? '-'} / {m.team2_set2 ?? '-'}{m.team2_set3 != null ? ` / ${m.team2_set3}` : ''}
                              </div>
                            </div>
                          ) : (
                            <Badge variant="default">Pendiente</Badge>
                          )}
                        </div>
                      </button>
                    )
                  })}
                </div>
              </Card>
            )
          })}
        </>
      )}

      {/* Modal resultado auto-vincular */}
      {autoLinkReport && (
        <Modal open={!!autoLinkReport} onClose={() => setAutoLinkReport(null)} title="Auto-vinculación completada">
          <div className="space-y-3">
            <p className="text-sm text-slate-400">Alcance: <strong className="text-white">{autoLinkReport.scope}</strong></p>
            <div className="grid grid-cols-3 gap-2">
              <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-3 text-center">
                <div className="text-2xl font-bold text-green-400">{autoLinkReport.linked}</div>
                <div className="text-xs text-slate-400">vinculados</div>
              </div>
              <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-3 text-center">
                <div className="text-2xl font-bold text-amber-400">{autoLinkReport.ambiguous}</div>
                <div className="text-xs text-slate-400">con varios matches</div>
              </div>
              <div className="bg-slate-500/10 border border-slate-500/30 rounded-lg p-3 text-center">
                <div className="text-2xl font-bold text-slate-400">{autoLinkReport.noMatch}</div>
                <div className="text-xs text-slate-400">sin match</div>
              </div>
            </div>
            <p className="text-xs text-slate-500">
              Los <strong>ambiguos</strong> (varios Antonio, por ejemplo) y <strong>sin match</strong> (jugadores que todavía no existen como usuario) los vinculás a mano tocando el slot del jugador.
            </p>
            <div className="flex justify-end">
              <Button onClick={() => setAutoLinkReport(null)}>Entendido</Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Modal vincular jugador */}
      {linking && (
        <Modal open={!!linking} onClose={() => { setLinking(null); setLinkSearch(''); setCreatingNew(false) }} title={`Vincular jugador — ${linking.team.team_name ?? '(sin nombre)'}`}>
          <div className="space-y-3">
            <p className="text-xs text-slate-400">
              Nombre en Excel: <strong className="text-white">
                {linking.slot === 1 ? linking.team.player1_name : linking.slot === 2 ? linking.team.player2_name : linking.team.player3_name}
              </strong>
            </p>

            {!creatingNew ? (
              <>
                <Input
                  placeholder="Buscar por nombre o email..."
                  value={linkSearch}
                  onChange={e => setLinkSearch(e.target.value)}
                  autoFocus
                />
                <div className="max-h-72 overflow-y-auto space-y-1 border border-slate-700/50 rounded-lg p-1">
                  {(() => {
                    const q = linkSearch.trim().toLowerCase()
                    const filtered = q
                      ? users.filter(u =>
                          (u.full_name?.toLowerCase().includes(q) ?? false) ||
                          u.email.toLowerCase().includes(q)
                        )
                      : users.slice(0, 50)
                    if (filtered.length === 0) return <p className="text-xs text-slate-500 p-3 text-center">Sin resultados</p>
                    return filtered.map(u => (
                      <button
                        key={u.id}
                        onClick={() => linkPlayer(u.id)}
                        disabled={savingLink}
                        className="w-full flex items-center gap-2 p-2 rounded hover:bg-slate-700/50 text-left transition-colors disabled:opacity-50"
                      >
                        <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center overflow-hidden shrink-0">
                          {u.avatar_url ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={u.avatar_url} alt="" className="w-full h-full object-cover" />
                          ) : <span className="text-xs text-slate-400">{(u.full_name ?? u.email).charAt(0).toUpperCase()}</span>}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm text-white truncate">{u.full_name ?? '(sin nombre)'}</div>
                          <div className="text-xs text-slate-500 truncate">{u.email}</div>
                        </div>
                        {u.profile_completed_at && <Badge variant="success">Ficha ok</Badge>}
                      </button>
                    ))
                  })()}
                </div>
                <div className="flex gap-2 justify-between pt-2">
                  <Button variant="ghost" onClick={() => linkPlayer(null)} disabled={savingLink} className="text-red-400">
                    Quitar vínculo
                  </Button>
                  <div className="flex gap-2">
                    <Button
                      variant="ghost"
                      onClick={() => {
                        const excelName = linking.slot === 1 ? linking.team.player1_name : linking.slot === 2 ? linking.team.player2_name : linking.team.player3_name
                        setNewUserForm({ full_name: excelName ?? '', email: '', phone: '', password: '' })
                        setCreatingNew(true)
                      }}
                      disabled={savingLink}
                      className="text-cyan-400"
                    >
                      + Crear usuario
                    </Button>
                    <Button variant="ghost" onClick={() => { setLinking(null); setLinkSearch('') }} disabled={savingLink}>Cancelar</Button>
                  </div>
                </div>
              </>
            ) : (
              <div className="space-y-2 border border-cyan-500/30 bg-cyan-500/5 rounded-lg p-3">
                <p className="text-xs text-cyan-300 font-semibold">Crear usuario nuevo y vincularlo a este slot</p>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Nombre completo *</label>
                  <Input
                    value={newUserForm.full_name}
                    onChange={e => setNewUserForm(f => ({ ...f, full_name: e.target.value }))}
                    autoFocus
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Email *</label>
                  <Input
                    type="email"
                    value={newUserForm.email}
                    onChange={e => setNewUserForm(f => ({ ...f, email: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Teléfono</label>
                  <Input
                    value={newUserForm.phone}
                    onChange={e => setNewUserForm(f => ({ ...f, phone: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Contraseña inicial</label>
                  <Input
                    value={newUserForm.password}
                    onChange={e => setNewUserForm(f => ({ ...f, password: e.target.value }))}
                    placeholder="Vacío = generada automáticamente"
                  />
                  <p className="text-[10px] text-slate-500 mt-0.5">El jugador puede pedir reset desde login.</p>
                </div>
                <div className="flex gap-2 justify-end pt-1">
                  <Button variant="ghost" onClick={() => setCreatingNew(false)} disabled={savingNewUser}>Volver</Button>
                  <Button onClick={createAndLink} disabled={savingNewUser} className="flex items-center gap-1">
                    {savingNewUser ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                    Crear y vincular
                  </Button>
                </div>
              </div>
            )}
          </div>
        </Modal>
      )}

      {/* Modal resultado */}
      {editingMatch && (() => {
        const t1 = teams.find(t => t.id === editingMatch.team1_id)
        const t2 = teams.find(t => t.id === editingMatch.team2_id)
        return (
          <Modal open={!!editingMatch} onClose={() => setEditingMatch(null)} title="Cargar resultado">
            <div className="space-y-4">
              <div className="text-sm">
                <div className="text-white">{t1?.team_name ?? '?'}</div>
                <div className="text-slate-500 text-xs">vs</div>
                <div className="text-white">{t2?.team_name ?? '?'}</div>
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Fecha jugada</label>
                <Input type="date" value={matchForm.playedDate} onChange={e => setMatchForm(f => ({ ...f, playedDate: e.target.value }))} />
              </div>
              <div className="grid grid-cols-3 gap-2">
                {[1, 2, 3].map(n => (
                  <div key={n}>
                    <p className="text-xs text-slate-400 mb-1">Set {n}</p>
                    <div className="flex gap-1 items-center">
                      <Input
                        type="number" min="0" max="9"
                        value={matchForm[`t1s${n}` as keyof typeof matchForm]}
                        onChange={e => setMatchForm(f => ({ ...f, [`t1s${n}`]: e.target.value }))}
                      />
                      <span className="text-slate-500 text-xs">-</span>
                      <Input
                        type="number" min="0" max="9"
                        value={matchForm[`t2s${n}` as keyof typeof matchForm]}
                        onChange={e => setMatchForm(f => ({ ...f, [`t2s${n}`]: e.target.value }))}
                      />
                    </div>
                  </div>
                ))}
              </div>
              <div className="flex gap-2 justify-end pt-2">
                <Button variant="ghost" onClick={() => setEditingMatch(null)} disabled={savingMatch}>Cancelar</Button>
                <Button onClick={saveMatch} disabled={savingMatch} className="flex items-center gap-1">
                  {savingMatch ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                  Guardar
                </Button>
              </div>
            </div>
          </Modal>
        )
      })()}

      {/* Modal fecha jornada */}
      {editingRound && (
        <Modal open={!!editingRound} onClose={() => setEditingRound(null)} title={`Fecha — Jornada ${editingRound.round_number}`}>
          <div className="space-y-4">
            <div>
              <label className="block text-xs text-slate-400 mb-1">Fecha programada</label>
              <Input type="date" value={roundDate} onChange={e => setRoundDate(e.target.value)} />
              <p className="text-xs text-slate-500 mt-1">Dejá vacío para quitar la fecha.</p>
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="ghost" onClick={() => setEditingRound(null)} disabled={savingRound}>Cancelar</Button>
              <Button onClick={saveRoundDate} disabled={savingRound} className="flex items-center gap-1">
                {savingRound ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                Guardar
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}

function Kpi({ label, value, icon }: { label: string; value: number; icon: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3">
      <div className="w-10 h-10 rounded-lg bg-cyan-500/10 text-cyan-400 flex items-center justify-center">{icon}</div>
      <div>
        <div className="text-xs text-slate-400">{label}</div>
        <div className="text-xl font-bold text-white">{value}</div>
      </div>
    </div>
  )
}

function computeStandings(teams: Team[], matches: Match[]) {
  const map = new Map<number, {
    team: Team; played: number; wins: number; losses: number;
    setsFor: number; setsAgainst: number; points: number
  }>()
  for (const t of teams) map.set(t.id, { team: t, played: 0, wins: 0, losses: 0, setsFor: 0, setsAgainst: 0, points: 0 })
  for (const m of matches) {
    if (m.status !== 'completed' || m.team1_id == null || m.team2_id == null) continue
    const a = map.get(m.team1_id), b = map.get(m.team2_id)
    if (!a || !b) continue
    a.played++; b.played++
    a.setsFor += m.sets_team1; a.setsAgainst += m.sets_team2
    b.setsFor += m.sets_team2; b.setsAgainst += m.sets_team1
    if (m.winner_team_id === m.team1_id) {
      a.wins++; b.losses++
      a.points += m.sets_team2 === 0 ? 3 : 2
      b.points += m.sets_team2 === 1 ? 1 : 0
    } else if (m.winner_team_id === m.team2_id) {
      b.wins++; a.losses++
      b.points += m.sets_team1 === 0 ? 3 : 2
      a.points += m.sets_team1 === 1 ? 1 : 0
    }
  }
  return Array.from(map.values()).sort((x, y) => {
    if (y.points !== x.points) return y.points - x.points
    const dx = x.setsFor - x.setsAgainst, dy = y.setsFor - y.setsAgainst
    if (dy !== dx) return dy - dx
    return y.wins - x.wins
  })
}
