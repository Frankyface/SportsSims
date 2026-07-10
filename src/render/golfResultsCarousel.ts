// The golf event RESULTS carousel — three 4:5 (1080x1350) pages posted after an
// event's final round, sized for the Instagram FEED so nothing is cropped:
//   1. RESULTS title (event + champion)
//   2. the event's FINAL leaderboard (compact — all 8, R1-R4 + total)
//   3. the SEASON league-board (each golfer's wins / majors / top-3 / points, as
//      "this-season (all-time)" once there's history to compare against)
// The tall 9:16 leaderboard (golfLeaderboardCard) stays as the REEL end-card.

import type { GolfSeasonState, GolfEventRecord } from '../league/golfSeason'
import { golfRankings, golferById } from '../league/golfSeason'
import { eventById, golfCourseById } from '../ratings/golfCourses'
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
import { drawEventLogo, ensureEventLogo } from './golfEventLogos'
import { ensureFontsLoaded } from './fonts'

export const GOLF_RES_W = 1080
export const GOLF_RES_H = 1350
const M_L = 48
const M_R = GOLF_RES_W - 48

type Ctx = CanvasRenderingContext2D

function chrome(ctx: Ctx, accent: string, season: number): void {
  drawBackground(ctx, GOLF_RES_W, GOLF_RES_H, { glowCx: GOLF_RES_W / 2, glowCy: 180, glowColor: accent, glowAlpha: 0.09, glowR: 460 })
  ctx.fillStyle = '#FF4655'
  ctx.fillRect(0, 0, GOLF_RES_W, 6)
  drawWordmark(ctx, M_L, 64, 32, 'left')
  ctx.textBaseline = 'middle'
  ctx.textAlign = 'right'
  ctx.fillStyle = MUTED
  ctx.font = f('700', 24)
  ctx.fillText(`SEASON ${season} · SGA TOUR`, M_R, 64)
  drawCornerTicks(ctx, GOLF_RES_W, GOLF_RES_H, '#FF4655')
}

// ---------- page 1: results title -------------------------------------------

function drawResultsTitle(ctx: Ctx, record: GolfEventRecord): void {
  const event = eventById(record.eventId)
  const course = golfCourseById(event.courseId)
  const accent = event.major ? GOLD : event.color
  const cx = GOLF_RES_W / 2
  chrome(ctx, accent, record.season)

  drawEventLogo(ctx, record.eventId, cx, 260, 170)

  ctx.textAlign = 'center'
  ctx.textBaseline = 'alphabetic'
  ctx.fillStyle = accent
  ctx.font = f('700', 30)
  const kicker = event.championship ? 'THE CHAMPIONSHIP · RESULTS' : event.major ? 'A MAJOR · RESULTS' : 'SGA TOUR · RESULTS'
  ctx.fillText(kicker, cx, 468)

  ctx.save()
  ctx.shadowColor = 'rgba(0,0,0,0.5)'
  ctx.shadowBlur = 10
  ctx.shadowOffsetY = 3
  ctx.fillStyle = TEXT
  fitFont(ctx, event.name.toUpperCase(), '800', 74, 44, M_R - M_L)
  ctx.fillText(event.name.toUpperCase(), cx, 552)
  ctx.restore()

  ctx.fillStyle = event.colorAlt
  ctx.font = f('700', 34)
  ctx.fillText(course.name.toUpperCase(), cx, 610)
  drawTitleRule(ctx, cx, 656, 300, accent)

  // champion (record.field carries the names in tour order)
  const winner = record.field.find((g) => g.id === record.finishOrder[0])
  ctx.fillStyle = GOLD
  ctx.font = f('700', 30)
  ctx.fillText('🏆 CHAMPION', cx, 800)
  ctx.save()
  ctx.shadowColor = 'rgba(0,0,0,0.5)'
  ctx.shadowBlur = 10
  ctx.fillStyle = TEXT
  ctx.font = f('800', 68)
  ctx.fillText((winner?.name ?? '').toUpperCase(), cx, 880)
  ctx.restore()
  ctx.fillStyle = record.totalToPar[0] < 0 ? '#FF6B7A' : PTS_WHITE
  ctx.font = f('800', 52)
  ctx.fillText(formatToPar(record.totalToPar[0]), cx, 964)

  ctx.fillStyle = 'rgba(255,255,255,0.5)'
  ctx.font = f('700', 26)
  ctx.fillText('SWIPE FOR THE FINAL LEADERBOARD + SEASON STANDINGS →', cx, 1200)
}

// ---------- page 2: compact event leaderboard --------------------------------

function drawResultsLeaderboard(ctx: Ctx, record: GolfEventRecord): void {
  const event = eventById(record.eventId)
  const accent = event.major ? GOLD : event.color
  const cx = GOLF_RES_W / 2
  chrome(ctx, accent, record.season)

  ctx.textAlign = 'center'
  ctx.fillStyle = TEXT
  ctx.font = f('800', 52)
  fitFont(ctx, event.name.toUpperCase(), '800', 52, 34, M_R - M_L)
  ctx.fillText(event.name.toUpperCase(), cx, 150)
  ctx.fillStyle = MUTED
  ctx.font = f('700', 28)
  ctx.fillText('FINAL LEADERBOARD', cx, 196)
  drawTitleRule(ctx, cx, 226, 280, accent)

  const rounds = record.toParByRound.length
  const totals = record.field.map((_, i) => record.toParByRound.reduce((s, r) => s + r[i], 0))
  const last = record.toParByRound[rounds - 1]
  const order = record.field.map((_, i) => i).sort((a, b) => totals[a] - totals[b] || last[a] - last[b] || a - b)

  const TOP = 300
  const ROW_H = 118
  const rColX = (r: number): number => 610 + r * 78
  const totX = M_R - 14

  ctx.textBaseline = 'middle'
  ctx.fillStyle = MUTED
  ctx.font = f('600', 22)
  ctx.textAlign = 'left'
  ctx.fillText('GOLFER', 210, TOP - 34)
  ctx.textAlign = 'center'
  for (let r = 0; r < rounds; r++) ctx.fillText(`R${r + 1}`, rColX(r), TOP - 34)
  ctx.textAlign = 'right'
  ctx.fillText('TOT', totX, TOP - 34)
  ctx.strokeStyle = HAIRLINE
  ctx.beginPath()
  ctx.moveTo(M_L, TOP - 12)
  ctx.lineTo(M_R, TOP - 12)
  ctx.stroke()

  order.forEach((tourIdx, pos) => {
    const g = record.field[tourIdx]
    const center = TOP + pos * ROW_H + ROW_H / 2
    const bandTop = center - (ROW_H - 8) / 2
    const tokens = deriveClubTokens(g.color, g.colorAlt)
    ctx.fillStyle = withAlpha('#FFFFFF', pos % 2 ? 0.045 : 0.022)
    ctx.fillRect(M_L, bandTop, M_R - M_L, ROW_H - 8)
    if (pos === 0) {
      ctx.fillStyle = GOLD_WASH
      ctx.fillRect(M_L, bandTop, M_R - M_L, ROW_H - 8)
      ctx.fillStyle = withAlpha(accent, 0.85)
      ctx.fillRect(M_L, bandTop, M_R - M_L, 2)
    }
    ctx.fillStyle = tokens.field
    ctx.fillRect(M_L, bandTop + 6, 6, ROW_H - 20)
    // rank
    ctx.textAlign = 'center'
    if (pos === 0) {
      ctx.beginPath()
      ctx.arc(88, center, 18, 0, Math.PI * 2)
      ctx.fillStyle = GOLD
      ctx.fill()
      ctx.fillStyle = '#0B0F16'
      ctx.font = f('800', 26)
      ctx.fillText('1', 88, center + 1)
    } else {
      ctx.fillStyle = DATA
      ctx.font = f('700', 30)
      ctx.fillText(String(pos + 1), 88, center)
    }
    drawCrestBadge(ctx, null, 150, center, 32, { abbr: g.abbr, fallbackFill: tokens.field, ringColor: tokens.dark ? tokens.accent : withAlpha(tokens.accent, 0.9) })
    ctx.textAlign = 'left'
    fitFont(ctx, g.name, '700', 30, 20, 300)
    ctx.fillStyle = TEXT
    ctx.fillText(g.name, 204, center)
    ctx.textAlign = 'center'
    ctx.font = f('600', 27)
    for (let r = 0; r < rounds; r++) {
      const v = record.toParByRound[r][tourIdx]
      ctx.fillStyle = v < 0 ? '#7FCF9F' : DATA
      ctx.fillText(formatToPar(v), rColX(r), center)
    }
    ctx.textAlign = 'right'
    ctx.fillStyle = totals[tourIdx] < 0 ? '#FF6B7A' : PTS_WHITE
    ctx.font = f('800', 36)
    ctx.fillText(formatToPar(totals[tourIdx]), totX, center)
  })

  drawWordmark(ctx, cx, GOLF_RES_H - 46, 28, 'center')
}

// ---------- page 3: season league-board --------------------------------------

/** "s" or "s (a)" — the parenthesised all-time total appears once it differs from
 * the season total (i.e. from season 2 on). */
function drawStat(ctx: Ctx, x: number, y: number, season: number, allTime: number): void {
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillStyle = season > 0 ? PTS_WHITE : withAlpha('#FFFFFF', 0.4)
  ctx.font = f('800', 34)
  if (allTime === season) {
    ctx.fillText(String(season), x, y)
    return
  }
  const s = String(season)
  const a = ` (${allTime})`
  ctx.font = f('800', 34)
  const sw = ctx.measureText(s).width
  ctx.font = f('700', 24)
  const aw = ctx.measureText(a).width
  const total = sw + aw
  ctx.textAlign = 'left'
  ctx.font = f('800', 34)
  ctx.fillStyle = season > 0 ? PTS_WHITE : withAlpha('#FFFFFF', 0.4)
  ctx.fillText(s, x - total / 2, y)
  ctx.font = f('700', 24)
  ctx.fillStyle = MUTED
  ctx.fillText(a, x - total / 2 + sw, y)
}

interface SeasonRow {
  id: string
  name: string
  abbr: string
  color: string
  colorAlt: string
  points: number
  sWins: number
  aWins: number
  sMaj: number
  aMaj: number
  sTop3: number
  aTop3: number
}

function seasonRows(state: GolfSeasonState): SeasonRow[] {
  const ranked = golfRankings(state)
  return ranked.map((r) => {
    const g = golferById(state, r.golferId)
    const career = state.career[r.golferId]
    let sWins = 0
    let sMaj = 0
    let sTop3 = 0
    for (const ev of state.completed) {
      const isMajor = eventById(ev.eventId).major
      if (ev.winnerId === r.golferId) {
        sWins++
        if (isMajor) sMaj++
      }
      if (ev.finishOrder.indexOf(r.golferId) <= 2) sTop3++
    }
    return {
      id: r.golferId,
      name: g.identity.name,
      abbr: g.identity.abbr,
      color: g.identity.color,
      colorAlt: g.identity.colorAlt,
      points: r.points,
      sWins,
      aWins: career?.wins ?? sWins,
      sMaj,
      aMaj: career?.majorWins ?? sMaj,
      sTop3,
      aTop3: career?.top3s ?? sTop3,
    }
  })
}

function drawSeasonBoard(ctx: Ctx, state: GolfSeasonState): void {
  const cx = GOLF_RES_W / 2
  chrome(ctx, GOLD, state.season)
  ctx.textAlign = 'center'
  ctx.fillStyle = TEXT
  ctx.font = f('800', 56)
  ctx.fillText(`SEASON ${state.season} STANDINGS`, cx, 150)
  ctx.fillStyle = MUTED
  ctx.font = f('700', 26)
  ctx.fillText(state.season > 1 ? 'THIS SEASON (ALL-TIME)' : 'THE RANKINGS SO FAR', cx, 194)
  drawTitleRule(ctx, cx, 224, 300, GOLD)

  const rows = seasonRows(state)
  const TOP = 300
  const ROW_H = 118
  const colW = 128
  const wX = 560 + colW * 0
  const mX = 560 + colW * 1
  const tX = 560 + colW * 2
  const pX = M_R - 8

  ctx.textBaseline = 'middle'
  ctx.fillStyle = MUTED
  ctx.font = f('600', 22)
  ctx.textAlign = 'left'
  ctx.fillText('GOLFER', 200, TOP - 34)
  ctx.textAlign = 'center'
  ctx.fillText('WINS', wX, TOP - 34)
  ctx.fillText('MAJ', mX, TOP - 34)
  ctx.fillText('TOP-3', tX, TOP - 34)
  ctx.textAlign = 'right'
  ctx.fillText('PTS', pX, TOP - 34)
  ctx.strokeStyle = HAIRLINE
  ctx.beginPath()
  ctx.moveTo(M_L, TOP - 12)
  ctx.lineTo(M_R, TOP - 12)
  ctx.stroke()

  rows.forEach((row, pos) => {
    const center = TOP + pos * ROW_H + ROW_H / 2
    const bandTop = center - (ROW_H - 8) / 2
    const tokens = deriveClubTokens(row.color, row.colorAlt)
    ctx.fillStyle = withAlpha('#FFFFFF', pos % 2 ? 0.045 : 0.022)
    ctx.fillRect(M_L, bandTop, M_R - M_L, ROW_H - 8)
    if (pos === 0) {
      ctx.fillStyle = GOLD_WASH
      ctx.fillRect(M_L, bandTop, M_R - M_L, ROW_H - 8)
      ctx.fillStyle = withAlpha(GOLD, 0.85)
      ctx.fillRect(M_L, bandTop, M_R - M_L, 2)
    }
    ctx.fillStyle = tokens.field
    ctx.fillRect(M_L, bandTop + 6, 6, ROW_H - 20)
    ctx.textAlign = 'center'
    if (pos === 0) {
      ctx.beginPath()
      ctx.arc(88, center, 18, 0, Math.PI * 2)
      ctx.fillStyle = GOLD
      ctx.fill()
      ctx.fillStyle = '#0B0F16'
      ctx.font = f('800', 26)
      ctx.fillText('1', 88, center + 1)
    } else {
      ctx.fillStyle = DATA
      ctx.font = f('700', 30)
      ctx.fillText(String(pos + 1), 88, center)
    }
    drawCrestBadge(ctx, null, 150, center, 32, { abbr: row.abbr, fallbackFill: tokens.field, ringColor: tokens.dark ? tokens.accent : withAlpha(tokens.accent, 0.9) })
    ctx.textAlign = 'left'
    fitFont(ctx, row.name, '700', 30, 20, 300)
    ctx.fillStyle = TEXT
    ctx.fillText(row.name, 204, center)

    drawStat(ctx, wX, center, row.sWins, row.aWins)
    drawStat(ctx, mX, center, row.sMaj, row.aMaj)
    drawStat(ctx, tX, center, row.sTop3, row.aTop3)
    ctx.textAlign = 'right'
    ctx.textBaseline = 'middle'
    ctx.fillStyle = PTS_WHITE
    ctx.font = f('800', 36)
    ctx.fillText(String(row.points), pX, center)
  })

  drawWordmark(ctx, cx, GOLF_RES_H - 46, 28, 'center')
}

// ---------- export -----------------------------------------------------------

async function toPng(draw: (ctx: Ctx) => void): Promise<Blob> {
  const canvas = document.createElement('canvas')
  canvas.width = GOLF_RES_W
  canvas.height = GOLF_RES_H
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Could not create a 2D canvas context.')
  draw(ctx)
  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('PNG export failed'))), 'image/png'))
}

/** The three 4:5 results-carousel pages: title, final leaderboard, season board. */
export async function exportGolfResultsCarousel(state: GolfSeasonState, record: GolfEventRecord): Promise<Blob[]> {
  await Promise.all([ensureFontsLoaded(), ensureEventLogo(record.eventId)])
  return [
    await toPng((ctx) => drawResultsTitle(ctx, record)),
    await toPng((ctx) => drawResultsLeaderboard(ctx, record)),
    await toPng((ctx) => drawSeasonBoard(ctx, state)),
  ]
}
