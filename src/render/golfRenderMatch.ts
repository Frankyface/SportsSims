// Pure Canvas renderer for GOLF: draws a single frame of an Apex Tour round
// at render-time `t`. A GolfRenderModel is built once from a GolfRoundResult;
// drawGolfFrame(ctx, model, t) is a pure function of (model, t), so the same
// function powers the live preview and the frame-stepped WebCodecs export.
// Its own module — the soccer/rugby paths never load golf art and vice-versa.

import type { GolfRoundResult, GolfShot } from '../sim/golfTypes'
import { HOLES_PER_ROUND } from '../sim/golfTypes'
import {
  buildGolfRenderPlan,
  formatToPar,
  golfChapterAt,
  golfLbAt,
  pickActiveGolfMoment,
  type GolfFeaturedShot,
  type GolfMoment,
  type GolfRenderPlan,
} from './golfDirector'
import {
  buildHoleLayout,
  drawGolfHole,
  holeToScreen,
  GOLF_ART,
  type GolfHoleLayout,
} from './golfCourseArt'
import { drawWordmark } from './wordmark'

export interface GolfEventBrand {
  name: string
  short: string
  color: string
  colorAlt: string
  major: boolean
  championship: boolean
}

export interface GolfRenderModel {
  plan: GolfRenderPlan
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
    plan: buildGolfRenderPlan(m),
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

// --- ball flight -----------------------------------------------------------

/**
 * Where the ball lands VISUALLY. Penalty shots fly into the drawn water (the
 * sim's drop spot stays authoritative for the next shot — this is cosmetic).
 */
function visualTarget(l: GolfHoleLayout, shot: GolfShot): [number, number] {
  if (shot.penalty) {
    if (l.water) return [l.water.x, l.water.y]
    const [, y] = holeToScreen(l, shot.to)
    const seaX = l.waterSide < 0 ? GOLF_ART.x + 90 : GOLF_ART.x + GOLF_ART.w - 90
    return [seaX, y]
  }
  return holeToScreen(l, shot.to)
}

function drawGolferChip(ctx: Ctx, x: number, y: number, color: string, abbr: string): void {
  ctx.beginPath()
  ctx.arc(x, y, 26, 0, Math.PI * 2)
  ctx.fillStyle = color
  ctx.fill()
  ctx.lineWidth = 3
  ctx.strokeStyle = 'rgba(255,255,255,0.7)'
  ctx.stroke()
  ctx.fillStyle = readableOn(color)
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.font = 'bold 19px system-ui, sans-serif'
  ctx.fillText(abbr, x, y + 1)
}

function drawFeaturedShot(ctx: Ctx, model: GolfRenderModel, l: GolfHoleLayout, f: GolfFeaturedShot, t: number): void {
  const g = model.m.config.golfers[f.shot.golfer]
  const p = clamp01((t - f.t0) / (f.t1 - f.t0))
  const from = holeToScreen(l, f.shot.from)
  const to = visualTarget(l, f.shot)
  const isPutt = f.shot.kind === 'putt'
  const flightEnd = isPutt ? 0.75 : 0.7
  const fp = clamp01(p / flightEnd)
  const e = ease(fp)

  const dx = to[0] - from[0]
  const dy = to[1] - from[1]
  const dist = Math.sqrt(dx * dx + dy * dy)
  // arc height: drives soar, putts roll
  const lift = isPutt ? 0 : f.shot.kind === 'chip' || f.shot.kind === 'recovery' ? dist * 0.18 : dist * 0.3 + 40

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

  // the golfer at the ball's origin
  drawGolferChip(ctx, from[0], from[1] + 2, g.color, g.abbr)

  if (fp < 1) {
    // ball in motion + shadow
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
    if (f.shot.penalty) {
      // splash rings, ball gone
      ctx.strokeStyle = `rgba(255,255,255,${0.8 * (1 - sp)})`
      for (let i = 0; i < 3; i++) {
        const rr = 8 + sp * 46 + i * 12
        ctx.lineWidth = 4 - i
        ctx.beginPath()
        ctx.arc(to[0], to[1], rr, 0, Math.PI * 2)
        ctx.stroke()
      }
    } else if (f.shot.holed) {
      // drop in the cup: flag pulse + shrinking ball
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
      // settle bounce
      const bounce = Math.abs(Math.sin(sp * Math.PI * 2)) * 6 * (1 - sp)
      if (f.shot.toLie === 'bunker' && sp < 0.5) {
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

  // shot tag under the golfer: name + shot kind
  const tagW = 250
  const tagY = Math.min(from[1] + 44, GOLF_ART.y + GOLF_ART.h - 40)
  const tagX = Math.max(GOLF_ART.x + 10, Math.min(from[0] - tagW / 2, GOLF_ART.x + GOLF_ART.w - tagW - 10))
  roundRect(ctx, tagX, tagY, tagW, 40, 8)
  ctx.fillStyle = 'rgba(9,13,20,0.82)'
  ctx.fill()
  ctx.fillStyle = g.color
  ctx.fillRect(tagX, tagY, 8, 40)
  ctx.fillStyle = '#fff'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.font = 'bold 21px system-ui, sans-serif'
  const kindLbl = f.shot.kind === 'penaltyDrop' ? 'DROP' : f.shot.kind.toUpperCase()
  ctx.fillText(`${g.name.split(' ').pop()?.toUpperCase()} · ${kindLbl}`, tagX + tagW / 2 + 4, tagY + 20)
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
  ctx.fillText(model.event.major ? (model.event.championship ? 'THE CHAMPIONSHIP · MAJOR' : 'MAJOR') : 'APEX TOUR', x + 26, y + hgt / 2 + 18)

  const chapter = golfChapterAt(plan, t)
  const hole = model.m.config.course.holes[chapter.hole]
  ctx.textAlign = 'right'
  ctx.fillStyle = '#fff'
  ctx.font = 'bold 34px system-ui, sans-serif'
  const holeLbl = t >= plan.playEnd ? 'FINAL' : `HOLE ${chapter.hole + 1}/9`
  ctx.fillText(holeLbl, x + w - 26, y + hgt / 2 - 14)
  ctx.fillStyle = 'rgba(255,255,255,0.55)'
  ctx.font = 'bold 20px system-ui, sans-serif'
  ctx.fillText(t >= plan.playEnd ? `ROUND ${model.m.config.round} DONE` : `PAR ${hole.par} · R${model.m.config.round}`, x + w - 26, y + hgt / 2 + 18)
}

function drawLeaderboard(ctx: Ctx, model: GolfRenderModel, t: number, featuredGolfer: number | null): void {
  const rows = golfLbAt(model.plan, t)
  const w = 264
  const x = model.width - w - 16
  const y = GOLF_ART.y + 26
  const rowH = 46
  const h = 54 + rowH * rows.length
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
  ctx.fillText(thru >= HOLES_PER_ROUND ? 'LEADERBOARD · F' : `LEADERBOARD · THRU ${thru}`, x + 16, y + 28)

  rows.forEach((r, i) => {
    const g = model.m.config.golfers[r.golfer]
    const ry = y + 54 + i * rowH
    if (featuredGolfer === r.golfer) {
      ctx.fillStyle = 'rgba(255,255,255,0.12)'
      ctx.fillRect(x + 4, ry, w - 8, rowH - 4)
    }
    ctx.fillStyle = i === 0 ? '#d4af37' : 'rgba(255,255,255,0.5)'
    ctx.font = 'bold 20px system-ui, sans-serif'
    ctx.fillText(`${i + 1}`, x + 14, ry + rowH / 2 - 2)
    ctx.beginPath()
    ctx.arc(x + 52, ry + rowH / 2 - 2, 11, 0, Math.PI * 2)
    ctx.fillStyle = g.color
    ctx.fill()
    ctx.fillStyle = '#e8edf4'
    ctx.font = 'bold 23px system-ui, sans-serif'
    ctx.fillText(g.abbr, x + 74, ry + rowH / 2 - 2)
    ctx.textAlign = 'right'
    const tp = r.toPar
    ctx.fillStyle = tp < 0 ? '#ff5566' : tp === 0 ? '#e8edf4' : '#8fa3b8'
    ctx.fillText(formatToPar(tp), x + w - 16, ry + rowH / 2 - 2)
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

function drawTick(ctx: Ctx, model: GolfRenderModel, holeIdx: number, prog: number): void {
  // a skipped hole: quick full-width leaderboard pulse "THRU N"
  const a = Math.min(ease(clamp01(prog * 4)), ease(clamp01((1 - prog) * 4)))
  ctx.save()
  ctx.globalAlpha = a
  const cx = model.width / 2 - 140
  const y = GOLF_ART.y + 560
  roundRect(ctx, cx - 170, y - 44, 340, 88, 12)
  ctx.fillStyle = 'rgba(9,13,20,0.9)'
  ctx.fill()
  ctx.fillStyle = model.event.colorAlt
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.font = 'bold 34px system-ui, sans-serif'
  ctx.fillText(`THRU ${holeIdx + 1}`, cx, y - 8)
  ctx.fillStyle = 'rgba(255,255,255,0.55)'
  ctx.font = 'bold 19px system-ui, sans-serif'
  ctx.fillText('QUIET HOLE — MOVING ON', cx, y + 26)
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

  // event colour wash
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
  ctx.fillText(kicker, cx, 380 + 30 * clamp01(progress * 3))

  ctx.fillStyle = '#f2f4f3'
  const nameA = clamp01(progress * 4 - 0.4)
  ctx.globalAlpha = a * nameA
  fitText(ctx, model.event.name.toUpperCase(), 960, 76)
  ctx.fillText(model.event.name.toUpperCase(), cx, 500)

  ctx.font = 'bold 34px system-ui, sans-serif'
  ctx.fillStyle = model.event.colorAlt
  ctx.fillText(`${model.courseName.toUpperCase()}`, cx, 590)
  ctx.fillStyle = 'rgba(255,255,255,0.65)'
  ctx.font = 'bold 30px system-ui, sans-serif'
  ctx.fillText(`ROUND ${model.m.config.round} OF 4 · 9 HOLES`, cx, 650)

  // storyline hooks from the stats book
  model.storyChips.forEach((chip, i) => {
    const y = 780 + i * 92
    const wch = Math.min(940, ctx.measureText(chip).width + 120)
    roundRect(ctx, cx - wch / 2, y - 34, wch, 68, 10)
    ctx.fillStyle = 'rgba(255,255,255,0.08)'
    ctx.fill()
    ctx.strokeStyle = model.event.color
    ctx.lineWidth = 2
    roundRect(ctx, cx - wch / 2, y - 34, wch, 68, 10)
    ctx.stroke()
    ctx.fillStyle = '#e8edf4'
    fitText(ctx, chip, wch - 60, 30)
    ctx.fillText(chip, cx, y)
  })

  // the field, entering leaderboard order
  const rows = model.plan.lb[0].rows
  const gy = 1100
  rows.forEach((r, i) => {
    const g = model.m.config.golfers[r.golfer]
    const col = i % 2
    const row = (i - col) / 2
    const gx = cx + (col === 0 ? -240 : 240)
    const yy = gy + row * 88
    ctx.globalAlpha = a * clamp01(progress * 4 - 0.6 - i * 0.06)
    ctx.beginPath()
    ctx.arc(gx - 150, yy, 22, 0, Math.PI * 2)
    ctx.fillStyle = g.color
    ctx.fill()
    ctx.fillStyle = '#e8edf4'
    ctx.textAlign = 'left'
    ctx.font = 'bold 30px system-ui, sans-serif'
    ctx.fillText(g.name, gx - 112, yy)
    ctx.textAlign = 'right'
    ctx.fillStyle = r.toPar < 0 ? '#ff5566' : 'rgba(255,255,255,0.6)'
    ctx.fillText(formatToPar(r.toPar), gx + 190, yy)
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

  const rows = model.plan.lb[model.plan.lb.length - 1].rows
  const isFinal = model.m.config.round === 4
  const champ = model.m.config.golfers[rows[0].golfer]

  ctx.fillStyle = model.event.major ? '#d4af37' : '#ff5566'
  ctx.font = 'bold 38px system-ui, sans-serif'
  ctx.fillText(isFinal ? (model.event.major ? 'MAJOR CHAMPION' : 'TOURNAMENT WINNER') : `ROUND ${model.m.config.round} COMPLETE`, cx, 420)

  ctx.fillStyle = '#fff'
  if (isFinal) {
    ctx.beginPath()
    ctx.arc(cx, 560, 64, 0, Math.PI * 2)
    ctx.fillStyle = champ.color
    ctx.fill()
    ctx.lineWidth = 5
    ctx.strokeStyle = '#d4af37'
    ctx.stroke()
    ctx.fillStyle = readableOn(champ.color)
    ctx.font = 'bold 44px system-ui, sans-serif'
    ctx.fillText(champ.abbr, cx, 562)
    ctx.fillStyle = '#fff'
    fitText(ctx, champ.name.toUpperCase(), 940, 72)
    ctx.fillText(champ.name.toUpperCase(), cx, 700)
    ctx.fillStyle = '#d4af37'
    ctx.font = 'bold 56px system-ui, sans-serif'
    ctx.fillText(formatToPar(rows[0].toPar), cx, 790)
  } else {
    fitText(ctx, `${champ.name.toUpperCase()} LEADS`, 940, 60)
    ctx.fillText(`${champ.name.toUpperCase()} LEADS`, cx, 520)
    ctx.fillStyle = '#d4af37'
    ctx.font = 'bold 52px system-ui, sans-serif'
    ctx.fillText(formatToPar(rows[0].toPar), cx, 600)
  }

  // final board
  const by = isFinal ? 900 : 720
  rows.forEach((r, i) => {
    const g = model.m.config.golfers[r.golfer]
    const yy = by + i * 78
    ctx.globalAlpha = clamp01(progress * 3) * clamp01(progress * 5 - i * 0.12)
    ctx.textAlign = 'left'
    ctx.fillStyle = i === 0 ? '#d4af37' : 'rgba(255,255,255,0.5)'
    ctx.font = 'bold 30px system-ui, sans-serif'
    ctx.fillText(`${i + 1}`, cx - 330, yy)
    ctx.beginPath()
    ctx.arc(cx - 260, yy, 20, 0, Math.PI * 2)
    ctx.fillStyle = g.color
    ctx.fill()
    ctx.fillStyle = '#e8edf4'
    ctx.fillText(g.name, cx - 216, yy)
    ctx.textAlign = 'right'
    ctx.fillStyle = r.toPar < 0 ? '#ff5566' : 'rgba(255,255,255,0.75)'
    ctx.fillText(formatToPar(r.toPar), cx + 330, yy)
  })
  ctx.restore()
}

/** Draw one frame of a golf round at render-time `t`. Pure function of (model, t). */
export function drawGolfFrame(ctx: Ctx, model: GolfRenderModel, t: number): void {
  const plan = model.plan
  ctx.fillStyle = '#0a0e14'
  ctx.fillRect(0, 0, model.width, model.height)

  const chapter = golfChapterAt(plan, t)
  const layout = model.layouts[chapter.hole]

  drawGolfHole(ctx, layout)

  // active featured ball flight
  let featuredGolfer: number | null = null
  if (chapter.covered) {
    for (const f of chapter.featured) {
      if (t >= f.t0 && t <= f.t1) {
        drawFeaturedShot(ctx, model, layout, f, t)
        featuredGolfer = f.shot.golfer
      }
    }
    const cardProg = (t - chapter.t0) / 0.9
    if (cardProg >= 0 && cardProg < 1) drawHoleCard(ctx, model, chapter.hole, cardProg)
  } else {
    drawTick(ctx, model, chapter.hole, clamp01((t - chapter.t0) / (chapter.t1 - chapter.t0)))
  }

  drawScorebug(ctx, model, t)
  drawLeaderboard(ctx, model, t, featuredGolfer)

  const active = pickActiveGolfMoment(plan, t)
  if (active) drawLowerThird(ctx, model, active, clamp01((t - active.t) / active.dur))

  if (t < plan.introDur) drawIntro(ctx, model, t / plan.introDur)
  if (t >= plan.resultStart) drawResult(ctx, model, clamp01((t - plan.resultStart) / plan.resultDur))
  drawWordmark(ctx, model.width / 2, WORDMARK_Y, 32)
}
