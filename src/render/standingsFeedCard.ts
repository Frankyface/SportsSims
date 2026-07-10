// Crown League table as a 1080x1350 (4:5 FEED) PNG — the standalone standings
// POST (round table, final table, champions-carousel table). The tall 9:16
// standingsCard stays as the match-reel end-card; this one is sized for the feed
// so nothing gets cropped. Compact 6-row layout, same chrome + crests.

import type { LeagueState, StandingRow } from '../league/types'
import { computeStandings, teamById } from '../league/league'
import { getLogo, getLeagueLogo, ensureLogosLoaded } from './logos'
import {
  CROWN,
  DATA,
  GD_POS,
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
  drawFormPills,
  drawTitleRule,
  drawWordmark,
  f,
  fitFont,
  withAlpha,
} from './theme'

const CARD_W = 1080
const CARD_H = 1350
const M_L = 48
const M_R = CARD_W - 48

type Ctx = CanvasRenderingContext2D

export function drawStandingsFeedCard(ctx: Ctx, state: LeagueState, roundLabel: string, rowsOverride?: StandingRow[]): void {
  const cx = CARD_W / 2
  const table = rowsOverride ?? computeStandings(state)

  drawBackground(ctx, CARD_W, CARD_H, { glowCx: cx, glowCy: 170, glowColor: CROWN.glow, glowAlpha: 0.09, glowR: 460 })
  ctx.fillStyle = CROWN.accent
  ctx.fillRect(0, 0, CARD_W, 6)
  drawWordmark(ctx, M_L, 60, 30, 'left')
  ctx.textBaseline = 'middle'
  ctx.textAlign = 'right'
  ctx.fillStyle = MUTED
  ctx.font = f('700', 24)
  ctx.fillText(`SEASON ${state.season}`, M_R, 60)
  drawCornerTicks(ctx, CARD_W, CARD_H, CROWN.accent)

  const league = getLeagueLogo()
  if (league) drawCrestBadge(ctx, league, cx, 138, 62, { plate: false })
  ctx.textAlign = 'center'
  ctx.textBaseline = 'alphabetic'
  ctx.save()
  ctx.shadowColor = 'rgba(0,0,0,0.5)'
  ctx.shadowBlur = 8
  ctx.fillStyle = TEXT
  ctx.font = f('800', 58)
  ctx.fillText('LEAGUE TABLE', cx, 232)
  ctx.restore()
  ctx.fillStyle = MUTED
  ctx.font = f('700', 26)
  ctx.fillText(`CROWN LEAGUE · ${roundLabel.toUpperCase()}`, cx, 274)
  drawTitleRule(ctx, cx, 304, 300, CROWN.accent)

  // columns
  const pX = 556
  const wX = 606
  const dX = 656
  const lX = 706
  const gdX = 770
  const ptsX = 856
  const formX = 906
  const TOP = 388
  const ROW_H = 134

  ctx.textBaseline = 'middle'
  ctx.fillStyle = MUTED
  ctx.font = f('600', 22)
  ctx.textAlign = 'left'
  ctx.fillText('TEAM', 200, TOP - 32)
  ctx.textAlign = 'center'
  ctx.fillText('P', pX, TOP - 32)
  ctx.fillText('W', wX, TOP - 32)
  ctx.fillText('D', dX, TOP - 32)
  ctx.fillText('L', lX, TOP - 32)
  ctx.fillText('GD', gdX, TOP - 32)
  ctx.fillText('PTS', ptsX, TOP - 32)
  ctx.textAlign = 'left'
  ctx.fillText('FORM', formX, TOP - 32)
  ctx.strokeStyle = HAIRLINE
  ctx.beginPath()
  ctx.moveTo(M_L, TOP - 10)
  ctx.lineTo(M_R, TOP - 10)
  ctx.stroke()

  table.forEach((r, pos) => {
    const t = teamById(state, r.teamId).identity
    const center = TOP + pos * ROW_H + ROW_H / 2
    const bandTop = center - (ROW_H - 8) / 2
    const tokens = deriveClubTokens(t.color, t.colorAlt)

    ctx.fillStyle = withAlpha('#FFFFFF', pos % 2 ? 0.045 : 0.022)
    ctx.fillRect(M_L, bandTop, M_R - M_L, ROW_H - 8)
    if (pos === 0) {
      ctx.fillStyle = GOLD_WASH
      ctx.fillRect(M_L, bandTop, M_R - M_L, ROW_H - 8)
      ctx.fillStyle = withAlpha(CROWN.accent, 0.85)
      ctx.fillRect(M_L, bandTop, M_R - M_L, 2)
    }
    ctx.fillStyle = tokens.field
    ctx.fillRect(M_L, bandTop + 6, 6, ROW_H - 20)

    ctx.textAlign = 'center'
    ctx.fillStyle = pos === 0 ? GOLD : DATA
    ctx.font = f('700', 30)
    ctx.fillText(String(pos + 1), 88, center)
    drawCrestBadge(ctx, getLogo(r.teamId) ?? null, 152, center, 34, { abbr: t.abbr, fallbackFill: tokens.field, ringColor: tokens.dark ? tokens.accent : withAlpha(tokens.accent, 0.9) })
    ctx.textAlign = 'left'
    fitFont(ctx, t.name, '700', 30, 20, 300)
    ctx.fillStyle = TEXT
    ctx.fillText(t.name, 202, center)

    ctx.textAlign = 'center'
    ctx.font = f('600', 27)
    ctx.fillStyle = DATA
    ctx.fillText(String(r.played), pX, center)
    ctx.fillText(String(r.won), wX, center)
    ctx.fillText(String(r.drawn), dX, center)
    ctx.fillText(String(r.lost), lX, center)
    ctx.fillStyle = r.gd > 0 ? GD_POS : r.gd < 0 ? MUTED : DATA
    ctx.fillText((r.gd > 0 ? '+' : '') + r.gd, gdX, center)
    ctx.fillStyle = PTS_WHITE
    ctx.font = f('800', 34)
    ctx.fillText(String(r.points), ptsX, center)

    drawFormPills(ctx, r.form.slice(-5), formX, center - 13, { size: 26, gap: 7 })

    // top-4 qualification fence
    if (pos === 3) {
      const fenceY = bandTop + ROW_H - 4
      ctx.strokeStyle = withAlpha(CROWN.accent, 0.5)
      ctx.setLineDash([10, 8])
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.moveTo(M_L, fenceY)
      ctx.lineTo(M_R, fenceY)
      ctx.stroke()
      ctx.setLineDash([])
    }
  })

  ctx.textAlign = 'center'
  ctx.fillStyle = MUTED
  ctx.font = f('600', 24)
  ctx.fillText('TOP 4 QUALIFY FOR THE PLAYOFFS', cx, CARD_H - 44)
}

export async function exportStandingsFeedPng(state: LeagueState, roundLabel: string, rowsOverride?: StandingRow[]): Promise<Blob> {
  await ensureLogosLoaded()
  const canvas = document.createElement('canvas')
  canvas.width = CARD_W
  canvas.height = CARD_H
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Could not create a 2D canvas context.')
  drawStandingsFeedCard(ctx, state, roundLabel, rowsOverride)
  return await new Promise<Blob>((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('toBlob failed'))), 'image/png'))
}
