// The rugby commentator's storyline layer — deterministic colour captions
// planted into quiet bridge play. Same discipline as the soccer storyline:
// captions are goal-invalidated (a premise that a later score breaks is never
// shown after that score), collision-checked against every scheduled overlay
// window, and silently dropped rather than delayed. Silence beats stale drama.

import { seedFromKey } from '../sim/prng'
import type { RugbyMatchEvent, RugbyMatchResult } from '../sim/rugbyTypes'
import type { Side } from '../sim/types'
import type { RugbyMoment } from './rugbyDirector'

export interface RugbyBridgeSlot {
  t: number // render seconds the bridge starts
  dur: number
  simStart: number // sim seconds the bridge covers
  simEnd: number
}

export interface RugbyBlockedWindow {
  t: number
  dur: number
}

const STORY_DUR = 2.4
const MAX_STORY = 4
const MIN_GAP_SIM = 8 * 60
const BLOCK_MARGIN = 0.35

interface Candidate {
  id: string
  priority: number
  team: Side | null
  labels: readonly string[]
  afterSim: number // earliest sim-second it may display
  beforeSim: number // deadline — the premise goes stale past this
}

const SCORE_TYPES = new Set(['try', 'penaltyGoal', 'dropGoal'])

function opp(s: Side): Side {
  return s === 'home' ? 'away' : 'home'
}

function abbrOf(m: RugbyMatchResult, side: Side | null): string {
  if (!side) return ''
  return side === 'home' ? m.config.home.abbr : m.config.away.abbr
}

/** First scoring event at/after fromSim (by minute), else Infinity. */
function nextScoreSim(scores: RugbyMatchEvent[], fromSim: number): number {
  for (const g of scores) {
    if (g.minute * 60 >= fromSim) return g.minute * 60
  }
  return Infinity
}

function possessionShare(m: RugbyMatchResult, side: Side, s0: number, s1: number): number {
  let mine = 0
  let total = 0
  for (const p of m.possessions) {
    const a = Math.max(p.start, s0)
    const b = Math.min(p.end, s1)
    if (b <= a) continue
    total += b - a
    if (p.team === side) mine += b - a
  }
  return total > 0 ? mine / total : 0.5
}

export function buildRugbyStoryMoments(
  m: RugbyMatchResult,
  bridges: RugbyBridgeSlot[],
  blocked: RugbyBlockedWindow[] = [],
): RugbyMoment[] {
  const scores = m.events.filter((e) => SCORE_TYPES.has(e.type))
  const matchEnd = m.possessions.length ? m.possessions[m.possessions.length - 1].end : 80 * 60
  const cands: Candidate[] = []

  // --- red card: do the 14 dig in, or do the 15 smell blood? ---
  const red = m.events.find((e) => e.type === 'red' && e.team)
  if (red && red.minute <= 70) {
    const windowEvents = m.events.filter(
      (e) => e.minute > red.minute && e.minute <= red.minute + 10 && e.team,
    )
    const sign = red.team === 'home' ? 1 : -1
    const holding =
      windowEvents.length === 0 ||
      windowEvents.reduce((s, e) => s + e.momentumAfter, 0) * sign >= 0
    cands.push({
      id: 'red',
      priority: 5,
      team: holding ? (red.team as Side) : opp(red.team as Side),
      labels: holding
        ? ['DOWN TO 14 — {ABBR} DIG IN', '14 MEN, ALL HEART']
        : ['{ABBR} SMELL BLOOD', '{ABBR} CIRCLE THE 14 MEN'],
      afterSim: (red.minute + 3) * 60,
      beforeSim: matchEnd,
    })
  }

  // --- the leveller: scores level late — game on ---
  const leveller = [...scores]
    .reverse()
    .find((e) => e.minute >= 50 && e.scoreAfter[0] === e.scoreAfter[1])
  if (leveller && leveller.team) {
    const trailedBig = m.events.some((e) => {
      if (e.id >= leveller.id) return false
      const diff =
        leveller.team === 'home' ? e.scoreAfter[0] - e.scoreAfter[1] : e.scoreAfter[1] - e.scoreAfter[0]
      return diff <= -10
    })
    // deadline by EVENT ID, not minute — same fuzz-found lesson as soccer
    const nextAfter = scores.filter((g) => g.id > leveller.id)
    cands.push({
      id: 'level',
      priority: 4,
      team: leveller.team,
      labels: trailedBig
        ? ['{ABBR} BACK FROM THE DEAD', '{ABBR} REFUSE TO GO AWAY']
        : ['ALL SQUARE — GAME ON', '{ABBR} BACK LEVEL — GAME ON'],
      afterSim: leveller.minute * 60 + 60,
      beforeSim: nextScoreSim(nextAfter, 0),
    })
  }

  // --- late drama: within one score with ten to play — but only when the
  // closeness is EARNED (recent scores or chances), never a caption promising
  // drama in a match that died at half-time (same gate the soccer layer has)
  const at70 = [...m.events].reverse().find((e) => e.minute <= 70)
  if (at70) {
    const diff = Math.abs(at70.scoreAfter[0] - at70.scoreAfter[1])
    const lateScores = scores.filter((e) => e.minute > 55 && e.minute <= 70).length
    const lateChances = m.events.filter(
      (e) => (e.type === 'break' || e.type === 'penalty') && e.minute > 55 && e.minute <= 70,
    ).length
    if (diff > 0 && diff <= 7 && (lateScores >= 1 || lateChances >= 2)) {
      cands.push({
        id: 'late',
        priority: 3,
        team: null,
        labels: ['ONE SCORE IN IT — LATE ON', 'TEN MINUTES TO SETTLE IT', 'NERVES ON BOTH BENCHES'],
        afterSim: 70 * 60,
        beforeSim: Math.min(78 * 60, nextScoreSim(scores, 70 * 60)),
      })
    }
  }

  // --- pressure without a try: all territory, no reward ---
  for (const side of ['home', 'away'] as const) {
    const share = possessionShare(m, side, 0, 55 * 60)
    const chances = m.events.filter(
      (e) => e.team === side && (e.type === 'break' || e.type === 'penalty') && e.minute <= 55,
    ).length
    const triesBy55 = m.events.filter(
      (e) => e.team === side && e.type === 'try' && e.minute <= 55,
    ).length
    if (share >= 0.58 && chances >= 4 && triesBy55 === 0) {
      const sideTries = m.events.filter((e) => e.team === side && e.type === 'try')
      cands.push({
        id: 'dominant',
        priority: 2,
        team: side,
        labels: ['ALL {ABBR} — BUT NO TRY', '{ABBR} KNOCKING, NO ANSWER', 'PRESSURE, BUT NO PAYOFF'],
        afterSim: 55 * 60,
        beforeSim: Math.min(70 * 60, nextScoreSim(sideTries, 55 * 60)),
      })
      break // at most one side can be dominant
    }
  }

  // --- an early blitz: one side is 14+ up inside the first half hour ---
  const blitz = scores.find((e) => {
    const diff = e.scoreAfter[0] - e.scoreAfter[1]
    return e.minute <= 30 && Math.abs(diff) >= 14
  })
  if (blitz) {
    const leader: Side = blitz.scoreAfter[0] > blitz.scoreAfter[1] ? 'home' : 'away'
    const trailScores = scores.filter((e) => e.id > blitz.id && e.team === opp(leader))
    cands.push({
      id: 'blitz',
      priority: 2,
      team: leader,
      labels: ['{ABBR} OUT OF THE BLOCKS', '{ABBR} FLYING EARLY', 'A BLITZ FROM {ABBR}'],
      afterSim: (blitz.minute + 2) * 60,
      beforeSim: Math.min(55 * 60, nextScoreSim(trailScores, 0)),
    })
  }

  // --- the character of the game itself: arm wrestle or points fest ---
  const at50 = [...m.events].reverse().find((e) => e.minute <= 50)
  if (at50) {
    const total = at50.scoreAfter[0] + at50.scoreAfter[1]
    if (total <= 12) {
      cands.push({
        id: 'grind',
        priority: 1,
        team: null,
        labels: ['A PROPER ARM WRESTLE', 'DEFENCES ON TOP', 'INCHES, NOT METRES'],
        afterSim: 50 * 60,
        beforeSim: Math.min(70 * 60, nextScoreSim(scores, 50 * 60)),
      })
    } else if (total >= 40) {
      cands.push({
        id: 'shootout',
        priority: 1,
        team: null,
        labels: ['POINTS EVERYWHERE', 'NO DEFENCE IN SIGHT', 'TRIES ON TAP TODAY'],
        afterSim: 50 * 60,
        beforeSim: 75 * 60,
      })
    }
  }

  // --- placement: highest priority first, never colliding, never stale ---
  cands.sort((a, b) => b.priority - a.priority)
  const placed: RugbyMoment[] = []
  const placedSim: number[] = []
  const placedWindows: RugbyBlockedWindow[] = [...blocked]
  const usedBridges = new Set<number>()
  const collides = (t0: number, t1: number): boolean =>
    placedWindows.some((w) => t0 < w.t + w.dur + BLOCK_MARGIN && w.t - BLOCK_MARGIN < t1)

  for (const c of cands) {
    if (placed.length >= MAX_STORY) break
    for (let bi = 0; bi < bridges.length; bi++) {
      if (usedBridges.has(bi)) continue
      const b = bridges[bi]
      // rugby's featured load leaves shorter bridges than soccer's — 1.2s is
      // still enough for the caption to land (collision check guards overlap)
      if (b.dur < 1.2) continue
      if (b.simStart < c.afterSim || b.simStart >= c.beforeSim) continue
      if (placedSim.some((s) => Math.abs(s - b.simStart) < MIN_GAP_SIM)) continue
      // rugby's featured moments spill into bridge openings far more than
      // soccer's, so try a few anchor points WITHIN the same bridge — the
      // premise stays valid (same sim window), the caption just slides past
      // the fading overlay. Never delayed to a later bridge.
      let t = -1
      for (const off of [0.2, b.dur * 0.4, b.dur * 0.75]) {
        const cand = b.t + Math.max(0.2, off)
        if (!collides(cand, cand + STORY_DUR)) {
          t = cand
          break
        }
      }
      if (t < 0) continue
      const variant = seedFromKey(`${m.config.seedKey}:story:${c.id}`) % c.labels.length
      placed.push({
        t,
        dur: STORY_DUR,
        kind: 'story',
        team: c.team,
        minute: Math.min(80, Math.floor(b.simStart / 60)),
        label: c.labels[variant].replace('{ABBR}', abbrOf(m, c.team)),
      })
      usedBridges.add(bi)
      placedSim.push(b.simStart)
      placedWindows.push({ t, dur: STORY_DUR })
      break
    }
  }
  return placed
}
