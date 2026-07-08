// Scene layer of the continuous-play renderer: the pitch, the moving players
// and the travelling ball. Everything here is a pure function of (plan, seed,
// t) — no accumulated state — so preview and export stay pixel-identical.
//
// NOT the deterministic sim: cosmetic wobble may use Math.sin/cos freely.

import { KEEPER_SLOT, SLOTS, slotBase } from '../sim/formation'
import type { Side } from '../sim/types'
import { segIndexAt, type BallSeg, type RenderPlan } from './director'

// Pitch sits fully below the scorebug (bug ends at y=340) so balls in the TOP
// net — the money shot — are never occluded by the overlay.
export const PITCH = { x: 20, y: 380, w: 1040, h: 1350 }

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

/** Fraction of the surrounding ~0.9s in which `side` has the ball (0..1). */
function possessionFrac(plan: RenderPlan, side: Side, t: number): number {
  const idx = segIndexAt(plan, t)
  const w0 = t - 0.45
  const w1 = t + 0.45
  let mine = 0
  let all = 0
  for (let i = Math.max(0, idx - 8); i < Math.min(plan.segs.length, idx + 8); i++) {
    const s = plan.segs[i]
    const o = Math.min(w1, s.t1) - Math.max(w0, s.t0)
    if (o <= 0) continue
    all += o
    if (s.team === side) mine += o
  }
  return all > 0 ? mine / all : 0.5
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
  const PRE = 0.85
  const POST = 0.7
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
}

/** Per-frame tactical shift: possession pushes a team up the pitch, defending compresses. */
export function teamShiftAt(plan: RenderPlan, t: number): TeamShift {
  const fh = possessionFrac(plan, 'home', t)
  return {
    home: lerp(-0.03, 0.05, fh),
    away: lerp(-0.03, 0.05, 1 - fh),
  }
}

/** Canvas position of one player dot at render-time t. Pure. */
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
  let nx = base[0]
  let ny = base[1]

  if (slot === KEEPER_SLOT) {
    // keepers hold the line and shadow the ball laterally
    const ballNx = (ball.x - PITCH.x) / PITCH.w
    nx = base[0] + Math.max(-0.13, Math.min(0.13, (ballNx - 0.5) * 0.5))
  } else {
    const amt = side === 'home' ? shift.home : shift.away
    ny = base[1] + (side === 'home' ? -amt : amt)
  }

  let [px, py] = toPx([nx, ny])

  // cosmetic idle wobble (render-only; seeded so it re-renders identically)
  const ph = seed * 0.0007 + slot * 1.3 + (side === 'home' ? 0 : 9)
  px += Math.sin(t * 1.6 + ph) * 6
  py += Math.cos(t * 1.3 + ph) * 6

  // run to meet your pass / interception / save
  const inv = involvementAt(plan, side, slot, t)
  if (inv.k > 0) {
    const [tx, ty] = toPx([inv.tx, inv.ty])
    const pull = easeInOut(inv.k) * 0.85
    px = lerp(px, tx, pull)
    py = lerp(py, ty, pull)
  } else if (slot !== KEEPER_SLOT) {
    // gentle drift toward the ball keeps the shape alive without bunching
    px += (ball.x - px) * 0.04
    py += (ball.y - py) * 0.04
  }

  // goal celebration: scorers' teammates swarm toward the ball in the net
  if (ball.seg.kind === 'held' && ball.seg.arc === 0 && isCelebration(plan, ball) && side === ball.seg.team) {
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
