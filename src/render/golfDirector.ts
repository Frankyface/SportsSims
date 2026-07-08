// The golf director — turns one FOURSOME's simulated round into a broadcast
// plan that shows EVERY SHOT: all four golfers play through all nine holes
// together, one shot at a time, exactly like following a group on course.
//
// Each round therefore produces TWO videos (group one, then the featured
// final group) plus the full-field leaderboard card. Shot order inside a hole
// is real golf: everyone tees off in order, then the ball farthest from the
// pin plays first until all four are holed. Durations are drama-weighted
// (tap-ins flick by, holed birdie putts and water balls breathe) and the whole
// play window is scaled into a 62-80s band so the clip stays under the ~90s
// Reels cap. Pure and deterministic — a pure function of the round result.

import type { GolfEvent, GolfRoundResult, GolfShot } from '../sim/golfTypes'
import { GROUP_SIZE, HOLES_PER_ROUND } from '../sim/golfTypes'

export interface GolfShotSeg {
  t0: number
  t1: number
  shot: GolfShot
}

export interface GolfHoleSpan {
  hole: number
  t0: number
  t1: number
  /**
   * The moment the LAST ball reaches the green (everyone on or holed) —
   * the renderer zooms into the green from here for the putting finale.
   * Absent when the hole never gets a shared putting phase.
   */
  greenT?: number
}

export type GolfMomentKind =
  | 'ace'
  | 'eagle'
  | 'birdie'
  | 'bogey'
  | 'double'
  | 'splash'
  | 'longPutt'
  | 'winner'

export interface GolfMoment {
  t: number
  dur: number
  kind: GolfMomentKind
  golfer: number | null
  hole: number
  label: string
}

export interface GolfBoardRow {
  golfer: number // field index
  toParRound: number
  toParTotal: number
  thru: number
}

export interface GolfBoardKeyframe {
  t: number
  rows: GolfBoardRow[] // sorted best-total-first
}

export interface GolfGroupPlan {
  total: number
  introDur: number
  playStart: number
  playEnd: number
  resultStart: number
  resultDur: number
  group: 0 | 1
  golfers: number[] // the four field indices this video follows
  segs: GolfShotSeg[] // every shot of the group, interleaved, chronological
  holes: GolfHoleSpan[]
  moments: GolfMoment[]
  board: GolfBoardKeyframe[]
}

const INTRO_DUR = 2.6
const RESULT_DUR = 4.2
const FT_BEAT = 0.6
const HOLE_GAP = 0.45 // breath between holes (scaled with the play window)
const PLAY_MIN = 62
const PLAY_MAX = 80

export function formatToPar(n: number): string {
  return n === 0 ? 'E' : n > 0 ? `+${n}` : `${n}`
}

/** Running tournament to-par per golfer (field order) THROUGH a hole (inclusive). */
export function golfTotalsThru(m: GolfRoundResult, holeIdx: number): number[] {
  return m.config.golfers.map((_, gi) => {
    let v = m.config.startToPar[gi]
    for (let hIdx = 0; hIdx <= holeIdx; hIdx++) {
      v += m.strokes[gi][hIdx] - m.config.course.holes[hIdx].par
    }
    return v
  })
}

/** A putt short enough to be a formality. */
function isTapIn(shot: GolfShot): boolean {
  return shot.kind === 'putt' && (1 - shot.from[1]) / 0.08 <= 0.06
}

/** Raw (pre-scale) screen time a shot deserves. */
function shotWeight(shot: GolfShot, holeIdx: number): number {
  let w: number
  if (shot.kind === 'putt') w = isTapIn(shot) ? 0.32 : 0.48
  else if (shot.kind === 'chip' || shot.kind === 'recovery') w = 0.6
  else w = 0.68 // drives + approaches: let the flight read
  if (shot.penalty) w += 0.55 // the splash beat
  if (shot.holed && shot.kind === 'putt' && !isTapIn(shot)) w += 0.5 // celebrate
  if (shot.holed && shot.kind !== 'putt') w += 0.7 // chip-in / holed approach / ace
  if (holeIdx === HOLES_PER_ROUND - 1) w *= 1.15 // the closing hole breathes
  return w
}

/**
 * Real-golf shot order for one hole: tee shots in playing order, then the
 * ball farthest from the pin plays next until everyone is holed. Each
 * golfer's own shots keep their sim order.
 */
export function interleaveHoleShots(byGolfer: GolfShot[][]): GolfShot[] {
  const queues = byGolfer.map((shots) => [...shots])
  const out: GolfShot[] = []
  // honours: everyone hits the tee shot first, in order
  for (const q of queues) {
    const tee = q.shift()
    if (tee) out.push(tee)
  }
  // then farthest-out plays first
  for (;;) {
    let pick = -1
    let farthest = -Infinity
    for (let i = 0; i < queues.length; i++) {
      const q = queues[i]
      if (q.length === 0) continue
      const next = q[0]
      const dist = 1 - next.from[1] + Math.abs(next.from[0]) * 0.001
      if (dist > farthest + 1e-9) {
        farthest = dist
        pick = i
      }
    }
    if (pick < 0) break
    out.push(queues[pick].shift() as GolfShot)
  }
  return out
}

function momentLabel(m: GolfRoundResult, e: GolfEvent): string {
  const g = e.golfer !== null ? m.config.golfers[e.golfer] : null
  const nm = g ? g.name.toUpperCase() : ''
  const short = nm.length > 18 && g ? g.abbr : nm
  const tp = formatToPar(e.toParAfter)
  switch (e.type) {
    case 'ace':
      return `${short} — HOLE IN ONE!`
    case 'eagle':
      return `EAGLE — ${short} TO ${tp}`
    case 'birdie':
      return `BIRDIE — ${short} TO ${tp}`
    case 'bogey':
      return `BOGEY — ${short} SLIPS TO ${tp}`
    case 'double':
      return `DISASTER — ${short} TO ${tp}`
    case 'splash':
      return `${short} FINDS THE WATER`
    case 'longPutt':
      return `${short} FROM DOWNTOWN!`
    case 'winner':
      return `${short} WINS IT`
    default:
      return short
  }
}

const MOMENT_DUR: Record<GolfMomentKind, number> = {
  ace: 3.2,
  eagle: 2.6,
  birdie: 1.8,
  bogey: 1.6,
  double: 2.2,
  splash: 2.0,
  longPutt: 2.2,
  winner: 3.0,
}

const MOMENT_PRIORITY: Record<GolfMomentKind, number> = {
  ace: 10,
  winner: 9,
  eagle: 8,
  longPutt: 6,
  splash: 5,
  double: 5,
  birdie: 3,
  bogey: 1,
}

/** Build the full render plan for ONE foursome's round video. */
export function buildGolfGroupPlan(m: GolfRoundResult, group: 0 | 1): GolfGroupPlan {
  const golfers = Array.from({ length: GROUP_SIZE }, (_, i) => group * GROUP_SIZE + i)
  const inGroup = new Set(golfers)

  // --- interleave every hole, collect raw weights ---
  const holeShots: GolfShot[][] = []
  for (let holeIdx = 0; holeIdx < HOLES_PER_ROUND; holeIdx++) {
    const byGolfer = golfers.map((gi) => m.shots.filter((s) => s.golfer === gi && s.hole === holeIdx))
    holeShots.push(interleaveHoleShots(byGolfer))
  }
  const rawShots = holeShots.reduce((s, hs) => s + hs.reduce((a, x) => a + shotWeight(x, x.hole), 0), 0)
  const rawGaps = (HOLES_PER_ROUND - 1) * HOLE_GAP
  const raw = rawShots + rawGaps
  const target = Math.min(PLAY_MAX, Math.max(PLAY_MIN, raw))
  const k = target / raw

  // --- lay the segments on the render clock ---
  const segs: GolfShotSeg[] = []
  const holes: GolfHoleSpan[] = []
  const board: GolfBoardKeyframe[] = []
  const moments: GolfMoment[] = []
  let t = INTRO_DUR

  const boardRows = (holeIdx: number): GolfBoardRow[] => {
    const rows = golfers.map((gi) => {
      let roundToPar = 0
      for (let hIdx = 0; hIdx <= holeIdx; hIdx++) {
        roundToPar += m.strokes[gi][hIdx] - m.config.course.holes[hIdx].par
      }
      return {
        golfer: gi,
        toParRound: holeIdx < 0 ? 0 : roundToPar,
        toParTotal: m.config.startToPar[gi] + (holeIdx < 0 ? 0 : roundToPar),
        thru: holeIdx + 1,
      }
    })
    return rows.sort((a, b) => a.toParTotal - b.toParTotal || a.golfer - b.golfer)
  }
  board.push({ t: INTRO_DUR, rows: boardRows(-1) })

  for (let holeIdx = 0; holeIdx < HOLES_PER_ROUND; holeIdx++) {
    const h0 = t
    const lastShotEnd = new Map<number, number>() // golfer -> t1 of their final shot this hole
    const lies = new Map<number, string>(golfers.map((gi) => [gi, 'tee']))
    let greenT: number | undefined
    for (const shot of holeShots[holeIdx]) {
      const dur = shotWeight(shot, holeIdx) * k
      segs.push({ t0: t, t1: t + dur, shot })
      lastShotEnd.set(shot.golfer, t + dur)
      t += dur
      lies.set(shot.golfer, shot.toLie)
      if (greenT === undefined && golfers.every((gi) => lies.get(gi) === 'green' || lies.get(gi) === 'holed')) {
        // the last ball just found the green — but only zoom if putts remain
        if (golfers.some((gi) => lies.get(gi) === 'green')) greenT = t
      }
    }
    holes.push({ hole: holeIdx, t0: h0, t1: t, greenT })

    // group moments land as the golfer holes out
    for (const e of m.events.filter(
      (x) => x.hole === holeIdx && x.golfer !== null && inGroup.has(x.golfer) && x.type !== 'winner' && x.type !== 'leadChange',
    )) {
      const kind = e.type as GolfMomentKind
      const at = (lastShotEnd.get(e.golfer as number) ?? t) - 0.1
      moments.push({ t: at, dur: MOMENT_DUR[kind], kind, golfer: e.golfer, hole: holeIdx, label: momentLabel(m, e) })
    }

    board.push({ t: t - 0.05, rows: boardRows(holeIdx) })
    if (holeIdx < HOLES_PER_ROUND - 1) t += HOLE_GAP * k
  }

  const playEnd = t
  const resultStart = playEnd + FT_BEAT

  // round-4 winner banner, only if the champion is in THIS group
  const winner = m.events.find((e) => e.type === 'winner')
  if (winner && winner.golfer !== null && inGroup.has(winner.golfer)) {
    moments.push({
      t: playEnd - 2.0,
      dur: MOMENT_DUR.winner,
      kind: 'winner',
      golfer: winner.golfer,
      hole: winner.hole,
      label: momentLabel(m, winner),
    })
  }

  return {
    total: resultStart + RESULT_DUR,
    introDur: INTRO_DUR,
    playStart: INTRO_DUR,
    playEnd,
    resultStart,
    resultDur: RESULT_DUR,
    group,
    golfers,
    segs,
    holes,
    moments: moments.sort((a, b) => a.t - b.t),
    board,
  }
}

/** The hole on screen at render-time t (clamped to the play window). */
export function golfHoleAt(plan: GolfGroupPlan, t: number): GolfHoleSpan {
  const tt = Math.min(Math.max(t, plan.playStart), plan.playEnd - 0.001)
  for (const h of plan.holes) {
    if (tt < h.t1) return h
  }
  return plan.holes[plan.holes.length - 1]
}

/** Group scoreboard rows current at render-time t (stepped keyframes). */
export function golfBoardAt(plan: GolfGroupPlan, t: number): GolfBoardRow[] {
  let rows = plan.board[0].rows
  for (const kf of plan.board) {
    if (kf.t <= t) rows = kf.rows
    else break
  }
  return rows
}

/** The shot in motion at t, if any. */
export function golfActiveSegAt(plan: GolfGroupPlan, t: number): GolfShotSeg | null {
  for (const s of plan.segs) {
    if (t >= s.t0 && t <= s.t1) return s
  }
  return null
}

/**
 * Where golfer `gi` (field index) is at time t on the CURRENT hole:
 * their most recent position, plus whether they have holed out.
 */
export function golferPosAt(
  plan: GolfGroupPlan,
  gi: number,
  t: number,
  hole: number,
): { pos: [number, number]; holed: boolean; started: boolean } {
  let pos: [number, number] | null = null
  let holed = false
  for (const s of plan.segs) {
    if (s.shot.golfer !== gi || s.shot.hole !== hole) continue
    if (s.t0 > t) break
    if (t >= s.t1) {
      pos = s.shot.to
      if (s.shot.holed) holed = true
    } else {
      pos = s.shot.from // mid-flight: the renderer draws the moving ball itself
    }
  }
  return { pos: pos ?? [0, 0], holed, started: pos !== null }
}

/** Highest-priority moment active at t (one lower third at a time). */
export function pickActiveGolfMoment(plan: GolfGroupPlan, t: number): GolfMoment | null {
  let best: GolfMoment | null = null
  for (const mo of plan.moments) {
    if (t < mo.t || t > mo.t + mo.dur) continue
    if (!best || MOMENT_PRIORITY[mo.kind] > MOMENT_PRIORITY[best.kind]) best = mo
  }
  return best
}
