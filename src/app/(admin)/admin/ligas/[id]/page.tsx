'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import {
  ArrowLeft, Trophy, Users, CalendarDays, Save, Loader2,
  Pencil, Layers, ListOrdered, Medal, Download, Upload, Share2, Copy, ExternalLink, Trash2,
  History, AlertTriangle, Plus,
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
import { LeagueMatchGrid } from '@/components/league-match-grid'

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
  deadline_date: string | null
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

  // Round date modal (rango: inicio + fin de la semana de juego)
  const [editingRound, setEditingRound] = useState<Round | null>(null)
  const [roundDate, setRoundDate] = useState('')
  const [roundDeadline, setRoundDeadline] = useState('')
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

  // Compartir link público
  const [sharingPublic, setSharingPublic] = useState(false)

  // Borrar equipo (duplicados, etc.) — con modal y registro de auditoría
  const [deletingTeam, setDeletingTeam] = useState<{
    team: Team
    matchesCount: number
    playoffCount: number
  } | null>(null)
  const [deletionReason, setDeletionReason] = useState('')
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [openingDeleteFor, setOpeningDeleteFor] = useState<number | null>(null)

  // Historial de borrados
  interface DeletionRecord {
    id: number
    original_team_id: number
    team_name: string | null
    player1_name: string | null
    player2_name: string | null
    player3_name: string | null
    matches_deleted: number
    playoff_matches_deleted: number
    reason: string
    deleted_by_name: string | null
    deleted_by_email: string | null
    created_at: string
    category_id: number | null
  }
  const [showDeletionHistory, setShowDeletionHistory] = useState(false)
  const [deletionHistory, setDeletionHistory] = useState<DeletionRecord[]>([])
  const [loadingHistory, setLoadingHistory] = useState(false)

  // CRUD Categorías
  const [categoryEditor, setCategoryEditor] = useState<{
    mode: 'create' | 'edit'
    id: number | null
    name: string
    gender: string
    level: string
    max_teams: number
    status: string
  } | null>(null)
  const [savingCategory, setSavingCategory] = useState(false)

  // Borrar categoría
  const [deletingCategory, setDeletingCategory] = useState<{
    category: Category
    teamsCount: number
    roundsCount: number
    matchesCount: number
    playoffCount: number
  } | null>(null)
  const [deletingCategoryReason, setDeletingCategoryReason] = useState('')
  const [confirmingDeleteCategory, setConfirmingDeleteCategory] = useState(false)
  const [openingCategoryDeleteFor, setOpeningCategoryDeleteFor] = useState<number | null>(null)

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

  async function openDeleteModal(team: Team) {
    setOpeningDeleteFor(team.id)
    try {
      const supabase = createClient()
      const [lmCount, pmCount] = await Promise.all([
        supabase
          .from('nm_league_matches')
          .select('id', { count: 'exact', head: true })
          .or(`team1_id.eq.${team.id},team2_id.eq.${team.id}`),
        supabase
          .from('nm_league_playoff_matches')
          .select('id', { count: 'exact', head: true })
          .or(`team1_id.eq.${team.id},team2_id.eq.${team.id}`),
      ])
      setDeletingTeam({
        team,
        matchesCount: lmCount.count ?? 0,
        playoffCount: pmCount.count ?? 0,
      })
      setDeletionReason('')
    } finally {
      setOpeningDeleteFor(null)
    }
  }

  async function confirmDeleteTeam() {
    if (!deletingTeam) return
    const reason = deletionReason.trim()
    if (reason.length < 3) {
      toast('error', 'Contanos el motivo del borrado (mínimo 3 caracteres)')
      return
    }

    const { team, matchesCount, playoffCount } = deletingTeam
    const totalMatches = matchesCount + playoffCount
    const label = team.team_name ?? `(equipo #${team.id})`
    const supabase = createClient()
    setConfirmingDelete(true)

    try {
      // 0) datos del usuario que borra (para el registro)
      const { data: auth } = await supabase.auth.getUser()
      const { data: me } = auth.user
        ? await supabase.from('nm_users').select('full_name, email').eq('id', auth.user.id).maybeSingle()
        : { data: null }

      // 1) grabar registro de auditoría ANTES del delete para no perder snapshot
      const { error: eAudit } = await supabase.from('nm_league_team_deletions').insert({
        league_id: leagueId,
        category_id: team.category_id,
        original_team_id: team.id,
        team_name: team.team_name,
        player1_name: team.player1_name,
        player2_name: team.player2_name,
        player3_name: team.player3_name,
        player1_id: team.player1_id,
        player2_id: team.player2_id,
        player3_id: team.player3_id,
        matches_deleted: matchesCount,
        playoff_matches_deleted: playoffCount,
        reason,
        deleted_by: auth.user?.id ?? null,
        deleted_by_name: me?.full_name ?? null,
        deleted_by_email: me?.email ?? auth.user?.email ?? null,
        snapshot: team as unknown as Record<string, unknown>,
      })
      if (eAudit) {
        toast('error', `No se pudo grabar la auditoría: ${eAudit.message}`)
        return
      }

      // 2) borrar partidos de la fase regular
      if (matchesCount > 0) {
        const { error: e1 } = await supabase
          .from('nm_league_matches')
          .delete()
          .or(`team1_id.eq.${team.id},team2_id.eq.${team.id}`)
        if (e1) { toast('error', `No se pudieron borrar partidos: ${e1.message}`); return }
      }
      // 3) borrar partidos de playoff
      if (playoffCount > 0) {
        const { error: e2 } = await supabase
          .from('nm_league_playoff_matches')
          .delete()
          .or(`team1_id.eq.${team.id},team2_id.eq.${team.id}`)
        if (e2) { toast('error', `No se pudieron borrar partidos de playoff: ${e2.message}`); return }
      }
      // 4) borrar el equipo
      const { error: e3 } = await supabase
        .from('nm_league_teams')
        .delete()
        .eq('id', team.id)
      if (e3) { toast('error', `No se pudo borrar el equipo: ${e3.message}`); return }

      toast('success', totalMatches > 0
        ? `Equipo "${label}" y ${totalMatches} partido(s) borrados · registro guardado`
        : `Equipo "${label}" borrado · registro guardado`)
      setDeletingTeam(null)
      setDeletionReason('')
      await load()
    } finally {
      setConfirmingDelete(false)
    }
  }

  async function loadDeletionHistory() {
    setLoadingHistory(true)
    const supabase = createClient()
    const { data, error } = await supabase
      .from('nm_league_team_deletions')
      .select('id, original_team_id, team_name, player1_name, player2_name, player3_name, matches_deleted, playoff_matches_deleted, reason, deleted_by_name, deleted_by_email, created_at, category_id')
      .eq('league_id', leagueId)
      .order('created_at', { ascending: false })
      .limit(200)
    if (error) {
      toast('error', `No se pudo cargar el historial: ${error.message}`)
    } else {
      setDeletionHistory((data ?? []) as DeletionRecord[])
    }
    setLoadingHistory(false)
  }

  function openHistoryModal() {
    setShowDeletionHistory(true)
    loadDeletionHistory()
  }

  // ──────────────────────────────────────────────────────────────
  // CRUD Categorías
  // ──────────────────────────────────────────────────────────────
  function openCategoryCreate() {
    const nextSort = categories.length > 0
      ? Math.max(...categories.map(c => c.sort_order ?? 0)) + 1
      : 0
    setCategoryEditor({
      mode: 'create',
      id: null,
      name: '',
      gender: 'mixed',
      level: '',
      max_teams: 12,
      status: 'registration',
    })
    // usar la variable para evitar warning de unused
    void nextSort
  }

  function openCategoryEdit(c: Category) {
    setCategoryEditor({
      mode: 'edit',
      id: c.id,
      name: c.name,
      gender: c.gender ?? 'mixed',
      level: c.level ?? '',
      max_teams: 12,
      status: c.status ?? 'registration',
    })
  }

  async function saveCategory() {
    if (!categoryEditor) return
    const name = categoryEditor.name.trim()
    if (!name) { toast('error', 'El nombre es obligatorio'); return }

    setSavingCategory(true)
    const supabase = createClient()

    if (categoryEditor.mode === 'create') {
      const nextSort = categories.length > 0
        ? Math.max(...categories.map(c => c.sort_order ?? 0)) + 1
        : 0
      const { data, error } = await supabase
        .from('nm_league_categories')
        .insert({
          league_id: leagueId,
          name,
          gender: categoryEditor.gender,
          level: categoryEditor.level.trim() || null,
          max_teams: categoryEditor.max_teams,
          status: categoryEditor.status,
          sort_order: nextSort,
        })
        .select('id')
        .single()
      if (error) { toast('error', `No se pudo crear: ${error.message}`); setSavingCategory(false); return }
      toast('success', `Categoría "${name}" creada`)
      setCategoryEditor(null)
      setSavingCategory(false)
      await load()
      if (data?.id) setActiveCategoryId(data.id as number)
      return
    }

    // edit
    const { error } = await supabase
      .from('nm_league_categories')
      .update({
        name,
        gender: categoryEditor.gender,
        level: categoryEditor.level.trim() || null,
        status: categoryEditor.status,
      })
      .eq('id', categoryEditor.id)
    if (error) { toast('error', `No se pudo guardar: ${error.message}`); setSavingCategory(false); return }
    toast('success', 'Categoría actualizada')
    setCategoryEditor(null)
    setSavingCategory(false)
    await load()
  }

  async function openDeleteCategoryModal(category: Category) {
    setOpeningCategoryDeleteFor(category.id)
    try {
      const supabase = createClient()
      const [tCount, rCount, mCount, pCount] = await Promise.all([
        supabase.from('nm_league_teams')
          .select('id', { count: 'exact', head: true }).eq('category_id', category.id),
        supabase.from('nm_league_rounds')
          .select('id', { count: 'exact', head: true }).eq('category_id', category.id),
        supabase.from('nm_league_matches')
          .select('id', { count: 'exact', head: true }).eq('category_id', category.id),
        supabase.from('nm_league_playoff_matches')
          .select('id', { count: 'exact', head: true }).eq('category_id', category.id),
      ])
      setDeletingCategory({
        category,
        teamsCount: tCount.count ?? 0,
        roundsCount: rCount.count ?? 0,
        matchesCount: mCount.count ?? 0,
        playoffCount: pCount.count ?? 0,
      })
      setDeletingCategoryReason('')
    } finally {
      setOpeningCategoryDeleteFor(null)
    }
  }

  async function confirmDeleteCategory() {
    if (!deletingCategory) return
    const reason = deletingCategoryReason.trim()
    if (reason.length < 3) {
      toast('error', 'Contanos el motivo del borrado (mínimo 3 caracteres)')
      return
    }
    const { category, teamsCount, roundsCount, matchesCount, playoffCount } = deletingCategory
    const supabase = createClient()
    setConfirmingDeleteCategory(true)

    try {
      // snapshot de los equipos de la categoría
      const { data: teamsSnap } = await supabase
        .from('nm_league_teams')
        .select('*')
        .eq('category_id', category.id)

      // datos del usuario que borra
      const { data: auth } = await supabase.auth.getUser()
      const { data: me } = auth.user
        ? await supabase.from('nm_users').select('full_name, email').eq('id', auth.user.id).maybeSingle()
        : { data: null }

      // 1) audit PRIMERO
      const { error: eAudit } = await supabase.from('nm_league_category_deletions').insert({
        league_id: leagueId,
        original_category_id: category.id,
        category_name: category.name,
        gender: category.gender,
        level: category.level,
        status_at_deletion: category.status,
        teams_deleted: teamsCount,
        rounds_deleted: roundsCount,
        matches_deleted: matchesCount,
        playoff_matches_deleted: playoffCount,
        reason,
        deleted_by: auth.user?.id ?? null,
        deleted_by_name: me?.full_name ?? null,
        deleted_by_email: me?.email ?? auth.user?.email ?? null,
        category_snapshot: category as unknown as Record<string, unknown>,
        teams_snapshot: (teamsSnap ?? []) as unknown as Record<string, unknown>[],
      })
      if (eAudit) {
        toast('error', `No se pudo grabar la auditoría: ${eAudit.message}`)
        return
      }

      // 2) borrar categoría — el schema tiene ON DELETE CASCADE para teams,
      //    rounds, matches, playoff_matches y groups, así que esto limpia
      //    todo en cascada automáticamente.
      const { error: eDel } = await supabase
        .from('nm_league_categories')
        .delete()
        .eq('id', category.id)
      if (eDel) { toast('error', `No se pudo borrar la categoría: ${eDel.message}`); return }

      toast('success', `Categoría "${category.name}" borrada con ${teamsCount} equipo(s) y ${matchesCount + playoffCount} partido(s) en cascada`)
      setDeletingCategory(null)
      setDeletingCategoryReason('')
      // si la categoría borrada era la activa, pasar a la primera que quede
      if (activeCategoryId === category.id) setActiveCategoryId(null)
      await load()
    } finally {
      setConfirmingDeleteCategory(false)
    }
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
    // Si no hay deadline pero sí inicio, sugerir +6 días
    const suggestedEnd = r.deadline_date
      ? r.deadline_date
      : r.scheduled_date
        ? addDays(r.scheduled_date, 6)
        : ''
    setRoundDeadline(suggestedEnd)
  }

  async function saveRoundDate() {
    if (!editingRound) return
    if (roundDate && roundDeadline && roundDeadline < roundDate) {
      toast('error', 'La fecha fin no puede ser anterior al inicio')
      return
    }
    setSavingRound(true)
    const supabase = createClient()
    const { error } = await supabase.from('nm_league_rounds').update({
      scheduled_date: roundDate || null,
      deadline_date: roundDeadline || null,
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
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setSharingPublic(true)}
            className="flex items-center gap-1 px-3 py-2 text-xs rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white transition-colors"
          >
            <Share2 size={14} /> Compartir link público
          </button>
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
          <div className="flex flex-col items-center gap-3 py-4">
            <p className="text-slate-400 text-sm">Esta liga no tiene categorías todavía.</p>
            <div className="flex gap-2">
              <Button onClick={openCategoryCreate} className="flex items-center gap-1">
                <Plus size={14} /> Crear categoría
              </Button>
              <Link
                href={`/admin/ligas/importar?league_id=${league.id}`}
                className="flex items-center gap-1 px-4 py-2 text-sm rounded-lg bg-slate-700 hover:bg-slate-600 text-white transition-colors"
              >
                <Upload size={14} /> Importar Excel
              </Link>
            </div>
          </div>
        </Card>
      ) : (
        <>
          <div className="flex gap-1 overflow-x-auto border-b border-slate-700/50 items-center">
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
            <button
              onClick={openCategoryCreate}
              title="Crear nueva categoría"
              className="ml-2 px-3 py-2 text-sm whitespace-nowrap text-cyan-400 hover:text-cyan-300 hover:bg-slate-800/50 rounded-t flex items-center gap-1 transition-colors"
            >
              <Plus size={14} /> Nueva
            </button>
          </div>

          {cat && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Standings */}
              <Card>
                <h2 className="text-sm font-semibold text-white mb-3 flex items-center gap-2 flex-wrap">
                  <Medal size={16} className="text-cyan-400" /> Clasificación — {cat.name}
                  <div className="ml-auto flex items-center gap-1">
                    <button
                      onClick={() => openCategoryEdit(cat)}
                      title="Editar categoría"
                      className="p-1.5 rounded text-slate-500 hover:text-cyan-400 hover:bg-cyan-500/10 transition-colors"
                    >
                      <Pencil size={12} />
                    </button>
                    <button
                      onClick={() => openDeleteCategoryModal(cat)}
                      disabled={openingCategoryDeleteFor === cat.id}
                      title="Borrar categoría (se pide motivo)"
                      className="p-1.5 rounded text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-colors disabled:opacity-50"
                    >
                      {openingCategoryDeleteFor === cat.id
                        ? <Loader2 size={12} className="animate-spin" />
                        : <Trash2 size={12} />}
                    </button>
                  </div>
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
                  <button
                    onClick={openHistoryModal}
                    className="ml-auto text-[11px] text-slate-400 hover:text-cyan-400 flex items-center gap-1 transition-colors"
                    title="Ver historial de equipos borrados en esta liga"
                  >
                    <History size={12} /> Historial borrados
                  </button>
                  <span className="text-xs text-slate-500">{genderLabel[cat.gender] ?? cat.gender}</span>
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
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <div className="font-medium text-white flex-1 truncate">{t.team_name ?? '(sin nombre)'}</div>
                        <button
                          onClick={() => openDeleteModal(t)}
                          disabled={openingDeleteFor === t.id}
                          title="Borrar equipo (se pide motivo)"
                          className="shrink-0 p-1 rounded text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {openingDeleteFor === t.id
                            ? <Loader2 size={12} className="animate-spin" />
                            : <Trash2 size={12} />}
                        </button>
                      </div>
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

          {/* Vista visual de partidos */}
          {cat && matches.filter(m => m.category_id === cat.id).length > 0 && (
            <LeagueMatchGrid
              teams={catTeams}
              rounds={catRounds}
              matches={matches.filter(m => m.category_id === cat.id)}
              onMatchClick={(matchId) => {
                const m = matches.find(x => x.id === matchId)
                if (m) openEditMatch(m)
              }}
            />
          )}

          {/* Jornadas */}
          {cat && catRounds.map(r => {
            const matchesOfRound = matches.filter(m => m.round_id === r.id)

            // Calcular la semana a mostrar en el mini-cal
            // Prioridad: scheduled_date → primer played_date de los matches
            const firstPlayed = matchesOfRound
              .map(m => m.played_date)
              .filter((d): d is string => !!d)
              .sort()[0]
            const weekAnchor = r.scheduled_date ?? firstPlayed ?? null
            const weekStart = weekAnchor ? startOfWeek(weekAnchor) : null
            const weekEnd = r.deadline_date ?? (weekStart ? addDays(weekStart, 6) : null)

            // Mapa día ISO → array de matches con su color
            const dayToMatches: Record<string, Array<{ matchId: number; colorIdx: number }>> = {}
            matchesOfRound.forEach((m, idx) => {
              if (m.played_date) {
                if (!dayToMatches[m.played_date]) dayToMatches[m.played_date] = []
                dayToMatches[m.played_date].push({ matchId: m.id, colorIdx: idx })
              }
            })

            // Construir los 7 días del calendario (desde weekStart)
            const weekDays: Array<{ iso: string; label: string; dayNum: number }> = []
            if (weekStart) {
              const dayLetters = ['L', 'M', 'X', 'J', 'V', 'S', 'D']
              for (let i = 0; i < 7; i++) {
                const iso = addDays(weekStart, i)
                const d = new Date(iso + 'T00:00:00')
                weekDays.push({ iso, label: dayLetters[i], dayNum: d.getDate() })
              }
            }

            return (
              <Card key={r.id}>
                <div className="flex items-center justify-between mb-3 flex-wrap gap-3">
                  <div className="flex items-center gap-3 flex-wrap">
                    <h3 className="text-sm font-semibold text-white">Jornada {r.round_number}</h3>
                    {r.scheduled_date && weekEnd ? (
                      <Badge variant="info">{fmtRange(r.scheduled_date, weekEnd)}</Badge>
                    ) : r.scheduled_date ? (
                      <Badge variant="info">{formatDate(r.scheduled_date)}</Badge>
                    ) : (
                      <Badge variant="warning">Sin fecha</Badge>
                    )}
                  </div>

                  {/* Mini-calendario de la semana con dots de colores por partido */}
                  {weekDays.length > 0 && (
                    <div className="flex items-end gap-1">
                      {weekDays.map(d => {
                        const matchesThatDay = dayToMatches[d.iso] ?? []
                        const isToday = d.iso === new Date().toISOString().slice(0, 10)
                        return (
                          <div
                            key={d.iso}
                            className="flex flex-col items-center gap-0.5 w-7"
                            title={fmtDayShort(d.iso) + (matchesThatDay.length ? ` · ${matchesThatDay.length} partido(s)` : '')}
                          >
                            <span className={[
                              'text-[9px] uppercase tracking-wider',
                              isToday ? 'text-cyan-400 font-bold' : 'text-slate-500',
                            ].join(' ')}>
                              {d.label}
                            </span>
                            <span className={[
                              'text-[11px] leading-none flex items-center justify-center w-6 h-6 rounded-full',
                              isToday ? 'bg-cyan-500/20 text-cyan-300 font-bold' : 'text-slate-300',
                            ].join(' ')}>
                              {d.dayNum}
                            </span>
                            <div className="flex gap-0.5 h-1.5">
                              {matchesThatDay.slice(0, 4).map(({ matchId, colorIdx }) => (
                                <span
                                  key={matchId}
                                  className={`w-1.5 h-1.5 rounded-full ${matchColor(colorIdx).dot}`}
                                />
                              ))}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}

                  <Button variant="ghost" onClick={() => openEditRound(r)} className="flex items-center gap-1 text-xs">
                    <Pencil size={12} /> Fecha
                  </Button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {matchesOfRound.map((m, idx) => {
                    const t1 = teamById.get(m.team1_id ?? -1)
                    const t2 = teamById.get(m.team2_id ?? -1)
                    const played = m.status === 'completed'
                    const color = matchColor(idx)
                    return (
                      <button
                        key={m.id}
                        onClick={() => openEditMatch(m)}
                        className={`text-left rounded-lg border-l-4 ${color.border} border-y border-r border-slate-700/50 ${color.bg} hover:bg-slate-800/70 hover:border-slate-600 p-3 transition-colors`}
                      >
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <div className="flex items-center gap-1.5">
                            <span className={`w-2 h-2 rounded-full ${color.dot}`} />
                            {m.played_date ? (
                              <span className={`text-[10px] font-medium ${color.text}`}>
                                {fmtDayShort(m.played_date)}
                              </span>
                            ) : (
                              <span className="text-[10px] text-slate-500 italic">sin fecha</span>
                            )}
                          </div>
                          {played ? (
                            <span className="text-[10px] text-emerald-400 font-medium">JUGADO</span>
                          ) : (
                            <span className="text-[10px] text-slate-500">PENDIENTE</span>
                          )}
                        </div>
                        <div className="flex items-center justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <div className="text-xs text-slate-300 truncate">{t1?.team_name ?? '?'}</div>
                            <div className="text-xs text-slate-500 my-0.5">vs</div>
                            <div className="text-xs text-slate-300 truncate">{t2?.team_name ?? '?'}</div>
                          </div>
                          {played && (
                            <div className="text-right text-xs font-mono">
                              <div className={m.winner_team_id === m.team1_id ? 'text-green-400 font-bold' : 'text-slate-400'}>
                                {m.team1_set1 ?? '-'} / {m.team1_set2 ?? '-'}{m.team1_set3 != null ? ` / ${m.team1_set3}` : ''}
                              </div>
                              <div className={m.winner_team_id === m.team2_id ? 'text-green-400 font-bold' : 'text-slate-400'}>
                                {m.team2_set1 ?? '-'} / {m.team2_set2 ?? '-'}{m.team2_set3 != null ? ` / ${m.team2_set3}` : ''}
                              </div>
                            </div>
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

      {/* Modal compartir link público */}
      {sharingPublic && (
        <Modal open={sharingPublic} onClose={() => setSharingPublic(false)} title="Compartir liga — link público">
          <div className="space-y-3">
            <p className="text-xs text-slate-400">
              Este es el link público de la liga. Podés compartirlo por WhatsApp, email o redes.
              Los jugadores que <strong>no autorizaron</strong> publicar sus datos aparecen como
              <em className="mx-1 text-cyan-300">&quot;Jugador N&quot;</em> (cumplimiento RGPD/LOPDGDD).
            </p>
            {(() => {
              const publicUrl = typeof window !== 'undefined' ? `${window.location.origin}/liga/${league.id}` : `/liga/${league.id}`
              const waText = encodeURIComponent(`Mirá la liga "${league.name}" acá: ${publicUrl}`)
              const mailSubj = encodeURIComponent(`Liga ${league.name}`)
              const mailBody = encodeURIComponent(`Hola,\n\nCompartimos el link público de la liga ${league.name}:\n${publicUrl}\n\nSaludos.`)
              return (
                <>
                  <div className="flex items-center gap-2 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2">
                    <code className="flex-1 text-xs text-cyan-300 truncate">{publicUrl}</code>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(publicUrl)
                        toast('success', 'Link copiado')
                      }}
                      className="p-1.5 rounded hover:bg-slate-700 text-slate-300"
                      title="Copiar"
                    >
                      <Copy size={14} />
                    </button>
                    <a
                      href={publicUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-1.5 rounded hover:bg-slate-700 text-slate-300"
                      title="Abrir"
                    >
                      <ExternalLink size={14} />
                    </a>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <a
                      href={`https://wa.me/?text=${waText}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-center gap-2 px-3 py-2 text-sm rounded-lg bg-green-600 hover:bg-green-500 text-white"
                    >
                      WhatsApp
                    </a>
                    <a
                      href={`mailto:?subject=${mailSubj}&body=${mailBody}`}
                      className="flex items-center justify-center gap-2 px-3 py-2 text-sm rounded-lg bg-slate-700 hover:bg-slate-600 text-white"
                    >
                      Email
                    </a>
                  </div>
                </>
              )
            })()}
            <div className="flex justify-end pt-2">
              <Button variant="ghost" onClick={() => setSharingPublic(false)}>Cerrar</Button>
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

      {/* Modal fecha jornada (rango: inicio + fin de semana) */}
      {editingRound && (
        <Modal open={!!editingRound} onClose={() => setEditingRound(null)} title={`Fecha — Jornada ${editingRound.round_number}`}>
          <div className="space-y-4">
            <p className="text-xs text-slate-400">
              La jornada se juega entre dos fechas (ej: <em>Lunes 13 al Domingo 19</em>).
              Los partidos individuales se fechan al cargar el resultado.
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-slate-400 mb-1">Desde</label>
                <Input
                  type="date"
                  value={roundDate}
                  onChange={e => {
                    const val = e.target.value
                    setRoundDate(val)
                    // auto-sugerir +6 días si el fin está vacío o es previo al nuevo inicio
                    if (val && (!roundDeadline || roundDeadline < val)) {
                      setRoundDeadline(addDays(val, 6))
                    }
                  }}
                />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Hasta</label>
                <Input
                  type="date"
                  value={roundDeadline}
                  onChange={e => setRoundDeadline(e.target.value)}
                  min={roundDate || undefined}
                />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                onClick={() => {
                  if (!roundDate) return
                  const monday = startOfWeek(roundDate)
                  setRoundDate(monday)
                  setRoundDeadline(addDays(monday, 6))
                }}
                disabled={!roundDate}
                className="text-xs"
              >
                Ajustar a Lun-Dom
              </Button>
              <Button
                variant="ghost"
                onClick={() => { setRoundDate(''); setRoundDeadline('') }}
                className="text-xs text-red-400 hover:text-red-300"
              >
                Limpiar
              </Button>
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

      {/* Modal confirmar borrado de equipo con motivo obligatorio */}
      {deletingTeam && (
        <Modal
          open={!!deletingTeam}
          onClose={() => { if (!confirmingDelete) { setDeletingTeam(null); setDeletionReason('') } }}
          title={`Borrar equipo — ${deletingTeam.team.team_name ?? `#${deletingTeam.team.id}`}`}
        >
          <div className="space-y-4">
            <div className="rounded-lg border border-red-500/30 bg-red-500/5 p-3 flex gap-3">
              <AlertTriangle size={18} className="text-red-400 shrink-0 mt-0.5" />
              <div className="text-xs text-red-200 space-y-1">
                <p><strong>Esta acción no se puede deshacer.</strong></p>
                {(deletingTeam.matchesCount + deletingTeam.playoffCount) > 0 ? (
                  <p>
                    El equipo tiene{' '}
                    <strong>{deletingTeam.matchesCount}</strong> partido(s) de fase regular
                    {deletingTeam.playoffCount > 0 && <> y <strong>{deletingTeam.playoffCount}</strong> de playoff</>}
                    {' '}que también se eliminarán, incluyendo sus resultados.
                  </p>
                ) : (
                  <p>El equipo no tiene partidos asociados.</p>
                )}
              </div>
            </div>

            <div className="text-xs text-slate-400 space-y-1">
              <p><span className="text-slate-500">Jugadores del equipo:</span></p>
              <ul className="pl-4 list-disc text-slate-300">
                {[deletingTeam.team.player1_name, deletingTeam.team.player2_name, deletingTeam.team.player3_name]
                  .filter(Boolean)
                  .map((n, i) => <li key={i}>{n}</li>)}
                {![deletingTeam.team.player1_name, deletingTeam.team.player2_name, deletingTeam.team.player3_name].some(Boolean) &&
                  <li className="text-slate-500 list-none">(sin jugadores cargados)</li>}
              </ul>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Motivo del borrado <span className="text-red-400">*</span>
              </label>
              <textarea
                value={deletionReason}
                onChange={e => setDeletionReason(e.target.value)}
                placeholder="Ej: Equipo duplicado al importar desde Excel, el correcto es el otro ALBA-MANU con los jugadores vinculados."
                rows={3}
                className="w-full rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/40 focus:border-cyan-500"
                disabled={confirmingDelete}
                autoFocus
              />
              <p className="text-[11px] text-slate-500 mt-1">
                Quedará registrado en el historial de la liga junto con tu nombre y la fecha.
              </p>
            </div>

            <div className="flex gap-2 justify-end pt-2">
              <Button
                variant="ghost"
                onClick={() => { setDeletingTeam(null); setDeletionReason('') }}
                disabled={confirmingDelete}
              >
                Cancelar
              </Button>
              <Button
                onClick={confirmDeleteTeam}
                disabled={confirmingDelete || deletionReason.trim().length < 3}
                className="bg-red-600 hover:bg-red-700 flex items-center gap-1"
              >
                {confirmingDelete
                  ? <Loader2 size={14} className="animate-spin" />
                  : <Trash2 size={14} />}
                {confirmingDelete ? 'Borrando…' : 'Borrar equipo'}
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Modal crear/editar categoría */}
      {categoryEditor && (
        <Modal
          open={!!categoryEditor}
          onClose={() => { if (!savingCategory) setCategoryEditor(null) }}
          title={categoryEditor.mode === 'create' ? 'Nueva categoría' : `Editar categoría — ${categoryEditor.name}`}
        >
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Nombre <span className="text-red-400">*</span>
              </label>
              <Input
                value={categoryEditor.name}
                onChange={e => setCategoryEditor({ ...categoryEditor, name: e.target.value })}
                placeholder="Ej: 4ª/5ª Femenina - Grupo A"
                disabled={savingCategory}
                autoFocus
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Género</label>
                <select
                  value={categoryEditor.gender}
                  onChange={e => setCategoryEditor({ ...categoryEditor, gender: e.target.value })}
                  disabled={savingCategory}
                  className="w-full rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-cyan-500/40 focus:border-cyan-500"
                >
                  <option value="male">Masculino</option>
                  <option value="female">Femenino</option>
                  <option value="mixed">Mixto</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Nivel</label>
                <Input
                  value={categoryEditor.level}
                  onChange={e => setCategoryEditor({ ...categoryEditor, level: e.target.value })}
                  placeholder="Ej: 2ª / 3ª"
                  disabled={savingCategory}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Máx. equipos</label>
                <Input
                  type="number"
                  min={2}
                  max={64}
                  value={categoryEditor.max_teams}
                  onChange={e => setCategoryEditor({ ...categoryEditor, max_teams: parseInt(e.target.value || '12') })}
                  disabled={savingCategory || categoryEditor.mode === 'edit'}
                />
                {categoryEditor.mode === 'edit' && (
                  <p className="text-[11px] text-slate-500 mt-1">No editable desde esta pantalla.</p>
                )}
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Estado</label>
                <select
                  value={categoryEditor.status}
                  onChange={e => setCategoryEditor({ ...categoryEditor, status: e.target.value })}
                  disabled={savingCategory}
                  className="w-full rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-cyan-500/40 focus:border-cyan-500"
                >
                  <option value="registration">Inscripción</option>
                  <option value="active">En juego</option>
                  <option value="finished">Finalizada</option>
                  <option value="cancelled">Cancelada</option>
                </select>
              </div>
            </div>

            <div className="flex gap-2 justify-end pt-2">
              <Button variant="ghost" onClick={() => setCategoryEditor(null)} disabled={savingCategory}>
                Cancelar
              </Button>
              <Button onClick={saveCategory} disabled={savingCategory} className="flex items-center gap-1">
                {savingCategory ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                {categoryEditor.mode === 'create' ? 'Crear' : 'Guardar'}
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Modal confirmar borrado de categoría */}
      {deletingCategory && (
        <Modal
          open={!!deletingCategory}
          onClose={() => { if (!confirmingDeleteCategory) { setDeletingCategory(null); setDeletingCategoryReason('') } }}
          title={`Borrar categoría — ${deletingCategory.category.name}`}
        >
          <div className="space-y-4">
            <div className="rounded-lg border border-red-500/40 bg-red-500/10 p-3 flex gap-3">
              <AlertTriangle size={18} className="text-red-400 shrink-0 mt-0.5" />
              <div className="text-xs text-red-200 space-y-1">
                <p><strong>Esta acción no se puede deshacer.</strong></p>
                <p>Al borrar la categoría se eliminarán automáticamente <strong>en cascada</strong>:</p>
                <ul className="list-disc pl-4 space-y-0.5">
                  <li><strong>{deletingCategory.teamsCount}</strong> equipo(s)</li>
                  <li><strong>{deletingCategory.roundsCount}</strong> jornada(s)</li>
                  <li><strong>{deletingCategory.matchesCount}</strong> partido(s) de fase regular</li>
                  {deletingCategory.playoffCount > 0 && (
                    <li><strong>{deletingCategory.playoffCount}</strong> partido(s) de playoff</li>
                  )}
                </ul>
                {(deletingCategory.matchesCount + deletingCategory.playoffCount) > 0 && (
                  <p className="pt-1">Los <strong>resultados de los partidos ya jugados se perderán</strong>.</p>
                )}
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Motivo del borrado <span className="text-red-400">*</span>
              </label>
              <textarea
                value={deletingCategoryReason}
                onChange={e => setDeletingCategoryReason(e.target.value)}
                placeholder="Ej: Categoría creada por error en la importación. Se duplicó con 'Mixto B - Grupo 2' que es la correcta."
                rows={3}
                className="w-full rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/40 focus:border-cyan-500"
                disabled={confirmingDeleteCategory}
                autoFocus
              />
              <p className="text-[11px] text-slate-500 mt-1">
                Quedará registrado junto con tu nombre, snapshot completo de la categoría y todos los equipos que tenía.
              </p>
            </div>

            <div className="flex gap-2 justify-end pt-2">
              <Button
                variant="ghost"
                onClick={() => { setDeletingCategory(null); setDeletingCategoryReason('') }}
                disabled={confirmingDeleteCategory}
              >
                Cancelar
              </Button>
              <Button
                onClick={confirmDeleteCategory}
                disabled={confirmingDeleteCategory || deletingCategoryReason.trim().length < 3}
                className="bg-red-600 hover:bg-red-700 flex items-center gap-1"
              >
                {confirmingDeleteCategory
                  ? <Loader2 size={14} className="animate-spin" />
                  : <Trash2 size={14} />}
                {confirmingDeleteCategory ? 'Borrando…' : 'Borrar categoría'}
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Modal historial de borrados */}
      {showDeletionHistory && (
        <Modal
          open={showDeletionHistory}
          onClose={() => setShowDeletionHistory(false)}
          title="Historial de equipos borrados"
          size="xl"
        >
          {loadingHistory ? (
            <div className="py-12 text-center text-slate-500">
              <Loader2 size={24} className="animate-spin mx-auto mb-2" />
              Cargando historial…
            </div>
          ) : deletionHistory.length === 0 ? (
            <div className="py-12 text-center">
              <History size={40} className="mx-auto text-slate-600 mb-3" />
              <p className="text-sm text-slate-400">Sin registros todavía.</p>
              <p className="text-xs text-slate-500 mt-1">Cuando borres un equipo, el registro aparecerá acá.</p>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center gap-3 text-xs text-slate-400 pb-2 border-b border-slate-700/50">
                <span><strong className="text-white">{deletionHistory.length}</strong> borrado(s) en esta liga</span>
                <span className="text-slate-600">·</span>
                <span>
                  <strong className="text-white">
                    {deletionHistory.reduce((acc, r) => acc + r.matches_deleted + r.playoff_matches_deleted, 0)}
                  </strong> partido(s) borrados en cascada
                </span>
              </div>
              {deletionHistory.map(rec => {
                const players = [rec.player1_name, rec.player2_name, rec.player3_name].filter(Boolean)
                const totalM = rec.matches_deleted + rec.playoff_matches_deleted
                const catName = categories.find(c => c.id === rec.category_id)?.name
                return (
                  <div key={rec.id} className="rounded-lg border border-slate-700/50 bg-slate-800/40 p-3 text-xs">
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <div>
                        <div className="font-semibold text-white text-sm">
                          {rec.team_name ?? `(sin nombre — #${rec.original_team_id})`}
                        </div>
                        <div className="text-slate-500 text-[11px]">
                          {catName ? `Categoría ${catName}` : 'Categoría borrada'}
                          {' · '}
                          {players.length > 0 ? players.join(' / ') : 'sin jugadores'}
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <Badge variant={totalM > 0 ? 'warning' : 'default'}>
                          {totalM > 0 ? `${totalM} partido(s)` : 'sin partidos'}
                        </Badge>
                      </div>
                    </div>
                    <div className="rounded bg-slate-900/50 border-l-2 border-red-500/50 px-3 py-2 text-slate-300 italic mb-2">
                      “{rec.reason}”
                    </div>
                    <div className="flex items-center justify-between text-[11px] text-slate-500">
                      <span>
                        Borrado por{' '}
                        <strong className="text-slate-300">
                          {rec.deleted_by_name ?? rec.deleted_by_email ?? 'usuario desconocido'}
                        </strong>
                      </span>
                      <span>{formatDate(rec.created_at)}</span>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
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

// ──────────────────────────────────────────────────────────────
// Helpers de fechas y colores para el calendario de jornadas
// ──────────────────────────────────────────────────────────────

/** Suma N días a una fecha ISO (YYYY-MM-DD) y devuelve otra ISO. */
function addDays(isoDate: string, days: number): string {
  const d = new Date(isoDate + 'T00:00:00')
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}

/** Devuelve el lunes (ISO) de la semana que contiene a la fecha dada. */
function startOfWeek(isoDate: string): string {
  const d = new Date(isoDate + 'T00:00:00')
  const day = d.getDay() // 0=Dom, 1=Lun, ..., 6=Sab
  const diff = day === 0 ? -6 : 1 - day
  d.setDate(d.getDate() + diff)
  return d.toISOString().slice(0, 10)
}

/** Formatea una fecha ISO como "lun 13 abr". */
function fmtDayShort(isoDate: string): string {
  const d = new Date(isoDate + 'T00:00:00')
  const day = d.toLocaleDateString('es-ES', { weekday: 'short' }).replace('.', '')
  const dayNum = d.getDate()
  const month = d.toLocaleDateString('es-ES', { month: 'short' }).replace('.', '')
  return `${day} ${dayNum} ${month}`
}

/** Formatea un rango: "13 al 19 abr" o "30 mar al 5 abr" si cruza mes. */
function fmtRange(startIso: string, endIso: string): string {
  const s = new Date(startIso + 'T00:00:00')
  const e = new Date(endIso + 'T00:00:00')
  const sDay = s.getDate(), eDay = e.getDate()
  const sMonth = s.toLocaleDateString('es-ES', { month: 'short' }).replace('.', '')
  const eMonth = e.toLocaleDateString('es-ES', { month: 'short' }).replace('.', '')
  if (s.getMonth() === e.getMonth()) return `${sDay} al ${eDay} ${eMonth}`
  return `${sDay} ${sMonth} al ${eDay} ${eMonth}`
}

/** 7 paletas de colores determinísticas para matches dentro de una jornada. */
const MATCH_PALETTE = [
  { dot: 'bg-cyan-500', border: 'border-cyan-500/50', text: 'text-cyan-300', bg: 'bg-cyan-500/5' },
  { dot: 'bg-emerald-500', border: 'border-emerald-500/50', text: 'text-emerald-300', bg: 'bg-emerald-500/5' },
  { dot: 'bg-amber-500', border: 'border-amber-500/50', text: 'text-amber-300', bg: 'bg-amber-500/5' },
  { dot: 'bg-purple-500', border: 'border-purple-500/50', text: 'text-purple-300', bg: 'bg-purple-500/5' },
  { dot: 'bg-pink-500', border: 'border-pink-500/50', text: 'text-pink-300', bg: 'bg-pink-500/5' },
  { dot: 'bg-sky-500', border: 'border-sky-500/50', text: 'text-sky-300', bg: 'bg-sky-500/5' },
  { dot: 'bg-orange-500', border: 'border-orange-500/50', text: 'text-orange-300', bg: 'bg-orange-500/5' },
] as const

/** Color determinístico según posición del match dentro de la jornada. */
function matchColor(indexInRound: number) {
  return MATCH_PALETTE[indexInRound % MATCH_PALETTE.length]
}
