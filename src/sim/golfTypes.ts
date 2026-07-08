// Golf sim data model — The Apex Tour engine.
//
// Mirrors the soccer/rugby models but is deliberately its OWN module: golf is
// the third sport and the first INDIVIDUAL one, so instead of home/away teams
// the sim takes a FIELD of eight golfers in two groups of four and produces a
// shot-by-shot round over nine holes plus a running leaderboard.
//
// GOLF_SIM_VERSION is golf's own counter. Bump it when the golf sim math
// changes; version 1's score-deciding RNG stream is frozen by
// golfScoreCompat.test.ts from the first shipped build.

export const GOLF_SIM_VERSION = 1

/** Eight golfers, two groups of four: indices 0..3 tee first, 4..7 after. */
export const FIELD_SIZE = 8
export const GROUP_SIZE = 4
export const HOLES_PER_ROUND = 9

/** The playing-strength view of a golfer that the sim consumes (see golfStrength.ts). */
export interface GolferRating {
  id: string // immutable — never renumber
  name: string
  abbr: string
  color: string
  colorAlt: string
  skill: number // ~ -1 (tour floor) .. +1 (world class), mean ~0
  riskTilt: number // style: + aggressive (birdies AND blow-ups), - conservative
  clutch: number // -1..+1 final-round pressure response (drawn at tour creation)
  formSpread: number // per-round performance variance (from Glicko RD)
}

export type GolfEnv =
  | 'coast'
  | 'alpine'
  | 'lakeside'
  | 'forest'
  | 'heath'
  | 'desert'
  | 'parkland'
  | 'links'
  | 'tropical'
  | 'quarry'
  | 'canyon'
  | 'moor'
  | 'frost'
  | 'cliffs'

export interface GolfHoleDef {
  par: 3 | 4 | 5
  /** How much trouble lurks: 0 (open) .. 1 (target golf over water/canyon). */
  hazard: number
  /** Field scoring difficulty: -1 (birdie hole) .. +1 (card-wrecker). */
  difficulty: number
  /** Water in play on this hole (vs dry hazards only) — drives visuals + penalty kind. */
  water: boolean
}

export interface GolfCourseDef {
  id: string
  name: string
  env: GolfEnv
  par: number // sum of holes' pars
  holes: GolfHoleDef[] // HOLES_PER_ROUND entries
}

export interface GolfRoundConfig {
  seedKey: string // stable, e.g. `${tourSeed}:e3:r2`
  course: GolfCourseDef
  /**
   * The field IN GROUP ORDER: golfers[0..3] are group one (out first),
   * golfers[4..7] the featured final group (round 2+ = the leaders).
   */
  golfers: GolferRating[]
  round: number // 1..4
  /** Tournament score to par entering the round, aligned with `golfers`. Zeros in round 1. */
  startToPar: number[]
}

export type GolfLie = 'tee' | 'fairway' | 'rough' | 'bunker' | 'green' | 'holed'
export type GolfShotKind = 'drive' | 'approach' | 'chip' | 'putt' | 'recovery' | 'penaltyDrop'

/**
 * One shot. Positions are in normalized HOLE coordinates: y runs 0 (tee) to 1
 * (pin), x is lateral offset -1 (far left) .. +1 (far right), 0 the centreline.
 * The renderer maps these onto the drawn fairway, so the sim never knows pixels.
 */
export interface GolfShot {
  golfer: number // index into config.golfers
  hole: number // 0-based
  shotNo: number // 1-based, includes penalty strokes in the count shown
  kind: GolfShotKind
  from: [number, number]
  to: [number, number]
  fromLie: GolfLie
  toLie: GolfLie
  /** Execution quality 0 (chunked) .. 1 (flushed) — drama fuel for the director. */
  quality: number
  /** This shot ended in the hole. */
  holed: boolean
  /** This shot found water / went OB and cost a penalty stroke. */
  penalty: boolean
}

export type GolfEventType =
  | 'ace' // hole-in-one
  | 'eagle'
  | 'birdie'
  | 'bogey'
  | 'double' // double bogey or worse
  | 'splash' // ball in the water
  | 'longPutt' // holed from way out (par or better)
  | 'leadChange' // new outright leader after a hole completes
  | 'winner' // round 4 only: the tournament is decided

export interface GolfEvent {
  id: number
  type: GolfEventType
  hole: number // 0-based hole it happened on
  golfer: number | null // null for leadChange resolution edge cases
  /** Tournament to-par AFTER this hole for the golfer (or the new leader). */
  toParAfter: number
}

export interface GolfRoundResult {
  simVersion: number
  config: GolfRoundConfig
  /** strokes[golfer][hole] */
  strokes: number[][]
  /** shots in STAGING ORDER: hole-by-hole, group one then group two within each hole */
  shots: GolfShot[]
  /** round score to par per golfer */
  roundToPar: number[]
  /** tournament score to par per golfer after this round (startToPar + roundToPar) */
  totalToPar: number[]
  /** golfer indices sorted best-to-worst on totalToPar (ties: lower index first) */
  leaderboard: number[]
  events: GolfEvent[]
  renderSeed: number // separate stream for cosmetic-only render randomness
}
