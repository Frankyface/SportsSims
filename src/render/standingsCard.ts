// The "second post": a 1080x1920 league-table graphic exported as a PNG, headed
// by the Crown League crest with each club's real logo on its row.

import type { LeagueState, StandingRow } from '../league/types'
import { computeStandings, teamById } from '../league/league'
import { getLogo, getLeagueLogo, drawLogoCircle, drawLogoContain, ensureLogosLoaded } from './logos'
import { HANDLE } from '../brand'

export const CARD_W = 1080
export const CARD_H = 1920

type Ctx = CanvasRenderingContext2D

export function drawStandingsCard(ctx: Ctx, state: LeagueState, roundLabel: string, rowsOverride?: StandingRow[]): void {
  ctx.fillStyle = '#0a0e14'
  ctx.fillRect(0, 0, CARD_W, CARD_H)
  const cx = CARD_W / 2

  const league = getLeagueLogo()
  if (league) drawLogoContain(ctx, league, cx, 220, 320, 300)

  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillStyle = '#e8edf4'
  ctx.font = 'bold 44px system-ui, sans-serif'
  ctx.fillText('LEAGUE TABLE', cx, 430)
  ctx.fillStyle = '#7b8794'
  ctx.font = '28px system-ui, sans-serif'
  ctx.fillText(`${roundLabel} · Season ${state.season}`, cx, 478)

  const rows = rowsOverride ?? computeStandings(state)
  const top = 580
  const rowH = 150
  const cols = { p: 560, w: 645, d: 730, l: 815, gd: 915, pts: 1010 }

  ctx.font = 'bold 26px system-ui, sans-serif'
  ctx.fillStyle = '#7b8794'
  ctx.textAlign = 'left'
  ctx.fillText('#   TEAM', 90, top - 46)
  ctx.textAlign = 'center'
  ctx.fillText('P', cols.p, top - 46)
  ctx.fillText('W', cols.w, top - 46)
  ctx.fillText('D', cols.d, top - 46)
  ctx.fillText('L', cols.l, top - 46)
  ctx.fillText('GD', cols.gd, top - 46)
  ctx.textAlign = 'right'
  ctx.fillText('PTS', cols.pts, top - 46)

  rows.forEach((r, i) => {
    const y = top + i * rowH
    const t = teamById(state, r.teamId).identity
    if (i < 4) {
      ctx.fillStyle = 'rgba(0,132,61,0.14)'
      ctx.fillRect(66, y - rowH / 2 + 8, CARD_W - 132, rowH - 16)
    }
    ctx.textAlign = 'left'
    ctx.textBaseline = 'middle'
    ctx.fillStyle = '#7b8794'
    ctx.font = 'bold 40px system-ui, sans-serif'
    ctx.fillText(String(i + 1), 96, y)
    const crest = getLogo(r.teamId)
    if (crest) {
      drawLogoCircle(ctx, crest, 180, y, 32)
    } else {
      ctx.fillStyle = t.color
      ctx.fillRect(150, y - 18, 36, 36)
    }
    ctx.fillStyle = '#e8edf4'
    ctx.font = 'bold 42px system-ui, sans-serif'
    ctx.fillText(t.abbr, 232, y)
    ctx.textAlign = 'center'
    ctx.font = '38px system-ui, sans-serif'
    ctx.fillStyle = '#cdd6e0'
    ctx.fillText(String(r.played), cols.p, y)
    ctx.fillText(String(r.won), cols.w, y)
    ctx.fillText(String(r.drawn), cols.d, y)
    ctx.fillText(String(r.lost), cols.l, y)
    ctx.fillText((r.gd > 0 ? '+' : '') + r.gd, cols.gd, y)
    ctx.textAlign = 'right'
    ctx.fillStyle = '#ffffff'
    ctx.font = 'bold 42px system-ui, sans-serif'
    ctx.fillText(String(r.points), cols.pts, y)
  })

  ctx.textAlign = 'center'
  ctx.fillStyle = '#7b8794'
  ctx.font = '26px system-ui, sans-serif'
  ctx.fillText(`${HANDLE} · Top 4 make the playoffs`, cx, CARD_H - 70)
}

export async function exportStandingsPng(state: LeagueState, roundLabel: string, rowsOverride?: StandingRow[]): Promise<Blob> {
  await ensureLogosLoaded()
  const canvas = document.createElement('canvas')
  canvas.width = CARD_W
  canvas.height = CARD_H
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Could not create canvas context for the standings card.')
  drawStandingsCard(ctx, state, roundLabel, rowsOverride)
  return await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('toBlob failed'))), 'image/png'),
  )
}
