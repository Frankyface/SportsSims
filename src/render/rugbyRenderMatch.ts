// Pure Canvas renderer for RUGBY: draws a single frame of a Bastion
// Championships match at render-time `t`. A RugbyRenderModel is built once
// from a RugbyMatchResult; drawRugbyFrame(ctx, model, t) is a pure function of
// (model, t), so the identical function powers the live preview and the
// frame-stepped WebCodecs export. Mirrors renderMatch.ts (soccer) — kept as
// its own module so the soccer path never loads rugby assets and vice-versa.

import type { RugbyMatchResult } from '../sim/rugbyTypes'
import type { TeamRating } from '../sim/types'
import {
  buildRugbyRenderPlan,
  pickActiveRugbyMoment,
  rugbyClockSecAt,
  rugbyScoreAt,
  type RugbyMoment,
  type RugbyRenderPlan,
} from './rugbyDirector'
import {
  drawRugbyBall,
  drawRugbyCrowd,
  drawRugbyPitch,
  drawRugbyPlayers,
  drawRugbyPosts,
  rugbyBallStateAt,
  INGOAL_PX,
  RUGBY_PITCH,
} from './rugbyScene'
import { drawWordmark } from './wordmark'
import { drawLogoCircle, drawLogoContain } from './logos'
import { getBastionLogo, getRugbyLogo } from './rugbyLogos'

export interface RugbyRenderModel {
  plan: RugbyRenderPlan
  home: TeamRating
  away: TeamRating
  finalScore: [number, number]
  width: number
  height: number
  seed: number
}

export const RUGBY_RENDER_W = 1080
export const RUGBY_RENDER_H = 1920

export function buildRugbyRenderModel(
  m: RugbyMatchResult,
  width = RUGBY_RENDER_W,
  height = RUGBY_RENDER_H,
): RugbyRenderModel {
  return {
    plan: buildRugbyRenderPlan(m),
    home: m.config.home,
    away: m.config.away,
    finalScore: m.score,
    width,
    height,
    seed: m.renderSeed >>> 0,
  }
}

const BUG_Y = 150
const WORDMARK_Y = 95

function ease(t: number): number {
  return t < 0.5 ? 2 * t * t : 1 - ((-2 * t + 2) * (-2 * t + 2)) / 2
}
function clamp01(x: number): number {
  return x < 0 ? 0 : x > 1 ? 1 : x
}

type Ctx = CanvasRenderingContext2D

function roundRect(ctx: Ctx, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

function fitText(ctx: Ctx, text: string, max: number, startPx: number): void {
  let px = startPx
  ctx.font = `bold ${px}px system-ui, sans-serif`
  while (ctx.measureText(text).width > max && px > 26) {
    px -= 4
    ctx.font = `bold ${px}px system-ui, sans-serif`
  }
}

function readableOn(hex: string): string {
  const h = hex.replace('#', '')
  const r = parseInt(h.slice(0, 2), 16)
  const g = parseInt(h.slice(2, 4), 16)
  const b = parseInt(h.slice(4, 6), 16)
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255
  return lum > 0.6 ? '#0a0e14' : '#ffffff'
}

function drawCrestChip(ctx: Ctx, cx: number, cy: number, r: number, color: string, abbr: string): void {
  ctx.save()
  ctx.beginPath()
  ctx.arc(cx, cy, r, 0, Math.PI * 2)
  ctx.fillStyle = color
  ctx.fill()
  ctx.lineWidth = Math.max(2, r * 0.05)
  ctx.strokeStyle = 'rgba(255,255,255,0.28)'
  ctx.stroke()
  ctx.fillStyle = readableOn(color)
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.font = `bold ${Math.round(r * 0.72)}px system-ui, sans-serif`
  ctx.fillText(abbr, cx, cy + 2)
  ctx.restore()
}

function easeOutBack(p: number): number {
  const c1 = 1.70158
  const c3 = c1 + 1
  const q = p - 1
  return 1 + c3 * q * q * q + c1 * q * q
}

function drawScorebug(ctx: Ctx, model: RugbyRenderModel, t: number): void {
  const plan = model.plan
  const cx = model.width / 2
  const w = 640
  const h = 100
  const x = cx - w / 2
  const y = BUG_Y
  roundRect(ctx, x, y, w, h, 16)
  ctx.fillStyle = 'rgba(9,13,20,0.94)'
  ctx.fill()
  ctx.lineWidth = 3
  ctx.strokeStyle = '#c8102e'
  roundRect(ctx, x, y, w, h, 16)
  ctx.stroke()

  const homeCrest = getRugbyLogo(model.home.id)
  const awayCrest = getRugbyLogo(model.away.id)
  if (homeCrest) {
    drawLogoCircle(ctx, homeCrest, x + 43, y + 51, 28)
  } else {
    drawCrestChip(ctx, x + 43, y + 51, 28, model.home.color, model.home.abbr)
  }
  if (awayCrest) {
    drawLogoCircle(ctx, awayCrest, x + w - 43, y + 51, 28)
  } else {
    drawCrestChip(ctx, x + w - 43, y + 51, 28, model.away.color, model.away.abbr)
  }

  ctx.textBaseline = 'middle'
  ctx.fillStyle = '#fff'
  ctx.font = 'bold 40px system-ui, sans-serif'
  ctx.textAlign = 'left'
  ctx.fillText(model.home.abbr, x + 84, y + h / 2 - 8)
  ctx.textAlign = 'right'
  ctx.fillText(model.away.abbr, x + w - 84, y + h / 2 - 8)

  ctx.font = 'bold 15px system-ui, sans-serif'
  ctx.fillStyle = 'rgba(255,255,255,0.55)'
  ctx.textAlign = 'left'
  ctx.fillText('HOME', x + 84, y + h - 22)
  ctx.textAlign = 'right'
  ctx.fillText('AWAY', x + w - 84, y + h - 22)

  const score = rugbyScoreAt(plan, t)
  ctx.textAlign = 'center'
  ctx.font = 'bold 58px system-ui, sans-serif'
  ctx.fillText(`${score[0]} - ${score[1]}`, cx, y + h / 2)

  const chipW = 128
  const chipX = x - chipW - 16
  roundRect(ctx, chipX, y + 20, chipW, h - 40, 12)
  ctx.fillStyle = 'rgba(9,13,20,0.94)'
  ctx.fill()
  ctx.lineWidth = 3
  ctx.strokeStyle = '#c8102e'
  roundRect(ctx, chipX, y + 20, chipW, h - 40, 12)
  ctx.stroke()
  ctx.font = 'bold 34px system-ui, sans-serif'
  const minute = Math.min(80, Math.floor(rugbyClockSecAt(plan, t) / 60))
  // late drama: within one converted try with ten to play — the clock pulses
  const closeLate = minute >= 72 && t < plan.playEnd && Math.abs(score[0] - score[1]) <= 7
  ctx.fillStyle = closeLate && Math.sin(t * 7) > 0 ? '#ffffff' : '#ff5566'
  const clock = t >= plan.playEnd ? 'FT' : `${minute}'`
  ctx.fillText(clock, chipX + chipW / 2, y + h / 2)
}

function momentColor(model: RugbyRenderModel, m: RugbyMoment): string {
  if (m.team === 'home') return model.home.color
  if (m.team === 'away') return model.away.color
  return '#c8102e'
}

function drawLowerThird(ctx: Ctx, model: RugbyRenderModel, m: RugbyMoment, prog: number): void {
  const w = 760
  const h = 78
  const x = model.width / 2 - w / 2
  const y = 1330
  ctx.save()
  ctx.globalAlpha = Math.min(ease(clamp01(prog * 4)), ease(clamp01((1 - prog) * 4)))
  roundRect(ctx, x, y, w, h, 10)
  ctx.fillStyle = 'rgba(9,13,20,0.82)'
  ctx.fill()
  ctx.fillStyle = momentColor(model, m)
  ctx.fillRect(x, y, 12, h)

  let textX = x + 32
  if (m.cardType) {
    ctx.fillStyle = m.cardType === 'red' ? '#e5322e' : '#ffd24a'
    roundRect(ctx, textX, y + 20, 26, 38, 4)
    ctx.fill()
    textX += 44
  }
  ctx.fillStyle = '#fff'
  ctx.textAlign = 'left'
  ctx.textBaseline = 'middle'
  ctx.font = 'bold 34px system-ui, sans-serif'
  ctx.fillText(`${m.minute}'  ${m.label}`, textX, y + h / 2)
  ctx.restore()
}

function drawTryFlash(ctx: Ctx, model: RugbyRenderModel, m: RugbyMoment, prog: number): void {
  ctx.save()
  ctx.globalAlpha = 0.55 * (1 - clamp01(prog * 1.4))
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, model.width, model.height)

  // confetti from the in-goal the try was scored in (home attacks the top)
  const scorer = m.team === 'away' ? model.away : model.home
  const originY =
    m.team === 'home' ? RUGBY_PITCH.y + INGOAL_PX - 20 : RUGBY_PITCH.y + RUGBY_PITCH.h - INGOAL_PX + 20
  const colors = [scorer.color, '#ffffff', scorer.colorAlt]
  const tau = prog * 2.2
  ctx.globalAlpha = 1 - clamp01(prog * 1.1)
  for (let i = 0; i < 42; i++) {
    const h = (model.seed ^ Math.imul(i + 1, 2654435761)) >>> 0
    const a = (h % 1000) / 1000
    const b = ((h >> 10) % 1000) / 1000
    const vx = (a - 0.5) * 950
    const vy = (m.team === 'home' ? 1 : -1) * (140 + b * 480)
    const x = model.width / 2 + vx * tau
    const y = originY + vy * tau + 0.5 * 700 * tau * tau * (m.team === 'home' ? 1 : -0.4)
    const size = 7 + ((h >> 20) % 8)
    ctx.save()
    ctx.translate(x, y)
    ctx.rotate(tau * (2 + a * 6))
    ctx.fillStyle = colors[i % 3]
    ctx.fillRect(-size / 2, -size / 2, size, size * 0.62)
    ctx.restore()
  }

  ctx.globalAlpha = clamp01(prog * 3) * (1 - clamp01((prog - 0.55) / 0.45))
  ctx.fillStyle = '#ffffff'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.font = 'bold 150px system-ui, sans-serif'
  ctx.fillText('TRY!', model.width / 2, model.height / 2)
  ctx.restore()
}

function drawIntro(ctx: Ctx, model: RugbyRenderModel, progress: number): void {
  const a = progress < 0.85 ? clamp01(progress * 3) : clamp01((1 - progress) / 0.15)
  ctx.save()
  ctx.globalAlpha = a
  ctx.fillStyle = 'rgba(6,9,14,0.94)'
  ctx.fillRect(0, 0, model.width, model.height)
  const cx = model.width / 2
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'

  const popHome = Math.max(0.01, easeOutBack(clamp01(progress * 3.2)))
  const popAway = Math.max(0.01, easeOutBack(clamp01(progress * 3.2 - 0.35)))
  const popLeague = Math.max(0.01, easeOutBack(clamp01(progress * 3.2 - 0.7)))
  const nameA = clamp01(progress * 4 - 1)

  ctx.fillStyle = '#ff5566'
  ctx.font = 'bold 36px system-ui, sans-serif'
  ctx.fillText('MATCHDAY', cx, 260 + 40 * clamp01(progress * 3))

  const hl = getRugbyLogo(model.home.id)
  if (hl) drawLogoCircle(ctx, hl, cx, 468, 110 * popHome)
  else drawCrestChip(ctx, cx, 468, 110 * popHome, model.home.color, model.home.abbr)
  ctx.save()
  ctx.globalAlpha = a * nameA
  ctx.fillStyle = '#e8edf4'
  fitText(ctx, model.home.name, 900, 54)
  ctx.fillText(model.home.name, cx, 648)
  ctx.restore()

  // the Bastion Championships crest — the centrepiece between the two clubs
  const league = getBastionLogo()
  if (league) drawLogoContain(ctx, league, cx, 950, 320 * popLeague, 270 * popLeague)

  const al = getRugbyLogo(model.away.id)
  if (al) drawLogoCircle(ctx, al, cx, 1242, 110 * popAway)
  else drawCrestChip(ctx, cx, 1242, 110 * popAway, model.away.color, model.away.abbr)
  ctx.save()
  ctx.globalAlpha = a * nameA
  ctx.fillStyle = '#e8edf4'
  fitText(ctx, model.away.name, 900, 54)
  ctx.fillText(model.away.name, cx, 1422)
  ctx.restore()
  ctx.restore()
}

function drawResult(ctx: Ctx, model: RugbyRenderModel, progress: number): void {
  ctx.save()
  ctx.globalAlpha = clamp01(progress * 3)
  ctx.fillStyle = 'rgba(6,9,14,0.94)'
  ctx.fillRect(0, 0, model.width, model.height)
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  const cx = model.width / 2
  const hl = getRugbyLogo(model.home.id)
  const al = getRugbyLogo(model.away.id)
  if (hl) drawLogoCircle(ctx, hl, cx - 300, 560, 150)
  else drawCrestChip(ctx, cx - 300, 560, 150, model.home.color, model.home.abbr)
  if (al) drawLogoCircle(ctx, al, cx + 300, 560, 150)
  else drawCrestChip(ctx, cx + 300, 560, 150, model.away.color, model.away.abbr)
  ctx.fillStyle = '#ff5566'
  ctx.font = 'bold 38px system-ui, sans-serif'
  ctx.fillText('FULL-TIME', cx, 770)
  ctx.fillStyle = '#fff'
  ctx.font = 'bold 150px system-ui, sans-serif'
  ctx.fillText(`${model.finalScore[0]} - ${model.finalScore[1]}`, cx, 900)
  ctx.font = 'bold 40px system-ui, sans-serif'
  ctx.fillStyle = model.home.color
  ctx.textAlign = 'right'
  ctx.fillText(model.home.abbr, cx - 120, 1030)
  ctx.fillStyle = model.away.color
  ctx.textAlign = 'left'
  ctx.fillText(model.away.abbr, cx + 120, 1030)
  const [h, a] = model.finalScore
  const line = h > a ? `${model.home.name} win` : a > h ? `${model.away.name} win` : 'Honours even'
  ctx.textAlign = 'center'
  ctx.fillStyle = '#e8edf4'
  fitText(ctx, line, 960, 44)
  ctx.fillText(line, cx, 1170)
  ctx.restore()
}

/** Draw one frame of the rugby match at render-time `t`. Pure function of (model, t). */
export function drawRugbyFrame(ctx: Ctx, model: RugbyRenderModel, t: number): void {
  const plan = model.plan
  ctx.fillStyle = '#0a0e14'
  ctx.fillRect(0, 0, model.width, model.height)

  const tPlay = Math.min(t, plan.playEnd)
  const ball = rugbyBallStateAt(plan, tPlay)

  // try impact: a decaying screen shake on the scene (never the scorebug)
  let shakeX = 0
  let shakeY = 0
  for (const mo of plan.moments) {
    if (mo.kind !== 'try') continue
    const q = (t - mo.t) / 0.5
    if (q >= 0 && q < 1) {
      shakeX = Math.sin(t * 91) * 7 * (1 - q)
      shakeY = Math.cos(t * 83) * 5 * (1 - q)
    }
  }
  ctx.save()
  ctx.translate(shakeX, shakeY)
  drawRugbyCrowd(ctx, plan, model.seed, model.home.color, model.home.colorAlt, model.away.color, model.away.colorAlt, tPlay)
  drawRugbyPitch(ctx)
  drawRugbyPosts(ctx)
  drawRugbyPlayers(ctx, plan, model.seed, model.home.color, model.away.color, tPlay, ball)
  drawRugbyBall(ctx, ball, model.home.color, model.away.color)
  ctx.restore()

  drawScorebug(ctx, model, t)

  const active = pickActiveRugbyMoment(plan, t)
  if (active) {
    drawLowerThird(ctx, model, active, clamp01((t - active.t) / active.dur))
  }
  for (const m of plan.moments) {
    if (m.kind === 'try' && t >= m.t && t <= m.t + m.dur) {
      drawTryFlash(ctx, model, m, clamp01((t - m.t) / m.dur))
    }
  }

  if (t < plan.introDur) drawIntro(ctx, model, t / plan.introDur)
  if (t >= plan.resultStart) drawResult(ctx, model, clamp01((t - plan.resultStart) / plan.resultDur))
  drawWordmark(ctx, model.width / 2, WORDMARK_Y, 32)
}
