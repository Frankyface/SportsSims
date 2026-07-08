// The Bastion Championships standings PNG (1080x1920) — the rugby fork of
// standingsCard.ts. Union columns: P W D L PD BP PTS, ranked by points then
// points difference. Bastion crest + rugby club crests via rugbyLogos.

import { HANDLE } from '../brand'
import {
  computeRugbyStandings,
  rugbyTeamById,
  type RugbyLeagueState,
  type RugbyStandingRow,
} from '../league/rugbyLeague'
import { drawLogoCircle, drawLogoContain } from './logos'
import { ensureRugbyLogosLoaded, getBastionLogo, getRugbyLogo } from './rugbyLogos'

export const RUGBY_CARD_W = 1080
export const RUGBY_CARD_H = 1920

export function drawRugbyStandingsCard(
  ctx: CanvasRenderingContext2D,
  state: RugbyLeagueState,
  roundLabel: string,
  rowsOverride?: RugbyStandingRow[],
): void {
  const cx = RUGBY_CARD_W / 2
  ctx.fillStyle = '#0a0e14'
  ctx.fillRect(0, 0, RUGBY_CARD_W, RUGBY_CARD_H)

  const league = getBastionLogo()
  if (league) drawLogoContain(ctx, league, cx, 220, 320, 300)

  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillStyle = '#ffffff'
  ctx.font = 'bold 64px system-ui, sans-serif'
  ctx.fillText('LEAGUE TABLE', cx, 430)
  ctx.fillStyle = '#ff5566'
  ctx.font = 'bold 34px system-ui, sans-serif'
  ctx.fillText(`${roundLabel} · Season ${state.season}`, cx, 490)

  const rows = rowsOverride ?? computeRugbyStandings(state)
  const cols = { p: 520, w: 595, d: 668, l: 741, pd: 836, bp: 926, pts: 1010 }
  const top = 580
  const rowH = 150

  ctx.font = 'bold 26px system-ui, sans-serif'
  ctx.fillStyle = 'rgba(255,255,255,0.5)'
  ctx.textAlign = 'left'
  ctx.fillText('#   TEAM', 90, top - 40)
  ctx.textAlign = 'center'
  for (const [label, x] of [
    ['P', cols.p],
    ['W', cols.w],
    ['D', cols.d],
    ['L', cols.l],
    ['PD', cols.pd],
    ['BP', cols.bp],
  ] as const) {
    ctx.fillText(label, x, top - 40)
  }
  ctx.textAlign = 'right'
  ctx.fillText('PTS', cols.pts + 30, top - 40)

  rows.forEach((r, i) => {
    const y = top + i * rowH
    if (i < 4) {
      ctx.fillStyle = 'rgba(200,16,46,0.12)' // ESSPN red playoff band
      ctx.fillRect(50, y - rowH / 2 + 8, RUGBY_CARD_W - 100, rowH - 16)
    }
    const t = rugbyTeamById(state, r.teamId).identity
    ctx.textAlign = 'left'
    ctx.fillStyle = 'rgba(255,255,255,0.6)'
    ctx.font = 'bold 34px system-ui, sans-serif'
    ctx.fillText(String(i + 1), 90, y)
    const crest = getRugbyLogo(r.teamId)
    if (crest) {
      drawLogoCircle(ctx, crest, 180, y, 32)
    } else {
      ctx.fillStyle = t.color
      ctx.fillRect(150, y - 18, 36, 36)
    }
    ctx.fillStyle = '#ffffff'
    ctx.font = 'bold 40px system-ui, sans-serif'
    ctx.fillText(t.abbr, 240, y)

    ctx.font = '34px system-ui, sans-serif'
    ctx.textAlign = 'center'
    ctx.fillStyle = 'rgba(255,255,255,0.85)'
    ctx.fillText(String(r.played), cols.p, y)
    ctx.fillText(String(r.won), cols.w, y)
    ctx.fillText(String(r.drawn), cols.d, y)
    ctx.fillText(String(r.lost), cols.l, y)
    ctx.fillText((r.pd > 0 ? '+' : '') + r.pd, cols.pd, y)
    ctx.fillText(String(r.bonus), cols.bp, y)
    ctx.textAlign = 'right'
    ctx.fillStyle = '#ffffff'
    ctx.font = 'bold 44px system-ui, sans-serif'
    ctx.fillText(String(r.points), cols.pts + 30, y)
  })

  ctx.textAlign = 'center'
  ctx.fillStyle = 'rgba(255,255,255,0.45)'
  ctx.font = '28px system-ui, sans-serif'
  ctx.fillText(`${HANDLE} · Top 4 make the playoffs`, cx, RUGBY_CARD_H - 70)
}

export async function exportRugbyStandingsPng(
  state: RugbyLeagueState,
  roundLabel: string,
  rowsOverride?: RugbyStandingRow[],
): Promise<Blob> {
  await ensureRugbyLogosLoaded()
  const canvas = document.createElement('canvas')
  canvas.width = RUGBY_CARD_W
  canvas.height = RUGBY_CARD_H
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Could not create a 2D canvas context.')
  drawRugbyStandingsCard(ctx, state, roundLabel, rowsOverride)
  return new Promise((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('PNG export failed'))), 'image/png')
  })
}
