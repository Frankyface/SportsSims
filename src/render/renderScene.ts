// Scene layer of the continuous-play renderer: the pitch, the moving players
// and the travelling ball. Everything here is a pure function of (plan, seed,
// t) — no accumulated state — so preview and export stay pixel-identical.
//
// NOT the deterministic sim: cosmetic wobble may use Math.sin/cos freely.

import { KEEPER_SLOT, SLOTS, slotBase } from '../sim/formation'
import type { Side } from '../sim/types'
import { segIndexAt, type BallSeg, type RenderPlan } from './director'

// Full-frame stadium layout (1080x1920). The bookends are pulled up tight
// (wordmark ~95, scorebug 150-250) and the pitch grows to fill most of the
// height, with DEEP tiered crowd terraces packing the space behind each goal
// so nothing reads as dead black. The pitch stays clear of the scorebug so a
// ball in the TOP net — the money shot — is never occluded.
// Vertical budget: bug 150-250 · topCrowd 256-376 · pitch 384-1776 · botCrowd 1780-1904.
export const PITCH = { x: 20, y: 384, w: 1040, h: 1392 } // w:h = 0.747 (believable pitch)
export const CROWD_TOP = { x: 20, y: 256, w: 1040, h: 120 }
export const CROWD_BOTTOM = { x: 20, y: 1780, w: 1040, h: 124 }
const AWAY_SECTION_FRAC = 0.26 // right end of the TOP stand belongs to away fans
const CROWD_ROWS = 5 // tiers per terrace
const ROW_STEP = 20 // px between tiers

type Ctx = CanvasRenderingContext2D

export function toPx(p: readonly [number, number]): [number, number] {
  return [PITCH.x + p[0] * PITCH.w, PITCH.y + p[1] * PITCH.h]
}

function easeInOut(t: number): number {
  return t < 0.5 ? 2 * t * t : 1 - ((-2 * t + 2) * (-2 * t + 2)) / 2
}
function easeOut(t: number): number {
  return 1 - (1 - t) * (1 - t)
}
function clamp01(x: number): number {
  return x < 0 ? 0 : x > 1 ? 1 : x
}
function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t
}

export interface BallState {
  x: number // canvas px
  y: number
  scale: number // >1 while a lofted ball is "in the air"
  seg: BallSeg
  p: number // raw progress through the segment
}

function segProgressEase(seg: BallSeg, p: number): number {
  if (seg.kind === 'held') return 0
  if (seg.kind === 'shot') return p // struck — full speed off the boot
  if (seg.kind === 'save') return easeOut(p)
  // restarts are the longest fixed traversals (net -> centre spot); linear keeps
  // their peak speed equal to their average so they can never spike over the
  // anti-teleport gate the way easeInOut's 2x mid-segment peak can
  if (seg.kind === 'restart') return p
  return easeInOut(p)
}

/** Ball position/flight at render-time t (clamped into the play window). */
export function ballStateAt(plan: RenderPlan, t: number): BallState {
  const idx = segIndexAt(plan, t)
  const seg = plan.segs[idx]
  const p = clamp01((t - seg.t0) / Math.max(1e-6, seg.t1 - seg.t0))
  const e = segProgressEase(seg, p)
  const nx = lerp(seg.from[0], seg.to[0], e)
  const ny = lerp(seg.from[1], seg.to[1], e)
  const [x, y] = toPx([nx, ny])
  const air = seg.arc > 0 ? seg.arc * 4 * p * (1 - p) : 0
  return { x, y, scale: 1 + air * 1.1, seg, p }
}


/**
 * Involvement of (side, slot) in nearby ball segments: players run to meet
 * their pass/interception/save before it arrives and linger briefly after.
 * Returns strength 0..1 and the point they are running to.
 */
function involvementAt(
  plan: RenderPlan,
  side: Side,
  slot: number,
  t: number,
): { k: number; tx: number; ty: number } {
  const PRE = 1.05
  const POST = 0.8
  const idx = segIndexAt(plan, t)
  let k = 0
  let tx = 0
  let ty = 0
  for (let i = Math.max(0, idx - 6); i < Math.min(plan.segs.length, idx + 6); i++) {
    const s = plan.segs[i]
    if (s.slot !== slot || s.team !== side || s.kind === 'held') continue
    let kk = 0
    if (t >= s.t1 - PRE && t <= s.t1) kk = (t - (s.t1 - PRE)) / PRE
    else if (t > s.t1 && t <= s.t1 + POST) kk = 1 - (t - s.t1) / POST
    if (kk > k) {
      k = kk
      tx = s.to[0]
      ty = s.to[1]
    }
  }
  return { k, tx, ty }
}

export interface TeamShift {
  home: number
  away: number
  /** Smoothed 0..1 "this side is defending LIVE play" gates — computed over a
   * ±0.45s window so pressing/box-collapse offsets ramp instead of popping at
   * segment boundaries (a boolean gate here teleported the whole back line). */
  defendHome: number
  defendAway: number
}

/** Per-frame tactical state: possession shift + smoothed defending gates. */
export function teamShiftAt(plan: RenderPlan, t: number): TeamShift {
  const idx = segIndexAt(plan, t)
  const w0 = t - 0.45
  const w1 = t + 0.45
  let all = 0
  let homePoss = 0
  let liveHome = 0
  let liveAway = 0
  for (let i = Math.max(0, idx - 10); i < Math.min(plan.segs.length, idx + 10); i++) {
    const s = plan.segs[i]
    const o = Math.min(w1, s.t1) - Math.max(w0, s.t0)
    if (o <= 0) continue
    all += o
    if (s.team === 'home') homePoss += o
    if (s.kind !== 'held' && s.kind !== 'restart') {
      if (s.team === 'home') liveHome += o
      else liveAway += o
    }
  }
  const fh = all > 0 ? homePoss / all : 0.5
  return {
    home: lerp(-0.05, 0.08, fh),
    away: lerp(-0.05, 0.08, 1 - fh),
    defendHome: all > 0 ? liveAway / all : 0,
    defendAway: all > 0 ? liveHome / all : 0,
  }
}

function clampN(x: number, lo: number, hi: number): number {
  return x < lo ? lo : x > hi ? hi : x
}

/**
 * Canvas position of one player dot at render-time t. Pure.
 *
 * Off-ball life is layered in this order (each layer is a pure function of
 * (plan, t), so preview and export stay identical):
 *   1. formation base + possession push/drop
 *   2. whole-team lean toward the ball's depth and lane (lines move together)
 *   3. defenders: box collapse goal-side + distance-based closing-down press
 *      attackers: forward support runs into the final third
 *   4. idle wobble (seeded)
 *   5. involvement runs — receivers arrive EXACTLY on their pass at arrival
 *   6. goal-celebration swarm
 */
export function playerPosAt(
  plan: RenderPlan,
  seed: number,
  side: Side,
  slot: number,
  t: number,
  ball: BallState,
  shift: TeamShift,
): [number, number] {
  const base = slotBase(side, slot)
  const ballNx = clampN((ball.x - PITCH.x) / PITCH.w, 0, 1)
  const ballNy = clampN((ball.y - PITCH.y) / PITCH.h, 0, 1)
  const ownGoalY = side === 'home' ? 1 : 0
  const oppGoalY = 1 - ownGoalY
  // how deep the ball is in our defensive end / their end (0..1 over the last third)
  const d3def = clamp01((0.34 - Math.abs(ballNy - ownGoalY)) / 0.34)
  const d3att = clamp01((0.34 - Math.abs(ballNy - oppGoalY)) / 0.34)
  // smoothed "we are defending live play" gate — replaces the old boolean,
  // whose instant flips teleported the back line at every possession change.
  // Dead-ball spans (celebrations, stoppages, retrievals) drain it naturally.
  const gate = side === 'home' ? shift.defendHome : shift.defendAway

  let nx = base[0]
  let ny = base[1]

  if (slot === KEEPER_SLOT) {
    // keepers shadow the ball laterally and edge off the line as danger nears
    nx = base[0] + clampN((ballNx - 0.5) * 0.6, -0.16, 0.16)
    ny = base[1] + (ownGoalY === 1 ? -1 : 1) * d3def * 0.025
  } else {
    const amt = side === 'home' ? shift.home : shift.away
    ny += side === 'home' ? -amt : amt

    // 2) the whole team leans with the ball — depth together, lane together
    ny += clampN((ballNy - 0.5) * 0.16, -0.09, 0.09)
    nx += (ballNx - 0.5) * (slot >= 5 ? 0.2 : 0.12)

    if (slot <= 4) {
      // 3a) back line collapses goal-side of the ball, spread across its lane
      const wallX = clampN(ballNx + (slot - 2.5) * 0.11, 0.08, 0.92)
      const wallY = clampN(lerp(ballNy, ownGoalY, 0.45), 0.04, 0.96)
      const k = d3def * 0.55 * gate
      nx = lerp(nx, wallX, k)
      ny = lerp(ny, wallY, k)
    } else {
      // 3c) attackers make forward runs as the move enters the final third
      ny += (oppGoalY === 0 ? -1 : 1) * d3att * (slot === 7 ? 0.11 : 0.07) * (1 - gate)
    }
  }

  let [px, py] = toPx([nx, ny])

  // 3b) closing down: defenders converge on the ball, hardest near their box.
  // Rational falloff — the nearest defender presses hard, the cover shuffles.
  if (slot !== KEEPER_SLOT && gate > 0.02) {
    const dx = ball.x - px
    const dy = ball.y - py
    const d = Math.sqrt(dx * dx + dy * dy)
    const urgency = 0.4 + 0.6 * d3def
    const k = gate * (urgency * 0.5) / (1 + (d / 240) * (d / 240))
    px += dx * k
    py += dy * k
  }

  // 4) cosmetic idle wobble (render-only; seeded so it re-renders identically)
  const ph = seed * 0.0007 + slot * 1.3 + (side === 'home' ? 0 : 9)
  px += Math.sin(t * 1.6 + ph) * 6
  py += Math.cos(t * 1.3 + ph) * 6

  // 5) run to meet your pass / interception / save — and actually MEET it:
  // at arrival the pull is 1.0, so receiver and ball touch exactly
  const inv = involvementAt(plan, side, slot, t)
  if (inv.k > 0) {
    const [tx, ty] = toPx([inv.tx, inv.ty])
    const pull = easeInOut(inv.k)
    px = lerp(px, tx, pull)
    py = lerp(py, ty, pull)
  } else if (gate < 0.5 && slot !== KEEPER_SLOT) {
    // gentle drift toward the ball keeps the attacking shape alive
    px += (ball.x - px) * 0.035 * (1 - gate)
    py += (ball.y - py) * 0.035 * (1 - gate)
  }

  // 6) goal celebration: scorers' teammates swarm toward the ball in the net
  if (ball.seg.kind === 'held' && isCelebration(plan, ball) && side === ball.seg.team) {
    const swarm = easeInOut(clamp01(ball.p * 1.6)) * 0.3
    px = lerp(px, ball.x, swarm)
    py = lerp(py, ball.y, swarm)
  }

  return [px, py]
}

/** A 'held' segment right after a shot = goal celebration (vs a card stoppage). */
function isCelebration(plan: RenderPlan, ball: BallState): boolean {
  const idx = segIndexAt(plan, ball.seg.t0 + 1e-4)
  return idx > 0 && plan.segs[idx - 1].kind === 'shot'
}

// ---- drawing ----

interface Stand {
  x: number
  y: number
  w: number
  h: number
}

/** Multiply a hex colour toward black (cheap depth shading for back rows). */
function shade(hex: string, mul: number): string {
  const h = hex.replace('#', '')
  const r = Math.round(parseInt(h.slice(0, 2), 16) * mul)
  const g = Math.round(parseInt(h.slice(2, 4), 16) * mul)
  const b = Math.round(parseInt(h.slice(4, 6), 16) * mul)
  return `rgb(${r},${g},${b})`
}

/**
 * One block of terrace. Rows build AWAY from the pitch edge: the front row
 * (nearest the pitch) is largest and brightest, back rows shrink and darken
 * so the stand reads with real depth. Fans sway idly and leap (always upward)
 * when their team scores. `pitchBelow` = this stand sits above the pitch.
 */
function drawStandSection(
  ctx: Ctx,
  stand: Stand,
  x0: number,
  x1: number,
  colors: readonly string[],
  seed: number,
  saltBase: number,
  t: number,
  jump: number,
  pitchBelow: boolean,
): void {
  const COL_STEP = 15
  const frontY = pitchBelow ? stand.y + stand.h - 12 : stand.y + 12
  const rowDir = pitchBelow ? -1 : 1
  for (let row = 0; row < CROWD_ROWS; row++) {
    const depth = row / (CROWD_ROWS - 1) // 0 front .. 1 back
    const rowY = frontY + rowDir * row * ROW_STEP
    const radius = 6.4 - depth * 2.1
    const mul = 1 - depth * 0.5
    const off = (row % 2) * (COL_STEP / 2) // stagger tiers like real seats
    for (let cx = x0 + 8 + off; cx < x1 - 5; cx += COL_STEP) {
      const h = (seed ^ Math.imul((saltBase + row * 977 + Math.floor(cx)) | 0, 2654435761)) >>> 0
      const jx = ((h % 11) - 5) * 0.7
      const jy = (((h >> 8) % 7) - 3) * 0.6
      const ph = (h >> 16) % 628
      const sway = Math.sin(t * 1.3 + ph * 0.01) * 1.2
      const bounce = jump > 0 ? Math.abs(Math.sin(t * 9 + ph * 0.01)) * 9 * jump * (1 - depth * 0.4) : 0
      ctx.fillStyle = shade(colors[h % colors.length], mul)
      ctx.beginPath()
      ctx.arc(cx + jx + sway, rowY + jy - bounce, radius, 0, Math.PI * 2)
      ctx.fill()
    }
  }
}

/** Dark tiered backdrop for a stand — darkest at the back so depth reads. */
function drawTerraceBack(ctx: Ctx, stand: Stand, pitchBelow: boolean): void {
  const g = ctx.createLinearGradient(0, stand.y, 0, stand.y + stand.h)
  const back = 'rgba(4,6,10,0.98)'
  const front = 'rgba(13,18,26,0.82)'
  g.addColorStop(0, pitchBelow ? back : front)
  g.addColorStop(1, pitchBelow ? front : back)
  ctx.fillStyle = g
  ctx.fillRect(stand.x, stand.y, stand.w, stand.h)
}

/**
 * The stands behind each goal, filling the frame with a real deep terrace.
 * The bottom stand is the HOME end (a wall of home colours); the top stand is
 * home too except the corner away section — the pocket of travelling fans
 * that gives the ground its atmosphere. Pure function of (plan, seed, t).
 */
export function drawCrowd(
  ctx: Ctx,
  plan: RenderPlan,
  seed: number,
  homeColor: string,
  homeAlt: string,
  awayColor: string,
  awayAlt: string,
  t: number,
): void {
  // is either set of fans mid-celebration?
  let homeJump = 0
  let awayJump = 0
  for (const m of plan.moments) {
    if (m.kind !== 'goal') continue
    const q = (t - m.t) / 2.4
    if (q >= 0 && q < 1) {
      if (m.team === 'home') homeJump = 1 - q
      else awayJump = 1 - q
    }
  }

  const homePalette = [homeColor, homeColor, homeAlt, '#e8edf4'] as const
  const awayPalette = [awayColor, awayColor, awayAlt, '#e8edf4'] as const

  for (const stand of [CROWD_TOP, CROWD_BOTTOM]) {
    const pitchBelow = stand === CROWD_TOP
    drawTerraceBack(ctx, stand, pitchBelow)

    if (stand === CROWD_TOP) {
      const split = stand.x + stand.w * (1 - AWAY_SECTION_FRAC)
      drawStandSection(ctx, stand, stand.x, split, homePalette, seed, 101, t, homeJump, pitchBelow)
      drawStandSection(ctx, stand, split, stand.x + stand.w, awayPalette, seed, 707, t, awayJump, pitchBelow)
      // segregation line between home + away sections
      ctx.strokeStyle = 'rgba(255,255,255,0.3)'
      ctx.lineWidth = 3
      ctx.beginPath()
      ctx.moveTo(split, stand.y + 4)
      ctx.lineTo(split, stand.y + stand.h - 4)
      ctx.stroke()
    } else {
      drawStandSection(ctx, stand, stand.x, stand.x + stand.w, homePalette, seed, 303, t, homeJump, pitchBelow)
    }
  }
}

/**
 * Goal frames + nets at each end. The net recess reaches back into the crowd
 * band, so a ball struck into the top net lands inside a real goal with the
 * terrace erupting behind it. Pure; drawn over the crowd, under players/ball.
 */
export function drawGoals(ctx: Ctx): void {
  const cx = PITCH.x + PITCH.w / 2
  const gw = 232
  const depth = 34
  const gx0 = cx - gw / 2
  const gx1 = cx + gw / 2
  for (const top of [true, false]) {
    const lineY = top ? PITCH.y : PITCH.y + PITCH.h
    const backY = top ? lineY - depth : lineY + depth
    const yTop = Math.min(lineY, backY)
    // dark recess so the net + ball read against the crowd
    ctx.fillStyle = 'rgba(0,0,0,0.42)'
    ctx.fillRect(gx0, yTop, gw, depth)
    // net grid
    ctx.strokeStyle = 'rgba(255,255,255,0.16)'
    ctx.lineWidth = 1
    ctx.beginPath()
    for (let gx = gx0; gx <= gx1 + 0.1; gx += 15) {
      ctx.moveTo(gx, lineY)
      ctx.lineTo(gx, backY)
    }
    for (let d = 0; d <= depth; d += 11) {
      const yy = top ? lineY - d : lineY + d
      ctx.moveTo(gx0, yy)
      ctx.lineTo(gx1, yy)
    }
    ctx.stroke()
    // posts + crossbar
    ctx.strokeStyle = 'rgba(255,255,255,0.85)'
    ctx.lineWidth = 4
    ctx.beginPath()
    ctx.moveTo(gx0, lineY)
    ctx.lineTo(gx0, backY)
    ctx.moveTo(gx1, lineY)
    ctx.lineTo(gx1, backY)
    ctx.moveTo(gx0, backY)
    ctx.lineTo(gx1, backY)
    ctx.stroke()
  }
}

export function drawPitch(ctx: Ctx): void {
  const { x, y, w, h } = PITCH
  const stripes = 10
  for (let i = 0; i < stripes; i++) {
    ctx.fillStyle = i % 2 === 0 ? '#176b34' : '#12592b'
    ctx.fillRect(x, y + (h / stripes) * i, w, h / stripes)
  }
  ctx.strokeStyle = 'rgba(255,255,255,0.5)'
  ctx.lineWidth = 4
  ctx.strokeRect(x, y, w, h)
  ctx.beginPath()
  ctx.moveTo(x, y + h / 2)
  ctx.lineTo(x + w, y + h / 2)
  ctx.stroke()
  ctx.beginPath()
  ctx.arc(x + w / 2, y + h / 2, 130, 0, Math.PI * 2)
  ctx.stroke()
  const gw = 340
  ctx.strokeRect(x + w / 2 - gw / 2, y - 2, gw, 64)
  ctx.strokeRect(x + w / 2 - gw / 2, y + h - 62, gw, 64)
}

function drawDisc(ctx: Ctx, x: number, y: number, r: number, fill: string): void {
  ctx.beginPath()
  ctx.arc(x, y, r, 0, Math.PI * 2)
  ctx.fillStyle = fill
  ctx.fill()
  ctx.lineWidth = 3
  ctx.strokeStyle = 'rgba(0,0,0,0.45)'
  ctx.stroke()
}

const WALK_OFF_SECS = 1.6

export function drawPlayers(
  ctx: Ctx,
  plan: RenderPlan,
  seed: number,
  homeColor: string,
  awayColor: string,
  t: number,
  ball: BallState,
): void {
  const shift = teamShiftAt(plan, t)
  for (const side of ['home', 'away'] as const) {
    const color = side === 'home' ? homeColor : awayColor
    for (let slot = 0; slot < SLOTS.length; slot++) {
      // red card: the sent-off player trudges to the touchline and is GONE —
      // the team genuinely plays on with seven dots
      const so = plan.sendOffs.find((x) => x.team === side && x.slot === slot)
      if (so && t >= so.t) {
        const q = (t - so.t) / WALK_OFF_SECS
        if (q >= 1) continue
        const ballThen = ballStateAt(plan, so.t)
        const shiftThen = teamShiftAt(plan, so.t)
        const [sx, sy] = playerPosAt(plan, seed, side, slot, so.t, ballThen, shiftThen)
        const wx = lerp(sx, PITCH.x - 46, easeInOut(clamp01(q)))
        ctx.save()
        ctx.globalAlpha = 1 - q * 0.75
        drawDisc(ctx, wx, sy, 27, color)
        ctx.restore()
        continue
      }
      const [px, py] = playerPosAt(plan, seed, side, slot, t, ball, shift)
      drawDisc(ctx, px, py, 27, color)
    }
  }
}

export function drawBall(ctx: Ctx, ball: BallState, homeColor: string, awayColor: string): void {
  const { seg, p } = ball

  // telegraph the gamble balls and shots with a faint intent line
  if ((seg.risky || seg.kind === 'shot') && p < 0.98 && seg.kind !== 'held') {
    const [tx, ty] = toPx(seg.to)
    ctx.save()
    ctx.globalAlpha = seg.kind === 'shot' ? 0.3 : 0.18
    ctx.strokeStyle = '#ffffff'
    ctx.lineWidth = 4
    ctx.setLineDash([14, 16])
    ctx.beginPath()
    ctx.moveTo(ball.x, ball.y)
    ctx.lineTo(tx, ty)
    ctx.stroke()
    ctx.restore()
  }

  // motion streak behind fast balls
  if (seg.kind === 'shot' || seg.risky) {
    const back = clamp01(p - 0.22)
    const e0 = segProgressEase(seg, back)
    const bx = PITCH.x + lerp(seg.from[0], seg.to[0], e0) * PITCH.w
    const by = PITCH.y + lerp(seg.from[1], seg.to[1], e0) * PITCH.h
    ctx.save()
    ctx.globalAlpha = 0.35
    ctx.strokeStyle = '#ffffff'
    ctx.lineWidth = 7
    ctx.lineCap = 'round'
    ctx.beginPath()
    ctx.moveTo(bx, by)
    ctx.lineTo(ball.x, ball.y)
    ctx.stroke()
    ctx.restore()
  }

  // interception ping — the moment a gamble ball is cut out
  if (seg.kind === 'intercept' && p > 0.7) {
    const q = (p - 0.7) / 0.3
    ctx.save()
    ctx.globalAlpha = (1 - q) * 0.8
    ctx.strokeStyle = seg.team === 'home' ? homeColor : awayColor
    ctx.lineWidth = 5
    ctx.beginPath()
    ctx.arc(ball.x, ball.y, 24 + q * 34, 0, Math.PI * 2)
    ctx.stroke()
    ctx.restore()
  }

  // shadow grows with a lofted ball
  ctx.save()
  ctx.globalAlpha = 0.25
  ctx.beginPath()
  ctx.ellipse(ball.x, ball.y + 10 * ball.scale, 14 * ball.scale, 6 * ball.scale, 0, 0, Math.PI * 2)
  ctx.fillStyle = '#000'
  ctx.fill()
  ctx.restore()

  ctx.beginPath()
  ctx.arc(ball.x, ball.y - (ball.scale - 1) * 26, 17 * ball.scale, 0, Math.PI * 2)
  ctx.fillStyle = '#ffffff'
  ctx.fill()
  ctx.lineWidth = 2
  ctx.strokeStyle = '#111'
  ctx.stroke()
}
