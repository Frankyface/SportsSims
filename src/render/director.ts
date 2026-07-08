// The director — lays the choreographer's continuous play script onto the
// render clock. No highlight-reel cuts: the ball is in motion from kickoff to
// full-time and the match clock counts UP the whole way (fast through quiet
// spells, near real-time through the big moments).
//
// Output: a RenderPlan of ball segments + clock keyframes + score keyframes +
// overlay "moments". Pure and deterministic — the same plan drives the live
// preview and the MP4 export.

import type { MatchResult, Side } from '../sim/types'
import { buildPlayScript, type TouchKind } from '../sim/choreographer'

export interface BallSeg {
  t0: number // render seconds
  t1: number
  from: [number, number] // normalized pitch coords (see sim/formation.ts)
  to: [number, number]
  kind: TouchKind
  team: Side
  slot: number
  arc: number
  risky: boolean
}

export type MomentKind =
  | 'kickoff'
  | 'goal'
  | 'bigChance'
  | 'save'
  | 'miss'
  | 'card'
  | 'halftime'
  | 'fulltime'

export interface Moment {
  t: number // render seconds the overlay/audio fires
  dur: number
  kind: MomentKind
  team: Side | null
  minute: number
  label: string
  cardType?: 'yellow' | 'red'
}

export interface ClockPt {
  t: number // render seconds
  sec: number // match-clock seconds
}

export interface ScorePt {
  t: number
  score: [number, number]
}

export interface RenderPlan {
  total: number
  introDur: number
  playStart: number
  playEnd: number
  resultStart: number
  resultDur: number
  segs: BallSeg[]
  clockPts: ClockPt[]
  scorePts: ScorePt[]
  moments: Moment[]
}

const INTRO_DUR = 2.6
const RESULT_DUR = 3.4
const FT_BEAT = 0.7 // hold on the pitch at the final whistle before the result card
const PLAY_MIN = 22 // normalize play time into a watchable band (seconds)
const PLAY_MAX = 34
const HALF_SEC = 45 * 60

const MOMENT_DUR: Record<MomentKind, number> = {
  kickoff: 1.0,
  goal: 2.4,
  bigChance: 1.8,
  save: 1.5,
  miss: 1.4,
  card: 1.7,
  halftime: 1.4,
  fulltime: 1.2,
}

export function buildRenderPlan(m: MatchResult): RenderPlan {
  const script = buildPlayScript(m)
  const eventsById = new Map(m.events.map((e) => [e.id, e]))

  const rawPlay = script.passages.reduce((s, p) => s + p.renderDur, 0) || 1
  const scale = rawPlay > PLAY_MAX ? PLAY_MAX / rawPlay : rawPlay < PLAY_MIN ? PLAY_MIN / rawPlay : 1

  const segs: BallSeg[] = []
  const clockPts: ClockPt[] = [{ t: INTRO_DUR, sec: 0 }]
  const scorePts: ScorePt[] = [{ t: 0, score: [0, 0] }]
  const moments: Moment[] = [
    { t: INTRO_DUR, dur: MOMENT_DUR.kickoff, kind: 'kickoff', team: null, minute: 0, label: 'KICK-OFF' },
  ]

  const minuteAt = (simSec: number): number => Math.min(90, Math.floor(simSec / 60))

  let t = INTRO_DUR
  let halftimeDone = false

  for (const p of script.passages) {
    const dur = p.renderDur * scale
    const simSpan = Math.max(1, p.simEnd - p.simStart)
    const wsum = p.touches.reduce((s, x) => s + x.w, 0) || 1

    if (!halftimeDone && p.simStart < HALF_SEC && p.simEnd >= HALF_SEC) {
      const f = (HALF_SEC - p.simStart) / simSpan
      moments.push({
        t: t + dur * f,
        dur: MOMENT_DUR.halftime,
        kind: 'halftime',
        team: null,
        minute: 45,
        label: 'HALF-TIME',
      })
      halftimeDone = true
    }

    let tt = t
    let strikeT = -1 // when the shot lands / the stoppage begins
    for (const touch of p.touches) {
      const d = (touch.w / wsum) * dur
      segs.push({
        t0: tt,
        t1: tt + d,
        from: touch.from,
        to: touch.to,
        kind: touch.kind,
        team: touch.team,
        slot: touch.slot,
        arc: touch.arc,
        risky: touch.risky,
      })
      tt += d
      if (touch.kind === 'shot' || (touch.kind === 'held' && p.outcome === 'card')) {
        strikeT = touch.kind === 'shot' ? tt : tt - d // shots land at seg end; stoppages start at seg start
      }
    }

    if (p.kind === 'featured' && strikeT >= 0) {
      const ev = p.eventId !== undefined ? eventsById.get(p.eventId) : undefined
      const f = Math.max(0, Math.min(1, (strikeT - t) / dur))
      const minute = minuteAt(p.simStart + f * simSpan)
      if (p.outcome === 'goal' && ev) {
        scorePts.push({ t: strikeT, score: [ev.scoreAfter[0], ev.scoreAfter[1]] })
        moments.push({
          t: strikeT,
          dur: MOMENT_DUR.goal,
          kind: 'goal',
          team: p.team,
          minute,
          label: p.label ?? 'GOAL',
        })
      } else if (p.outcome === 'bigChanceSaved' || p.outcome === 'bigChanceMiss') {
        moments.push({
          t: strikeT,
          dur: MOMENT_DUR.bigChance,
          kind: 'bigChance',
          team: p.team,
          minute,
          label: p.label ?? 'BIG CHANCE!',
        })
      } else if (p.outcome === 'save' || p.outcome === 'miss') {
        moments.push({
          t: strikeT,
          dur: MOMENT_DUR[p.outcome],
          kind: p.outcome,
          team: p.team,
          minute,
          label: p.label ?? '',
        })
      } else if (p.outcome === 'card' && ev) {
        moments.push({
          t: strikeT,
          dur: MOMENT_DUR.card,
          kind: 'card',
          team: ev.team, // the card belongs to the offending side, not the possession side
          minute,
          label: p.label ?? 'CAUTION',
          cardType: p.cardType,
        })
      }
    }

    t += dur
    clockPts.push({ t, sec: p.simEnd })
  }

  const playEnd = t
  moments.push({
    t: playEnd,
    dur: MOMENT_DUR.fulltime,
    kind: 'fulltime',
    team: null,
    minute: 90,
    label: 'FULL-TIME',
  })

  const resultStart = playEnd + FT_BEAT
  return {
    total: resultStart + RESULT_DUR,
    introDur: INTRO_DUR,
    playStart: INTRO_DUR,
    playEnd,
    resultStart,
    resultDur: RESULT_DUR,
    segs,
    clockPts,
    scorePts,
    moments,
  }
}

// Overlay windows are allowed to overlap on the timeline (a goal celebration can
// run into the half-time crossing); the RENDERER must only ever show one lower
// third, so the highest-drama active moment wins. 0 = never shown as a third.
const THIRD_PRIORITY: Record<MomentKind, number> = {
  goal: 6,
  card: 5,
  bigChance: 4,
  save: 3,
  miss: 3,
  halftime: 2,
  kickoff: 0,
  fulltime: 0,
}

/** The single overlay moment to show at render-time t — no stacked banners. */
export function pickActiveMoment(plan: RenderPlan, t: number): Moment | null {
  let best: Moment | null = null
  for (const m of plan.moments) {
    if (t < m.t || t > m.t + m.dur) continue
    const p = THIRD_PRIORITY[m.kind]
    if (p <= 0) continue
    if (!best || p > THIRD_PRIORITY[best.kind] || (p === THIRD_PRIORITY[best.kind] && m.t > best.t)) {
      best = m
    }
  }
  return best
}

// ---- pure lookups shared by the renderer & audio (binary search, no state) ----

/** Index of the ball segment active at render-time t (clamped to first/last). */
export function segIndexAt(plan: RenderPlan, t: number): number {
  const segs = plan.segs
  if (segs.length === 0) return -1
  if (t <= segs[0].t0) return 0
  if (t >= segs[segs.length - 1].t0) return segs.length - 1
  let lo = 0
  let hi = segs.length - 1
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1
    if (segs[mid].t0 <= t) lo = mid
    else hi = mid - 1
  }
  return lo
}

/** Match-clock seconds at render-time t — monotonic, counts up, never jumps back. */
export function clockSecAt(plan: RenderPlan, t: number): number {
  const pts = plan.clockPts
  if (t <= pts[0].t) return pts[0].sec
  const last = pts[pts.length - 1]
  if (t >= last.t) return last.sec
  let lo = 0
  let hi = pts.length - 1
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1
    if (pts[mid].t <= t) lo = mid
    else hi = mid - 1
  }
  const a = pts[lo]
  const b = pts[lo + 1]
  const f = (t - a.t) / Math.max(1e-6, b.t - a.t)
  return a.sec + (b.sec - a.sec) * f
}

/** Scoreboard state at render-time t (steps up exactly when goals land). */
export function scoreAt(plan: RenderPlan, t: number): [number, number] {
  let s = plan.scorePts[0].score
  for (const pt of plan.scorePts) {
    if (pt.t <= t) s = pt.score
    else break
  }
  return s
}
