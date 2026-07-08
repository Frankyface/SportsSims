// Data model for a single simulated match.
// Keep this pure & serializable — a MatchResult is what gets saved and re-rendered.

/**
 * Bump when the sim math changes so old saved matches re-render on the version that produced them.
 * v3: records possession spans for the continuous-play renderer. The score-deciding RNG stream is
 * call-for-call identical to v2 (guarded by scoreCompat.test.ts), so saved league scores still re-sim
 * byte-identically — v3 is additive, not a replay break.
 */
export const SIM_VERSION = 3

export interface TeamRating {
  id: string          // immutable — never renumber (fandom depends on stable identity)
  name: string
  abbr: string
  city: string
  color: string       // primary brand color
  colorAlt: string    // secondary / kit color
  attack: number      // multipliers ~0.8..1.25, mean ~1.0
  defense: number
  finishing: number
  discipline: number
  formSpread: number  // per-match performance variance (from Glicko RD); higher = more upset-prone
}

export interface MatchConfig {
  seedKey: string        // stable, e.g. `${leagueId}:${season}:${round}:${matchId}`
  home: TeamRating
  away: TeamRating
  homeAdvantage: number  // e.g. 1.1
}

export type Side = 'home' | 'away'

export type EventType =
  | 'kickoff'
  | 'shot'
  | 'goal'
  | 'save'
  | 'miss'
  | 'bigChance'
  | 'foul'
  | 'yellow'
  | 'red'
  | 'halftime'
  | 'fulltime'

export interface MatchEvent {
  id: number
  minute: number
  type: EventType
  team: Side | null
  xg?: number
  onTarget?: boolean
  scoreAfter: [number, number]  // [home, away] snapshot at this event
  momentumAfter: number         // -1 (away pressure) .. +1 (home pressure)
  shotXY?: [number, number]     // normalized 0..1 pitch coordinates
  label?: string
}

/**
 * One sim possession: the ball with one team for a span of match-clock seconds,
 * ending in a shot, a foul, or a turnover. Recorded from values the sim already
 * computes (no extra randomness) so the choreographer can stage continuous play.
 */
export interface PossessionSpan {
  team: Side
  start: number // match-clock seconds at possession start
  end: number   // match-clock seconds when the possession resolves (next span starts here)
  outcome: 'shot' | 'foul' | 'turnover'
  eventId?: number // the shot-outcome or foul event this possession produced
}

export interface MatchStats {
  possession: [number, number]
  shots: [number, number]
  shotsOnTarget: [number, number]
  xg: [number, number]
  fouls: [number, number]
  yellow: [number, number]
  red: [number, number]
}

export interface MatchResult {
  simVersion: number
  config: MatchConfig
  score: [number, number]
  events: MatchEvent[]
  stats: MatchStats
  possessions: PossessionSpan[] // contiguous spans covering the whole match
  renderSeed: number  // separate stream for cosmetic-only render randomness
}
