// The Apex Tour EVENT LEADERBOARD PNG (1080x1920) — posted after every round,
// alongside the two group videos. Full eight-golfer field, one column per
// round played so far, totals to par. Same network chrome as every ESSPN
// graphic; the event's own branding carries the accent.

import type { GolferRating } from '../sim/golfTypes'
import type { GolfEventDef } from '../ratings/golfCourses'
import { formatToPar } from './golfDirector'
import {
  DATA,
  GOLD,
  GOLD_WASH,
  HAIRLINE,
  MUTED,
  PTS_WHITE,
  TEXT,
  deriveClubTokens,
  drawBackground,
  drawCornerTicks,
  drawCrestBadge,
  drawTitleRule,
  drawWordmark,
  f,
  fitFont,
  withAlpha,
} from './theme'
import { ensureFontsLoaded } from './fonts'

export const GOLF_LB_W = 1080
export const GOLF_LB_H = 1920

const MARGIN_L = 48
const MARGIN_R = 1032
const TOP = 560
const ROW_H = 122

export interface GolfLeaderboardData {
  event: GolfEventDef
  season: number
  /** Field ratings in TOUR order (names/colours). */
  field: GolferRating[]
  /** toParByRound[round][tourIdx] for every round played so far. */
  toParByRound: number[][]
}

export function drawGolfLeaderboardCard(ctx: CanvasRenderingContext2D, data: GolfLeaderboardData): void {
  const cx = GOLF_LB_W / 2
  const rounds = data.toParByRound.length
  const accent = data.event.major ? '#d4af37' : data.event.color

  drawBackground(ctx, GOLF_LB_W, GOLF_LB_H, {
    glowCx: cx,
    glowCy: 200,
    glowColor: accent,
    glowAlpha: 0.09,
    glowR: 520,
  })

  ctx.fillStyle = '#FF4655'
  ctx.fillRect(0, 0, GOLF_LB_W, 6)
  drawWordmark(ctx, MARGIN_L, 72, 34, 'left')
  ctx.textBaseline = 'middle'
  ctx.textAlign = 'right'
  ctx.fillStyle = MUTED
  ctx.font = f('700', 26)
  ctx.fillText(`SEASON ${data.season} · SGA`, MARGIN_R, 72)

  ctx.textAlign = 'center'
  ctx.textBaseline = 'alphabetic'
  ctx.save()
  ctx.shadowColor = 'rgba(0,0,0,0.5)'
  ctx.shadowBlur = 10
  ctx.shadowOffsetY = 3
  ctx.fillStyle = TEXT
  fitFont(ctx, data.event.name.toUpperCase(), '800', 72, 44, MARGIN_R - MARGIN_L)
  ctx.fillText(data.event.name.toUpperCase(), cx, 300)
  ctx.restore()
  ctx.fillStyle = data.event.major ? GOLD : MUTED
  ctx.font = f('600', 30)
  const kicker = data.event.championship
    ? 'THE CHAMPIONSHIP · FINAL MAJOR'
    : data.event.major
      ? 'A MAJOR CHAMPIONSHIP'
      : 'TOUR EVENT'
  ctx.fillText(kicker, cx, 348)
  ctx.fillStyle = MUTED
  ctx.font = f('600', 32)
  ctx.fillText(rounds >= 4 ? 'FINAL LEADERBOARD' : `LEADERBOARD — AFTER ROUND ${rounds}`, cx, 402)
  drawTitleRule(ctx, cx, 434, 320, accent)

  // totals + finish order (ties by tour index — the countback lives in the engine)
  const totals = data.field.map((_, i) => data.toParByRound.reduce((s, r) => s + r[i], 0))
  const order = data.field.map((_, i) => i).sort((a, b) => totals[a] - totals[b] || a - b)

  // column headers: R1..Rn then TOT
  const rColX = (r: number): number => 620 + r * 92
  const totX = 964
  ctx.textBaseline = 'middle'
  ctx.fillStyle = MUTED
  ctx.font = f('600', 24)
  ctx.textAlign = 'left'
  ctx.fillText('GOLFER', 224, TOP - 44)
  ctx.textAlign = 'center'
  for (let r = 0; r < rounds; r++) ctx.fillText(`R${r + 1}`, rColX(r), TOP - 44)
  ctx.fillText('TOT', totX, TOP - 44)
  ctx.strokeStyle = HAIRLINE
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(MARGIN_L, TOP - 18)
  ctx.lineTo(MARGIN_R, TOP - 18)
  ctx.stroke()

  order.forEach((tourIdx, pos) => {
    const g = data.field[tourIdx]
    const center = TOP + pos * ROW_H + ROW_H / 2
    const bandTop = center - (ROW_H - 8) / 2
    const tokens = deriveClubTokens(g.color, g.colorAlt)

    ctx.fillStyle = withAlpha('#FFFFFF', pos % 2 ? 0.045 : 0.022)
    ctx.fillRect(MARGIN_L, bandTop, MARGIN_R - MARGIN_L, ROW_H - 8)
    if (pos === 0) {
      ctx.fillStyle = GOLD_WASH
      ctx.fillRect(MARGIN_L, bandTop, MARGIN_R - MARGIN_L, ROW_H - 8)
      ctx.fillStyle = withAlpha(accent, 0.85)
      ctx.fillRect(MARGIN_L, bandTop, MARGIN_R - MARGIN_L, 2)
    }
    ctx.fillStyle = tokens.field
    ctx.fillRect(MARGIN_L, bandTop + 6, 6, ROW_H - 20)

    if (pos === 0) {
      ctx.beginPath()
      ctx.arc(94, center, 19, 0, Math.PI * 2)
      ctx.fillStyle = GOLD
      ctx.fill()
      ctx.fillStyle = '#0B0F16'
      ctx.font = f('800', 28)
      ctx.textAlign = 'center'
      ctx.fillText('1', 94, center + 1)
    } else {
      ctx.fillStyle = DATA
      ctx.font = f('700', 32)
      ctx.textAlign = 'center'
      ctx.fillText(String(pos + 1), 94, center)
    }

    drawCrestBadge(ctx, null, 160, center, 36, {
      abbr: g.abbr,
      fallbackFill: tokens.field,
      ringColor: tokens.dark ? tokens.accent : withAlpha(tokens.accent, 0.9),
    })
    ctx.textAlign = 'left'
    fitFont(ctx, g.name, '700', 32, 22, 330)
    ctx.fillStyle = TEXT
    ctx.fillText(g.name, 218, center)

    ctx.textAlign = 'center'
    ctx.font = f('600', 30)
    for (let r = 0; r < rounds; r++) {
      const v = data.toParByRound[r][tourIdx]
      ctx.fillStyle = v < 0 ? '#7FCF9F' : DATA
      ctx.fillText(formatToPar(v), rColX(r), center)
    }
    ctx.save()
    ctx.shadowColor = 'rgba(0,0,0,0.5)'
    ctx.shadowBlur = 8
    ctx.fillStyle = totals[tourIdx] < 0 ? '#FF6B7A' : PTS_WHITE
    ctx.font = f('800', 38)
    ctx.fillText(formatToPar(totals[tourIdx]), totX, center)
    ctx.restore()
  })

  const footY = TOP + order.length * ROW_H + 44
  ctx.strokeStyle = HAIRLINE
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(MARGIN_L, footY)
  ctx.lineTo(MARGIN_R, footY)
  ctx.stroke()
  ctx.strokeStyle = accent
  ctx.lineWidth = 3
  ctx.beginPath()
  ctx.moveTo(MARGIN_L, footY + 1)
  ctx.lineTo(MARGIN_L + 120, footY + 1)
  ctx.stroke()

  drawWordmark(ctx, cx, 1778, 32, 'center')
  ctx.fillStyle = MUTED
  ctx.font = f('600', 24)
  ctx.textAlign = 'center'
  ctx.fillText(
    `@ESSPN · ${rounds >= 4 ? 'FULL 36 HOLES PLAYED' : `${9 * rounds} OF 36 HOLES PLAYED`}`,
    cx,
    1820,
  )
  drawCornerTicks(ctx, GOLF_LB_W, GOLF_LB_H, '#FF4655')
}

export async function exportGolfLeaderboardPng(data: GolfLeaderboardData): Promise<Blob> {
  await ensureFontsLoaded()
  const canvas = document.createElement('canvas')
  canvas.width = GOLF_LB_W
  canvas.height = GOLF_LB_H
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Could not create a 2D canvas context.')
  drawGolfLeaderboardCard(ctx, data)
  return new Promise((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('PNG export failed'))), 'image/png')
  })
}
