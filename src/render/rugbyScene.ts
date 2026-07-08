// Rugby scene layer of the continuous-play renderer: the pitch (with in-goal
// areas and H posts), the moving players and the travelling ball. Everything
// here is a pure function of (plan, seed, t) — no accumulated state — so
// preview and export stay pixel-identical.
//
// NOT the deterministic sim: cosmetic wobble may use Math.sin/cos freely.
//
// Deliberately its own module (multi-sport isolation): shares the soccer
// frame's layout budget — wordmark ~95, scorebug 150-250, pitch 384-1776,
// crowd bands above/below — so a ball grounded in the TOP in-goal (the money
// shot) is never occluded by the scorebug.

import { FULLBACK_SLOT, RUGBY_SLOTS, rugbySlotBase } from '../sim/rugbyFormation'
import type { Side } from '../sim/types'
import { rugbySegIndexAt, type RugbyBallSeg, type RugbyRenderPlan } from './rugbyDirector'

export const RUGBY_PITCH = { x: 20, y: 384, w: 1040, h: 1392 }
export const RUGBY_CROWD_TOP = { x: 20, y: 256, w: 1040, h: 120 }
export const RUGBY_CROWD_BOTTOM = { x: 20, y: 1780, w: 1040, h: 124 }
/** Depth of each in-goal area in px — the playing field sits between them. */
export const INGOAL_PX = 56
const AWAY_SECTION_FRAC = 0.26
const CROWD_ROWS = 5
const ROW_STEP = 20

type Ctx = CanvasRenderingContext2D

/** Field-of-play coords (y 0..1 between the try lines) → canvas px. Grounding
 * overshoot (y < 0 or > 1) lands inside the in-goal band — still on grass. */
export function rugbyToPx(p: readonly [number, number]): [number, number] {
  return [
    RUGBY_PITCH.x + p[0] * RUGBY_PITCH.w,
    RUGBY_PITCH.y + INGOAL_PX + p[1] * (RUGBY_PITCH.h - 2 * INGOAL_PX),
  ]
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
function clampN(x: number, lo: number, hi: number): number {
  return x < lo ? lo : x > hi ? hi : x
}

export interface RugbyBallState {
  x: number // canvas px
  y: number
  scale: number // >1 while a kicked ball is "in the air"
  seg: RugbyBallSeg
  p: number // raw progress through the segment
}

function segProgressEase(seg: RugbyBallSeg, p: number): number {
  if (seg.kind === 'held') return 0
  if (seg.kind === 'shot' || seg.kind === 'kick' || seg.kind === 'restart') return p // linear: no mid-segment speed spike
  // long carries are flat-out runs — linear keeps their peak speed equal to
  // their average so the longest carries can never spike over the anti-teleport
  // gate the way easeInOut's 2x mid-segment peak does (breaks, half-time
  // crossings and walks to a distant penalty mark all qualify)
  if (seg.kind === 'carry') {
    const dx = seg.to[0] - seg.from[0]
    const dy = seg.to[1] - seg.from[1]
    const man = (dx < 0 ? -dx : dx) + (dy < 0 ? -dy : dy)
    if (seg.risky || man > 0.28) return p
  }
  if (seg.kind === 'grounding') return easeOut(p) // the dive
  return easeInOut(p)
}

/** Ball position/flight at render-time t (clamped into the play window). */
export function rugbyBallStateAt(plan: RugbyRenderPlan, t: number): RugbyBallState {
  const idx = rugbySegIndexAt(plan, t)
  const seg = plan.segs[idx]
  const p = clamp01((t - seg.t0) / Math.max(1e-6, seg.t1 - seg.t0))
  const e = segProgressEase(seg, p)
  const nx = lerp(seg.from[0], seg.to[0], e)
  const ny = lerp(seg.from[1], seg.to[1], e)
  const [x, y] = rugbyToPx([nx, ny])
  const air = seg.arc > 0 ? seg.arc * 4 * p * (1 - p) : 0
  return { x, y, scale: 1 + air * 1.1, seg, p }
}

/**
 * Involvement of (side, slot) in nearby ball segments: players run to meet
 * their pass/catch/steal before it arrives and linger briefly after.
 */
function involvementAt(
  plan: RugbyRenderPlan,
  side: Side,
  slot: number,
  t: number,
): { k: number; tx: number; ty: number } {
  const PRE = 1.05
  const POST = 0.8
  const idx = rugbySegIndexAt(plan, t)
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

export interface RugbyTeamShift {
  home: number
  away: number
  defendHome: number // smoothed 0..1 "defending live play" gates (±0.45s window)
  defendAway: number
}

/** Per-frame tactical state: possession shift + smoothed defending gates. */
export function rugbyTeamShiftAt(plan: RugbyRenderPlan, t: number): RugbyTeamShift {
  const idx = rugbySegIndexAt(plan, t)
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
    if (s.kind !== 'held' && s.kind !== 'restart' && s.kind !== 'shot') {
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

/** Is the ball currently held at a breakdown (ruck or maul)? */
function ruckAt(ball: RugbyBallState): boolean {
  return ball.seg.kind === 'held' && (ball.seg.tag === 'ruck' || ball.seg.tag === 'maul')
}

/**
 * Canvas position of one player dot at render-time t. Pure.
 *
 * Off-ball life, layered:
 *   1. formation base + possession push/drop
 *   2. whole-team lean toward the ball's depth and lane
 *   3. defenders: the flat defensive LINE (rugby's signature shape) + press
 *      attacking forwards: hit the breakdown; backs: hold depth BEHIND the ball
 *   4. idle wobble (seeded)
 *   5. involvement runs — receivers arrive EXACTLY on their pass at arrival
 *   6. try-celebration swarm
 */
export function rugbyPlayerPosAt(
  plan: RugbyRenderPlan,
  seed: number,
  side: Side,
  slot: number,
  t: number,
  ball: RugbyBallState,
  shift: RugbyTeamShift,
): [number, number] {
  const base = rugbySlotBase(side, slot)
  const fieldH = RUGBY_PITCH.h - 2 * INGOAL_PX
  const ballNx = clampN((ball.x - RUGBY_PITCH.x) / RUGBY_PITCH.w, 0, 1)
  const ballNy = clampN((ball.y - RUGBY_PITCH.y - INGOAL_PX) / fieldH, 0, 1)
  const ownGoalY = side === 'home' ? 1 : 0
  const d3def = clamp01((0.34 - Math.abs(ballNy - ownGoalY)) / 0.34)
  const gate = side === 'home' ? shift.defendHome : shift.defendAway

  let nx = base[0]
  let ny = base[1]

  if (slot === FULLBACK_SLOT) {
    // the last line: sweeps laterally with the ball, steps up a touch under pressure
    nx = base[0] + clampN((ballNx - 0.5) * 0.7, -0.2, 0.2)
    ny = base[1] + (ownGoalY === 1 ? -1 : 1) * d3def * 0.03
  } else {
    const amt = side === 'home' ? shift.home : shift.away
    ny += side === 'home' ? -amt : amt

    // 2) the whole team travels with the ball
    ny += clampN((ballNy - 0.5) * 0.18, -0.1, 0.1)
    nx += (ballNx - 0.5) * (slot >= 6 ? 0.2 : 0.14)

    if (gate > 0.15) {
      // 3a) THE LINE — defenders string out flat across the pitch, goal-side
      // of the ball. Rank spreads 1-9 shoulder to shoulder.
      const rank = (slot - 1) / 8 // 0..1 across the width
      const lineX = clampN(0.08 + rank * 0.84, 0.06, 0.94)
      const lineY = clampN(lerp(ballNy, ownGoalY, 0.26), 0.04, 0.96)
      const k = gate * (0.38 + 0.22 * d3def)
      nx = lerp(nx, lineX, k)
      ny = lerp(ny, lineY, k)
    } else if (slot <= 5) {
      // 3b) attacking forwards work in close support — and pile into rucks
      nx = lerp(nx, ballNx, 0.22)
      ny = lerp(ny, ballNy, 0.16)
    } else {
      // 3c) the backline holds its depth BEHIND the ball, ready for the sweep
      const behind = ownGoalY === 1 ? 0.055 : -0.055
      const holdY = clampN(ballNy + behind, 0.04, 0.96)
      ny = lerp(ny, holdY, 0.5)
    }
  }

  let [px, py] = rugbyToPx([nx, ny])

  // breakdown cluster: forwards of BOTH sides pile in (attackers harder)
  if (ruckAt(ball) && slot >= 1 && slot <= 5) {
    const isAtk = side === ball.seg.team
    const k = (isAtk ? 0.62 : 0.4) - (slot - 1) * 0.07
    if (k > 0) {
      px = lerp(px, ball.x + Math.sin(seed * 0.001 + slot * 2.1 + (isAtk ? 0 : 3)) * 26, k)
      py = lerp(py, ball.y + Math.cos(seed * 0.001 + slot * 1.7 + (isAtk ? 0 : 3)) * 22, k)
    }
  }

  // 3d) closing down: the nearest defender presses the carrier
  if (slot !== FULLBACK_SLOT && gate > 0.02 && !ruckAt(ball)) {
    const dx = ball.x - px
    const dy = ball.y - py
    const d = Math.sqrt(dx * dx + dy * dy)
    const urgency = 0.4 + 0.6 * d3def
    const k = (gate * (urgency * 0.5)) / (1 + (d / 240) * (d / 240))
    px += dx * k
    py += dy * k
  }

  // 4) idle wobble (seeded, render-only)
  const ph = seed * 0.0007 + slot * 1.3 + (side === 'home' ? 0 : 9)
  px += Math.sin(t * 1.6 + ph) * 6
  py += Math.cos(t * 1.3 + ph) * 6

  // 5) run to meet your pass / catch / steal — and actually MEET it
  const inv = involvementAt(plan, side, slot, t)
  if (inv.k > 0) {
    const [tx, ty] = rugbyToPx([inv.tx, inv.ty])
    const pull = easeInOut(inv.k)
    px = lerp(px, tx, pull)
    py = lerp(py, ty, pull)
  } else if (gate < 0.5 && slot !== FULLBACK_SLOT) {
    px += (ball.x - px) * 0.03 * (1 - gate)
    py += (ball.y - py) * 0.03 * (1 - gate)
  }

  // 6) try celebration: the scorers swarm to the grounding
  if (ball.seg.kind === 'held' && ball.seg.tag === 'celebrate' && side === ball.seg.team) {
    const swarm = easeInOut(clamp01(ball.p * 1.6)) * 0.3
    px = lerp(px, ball.x, swarm)
    py = lerp(py, ball.y, swarm)
  }

  return [px, py]
}

// ---- drawing ----

interface Stand {
  x: number
  y: number
  w: number
  h: number
}

function shade(hex: string, mul: number): string {
  const h = hex.replace('#', '')
  const r = Math.round(parseInt(h.slice(0, 2), 16) * mul)
  const g = Math.round(parseInt(h.slice(2, 4), 16) * mul)
  const b = Math.round(parseInt(h.slice(4, 6), 16) * mul)
  return `rgb(${r},${g},${b})`
}

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
    const depth = row / (CROWD_ROWS - 1)
    const rowY = frontY + rowDir * row * ROW_STEP
    const radius = 6.4 - depth * 2.1
    const mul = 1 - depth * 0.5
    const off = (row % 2) * (COL_STEP / 2)
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

function drawTerraceBack(ctx: Ctx, stand: Stand, pitchBelow: boolean): void {
  const g = ctx.createLinearGradient(0, stand.y, 0, stand.y + stand.h)
  const back = 'rgba(4,6,10,0.98)'
  const front = 'rgba(13,18,26,0.82)'
  g.addColorStop(0, pitchBelow ? back : front)
  g.addColorStop(1, pitchBelow ? front : back)
  ctx.fillStyle = g
  ctx.fillRect(stand.x, stand.y, stand.w, stand.h)
}

/** Terraces behind each in-goal; tries make the scorers' fans leap. */
export function drawRugbyCrowd(
  ctx: Ctx,
  plan: RugbyRenderPlan,
  seed: number,
  homeColor: string,
  homeAlt: string,
  awayColor: string,
  awayAlt: string,
  t: number,
): void {
  let homeJump = 0
  let awayJump = 0
  for (const m of plan.moments) {
    const amp = m.kind === 'try' ? 1 : m.kind === 'penaltyGoal' || m.kind === 'dropGoal' ? 0.55 : 0
    if (amp === 0) continue
    const q = (t - m.t) / 2.4
    if (q >= 0 && q < 1) {
      if (m.team === 'home') homeJump = Math.max(homeJump, (1 - q) * amp)
      else awayJump = Math.max(awayJump, (1 - q) * amp)
    }
  }

  const homePalette = [homeColor, homeColor, homeAlt, '#e8edf4'] as const
  const awayPalette = [awayColor, awayColor, awayAlt, '#e8edf4'] as const
  const corner = seed % 4
  const awayOnTop = corner < 2
  const awayOnLeft = corner % 2 === 0

  for (const stand of [RUGBY_CROWD_TOP, RUGBY_CROWD_BOTTOM]) {
    const pitchBelow = stand === RUGBY_CROWD_TOP
    const isAwayStand = pitchBelow === awayOnTop
    const homeSalt = pitchBelow ? 101 : 303
    drawTerraceBack(ctx, stand, pitchBelow)

    if (!isAwayStand) {
      drawStandSection(ctx, stand, stand.x, stand.x + stand.w, homePalette, seed, homeSalt, t, homeJump, pitchBelow)
      continue
    }

    const split = stand.x + stand.w * (awayOnLeft ? AWAY_SECTION_FRAC : 1 - AWAY_SECTION_FRAC)
    if (awayOnLeft) {
      drawStandSection(ctx, stand, stand.x, split, awayPalette, seed, 707, t, awayJump, pitchBelow)
      drawStandSection(ctx, stand, split, stand.x + stand.w, homePalette, seed, homeSalt, t, homeJump, pitchBelow)
    } else {
      drawStandSection(ctx, stand, stand.x, split, homePalette, seed, homeSalt, t, homeJump, pitchBelow)
      drawStandSection(ctx, stand, split, stand.x + stand.w, awayPalette, seed, 707, t, awayJump, pitchBelow)
    }
    ctx.strokeStyle = 'rgba(255,255,255,0.3)'
    ctx.lineWidth = 3
    ctx.beginPath()
    ctx.moveTo(split, stand.y + 4)
    ctx.lineTo(split, stand.y + stand.h - 4)
    ctx.stroke()
  }
}

/** H-shaped posts standing ON each try line, reaching into the in-goal. */
export function drawRugbyPosts(ctx: Ctx): void {
  const cx = RUGBY_PITCH.x + RUGBY_PITCH.w / 2
  const postGap = 56 // between the uprights
  const rise = 44 // how far the H reaches into the in-goal band
  for (const top of [true, false]) {
    const lineY = top ? RUGBY_PITCH.y + INGOAL_PX : RUGBY_PITCH.y + RUGBY_PITCH.h - INGOAL_PX
    const backY = top ? lineY - rise : lineY + rise
    const barY = top ? lineY - rise * 0.55 : lineY + rise * 0.55
    ctx.strokeStyle = 'rgba(255,255,255,0.9)'
    ctx.lineWidth = 5
    ctx.beginPath()
    ctx.moveTo(cx - postGap / 2, lineY)
    ctx.lineTo(cx - postGap / 2, backY)
    ctx.moveTo(cx + postGap / 2, lineY)
    ctx.lineTo(cx + postGap / 2, backY)
    ctx.moveTo(cx - postGap / 2, barY)
    ctx.lineTo(cx + postGap / 2, barY)
    ctx.stroke()
    // post protectors at the base
    ctx.fillStyle = '#d8b13a'
    for (const px of [cx - postGap / 2, cx + postGap / 2]) {
      ctx.beginPath()
      ctx.arc(px, lineY, 7, 0, Math.PI * 2)
      ctx.fill()
    }
  }
}

export function drawRugbyPitch(ctx: Ctx): void {
  const { x, y, w, h } = RUGBY_PITCH
  const stripes = 10
  for (let i = 0; i < stripes; i++) {
    ctx.fillStyle = i % 2 === 0 ? '#176b34' : '#12592b'
    ctx.fillRect(x, y + (h / stripes) * i, w, h / stripes)
  }
  // in-goal areas read darker so the try line pops
  ctx.fillStyle = 'rgba(0,30,10,0.35)'
  ctx.fillRect(x, y, w, INGOAL_PX)
  ctx.fillRect(x, y + h - INGOAL_PX, w, INGOAL_PX)

  ctx.strokeStyle = 'rgba(255,255,255,0.5)'
  ctx.lineWidth = 4
  ctx.strokeRect(x, y, w, h)

  const fieldTop = y + INGOAL_PX
  const fieldH = h - 2 * INGOAL_PX
  const lineAt = (f: number): number => fieldTop + f * fieldH

  // try lines — the strongest lines on the pitch
  ctx.strokeStyle = 'rgba(255,255,255,0.85)'
  ctx.lineWidth = 5
  ctx.beginPath()
  ctx.moveTo(x, lineAt(0))
  ctx.lineTo(x + w, lineAt(0))
  ctx.moveTo(x, lineAt(1))
  ctx.lineTo(x + w, lineAt(1))
  ctx.stroke()

  // halfway + 22s solid
  ctx.strokeStyle = 'rgba(255,255,255,0.5)'
  ctx.lineWidth = 4
  ctx.beginPath()
  for (const f of [0.22, 0.5, 0.78]) {
    ctx.moveTo(x, lineAt(f))
    ctx.lineTo(x + w, lineAt(f))
  }
  ctx.stroke()

  // 10m lines dashed either side of halfway
  ctx.save()
  ctx.setLineDash([18, 22])
  ctx.strokeStyle = 'rgba(255,255,255,0.35)'
  ctx.beginPath()
  for (const f of [0.4, 0.6]) {
    ctx.moveTo(x, lineAt(f))
    ctx.lineTo(x + w, lineAt(f))
  }
  ctx.stroke()
  ctx.restore()
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

export function drawRugbyPlayers(
  ctx: Ctx,
  plan: RugbyRenderPlan,
  seed: number,
  homeColor: string,
  awayColor: string,
  t: number,
  ball: RugbyBallState,
): void {
  const shift = rugbyTeamShiftAt(plan, t)
  for (const side of ['home', 'away'] as const) {
    const color = side === 'home' ? homeColor : awayColor
    for (let slot = 0; slot < RUGBY_SLOTS.length; slot++) {
      // the latest card affecting this player
      let so: (typeof plan.sendOffs)[number] | undefined
      for (const x of plan.sendOffs) {
        if (x.team === side && x.slot === slot && t >= x.t && (!so || x.t > so.t)) so = x
      }
      if (so) {
        if (so.returnT === undefined || t < so.returnT) {
          // walking off (or already off): yellows sit out, reds are gone
          const q = (t - so.t) / WALK_OFF_SECS
          if (q >= 1) continue
          const ballThen = rugbyBallStateAt(plan, so.t)
          const shiftThen = rugbyTeamShiftAt(plan, so.t)
          const [sx, sy] = rugbyPlayerPosAt(plan, seed, side, slot, so.t, ballThen, shiftThen)
          const wx = lerp(sx, RUGBY_PITCH.x - 46, easeInOut(clamp01(q)))
          ctx.save()
          ctx.globalAlpha = 1 - q * 0.75
          drawDisc(ctx, wx, sy, 27, color)
          ctx.restore()
          continue
        }
        const q = (t - so.returnT) / WALK_OFF_SECS
        if (q < 1) {
          // sin bin served — back over the touchline he comes
          const [tx, ty] = rugbyPlayerPosAt(plan, seed, side, slot, t, ball, shift)
          const wx = lerp(RUGBY_PITCH.x - 46, tx, easeInOut(clamp01(q)))
          ctx.save()
          ctx.globalAlpha = 0.25 + q * 0.75
          drawDisc(ctx, wx, ty, 27, color)
          ctx.restore()
          continue
        }
      }
      const [px, py] = rugbyPlayerPosAt(plan, seed, side, slot, t, ball, shift)
      drawDisc(ctx, px, py, 27, color)
    }
  }
}

export function drawRugbyBall(
  ctx: Ctx,
  ball: RugbyBallState,
  homeColor: string,
  awayColor: string,
): void {
  const { seg, p } = ball

  // telegraph gamble balls and kicks at goal with a faint intent line
  if ((seg.risky || seg.kind === 'shot') && p < 0.98 && seg.kind !== 'held') {
    const [tx, ty] = rugbyToPx(seg.to)
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
  if (seg.kind === 'shot' || seg.kind === 'grounding' || seg.risky) {
    const back = clamp01(p - 0.22)
    const e0 = segProgressEase(seg, back)
    const [bx, by] = rugbyToPx([
      lerp(seg.from[0], seg.to[0], e0),
      lerp(seg.from[1], seg.to[1], e0),
    ])
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

  // turnover ping — the jackal wins it
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
  ctx.ellipse(ball.x, ball.y + 10 * ball.scale, 15 * ball.scale, 6 * ball.scale, 0, 0, Math.PI * 2)
  ctx.fillStyle = '#000'
  ctx.fill()
  ctx.restore()

  // the ball itself — oval, nose pointed along its direction of travel
  const dx = seg.to[0] - seg.from[0]
  const dy = seg.to[1] - seg.from[1]
  const angle = dx * dx + dy * dy > 1e-9 ? Math.atan2(dy, dx) : 0
  const spin = seg.arc > 0 ? Math.sin(p * 9) * 0.35 : 0
  ctx.save()
  ctx.translate(ball.x, ball.y - (ball.scale - 1) * 26)
  ctx.rotate(angle + spin)
  ctx.beginPath()
  ctx.ellipse(0, 0, 19 * ball.scale, 12.5 * ball.scale, 0, 0, Math.PI * 2)
  ctx.fillStyle = '#f4f0e6'
  ctx.fill()
  ctx.lineWidth = 2
  ctx.strokeStyle = '#111'
  ctx.stroke()
  // lace stripe
  ctx.beginPath()
  ctx.moveTo(-10 * ball.scale, 0)
  ctx.lineTo(10 * ball.scale, 0)
  ctx.strokeStyle = 'rgba(0,0,0,0.35)'
  ctx.stroke()
  ctx.restore()
}
