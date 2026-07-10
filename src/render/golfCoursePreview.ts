// The Tuesday "course preview" — a 10-image carousel posted BEFORE a
// tournament's rounds: a title card (event + course) plus one still per hole,
// all 9. Reuses the exact procedural hole art the round videos use
// (drawGolfHole), so the preview and the tournament share the same course look.
// Pure render-side code on its own event-level render seed — no sim data,
// cosmetic-only. Each image is a pure function of (model, index).

import {
  buildHoleLayout,
  drawGolfHole,
  drawFlagstick,
  GOLF_ART,
  type GolfHoleLayout,
} from './golfCourseArt'
import { drawWordmark } from './wordmark'
import { drawEventLogo, ensureEventLogo } from './golfEventLogos'
import { ensureSgaLogo } from './golfBrand'
import { ensureFontsLoaded } from './fonts'
import { GOLF_RENDER_W, GOLF_RENDER_H, type GolfEventBrand } from './golfRenderMatch'
import type { GolfCourseDef } from '../sim/golfTypes'
import { HOLES_PER_ROUND } from '../sim/golfTypes'
import { seedFromKey } from '../sim/prng'

const WORDMARK_Y = 95

/** Title card + one still per hole. */
export const PREVIEW_IMAGE_COUNT = 1 + HOLES_PER_ROUND

export interface GolfPreviewModel {
  event: GolfEventBrand
  courseName: string
  coursePar: number
  layouts: GolfHoleLayout[]
  width: number
  height: number
  seed: number
  /** 'preview' = the Tuesday teaser (default); 'results' = the post-event
   * results carousel's title card (page 2 is the final leaderboard). */
  variant: 'preview' | 'results'
}

/**
 * A course's preview render seed — event-level (NOT per-round), so the preview
 * is stable for a given tour/season/event and independent of the rounds' own
 * per-round art seeds. Deterministic: same (seedKey, season, eventIndex) → same
 * carousel forever.
 */
export function golfPreviewSeed(seedKey: string, season: number, eventIndex: number): number {
  return seedFromKey(`${seedKey}:s${season}:e${eventIndex}:preview`)
}

export function buildGolfPreviewModel(
  event: GolfEventBrand,
  course: GolfCourseDef,
  seed: number,
  width = GOLF_RENDER_W,
  height = GOLF_RENDER_H,
  variant: 'preview' | 'results' = 'preview',
): GolfPreviewModel {
  const layouts: GolfHoleLayout[] = []
  for (let hIdx = 0; hIdx < HOLES_PER_ROUND; hIdx++) {
    layouts.push(buildHoleLayout(course, hIdx, seed))
  }
  return {
    event,
    courseName: course.name,
    coursePar: course.par,
    layouts,
    width,
    height,
    seed: seed >>> 0,
    variant,
  }
}

/** Filename stem for preview image `index` (0 = title card, 1..9 = holes). */
export function previewImageName(index: number): string {
  return index <= 0 ? '0-title' : `${index}-hole-${index}`
}

// ---------- drawing ----------------------------------------------------------

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
function fitText(ctx: Ctx, text: string, max: number, startPx: number): number {
  let px = startPx
  ctx.font = `bold ${px}px system-ui, sans-serif`
  while (ctx.measureText(text).width > max && px > 24) {
    px -= 4
    ctx.font = `bold ${px}px system-ui, sans-serif`
  }
  return px
}

/** The nine-dot progress rail at the foot of each hole (current hole lit). */
function drawHoleDots(ctx: Ctx, model: GolfPreviewModel, current: number): void {
  const n = HOLES_PER_ROUND
  const gap = 46
  const cx = model.width / 2
  const y = GOLF_ART.y + GOLF_ART.h + 70
  const x0 = cx - ((n - 1) * gap) / 2
  for (let i = 0; i < n; i++) {
    const on = i === current
    ctx.beginPath()
    ctx.arc(x0 + i * gap, y, on ? 11 : 7, 0, Math.PI * 2)
    ctx.fillStyle = on ? model.event.color : i < current ? 'rgba(255,255,255,0.55)' : 'rgba(255,255,255,0.22)'
    ctx.fill()
  }
}

/** Slim top strip on hole stills: event + "COURSE PREVIEW" + hole/par. */
function drawPreviewBug(ctx: Ctx, model: GolfPreviewModel, holeIdx: number, par: number): void {
  const w = 720
  const hgt = 92
  const x = model.width / 2 - w / 2
  const y = 150
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
  ctx.fillText('COURSE PREVIEW', x + 26, y + hgt / 2 + 18)

  ctx.textAlign = 'right'
  ctx.fillStyle = '#fff'
  ctx.font = 'bold 34px system-ui, sans-serif'
  ctx.fillText(`HOLE ${holeIdx + 1}/9`, x + w - 26, y + hgt / 2 - 14)
  ctx.fillStyle = 'rgba(255,255,255,0.55)'
  ctx.font = 'bold 20px system-ui, sans-serif'
  ctx.fillText(`PAR ${par}`, x + w - 26, y + hgt / 2 + 18)
}

/** The centred HOLE n / PAR x card. */
function drawPreviewHoleCard(ctx: Ctx, model: GolfPreviewModel, holeIdx: number): void {
  const hole = model.layouts[holeIdx].hole
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
}

function drawPreviewTitle(ctx: Ctx, model: GolfPreviewModel): void {
  ctx.fillStyle = 'rgba(6,9,14,0.98)'
  ctx.fillRect(0, 0, model.width, model.height)
  const cx = model.width / 2
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'

  const grad = ctx.createLinearGradient(0, 300, 0, 1500)
  grad.addColorStop(0, model.event.color + '55')
  grad.addColorStop(1, 'rgba(6,9,14,0)')
  ctx.fillStyle = grad
  ctx.fillRect(0, 260, model.width, 1240)

  drawEventLogo(ctx, model.event.id, cx, 360, 210)

  ctx.fillStyle = model.event.major ? '#d4af37' : '#ff5566'
  ctx.font = 'bold 36px system-ui, sans-serif'
  const kickerTail = model.variant === 'results' ? 'RESULTS' : 'COURSE PREVIEW'
  const kicker = model.event.championship
    ? `THE CHAMPIONSHIP · ${kickerTail}`
    : model.event.major
      ? `A MAJOR · ${kickerTail}`
      : `SGA TOUR · ${kickerTail}`
  ctx.fillText(kicker, cx, 640)

  ctx.fillStyle = '#f2f4f3'
  fitText(ctx, model.event.name.toUpperCase(), 960, 78)
  ctx.fillText(model.event.name.toUpperCase(), cx, 740)

  ctx.font = 'bold 40px system-ui, sans-serif'
  ctx.fillStyle = model.event.colorAlt
  ctx.fillText(model.courseName.toUpperCase(), cx, 828)

  // divider
  ctx.strokeStyle = 'rgba(255,255,255,0.22)'
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.moveTo(cx - 300, 892)
  ctx.lineTo(cx + 300, 892)
  ctx.stroke()

  ctx.fillStyle = 'rgba(255,255,255,0.85)'
  ctx.font = 'bold 34px system-ui, sans-serif'
  const isResults = model.variant === 'results'
  ctx.fillText(isResults ? 'TOURNAMENT COMPLETE' : `ALL 9 HOLES · PAR ${model.coursePar}`, cx, 952)

  // pill: previews post the day before play; results wrap the finished event
  const label = isResults ? 'RESULTS' : 'PLAYING TOMORROW'
  ctx.font = 'bold 32px system-ui, sans-serif'
  const pw = ctx.measureText(label).width + 96
  roundRect(ctx, cx - pw / 2, 1024, pw, 68, 12)
  ctx.fillStyle = 'rgba(255,255,255,0.08)'
  ctx.fill()
  ctx.strokeStyle = model.event.color
  ctx.lineWidth = 2
  roundRect(ctx, cx - pw / 2, 1024, pw, 68, 12)
  ctx.stroke()
  ctx.fillStyle = '#e8edf4'
  ctx.fillText(label, cx, 1058)

  // swipe hint — page 1 of the carousel
  ctx.fillStyle = 'rgba(255,255,255,0.5)'
  ctx.font = 'bold 26px system-ui, sans-serif'
  ctx.fillText(isResults ? 'SWIPE FOR THE FINAL LEADERBOARD →' : 'SWIPE FOR ALL 9 HOLES →', cx, 1150)
}

/** Draw one still of the carousel: index 0 = title card, 1..9 = that hole. Pure. */
export function drawGolfPreviewImage(ctx: Ctx, model: GolfPreviewModel, index: number): void {
  ctx.fillStyle = '#0a0e14'
  ctx.fillRect(0, 0, model.width, model.height)

  if (index <= 0) {
    drawPreviewTitle(ctx, model)
    drawWordmark(ctx, model.width / 2, WORDMARK_Y, 32)
    return
  }

  const holeIdx = Math.min(HOLES_PER_ROUND - 1, index - 1)
  const layout = model.layouts[holeIdx]
  const A = GOLF_ART
  ctx.save()
  ctx.beginPath()
  ctx.rect(A.x, A.y, A.w, A.h)
  ctx.clip()
  drawGolfHole(ctx, layout)
  drawFlagstick(ctx, layout.pin)
  ctx.restore()

  drawPreviewBug(ctx, model, holeIdx, layout.hole.par)
  drawPreviewHoleCard(ctx, model, holeIdx)
  drawHoleDots(ctx, model, holeIdx)
  drawWordmark(ctx, model.width / 2, WORDMARK_Y, 32)
}

// ---------- PNG export -------------------------------------------------------

async function toPng(canvas: HTMLCanvasElement): Promise<Blob> {
  return await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Canvas toBlob failed'))), 'image/png'),
  )
}

/** Render a single preview still (0 = title, 1..9 = hole) to a PNG Blob. */
export async function exportGolfPreviewImage(model: GolfPreviewModel, index: number): Promise<Blob> {
  await Promise.all([ensureFontsLoaded(), ensureSgaLogo(), ensureEventLogo(model.event.id)])
  const canvas = document.createElement('canvas')
  canvas.width = model.width
  // 4:5 Instagram-feed crop (top-anchored): the header, hole card and green sit in
  // the upper frame, so cropping the 9:16 composition to 4:5 keeps what matters.
  canvas.height = Math.round((model.width * 5) / 4)
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Could not create a 2D canvas context for the course preview.')
  drawGolfPreviewImage(ctx, model, index)
  return await toPng(canvas)
}

/** Render the whole 10-image carousel (title + 9 holes) to named PNG Blobs. */
export async function exportGolfPreviewImages(
  model: GolfPreviewModel,
  onProgress?: (p: number) => void,
): Promise<Array<{ name: string; blob: Blob }>> {
  await Promise.all([ensureFontsLoaded(), ensureSgaLogo(), ensureEventLogo(model.event.id)])
  const out: Array<{ name: string; blob: Blob }> = []
  for (let i = 0; i < PREVIEW_IMAGE_COUNT; i++) {
    out.push({ name: previewImageName(i), blob: await exportGolfPreviewImage(model, i) })
    onProgress?.((i + 1) / PREVIEW_IMAGE_COUNT)
  }
  return out
}
