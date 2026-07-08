// Storyline captions — the "commentator" layer of the continuous-play engine.
// Reads the finished match's event list and plants at most a handful of
// broadcast-voice lower-thirds into quiet bridge play: pressure runs, comeback
// context, late drama, dominance-without-a-goal irony, red-card response.
//
// Everything is planned once, deterministically, from the MatchResult — the
// only "randomness" is a hash of the seedKey picking a label variant, so the
// same match always shows identical captions. Captions are the LOWEST overlay
// priority: they are dropped, never delayed, when real drama claims the slot.

import { seedFromKey } from '../sim/prng'
import type { MatchEvent, MatchResult, Side } from '../sim/types'
import type { Moment } from './director'

/** A bridge passage's slice of the render timeline (director hands these over). */
export interface BridgeSlot {
  t: number // render seconds the bridge starts
  dur: number
  simStart: number // sim seconds the bridge covers
  simEnd: number
}

const STORY_DUR = 2.4
const MAX_STORY = 4
const MIN_GAP_SIM = 8 * 60 // storyline captions keep 8+ sim-minutes apart
const HALF_SEC = 45 * 60

interface Candidate {
  id: string
  priority: number // higher schedules first
  team: Side | null
  labels: readonly string[]
  afterSim: number // earliest sim-second it may display
  beforeSim: number // deadline — premise goes stale past this (usually the next goal)
}

function opp(s: Side): Side {
  return s === 'home' ? 'away' : 'home'
}

function abbrOf(m: MatchResult, side: Side | null): string {
  if (!side) return ''
  return side === 'home' ? m.config.home.abbr : m.config.away.abbr
}

/** Sim-second of the first goal at or after `fromSim`, else Infinity. */
function nextGoalSim(goals: MatchEvent[], fromSim: number): number {
  for (const g of goals) {
    if (g.minute * 60 >= fromSim) return g.minute * 60
  }
  return Infinity
}

/** Possession share for `side` across sim window [s0, s1). */
function possessionShare(m: MatchResult, side: Side, s0: number, s1: number): number {
  let mine = 0
  let all = 0
  for (const p of m.possessions) {
    if (p.start >= s1 || p.end <= s0) continue
    const o = Math.min(s1, p.end) - Math.max(s0, p.start)
    all += o
    if (p.team === side) mine += o
  }
  return all > 0 ? mine / all : 0.5
}

function collectCandidates(m: MatchResult): Candidate[] {
  const events = m.events
  const goals = events.filter((e) => e.type === 'goal')
  const chances = events.filter(
    (e) => e.type === 'bigChance' || e.type === 'save' || e.type === 'miss',
  )
  const matchEnd = m.possessions.length ? m.possessions[m.possessions.length - 1].end : 90 * 60
  const cands: Candidate[] = []

  // --- red card response: do the ten men hold, or does the pack circle? ---
  const red = events.find((e) => e.type === 'red' && e.minute <= 80)
  if (red && red.team) {
    const window = events.filter((e) => e.minute > red.minute && e.minute <= red.minute + 10)
    let mean = 0
    for (const e of window) mean += e.momentumAfter
    mean = window.length ? mean / window.length : 0
    const holding = window.length === 0 || (red.team === 'home' ? mean >= 0 : mean <= 0)
    cands.push({
      id: 'red',
      priority: 5,
      team: holding ? red.team : opp(red.team),
      labels: holding
        ? ['DOWN TO TEN — {ABBR} DIG IN', 'TEN MEN, ALL HEART']
        : ['{ABBR} SMELL BLOOD', '{ABBR} CIRCLE THE TEN MEN'],
      afterSim: (red.minute + 3) * 60,
      beforeSim: matchEnd,
    })
  }

  // --- equaliser / comeback context after a leveller from minute 55 ---
  const leveller = [...goals]
    .reverse()
    .find((g) => g.minute >= 55 && g.scoreAfter[0] === g.scoreAfter[1])
  if (leveller && leveller.team) {
    const side = leveller.team
    // did the levelling side ever trail by 2+? that's a comeback, not a leveller
    const trailedBy2 = events.some((e) => {
      const diff = side === 'home' ? e.scoreAfter[0] - e.scoreAfter[1] : e.scoreAfter[1] - e.scoreAfter[0]
      return e.id < leveller.id && diff <= -2
    })
    // deadline = the next goal BY EVENT ID — minute-quantised times can't tell
    // the leveller from a goal in the same/next minute (a real fuzz-found bug)
    cands.push({
      id: 'level',
      priority: 4,
      team: side,
      labels: trailedBy2
        ? ['{ABBR} BACK FROM THE DEAD', '{ABBR} REFUSE TO GO AWAY']
        : ['ALL SQUARE — GAME ON', '{ABBR} BACK LEVEL — GAME ON'],
      afterSim: leveller.minute * 60 + 60,
      beforeSim: nextGoalSim(goals.filter((g) => g.id > leveller.id), 0),
    })
  }

  // --- late drama: close game entering the final ten ---
  const at80 = [...events].reverse().find((e) => e.minute <= 80)
  const score80: readonly [number, number] = at80 ? at80.scoreAfter : [0, 0]
  const diff80 = Math.abs(score80[0] - score80[1])
  const lateChances = chances.filter((e) => e.minute >= 65 && e.minute <= 80).length
  const goals80 = goals.filter((g) => g.minute <= 80).length
  if (diff80 <= 1 && (goals80 >= 2 || lateChances >= 2)) {
    cands.push({
      id: 'late',
      priority: 3,
      team: null,
      labels:
        diff80 === 1
          ? ['ONE GOAL IN IT — LATE ON', 'TEN MINUTES TO SETTLE IT', 'NERVES ON BOTH BENCHES']
          : ['TEN MINUTES TO SETTLE IT', 'IT ALL COMES DOWN TO THIS', 'NERVES ON BOTH BENCHES'],
      afterSim: 80 * 60,
      // any late goal changes the premise ('ONE GOAL IN IT' at 2-2 is nonsense)
      beforeSim: Math.min(88 * 60, nextGoalSim(goals, 80 * 60)),
    })
  }

  // --- dominance without a goal: all the ball, none of the net ---
  for (const side of ['home', 'away'] as const) {
    const share = possessionShare(m, side, 0, 65 * 60)
    const created = chances.filter((e) => e.team === side && e.minute <= 65).length
    const scored = goals.some((g) => g.team === side && g.minute <= 65)
    if (share >= 0.58 && created >= 4 && !scored) {
      cands.push({
        id: 'dominant',
        priority: 2,
        team: side,
        labels: ['ALL {ABBR} — BUT NO GOAL', '{ABBR} KNOCKING, NO ANSWER', 'PRESSURE, BUT NO PAYOFF'],
        afterSim: 65 * 60,
        beforeSim: Math.min(75 * 60, nextGoalSim(goals.filter((g) => g.team === side), 65 * 60)),
      })
      break // at most one; higher-possession side found first is fine
    }
  }

  // --- momentum pressure runs: sustained one-way traffic, one per half ---
  let pressureCount = 0
  const halvesUsed = new Set<number>()
  for (let i = 0; i < chances.length && pressureCount < 2; i++) {
    const start = chances[i]
    if (!start.team) continue
    const windowEnd = start.minute + 12
    const inWindow = chances.filter((e) => e.minute >= start.minute && e.minute <= windowEnd)
    if (inWindow.length < 3) continue
    const sign = start.momentumAfter >= 0 ? 1 : -1
    const oneWay = inWindow.every((e) => sign * e.momentumAfter >= 0.5)
    if (!oneWay) continue
    const side: Side = sign > 0 ? 'home' : 'away'
    if (possessionShare(m, side, start.minute * 60, windowEnd * 60) < 0.62) continue
    if (goals.some((g) => g.minute >= start.minute && g.minute <= windowEnd)) continue
    const half = windowEnd * 60 <= HALF_SEC ? 1 : 2
    if (halvesUsed.has(half)) continue
    halvesUsed.add(half)
    pressureCount++
    cands.push({
      id: `pressure${pressureCount}`,
      priority: 1,
      team: side,
      labels: [
        '{ABBR} TURNING THE SCREW',
        'ALL {ABBR} RIGHT NOW',
        'WAVE AFTER WAVE FROM {ABBR}',
        '{ABBR} POURING IT ON',
      ],
      afterSim: windowEnd * 60,
      beforeSim: nextGoalSim(goals, windowEnd * 60),
    })
    i += inWindow.length - 1 // don't re-trigger inside the same run
  }

  return cands
}

/** A render-time span a story caption must not collide with. */
export interface BlockedWindow {
  t: number
  dur: number
}

const BLOCK_MARGIN = 0.35 // seconds of clearance around higher-priority overlays

/**
 * Plant storyline captions into quiet bridges. Bridges are consumed at most
 * once; candidates that find no valid slot are silently dropped — silence
 * always beats stale drama. `blocked` carries every other overlay's render
 * window: a caption that would be stubbed (shown <1s before a HALF-TIME banner
 * or another caption steals the slot) is simply not planted.
 */
export function buildStoryMoments(
  m: MatchResult,
  bridges: BridgeSlot[],
  blocked: BlockedWindow[] = [],
): Moment[] {
  const cands = collectCandidates(m).sort((a, b) => b.priority - a.priority)
  const moments: Moment[] = []
  const usedBridges = new Set<number>()
  const placedSim: number[] = []
  const placedWindows: BlockedWindow[] = [...blocked]
  const collides = (t0: number, t1: number): boolean =>
    placedWindows.some((w) => t0 < w.t + w.dur + BLOCK_MARGIN && w.t - BLOCK_MARGIN < t1)

  for (const c of cands) {
    if (moments.length >= MAX_STORY) break
    for (let bi = 0; bi < bridges.length; bi++) {
      if (usedBridges.has(bi)) continue
      const b = bridges[bi]
      if (b.dur < 1.4) continue
      if (b.simStart < c.afterSim || b.simStart >= c.beforeSim) continue
      if (placedSim.some((s) => Math.abs(s - b.simStart) < MIN_GAP_SIM)) continue
      const t = b.t + 0.2
      if (collides(t, t + STORY_DUR)) continue // never plant a stub caption
      const variant = seedFromKey(`${m.config.seedKey}:story:${c.id}`) % c.labels.length
      moments.push({
        t,
        dur: STORY_DUR,
        kind: 'story',
        team: c.team,
        minute: Math.min(90, Math.floor(b.simStart / 60)),
        label: c.labels[variant].replace('{ABBR}', abbrOf(m, c.team)),
      })
      usedBridges.add(bi)
      placedSim.push(b.simStart)
      placedWindows.push({ t, dur: STORY_DUR })
      break
    }
  }

  return moments
}
