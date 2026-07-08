// The rugby choreographer — expands a RugbyMatchResult's possession spans into
// an unbroken chain of ball touches shaped like rugby union: forward carries
// into contact, a beat of ruck, backward passes out, kick exchanges caught by
// the fullback, penalty kicks off the tee, lineout drives from the corner and
// try groundings with their conversions.
//
// Rules of the room (identical to the soccer choreographer):
// - ALL randomness comes from ONE seeded PRNG on a SEPARATE stream
//   (`seedKey + ':pbp'`) — it never touches the frozen score-deciding stream.
// - Determinism hygiene applies (this is src/sim): no transcendental math,
//   no Math.random/Date.now. Arithmetic, comparisons and the PRNG only.
// - Ball continuity is sacred: every touch starts exactly where the previous
//   touch ended, across the whole match. No teleports.
// - Passes NEVER travel toward the attacked try line — rugby's defining rule.
//   Ground is gained by carries and kicks only.

import { makeRng } from './prng'
import { FULLBACK_SLOT, RUGBY_CENTER, rugbyNearestSlot } from './rugbyFormation'
import type { RugbyMatchEvent, RugbyMatchResult } from './rugbyTypes'
import type { Side } from './types'

export type RugbyTouchKind =
  | 'pass' // backward/lateral only
  | 'carry' // the ground-gainer
  | 'kick' // punt/clearance/kickoff — slot/team are the CATCHER
  | 'shot' // a kick at goal (conversion / penalty / drop)
  | 'grounding' // the try dive over the line
  | 'intercept' // turnover — jackal steal / dominant tackle / held up
  | 'restart' // ball walked/thrown to a set-piece mark
  | 'held' // ball static: ruck, maul, tee setup, award stoppage, celebration

export type RugbyTouchTag = 'ruck' | 'maul' | 'card' | 'tee' | 'celebrate' | 'lineout' | 'award'

export interface RugbyTouch {
  kind: RugbyTouchKind
  team: Side // team of the acting player at `to` (receiver / catcher / carrier)
  from: [number, number]
  to: [number, number]
  slot: number // player slot on the ball at `to` (-1 = none, e.g. ball over the bar)
  w: number // relative duration weight within the passage
  arc: number // 0 = ground ball; >0 = lofted (visual only)
  risky: boolean // a gamble ball (visual flag)
  tag?: RugbyTouchTag
}

export type RugbyPassageOutcome =
  | 'try'
  | 'penGoal'
  | 'penMiss'
  | 'dropGoal'
  | 'dropMiss'
  | 'break'
  | 'card'
  | 'flow'

export interface RugbyPassage {
  simStart: number // match-clock seconds this passage covers (contiguous)
  simEnd: number
  team: Side // primary attacking team
  kind: 'featured' | 'bridge'
  outcome: RugbyPassageOutcome
  renderDur: number // seconds of render time the director should give this passage
  touches: RugbyTouch[]
  minute: number
  eventId?: number
  cardType?: 'yellow' | 'red'
  label?: string
  conv?: 'good' | 'miss' // a try passage carries its conversion
  convEventId?: number
  viaCorner?: boolean // staged off a penalty kicked to the corner (lineout drive)
}

export interface RugbySendOff {
  team: Side
  slot: number // 1-9; the fullback is never carded
  simSec: number
  returnSec?: number // sin-binned players come back; reds never do
}

export interface RugbyPlayScript {
  passages: RugbyPassage[] // ordered; sim windows tile [0, matchEnd] exactly
  matchEnd: number // final sim clock in seconds (>= 4800)
  sendOffs: RugbySendOff[]
}

// --- pacing constants (seconds of render time per featured moment) ---
// Rugby packs far more scoring beats into a match than soccer (a try+conversion
// alone is two strikes), so per-beat dwell is tighter and the budget higher;
// the director's global scale still lands the play window at 48-62s.
const DUR: Record<Exclude<RugbyPassageOutcome, 'flow'>, number> = {
  try: 6.0,
  penGoal: 4.2,
  penMiss: 3.6,
  dropGoal: 3.4,
  dropMiss: 3.2,
  break: 3.0,
  card: 3.4,
}
const CORNER_EXTRA = 1.6 // lineout-drive theatre earns extra dwell
const FEATURE_BUDGET = 54 // musts (tries, kicked goals, reds) always fit regardless
const MAX_FEATURED = 15
const HALF_SEC = 40 * 60
const MAX_BRIDGE_SPAN = 500
const ABSORB_GAP = 60
const SPEED_FLOOR = 0.95 // render seconds per weight unit

const PEN_MISS_LABELS = ['PUSHED WIDE!', 'NO GOOD', 'OFF THE TEE — WIDE'] as const
const DROP_MISS_LABELS = ['DROP ATTEMPT — WIDE', 'FALLS SHORT!', 'JUST WIDE'] as const

function clamp(x: number, lo: number, hi: number): number {
  return x < lo ? lo : x > hi ? hi : x
}
function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t
}
function jit(rng: () => number, amt: number): number {
  return (rng() * 2 - 1) * amt
}
function manLen(a: readonly [number, number], b: readonly [number, number]): number {
  const dx = a[0] - b[0]
  const dy = a[1] - b[1]
  return (dx < 0 ? -dx : dx) + (dy < 0 ? -dy : dy)
}
function clampPt(p: [number, number]): [number, number] {
  return [clamp(p[0], 0.06, 0.94), clamp(p[1], 0.05, 0.95)]
}
function opp(s: Side): Side {
  return s === 'home' ? 'away' : 'home'
}
function pick<T>(rng: () => number, arr: readonly T[]): T {
  return arr[Math.floor(rng() * arr.length) % arr.length]
}
function passW(a: readonly [number, number], b: readonly [number, number]): number {
  return Math.max(0.35, manLen(a, b))
}
/** y just past the try line the `team` attacks (in-goal overshoot). */
function tryLineY(team: Side, depth: number): number {
  return team === 'home' ? -depth : 1 + depth
}
/** Attacking y-direction: home attacks the top (y decreasing). */
function attackDir(team: Side): number {
  return team === 'home' ? -1 : 1
}

interface Cand {
  pi: number
  must: boolean
  score: number
  dur: number
  kind: Exclude<RugbyPassageOutcome, 'flow'>
  ev: RugbyMatchEvent
  cardType?: 'yellow' | 'red'
  conv?: 'good' | 'miss'
  convEventId?: number
  viaCorner?: boolean
}

/**
 * Deterministically expand a RugbyMatchResult into a continuous play script:
 * every featured moment staged as rugby (phases, set pieces, kicks at goal),
 * every stretch in between bridged with carry-ruck-pass flow and kick tennis.
 */
export function buildRugbyPlayScript(m: RugbyMatchResult): RugbyPlayScript {
  const rng = makeRng(m.config.seedKey + ':pbp')
  const eventsById = new Map(m.events.map((e) => [e.id, e]))
  const poss = m.possessions
  const matchEnd = poss.length ? poss[poss.length - 1].end : 80 * 60

  // Cards walk a player off. Picked FIRST so the ':pbp' draw order is stable.
  // Yellows return after 10 sim-minutes; reds are gone for good.
  const sendOffs: RugbySendOff[] = m.events
    .filter((e) => (e.type === 'yellow' || e.type === 'red') && e.team)
    .map((e) => ({
      team: e.team as Side,
      slot: 1 + Math.floor(rng() * 9),
      simSec: e.minute * 60,
      returnSec: e.type === 'yellow' ? e.minute * 60 + 600 : undefined,
    }))
  const offSlots = (team: Side, simSec: number): number[] =>
    sendOffs
      .filter(
        (s) =>
          s.team === team && simSec >= s.simSec && (s.returnSec === undefined || simSec < s.returnSec),
      )
      .map((s) => s.slot)

  // ---- 1) resolve each span's event chain and pick the featured ones ----
  // Chain conventions are frozen in rugbySim: try→conversion at id+1;
  // penalty award → optional card at id+1 → optional resolution right after.
  const cands: Cand[] = []
  poss.forEach((p, pi) => {
    if (p.eventId === undefined) return
    const ev = eventsById.get(p.eventId)
    if (!ev) return

    const withConv = (tryEv: RugbyMatchEvent): { conv: 'good' | 'miss'; convEventId: number } => {
      const c = eventsById.get(tryEv.id + 1)
      return c && c.type === 'conversion'
        ? { conv: 'good', convEventId: c.id }
        : { conv: 'miss', convEventId: tryEv.id + 1 }
    }

    if (p.outcome === 'try') {
      cands.push({ pi, must: true, score: 10, dur: DUR.try, kind: 'try', ev, ...withConv(ev) })
    } else if (p.outcome === 'drop') {
      if (ev.type === 'dropGoal') {
        cands.push({ pi, must: true, score: 8, dur: DUR.dropGoal, kind: 'dropGoal', ev })
      } else {
        cands.push({ pi, must: false, score: 0.4, dur: DUR.dropMiss, kind: 'dropMiss', ev })
      }
    } else if (p.outcome === 'break') {
      cands.push({ pi, must: false, score: 0.3, dur: DUR.break, kind: 'break', ev })
    } else if (p.outcome === 'penalty') {
      const nxt = eventsById.get(p.eventId + 1)
      const hasCard = nxt && (nxt.type === 'yellow' || nxt.type === 'red')
      const cardType = hasCard ? (nxt.type as 'yellow' | 'red') : undefined
      // the sim records exactly which event resolved this award — never guess
      const res = p.resEventId !== undefined ? eventsById.get(p.resEventId) : undefined
      if (res && res.type === 'penaltyGoal') {
        cands.push({ pi, must: true, score: 8, dur: DUR.penGoal, kind: 'penGoal', ev: res, cardType })
      } else if (res && res.type === 'penaltyMiss') {
        cands.push({
          pi,
          must: cardType === 'red',
          score: cardType ? 2 : 0.45,
          dur: DUR.penMiss,
          kind: 'penMiss',
          ev: res,
          cardType,
        })
      } else if (res && res.type === 'try') {
        cands.push({
          pi,
          must: true,
          score: 10,
          dur: DUR.try + CORNER_EXTRA,
          kind: 'try',
          ev: res,
          cardType,
          viaCorner: true,
          ...withConv(res),
        })
      } else if (res && res.type === 'break') {
        cands.push({
          pi,
          must: cardType === 'red',
          score: cardType ? 2 : 0.45,
          dur: DUR.break + CORNER_EXTRA,
          kind: 'break',
          ev: res,
          cardType,
          viaCorner: true,
        })
      } else if (cardType) {
        // award + card, drive defended — the card is the story
        cands.push({
          pi,
          must: cardType === 'red',
          score: cardType === 'red' ? 9 : 0.5,
          dur: DUR.card,
          kind: 'card',
          ev: nxt as RugbyMatchEvent,
          cardType,
        })
      }
    }
  })
  cands.sort((a, b) => (b.must ? 1 : 0) - (a.must ? 1 : 0) || b.score - a.score || a.pi - b.pi)
  const chosen: Cand[] = []
  let spent = 0
  for (const c of cands) {
    if (c.must) {
      chosen.push(c)
      spent += c.dur
      continue
    }
    if (spent + c.dur > FEATURE_BUDGET || chosen.length >= MAX_FEATURED) continue
    chosen.push(c)
    spent += c.dur
  }
  chosen.sort((a, b) => a.pi - b.pi)

  // ---- 2) build the continuous passage chain ----
  const passages: RugbyPassage[] = []
  let ballAt: [number, number] = [RUGBY_CENTER[0], RUGBY_CENTER[1]]
  let lastOutcome: 'kickoff' | RugbyPassageOutcome = 'kickoff'
  let lastKicker: Side = 'home'
  let lastSlot = -1

  /** A backward/lateral pass — NEVER gains ground toward the attacked line. */
  const passTo = (
    touches: RugbyTouch[],
    team: Side,
    simSec: number,
    lateral: number,
    back: number,
    risky = false,
    arc = 0,
  ): void => {
    const dir = attackDir(team)
    const to = clampPt([ballAt[0] + lateral, ballAt[1] - dir * back])
    // clamping x is safe; y clamps only ever pull the pass FURTHER backward
    lastSlot = rugbyNearestSlot(team, to[0], to[1], lastSlot, offSlots(team, simSec))
    touches.push({ kind: 'pass', team, from: ballAt, to, slot: lastSlot, w: passW(ballAt, to), arc, risky })
    ballAt = to
  }

  const carryTo = (
    touches: RugbyTouch[],
    team: Side,
    simSec: number,
    to: [number, number],
    risky = false,
  ): void => {
    lastSlot = rugbyNearestSlot(team, to[0], to[1], lastSlot, offSlots(team, simSec))
    // long carries earn extra weight so a big run gets proportionally more
    // render time — belt-and-braces with the scene's linear easing for them
    const w = Math.max(0.35, manLen(ballAt, to) * 1.15)
    touches.push({ kind: 'carry', team, from: ballAt, to, slot: lastSlot, w, arc: 0, risky })
    ballAt = to
  }

  const holdBall = (touches: RugbyTouch[], team: Side, w: number, tag?: RugbyTouchTag): void => {
    touches.push({
      kind: 'held',
      team,
      from: ballAt,
      to: ballAt,
      slot: lastSlot,
      w,
      arc: 0,
      risky: false,
      tag,
    })
  }

  /**
   * One-to-N rugby phases toward `target`: carry into contact, a beat of
   * ruck, a backward pass out the back. The fundamental unit of rugby shape.
   */
  const phasesTowards = (
    touches: RugbyTouch[],
    team: Side,
    simSec: number,
    target: readonly [number, number],
    n: number,
  ): void => {
    const dir = attackDir(team)
    for (let i = 0; i < n; i++) {
      const gain = 0.06 + rng() * 0.08
      const cx = clamp(lerp(ballAt[0], target[0], 0.45) + jit(rng, 0.08), 0.06, 0.94)
      const cy = clamp(ballAt[1] + dir * gain, 0.05, 0.95)
      carryTo(touches, team, simSec, [cx, cy])
      if (rng() < 0.7) holdBall(touches, team, 0.25 + rng() * 0.2, 'ruck')
      const lat = (target[0] >= ballAt[0] ? 1 : -1) * (0.1 + rng() * 0.18)
      passTo(touches, team, simSec, lat, 0.015 + rng() * 0.03)
    }
  }

  /** Restart prefix demanded by how the previous passage ended. */
  const openTouches = (team: Side, simSec: number): RugbyTouch[] => {
    const prefix: RugbyTouch[] = []
    if (
      lastOutcome === 'kickoff' ||
      lastOutcome === 'try' ||
      lastOutcome === 'penGoal' ||
      lastOutcome === 'dropGoal'
    ) {
      // scores restart from halfway: the conceding side boots it long and the
      // receiving side's fullback fields it deep in his own half
      if (ballAt[0] !== RUGBY_CENTER[0] || ballAt[1] !== RUGBY_CENTER[1]) {
        const to: [number, number] = [RUGBY_CENTER[0], RUGBY_CENTER[1]]
        const kicker = rugbyNearestSlot(opp(team), to[0], to[1], -1, offSlots(opp(team), simSec))
        prefix.push({
          kind: 'restart',
          team: opp(team),
          from: ballAt,
          to,
          slot: kicker,
          w: Math.max(0.4, manLen(ballAt, to) * 1.1),
          arc: 0,
          risky: false,
        })
        ballAt = to
      }
      const dir = attackDir(team)
      const catchAt = clampPt([0.3 + rng() * 0.4, 0.5 - dir * (0.24 + rng() * 0.12)])
      prefix.push({
        kind: 'kick',
        team,
        from: ballAt,
        to: catchAt,
        slot: FULLBACK_SLOT,
        w: Math.max(0.5, manLen(ballAt, catchAt) * 1.05),
        arc: 1,
        risky: false,
      })
      ballAt = catchAt
      lastSlot = FULLBACK_SLOT
    } else if (lastOutcome === 'penMiss' || lastOutcome === 'dropMiss') {
      // dead behind the posts — the defending side drops out from their 22
      const outSide = opp(lastKicker)
      const dir = attackDir(outSide)
      const spot = clampPt([0.42 + rng() * 0.16, 0.5 - dir * 0.28])
      prefix.push({
        kind: 'restart',
        team: outSide,
        from: ballAt,
        to: spot,
        slot: FULLBACK_SLOT,
        w: Math.max(0.4, manLen(ballAt, spot) * 1.1),
        arc: 0,
        risky: false,
      })
      ballAt = spot
      if (team !== outSide) {
        // the exit kick — caught by the other side's fullback
        const catchAt = clampPt([0.25 + rng() * 0.5, 0.5 - attackDir(team) * (0.18 + rng() * 0.14)])
        prefix.push({
          kind: 'kick',
          team,
          from: ballAt,
          to: catchAt,
          slot: FULLBACK_SLOT,
          w: Math.max(0.5, manLen(ballAt, catchAt) * 1.05),
          arc: 1,
          risky: false,
        })
        ballAt = catchAt
      }
      lastSlot = FULLBACK_SLOT
    }
    lastOutcome = 'flow'
    return prefix
  }

  const pushBridge = (s0: number, s1: number, nextTeam: Side): void => {
    let a = s0
    while (a < s1) {
      const b = s1 - a > MAX_BRIDGE_SPAN ? a + MAX_BRIDGE_SPAN : s1
      const steal = rng() < 0.5
      const passerTeam = steal ? opp(nextTeam) : nextTeam
      const touches = openTouches(passerTeam, a)
      const kickChange = steal && rng() < 0.55
      const dir = attackDir(nextTeam)
      const zone = clampPt([0.25 + rng() * 0.5, 0.5 - dir * (0.14 + rng() * 0.16)])
      // route through halfway when this stretch crosses half-time
      if (a < HALF_SEC && b >= HALF_SEC) {
        carryTo(touches, passerTeam, a, clampPt([0.5 + jit(rng, 0.05), 0.5 + jit(rng, 0.04)]))
        holdBall(touches, passerTeam, 0.3, 'ruck')
      }
      if (kickChange) {
        // clear the lines — the chasing fullback fields the kick
        phasesTowards(touches, passerTeam, a, [0.5, 0.5], 1)
        touches.push({
          kind: 'kick',
          team: nextTeam,
          from: ballAt,
          to: zone,
          slot: FULLBACK_SLOT,
          w: Math.max(0.5, manLen(ballAt, zone) * 1.05),
          arc: 1,
          risky: false,
        })
        ballAt = zone
        lastSlot = FULLBACK_SLOT
      } else if (steal) {
        // turned over at the breakdown — the jackal wins it
        phasesTowards(touches, passerTeam, a, zone, 1 + (rng() < 0.5 ? 1 : 0))
        if (touches.length) touches[touches.length - 1].risky = true
        const s = rugbyNearestSlot(nextTeam, ballAt[0], ballAt[1], -1, offSlots(nextTeam, a))
        touches.push({
          kind: 'intercept',
          team: nextTeam,
          from: ballAt,
          to: ballAt,
          slot: s,
          w: 0.45,
          arc: 0,
          risky: false,
        })
        lastSlot = s
      } else {
        phasesTowards(touches, nextTeam, a, zone, 1 + (rng() < 0.5 ? 1 : 0))
      }
      const wsum = touches.reduce((s, x) => s + x.w, 0)
      passages.push({
        simStart: a,
        simEnd: b,
        team: nextTeam,
        kind: 'bridge',
        outcome: 'flow',
        renderDur: clamp(wsum * SPEED_FLOOR, 1.5, 3.0),
        touches,
        minute: Math.floor(b / 60),
      })
      a = b
    }
  }

  /** The tee routine shared by conversions and penalty shots. Ends with ballAt dead. */
  const kickAtPosts = (
    touches: RugbyTouch[],
    team: Side,
    good: boolean,
    teeW: number,
  ): void => {
    holdBall(touches, team, teeW, 'tee')
    const to: [number, number] = good
      ? [0.5 + jit(rng, 0.018), tryLineY(team, 0.035)]
      : [0.5 + (rng() < 0.5 ? -1 : 1) * (0.075 + rng() * 0.09), tryLineY(team, 0.015)]
    touches.push({ kind: 'shot', team, from: ballAt, to, slot: -1, w: 0.4, arc: 1, risky: false })
    ballAt = to
    touches.push({ kind: 'held', team, from: to, to, slot: -1, w: 0.35, arc: 0, risky: false })
  }

  const buildFeatured = (c: Cand, simStart: number, simEnd: number): void => {
    const p = poss[c.pi]
    const team = p.team
    const dir = attackDir(team)
    const touches = openTouches(team, simStart)
    const ev = c.ev
    let label: string | undefined = ev.label

    // events store xy in formation space already (home attacks top)
    const X = ev.xy ? clamp(ev.xy[0], 0.08, 0.92) : 0.5
    const evY = ev.xy ? ev.xy[1] : team === 'home' ? 0.2 : 0.8

    const cardStop = (): void => {
      if (!c.cardType) return
      holdBall(touches, team, 1.1, 'card')
    }

    if (c.kind === 'try' && c.viaCorner) {
      // penalty → corner → lineout → maul → over the top
      phasesTowards(touches, team, simStart, [X, 0.5 + dir * 0.1], 1)
      holdBall(touches, team, 0.5, 'award')
      cardStop()
      const cornerX = X < 0.5 ? 0.07 : 0.93
      const cornerAt: [number, number] = [cornerX, clamp(0.5 + dir * 0.44, 0.05, 0.95)]
      const catcher = rugbyNearestSlot(team, cornerAt[0], cornerAt[1], -1, offSlots(team, simStart))
      touches.push({ kind: 'kick', team, from: ballAt, to: cornerAt, slot: catcher, w: Math.max(0.5, manLen(ballAt, cornerAt) * 1.05), arc: 0.9, risky: false })
      ballAt = cornerAt
      lastSlot = catcher
      const lineoutAt: [number, number] = [cornerX < 0.5 ? cornerX + 0.05 : cornerX - 0.05, ballAt[1]]
      lastSlot = rugbyNearestSlot(team, lineoutAt[0], lineoutAt[1], lastSlot, offSlots(team, simStart))
      touches.push({ kind: 'restart', team, from: ballAt, to: lineoutAt, slot: lastSlot, w: 0.5, arc: 0.4, risky: false, tag: 'lineout' })
      ballAt = lineoutAt
      holdBall(touches, team, 1.4, 'maul')
      carryTo(touches, team, simStart, clampPt([lineoutAt[0] + jit(rng, 0.04), lineoutAt[1] + dir * 0.04]))
      const G: [number, number] = [X, tryLineY(team, 0.025)]
      lastSlot = rugbyNearestSlot(team, X, ballAt[1], lastSlot, offSlots(team, simStart))
      touches.push({ kind: 'grounding', team, from: ballAt, to: G, slot: lastSlot, w: Math.max(0.3, manLen(ballAt, G)), arc: 0, risky: true })
      ballAt = G
      holdBall(touches, team, 1.15, 'celebrate')
    } else if (c.kind === 'try') {
      // open play: phases upfield, then the backline sweep and the break
      phasesTowards(touches, team, simStart, [X, 0.5 + dir * 0.16], 2)
      passTo(touches, team, simStart, X >= ballAt[0] ? 0.12 : -0.12, 0.02, false, 0.2)
      passTo(touches, team, simStart, X >= ballAt[0] ? 0.14 : -0.14, 0.015, true, 0.35)
      const breakAt = clampPt([lerp(ballAt[0], X, 0.8), 0.5 + dir * 0.42])
      carryTo(touches, team, simStart, breakAt, true)
      const G: [number, number] = [X, tryLineY(team, 0.025)]
      lastSlot = rugbyNearestSlot(team, X, breakAt[1], lastSlot, offSlots(team, simStart))
      touches.push({ kind: 'grounding', team, from: ballAt, to: G, slot: lastSlot, w: Math.max(0.3, manLen(ballAt, G)), arc: 0, risky: false })
      ballAt = G
      holdBall(touches, team, 1.15, 'celebrate')
    } else if (c.kind === 'penGoal' || c.kind === 'penMiss') {
      const K = clampPt([X, evY])
      phasesTowards(touches, team, simStart, K, 1)
      carryTo(touches, team, simStart, K)
      holdBall(touches, team, 0.45, 'award')
      cardStop()
      kickAtPosts(touches, team, c.kind === 'penGoal', 0.9)
      lastKicker = team
      if (c.kind === 'penMiss') label = label ?? pick(rng, PEN_MISS_LABELS)
    } else if (c.kind === 'dropGoal' || c.kind === 'dropMiss') {
      const K = clampPt([X, evY])
      phasesTowards(touches, team, simStart, K, 1)
      // dropped back to the pocket, snapped over
      passTo(touches, team, simStart, jit(rng, 0.06), 0.045, false, 0.25)
      const good = c.kind === 'dropGoal'
      const to: [number, number] = good
        ? [0.5 + jit(rng, 0.02), tryLineY(team, 0.035)]
        : [0.5 + (rng() < 0.5 ? -1 : 1) * (0.07 + rng() * 0.08), tryLineY(team, 0.012)]
      touches.push({ kind: 'shot', team, from: ballAt, to, slot: -1, w: 0.4, arc: 0.9, risky: true })
      ballAt = to
      touches.push({ kind: 'held', team, from: to, to, slot: -1, w: 0.35, arc: 0, risky: false })
      lastKicker = team
      if (!good) label = label ?? pick(rng, DROP_MISS_LABELS)
    } else if (c.kind === 'break' && c.viaCorner) {
      // penalty to the corner, maul formed... and held up short
      phasesTowards(touches, team, simStart, [X, 0.5 + dir * 0.1], 1)
      holdBall(touches, team, 0.5, 'award')
      cardStop()
      const cornerX = X < 0.5 ? 0.07 : 0.93
      const cornerAt: [number, number] = [cornerX, clamp(0.5 + dir * 0.44, 0.05, 0.95)]
      const catcher = rugbyNearestSlot(team, cornerAt[0], cornerAt[1], -1, offSlots(team, simStart))
      touches.push({ kind: 'kick', team, from: ballAt, to: cornerAt, slot: catcher, w: Math.max(0.5, manLen(ballAt, cornerAt) * 1.05), arc: 0.9, risky: false })
      ballAt = cornerAt
      lastSlot = catcher
      holdBall(touches, team, 1.7, 'maul')
      const s = rugbyNearestSlot(opp(team), ballAt[0], ballAt[1], -1, offSlots(opp(team), simStart))
      touches.push({ kind: 'intercept', team: opp(team), from: ballAt, to: ballAt, slot: s, w: 0.5, arc: 0, risky: false })
      lastSlot = s
    } else if (c.kind === 'break') {
      // the line break — and the scrambling tackle that kills it
      const B = clampPt([X, evY])
      phasesTowards(touches, team, simStart, B, 1)
      passTo(touches, team, simStart, B[0] >= ballAt[0] ? 0.14 : -0.14, 0.02, true, 0.35)
      carryTo(touches, team, simStart, B, true)
      const s = rugbyNearestSlot(opp(team), B[0], B[1], -1, offSlots(opp(team), simStart))
      touches.push({ kind: 'intercept', team: opp(team), from: ballAt, to: ballAt, slot: s, w: 0.5, arc: 0, risky: false })
      lastSlot = s
    } else {
      // card with no on-field resolution: the stoppage IS the moment
      phasesTowards(touches, team, simStart, [0.5, 0.5 + dir * 0.2], 1)
      holdBall(touches, team, 0.5, 'award')
      holdBall(touches, team, 1.3, 'card')
    }

    if (c.kind === 'try') {
      // conversion, from in line with the grounding
      const tee = clampPt([clamp(X, 0.18, 0.82), 0.5 + dir * (0.5 - 0.115)])
      const kicker = rugbyNearestSlot(team, tee[0], tee[1], -1, offSlots(team, simStart))
      touches.push({ kind: 'restart', team, from: ballAt, to: tee, slot: kicker, w: 0.55, arc: 0, risky: false })
      ballAt = tee
      lastSlot = kicker
      kickAtPosts(touches, team, c.conv === 'good', 0.7)
      lastOutcome = 'try'
    } else {
      lastOutcome = c.kind
    }

    const wsum = touches.reduce((s, x) => s + x.w, 0)
    passages.push({
      simStart,
      simEnd,
      team,
      kind: 'featured',
      outcome: c.kind,
      renderDur: Math.max(DUR[c.kind] + (c.viaCorner ? CORNER_EXTRA : 0), wsum * SPEED_FLOOR),
      touches,
      minute: ev.minute,
      eventId: ev.id,
      cardType: c.cardType,
      label,
      conv: c.conv,
      convEventId: c.convEventId,
      viaCorner: c.viaCorner,
    })
  }

  let cursor = 0
  for (const c of chosen) {
    const p = poss[c.pi]
    let simStart = p.start
    if (p.start - cursor >= ABSORB_GAP) {
      pushBridge(cursor, p.start, p.team)
    } else {
      simStart = cursor // absorb the tiny gap so the clock never skips
    }
    buildFeatured(c, simStart, p.end)
    cursor = p.end
  }
  if (cursor < matchEnd) {
    pushBridge(cursor, matchEnd, rng() < 0.5 ? 'home' : 'away')
  }

  return { passages, matchEnd, sendOffs }
}
