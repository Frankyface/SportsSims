// Pure Canvas renderer for GOLF: draws a single frame of an Apex Tour
// foursome's round at render-time `t`. The whole group is on the hole at
// once — four golfer chips, four balls — and every shot animates in turn.
// A GolfRenderModel is built once from a GolfRoundResult + group index;
// drawGolfFrame(ctx, model, t) is a pure function of (model, t), so the same
// function powers the live preview and the frame-stepped WebCodecs export.

import type { GolfRoundResult, GolfShot } from '../sim/golfTypes'
import {
  buildGolfGroupPlan,
  formatToPar,
  golfActiveSegAt,
  golfBoardAt,
  golferPosAt,
  golfHoleAt,
  pickActiveGolfMoment,
  type GolfMoment,
  type GolfGroupPlan,
  type GolfShotSeg,
} from './golfDirector'
import {
  buildHoleLayout,
  drawGolfHole,
  holeToScreen,
  GOLF_ART,
  type GolfHoleLayout,
} from './golfCourseArt'
import { drawWordmark } from './wordmark'
import { HOLES_PER_ROUND } from '../sim/golfTypes'

export interface GolfEventBrand {
  name: string
  short: string
  color: string
  colorAlt: string
  major: boolean
  championship: boolean
}

export interface GolfRenderModel {
  plan: GolfGroupPlan
  m: GolfRoundResult
  event: GolfEventBrand
  courseName: string
  layouts: GolfHoleLayout[]
  /** 0-2 pre-computed storyline hooks for the intro card (from the stats book). */
  storyChips: string[]
  width: number
  height: number
  seed: number
}

export const GOLF_RENDER_W = 1080
export const GOLF_RENDER_H = 1920

const WORDMARK_Y = 95
const BUG_Y = 150

export function buildGolfRenderModel(
  m: GolfRoundResult,
  group: 0 | 1,
  event: GolfEventBrand,
  courseName: string,
  storyChips: string[] = [],
  width = GOLF_RENDER_W,
  height = GOLF_RENDER_H,
): GolfRenderModel {
  const layouts: GolfHoleLayout[] = []
  for (let hIdx = 0; hIdx < HOLES_PER_ROUND; hIdx++) {
    layouts.push(buildHoleLayout(m.config.course, hIdx, m.renderSeed))
  }
  return {
    plan: buildGolfGroupPlan(m, group),
    m,
    event,
    courseName,
    layouts,
    storyChips: storyChips.slice(0, 2),
    width,
    height,
    seed: m.renderSeed >>> 0,
  }
}

type Ctx = CanvasRenderingContext2D

function clamp01(x: number): number {
  return x < 0 ? 0 : x > 1 ? 1 : x
}
function ease(t: number): number {
  return t < 0.5 ? 2 * t * t : 1 - ((-2 * t + 2) * (-2 * t + 2)) / 2
}
function roundRect(ctx: Ctx, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}
function fitText(ctx: Ctx, text: string, max: number, startPx: number): number {
  let px = startPx
  ctx.font = `bold ${px}px system-ui, sans-serif`
  while (ctx.measureText(text).width > max && px > 24) {
    px -= 4
    ctx.font = `bold ${px}px system-ui, sans-serif`
  }
  return px
}
function readableOn(hex: string): string {
  const h = hex.replace('#', '')
  const r = parseInt(h.slice(0, 2), 16)
  const g = parseInt(h.slice(2, 4), 16)
  const b = parseInt(h.slice(4, 6), 16)
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.6 ? '#0a0e14' : '#ffffff'
}

// --- the group on the course -------------------------------------------------

/** Where the drawn water lives at roughly this screen height. */
function waterPoint(l: GolfHoleLayout, yScreen: number): [number, number] {
  if (l.water) return [l.water.x, l.water.y]
  const seaX = l.waterSide < 0 ? GOLF_ART.x + 90 : GOLF_ART.x + GOLF_ART.w - 90
  return [seaX, yScreen]
}

/** Penalty shots fly into the drawn water (cosmetic; the sim's drop spot rules). */
function visualTarget(l: GolfHoleLayout, shot: GolfShot): [number, number] {
  if (shot.penalty) return waterPoint(l, holeToScreen(l, shot.to)[1])
  return holeToScreen(l, shot.to)
}

/** A golfer's on-course marker: a clean colour dot, no lettering. */
function drawGolferChip(ctx: Ctx, x: number, y: number, r: number, color: string, dim = false): void {
  ctx.save()
  if (dim) ctx.globalAlpha = 0.78
  ctx.beginPath()
  ctx.arc(x, y, r, 0, Math.PI * 2)
  ctx.fillStyle = color
  ctx.fill()
  ctx.lineWidth = Math.max(2, r * 0.16)
  ctx.strokeStyle = 'rgba(255,255,255,0.75)'
  ctx.stroke()
  ctx.restore()
}

/** Waiting golfers: small chip + ball at their current lie (nudged apart). */
function drawWaitingGolfers(
  ctx: Ctx,
  model: GolfRenderModel,
  l: GolfHoleLayout,
  hole: number,
  t: number,
  activeGolfer: number | null,
): void {
  const plan = model.plan
  plan.golfers.forEach((gi, slot) => {
    if (gi === activeGolfer) return
    const st = golferPosAt(plan, gi, t, hole)
    if (st.holed || st.lie === 'water') return // sunk balls wait for the drop
    const g = model.m.config.golfers[gi]
    let [x, y] = st.started ? holeToScreen(l, st.pos) : [l.tee[0] - 45 + slot * 30, l.tee[1] + 34]
    // nudge co-located balls apart so four dots never stack
    x += (slot - 1.5) * 9
    ctx.fillStyle = '#ffffff'
    ctx.beginPath()
    ctx.arc(x, y, 6, 0, Math.PI * 2)
    ctx.fill()
    drawGolferChip(ctx, x, y - 19, 11, g.color, true)
  })
}

function drawActiveShot(ctx: Ctx, model: GolfRenderModel, l: GolfHoleLayout, seg: GolfShotSeg, t: number): void {
  const g = model.m.config.golfers[seg.shot.golfer]
  const p = clamp01((t - seg.t0) / (seg.t1 - seg.t0))
  const isDrop = seg.shot.kind === 'penaltyDrop'
  const from = isDrop ? waterPoint(l, holeToScreen(l, seg.shot.from)[1]) : holeToScreen(l, seg.shot.from)
  const to = visualTarget(l, seg.shot)
  const isPutt = seg.shot.kind === 'putt'

  if (isDrop) {
    // the walk of shame: ball reappears falling onto the drop spot
    const dp = ease(clamp01(p / 0.7))
    drawGolferChip(ctx, to[0], to[1] - 30, 16, g.color)
    ctx.fillStyle = '#ffffff'
    ctx.beginPath()
    ctx.arc(to[0], to[1] - 60 * (1 - dp), 8, 0, Math.PI * 2)
    ctx.fill()
    ctx.strokeStyle = `rgba(255,255,255,${0.5 * (1 - p)})`
    ctx.lineWidth = 3
    ctx.beginPath()
    ctx.arc(from[0], from[1], 12 + p * 20, 0, Math.PI * 2)
    ctx.stroke()
    drawShotTag(ctx, g, seg, to)
    return
  }

  // Putts ROLL: fast off the face, dying at the hole — misses visibly slide by.
  const flightEnd = isPutt ? 0.82 : 0.72
  const fp = clamp01(p / flightEnd)
  const e = isPutt ? 1 - (1 - fp) * (1 - fp) : ease(fp)

  const dx = to[0] - from[0]
  const dy = to[1] - from[1]
  const dist = Math.sqrt(dx * dx + dy * dy)
  const lift = isPutt ? 0 : seg.shot.kind === 'chip' || seg.shot.kind === 'recovery' ? dist * 0.18 : dist * 0.3 + 40

  const bx = from[0] + dx * e
  const by = from[1] + dy * e - lift * 4 * e * (1 - e)

  // tracer
  if (fp > 0.02 && fp < 1) {
    ctx.strokeStyle = 'rgba(255,255,255,0.55)'
    ctx.lineWidth = 4
    ctx.beginPath()
    for (let i = 0; i <= 14; i++) {
      const q = ease((fp * i) / 14)
      const tx = from[0] + dx * q
      const ty = from[1] + dy * q - lift * 4 * q * (1 - q)
      if (i === 0) ctx.moveTo(tx, ty)
      else ctx.lineTo(tx, ty)
    }
    ctx.stroke()
  }

  // the player, highlighted
  drawGolferChip(ctx, from[0], from[1] + 2, 16, g.color)
  ctx.strokeStyle = 'rgba(255,255,255,0.5)'
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.arc(from[0], from[1] + 2, 23 + Math.sin(t * 6) * 2, 0, Math.PI * 2)
  ctx.stroke()

  if (fp < 1) {
    ctx.fillStyle = 'rgba(10,14,20,0.35)'
    ctx.beginPath()
    ctx.ellipse(bx, from[1] + dy * e + 6, 8, 4, 0, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = '#ffffff'
    ctx.beginPath()
    ctx.arc(bx, by, isPutt ? 8 : 10, 0, Math.PI * 2)
    ctx.fill()
  } else {
    const sp = clamp01((p - flightEnd) / (1 - flightEnd))
    if (seg.shot.penalty) {
      ctx.strokeStyle = `rgba(255,255,255,${0.8 * (1 - sp)})`
      for (let i = 0; i < 3; i++) {
        ctx.lineWidth = 4 - i
        ctx.beginPath()
        ctx.arc(to[0], to[1], 8 + sp * 46 + i * 12, 0, Math.PI * 2)
        ctx.stroke()
      }
    } else if (seg.shot.holed) {
      const r = 9 * (1 - sp)
      if (r > 0.5) {
        ctx.fillStyle = '#ffffff'
        ctx.beginPath()
        ctx.arc(to[0], to[1], r, 0, Math.PI * 2)
        ctx.fill()
      }
      ctx.strokeStyle = `rgba(255,255,255,${0.9 * (1 - sp)})`
      ctx.lineWidth = 5
      ctx.beginPath()
      ctx.arc(l.pin[0], l.pin[1], 16 + sp * 30, 0, Math.PI * 2)
      ctx.stroke()
    } else {
      const bounce = Math.abs(Math.sin(sp * Math.PI * 2)) * 6 * (1 - sp)
      if (seg.shot.toLie === 'bunker' && sp < 0.5) {
        ctx.fillStyle = `rgba(232,216,168,${0.7 * (1 - sp * 2)})`
        ctx.beginPath()
        ctx.arc(to[0], to[1] - 6, 14 + sp * 22, 0, Math.PI * 2)
        ctx.fill()
      }
      ctx.fillStyle = '#ffffff'
      ctx.beginPath()
      ctx.arc(to[0], to[1] - bounce, 9, 0, Math.PI * 2)
      ctx.fill()
    }
  }

  drawShotTag(ctx, g, seg, from)
}

/** The "who's playing" tag under the active golfer. */
function drawShotTag(
  ctx: Ctx,
  g: { name: string; color: string },
  seg: GolfShotSeg,
  anchor: [number, number],
): void {
  const tagW = 280
  const tagY = Math.min(anchor[1] + 42, GOLF_ART.y + GOLF_ART.h - 40)
  const tagX = Math.max(GOLF_ART.x + 10, Math.min(anchor[0] - tagW / 2, GOLF_ART.x + GOLF_ART.w - tagW - 10))
  roundRect(ctx, tagX, tagY, tagW, 40, 8)
  ctx.fillStyle = 'rgba(9,13,20,0.82)'
  ctx.fill()
  ctx.fillStyle = g.color
  ctx.fillRect(tagX, tagY, 8, 40)
  ctx.fillStyle = '#fff'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.font = 'bold 21px system-ui, sans-serif'
  const isDrop = seg.shot.kind === 'penaltyDrop'
  const label = isDrop
    ? `${g.name.split(' ').pop()?.toUpperCase()} · PENALTY DROP`
    : `${g.name.split(' ').pop()?.toUpperCase()} · ${seg.shot.kind.toUpperCase()} ${seg.shot.shotNo}`
  ctx.fillText(label, tagX + tagW / 2 + 4, tagY + 20)
}

// --- overlays ---------------------------------------------------------------

function drawScorebug(ctx: Ctx, model: GolfRenderModel, t: number): void {
  const plan = model.plan
  const cx = model.width / 2
  const w = 720
  const hgt = 92
  const x = cx - w / 2
  const y = BUG_Y
  roundRect(ctx, x, y, w, hgt, 16)
  ctx.fillStyle = 'rgba(9,13,20,0.94)'
  ctx.fill()
  ctx.lineWidth = 3
  ctx.strokeStyle = model.event.color
  roundRect(ctx, x, y, w, hgt, 16)
  ctx.stroke()

  ctx.textBaseline = 'middle'
  ctx.textAlign = 'left'
  ctx.fillStyle = model.event.major ? '#d4af37' : '#e8edf4'
  ctx.font = 'bold 30px system-ui, sans-serif'
  ctx.fillText(model.event.short, x + 26, y + hgt / 2 - 16)
  ctx.fillStyle = 'rgba(255,255,255,0.55)'
  ctx.font = 'bold 20px system-ui, sans-serif'
  const groupLbl = plan.group === 1 ? 'GROUP 2' : 'GROUP 1'
  ctx.fillText(
    `${model.event.major ? (model.event.championship ? 'THE CHAMPIONSHIP · ' : 'MAJOR · ') : ''}${groupLbl}`,
    x + 26,
    y + hgt / 2 + 18,
  )

  const hole = golfHoleAt(plan, t)
  const holeDef = model.m.config.course.holes[hole.hole]
  ctx.textAlign = 'right'
  ctx.fillStyle = '#fff'
  ctx.font = 'bold 34px system-ui, sans-serif'
  ctx.fillText(t >= plan.playEnd ? 'FINAL' : `HOLE ${hole.hole + 1}/9`, x + w - 26, y + hgt / 2 - 14)
  ctx.fillStyle = 'rgba(255,255,255,0.55)'
  ctx.font = 'bold 20px system-ui, sans-serif'
  ctx.fillText(
    t >= plan.playEnd ? `ROUND ${model.m.config.round} DONE` : `PAR ${holeDef.par} · R${model.m.config.round}`,
    x + w - 26,
    y + hgt / 2 + 18,
  )
}

function drawGroupBoard(ctx: Ctx, model: GolfRenderModel, t: number, activeGolfer: number | null): void {
  const rows = golfBoardAt(model.plan, t)
  const w = 268
  const x = model.width - w - 16
  const y = GOLF_ART.y + 26
  const rowH = 56
  const h = 60 + rowH * rows.length
  roundRect(ctx, x, y, w, h, 12)
  ctx.fillStyle = 'rgba(9,13,20,0.78)'
  ctx.fill()
  ctx.strokeStyle = model.event.color
  ctx.lineWidth = 2
  roundRect(ctx, x, y, w, h, 12)
  ctx.stroke()

  ctx.textAlign = 'left'
  ctx.textBaseline = 'middle'
  ctx.fillStyle = 'rgba(255,255,255,0.6)'
  ctx.font = 'bold 19px system-ui, sans-serif'
  const thru = rows[0]?.thru ?? 0
  ctx.fillText(thru >= HOLES_PER_ROUND ? 'GROUP · F' : `GROUP · THRU ${thru}`, x + 16, y + 28)
  ctx.textAlign = 'right'
  ctx.fillText('RD·TOT', x + w - 14, y + 28)

  rows.forEach((r, i) => {
    const g = model.m.config.golfers[r.golfer]
    const ry = y + 60 + i * rowH
    if (activeGolfer === r.golfer) {
      ctx.fillStyle = 'rgba(255,255,255,0.12)'
      ctx.fillRect(x + 4, ry, w - 8, rowH - 4)
    }
    ctx.beginPath()
    ctx.arc(x + 26, ry + rowH / 2 - 2, 12, 0, Math.PI * 2)
    ctx.fillStyle = g.color
    ctx.fill()
    ctx.textAlign = 'left'
    ctx.fillStyle = '#e8edf4'
    ctx.font = 'bold 24px system-ui, sans-serif'
    ctx.fillText(g.abbr, x + 48, ry + rowH / 2 - 2)
    ctx.textAlign = 'right'
    ctx.font = 'bold 22px system-ui, sans-serif'
    ctx.fillStyle = r.toParRound < 0 ? '#ff5566' : 'rgba(255,255,255,0.65)'
    ctx.fillText(formatToPar(r.toParRound), x + w - 82, ry + rowH / 2 - 2)
    ctx.fillStyle = r.toParTotal < 0 ? '#ff5566' : r.toParTotal === 0 ? '#e8edf4' : '#8fa3b8'
    ctx.font = 'bold 24px system-ui, sans-serif'
    ctx.fillText(formatToPar(r.toParTotal), x + w - 14, ry + rowH / 2 - 2)
    ctx.textAlign = 'left'
  })
}

function drawHoleCard(ctx: Ctx, model: GolfRenderModel, holeIdx: number, prog: number): void {
  const a = prog < 0.7 ? ease(clamp01(prog * 3.4)) : ease(clamp01((1 - prog) / 0.3))
  const hole = model.m.config.course.holes[holeIdx]
  ctx.save()
  ctx.globalAlpha = a
  const cx = model.width / 2 - 110
  const cy = GOLF_ART.y + 190
  roundRect(ctx, cx - 190, cy - 56, 380, 112, 14)
  ctx.fillStyle = 'rgba(9,13,20,0.88)'
  ctx.fill()
  ctx.strokeStyle = model.event.color
  ctx.lineWidth = 3
  roundRect(ctx, cx - 190, cy - 56, 380, 112, 14)
  ctx.stroke()
  ctx.fillStyle = '#fff'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.font = 'bold 46px system-ui, sans-serif'
  ctx.fillText(`HOLE ${holeIdx + 1}`, cx, cy - 14)
  ctx.fillStyle = 'rgba(255,255,255,0.6)'
  ctx.font = 'bold 25px system-ui, sans-serif'
  ctx.fillText(`PAR ${hole.par}${hole.water ? ' · WATER' : ''}`, cx, cy + 28)
  ctx.restore()
}

function drawLowerThird(ctx: Ctx, model: GolfRenderModel, mo: GolfMoment, prog: number): void {
  const w = 800
  const h = 78
  const x = model.width / 2 - w / 2
  const y = 1668
  const g = mo.golfer !== null ? model.m.config.golfers[mo.golfer] : null
  ctx.save()
  ctx.globalAlpha = Math.min(ease(clamp01(prog * 4)), ease(clamp01((1 - prog) * 4)))
  roundRect(ctx, x, y, w, h, 10)
  ctx.fillStyle = 'rgba(9,13,20,0.86)'
  ctx.fill()
  ctx.fillStyle = g ? g.color : model.event.color
  ctx.fillRect(x, y, 12, h)
  ctx.fillStyle = mo.kind === 'ace' || mo.kind === 'eagle' || mo.kind === 'winner' ? '#ffd24a' : '#fff'
  ctx.textAlign = 'left'
  ctx.textBaseline = 'middle'
  fitText(ctx, mo.label, w - 60, 34)
  ctx.fillText(mo.label, x + 34, y + h / 2)
  ctx.restore()
}

function drawIntro(ctx: Ctx, model: GolfRenderModel, progress: number): void {
  const a = progress < 0.85 ? clamp01(progress * 3) : clamp01((1 - progress) / 0.15)
  ctx.save()
  ctx.globalAlpha = a
  ctx.fillStyle = 'rgba(6,9,14,0.96)'
  ctx.fillRect(0, 0, model.width, model.height)
  const cx = model.width / 2
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'

  const grad = ctx.createLinearGradient(0, 300, 0, 1500)
  grad.addColorStop(0, model.event.color + '55')
  grad.addColorStop(1, 'rgba(6,9,14,0)')
  ctx.fillStyle = grad
  ctx.fillRect(0, 260, model.width, 1240)

  ctx.fillStyle = model.event.major ? '#d4af37' : '#ff5566'
  ctx.font = 'bold 38px system-ui, sans-serif'
  const kicker = model.event.championship
    ? 'THE CHAMPIONSHIP · FINAL MAJOR'
    : model.event.major
      ? 'A MAJOR CHAMPIONSHIP'
      : 'APEX TOUR'
  ctx.fillText(kicker, cx, 360 + 30 * clamp01(progress * 3))

  ctx.fillStyle = '#f2f4f3'
  ctx.globalAlpha = a * clamp01(progress * 4 - 0.4)
  fitText(ctx, model.event.name.toUpperCase(), 960, 72)
  ctx.fillText(model.event.name.toUpperCase(), cx, 470)

  ctx.font = 'bold 32px system-ui, sans-serif'
  ctx.fillStyle = model.event.colorAlt
  ctx.fillText(model.courseName.toUpperCase(), cx, 552)
  ctx.fillStyle = 'rgba(255,255,255,0.65)'
  ctx.font = 'bold 28px system-ui, sans-serif'
  const groupLbl = model.plan.group === 1 ? 'GROUP 2' : 'GROUP 1'
  ctx.fillText(`ROUND ${model.m.config.round} OF 4 · ${groupLbl} · ALL 9 HOLES`, cx, 610)

  model.storyChips.forEach((chip, i) => {
    const y = 724 + i * 88
    ctx.font = 'bold 30px system-ui, sans-serif'
    const wch = Math.min(940, ctx.measureText(chip).width + 120)
    roundRect(ctx, cx - wch / 2, y - 32, wch, 64, 10)
    ctx.fillStyle = 'rgba(255,255,255,0.08)'
    ctx.fill()
    ctx.strokeStyle = model.event.color
    ctx.lineWidth = 2
    roundRect(ctx, cx - wch / 2, y - 32, wch, 64, 10)
    ctx.stroke()
    ctx.fillStyle = '#e8edf4'
    fitText(ctx, chip, wch - 60, 30)
    ctx.fillText(chip, cx, y)
  })

  // the four golfers of THIS group, tee order
  const gy = 1000
  model.plan.golfers.forEach((gi, i) => {
    const g = model.m.config.golfers[gi]
    const yy = gy + i * 118
    ctx.globalAlpha = a * clamp01(progress * 4 - 0.6 - i * 0.1)
    ctx.beginPath()
    ctx.arc(cx - 330, yy, 34, 0, Math.PI * 2)
    ctx.fillStyle = g.color
    ctx.fill()
    ctx.fillStyle = readableOn(g.color)
    ctx.font = 'bold 24px system-ui, sans-serif'
    ctx.fillText(g.abbr, cx - 330, yy + 1)
    ctx.fillStyle = '#e8edf4'
    ctx.textAlign = 'left'
    ctx.font = 'bold 38px system-ui, sans-serif'
    ctx.fillText(g.name, cx - 270, yy)
    ctx.textAlign = 'right'
    const tp = model.m.config.startToPar[gi]
    ctx.fillStyle = tp < 0 ? '#ff5566' : 'rgba(255,255,255,0.6)'
    ctx.fillText(formatToPar(tp), cx + 340, yy)
    ctx.textAlign = 'center'
  })
  ctx.restore()
}

function drawResult(ctx: Ctx, model: GolfRenderModel, progress: number): void {
  ctx.save()
  ctx.globalAlpha = clamp01(progress * 3)
  ctx.fillStyle = 'rgba(6,9,14,0.95)'
  ctx.fillRect(0, 0, model.width, model.height)
  const cx = model.width / 2
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'

  const rows = model.plan.board[model.plan.board.length - 1].rows
  const isFinal = model.m.config.round === 4
  const winnerEv = model.m.events.find((e) => e.type === 'winner')
  const champInGroup =
    isFinal && winnerEv && winnerEv.golfer !== null && model.plan.golfers.includes(winnerEv.golfer)

  ctx.fillStyle = model.event.major ? '#d4af37' : '#ff5566'
  ctx.font = 'bold 38px system-ui, sans-serif'
  const kicker = champInGroup
    ? model.event.major
      ? 'MAJOR CHAMPION'
      : 'TOURNAMENT WINNER'
    : `${model.plan.group === 1 ? 'GROUP 2' : 'GROUP 1'} · ROUND ${model.m.config.round} COMPLETE`
  ctx.fillText(kicker, cx, 430)

  if (champInGroup && winnerEv && winnerEv.golfer !== null) {
    const champ = model.m.config.golfers[winnerEv.golfer]
    ctx.beginPath()
    ctx.arc(cx, 580, 64, 0, Math.PI * 2)
    ctx.fillStyle = champ.color
    ctx.fill()
    ctx.lineWidth = 5
    ctx.strokeStyle = '#d4af37'
    ctx.stroke()
    ctx.fillStyle = readableOn(champ.color)
    ctx.font = 'bold 44px system-ui, sans-serif'
    ctx.fillText(champ.abbr, cx, 582)
    ctx.fillStyle = '#fff'
    fitText(ctx, champ.name.toUpperCase(), 940, 68)
    ctx.fillText(champ.name.toUpperCase(), cx, 716)
    ctx.fillStyle = '#d4af37'
    ctx.font = 'bold 54px system-ui, sans-serif'
    ctx.fillText(formatToPar(model.m.totalToPar[winnerEv.golfer]), cx, 800)
  } else {
    const leader = model.m.config.golfers[rows[0].golfer]
    ctx.fillStyle = '#fff'
    fitText(ctx, `${leader.name.toUpperCase()} LEADS THE GROUP`, 940, 54)
    ctx.fillText(`${leader.name.toUpperCase()} LEADS THE GROUP`, cx, 540)
    ctx.fillStyle = '#d4af37'
    ctx.font = 'bold 50px system-ui, sans-serif'
    ctx.fillText(formatToPar(rows[0].toParTotal), cx, 620)
  }

  const by = champInGroup ? 950 : 780
  rows.forEach((r, i) => {
    const g = model.m.config.golfers[r.golfer]
    const yy = by + i * 96
    ctx.globalAlpha = clamp01(progress * 3) * clamp01(progress * 5 - i * 0.12)
    ctx.textAlign = 'left'
    ctx.fillStyle = 'rgba(255,255,255,0.5)'
    ctx.font = 'bold 30px system-ui, sans-serif'
    ctx.fillText(`${i + 1}`, cx - 340, yy)
    ctx.beginPath()
    ctx.arc(cx - 270, yy, 24, 0, Math.PI * 2)
    ctx.fillStyle = g.color
    ctx.fill()
    ctx.fillStyle = '#e8edf4'
    ctx.font = 'bold 34px system-ui, sans-serif'
    ctx.fillText(g.name, cx - 222, yy)
    ctx.textAlign = 'right'
    ctx.font = 'bold 28px system-ui, sans-serif'
    ctx.fillStyle = 'rgba(255,255,255,0.65)'
    ctx.fillText(`R ${formatToPar(r.toParRound)}`, cx + 210, yy)
    ctx.fillStyle = r.toParTotal < 0 ? '#ff5566' : 'rgba(255,255,255,0.8)'
    ctx.font = 'bold 34px system-ui, sans-serif'
    ctx.fillText(formatToPar(r.toParTotal), cx + 340, yy)
  })
  ctx.restore()
}

/** Draw one frame of a foursome's round at render-time `t`. Pure fn of (model, t). */
export function drawGolfFrame(ctx: Ctx, model: GolfRenderModel, t: number): void {
  const plan = model.plan
  ctx.fillStyle = '#0a0e14'
  ctx.fillRect(0, 0, model.width, model.height)

  const hole = golfHoleAt(plan, t)
  const layout = model.layouts[hole.hole]

  // Green zoom: the moment the group is around the green (chips + putts), push
  // RIGHT in so every putt — and every miss — is readable. The green sits high
  // in the frame so greenside chips coming up from below stay in shot.
  let zoomP = 0
  if (hole.greenT !== undefined && t >= hole.greenT && t < hole.t1 + 0.2) {
    zoomP = ease(clamp01((t - hole.greenT) / 0.55))
  }
  const scale = 1 + 2.2 * zoomP // ~3.2× — tight enough to read the break
  ctx.save()
  if (zoomP > 0) {
    const anchorX = GOLF_ART.x + GOLF_ART.w / 2 - 80
    const anchorY = GOLF_ART.y + 430
    ctx.translate(
      anchorX * zoomP + layout.greenC[0] * (1 - zoomP),
      anchorY * zoomP + layout.greenC[1] * (1 - zoomP),
    )
    ctx.scale(scale, scale)
    ctx.translate(-layout.greenC[0], -layout.greenC[1])
  }

  drawGolfHole(ctx, layout)

  const active = golfActiveSegAt(plan, Math.min(t, plan.playEnd - 0.001))
  const activeGolfer = active && active.shot.hole === hole.hole ? active.shot.golfer : null
  drawWaitingGolfers(ctx, model, layout, hole.hole, t, activeGolfer)
  if (active && active.shot.hole === hole.hole) drawActiveShot(ctx, model, layout, active, t)
  ctx.restore()

  const cardProg = (t - hole.t0) / 1.1
  if (cardProg >= 0 && cardProg < 1) drawHoleCard(ctx, model, hole.hole, cardProg)

  drawScorebug(ctx, model, t)
  drawGroupBoard(ctx, model, t, activeGolfer)

  const mo = pickActiveGolfMoment(plan, t)
  if (mo) drawLowerThird(ctx, model, mo, clamp01((t - mo.t) / mo.dur))

  if (t < plan.introDur) drawIntro(ctx, model, t / plan.introDur)
  if (t >= plan.resultStart) drawResult(ctx, model, clamp01((t - plan.resultStart) / plan.resultDur))
  drawWordmark(ctx, model.width / 2, WORDMARK_Y, 32)
}
