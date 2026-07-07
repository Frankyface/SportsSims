import { makeRng, seedFromKey } from './prng'
import {
  SIM_VERSION,
  type MatchConfig,
  type MatchEvent,
  type MatchResult,
  type MatchStats,
  type Side,
} from './types'

// --- Tunable constants (calibrated against real football; see research-findings §2) ---
const MATCH_SECONDS = 90 * 60
const POSSESSION_MIN = 10 // seconds
const POSSESSION_VAR = 26 // seconds of random extra
const BASE_SHOT = 0.11 // base P(a possession becomes a shot) — tuned for ~13 shots/team
const FOUL_RATE = 0.055
const MOMENTUM_GAIN = 0.35 // how strongly momentum tilts shot odds
const COMEBACK = 0.7 // trailing-team rubber-band strength

function clamp(x: number, lo: number, hi: number): number {
  return x < lo ? lo : x > hi ? hi : x
}

/**
 * Pure, deterministic soccer match simulation.
 * Given a config (with a stable seedKey), always returns the same MatchResult.
 * The ONLY randomness comes from the seeded PRNG — no Date.now / Math.random /
 * transcendental math, so it re-runs identically anywhere.
 */
export function simulateMatch(config: MatchConfig): MatchResult {
  const rng = makeRng(config.seedKey)
  const { home, away, homeAdvantage } = config

  const score: [number, number] = [0, 0]
  let momentum = 0
  let eventId = 0
  const events: MatchEvent[] = []

  // hidden per-match "form of the day" — lets an underdog genuinely have a great day
  const formHome = 0.85 + rng() * 0.3
  const formAway = 0.85 + rng() * 0.3

  const stats: MatchStats = {
    possession: [0, 0],
    shots: [0, 0],
    shotsOnTarget: [0, 0],
    xg: [0, 0],
    fouls: [0, 0],
    yellow: [0, 0],
    red: [0, 0],
  }

  const push = (
    minute: number,
    e: Partial<MatchEvent> & { type: MatchEvent['type']; team: Side | null },
  ): void => {
    events.push({
      id: eventId++,
      minute,
      scoreAfter: [score[0], score[1]],
      momentumAfter: momentum,
      ...e,
    } as MatchEvent)
  }

  push(0, { type: 'kickoff', team: null, label: 'Kick-off' })

  let clock = 0
  let halftimeDone = false
  let possHome = 0
  let possAway = 0

  while (clock < MATCH_SECONDS) {
    clock += POSSESSION_MIN + Math.floor(rng() * POSSESSION_VAR)
    const minute = clamp(Math.floor(clock / 60), 0, 90)

    if (!halftimeDone && clock >= MATCH_SECONDS / 2) {
      push(45, { type: 'halftime', team: null, label: 'Half-time' })
      halftimeDone = true
    }

    // 1) who has this possession — attack-weighted, home tilt, momentum
    const wHome = home.attack * homeAdvantage * formHome * (1 + 0.15 * momentum)
    const wAway = away.attack * formAway * (1 - 0.15 * momentum)
    const isHome = rng() < wHome / (wHome + wAway)
    const side: Side = isHome ? 'home' : 'away'
    const idx = isHome ? 0 : 1
    if (isHome) possHome++
    else possAway++

    const atk = isHome ? home : away
    const def = isHome ? away : home
    const form = isHome ? formHome : formAway
    const momForSide = isHome ? momentum : -momentum

    // 2) foul (and the occasional card)
    if (rng() < FOUL_RATE) {
      stats.fouls[idx]++
      push(minute, { type: 'foul', team: side })
      const cardRoll = rng()
      if (cardRoll < 0.18 / def.discipline) {
        const oppIdx = isHome ? 1 : 0
        const oppSide: Side = isHome ? 'away' : 'home'
        if (cardRoll < 0.02 / def.discipline) {
          stats.red[oppIdx]++
          push(minute, { type: 'red', team: oppSide, label: 'Red card' })
        } else {
          stats.yellow[oppIdx]++
          push(minute, { type: 'yellow', team: oppSide, label: 'Yellow card' })
        }
      }
      continue
    }

    // 3) does the possession create a shot?
    const pShot = clamp(
      BASE_SHOT * (atk.attack / def.defense) * form * (1 + MOMENTUM_GAIN * momForSide),
      0.03,
      0.3,
    )
    if (rng() >= pShot) {
      momentum = clamp(momentum * 0.9 + (isHome ? 0.03 : -0.03), -1, 1)
      continue
    }

    // 4) chance quality -> TRUE expected-goals value (mean ~0.11/shot, so summed xG tracks goals).
    // q is a bell-ish 0..1 quality (avg of 3 uniforms); cubed skews most chances low, a few high.
    const q = (rng() + rng() + rng()) / 3
    const xg = clamp(0.02 + q * q * q * 0.55 * atk.finishing, 0.02, 0.9)
    const goal = rng() < xg
    const onTarget = goal || rng() < 0.28 + 0.5 * xg
    stats.shots[idx]++
    stats.xg[idx] += xg
    if (onTarget) stats.shotsOnTarget[idx]++

    const shotXY: [number, number] = [
      isHome ? 0.6 + rng() * 0.38 : 0.02 + rng() * 0.38,
      0.2 + rng() * 0.6,
    ]

    if (goal) {
      score[idx]++
      momentum = clamp((isHome ? 0.6 : -0.6) + momentum * 0.3, -1, 1)
      push(minute, { type: 'goal', team: side, xg, onTarget: true, shotXY, label: `GOAL — ${atk.name}` })
    } else if (xg > 0.35) {
      momentum = clamp(momentum * 0.85 + (isHome ? 0.05 : -0.05), -1, 1)
      push(minute, { type: 'bigChance', team: side, xg, onTarget, shotXY, label: 'Big chance!' })
    } else {
      momentum = clamp(momentum * 0.85 + (isHome ? 0.04 : -0.04), -1, 1)
      push(minute, { type: onTarget ? 'save' : 'miss', team: side, xg, onTarget, shotXY })
    }

    // rubber-band toward the trailing team -> manufactures comebacks / late drama
    const lead = score[0] - score[1]
    momentum = clamp(momentum - COMEBACK * 0.02 * lead, -1, 1)
  }

  const totalPoss = possHome + possAway || 1
  stats.possession = [
    Math.round((possHome / totalPoss) * 100),
    Math.round((possAway / totalPoss) * 100),
  ]

  push(90, { type: 'fulltime', team: null, label: 'Full-time' })

  return {
    simVersion: SIM_VERSION,
    config,
    score,
    events,
    stats,
    renderSeed: seedFromKey(config.seedKey) ^ 0x9e3779b9,
  }
}
