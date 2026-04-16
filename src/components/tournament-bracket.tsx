'use client'

import { useEffect, useState, useCallback } from 'react'
import {
  GitBranch,
  Table,
  LayoutGrid,
  List,
  Clock,
  Settings,
  Trophy,
  CheckCircle2,
  Circle,
  Zap,
} from 'lucide-react'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface BracketMatch {
  id: number
  round_number: number
  round: string
  bracket_position: number
  match_number: number
  team1_id: number | null
  team2_id: number | null
  team1_name: string | null
  team2_name: string | null
  team1_set1: number | null
  team1_set2: number | null
  team1_set3: number | null
  team2_set1: number | null
  team2_set2: number | null
  team2_set3: number | null
  sets_team1: number
  sets_team2: number
  winner_team_id: number | null
  status: string // pending | in_progress | completed
  court_name: string | null
  started_at: string | null
  finished_at: string | null
  duration_seconds: number | null
  is_bye: boolean
  next_match_id: number | null
}

export type BracketViewMode = 'tree' | 'table' | 'cards' | 'compact' | 'timeline'
export type BracketTheme = 'dark' | 'neon' | 'classic' | 'padel'
export type BracketCardSize = 'sm' | 'md' | 'lg'

export interface BracketConfig {
  viewMode: BracketViewMode
  theme: BracketTheme
  cardSize: BracketCardSize
  showScores: boolean
  showTimers: boolean
  showCourts: boolean
  showRoundHeaders: boolean
  showByes: boolean
  animationsEnabled: boolean
}

interface TournamentBracketProps {
  matches: BracketMatch[]
  totalRounds: number
  onMatchClick?: (match: BracketMatch) => void
  compact?: boolean
  liveHighlight?: boolean
  config?: Partial<BracketConfig>
}

// ─── Default Config ───────────────────────────────────────────────────────────

const DEFAULT_CONFIG: BracketConfig = {
  viewMode: 'tree',
  theme: 'dark',
  cardSize: 'md',
  showScores: true,
  showTimers: true,
  showCourts: true,
  showRoundHeaders: true,
  showByes: true,
  animationsEnabled: true,
}

// ─── Theme Definitions ────────────────────────────────────────────────────────

interface ThemeColors {
  cardBg: string
  cardBorder: string
  cardBorderLive: string
  cardBorderCompleted: string
  textPrimary: string
  textSecondary: string
  textMuted: string
  winnerText: string
  winnerBg: string
  scoreWinner: string
  scoreLose: string
  liveBadge: string
  livePulse: string
  roundHeaderBg: string
  roundHeaderText: string
  roundHeaderBorder: string
  connectorLine: string
  pendingOpacity: string
  panelBg: string
  panelBorder: string
  buttonActive: string
  buttonInactive: string
  tableRowLive: string
  tableHeaderBg: string
  tableRowHover: string
  timelineLine: string
  timelineDotLive: string
  timelineDotCompleted: string
  timelineDotPending: string
  tableBorder: string
}

const THEMES: Record<BracketTheme, ThemeColors> = {
  dark: {
    cardBg: 'bg-slate-800/80',
    cardBorder: 'border border-slate-800',
    cardBorderLive: 'border-l-4 border-l-emerald-500 border border-slate-700',
    cardBorderCompleted: 'border border-slate-700',
    textPrimary: 'text-white',
    textSecondary: 'text-slate-300',
    textMuted: 'text-slate-500',
    winnerText: 'text-white font-bold',
    winnerBg: 'bg-slate-700/30',
    scoreWinner: 'text-emerald-400 font-bold',
    scoreLose: 'text-slate-500',
    liveBadge: 'text-emerald-400',
    livePulse: 'bg-emerald-400',
    roundHeaderBg: 'bg-slate-800',
    roundHeaderText: 'text-slate-300',
    roundHeaderBorder: 'border-slate-700',
    connectorLine: '#475569',
    pendingOpacity: 'opacity-60',
    panelBg: 'bg-slate-900 border-slate-700',
    panelBorder: 'border-slate-700',
    buttonActive: 'bg-slate-700 text-white',
    buttonInactive: 'text-slate-400 hover:text-slate-200 hover:bg-slate-800',
    tableRowLive: 'border-l-4 border-l-emerald-500 bg-emerald-950/20',
    tableHeaderBg: 'bg-slate-800/80',
    tableRowHover: 'hover:bg-slate-800/40',
    timelineLine: 'bg-slate-700',
    timelineDotLive: 'bg-emerald-500 ring-4 ring-emerald-500/30',
    timelineDotCompleted: 'bg-slate-500',
    timelineDotPending: 'bg-slate-700 ring-2 ring-slate-600',
    tableBorder: 'border-slate-700/50',
  },
  neon: {
    cardBg: 'bg-slate-900/90',
    cardBorder: 'border border-cyan-900/50',
    cardBorderLive: 'border-l-4 border-l-cyan-400 border border-cyan-800/70 shadow-lg shadow-cyan-500/20',
    cardBorderCompleted: 'border border-cyan-900/40',
    textPrimary: 'text-cyan-50',
    textSecondary: 'text-cyan-200',
    textMuted: 'text-cyan-700',
    winnerText: 'text-cyan-300 font-bold',
    winnerBg: 'bg-cyan-950/40',
    scoreWinner: 'text-cyan-400 font-bold',
    scoreLose: 'text-cyan-800',
    liveBadge: 'text-cyan-400',
    livePulse: 'bg-cyan-400',
    roundHeaderBg: 'bg-cyan-950/60',
    roundHeaderText: 'text-cyan-300',
    roundHeaderBorder: 'border-cyan-800/50',
    connectorLine: '#164e63',
    pendingOpacity: 'opacity-50',
    panelBg: 'bg-slate-950 border-cyan-900/50',
    panelBorder: 'border-cyan-900/50',
    buttonActive: 'bg-cyan-900 text-cyan-300',
    buttonInactive: 'text-cyan-700 hover:text-cyan-400 hover:bg-cyan-950',
    tableRowLive: 'border-l-4 border-l-cyan-400 bg-cyan-950/30 shadow-md shadow-cyan-500/10',
    tableHeaderBg: 'bg-slate-950/80',
    tableRowHover: 'hover:bg-cyan-950/20',
    timelineLine: 'bg-cyan-900/60',
    timelineDotLive: 'bg-cyan-400 ring-4 ring-cyan-400/30 shadow-lg shadow-cyan-400/40',
    timelineDotCompleted: 'bg-cyan-800',
    timelineDotPending: 'bg-slate-800 ring-2 ring-cyan-900/50',
    tableBorder: 'border-cyan-900/40',
  },
  classic: {
    cardBg: 'bg-slate-100',
    cardBorder: 'border border-slate-300',
    cardBorderLive: 'border-l-4 border-l-green-600 border border-slate-300',
    cardBorderCompleted: 'border border-slate-300',
    textPrimary: 'text-slate-900',
    textSecondary: 'text-slate-700',
    textMuted: 'text-slate-400',
    winnerText: 'text-slate-900 font-bold',
    winnerBg: 'bg-slate-200/80',
    scoreWinner: 'text-green-700 font-bold',
    scoreLose: 'text-slate-400',
    liveBadge: 'text-green-700',
    livePulse: 'bg-green-600',
    roundHeaderBg: 'bg-slate-200',
    roundHeaderText: 'text-slate-600',
    roundHeaderBorder: 'border-slate-300',
    connectorLine: '#94a3b8',
    pendingOpacity: 'opacity-50',
    panelBg: 'bg-white border-slate-300',
    panelBorder: 'border-slate-300',
    buttonActive: 'bg-slate-700 text-white',
    buttonInactive: 'text-slate-500 hover:text-slate-700 hover:bg-slate-100',
    tableRowLive: 'border-l-4 border-l-green-600 bg-green-50',
    tableHeaderBg: 'bg-slate-200/80',
    tableRowHover: 'hover:bg-slate-50',
    timelineLine: 'bg-slate-300',
    timelineDotLive: 'bg-green-600 ring-4 ring-green-600/20',
    timelineDotCompleted: 'bg-slate-500',
    timelineDotPending: 'bg-slate-300 ring-2 ring-slate-400',
    tableBorder: 'border-slate-300',
  },
  padel: {
    cardBg: 'bg-green-950/80',
    cardBorder: 'border border-green-900/60',
    cardBorderLive: 'border-l-4 border-l-lime-400 border border-lime-900/60',
    cardBorderCompleted: 'border border-green-800/60',
    textPrimary: 'text-lime-50',
    textSecondary: 'text-lime-200',
    textMuted: 'text-green-600',
    winnerText: 'text-lime-300 font-bold',
    winnerBg: 'bg-lime-950/40',
    scoreWinner: 'text-lime-400 font-bold',
    scoreLose: 'text-green-700',
    liveBadge: 'text-lime-400',
    livePulse: 'bg-lime-400',
    roundHeaderBg: 'bg-green-900/60',
    roundHeaderText: 'text-lime-300',
    roundHeaderBorder: 'border-green-800/50',
    connectorLine: '#166534',
    pendingOpacity: 'opacity-50',
    panelBg: 'bg-green-950 border-green-800/50',
    panelBorder: 'border-green-800/50',
    buttonActive: 'bg-lime-900/60 text-lime-300',
    buttonInactive: 'text-green-600 hover:text-lime-300 hover:bg-green-900/40',
    tableRowLive: 'border-l-4 border-l-lime-400 bg-lime-950/20',
    tableHeaderBg: 'bg-green-900/50',
    tableRowHover: 'hover:bg-green-900/30',
    timelineLine: 'bg-green-800/60',
    timelineDotLive: 'bg-lime-400 ring-4 ring-lime-400/30',
    timelineDotCompleted: 'bg-green-700',
    timelineDotPending: 'bg-green-900 ring-2 ring-green-800',
    tableBorder: 'border-green-800/40',
  },
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatElapsed(startedAt: string): string {
  const start = new Date(startedAt).getTime()
  const now = Date.now()
  const elapsedSeconds = Math.max(0, Math.floor((now - start) / 1000))
  const mm = Math.floor(elapsedSeconds / 60).toString().padStart(2, '0')
  const ss = (elapsedSeconds % 60).toString().padStart(2, '0')
  return `${mm}:${ss}`
}

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  if (h > 0) return `${h}h ${m}m`
  if (m > 0) return `${m}m ${s}s`
  return `${s}s`
}

function formatDateTime(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })
}

interface ParsedSets {
  team1: (number | null)[]
  team2: (number | null)[]
}

function parseSets(match: BracketMatch): ParsedSets {
  return {
    team1: [match.team1_set1, match.team1_set2, match.team1_set3],
    team2: [match.team2_set1, match.team2_set2, match.team2_set3],
  }
}

function getValidSets(match: BracketMatch): Array<{ t1: number; t2: number }> {
  const sets: Array<{ t1: number; t2: number }> = []
  const pairs: Array<[number | null, number | null]> = [
    [match.team1_set1, match.team2_set1],
    [match.team1_set2, match.team2_set2],
    [match.team1_set3, match.team2_set3],
  ]
  for (const [t1, t2] of pairs) {
    if (t1 !== null && t2 !== null) sets.push({ t1, t2 })
  }
  return sets
}

function buildScoreString(
  set1: number | null,
  set2: number | null,
  set3: number | null
): string {
  const parts: string[] = []
  if (set1 !== null) parts.push(String(set1))
  if (set2 !== null) parts.push(String(set2))
  if (set3 !== null) parts.push(String(set3))
  return parts.join(' ')
}

// ─── Live timer hook ──────────────────────────────────────────────────────────

function useLiveTimers(
  matches: BracketMatch[],
  enabled: boolean
): Record<number, string> {
  const [timers, setTimers] = useState<Record<number, string>>({})

  useEffect(() => {
    if (!enabled) return

    const liveMatches = matches.filter(
      (m) => m.status === 'in_progress' && m.started_at
    )
    if (liveMatches.length === 0) return

    const tick = () => {
      const next: Record<number, string> = {}
      for (const m of liveMatches) {
        if (m.started_at) next[m.id] = formatElapsed(m.started_at)
      }
      setTimers(next)
    }

    tick()
    const interval = setInterval(tick, 1000)
    return () => clearInterval(interval)
  }, [matches, enabled])

  return timers
}

// ─── SetPills ─────────────────────────────────────────────────────────────────

interface SetPillsProps {
  match: BracketMatch
  team: 1 | 2
  colors: ThemeColors
}

function SetPills({ match, team, colors }: SetPillsProps) {
  const sets = getValidSets(match)
  if (sets.length === 0) return null

  return (
    <div className="flex gap-0.5 items-center">
      {sets.map((s, i) => {
        const myScore = team === 1 ? s.t1 : s.t2
        const oppScore = team === 1 ? s.t2 : s.t1
        const iWon = myScore > oppScore
        return (
          <span
            key={i}
            className={`
              inline-flex items-center justify-center w-5 h-5 rounded text-[10px] font-mono font-bold
              ${iWon ? colors.scoreWinner + ' bg-slate-700/40' : colors.scoreLose + ' bg-slate-800/20'}
            `}
          >
            {myScore}
          </span>
        )
      })}
    </div>
  )
}

// ─── MatchCard (shared, used in Tree and Cards views) ─────────────────────────

interface MatchCardProps {
  match: BracketMatch
  cfg: BracketConfig
  colors: ThemeColors
  elapsed: string | undefined
  onClick?: () => void
  isLastRound?: boolean
  sizeOverride?: BracketCardSize
}

const CARD_WIDTHS: Record<BracketCardSize, string> = {
  sm: 'w-[160px] min-w-[160px]',
  md: 'w-[200px] min-w-[200px]',
  lg: 'w-[240px] min-w-[240px]',
}

const NAME_MAX_WIDTHS: Record<BracketCardSize, string> = {
  sm: 'max-w-[90px]',
  md: 'max-w-[120px]',
  lg: 'max-w-[155px]',
}

function MatchCard({
  match,
  cfg,
  colors,
  elapsed,
  onClick,
  isLastRound = false,
  sizeOverride,
}: MatchCardProps) {
  const isLive = match.status === 'in_progress'
  const isCompleted = match.status === 'completed'
  const isPending = match.status === 'pending'
  const isBye = match.is_bye

  const team1Won = match.winner_team_id !== null && match.winner_team_id === match.team1_id
  const team2Won = match.winner_team_id !== null && match.winner_team_id === match.team2_id

  const cardSize = sizeOverride ?? cfg.cardSize
  const cardW = CARD_WIDTHS[cardSize]
  const nameMax = NAME_MAX_WIDTHS[cardSize]

  const cardBorderClass = isLive
    ? colors.cardBorderLive
    : isCompleted
    ? colors.cardBorderCompleted
    : colors.cardBorder

  const cardBgClass = colors.cardBg
  const cardCursor = onClick ? 'cursor-pointer' : ''

  const pendingClass = isPending && !isLive ? colors.pendingOpacity : ''

  const isFinal = isLastRound && isCompleted

  return (
    <div className="flex flex-col items-center">
      <div
        className={`
          rounded-lg overflow-hidden ${cardW}
          ${cardBorderClass} ${cardBgClass} ${cardCursor} ${pendingClass}
          transition-all duration-150 hover:brightness-110
        `}
        onClick={onClick}
        role={onClick ? 'button' : undefined}
        tabIndex={onClick ? 0 : undefined}
        onKeyDown={onClick ? (e) => e.key === 'Enter' && onClick() : undefined}
      >
        {/* Team 1 row */}
        <div
          className={`
            flex items-center justify-between px-3 py-2 border-b ${colors.tableBorder}
            ${team1Won ? colors.winnerBg : ''}
          `}
        >
          <div className="flex items-center gap-1.5 min-w-0">
            {isFinal && team1Won && (
              <Trophy className={`w-3 h-3 shrink-0 ${colors.scoreWinner}`} />
            )}
            <span
              className={`
                text-sm truncate ${nameMax}
                ${isBye ? `italic ${colors.textMuted}` : ''}
                ${team1Won ? colors.winnerText : isCompleted ? colors.textMuted : colors.textSecondary}
              `}
            >
              {isBye ? 'BYE' : (match.team1_name ?? 'Por definir')}
            </span>
          </div>
          <div className="flex items-center gap-1 shrink-0 ml-1">
            {!isBye && cfg.showScores && isCompleted && (
              <SetPills match={match} team={1} colors={colors} />
            )}
            {team1Won && (
              <span className={`text-xs ${colors.scoreWinner}`}>✓</span>
            )}
          </div>
        </div>

        {/* Team 2 row */}
        <div
          className={`
            flex items-center justify-between px-3 py-2
            ${team2Won ? colors.winnerBg : ''}
          `}
        >
          <div className="flex items-center gap-1.5 min-w-0">
            {isFinal && team2Won && (
              <Trophy className={`w-3 h-3 shrink-0 ${colors.scoreWinner}`} />
            )}
            <span
              className={`
                text-sm truncate ${nameMax}
                ${isBye ? `italic ${colors.textMuted}` : ''}
                ${team2Won ? colors.winnerText : isCompleted ? colors.textMuted : colors.textSecondary}
              `}
            >
              {isBye ? 'BYE' : (match.team2_name ?? 'Por definir')}
            </span>
          </div>
          <div className="flex items-center gap-1 shrink-0 ml-1">
            {!isBye && cfg.showScores && isCompleted && (
              <SetPills match={match} team={2} colors={colors} />
            )}
            {team2Won && (
              <span className={`text-xs ${colors.scoreWinner}`}>✓</span>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className={`px-3 py-1.5 bg-black/20 flex items-center gap-2 flex-wrap`}>
          {isLive && cfg.showTimers && (
            <span className={`flex items-center gap-1 text-xs font-mono ${colors.liveBadge}`}>
              <span
                className={`
                  inline-block w-1.5 h-1.5 rounded-full ${colors.livePulse}
                  ${cfg.animationsEnabled ? 'animate-pulse' : ''}
                `}
              />
              {elapsed ? elapsed : 'En vivo'}
            </span>
          )}
          {match.court_name && cfg.showCourts && (
            <span className={`text-[10px] ${colors.textMuted} bg-black/30 rounded px-1.5 py-0.5 border ${colors.cardBorder} truncate max-w-full`}>
              {match.court_name}
            </span>
          )}
          {isCompleted && match.duration_seconds && (
            <span className={`text-[10px] ${colors.textMuted}`}>
              {formatDuration(match.duration_seconds)}
            </span>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── SVG Bracket Connectors ───────────────────────────────────────────────────

interface BracketConnectorSVGProps {
  matchCount: number
  cardHeight: number
  gap: number
  color: string
}

/**
 * Draws SVG connector lines between a round column and the next.
 * Connects pairs of matches to their parent match with smooth curves.
 */
function BracketConnectorSVG({
  matchCount,
  cardHeight,
  gap,
  color,
}: BracketConnectorSVGProps) {
  const totalHeight = matchCount * cardHeight + Math.max(0, matchCount - 1) * gap
  const width = 32
  const pairCount = Math.floor(matchCount / 2)

  const paths: string[] = []

  for (let i = 0; i < pairCount; i++) {
    const topMatchIdx = i * 2
    const botMatchIdx = i * 2 + 1

    const topY = topMatchIdx * (cardHeight + gap) + cardHeight / 2
    const botY = botMatchIdx * (cardHeight + gap) + cardHeight / 2
    const midY = (topY + botY) / 2

    // Top match: horizontal line from left, then curve down to mid
    paths.push(`M 0 ${topY} H ${width * 0.4} Q ${width} ${topY} ${width} ${midY}`)
    // Bottom match: horizontal line from left, then curve up to mid
    paths.push(`M 0 ${botY} H ${width * 0.4} Q ${width} ${botY} ${width} ${midY}`)
    // Exit line from midpoint to right
    // (the horizontal connector is drawn as a separate div in the column layout)
  }

  if (paths.length === 0) return null

  return (
    <svg
      width={width}
      height={totalHeight}
      className="shrink-0 self-start"
      style={{ marginTop: 0 }}
    >
      {paths.map((d, i) => (
        <path
          key={i}
          d={d}
          stroke={color}
          strokeWidth={1.5}
          fill="none"
          strokeLinecap="round"
        />
      ))}
    </svg>
  )
}

// ─── Tree View ────────────────────────────────────────────────────────────────

interface TreeViewProps {
  rounds: [number, BracketMatch[]][]
  cfg: BracketConfig
  colors: ThemeColors
  timers: Record<number, string>
  onMatchClick?: (match: BracketMatch) => void
}

function TreeView({ rounds, cfg, colors, timers, onMatchClick }: TreeViewProps) {
  const CARD_HEIGHT = cfg.cardSize === 'sm' ? 90 : cfg.cardSize === 'lg' ? 120 : 106

  return (
    <div className="overflow-x-auto pb-4">
      <div
        className="flex flex-row items-start gap-0 min-w-max px-4 py-2"
      >
        {rounds.map(([roundNumber, roundMatches], colIdx) => {
          const roundName = roundMatches[0]?.round ?? `Ronda ${roundNumber}`
          const isLastRound = colIdx === rounds.length - 1
          const sorted = [...roundMatches].sort((a, b) => a.bracket_position - b.bracket_position)

          const roundIndex = roundNumber - 1
          const gapBetweenCards = Math.pow(2, roundIndex) * CARD_HEIGHT - CARD_HEIGHT
          const topOffset = roundIndex > 0 ? (Math.pow(2, roundIndex) - 1) * (CARD_HEIGHT / 2) : 0

          return (
            <div key={roundNumber} className="flex flex-row items-start">
              {/* SVG connector from previous round — only for rounds > 1 */}
              {colIdx > 0 && (
                <BracketConnectorSVG
                  matchCount={sorted.length}
                  cardHeight={CARD_HEIGHT}
                  gap={gapBetweenCards}
                  color={colors.connectorLine}
                />
              )}

              <div
                className="flex flex-col"
                style={{ marginTop: `${topOffset}px` }}
              >
                {/* Round header */}
                {cfg.showRoundHeaders && (
                  <div
                    className={`
                      mb-4 mx-2 px-3 py-1.5 rounded-full ${colors.roundHeaderBg} border ${colors.roundHeaderBorder}
                      text-xs font-semibold ${colors.roundHeaderText} uppercase tracking-wider text-center whitespace-nowrap
                    `}
                  >
                    {roundName}
                  </div>
                )}

                {/* Matches */}
                <div className="flex flex-col items-center w-full">
                  {sorted.map((match, idx) => {
                    if (!cfg.showByes && match.is_bye) return null
                    return (
                      <div
                        key={match.id}
                        className="flex items-center"
                        style={{
                          marginBottom: idx < sorted.length - 1 ? `${gapBetweenCards}px` : 0,
                        }}
                      >
                        <MatchCard
                          match={match}
                          cfg={cfg}
                          colors={colors}
                          elapsed={timers[match.id]}
                          onClick={onMatchClick ? () => onMatchClick(match) : undefined}
                          isLastRound={isLastRound}
                        />
                        {/* Horizontal connector to SVG */}
                        {!isLastRound && (
                          <div
                            className="h-px min-w-[8px]"
                            style={{ backgroundColor: colors.connectorLine }}
                          />
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Table View ───────────────────────────────────────────────────────────────

interface TableViewProps {
  rounds: [number, BracketMatch[]][]
  cfg: BracketConfig
  colors: ThemeColors
  timers: Record<number, string>
  onMatchClick?: (match: BracketMatch) => void
}

function TableView({ rounds, cfg, colors, timers, onMatchClick }: TableViewProps) {
  const [sortBy, setSortBy] = useState<'round' | 'status'>('round')

  const allMatches = rounds
    .flatMap(([, ms]) => ms)
    .filter((m) => cfg.showByes || !m.is_bye)
    .sort((a, b) => {
      if (sortBy === 'round') return a.round_number - b.round_number || a.bracket_position - b.bracket_position
      const statusOrder: Record<string, number> = { in_progress: 0, completed: 1, pending: 2 }
      return (statusOrder[a.status] ?? 3) - (statusOrder[b.status] ?? 3)
    })

  const thClass = `px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider ${colors.textMuted} cursor-pointer select-none`

  return (
    <div className="overflow-x-auto">
      <table className={`w-full text-sm border-collapse`}>
        <thead>
          <tr className={`${colors.tableHeaderBg}`}>
            <th className={thClass} onClick={() => setSortBy('round')}>
              Ronda {sortBy === 'round' && '↑'}
            </th>
            <th className={`${thClass} text-center`}>#</th>
            <th className={thClass}>Equipo 1</th>
            <th className={`${thClass} text-center`}>Score</th>
            <th className={thClass}>Equipo 2</th>
            {cfg.showCourts && <th className={thClass}>Pista</th>}
            <th className={thClass} onClick={() => setSortBy('status')}>
              Estado {sortBy === 'status' && '↑'}
            </th>
            <th className={thClass}>Duración</th>
          </tr>
        </thead>
        <tbody>
          {allMatches.map((match) => {
            const isLive = match.status === 'in_progress'
            const isCompleted = match.status === 'completed'
            const team1Won = match.winner_team_id !== null && match.winner_team_id === match.team1_id
            const team2Won = match.winner_team_id !== null && match.winner_team_id === match.team2_id
            const sets = getValidSets(match)
            const elapsed = timers[match.id]

            const rowClass = isLive
              ? colors.tableRowLive
              : `border-l-4 border-l-transparent`

            return (
              <tr
                key={match.id}
                className={`
                  ${rowClass} ${colors.tableRowHover}
                  border-b ${colors.tableBorder}
                  ${onMatchClick ? 'cursor-pointer' : ''}
                  ${match.status === 'pending' ? colors.pendingOpacity : ''}
                  transition-colors duration-100
                `}
                onClick={onMatchClick ? () => onMatchClick(match) : undefined}
              >
                <td className={`px-3 py-2 ${colors.textMuted} text-xs whitespace-nowrap`}>
                  {match.round ?? `R${match.round_number}`}
                </td>
                <td className={`px-3 py-2 ${colors.textMuted} text-xs text-center`}>
                  {match.match_number}
                </td>
                <td className={`px-3 py-2 ${team1Won ? colors.winnerText : colors.textSecondary}`}>
                  {match.is_bye ? <span className={`italic ${colors.textMuted}`}>BYE</span> : (match.team1_name ?? '—')}
                  {team1Won && <span className={`ml-1 ${colors.scoreWinner}`}>✓</span>}
                </td>
                <td className="px-3 py-2 text-center">
                  {cfg.showScores && isCompleted && sets.length > 0 && (
                    <div className="flex gap-1 justify-center">
                      {sets.map((s, i) => (
                        <span key={i} className={`text-xs font-mono ${colors.textMuted}`}>
                          {s.t1}-{s.t2}
                        </span>
                      ))}
                    </div>
                  )}
                  {isLive && cfg.showTimers && (
                    <span className={`text-xs font-mono ${colors.liveBadge} flex items-center gap-1 justify-center`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${colors.livePulse} ${cfg.animationsEnabled ? 'animate-pulse' : ''}`} />
                      {elapsed ?? 'En vivo'}
                    </span>
                  )}
                </td>
                <td className={`px-3 py-2 ${team2Won ? colors.winnerText : colors.textSecondary}`}>
                  {match.is_bye ? <span className={`italic ${colors.textMuted}`}>BYE</span> : (match.team2_name ?? '—')}
                  {team2Won && <span className={`ml-1 ${colors.scoreWinner}`}>✓</span>}
                </td>
                {cfg.showCourts && (
                  <td className={`px-3 py-2 text-xs ${colors.textMuted} whitespace-nowrap`}>
                    {match.court_name ?? '—'}
                  </td>
                )}
                <td className="px-3 py-2">
                  {isCompleted && (
                    <span className={`inline-flex items-center gap-1 text-xs ${colors.scoreWinner}`}>
                      <CheckCircle2 className="w-3 h-3" /> Fin
                    </span>
                  )}
                  {isLive && (
                    <span className={`inline-flex items-center gap-1 text-xs ${colors.liveBadge}`}>
                      <Zap className="w-3 h-3" /> Vivo
                    </span>
                  )}
                  {match.status === 'pending' && (
                    <span className={`inline-flex items-center gap-1 text-xs ${colors.textMuted}`}>
                      <Circle className="w-3 h-3" /> Pendiente
                    </span>
                  )}
                </td>
                <td className={`px-3 py-2 text-xs ${colors.textMuted} whitespace-nowrap`}>
                  {match.duration_seconds ? formatDuration(match.duration_seconds) : '—'}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

// ─── Cards View ───────────────────────────────────────────────────────────────

interface CardsViewProps {
  rounds: [number, BracketMatch[]][]
  cfg: BracketConfig
  colors: ThemeColors
  timers: Record<number, string>
  onMatchClick?: (match: BracketMatch) => void
}

function CardsView({ rounds, cfg, colors, timers, onMatchClick }: CardsViewProps) {
  return (
    <div className="space-y-6 px-2">
      {rounds.map(([roundNumber, roundMatches]) => {
        const roundName = roundMatches[0]?.round ?? `Ronda ${roundNumber}`
        const filtered = roundMatches
          .filter((m) => cfg.showByes || !m.is_bye)
          .sort((a, b) => a.bracket_position - b.bracket_position)

        if (filtered.length === 0) return null

        return (
          <div key={roundNumber}>
            {cfg.showRoundHeaders && (
              <div
                className={`
                  inline-block mb-3 px-4 py-1 rounded-full
                  ${colors.roundHeaderBg} border ${colors.roundHeaderBorder}
                  text-xs font-semibold ${colors.roundHeaderText} uppercase tracking-wider
                `}
              >
                {roundName}
              </div>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {filtered.map((match) => (
                <MatchCard
                  key={match.id}
                  match={match}
                  cfg={cfg}
                  colors={colors}
                  elapsed={timers[match.id]}
                  onClick={onMatchClick ? () => onMatchClick(match) : undefined}
                  sizeOverride="lg"
                />
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ─── Compact View ─────────────────────────────────────────────────────────────

interface CompactViewProps {
  rounds: [number, BracketMatch[]][]
  cfg: BracketConfig
  colors: ThemeColors
  timers: Record<number, string>
  onMatchClick?: (match: BracketMatch) => void
}

function CompactView({ rounds, cfg, colors, timers, onMatchClick }: CompactViewProps) {
  const allMatches = rounds
    .flatMap(([, ms]) => ms)
    .filter((m) => cfg.showByes || !m.is_bye)
    .sort((a, b) => a.round_number - b.round_number || a.bracket_position - b.bracket_position)

  return (
    <div className="space-y-0.5 px-1">
      {allMatches.map((match) => {
        const isLive = match.status === 'in_progress'
        const isCompleted = match.status === 'completed'
        const team1Won = match.winner_team_id !== null && match.winner_team_id === match.team1_id
        const team2Won = match.winner_team_id !== null && match.winner_team_id === match.team2_id
        const elapsed = timers[match.id]

        const sets = getValidSets(match)
        const scoreStr = sets.map((s) => `${s.t1}-${s.t2}`).join(' ')

        return (
          <div
            key={match.id}
            className={`
              flex items-center gap-2 px-3 py-1.5 rounded text-sm
              ${isLive ? `${colors.cardBorderLive} ${colors.cardBg}` : `${colors.cardBorder} ${colors.cardBg}`}
              ${match.status === 'pending' ? colors.pendingOpacity : ''}
              ${onMatchClick ? 'cursor-pointer hover:brightness-110' : ''}
              transition-all duration-100
            `}
            onClick={onMatchClick ? () => onMatchClick(match) : undefined}
          >
            {/* Round badge */}
            <span className={`text-[10px] ${colors.textMuted} shrink-0 w-6 text-center`}>
              R{match.round_number}
            </span>

            {/* Team 1 */}
            <span
              className={`
                flex-1 truncate
                ${team1Won ? colors.winnerText : colors.textSecondary}
              `}
            >
              {match.team1_name ?? 'TBD'}
              {team1Won && <span className={`ml-0.5 ${colors.scoreWinner}`}>✓</span>}
            </span>

            {/* Score */}
            {cfg.showScores && isCompleted && scoreStr && (
              <span className={`text-xs font-mono ${colors.textMuted} shrink-0`}>
                {scoreStr}
              </span>
            )}
            {isLive && cfg.showTimers && (
              <span className={`text-xs font-mono ${colors.liveBadge} flex items-center gap-0.5 shrink-0`}>
                <span
                  className={`
                    w-1.5 h-1.5 rounded-full ${colors.livePulse}
                    ${cfg.animationsEnabled ? 'animate-pulse' : ''}
                  `}
                />
                {elapsed ?? ''}
              </span>
            )}

            {/* Team 2 */}
            <span
              className={`
                flex-1 truncate text-right
                ${team2Won ? colors.winnerText : colors.textSecondary}
              `}
            >
              {team2Won && <span className={`mr-0.5 ${colors.scoreWinner}`}>✓</span>}
              {match.team2_name ?? 'TBD'}
            </span>

            {/* Status dot */}
            {isCompleted && <CheckCircle2 className={`w-3 h-3 shrink-0 ${colors.scoreWinner}`} />}
            {isLive && <Zap className={`w-3 h-3 shrink-0 ${colors.liveBadge}`} />}
            {match.status === 'pending' && <Circle className={`w-3 h-3 shrink-0 ${colors.textMuted}`} />}
          </div>
        )
      })}
    </div>
  )
}

// ─── Timeline View ────────────────────────────────────────────────────────────

interface TimelineViewProps {
  rounds: [number, BracketMatch[]][]
  cfg: BracketConfig
  colors: ThemeColors
  timers: Record<number, string>
  onMatchClick?: (match: BracketMatch) => void
}

function TimelineView({ rounds, cfg, colors, timers, onMatchClick }: TimelineViewProps) {
  const allMatches = rounds
    .flatMap(([, ms]) => ms)
    .filter((m) => cfg.showByes || !m.is_bye)

  // Chronological sort: completed first, then live, then pending
  const statusOrder: Record<string, number> = { completed: 0, in_progress: 1, pending: 2 }
  const sorted = [...allMatches].sort((a, b) => {
    const so = (statusOrder[a.status] ?? 3) - (statusOrder[b.status] ?? 3)
    if (so !== 0) return so
    if (a.started_at && b.started_at) return new Date(a.started_at).getTime() - new Date(b.started_at).getTime()
    return a.round_number - b.round_number || a.bracket_position - b.bracket_position
  })

  return (
    <div className="relative px-4 py-2">
      {/* Center line */}
      <div
        className={`absolute left-1/2 top-0 bottom-0 w-0.5 ${colors.timelineLine} -translate-x-1/2`}
        aria-hidden
      />

      <div className="space-y-6">
        {sorted.map((match, idx) => {
          const isLive = match.status === 'in_progress'
          const isCompleted = match.status === 'completed'
          const isPending = match.status === 'pending'
          const team1Won = match.winner_team_id !== null && match.winner_team_id === match.team1_id
          const team2Won = match.winner_team_id !== null && match.winner_team_id === match.team2_id
          const elapsed = timers[match.id]
          const isLeft = idx % 2 === 0
          const sets = getValidSets(match)

          const dotClass = isLive
            ? colors.timelineDotLive
            : isCompleted
            ? colors.timelineDotCompleted
            : colors.timelineDotPending

          return (
            <div key={match.id} className="relative flex items-start">
              {/* Left side card */}
              <div className={`w-[calc(50%-20px)] ${isLeft ? 'pr-3' : ''}`}>
                {isLeft && (
                  <TimelineCard
                    match={match}
                    cfg={cfg}
                    colors={colors}
                    elapsed={elapsed}
                    team1Won={team1Won}
                    team2Won={team2Won}
                    sets={sets}
                    onClick={onMatchClick ? () => onMatchClick(match) : undefined}
                    align="right"
                  />
                )}
              </div>

              {/* Center dot */}
              <div className="relative z-10 flex items-center justify-center w-10 shrink-0">
                <div
                  className={`
                    w-3 h-3 rounded-full ${dotClass}
                    ${isLive && cfg.animationsEnabled ? 'animate-pulse' : ''}
                  `}
                />
              </div>

              {/* Right side card */}
              <div className={`w-[calc(50%-20px)] ${!isLeft ? 'pl-3' : ''}`}>
                {!isLeft && (
                  <TimelineCard
                    match={match}
                    cfg={cfg}
                    colors={colors}
                    elapsed={elapsed}
                    team1Won={team1Won}
                    team2Won={team2Won}
                    sets={sets}
                    onClick={onMatchClick ? () => onMatchClick(match) : undefined}
                    align="left"
                  />
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

interface TimelineCardProps {
  match: BracketMatch
  cfg: BracketConfig
  colors: ThemeColors
  elapsed: string | undefined
  team1Won: boolean
  team2Won: boolean
  sets: Array<{ t1: number; t2: number }>
  onClick?: () => void
  align: 'left' | 'right'
}

function TimelineCard({
  match,
  cfg,
  colors,
  elapsed,
  team1Won,
  team2Won,
  sets,
  onClick,
  align,
}: TimelineCardProps) {
  const isLive = match.status === 'in_progress'
  const isCompleted = match.status === 'completed'
  const textAlign = align === 'right' ? 'text-right' : 'text-left'

  return (
    <div
      className={`
        rounded-lg p-3 ${colors.cardBg}
        ${isLive ? colors.cardBorderLive : isCompleted ? colors.cardBorderCompleted : colors.cardBorder}
        ${match.status === 'pending' ? colors.pendingOpacity : ''}
        ${onClick ? 'cursor-pointer hover:brightness-110' : ''}
        transition-all duration-100
      `}
      onClick={onClick}
    >
      {/* Round + match info */}
      <div className={`flex items-center gap-1 mb-1 ${align === 'right' ? 'justify-end' : 'justify-start'}`}>
        <span className={`text-[10px] uppercase tracking-wider font-semibold ${colors.textMuted}`}>
          {match.round ?? `R${match.round_number}`} · P{match.match_number}
        </span>
        {isLive && (
          <span
            className={`
              inline-block w-1.5 h-1.5 rounded-full ${colors.livePulse}
              ${cfg.animationsEnabled ? 'animate-pulse' : ''}
            `}
          />
        )}
        {isCompleted && <CheckCircle2 className={`w-3 h-3 ${colors.scoreWinner}`} />}
      </div>

      {/* Teams */}
      <div className={`space-y-0.5 ${textAlign}`}>
        <div className={`text-sm ${team1Won ? colors.winnerText : colors.textSecondary} truncate`}>
          {match.team1_name ?? 'Por definir'}
          {team1Won && <span className={`ml-1 ${colors.scoreWinner}`}>✓</span>}
        </div>
        <div className={`text-sm ${team2Won ? colors.winnerText : colors.textSecondary} truncate`}>
          {match.team2_name ?? 'Por definir'}
          {team2Won && <span className={`ml-1 ${colors.scoreWinner}`}>✓</span>}
        </div>
      </div>

      {/* Score sets */}
      {cfg.showScores && isCompleted && sets.length > 0 && (
        <div className={`flex gap-1 mt-1.5 ${align === 'right' ? 'justify-end' : 'justify-start'}`}>
          {sets.map((s, i) => (
            <span key={i} className={`text-[10px] font-mono ${colors.textMuted}`}>
              {s.t1}-{s.t2}
            </span>
          ))}
        </div>
      )}

      {/* Footer */}
      <div className={`flex flex-wrap gap-2 mt-1.5 ${align === 'right' ? 'justify-end' : 'justify-start'}`}>
        {isLive && cfg.showTimers && (
          <span className={`text-xs font-mono ${colors.liveBadge}`}>
            {elapsed ?? 'En vivo'}
          </span>
        )}
        {match.started_at && (
          <span className={`text-[10px] ${colors.textMuted}`}>
            {formatDateTime(match.started_at)}
          </span>
        )}
        {match.court_name && cfg.showCourts && (
          <span className={`text-[10px] ${colors.textMuted}`}>{match.court_name}</span>
        )}
        {match.duration_seconds && (
          <span className={`text-[10px] ${colors.textMuted}`}>
            {formatDuration(match.duration_seconds)}
          </span>
        )}
      </div>
    </div>
  )
}

// ─── BracketConfigPanel ───────────────────────────────────────────────────────

interface BracketConfigPanelProps {
  config: BracketConfig
  onChange: (config: BracketConfig) => void
}

interface ViewModeOption {
  mode: BracketViewMode
  label: string
  icon: React.ReactNode
}

export function BracketConfigPanel({ config, onChange }: BracketConfigPanelProps) {
  const [open, setOpen] = useState(false)
  const colors = THEMES[config.theme]

  const set = useCallback(
    <K extends keyof BracketConfig>(key: K, value: BracketConfig[K]) => {
      onChange({ ...config, [key]: value })
    },
    [config, onChange]
  )

  const viewModes: ViewModeOption[] = [
    { mode: 'tree', label: 'Árbol', icon: <GitBranch className="w-4 h-4" /> },
    { mode: 'table', label: 'Tabla', icon: <Table className="w-4 h-4" /> },
    { mode: 'cards', label: 'Tarjetas', icon: <LayoutGrid className="w-4 h-4" /> },
    { mode: 'compact', label: 'Compacto', icon: <List className="w-4 h-4" /> },
    { mode: 'timeline', label: 'Línea de tiempo', icon: <Clock className="w-4 h-4" /> },
  ]

  const themeColors: Record<BracketTheme, string> = {
    dark: 'bg-slate-700 ring-slate-400',
    neon: 'bg-cyan-600 ring-cyan-400',
    classic: 'bg-slate-300 ring-slate-500',
    padel: 'bg-lime-600 ring-lime-400',
  }

  const ToggleSwitch = ({
    value,
    onToggle,
    label,
  }: {
    value: boolean
    onToggle: () => void
    label: string
  }) => (
    <label className="flex items-center gap-2 cursor-pointer select-none">
      <button
        type="button"
        onClick={onToggle}
        className={`
          relative inline-flex h-5 w-9 rounded-full transition-colors duration-200
          ${value ? 'bg-emerald-500' : 'bg-slate-600'}
        `}
        aria-pressed={value}
      >
        <span
          className={`
            inline-block w-3.5 h-3.5 rounded-full bg-white shadow transform transition-transform duration-200 mt-[3px]
            ${value ? 'translate-x-[18px]' : 'translate-x-[3px]'}
          `}
        />
      </button>
      <span className={`text-xs ${colors.textSecondary}`}>{label}</span>
    </label>
  )

  return (
    <div className={`rounded-xl border ${colors.panelBg} mb-4`}>
      {/* Header bar — always visible */}
      <div className="flex items-center gap-3 px-4 py-2 flex-wrap">
        {/* View mode buttons */}
        <div className="flex items-center gap-1 rounded-lg bg-black/20 p-1">
          {viewModes.map(({ mode, label, icon }) => (
            <button
              key={mode}
              type="button"
              title={label}
              onClick={() => set('viewMode', mode)}
              className={`
                flex items-center gap-1 px-2 py-1 rounded text-xs font-medium transition-all duration-150
                ${config.viewMode === mode ? colors.buttonActive : colors.buttonInactive}
              `}
            >
              {icon}
              <span className="hidden sm:inline">{label}</span>
            </button>
          ))}
        </div>

        {/* Theme selector */}
        <div className="flex items-center gap-1.5">
          {(Object.keys(themeColors) as BracketTheme[]).map((t) => (
            <button
              key={t}
              type="button"
              title={t}
              onClick={() => set('theme', t)}
              className={`
                w-5 h-5 rounded-full ${themeColors[t]}
                ${config.theme === t ? 'ring-2 ring-offset-1 ring-offset-slate-900' : 'opacity-60 hover:opacity-100'}
                transition-all duration-150
              `}
            />
          ))}
        </div>

        {/* Card size */}
        <div className="flex items-center gap-0.5 rounded-lg bg-black/20 p-1">
          {(['sm', 'md', 'lg'] as BracketCardSize[]).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => set('cardSize', s)}
              className={`
                px-2 py-0.5 rounded text-xs font-bold uppercase transition-all duration-150
                ${config.cardSize === s ? colors.buttonActive : colors.buttonInactive}
              `}
            >
              {s}
            </button>
          ))}
        </div>

        {/* Gear to expand */}
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className={`
            ml-auto flex items-center gap-1 px-2 py-1 rounded text-xs transition-all
            ${open ? colors.buttonActive : colors.buttonInactive}
          `}
          title="Más opciones"
        >
          <Settings className={`w-3.5 h-3.5 ${open ? 'rotate-45' : ''} transition-transform duration-200`} />
          <span className="hidden sm:inline">Opciones</span>
        </button>
      </div>

      {/* Expanded panel */}
      {open && (
        <div className={`px-4 py-3 border-t ${colors.panelBorder} flex flex-wrap gap-4`}>
          <ToggleSwitch
            value={config.showScores}
            onToggle={() => set('showScores', !config.showScores)}
            label="Scores"
          />
          <ToggleSwitch
            value={config.showTimers}
            onToggle={() => set('showTimers', !config.showTimers)}
            label="Timers"
          />
          <ToggleSwitch
            value={config.showCourts}
            onToggle={() => set('showCourts', !config.showCourts)}
            label="Pistas"
          />
          <ToggleSwitch
            value={config.showRoundHeaders}
            onToggle={() => set('showRoundHeaders', !config.showRoundHeaders)}
            label="Encabezados de ronda"
          />
          <ToggleSwitch
            value={config.showByes}
            onToggle={() => set('showByes', !config.showByes)}
            label="BYEs"
          />
          <ToggleSwitch
            value={config.animationsEnabled}
            onToggle={() => set('animationsEnabled', !config.animationsEnabled)}
            label="Animaciones"
          />
        </div>
      )}
    </div>
  )
}

// ─── TournamentBracket (main export) ─────────────────────────────────────────

export function TournamentBracket({
  matches,
  totalRounds,
  onMatchClick,
  compact = false,
  liveHighlight = true,
  config: configProp,
}: TournamentBracketProps) {
  // Merge defaults with prop overrides
  const resolvedConfig: BracketConfig = {
    ...DEFAULT_CONFIG,
    ...configProp,
    // backwards compat: compact prop forces compact view
    viewMode: compact ? 'compact' : (configProp?.viewMode ?? DEFAULT_CONFIG.viewMode),
  }

  const timers = useLiveTimers(matches, liveHighlight && resolvedConfig.animationsEnabled)
  const colors = THEMES[resolvedConfig.theme]

  // Group matches by round_number
  const roundsMap = new Map<number, BracketMatch[]>()
  for (const match of matches) {
    const rn = match.round_number
    if (!roundsMap.has(rn)) roundsMap.set(rn, [])
    roundsMap.get(rn)!.push(match)
  }

  const rounds = Array.from(roundsMap.entries()).sort(([a], [b]) => a - b)

  if (rounds.length === 0) {
    return (
      <div className={`flex items-center justify-center py-16 ${colors.textMuted} text-sm`}>
        Sin partidos para mostrar.
      </div>
    )
  }

  const sharedProps = {
    rounds,
    cfg: resolvedConfig,
    colors,
    timers,
    onMatchClick,
  }

  return (
    <div>
      {resolvedConfig.viewMode === 'tree' && <TreeView {...sharedProps} />}
      {resolvedConfig.viewMode === 'table' && <TableView {...sharedProps} />}
      {resolvedConfig.viewMode === 'cards' && <CardsView {...sharedProps} />}
      {resolvedConfig.viewMode === 'compact' && <CompactView {...sharedProps} />}
      {resolvedConfig.viewMode === 'timeline' && <TimelineView {...sharedProps} />}
    </div>
  )
}

export default TournamentBracket
