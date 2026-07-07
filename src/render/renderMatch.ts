// Pure Canvas renderer: draws a single frame of the match at render-time `t`.
// A RenderModel is built once from a MatchResult; drawFrame(ctx, model, t) is a
// pure function of (model, t), so the identical function powers the live preview
// and the frame-stepped WebCodecs export.
//
// This is NOT the deterministic sim — cosmetic drawing may use Math.sin/cos/PI.

import type { MatchResult, TeamRating } from '../sim/types'
import { buildRenderPlan, beatAt, type Beat, type RenderPlan } from './director'
import { drawWordmark } from './wordmark'

export interface RenderModel {
  plan: RenderPlan
  home: TeamRating
  away: TeamRating
  finalScore: [number, number]
  width: number
  height: number
  seed: number
}

export const RENDER_W = 1080
export const RENDER_H = 1920

export function buildRenderModel(m: MatchResult, width = RENDER_W, height = RENDER_H): RenderModel {
  return {
    plan: buildRenderPlan(m),
    home: m.config.home,
    away: m.config.away,
    finalScore: m.score,
    width,
    height,
    seed: m.renderSeed >>> 0,
  }
}

// Portrait layout; keep key content inside the IG safe band (avoid top ~220, bottom ~470).
const PITCH = { x: 70, y: 470, w: 940, h: 980 }
const BUG_Y = 300

function ease(t: number): number {
  return t < 0.5 ? 2 * t * t : 1 - ((-2 * t + 2) * (-2 * t + 2)) / 2
}
function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t
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

function drawPitch(ctx: Ctx): void {
  const { x, y, w, h } = PITCH
  const stripes = 10
  for (let i = 0; i < stripes; i++) {
    ctx.fillStyle = i % 2 === 0 ? '#176b34' : '#12592b'
    ctx.fillRect(x, y + (h / stripes) * i, w, h / stripes)
  }
  ctx.strokeStyle = 'rgba(255,255,255,0.5)'
  ctx.lineWidth = 4
  roundRect(ctx, x, y, w, h, 10)
  ctx.stroke()
  ctx.beginPath()
  ctx.moveTo(x, y + h / 2)
  ctx.lineTo(x + w, y + h / 2)
  ctx.stroke()
  ctx.beginPath()
  ctx.arc(x + w / 2, y + h / 2, 92, 0, Math.PI * 2)
  ctx.stroke()
  const gw = 240
  ctx.strokeRect(x + w / 2 - gw / 2, y - 2, gw, 44)
  ctx.strokeRect(x + w / 2 - gw / 2, y + h - 42, gw, 44)
}

function attackingGoalY(team: Beat['team']): number {
  // home attacks the top goal, away attacks the bottom goal
  return team === 'home' ? PITCH.y + 22 : PITCH.y + PITCH.h - 22
}

function ballPos(beat: Beat, progress: number): { x: number; y: number } {
  const cx = PITCH.x + PITCH.w / 2
  const cy = PITCH.y + PITCH.h / 2
  if (beat.kind === 'intro' || beat.kind === 'result' || beat.kind === 'card') {
    return { x: cx, y: cy }
  }
  const goalY = attackingGoalY(beat.team)
  const lateral = PITCH.x + PITCH.w * (0.28 + ((beat.shotXY[1] - 0.2) / 0.6) * 0.44)
  const p = ease(progress)
  let x = lerp(cx, lateral, p)
  let y = lerp(cy, goalY, p)
  if (beat.kind === 'goal' && progress > 0.72) {
    y = beat.team === 'home' ? PITCH.y - 14 : PITCH.y + PITCH.h + 14 // into the net
  } else if (beat.kind === 'miss' && progress > 0.7) {
    x += beat.team === 'home' ? 90 : -90 // drags wide
  } else if (beat.kind === 'save' && progress > 0.72) {
    y = lerp(goalY, cy, clamp01((progress - 0.72) / 0.28)) // pushed back out
  }
  return { x, y }
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

const FORM: Array<[number, number]> = [
  [0.5, 0.9],
  [0.26, 0.74],
  [0.74, 0.74],
  [0.4, 0.56],
  [0.6, 0.56],
]

function drawPlayers(ctx: Ctx, model: RenderModel, beat: Beat, t: number, progress: number): void {
  const ball = ballPos(beat, progress)
  const action = beat.kind !== 'intro' && beat.kind !== 'result'
  for (let side = 0; side < 2; side++) {
    const team = side === 0 ? model.home : model.away
    for (let i = 0; i < FORM.length; i++) {
      const rx = FORM[i][0]
      const ry = side === 0 ? FORM[i][1] : 1 - FORM[i][1]
      let px = PITCH.x + rx * PITCH.w
      let py = PITCH.y + ry * PITCH.h
      const ph = model.seed * 0.0007 + i * 1.3 + side * 9
      px += Math.sin(t * 1.5 + ph) * 10
      py += Math.cos(t * 1.2 + ph) * 10
      if (action) {
        px += (ball.x - px) * 0.06
        py += (ball.y - py) * 0.06
      }
      drawDisc(ctx, px, py, 22, team.color)
    }
  }
}

function drawBall(ctx: Ctx, beat: Beat, progress: number): void {
  const b = ballPos(beat, progress)
  ctx.beginPath()
  ctx.arc(b.x, b.y, 13, 0, Math.PI * 2)
  ctx.fillStyle = '#ffffff'
  ctx.fill()
  ctx.lineWidth = 2
  ctx.strokeStyle = '#111'
  ctx.stroke()
}

function drawScorebug(ctx: Ctx, model: RenderModel, beat: Beat): void {
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

  ctx.fillStyle = model.home.color
  roundRect(ctx, x + 16, y + 24, 54, 54, 8)
  ctx.fill()
  ctx.fillStyle = model.away.color
  roundRect(ctx, x + w - 70, y + 24, 54, 54, 8)
  ctx.fill()

  ctx.textBaseline = 'middle'
  ctx.fillStyle = '#fff'
  ctx.font = 'bold 40px system-ui, sans-serif'
  ctx.textAlign = 'left'
  ctx.fillText(model.home.abbr, x + 84, y + h / 2)
  ctx.textAlign = 'right'
  ctx.fillText(model.away.abbr, x + w - 84, y + h / 2)

  ctx.textAlign = 'center'
  ctx.font = 'bold 58px system-ui, sans-serif'
  ctx.fillText(`${beat.score[0]} - ${beat.score[1]}`, cx, y + h / 2)

  ctx.font = 'bold 24px system-ui, sans-serif'
  ctx.fillStyle = '#ff5566'
  const clock = beat.kind === 'result' ? 'FT' : beat.kind === 'intro' ? "0'" : `${beat.minute}'`
  ctx.fillText(clock, cx, y + h + 24)
}

function drawLowerThird(ctx: Ctx, model: RenderModel, beat: Beat, progress: number): void {
  const w = 760
  const h = 78
  const x = model.width / 2 - w / 2
  const y = 1372
  ctx.save()
  ctx.globalAlpha = ease(Math.min(1, progress * 3))
  roundRect(ctx, x, y, w, h, 10)
  ctx.fillStyle = 'rgba(9,13,20,0.95)'
  ctx.fill()
  const col = beat.team === 'home' ? model.home.color : beat.team === 'away' ? model.away.color : '#c8102e'
  ctx.fillStyle = col
  ctx.fillRect(x, y, 12, h)
  ctx.fillStyle = '#fff'
  ctx.textAlign = 'left'
  ctx.textBaseline = 'middle'
  ctx.font = 'bold 34px system-ui, sans-serif'
  ctx.fillText(`${beat.minute}'  ${beat.label}`, x + 32, y + h / 2)
  ctx.restore()
}

function drawGoalFlash(ctx: Ctx, model: RenderModel, progress: number): void {
  if (progress < 0.72) return
  const p = clamp01((progress - 0.72) / 0.28)
  ctx.save()
  ctx.globalAlpha = 0.55 * (1 - p)
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, model.width, model.height)
  ctx.globalAlpha = clamp01(p * 2) * (1 - clamp01((p - 0.6) / 0.4))
  ctx.fillStyle = '#ffffff'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.font = 'bold 150px system-ui, sans-serif'
  ctx.fillText('GOAL!', model.width / 2, model.height / 2)
  ctx.restore()
}

function fitText(ctx: Ctx, text: string, max: number, startPx: number): void {
  let px = startPx
  ctx.font = `bold ${px}px system-ui, sans-serif`
  while (ctx.measureText(text).width > max && px > 26) {
    px -= 4
    ctx.font = `bold ${px}px system-ui, sans-serif`
  }
}

function drawIntro(ctx: Ctx, model: RenderModel, progress: number): void {
  const a = progress < 0.85 ? clamp01(progress * 3) : clamp01((1 - progress) / 0.15)
  ctx.save()
  ctx.globalAlpha = a
  ctx.fillStyle = 'rgba(6,9,14,0.92)'
  ctx.fillRect(0, 0, model.width, model.height)
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillStyle = '#ff5566'
  ctx.font = 'bold 40px system-ui, sans-serif'
  ctx.fillText('MATCHDAY', model.width / 2, 660)
  ctx.fillStyle = model.home.color
  fitText(ctx, model.home.name, 940, 60)
  ctx.fillText(model.home.name, model.width / 2, 820)
  ctx.fillStyle = '#7b8794'
  ctx.font = 'bold 44px system-ui, sans-serif'
  ctx.fillText('vs', model.width / 2, 930)
  ctx.fillStyle = model.away.color
  fitText(ctx, model.away.name, 940, 60)
  ctx.fillText(model.away.name, model.width / 2, 1040)
  ctx.restore()
}

function drawResult(ctx: Ctx, model: RenderModel, progress: number): void {
  ctx.save()
  ctx.globalAlpha = clamp01(progress * 3)
  ctx.fillStyle = 'rgba(6,9,14,0.94)'
  ctx.fillRect(0, 0, model.width, model.height)
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillStyle = '#ff5566'
  ctx.font = 'bold 38px system-ui, sans-serif'
  ctx.fillText('FULL-TIME', model.width / 2, 690)
  ctx.fillStyle = '#fff'
  ctx.font = 'bold 150px system-ui, sans-serif'
  ctx.fillText(`${model.finalScore[0]} - ${model.finalScore[1]}`, model.width / 2, 850)
  ctx.font = 'bold 44px system-ui, sans-serif'
  ctx.fillStyle = model.home.color
  ctx.textAlign = 'right'
  ctx.fillText(model.home.abbr, model.width / 2 - 130, 1000)
  ctx.fillStyle = model.away.color
  ctx.textAlign = 'left'
  ctx.fillText(model.away.abbr, model.width / 2 + 130, 1000)
  const [h, a] = model.finalScore
  const line = h > a ? `${model.home.name} win` : a > h ? `${model.away.name} win` : 'Honours even'
  ctx.textAlign = 'center'
  ctx.fillStyle = '#e8edf4'
  fitText(ctx, line, 960, 44)
  ctx.fillText(line, model.width / 2, 1150)
  ctx.restore()
}

// (ESSPN wordmark is shared from ./wordmark)

/** Draw one frame of the match at render-time `t` seconds. Pure function of (model, t). */
export function drawFrame(ctx: Ctx, model: RenderModel, t: number): void {
  const { beat, progress } = beatAt(model.plan, t)
  ctx.fillStyle = '#0a0e14'
  ctx.fillRect(0, 0, model.width, model.height)
  drawPitch(ctx)
  drawPlayers(ctx, model, beat, t, progress)
  drawBall(ctx, beat, progress)
  drawScorebug(ctx, model, beat)
  if (beat.kind === 'goal' || beat.kind === 'bigChance' || beat.kind === 'card') {
    drawLowerThird(ctx, model, beat, progress)
  }
  if (beat.kind === 'goal') drawGoalFlash(ctx, model, progress)
  if (beat.kind === 'intro') drawIntro(ctx, model, progress)
  if (beat.kind === 'result') drawResult(ctx, model, progress)
  drawWordmark(ctx, model.width / 2, 180, 32)
}
