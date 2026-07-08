// The director — lays the choreographer's continuous play script onto the
// render clock. No highlight-reel cuts: the ball is in motion from kickoff to
// full-time and the match clock counts UP the whole way (fast through quiet
// spells, near real-time through the big moments).
//
// Output: a RenderPlan of ball segments + clock keyframes + score keyframes +
// overlay "moments". Pure and deterministic — the same plan drives the live
// preview and the MP4 export.

import type { MatchEvent, MatchResult, Side } from '../sim/types'
import { buildPlayScript, type TouchKind } from '../sim/choreographer'
import { buildStoryMoments, type BridgeSlot } from './storyline'

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
  | 'corner'
  | 'halftime'
  | 'fulltime'
  | 'story'

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

export interface SendOffAt {
  team: Side
  slot: number
  t: number // render seconds the player starts walking
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
  sendOffs: SendOffAt[]
}

const INTRO_DUR = 2.6
const RESULT_DUR = 3.4
const FT_BEAT = 0.7 // hold on the pitch at the final whistle before the result card
// Square-race length: play window 48-62s -> total video 54.7-68.7s by construction
const PLAY_MIN = 48 // normalize play time into a watchable band (seconds)
const PLAY_MAX = 62
const HALF_SEC = 45 * 60

const MOMENT_DUR: Record<MomentKind, number> = {
  kickoff: 1.2,
  goal: 3.4,
  bigChance: 2.5,
  save: 2.1,
  miss: 2.0,
  card: 2.4,
  corner: 1.6,
  halftime: 2.0,
  fulltime: 1.2,
  story: 2.4,
}

/**
 * Context-aware goal labels — the broadcast voice reacts to the match state,
 * not just the fact of a goal. Precedence: late winner > equaliser > opener >
 * go-ahead > third-in-a-run > brace > consolation > pull-one-back > default.
 * Deterministic (planned from the full event list); {TEAM} falls back to the
 * abbreviation when the full name would overflow the lower third (~30 chars).
 */
function goalLabelFor(m: MatchResult, ev: MatchEvent): string {
  const goals = m.events.filter((e) => e.type === 'goal')
  const idx = goals.findIndex((g) => g.id === ev.id)
  const scorer: Side = ev.team === 'away' ? 'away' : 'home'
  const teamDef = scorer === 'home' ? m.config.home : m.config.away
  const name = teamDef.name.toUpperCase()
  const abbr = teamDef.abbr
  const fit = (pattern: string): string => {
    const full = pattern.replace('{T}', name)
    return full.length <= 30 ? full : pattern.replace('{T}', abbr)
  }

  const own = scorer === 'home' ? ev.scoreAfter[0] : ev.scoreAfter[1]
  const oth = scorer === 'home' ? ev.scoreAfter[1] : ev.scoreAfter[0]
  const beforeDiff = own - 1 - oth
  const later = goals.slice(idx + 1)
  const staysAhead =
    own > oth &&
    later.every((g) => {
      const so = scorer === 'home' ? g.scoreAfter[0] : g.scoreAfter[1]
      const oo = scorer === 'home' ? g.scoreAfter[1] : g.scoreAfter[0]
      return so > oo
    })

  if (ev.minute >= 85 && beforeDiff === 0 && staysAhead) return fit('{T} WIN IT LATE')
  if (own === oth) return fit('{T} LEVEL IT')
  if (idx === 0) return fit('{T} STRIKE FIRST')
  if (beforeDiff === 0) return fit('{T} IN FRONT')

  let run = 1
  for (let i = idx - 1; i >= 0 && goals[i].team === ev.team; i--) run++
  if (own > oth) {
    if (run >= 3) return `${abbr} RUNNING RIOT`
    if (run >= 2) return fit('{T} STRIKE AGAIN')
    return fit('GOAL — {T}')
  }

  // scorer still trails
  const neverLevel = later.every((g) => g.scoreAfter[0] !== g.scoreAfter[1])
  const finalOwn = scorer === 'home' ? m.score[0] : m.score[1]
  const finalOth = scorer === 'home' ? m.score[1] : m.score[0]
  if (ev.minute >= 70 && neverLevel && finalOwn < finalOth) return `A CONSOLATION FOR ${abbr}`
  return fit('{T} PULL ONE BACK')
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
  const bridgeSlots: BridgeSlot[] = []
  const sendOffs: SendOffAt[] = []

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
    let cornerT = -1 // when the ball reaches the corner arc
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
      if (touch.kind === 'restart' && (touch.to[0] <= 0.06 || touch.to[0] >= 0.94)) {
        cornerT = tt // the taker is standing over the corner
      }
    }

    if (p.corner && cornerT >= 0) {
      const abbr = p.team === 'home' ? m.config.home.abbr : m.config.away.abbr
      const f = Math.max(0, Math.min(1, (cornerT - t) / dur))
      moments.push({
        t: Math.max(t, cornerT - 0.3),
        dur: MOMENT_DUR.corner,
        kind: 'corner',
        team: p.team,
        minute: minuteAt(p.simStart + f * simSpan),
        label: `CORNER — ${abbr}`,
      })
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
          label: goalLabelFor(m, ev),
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

    if (p.kind === 'bridge') {
      bridgeSlots.push({ t, dur, simStart: p.simStart, simEnd: p.simEnd })
    }

    // map each red card's send-off from sim time onto the render clock
    for (const so of script.sendOffs) {
      if (so.simSec >= p.simStart && so.simSec <= p.simEnd && !sendOffs.some((x) => x.team === so.team && x.slot === so.slot)) {
        sendOffs.push({ team: so.team, slot: so.slot, t: t + dur * ((so.simSec - p.simStart) / simSpan) })
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

  // plant the commentator's storyline captions into quiet bridge play,
  // steering clear of every already-scheduled overlay window (no stub captions)
  const blocked = moments
    .filter((x) => x.kind !== 'kickoff' && x.kind !== 'fulltime')
    .map((x) => ({ t: x.t, dur: x.dur }))
  moments.push(...buildStoryMoments(m, bridgeSlots, blocked))
  moments.sort((a, b) => a.t - b.t)

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
    sendOffs,
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
  corner: 2,
  halftime: 2,
  story: 1, // commentator colour — only ever shows in genuinely quiet play
  kickoff: 0,
  fulltime: 0,
}

/** Raw fade envelope of a moment's overlay at render-time t (0..1). */
export function momentAlpha(m: Moment, t: number): number {
  const prog = (t - m.t) / m.dur
  if (prog < 0 || prog > 1) return 0
  const up = Math.min(1, prog * 4)
  const down = Math.min(1, (1 - prog) * 4)
  return Math.min(up, down)
}

/**
 * The single overlay moment to show at render-time t — no stacked banners.
 * A moment that has already faded out (or barely faded in) doesn't get to
 * block a fully-visible lower-priority one.
 */
export function pickActiveMoment(plan: RenderPlan, t: number): Moment | null {
  let best: Moment | null = null
  for (const m of plan.moments) {
    if (t < m.t || t > m.t + m.dur) continue
    if (momentAlpha(m, t) < 0.15) continue
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
