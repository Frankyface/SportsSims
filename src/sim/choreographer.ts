// The choreographer — the deterministic "match editor" of the continuous-play
// engine. It expands a MatchResult's possession spans into an unbroken chain
// of ball touches (passes, carries, risky through-balls, interceptions, shots,
// saves, misses, restarts) that a director can lay out on a render timeline.
//
// Rules of the room:
// - ALL randomness comes from ONE seeded PRNG on a SEPARATE stream
//   (`seedKey + ':pbp'`) — it never touches the frozen score-deciding stream,
//   so saved league results stay byte-identical.
// - Determinism hygiene applies (this is src/sim): no transcendental math,
//   no Math.random/Date.now. Arithmetic, comparisons and the PRNG only.
// - Ball continuity is sacred: every touch starts exactly where the previous
//   touch ended, across the whole match. No teleports.

import { makeRng } from './prng'
import { CENTER, KEEPER_SLOT, nearestSlot, slotBase } from './formation'
import type { MatchEvent, MatchResult, Side } from './types'

export type TouchKind = 'pass' | 'carry' | 'shot' | 'save' | 'intercept' | 'restart' | 'held'

export interface Touch {
  kind: TouchKind
  team: Side // team of the acting player (receiver / interceptor / shooter)
  from: [number, number]
  to: [number, number]
  slot: number // player slot acting on the ball at `to` (-1 = none, e.g. ball in net)
  w: number // relative duration weight within the passage
  arc: number // 0 = ground ball; >0 = lofted (visual only)
  risky: boolean // a gamble ball — long switch / through-ball (turnover risk visual)
}

export type PassageOutcome =
  | 'goal'
  | 'bigChanceSaved'
  | 'bigChanceMiss'
  | 'save'
  | 'miss'
  | 'card'
  | 'flow'

export interface Passage {
  simStart: number // match-clock seconds this passage covers (contiguous over the match)
  simEnd: number
  team: Side // primary attacking team
  kind: 'featured' | 'bridge'
  outcome: PassageOutcome
  renderDur: number // seconds of render time the director should give this passage
  touches: Touch[]
  minute: number // event minute (featured passages) for overlays
  eventId?: number
  xg?: number
  cardType?: 'yellow' | 'red'
  label?: string
  corner?: boolean // staged as a corner-kick sequence
}

export interface SendOff {
  team: Side
  slot: number // the player who walks (never the keeper)
  simSec: number
}

export interface PlayScript {
  passages: Passage[] // ordered; sim windows tile [0, matchEnd] exactly
  matchEnd: number // final sim clock in seconds (>= 5400)
  sendOffs: SendOff[] // red cards — this player is OFF from simSec onward
}

// --- pacing constants (seconds of render time per featured moment) ---
// Square-race pacing: ~1.4x dwell on every featured beat, slower ball travel,
// and many more visible bridge passes — audited across 600 seeds to land the
// play window at 48-62s (total video ~55-69s) with the anti-teleport gate at
// ~38% margin (worst measured 98.7px/frame vs the 160 limit).
const DUR: Record<Exclude<PassageOutcome, 'flow'>, number> = {
  goal: 5.9,
  bigChanceSaved: 3.6,
  bigChanceMiss: 3.4,
  save: 3.1,
  miss: 2.8,
  card: 3.4,
}
const FEATURE_BUDGET = 27 // seconds of featured render time (musts always fit)
const MAX_FEATURED = 11
const HALF_SEC = 45 * 60
const MAX_BRIDGE_SPAN = 500 // split featureless stretches longer than this (sim seconds)
const ABSORB_GAP = 60 // gaps shorter than this merge into the next featured window

// goal mouth geometry (normalized pitch space; matches the renderer's boxes)
const POST_L = 0.3365
const POST_R = 0.6635

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
// Touch weights are DISTANCE-PROPORTIONAL so the ball travels at a steady,
// watchable speed within a passage no matter how the render time is divided
// (a fixed-weight long ball inside a short bridge would streak across the
// pitch in 2-3 frames — the "teleport" jank this engine exists to kill).
function passW(a: readonly [number, number], b: readonly [number, number]): number {
  return Math.max(0.35, manLen(a, b))
}
const SPEED_FLOOR = 0.95 // render seconds per weight unit — floors passage duration by distance
/** Goal-line y for the goal `team` attacks (just past the line = in the net). */
function goalLineY(team: Side, depth: number): number {
  return team === 'home' ? -depth : 1 + depth
}

const SAVE_LABELS = ['WHAT A SAVE!', 'KEPT OUT!', 'DENIED!'] as const
const POST_LABELS = ['OFF THE POST!', 'INCHES WIDE!', 'SO CLOSE!'] as const
const PLAIN_SAVE_LABELS = ['SAVE', 'HELD BY THE KEEPER', 'SMOTHERED'] as const
const MISS_LABELS = ['WIDE!', 'OFF TARGET', 'DRAGGED WIDE'] as const

interface Cand {
  pi: number
  must: boolean
  score: number
  dur: number
  kind: Exclude<PassageOutcome, 'flow'>
  ev: MatchEvent
  cardType?: 'yellow' | 'red'
}

/**
 * Deterministically expand a MatchResult into a continuous play script:
 * every featured chance staged as a passing chain, every stretch in between
 * bridged with flowing (sometimes intercepted) build-up play.
 */
export function buildPlayScript(m: MatchResult): PlayScript {
  const rng = makeRng(m.config.seedKey + ':pbp')
  const eventsById = new Map(m.events.map((e) => [e.id, e]))
  const poss = m.possessions
  const matchEnd = poss.length ? poss[poss.length - 1].end : 90 * 60

  // Red cards send a player OFF. Picked first so the ':pbp' draw order is
  // stable; from simSec onward that slot never touches the ball again.
  const sendOffs: SendOff[] = m.events
    .filter((e) => e.type === 'red' && e.team)
    .map((e) => ({ team: e.team as Side, slot: 1 + Math.floor(rng() * 7), simSec: e.minute * 60 }))
  const redSlotFor = (team: Side, simSec: number): number => {
    const so = sendOffs.find((s) => s.team === team && simSec >= s.simSec)
    return so ? so.slot : -1
  }

  // ---- 1) pick which possessions get the featured treatment ----
  const cands: Cand[] = []
  poss.forEach((p, pi) => {
    if (p.eventId === undefined) return
    const ev = eventsById.get(p.eventId)
    if (!ev) return
    if (p.outcome === 'shot') {
      const xg = ev.xg ?? 0.05
      if (ev.type === 'goal') {
        cands.push({ pi, must: true, score: 10, dur: DUR.goal, kind: 'goal', ev })
      } else if (ev.type === 'bigChance') {
        const kind = ev.onTarget ? 'bigChanceSaved' : 'bigChanceMiss'
        cands.push({ pi, must: false, score: 0.3 + xg, dur: DUR[kind], kind, ev })
      } else if (ev.type === 'save') {
        cands.push({ pi, must: false, score: 0.12 + xg, dur: DUR.save, kind: 'save', ev })
      } else {
        cands.push({ pi, must: false, score: xg, dur: DUR.miss, kind: 'miss', ev })
      }
    } else if (p.outcome === 'foul') {
      // a card event, if any, is pushed immediately after its foul (consecutive id)
      const nxt = eventsById.get(p.eventId + 1)
      if (nxt && (nxt.type === 'yellow' || nxt.type === 'red')) {
        cands.push({
          pi,
          must: nxt.type === 'red',
          score: nxt.type === 'red' ? 9 : 0.2,
          dur: DUR.card,
          kind: 'card',
          ev: nxt,
          cardType: nxt.type,
        })
      }
    }
  })
  cands.sort(
    (a, b) => (b.must ? 1 : 0) - (a.must ? 1 : 0) || b.score - a.score || a.pi - b.pi,
  )
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
  const passages: Passage[] = []
  let ballAt: [number, number] = [CENTER[0], CENTER[1]]
  let lastOutcome: 'kickoff' | PassageOutcome = 'kickoff'
  let lastShooter: Side = 'home'

  /** Restart prefix demanded by how the previous passage ended (keeps continuity). */
  const openTouches = (team: Side, simSec: number): Touch[] => {
    const prefix: Touch[] = []
    if (lastOutcome === 'goal' || lastOutcome === 'kickoff') {
      // retrieve to the centre spot and kick off
      if (ballAt[0] !== CENTER[0] || ballAt[1] !== CENTER[1]) {
        const to: [number, number] = [CENTER[0], CENTER[1]]
        prefix.push({
          kind: 'restart',
          team,
          from: ballAt,
          to,
          slot: nearestSlot(team, CENTER[0], CENTER[1], -1, redSlotFor(team, simSec)),
          w: Math.max(0.4, manLen(ballAt, to) * 1.1),
          arc: 0,
          risky: false,
        })
        ballAt = to
      }
    } else if (lastOutcome === 'miss' || lastOutcome === 'bigChanceMiss') {
      // ball went out — the keeper who faced the shot collects for the goal kick
      const gkSide = opp(lastShooter)
      const gk = slotBase(gkSide, KEEPER_SLOT)
      const spot: [number, number] = [gk[0], gkSide === 'home' ? gk[1] - 0.05 : gk[1] + 0.05]
      prefix.push({
        kind: 'restart',
        team: gkSide,
        from: ballAt,
        to: spot,
        slot: KEEPER_SLOT,
        w: Math.max(0.4, manLen(ballAt, spot) * 1.1),
        arc: 0,
        risky: false,
      })
      ballAt = spot
    }
    lastOutcome = 'flow'
    return prefix
  }

  /** Waypoints from `from` towards `target`, jittered, clamped, ending exactly on target. */
  const walk = (
    from: [number, number],
    target: [number, number],
    steps: number,
  ): Array<[number, number]> => {
    const wps: Array<[number, number]> = []
    for (let i = 0; i < steps - 1; i++) {
      const f = (i + 1) / steps
      wps.push(
        clampPt([
          lerp(from[0], target[0], f) + jit(rng, 0.12),
          lerp(from[1], target[1], f) + jit(rng, 0.07),
        ]),
      )
    }
    wps.push(target)
    return wps
  }

  const pushBridge = (s0: number, s1: number, nextTeam: Side): void => {
    // split long featureless stretches so the flow keeps changing shape
    let a = s0
    while (a < s1) {
      const b = s1 - a > MAX_BRIDGE_SPAN ? a + MAX_BRIDGE_SPAN : s1
      const steal = rng() < 0.45
      const passerTeam = steal ? opp(nextTeam) : nextTeam
      const touches = openTouches(passerTeam, a)
      // build zone: the next attacking team's own half, where moves begin
      const zone = clampPt([
        0.28 + rng() * 0.44,
        nextTeam === 'home' ? 0.62 + rng() * 0.16 : 0.22 + rng() * 0.16,
      ])
      let wps = walk(ballAt, zone, 3 + (rng() < 0.5 ? 1 : 0))
      // route through the centre circle when this stretch crosses half-time
      if (a < HALF_SEC && b >= HALF_SEC) {
        wps = [clampPt([0.5 + jit(rng, 0.04), 0.5 + jit(rng, 0.04)]), ...wps]
      }
      let slot = -1
      let from = ballAt
      wps.forEach((wp, i) => {
        const isLast = i === wps.length - 1
        if (steal && isLast) {
          if (touches.length) touches[touches.length - 1].risky = true
          const s = nearestSlot(nextTeam, wp[0], wp[1], -1, redSlotFor(nextTeam, a))
          touches.push({ kind: 'intercept', team: nextTeam, from, to: wp, slot: s, w: Math.max(0.4, manLen(from, wp)), arc: 0, risky: false })
        } else {
          slot = nearestSlot(passerTeam, wp[0], wp[1], slot, redSlotFor(passerTeam, a))
          const arc = manLen(from, wp) > 0.34 ? 0.35 : 0
          touches.push({ kind: 'pass', team: passerTeam, from, to: wp, slot, w: passW(from, wp), arc, risky: false })
        }
        from = wp
      })
      ballAt = from
      const wsum = touches.reduce((s, x) => s + x.w, 0)
      passages.push({
        simStart: a,
        simEnd: b,
        team: nextTeam,
        kind: 'bridge',
        outcome: 'flow',
        // floored by total travel distance so the ball keeps a watchable pace
        renderDur: clamp(wsum * SPEED_FLOOR, 1.5, 2.6),
        touches,
        minute: Math.floor(b / 60),
      })
      a = b
    }
  }

  const buildFeatured = (c: Cand, simStart: number, simEnd: number): void => {
    const p = poss[c.pi]
    const team = p.team
    const redMine = redSlotFor(team, simStart)
    const touches = openTouches(team, simStart)
    const ev = c.ev
    let label: string | undefined
    let corner = false
    let xg = ev.xg

    if (c.kind === 'card') {
      // build-up chopped down by a foul — stoppage while the card is shown,
      // placed in the fouled team's attacking half (home attacks the top)
      const spot = clampPt([
        0.2 + rng() * 0.6,
        team === 'home' ? 0.3 + rng() * 0.24 : 0.46 + rng() * 0.24,
      ])
      let slot = -1
      let from = ballAt
      for (const wp of walk(ballAt, spot, 2)) {
        slot = nearestSlot(team, wp[0], wp[1], slot, redMine)
        touches.push({ kind: 'pass', team, from, to: wp, slot, w: passW(from, wp), arc: 0, risky: false })
        from = wp
      }
      touches.push({ kind: 'held', team, from: spot, to: spot, slot, w: 1.2, arc: 0, risky: false })
      ballAt = spot
      lastOutcome = 'card'
      label = c.cardType === 'red' ? 'RED CARD' : 'YELLOW CARD'
    } else {
      // shot position from the sim: shotXY = [length-axis (1 = top goal), width-axis]
      const sx = ev.shotXY ? ev.shotXY[1] : 0.5
      const sy = ev.shotXY ? 1 - ev.shotXY[0] : team === 'home' ? 0.2 : 0.8
      const S = clampPt([sx, sy])
      let slot = -1
      let from = ballAt

      // Goals struck from right on the byline can be staged as CORNER headers:
      // attack forced out by a defender, corner swung in, scorer meets it.
      const nearByline = team === 'home' ? S[1] < 0.14 : S[1] > 0.86
      const cornerGoal = c.kind === 'goal' && nearByline && rng() < 0.6
      if (cornerGoal) {
        corner = true
        const wp = clampPt([
          lerp(from[0], S[0], 0.5) + jit(rng, 0.1),
          lerp(from[1], S[1], 0.55) + jit(rng, 0.06),
        ])
        slot = nearestSlot(team, wp[0], wp[1], -1, redMine)
        touches.push({ kind: 'pass', team, from, to: wp, slot, w: passW(from, wp), arc: 0, risky: false })
        // a defender gets a toe on it — out for a corner
        const outPt: [number, number] = [clamp(S[0] + jit(rng, 0.18), 0.12, 0.88), goalLineY(team, 0.012)]
        const defSlot = nearestSlot(opp(team), outPt[0], outPt[1], -1, redSlotFor(opp(team), simStart))
        touches.push({ kind: 'intercept', team: opp(team), from: wp, to: outPt, slot: defSlot, w: passW(wp, outPt), arc: 0.3, risky: false })
        const cornerSpot: [number, number] = [outPt[0] < 0.5 ? 0.035 : 0.965, goalLineY(team, -0.005)]
        const taker = nearestSlot(team, cornerSpot[0], cornerSpot[1], -1, redMine)
        touches.push({ kind: 'restart', team, from: outPt, to: cornerSpot, slot: taker, w: Math.max(0.4, manLen(outPt, cornerSpot) * 1.1), arc: 0, risky: false })
        // the cross, swung in under the bar for the scorer
        slot = nearestSlot(team, S[0], S[1], taker, redMine)
        touches.push({ kind: 'pass', team, from: cornerSpot, to: S, slot, w: passW(cornerSpot, S), arc: 0.9, risky: true })
        from = S
      } else {
        const nBuild = c.kind === 'goal' ? 3 : 2
        const wps = walk(ballAt, S, nBuild)
        wps.forEach((wp, i) => {
          const isLast = i === wps.length - 1
          slot = nearestSlot(team, wp[0], wp[1], slot, redMine)
          const long = manLen(from, wp) > 0.34
          // a big chance arrives on the end of a risky through-ball
          const risky = (isLast && (c.kind === 'bigChanceSaved' || c.kind === 'bigChanceMiss')) || long
          touches.push({
            kind: 'pass',
            team,
            from,
            to: wp,
            slot,
            w: passW(from, wp),
            arc: risky ? 0.5 : 0,
            risky,
          })
          from = wp
        })
      }

      const gx = 0.42 + rng() * 0.16
      if (c.kind === 'goal') {
        const G: [number, number] = [gx, goalLineY(team, 0.015)]
        touches.push({ kind: 'shot', team, from: S, to: G, slot: -1, w: 0.28, arc: 0, risky: false })
        touches.push({ kind: 'held', team, from: G, to: G, slot: -1, w: 1.15, arc: 0, risky: false })
        ballAt = G
        lastOutcome = 'goal'
        label = ev.label ?? 'GOAL'
      } else if (c.kind === 'save' || c.kind === 'bigChanceSaved') {
        const GT: [number, number] = [gx, goalLineY(team, -0.01)]
        touches.push({ kind: 'shot', team, from: S, to: GT, slot: -1, w: 0.28, arc: 0, risky: false })
        // some saves are tipped BEHIND — corner to the attacking team
        if (rng() < 0.38) {
          corner = true
          const outPt: [number, number] = [clamp(gx + jit(rng, 0.2), 0.15, 0.85), goalLineY(team, 0.012)]
          touches.push({ kind: 'save', team: opp(team), from: GT, to: outPt, slot: KEEPER_SLOT, w: 0.4, arc: 0.3, risky: false })
          const cornerSpot: [number, number] = [outPt[0] < 0.5 ? 0.035 : 0.965, goalLineY(team, -0.005)]
          const taker = nearestSlot(team, cornerSpot[0], cornerSpot[1], -1, redMine)
          touches.push({ kind: 'restart', team, from: outPt, to: cornerSpot, slot: taker, w: Math.max(0.4, manLen(outPt, cornerSpot) * 1.1), arc: 0, risky: false })
          const target: [number, number] = [0.42 + rng() * 0.16, team === 'home' ? 0.07 + rng() * 0.06 : 0.93 - rng() * 0.06]
          const header = nearestSlot(team, target[0], target[1], taker, redMine)
          touches.push({ kind: 'pass', team, from: cornerSpot, to: target, slot: header, w: passW(cornerSpot, target), arc: 0.9, risky: true })
          // headed clear by the defence
          const clearPt = clampPt([0.25 + rng() * 0.5, team === 'home' ? 0.3 + rng() * 0.12 : 0.58 + rng() * 0.12])
          const clearer = nearestSlot(opp(team), target[0], target[1], -1, redSlotFor(opp(team), simStart))
          touches.push({ kind: 'intercept', team: opp(team), from: target, to: clearPt, slot: clearer, w: passW(target, clearPt), arc: 0.4, risky: false })
          ballAt = clearPt
        } else {
          const parry: [number, number] = [
            clamp(gx + jit(rng, 0.14), 0.2, 0.8),
            team === 'home' ? 0.055 + rng() * 0.04 : 0.945 - rng() * 0.04,
          ]
          touches.push({ kind: 'save', team: opp(team), from: GT, to: parry, slot: KEEPER_SLOT, w: 0.4, arc: 0, risky: false })
          ballAt = parry
        }
        lastOutcome = c.kind
        label = c.kind === 'bigChanceSaved' ? pick(rng, SAVE_LABELS) : pick(rng, PLAIN_SAVE_LABELS)
      } else {
        // miss / bigChanceMiss — wide of a post (bigChance = agonizingly close)
        const left = rng() < 0.5
        const off = c.kind === 'bigChanceMiss' ? 0.015 + rng() * 0.03 : 0.05 + rng() * 0.1
        const wx = left ? POST_L - off : POST_R + off
        const W: [number, number] = [wx, goalLineY(team, 0.01)]
        touches.push({ kind: 'shot', team, from: S, to: W, slot: -1, w: 0.28, arc: 0, risky: false })
        ballAt = W
        lastOutcome = c.kind
        label = c.kind === 'bigChanceMiss' ? pick(rng, POST_LABELS) : pick(rng, MISS_LABELS)
      }
      lastShooter = team
    }

    const wsum = touches.reduce((s, x) => s + x.w, 0)
    passages.push({
      simStart,
      simEnd,
      team,
      kind: 'featured',
      outcome: c.kind,
      // floored by travel distance so a long build-up never gets squeezed into
      // a blur; corner sequences earn extra dwell for the set-piece theatre
      renderDur: Math.max(DUR[c.kind] + (corner ? 2.3 : 0), wsum * SPEED_FLOOR),
      touches,
      minute: ev.minute,
      eventId: ev.id,
      xg,
      cardType: c.cardType,
      label,
      corner: corner || undefined,
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
