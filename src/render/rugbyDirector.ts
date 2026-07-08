// The rugby director — lays the rugby choreographer's continuous play script
// onto the render clock. Same contract as the soccer director: no cuts, the
// clock counts UP 0'→80' the whole way (fast through quiet spells, near
// real-time in the big moments), the score steps live as points land, and
// moments drive the lower thirds + audio. Pure and deterministic.

import { buildRugbyPlayScript, type RugbyTouchKind, type RugbyTouchTag } from '../sim/rugbyChoreographer'
import type { RugbyMatchEvent, RugbyMatchResult } from '../sim/rugbyTypes'
import type { Side } from '../sim/types'
import { buildRugbyStoryMoments, type RugbyBridgeSlot } from './rugbyStoryline'

export interface RugbyBallSeg {
  t0: number // render seconds
  t1: number
  from: [number, number] // normalized pitch coords (see sim/rugbyFormation.ts)
  to: [number, number]
  kind: RugbyTouchKind
  team: Side
  slot: number
  arc: number
  risky: boolean
  tag?: RugbyTouchTag
}

export type RugbyMomentKind =
  | 'kickoff'
  | 'try'
  | 'conversion'
  | 'penaltyGoal'
  | 'penaltyMiss'
  | 'dropGoal'
  | 'dropMiss'
  | 'break'
  | 'card'
  | 'halftime'
  | 'fulltime'
  | 'story'

export interface RugbyMoment {
  t: number // render seconds the overlay/audio fires
  dur: number
  kind: RugbyMomentKind
  team: Side | null
  minute: number
  label: string
  cardType?: 'yellow' | 'red'
}

export interface RugbyClockPt {
  t: number
  sec: number
}

export interface RugbyScorePt {
  t: number
  score: [number, number]
}

export interface RugbySendOffAt {
  team: Side
  slot: number
  t: number // render seconds the player starts walking
  returnT?: number // sin-binned players walk back on; reds never do
}

export interface RugbyRenderPlan {
  total: number
  introDur: number
  playStart: number
  playEnd: number
  resultStart: number
  resultDur: number
  segs: RugbyBallSeg[]
  clockPts: RugbyClockPt[]
  scorePts: RugbyScorePt[]
  moments: RugbyMoment[]
  sendOffs: RugbySendOffAt[]
}

const INTRO_DUR = 2.6
const RESULT_DUR = 3.4
const FT_BEAT = 0.7
// Same square-race band as soccer: play window 48-62s -> total 54.7-68.7s
const PLAY_MIN = 48
const PLAY_MAX = 62
const HALF_SEC = 40 * 60

const MOMENT_DUR: Record<RugbyMomentKind, number> = {
  kickoff: 1.2,
  try: 3.4,
  conversion: 1.8,
  penaltyGoal: 2.8,
  penaltyMiss: 2.0,
  dropGoal: 2.8,
  dropMiss: 2.0,
  break: 2.2,
  card: 2.4,
  halftime: 2.0,
  fulltime: 1.2,
  story: 2.4,
}

/**
 * Context-aware try labels — precedence mirrors the soccer goal labeller:
 * late winner > leveller > opener > lead-taker > run-counting > consolation.
 * Deterministic from the full event list; {T} falls back to the abbreviation
 * when the full name would overflow the lower third.
 */
function tryLabelFor(m: RugbyMatchResult, ev: RugbyMatchEvent): string {
  const tries = m.events.filter((e) => e.type === 'try')
  const idx = tries.findIndex((g) => g.id === ev.id)
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
  const beforeOwn = own - 5
  const later = tries.slice(idx + 1)
  const staysAhead =
    own > oth &&
    later.every((g) => {
      const so = scorer === 'home' ? g.scoreAfter[0] : g.scoreAfter[1]
      const oo = scorer === 'home' ? g.scoreAfter[1] : g.scoreAfter[0]
      return so > oo
    })

  if (ev.minute >= 70 && beforeOwn <= oth && staysAhead) return fit('{T} WIN IT LATE')
  if (own === oth) return fit('{T} LEVEL IT')
  if (idx === 0) return fit('{T} STRIKE FIRST')
  if (own > oth && beforeOwn <= oth) return fit('{T} IN FRONT')

  let run = 1
  for (let i = idx - 1; i >= 0 && tries[i].team === ev.team; i--) run++
  if (own > oth) {
    if (run >= 3) return `${abbr} RUNNING RIOT`
    if (run >= 2) return fit('{T} STRIKE AGAIN')
    return fit('TRY — {T}')
  }

  const neverLevel = later.every((g) => g.scoreAfter[0] !== g.scoreAfter[1])
  const finalOwn = scorer === 'home' ? m.score[0] : m.score[1]
  const finalOth = scorer === 'home' ? m.score[1] : m.score[0]
  if (ev.minute >= 65 && neverLevel && finalOwn < finalOth) return `A CONSOLATION FOR ${abbr}`
  return fit('{T} HIT BACK')
}

export function buildRugbyRenderPlan(m: RugbyMatchResult): RugbyRenderPlan {
  const script = buildRugbyPlayScript(m)
  const eventsById = new Map(m.events.map((e) => [e.id, e]))

  const rawPlay = script.passages.reduce((s, p) => s + p.renderDur, 0) || 1
  const scale = rawPlay > PLAY_MAX ? PLAY_MAX / rawPlay : rawPlay < PLAY_MIN ? PLAY_MIN / rawPlay : 1

  const segs: RugbyBallSeg[] = []
  const clockPts: RugbyClockPt[] = [{ t: INTRO_DUR, sec: 0 }]
  const scorePts: RugbyScorePt[] = [{ t: 0, score: [0, 0] }]
  const moments: RugbyMoment[] = [
    { t: INTRO_DUR, dur: MOMENT_DUR.kickoff, kind: 'kickoff', team: null, minute: 0, label: 'KICK-OFF' },
  ]

  const minuteAt = (simSec: number): number => Math.min(80, Math.floor(simSec / 60))

  let t = INTRO_DUR
  let halftimeDone = false
  const bridgeSlots: RugbyBridgeSlot[] = []

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
        minute: 40,
        label: 'HALF-TIME',
      })
      halftimeDone = true
    }

    // walk the touches: track where the drama lands on the render clock
    let tt = t
    let groundingT = -1 // the try is scored as the grounding LANDS
    let shotT = -1 // a kick at goal lands at seg end
    let cardT = -1 // the stoppage where the card is shown BEGINS
    let interceptT = -1 // the tackle/steal that kills a break
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
        tag: touch.tag,
      })
      tt += d
      if (touch.kind === 'grounding') groundingT = tt
      if (touch.kind === 'shot') shotT = tt
      if (touch.kind === 'held' && touch.tag === 'card' && cardT < 0) cardT = tt - d
      if (touch.kind === 'intercept' && interceptT < 0) interceptT = tt - d
    }

    if (p.kind === 'featured') {
      const ev = p.eventId !== undefined ? eventsById.get(p.eventId) : undefined
      const minuteOf = (strikeT: number): number => {
        const f = Math.max(0, Math.min(1, (strikeT - t) / dur))
        return minuteAt(p.simStart + f * simSpan)
      }

      if (p.cardType && cardT >= 0) {
        moments.push({
          t: cardT,
          dur: MOMENT_DUR.card,
          kind: 'card',
          team: p.team === 'home' ? 'away' : 'home', // cards go to the side that conceded
          minute: minuteOf(cardT),
          label: p.cardType === 'red' ? 'RED CARD' : 'SIN BIN',
          cardType: p.cardType,
        })
      }

      if (p.outcome === 'try' && ev && groundingT >= 0) {
        scorePts.push({ t: groundingT, score: [ev.scoreAfter[0], ev.scoreAfter[1]] })
        moments.push({
          t: groundingT,
          dur: MOMENT_DUR.try,
          kind: 'try',
          team: p.team,
          minute: minuteOf(groundingT),
          label: tryLabelFor(m, ev),
        })
        const convEv = p.convEventId !== undefined ? eventsById.get(p.convEventId) : undefined
        if (shotT >= 0) {
          if (p.conv === 'good' && convEv) {
            scorePts.push({ t: shotT, score: [convEv.scoreAfter[0], convEv.scoreAfter[1]] })
          }
          const abbr = p.team === 'home' ? m.config.home.abbr : m.config.away.abbr
          moments.push({
            t: shotT,
            dur: MOMENT_DUR.conversion,
            kind: 'conversion',
            team: p.team,
            minute: minuteOf(shotT),
            label: p.conv === 'good' ? `CONVERSION — ${abbr}` : 'CONVERSION MISSED',
          })
        }
      } else if (p.outcome === 'penGoal' && ev && shotT >= 0) {
        scorePts.push({ t: shotT, score: [ev.scoreAfter[0], ev.scoreAfter[1]] })
        moments.push({
          t: shotT,
          dur: MOMENT_DUR.penaltyGoal,
          kind: 'penaltyGoal',
          team: p.team,
          minute: minuteOf(shotT),
          label: (ev.label ?? 'PENALTY GOAL').toUpperCase(),
        })
      } else if (p.outcome === 'penMiss' && shotT >= 0) {
        moments.push({
          t: shotT,
          dur: MOMENT_DUR.penaltyMiss,
          kind: 'penaltyMiss',
          team: p.team,
          minute: minuteOf(shotT),
          label: p.label ?? 'PENALTY — NO GOOD',
        })
      } else if (p.outcome === 'dropGoal' && ev && shotT >= 0) {
        scorePts.push({ t: shotT, score: [ev.scoreAfter[0], ev.scoreAfter[1]] })
        moments.push({
          t: shotT,
          dur: MOMENT_DUR.dropGoal,
          kind: 'dropGoal',
          team: p.team,
          minute: minuteOf(shotT),
          label: (ev.label ?? 'DROP GOAL').toUpperCase(),
        })
      } else if (p.outcome === 'dropMiss' && shotT >= 0) {
        moments.push({
          t: shotT,
          dur: MOMENT_DUR.dropMiss,
          kind: 'dropMiss',
          team: p.team,
          minute: minuteOf(shotT),
          label: p.label ?? 'DROP ATTEMPT — WIDE',
        })
      } else if (p.outcome === 'break' && interceptT >= 0) {
        moments.push({
          t: interceptT,
          dur: MOMENT_DUR.break,
          kind: 'break',
          team: p.team,
          minute: minuteOf(interceptT),
          label: (p.label ?? 'LINE BREAK!').toUpperCase(),
        })
      }
    }

    if (p.kind === 'bridge') {
      bridgeSlots.push({ t, dur, simStart: p.simStart, simEnd: p.simEnd })
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
    minute: 80,
    label: 'FULL-TIME',
  })

  // sim seconds -> render seconds via the clock keyframes (piecewise-linear
  // inverse of clockSecAt); used to place send-offs AND sin-bin returns
  const simToT = (sec: number): number => {
    const pts = clockPts
    if (sec <= pts[0].sec) return pts[0].t
    const last = pts[pts.length - 1]
    if (sec >= last.sec) return last.t
    for (let i = 1; i < pts.length; i++) {
      if (pts[i].sec >= sec) {
        const a = pts[i - 1]
        const b = pts[i]
        const f = (sec - a.sec) / Math.max(1e-6, b.sec - a.sec)
        return a.t + (b.t - a.t) * f
      }
    }
    return last.t
  }
  const sendOffs: RugbySendOffAt[] = script.sendOffs.map((so) => ({
    team: so.team,
    slot: so.slot,
    t: simToT(so.simSec),
    returnT: so.returnSec !== undefined ? simToT(so.returnSec) : undefined,
  }))

  const blocked = moments
    .filter((x) => x.kind !== 'kickoff' && x.kind !== 'fulltime')
    .map((x) => ({ t: x.t, dur: x.dur }))
  moments.push(...buildRugbyStoryMoments(m, bridgeSlots, blocked))
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

// One lower third at a time; the highest-drama active moment wins.
const THIRD_PRIORITY: Record<RugbyMomentKind, number> = {
  try: 6,
  card: 5,
  penaltyGoal: 4,
  dropGoal: 4,
  break: 3,
  penaltyMiss: 3,
  dropMiss: 3,
  conversion: 2,
  halftime: 2,
  story: 1,
  kickoff: 0,
  fulltime: 0,
}

/** Raw fade envelope of a moment's overlay at render-time t (0..1). */
export function rugbyMomentAlpha(m: RugbyMoment, t: number): number {
  const prog = (t - m.t) / m.dur
  if (prog < 0 || prog > 1) return 0
  const up = Math.min(1, prog * 4)
  const down = Math.min(1, (1 - prog) * 4)
  return Math.min(up, down)
}

/** The single overlay moment to show at render-time t — no stacked banners. */
export function pickActiveRugbyMoment(plan: RugbyRenderPlan, t: number): RugbyMoment | null {
  let best: RugbyMoment | null = null
  for (const m of plan.moments) {
    if (t < m.t || t > m.t + m.dur) continue
    if (rugbyMomentAlpha(m, t) < 0.15) continue
    const p = THIRD_PRIORITY[m.kind]
    if (p <= 0) continue
    if (!best || p > THIRD_PRIORITY[best.kind] || (p === THIRD_PRIORITY[best.kind] && m.t > best.t)) {
      best = m
    }
  }
  return best
}

// ---- pure lookups shared by the renderer & audio ----

/** Index of the ball segment active at render-time t (clamped to first/last). */
export function rugbySegIndexAt(plan: RugbyRenderPlan, t: number): number {
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

/** Match-clock seconds at render-time t — monotonic, counts up, never back. */
export function rugbyClockSecAt(plan: RugbyRenderPlan, t: number): number {
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

/** Scoreboard state at render-time t (steps exactly as points land). */
export function rugbyScoreAt(plan: RugbyRenderPlan, t: number): [number, number] {
  let s = plan.scorePts[0].score
  for (const pt of plan.scorePts) {
    if (pt.t <= t) s = pt.score
    else break
  }
  return s
}
