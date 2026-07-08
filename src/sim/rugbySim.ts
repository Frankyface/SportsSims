import { makeRng, seedFromKey, randNormal } from './prng'
import type { Side } from './types'
import {
  RUGBY_SIM_VERSION,
  type RugbyMatchConfig,
  type RugbyMatchEvent,
  type RugbyMatchResult,
  type RugbyMatchStats,
  type RugbyPossessionSpan,
} from './rugbyTypes'

// --- Tunable constants (calibrated against real club rugby union: ~47 total
// points, ~5.5 tries, ~4 penalty goals, ~75% conversions, draws rare) ---
const MATCH_SECONDS = 80 * 60
const POSSESSION_MIN = 18 // seconds — a possession is a series of phases
const POSSESSION_VAR = 55 // seconds of random extra (avg possession ~45s)
const BASE_TRY = 0.041 // base P(an open-play possession ends in a try)
const BREAK_FACTOR = 0.95 // line-break band relative to pTry (drama, no points)
const DROP_RATE = 0.0035 // P(a possession ends in a drop-goal attempt)
const DROP_SUCCESS = 0.45
const PEN_RATE = 0.095 // P(the defence concedes a kickable penalty)
const PEN_KICK_CHOICE = 0.52 // P(the award is shot at goal vs kicked to the corner)
const CORNER_TRY = 0.33 // lineout drive over the line
const CORNER_BREAK = 0.6 // ...or held up just short (break band above CORNER_TRY)
const MOMENTUM_GAIN = 0.35 // how strongly momentum tilts try odds
const COMEBACK = 0.7 // trailing-team rubber-band strength (lead is in POINTS)
const SIN_BIN_SECONDS = 10 * 60
// A card hurts: 14 men keep less ball, score less, and leak more. Yellows are
// temporary (sin bin), reds permanent — both use the same multipliers.
const SHORT_POSSESSION = 0.85
const SHORT_ATTACK = 0.82
const SHORT_DEFENSE = 0.85
const SHORT_TRY_BOOST = 1.12 // chances against 14 men are better chances

function clamp(x: number, lo: number, hi: number): number {
  return x < lo ? lo : x > hi ? hi : x
}

/**
 * Pure, deterministic rugby union match simulation (Bastion Championships).
 * Given a config (with a stable seedKey), always returns the same
 * RugbyMatchResult. The ONLY randomness comes from the seeded PRNG — no
 * Date.now / Math.random / transcendental math, so it re-runs identically
 * anywhere. The rng() draw ORDER below is frozen (rugbyScoreCompat.test.ts).
 */
export function simulateRugbyMatch(config: RugbyMatchConfig): RugbyMatchResult {
  const rng = makeRng(config.seedKey)
  const { home, away, homeAdvantage } = config

  const score: [number, number] = [0, 0]
  let momentum = 0
  let eventId = 0
  const events: RugbyMatchEvent[] = []

  // hidden per-match "form of the day" — same mechanism as the soccer engine:
  // a seeded normal draw scaled by Glicko-RD-derived formSpread, so uncertain
  // teams swing more and upsets happen without rigging.
  const formHome = clamp(1 + randNormal(rng) * home.formSpread, 0.55, 1.45)
  const formAway = clamp(1 + randNormal(rng) * away.formSpread, 0.55, 1.45)

  const stats: RugbyMatchStats = {
    possession: [0, 0],
    tries: [0, 0],
    conversions: [0, 0],
    penaltyGoals: [0, 0],
    dropGoals: [0, 0],
    breaks: [0, 0],
    penaltiesConceded: [0, 0],
    yellow: [0, 0],
    red: [0, 0],
  }

  const push = (
    minute: number,
    e: Partial<RugbyMatchEvent> & { type: RugbyMatchEvent['type']; team: Side | null },
  ): number => {
    const id = eventId++
    events.push({
      id,
      minute,
      scoreAfter: [score[0], score[1]],
      momentumAfter: momentum,
      ...e,
    } as RugbyMatchEvent)
    return id
  }

  push(0, { type: 'kickoff', team: null, label: 'Kick-off' })

  let clock = 0
  let halftimeDone = false
  let possHome = 0
  let possAway = 0
  const redOff: [boolean, boolean] = [false, false]
  const sinBinUntil: [number, number] = [0, 0]
  const possessions: RugbyPossessionSpan[] = []

  const isShort = (i: 0 | 1): boolean => redOff[i] || clock < sinBinUntil[i]

  // Try + conversion, shared by open play and the lineout drive.
  // Draw order (frozen): tryX, then the conversion roll.
  const scoreTry = (side: Side, minute: number): number => {
    const idx = side === 'home' ? 0 : 1
    const atk = side === 'home' ? home : away
    const tryX = 0.08 + 0.84 * rng()
    score[idx] += 5
    stats.tries[idx]++
    momentum = clamp((side === 'home' ? 0.55 : -0.55) + momentum * 0.3, -1, 1)
    const tryId = push(minute, {
      type: 'try',
      team: side,
      xy: [tryX, side === 'home' ? 0 : 1],
      label: `TRY — ${atk.name}`,
    })
    // conversion from in line with the grounding: central tries are gimmes,
    // corner flags are coin flips; the kicker's boot (finishing) nudges it
    const central = 1 - (tryX < 0.5 ? 0.5 - tryX : tryX - 0.5) * 2
    const pConv = clamp((0.55 + 0.34 * central) * (0.85 + 0.15 * atk.finishing), 0.35, 0.96)
    if (rng() < pConv) {
      score[idx] += 2
      stats.conversions[idx]++
      push(minute, { type: 'conversion', team: side, xy: [tryX, side === 'home' ? 0 : 1] })
    } else {
      push(minute, { type: 'conversionMiss', team: side, xy: [tryX, side === 'home' ? 0 : 1] })
    }
    return tryId
  }

  while (clock < MATCH_SECONDS) {
    const spanStart = clock
    clock += POSSESSION_MIN + Math.floor(rng() * POSSESSION_VAR)
    const minute = clamp(Math.floor(clock / 60), 0, 80)

    if (!halftimeDone && clock >= MATCH_SECONDS / 2) {
      push(40, { type: 'halftime', team: null, label: 'Half-time' })
      halftimeDone = true
    }

    // 1) who has this possession — attack-weighted, home tilt, momentum;
    // 14 men see less of the ball
    const wHome =
      home.attack * homeAdvantage * formHome * (1 + 0.15 * momentum) * (isShort(0) ? SHORT_POSSESSION : 1)
    const wAway =
      away.attack * formAway * (1 - 0.15 * momentum) * (isShort(1) ? SHORT_POSSESSION : 1)
    const isHome = rng() < wHome / (wHome + wAway)
    const side: Side = isHome ? 'home' : 'away'
    const idx = isHome ? 0 : 1
    const oppIdx = isHome ? 1 : 0
    const oppSide: Side = isHome ? 'away' : 'home'
    if (isHome) possHome++
    else possAway++

    const atk = isHome ? home : away
    const def = isHome ? away : home
    const form = isHome ? formHome : formAway
    const momForSide = isHome ? momentum : -momentum

    // 2) does the defence concede a penalty? (award, occasional card, then
    // the attacking side's choice: posts or corner)
    if (rng() < PEN_RATE / def.discipline) {
      stats.penaltiesConceded[oppIdx]++
      momentum = clamp(momentum * 0.9 + (isHome ? 0.05 : -0.05), -1, 1)
      const penId = push(minute, { type: 'penalty', team: side, label: 'Penalty' })
      let resEventId: number | undefined

      const cardRoll = rng()
      if (cardRoll < 0.13 / def.discipline) {
        if (cardRoll < 0.007 / def.discipline) {
          stats.red[oppIdx]++
          redOff[oppIdx] = true
          push(minute, { type: 'red', team: oppSide, label: 'Red card' })
        } else {
          stats.yellow[oppIdx]++
          sinBinUntil[oppIdx] = clock + SIN_BIN_SECONDS
          push(minute, { type: 'yellow', team: oppSide, label: 'Sin bin' })
        }
      }

      if (rng() < PEN_KICK_CHOICE) {
        // shot at goal from the mark
        const kx = 0.2 + 0.6 * rng()
        const kyRaw = 0.12 + 0.18 * rng()
        const ky = isHome ? kyRaw : 1 - kyRaw
        const pKick = clamp(0.62 + 0.15 * atk.finishing, 0.55, 0.9)
        if (rng() < pKick) {
          score[idx] += 3
          stats.penaltyGoals[idx]++
          momentum = clamp(momentum * 0.75 + (isHome ? 0.18 : -0.18), -1, 1)
          resEventId = push(minute, {
            type: 'penaltyGoal',
            team: side,
            xy: [kx, ky],
            label: `PENALTY GOAL — ${atk.name}`,
          })
          const lead = score[0] - score[1]
          momentum = clamp(momentum - COMEBACK * 0.004 * lead, -1, 1)
        } else {
          resEventId = push(minute, { type: 'penaltyMiss', team: side, xy: [kx, ky] })
        }
      } else {
        // kicked to the corner — lineout drive at the line
        const driveRoll = rng()
        if (driveRoll < CORNER_TRY) {
          resEventId = scoreTry(side, minute)
          const lead = score[0] - score[1]
          momentum = clamp(momentum - COMEBACK * 0.004 * lead, -1, 1)
        } else if (driveRoll < CORNER_BREAK) {
          stats.breaks[idx]++
          const bx = 0.15 + 0.7 * rng()
          const byRaw = 0.02 + 0.08 * rng()
          momentum = clamp(momentum * 0.85 + (isHome ? 0.06 : -0.06), -1, 1)
          resEventId = push(minute, {
            type: 'break',
            team: side,
            xy: [bx, isHome ? byRaw : 1 - byRaw],
            label: 'Held up over the line!',
          })
        }
      }
      possessions.push({ team: side, start: spanStart, end: clock, outcome: 'penalty', eventId: penId, resEventId })
      continue
    }

    // 3) open play — try / line break / drop-goal attempt / turnover,
    // one outcome roll against stacked probability bands
    const atkFac = isShort(idx) ? SHORT_ATTACK : 1
    const defFac = isShort(oppIdx) ? SHORT_DEFENSE : 1
    const tryBoost = isShort(oppIdx) ? SHORT_TRY_BOOST : 1
    const pTry = clamp(
      BASE_TRY * ((atk.attack * atkFac) / (def.defense * defFac)) * form * (1 + MOMENTUM_GAIN * momForSide) * tryBoost,
      0.008,
      0.16,
    )
    const pBreak = pTry * BREAK_FACTOR
    const outcomeRoll = rng()

    if (outcomeRoll < pTry) {
      const tryId = scoreTry(side, minute)
      possessions.push({ team: side, start: spanStart, end: clock, outcome: 'try', eventId: tryId })
      const lead = score[0] - score[1]
      momentum = clamp(momentum - COMEBACK * 0.004 * lead, -1, 1)
    } else if (outcomeRoll < pTry + pBreak) {
      stats.breaks[idx]++
      const bx = 0.15 + 0.7 * rng()
      const byRaw = 0.18 + 0.3 * rng()
      momentum = clamp(momentum * 0.85 + (isHome ? 0.06 : -0.06), -1, 1)
      const breakId = push(minute, {
        type: 'break',
        team: side,
        xy: [bx, isHome ? byRaw : 1 - byRaw],
        label: 'Line break!',
      })
      possessions.push({ team: side, start: spanStart, end: clock, outcome: 'break', eventId: breakId })
    } else if (outcomeRoll < pTry + pBreak + DROP_RATE) {
      const dx = 0.3 + 0.4 * rng()
      const dyRaw = 0.16 + 0.2 * rng()
      const dxy: [number, number] = [dx, isHome ? dyRaw : 1 - dyRaw]
      let dropId: number
      if (rng() < DROP_SUCCESS) {
        score[idx] += 3
        stats.dropGoals[idx]++
        momentum = clamp(momentum * 0.75 + (isHome ? 0.12 : -0.12), -1, 1)
        dropId = push(minute, { type: 'dropGoal', team: side, xy: dxy, label: `DROP GOAL — ${atk.name}` })
        const lead = score[0] - score[1]
        momentum = clamp(momentum - COMEBACK * 0.004 * lead, -1, 1)
      } else {
        dropId = push(minute, { type: 'dropMiss', team: side, xy: dxy })
      }
      possessions.push({ team: side, start: spanStart, end: clock, outcome: 'drop', eventId: dropId })
    } else {
      momentum = clamp(momentum * 0.9 + (isHome ? 0.03 : -0.03), -1, 1)
      possessions.push({ team: side, start: spanStart, end: clock, outcome: 'turnover' })
    }
  }

  const totalPoss = possHome + possAway || 1
  stats.possession = [
    Math.round((possHome / totalPoss) * 100),
    Math.round((possAway / totalPoss) * 100),
  ]

  push(80, { type: 'fulltime', team: null, label: 'Full-time' })

  return {
    simVersion: RUGBY_SIM_VERSION,
    config,
    score,
    events,
    stats,
    possessions,
    renderSeed: seedFromKey(config.seedKey) ^ 0x9e3779b9,
  }
}
