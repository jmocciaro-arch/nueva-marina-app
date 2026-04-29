'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { Trophy, Users, CalendarDays, Medal, Layers, ListOrdered, Loader2, Shield, Volleyball } from 'lucide-react'
import { MatchLivePublicView } from '@/components/match-live-public-view'
import { createClient } from '@/lib/supabase/client'
import { LeagueMatchGrid } from '@/components/league-match-grid'
import { SponsorBanner, type SponsorItem } from '@/components/sponsor-banner'

interface League {
  id: number
  name: string
  season: string | null
  format: string
  start_date: string | null
  end_date: string | null
  status: string
  description: string | null
  cover_image_url: string | null
  sponsors_jsonb: SponsorItem[] | null
}
interface Category {
  id: number
  name: string
  gender: string
  sort_order: number
}
interface PlayerDisplay {
  name: string
  avatar: string | null
  anonymized: boolean
}
interface Team {
  id: number
  category_id: number
  team_name: string
  players: PlayerDisplay[]
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

interface ApiResponse {
  league: League
  categories: Category[]
  teams: Team[]
  rounds: Round[]
  matches: Match[]
}

export default function LigaPublicaPage() {
  const params = useParams<{ id: string }>()
  const id = params.id

  const [data, setData] = useState<ApiResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [activeCategoryId, setActiveCategoryId] = useState<number | null>(null)
  const [liveMatchIds, setLiveMatchIds] = useState<number[]>([])

  // Cargar partidos en vivo de esta liga
  useEffect(() => {
    if (!id) return
    const supabase = createClient()
    const fetchLive = async () => {
      const { data: lives } = await supabase
        .from('nm_live_match_sessions')
        .select('match_id')
        .eq('match_type', 'league')
        .in('status', ['live', 'paused'])
      setLiveMatchIds((lives ?? []).map((l: { match_id: number }) => l.match_id))
    }
    fetchLive()
    const channel = supabase
      .channel(`liga-live-${id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'nm_live_match_sessions' }, fetchLive)
      .subscribe()
    return () => { channel.unsubscribe() }
  }, [id])

  useEffect(() => {
    if (!id) return
    fetch(`/api/public/liga/${id}`)
      .then(async r => {
        const j = await r.json()
        if (!r.ok) throw new Error(j.error ?? 'Error')
        setData(j as ApiResponse)
        if (j.categories.length > 0) setActiveCategoryId(j.categories[0].id)
      })
      .catch(e => setError((e as Error).message))
  }, [id])

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950 p-4">
        <div className="max-w-md bg-slate-900 border border-red-500/30 rounded-2xl p-6 text-center">
          <h1 className="text-xl font-bold text-white mb-2">Liga no disponible</h1>
          <p className="text-slate-300">{error}</p>
        </div>
      </div>
    )
  }

  if (!data) {
    return <div className="min-h-screen flex items-center justify-center bg-slate-950 text-white"><Loader2 size={32} className="animate-spin" /></div>
  }

  const { league, categories, teams, rounds, matches } = data
  const cat = categories.find(c => c.id === activeCategoryId) ?? null
  const catTeams = cat ? teams.filter(t => t.category_id === cat.id) : []
  const catRounds = cat ? rounds.filter(r => r.category_id === cat.id).sort((a, b) => a.round_number - b.round_number) : []
  const teamById = new Map(catTeams.map(t => [t.id, t]))
  const catMatches = cat ? matches.filter(m => m.category_id === cat.id) : []
  const standings = computeStandings(catTeams, catMatches)

  const genderLabel: Record<string, string> = { male: 'Masculino', female: 'Femenino', mixed: 'Mixto' }

  // Lista de sponsors a mostrar: si vienen de sponsors_jsonb los usa; si no, fallback a cover_image_url
  const sponsors: SponsorItem[] = league.sponsors_jsonb && league.sponsors_jsonb.length > 0
    ? league.sponsors_jsonb
    : (league.cover_image_url ? [{ image_url: league.cover_image_url, alt: league.name }] : [])

  return (
    <div className="min-h-screen bg-slate-950 text-white pb-16">
      {/* Header compacto con título */}
      <div className="bg-gradient-to-br from-cyan-900/40 via-slate-900 to-slate-950 border-b border-cyan-500/20 px-4 py-6">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-2xl sm:text-3xl font-bold flex items-center gap-3">
            <Trophy size={28} className="text-cyan-400" />
            {league.name}
          </h1>
          <p className="text-slate-300 mt-1.5 text-sm">
            {league.season && `Temporada ${league.season} · `}
            {league.start_date && new Date(league.start_date).toLocaleDateString('es-ES')}
            {league.end_date && ` → ${new Date(league.end_date).toLocaleDateString('es-ES')}`}
          </p>
          {league.description && <p className="text-slate-400 mt-1 text-sm">{league.description}</p>}
        </div>
      </div>

      {/* Banner móvil arriba (solo en pantallas chicas) */}
      {sponsors.length > 0 && (
        <div className="lg:hidden px-4 pt-4">
          <SponsorBanner sponsors={sponsors} variant="landscape" />
        </div>
      )}

      <div className="max-w-7xl mx-auto px-4 pt-6">
        <div className={sponsors.length > 0 ? 'grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6' : ''}>
          {/* Columna principal */}
          <div className="space-y-6 min-w-0">
        {/* KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Kpi label="Categorías" value={categories.length} icon={<Layers size={18} />} />
          <Kpi label="Equipos" value={teams.length} icon={<Users size={18} />} />
          <Kpi label="Jornadas" value={rounds.length} icon={<ListOrdered size={18} />} />
          <Kpi label="Partidos" value={matches.length} icon={<CalendarDays size={18} />} />
        </div>

        {/* Partidos en vivo ahora */}
        {liveMatchIds.length > 0 && (
          <div>
            <h2 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
              <Volleyball size={16} className="text-cyan-400 animate-pulse" />
              <span className="bg-cyan-500/20 text-cyan-300 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider">EN VIVO</span>
              Partidos jugándose ahora ({liveMatchIds.length})
            </h2>
            <div className="space-y-3">
              {liveMatchIds.map(matchId => (
                <MatchLivePublicView key={matchId} matchType="league" matchId={matchId} compact />
              ))}
            </div>
          </div>
        )}

        {categories.length === 0 ? (
          <Card>
            <p className="text-slate-400 text-sm">Esta liga todavía no tiene categorías publicadas.</p>
          </Card>
        ) : (
          <>
            <div className="flex gap-1 overflow-x-auto border-b border-slate-700/50">
              {categories.map(c => (
                <button
                  key={c.id}
                  onClick={() => setActiveCategoryId(c.id)}
                  className={`px-3 py-2 text-sm whitespace-nowrap transition-colors ${
                    activeCategoryId === c.id ? 'text-cyan-400 border-b-2 border-cyan-400' : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {c.name}
                </button>
              ))}
            </div>

            {cat && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Standings */}
                <Card>
                  <h2 className="text-sm font-semibold mb-3 flex items-center gap-2">
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
                            <td className="py-1.5 text-white truncate max-w-[200px]">{s.team.team_name}</td>
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
                  <h2 className="text-sm font-semibold mb-3 flex items-center gap-2">
                    <Users size={16} className="text-cyan-400" /> Equipos
                    <span className="text-xs text-slate-500">({catTeams.length}) · {genderLabel[cat.gender] ?? cat.gender}</span>
                  </h2>
                  <div className="space-y-1.5 max-h-[28rem] overflow-y-auto pr-1">
                    {catTeams.map(t => (
                      <div key={t.id} className="rounded-lg bg-slate-800/50 p-2.5 text-xs">
                        <div className="font-medium text-white">{t.team_name}</div>
                        <div className="flex flex-wrap gap-2 mt-1.5">
                          {t.players.map((p, i) => (
                            <div key={i} className="flex items-center gap-1.5 bg-slate-700/30 rounded-full pr-2 pl-0.5 py-0.5">
                              <div className="w-5 h-5 rounded-full bg-slate-600 flex items-center justify-center overflow-hidden shrink-0">
                                {p.avatar ? (
                                  // eslint-disable-next-line @next/next/no-img-element
                                  <img src={p.avatar} alt="" className="w-full h-full object-cover" />
                                ) : (
                                  <span className="text-[9px] text-slate-300">{p.anonymized ? '?' : p.name.charAt(0)}</span>
                                )}
                              </div>
                              <span className={p.anonymized ? 'text-slate-500 italic' : 'text-slate-300'}>{p.name}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </Card>
              </div>
            )}

            {/* Vista visual de partidos */}
            {cat && catMatches.length > 0 && (
              <LeagueMatchGrid
                teams={catTeams}
                rounds={catRounds}
                matches={catMatches}
              />
            )}

            {/* Jornadas */}
            {cat && catRounds.map(r => {
              const roundMatches = catMatches.filter(m => m.round_id === r.id)
              return (
                <Card key={r.id}>
                  <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                    <h3 className="text-sm font-semibold flex items-center gap-2">
                      Jornada {r.round_number}
                      {r.scheduled_date && <span className="text-xs text-cyan-400">{new Date(r.scheduled_date).toLocaleDateString('es-ES')}</span>}
                    </h3>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {roundMatches.map(m => {
                      const t1 = teamById.get(m.team1_id ?? -1)
                      const t2 = teamById.get(m.team2_id ?? -1)
                      const played = m.status === 'completed'
                      return (
                        <div key={m.id} className="rounded-lg border border-slate-700/50 bg-slate-800/30 p-3">
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
                              <span className="text-[10px] text-slate-500 bg-slate-700/50 px-2 py-0.5 rounded">Pendiente</span>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </Card>
              )
            })}
          </>
        )}

        {/* Footer GDPR */}
        <div className="text-center text-xs text-slate-500 flex items-center justify-center gap-1 pt-4">
          <Shield size={12} />
          Los jugadores que no autorizaron la publicación de sus datos aparecen como &quot;Jugador N&quot; — RGPD / LOPDGDD.
        </div>
          </div>

          {/* Sidebar fijo con sponsors (solo desktop) */}
          {sponsors.length > 0 && (
            <aside className="hidden lg:block">
              <div className="sticky top-6">
                <SponsorBanner sponsors={sponsors} variant="portrait" />
                {sponsors.length > 1 && (
                  <p className="mt-3 text-center text-xs text-slate-500">
                    Sponsors de la liga
                  </p>
                )}
              </div>
            </aside>
          )}
        </div>
      </div>
    </div>
  )
}

function Kpi({ label, value, icon }: { label: string; value: number | string; icon: React.ReactNode }) {
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 flex items-center gap-3">
      <div className="text-cyan-400">{icon}</div>
      <div>
        <div className="text-2xl font-bold text-white leading-tight">{value}</div>
        <div className="text-xs text-slate-400">{label}</div>
      </div>
    </div>
  )
}

function Card({ children }: { children: React.ReactNode }) {
  return <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">{children}</div>
}

// Misma lógica que en el panel admin: 2-0 = 3, 2-1 = 2, 1-2 = 1, 0-2 = 0
function computeStandings(teams: Team[], matches: Match[]) {
  const stats = new Map<number, { team: Team; played: number; wins: number; losses: number; setsFor: number; setsAgainst: number; points: number }>()
  for (const t of teams) stats.set(t.id, { team: t, played: 0, wins: 0, losses: 0, setsFor: 0, setsAgainst: 0, points: 0 })
  for (const m of matches) {
    if (m.status !== 'completed' || m.team1_id == null || m.team2_id == null) continue
    const a = stats.get(m.team1_id); const b = stats.get(m.team2_id)
    if (!a || !b) continue
    a.played++; b.played++
    a.setsFor += m.sets_team1; a.setsAgainst += m.sets_team2
    b.setsFor += m.sets_team2; b.setsAgainst += m.sets_team1
    if (m.sets_team1 > m.sets_team2) {
      a.wins++; b.losses++
      a.points += m.sets_team2 === 0 ? 3 : 2
      b.points += m.sets_team2 === 1 ? 1 : 0
    } else if (m.sets_team2 > m.sets_team1) {
      b.wins++; a.losses++
      b.points += m.sets_team1 === 0 ? 3 : 2
      a.points += m.sets_team1 === 1 ? 1 : 0
    }
  }
  return Array.from(stats.values()).sort((x, y) => y.points - x.points || (y.setsFor - y.setsAgainst) - (x.setsFor - x.setsAgainst))
}
