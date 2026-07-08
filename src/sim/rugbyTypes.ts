import type { Side, TeamRating } from './types'

/**
 * Rugby union sim data model — the Bastion Championships engine.
 *
 * Mirrors the soccer model (types.ts) but is deliberately its OWN module:
 * multi-sport isolation means the rugby sim can evolve without ever touching
 * the frozen soccer stream. TeamRating and Side are shared shapes (sport-
 * agnostic identity + strength multipliers), imported as types only.
 *
 * RUGBY_SIM_VERSION is rugby's own counter (soccer's SIM_VERSION stays
 * soccer-only). Bump it when the rugby sim math changes; version 1's
 * score-deciding RNG stream is frozen by rugbyScoreCompat.test.ts from
 * the first shipped build.
 */
export const RUGBY_SIM_VERSION = 1

export interface RugbyMatchConfig {
  seedKey: string // stable, e.g. `rugby-friendly:${homeId}:${awayId}:${gen}`
  home: TeamRating
  away: TeamRating
  homeAdvantage: number // e.g. 1.1
}

export type RugbyEventType =
  | 'kickoff'
  | 'try' // 5 points; followed immediately (id+1) by its conversion event
  | 'conversion' // +2, made
  | 'conversionMiss'
  | 'penalty' // the award; may be followed (id+1) by a card, then the resolution
  | 'penaltyGoal' // +3
  | 'penaltyMiss'
  | 'dropGoal' // +3
  | 'dropMiss'
  | 'break' // line break / lineout drive held up — drama, no points
  | 'yellow' // sin-bin: 10 sim-minutes shorthanded, then the player returns
  | 'red' // permanent
  | 'halftime'
  | 'fulltime'

/**
 * Event id conventions (frozen, relied on by the rugby choreographer):
 * - a 'try' event is ALWAYS followed at id+1 by 'conversion' | 'conversionMiss'
 * - a 'penalty' award may be followed at id+1 by 'yellow' | 'red'; the
 *   resolution event ('penaltyGoal'/'penaltyMiss'/'try'/'break', if any)
 *   comes directly after the card (or directly after the award if no card)
 */
export interface RugbyMatchEvent {
  id: number
  minute: number // 0..80
  type: RugbyEventType
  team: Side | null
  scoreAfter: [number, number] // [home, away] points snapshot at this event
  momentumAfter: number // -1 (away pressure) .. +1 (home pressure)
  /**
   * Normalized pitch position in formation space: x across the width (0..1),
   * y down the length (0..1) with HOME ATTACKING TOP (y=0), away the mirror.
   * Tries sit on the try line (y 0|1); kicks at goal store the kick spot.
   */
  xy?: [number, number]
  label?: string
}

export interface RugbyPossessionSpan {
  team: Side
  start: number // match-clock seconds at possession start
  end: number // match-clock seconds when the possession resolves
  outcome: 'try' | 'penalty' | 'break' | 'drop' | 'turnover'
  eventId?: number // the PRIMARY event of the span (try / penalty award / break / drop)
  /**
   * For 'penalty' spans: the id of the resolution event this award produced
   * ('penaltyGoal'/'penaltyMiss' from the tee, or 'try'/'break' off the
   * corner lineout), if any. Explicit so the choreographer never has to guess
   * whether a following event belongs to this award or the next possession.
   */
  resEventId?: number
}

export interface RugbyMatchStats {
  possession: [number, number] // %
  tries: [number, number]
  conversions: [number, number] // made only
  penaltyGoals: [number, number]
  dropGoals: [number, number]
  breaks: [number, number] // line breaks + drives held up
  penaltiesConceded: [number, number]
  yellow: [number, number]
  red: [number, number]
}

export interface RugbyMatchResult {
  simVersion: number
  config: RugbyMatchConfig
  score: [number, number] // points
  events: RugbyMatchEvent[]
  stats: RugbyMatchStats
  possessions: RugbyPossessionSpan[] // contiguous spans covering the whole match
  renderSeed: number // separate stream for cosmetic-only render randomness
}
