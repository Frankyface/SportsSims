// The Apex Tour season rankings PNG (1080x1920). Golf's standings graphic —
// eight golfers is a taller table than the shared 6-row league renderer
// supports, so this is its own card built from the same theme primitives:
// identical network chrome (background, wordmark, corner ticks), the Apex
// emerald-and-gold accent, and per-golfer colour chips.

import type { GolfSeasonState } from '../league/golfSeason'
import { golfRankings, golferById } from '../league/golfSeason'
import { EVENTS_PER_SEASON, eventById } from '../ratings/golfCourses'
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
  type CompetitionAccent,
} from './theme'
import { ensureFontsLoaded } from './fonts'
import { drawSgaMark, ensureSgaLogo } from './golfBrand'

export const GOLF_CARD_W = 1080
export const GOLF_CARD_H = 1920

/** Tier-2 competition accent for the Apex Tour. */
export const APEX: CompetitionAccent = { accent: '#1E8E5A', glow: '#D4AF37' }

const MARGIN_L = 48
const MARGIN_R = 1032
const TOP = 540
const ROW_H = 128

export function drawGolfRankingsCard(ctx: CanvasRenderingContext2D, state: GolfSeasonState): void {
  const cx = GOLF_CARD_W / 2
  drawBackground(ctx, GOLF_CARD_W, GOLF_CARD_H, {
    glowCx: cx,
    glowCy: 200,
    glowColor: APEX.glow,
    glowAlpha: 0.08,
    glowR: 520,
  })

  // header
  ctx.fillStyle = '#FF4655'
  ctx.fillRect(0, 0, GOLF_CARD_W, 6)
  drawWordmark(ctx, MARGIN_L, 72, 34, 'left')
  ctx.textBaseline = 'middle'
  ctx.textAlign = 'right'
  ctx.fillStyle = MUTED
  ctx.font = f('700', 26)
  ctx.fillText(`SEASON ${state.season}`, MARGIN_R, 72)

  // the SGA crest presides over the header
  drawSgaMark(ctx, cx, 168, 96)

  ctx.textAlign = 'center'
  ctx.textBaseline = 'alphabetic'
  ctx.save()
  ctx.shadowColor = 'rgba(0,0,0,0.5)'
  ctx.shadowBlur = 10
  ctx.shadowOffsetY = 3
  ctx.fillStyle = TEXT
  ctx.font = f('800', 80)
  ctx.fillText('THE RANKINGS', cx, 300)
  ctx.restore()
  ctx.fillStyle = MUTED
  ctx.font = f('600', 30)
  const played = state.completed.length
  ctx.fillText(`THE SGA · ${played}/${EVENTS_PER_SEASON} EVENTS PLAYED`, cx, 346)
  drawTitleRule(ctx, cx, 376, 320, APEX.accent)

  // column headers
  ctx.textBaseline = 'middle'
  ctx.fillStyle = MUTED
  ctx.font = f('600', 24)
  ctx.textAlign = 'left'
  ctx.fillText('GOLFER', 224, TOP - 44)
  ctx.textAlign = 'center'
  ctx.fillText('WINS', 620, TOP - 44)
  ctx.fillText('MAJ', 726, TOP - 44)
  ctx.fillText('TOP 3', 832, TOP - 44)
  ctx.fillText('PTS', 962, TOP - 44)
  ctx.strokeStyle = HAIRLINE
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(MARGIN_L, TOP - 18)
  ctx.lineTo(MARGIN_R, TOP - 18)
  ctx.stroke()

  // rows
  const rankings = golfRankings(state)
  rankings.forEach((r, i) => {
    const g = golferById(state, r.golferId)
    const seasonWins = r.wins
    const seasonMajors = state.completed.filter(
      (rec) => rec.winnerId === r.golferId && eventById(rec.eventId).major,
    ).length
    const seasonTop3 = state.completed.filter((rec) => rec.finishOrder.indexOf(r.golferId) <= 2).length
    const center = TOP + i * ROW_H + ROW_H / 2
    const bandTop = center - (ROW_H - 8) / 2
    const tokens = deriveClubTokens(g.identity.color, g.identity.colorAlt)

    ctx.fillStyle = withAlpha('#FFFFFF', i % 2 ? 0.045 : 0.022)
    ctx.fillRect(MARGIN_L, bandTop, MARGIN_R - MARGIN_L, ROW_H - 8)
    if (i === 0) {
      ctx.fillStyle = GOLD_WASH
      ctx.fillRect(MARGIN_L, bandTop, MARGIN_R - MARGIN_L, ROW_H - 8)
      ctx.fillStyle = withAlpha(APEX.accent, 0.85)
      ctx.fillRect(MARGIN_L, bandTop, MARGIN_R - MARGIN_L, 2)
    }
    ctx.fillStyle = tokens.field
    ctx.fillRect(MARGIN_L, bandTop + 6, 6, ROW_H - 20)

    // position
    if (i === 0) {
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
      ctx.fillText(String(i + 1), 94, center)
    }

    // colour chip + name + nickname
    drawCrestBadge(ctx, null, 160, center, 38, {
      abbr: g.identity.abbr,
      fallbackFill: tokens.field,
      ringColor: tokens.dark ? tokens.accent : withAlpha(tokens.accent, 0.9),
    })
    ctx.textAlign = 'left'
    fitFont(ctx, g.identity.name, '700', 32, 22, 330)
    ctx.fillStyle = TEXT
    ctx.fillText(g.identity.name, 224, center - 14)
    ctx.fillStyle = MUTED
    ctx.font = f('600', 20)
    ctx.fillText(`"${g.identity.nickname.toUpperCase()}"`, 224, center + 20)

    // stats
    ctx.textAlign = 'center'
    ctx.font = f('600', 34)
    ctx.fillStyle = seasonWins > 0 ? TEXT : DATA
    ctx.fillText(String(seasonWins), 620, center)
    ctx.fillStyle = seasonMajors > 0 ? GOLD : DATA
    ctx.fillText(String(seasonMajors), 726, center)
    ctx.fillStyle = DATA
    ctx.fillText(String(seasonTop3), 832, center)
    ctx.save()
    ctx.shadowColor = 'rgba(0,0,0,0.5)'
    ctx.shadowBlur = 8
    ctx.fillStyle = PTS_WHITE
    ctx.font = f('800', 40)
    ctx.fillText(String(r.points), 962, center)
    ctx.restore()
  })

  // footer
  const footY = TOP + rankings.length * ROW_H + 44
  ctx.strokeStyle = HAIRLINE
  ctx.beginPath()
  ctx.moveTo(MARGIN_L, footY)
  ctx.lineTo(MARGIN_R, footY)
  ctx.stroke()
  ctx.strokeStyle = APEX.accent
  ctx.lineWidth = 3
  ctx.beginPath()
  ctx.moveTo(MARGIN_L, footY + 1)
  ctx.lineTo(MARGIN_L + 120, footY + 1)
  ctx.stroke()

  drawWordmark(ctx, cx, 1778, 32, 'center')
  ctx.fillStyle = MUTED
  ctx.font = f('600', 24)
  ctx.textAlign = 'center'
  ctx.fillText('@ESSPN · MAJORS PAY DOUBLE POINTS', cx, 1820)
  drawCornerTicks(ctx, GOLF_CARD_W, GOLF_CARD_H, '#FF4655')
}

export async function exportGolfRankingsPng(state: GolfSeasonState): Promise<Blob> {
  await Promise.all([ensureFontsLoaded(), ensureSgaLogo()])
  const canvas = document.createElement('canvas')
  canvas.width = GOLF_CARD_W
  canvas.height = GOLF_CARD_H
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Could not create a 2D canvas context.')
  drawGolfRankingsCard(ctx, state)
  return new Promise((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('PNG export failed'))), 'image/png')
  })
}
