'use client'

import { useEffect, useState } from 'react'

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

interface TournamentBracketProps {
  matches: BracketMatch[]
  totalRounds: number
  onMatchClick?: (match: BracketMatch) => void
  compact?: boolean
  liveHighlight?: boolean
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
  liveHighlight: boolean
): Record<number, string> {
  const [timers, setTimers] = useState<Record<number, string>>({})

  useEffect(() => {
    if (!liveHighlight) return

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
  }, [matches, liveHighlight])

  return timers
}

// ─── MatchCard ────────────────────────────────────────────────────────────────

interface MatchCardProps {
  match: BracketMatch
  compact: boolean
  liveHighlight: boolean
  elapsed: string | undefined
  onClick?: () => void
  isLast: boolean
}

function MatchCard({
  match,
  compact,
  liveHighlight,
  elapsed,
  onClick,
  isLast,
}: MatchCardProps) {
  const isLive = match.status === 'in_progress'
  const isCompleted = match.status === 'completed'
  const isPending = match.status === 'pending'
  const isBye = match.is_bye

  const team1Won = match.winner_team_id !== null && match.winner_team_id === match.team1_id
  const team2Won = match.winner_team_id !== null && match.winner_team_id === match.team2_id

  const score1 = buildScoreString(match.team1_set1, match.team1_set2, match.team1_set3)
  const score2 = buildScoreString(match.team2_set1, match.team2_set2, match.team2_set3)

  const cardBorder = isLive && liveHighlight
    ? 'border-l-4 border-l-emerald-500 border border-slate-700'
    : isCompleted
    ? 'border border-slate-700'
    : 'border border-slate-800'

  const cardBg = isLive && liveHighlight
    ? 'bg-slate-800/90'
    : isPending
    ? 'bg-slate-900/60'
    : 'bg-slate-800/80'

  const cardCursor = onClick ? 'cursor-pointer hover:border-slate-500 transition-colors' : ''

  return (
    <div className="flex flex-col items-center">
      {/* Match card */}
      <div
        className={`
          rounded-lg overflow-hidden w-[180px] min-w-[180px]
          ${cardBorder} ${cardBg} ${cardCursor}
          ${isPending ? 'opacity-60' : ''}
        `}
        onClick={onClick}
        role={onClick ? 'button' : undefined}
        tabIndex={onClick ? 0 : undefined}
        onKeyDown={onClick ? (e) => e.key === 'Enter' && onClick() : undefined}
      >
        {/* Team 1 row */}
        <div
          className={`
            flex items-center justify-between px-3 py-2 border-b border-slate-700/60
            ${team1Won ? 'bg-slate-700/30' : ''}
          `}
        >
          <span
            className={`
              text-sm truncate max-w-[110px]
              ${isBye ? 'italic text-slate-500' : ''}
              ${team1Won ? 'font-bold text-white' : isCompleted ? 'text-slate-400' : 'text-slate-300'}
            `}
          >
            {isBye ? 'BYE' : (match.team1_name ?? 'Por definir')}
          </span>
          {!isBye && isCompleted && score1 && (
            <span
              className={`text-xs font-mono ml-1 shrink-0 ${team1Won ? 'text-emerald-400 font-bold' : 'text-slate-500'}`}
            >
              {score1}
            </span>
          )}
          {team1Won && (
            <span className="ml-1 text-emerald-400 text-xs shrink-0">✓</span>
          )}
        </div>

        {/* Team 2 row */}
        <div
          className={`
            flex items-center justify-between px-3 py-2
            ${team2Won ? 'bg-slate-700/30' : ''}
          `}
        >
          <span
            className={`
              text-sm truncate max-w-[110px]
              ${isBye ? 'italic text-slate-500' : ''}
              ${team2Won ? 'font-bold text-white' : isCompleted ? 'text-slate-400' : 'text-slate-300'}
            `}
          >
            {isBye ? 'BYE' : (match.team2_name ?? 'Por definir')}
          </span>
          {!isBye && isCompleted && score2 && (
            <span
              className={`text-xs font-mono ml-1 shrink-0 ${team2Won ? 'text-emerald-400 font-bold' : 'text-slate-500'}`}
            >
              {score2}
            </span>
          )}
          {team2Won && (
            <span className="ml-1 text-emerald-400 text-xs shrink-0">✓</span>
          )}
        </div>

        {/* Footer: live badge + timer, or court */}
        {!compact && (
          <div className="px-3 py-1.5 bg-slate-900/40 flex items-center gap-2 flex-wrap">
            {isLive && liveHighlight && (
              <span className="flex items-center gap-1 text-xs text-emerald-400 font-mono">
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                {elapsed ? `⏱ ${elapsed}` : 'En vivo'}
              </span>
            )}
            {match.court_name && (
              <span className="text-[10px] text-slate-500 bg-slate-800 rounded px-1.5 py-0.5 border border-slate-700 truncate max-w-full">
                {match.court_name}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Connector line going right — drawn between pairs of matches */}
      {/* Handled at the round-column level via wrappers */}
    </div>
  )
}

// ─── RoundColumn ─────────────────────────────────────────────────────────────

interface RoundColumnProps {
  roundName: string
  matches: BracketMatch[]
  compact: boolean
  liveHighlight: boolean
  timers: Record<number, string>
  onMatchClick?: (match: BracketMatch) => void
  isLastRound: boolean
}

/**
 * Renders one column of matches.
 * The vertical spacing grows exponentially per round to align with the bracket
 * tree: round 1 has spacing=0, round 2 has spacing=1 card-height gap between
 * pairs, etc.
 *
 * spacing = (2^(roundIndex) - 1) * CARD_HEIGHT
 * where CARD_HEIGHT ~ 108px (2 rows × ~44px + footer ~20px).
 */
function RoundColumn({
  roundName,
  matches,
  compact,
  liveHighlight,
  timers,
  onMatchClick,
  isLastRound,
}: RoundColumnProps) {
  // Sort by bracket_position
  const sorted = [...matches].sort((a, b) => a.bracket_position - b.bracket_position)

  const CARD_HEIGHT = compact ? 88 : 108 // px approximation for gap calculation
  const roundIndex = matches[0]?.round_number ? matches[0].round_number - 1 : 0
  const gapBetweenCards = Math.pow(2, roundIndex) * CARD_HEIGHT - CARD_HEIGHT

  return (
    <div className="flex flex-col items-center min-w-[200px] w-[220px]">
      {/* Round header */}
      <div className="mb-4 px-3 py-1.5 rounded-full bg-slate-800 border border-slate-700 text-xs font-semibold text-slate-300 uppercase tracking-wider text-center whitespace-nowrap">
        {roundName}
      </div>

      {/* Matches with growing gaps */}
      <div className="flex flex-col items-center w-full relative">
        {sorted.map((match, idx) => (
          <div
            key={match.id}
            className="flex items-center w-full"
            style={{
              marginBottom: idx < sorted.length - 1 ? `${gapBetweenCards}px` : 0,
            }}
          >
            {/* Match card */}
            <MatchCard
              match={match}
              compact={compact}
              liveHighlight={liveHighlight}
              elapsed={timers[match.id]}
              onClick={onMatchClick ? () => onMatchClick(match) : undefined}
              isLast={isLastRound}
            />

            {/* Horizontal connector line to next round */}
            {!isLastRound && (
              <div className="flex-1 h-px bg-slate-600 min-w-[24px]" />
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── BracketConnectors (vertical lines between rounds) ───────────────────────

/**
 * Renders vertical bracket connectors between two columns.
 * Uses a flex column with absolute/relative lines matching the match positions.
 *
 * For a clean bracket look, we draw pairs of matches connected with an
 * L-shaped connector: two horizontal lines + one vertical line joining them.
 *
 * This component is placed between two RoundColumn elements.
 */

// ─── TournamentBracket (main export) ─────────────────────────────────────────

export function TournamentBracket({
  matches,
  totalRounds,
  onMatchClick,
  compact = false,
  liveHighlight = true,
}: TournamentBracketProps) {
  const timers = useLiveTimers(matches, liveHighlight)

  // Group matches by round_number
  const roundsMap = new Map<number, BracketMatch[]>()
  for (const match of matches) {
    const rn = match.round_number
    if (!roundsMap.has(rn)) roundsMap.set(rn, [])
    roundsMap.get(rn)!.push(match)
  }

  // Sort rounds ascending
  const rounds = Array.from(roundsMap.entries()).sort(([a], [b]) => a - b)

  if (rounds.length === 0) {
    return (
      <div className="flex items-center justify-center py-16 text-slate-500 text-sm">
        Sin partidos para mostrar.
      </div>
    )
  }

  const CARD_HEIGHT = compact ? 88 : 108

  return (
    <div className="overflow-x-auto pb-4">
      <div
        className="flex flex-row items-start gap-0 min-w-max px-4"
        style={{ paddingTop: '8px', paddingBottom: '8px' }}
      >
        {rounds.map(([roundNumber, roundMatches], colIdx) => {
          const roundName = roundMatches[0]?.round ?? `Ronda ${roundNumber}`
          const isLastRound = colIdx === rounds.length - 1

          // Count of matches in this round for vertical centering offset
          const matchCount = roundMatches.length
          const prevMatchCount = colIdx > 0 ? rounds[colIdx - 1][1].length : matchCount

          // Vertical offset so rounds align to bracket center
          const roundIndex = roundNumber - 1
          const topOffset = roundIndex > 0 ? (Math.pow(2, roundIndex) - 1) * (CARD_HEIGHT / 2) : 0

          return (
            <div
              key={roundNumber}
              className="flex flex-col"
              style={{ marginTop: `${topOffset}px` }}
            >
              <RoundColumn
                roundName={roundName}
                matches={roundMatches}
                compact={compact}
                liveHighlight={liveHighlight}
                timers={timers}
                onMatchClick={onMatchClick}
                isLastRound={isLastRound}
              />
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default TournamentBracket
