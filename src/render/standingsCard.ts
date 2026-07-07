// The "second post": a 1080x1920 league-table graphic exported as a PNG, in the
// broadcast style, for posting after a matchday's game videos.

import type { LeagueState } from '../league/types'
import { computeStandings, teamById } from '../league/league'

export const CARD_W = 1080
export const CARD_H = 1920

type Ctx = CanvasRenderingContext2D

function wordmark(ctx: Ctx): void {
  ctx.textAlign = 'left'
  ctx.textBaseline = 'middle'
  ctx.font = 'bold 40px system-ui, sans-serif'
  const parts: Array<[string, string]> = [
    ['ELITE', '#e8edf4'],
    ['SIM', '#ff5566'],
    ['SPN', '#e8edf4'],
  ]
  const widths = parts.map((p) => ctx.measureText(p[0]).width)
  const total = widths.reduce((s, w) => s + w, 0)
  let x = CARD_W / 2 - total / 2
  for (let i = 0; i < parts.length; i++) {
    ctx.fillStyle = parts[i][1]
    ctx.fillText(parts[i][0], x, 150)
    x += widths[i]
  }
}

export function drawStandingsCard(ctx: Ctx, state: LeagueState, roundLabel: string): void {
  ctx.fillStyle = '#0a0e14'
  ctx.fillRect(0, 0, CARD_W, CARD_H)
  wordmark(ctx)

  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillStyle = '#ff5566'
  ctx.font = 'bold 46px system-ui, sans-serif'
  ctx.fillText('LEAGUE TABLE', CARD_W / 2, 300)
  ctx.fillStyle = '#e8edf4'
  ctx.font = 'bold 34px system-ui, sans-serif'
  ctx.fillText(state.name, CARD_W / 2, 358)
  ctx.fillStyle = '#7b8794'
  ctx.font = '28px system-ui, sans-serif'
  ctx.fillText(`${roundLabel} · Season ${state.season}`, CARD_W / 2, 408)

  const rows = computeStandings(state)
  const top = 470
  const rowH = 126
  const cols = { p: 560, w: 645, d: 730, l: 815, gd: 915, pts: 1010 }

  ctx.font = 'bold 26px system-ui, sans-serif'
  ctx.fillStyle = '#7b8794'
  ctx.textAlign = 'left'
  ctx.fillText('#   TEAM', 90, top - 8)
  ctx.textAlign = 'center'
  ctx.fillText('P', cols.p, top - 8)
  ctx.fillText('W', cols.w, top - 8)
  ctx.fillText('D', cols.d, top - 8)
  ctx.fillText('L', cols.l, top - 8)
  ctx.fillText('GD', cols.gd, top - 8)
  ctx.textAlign = 'right'
  ctx.fillText('PTS', cols.pts, top - 8)

  rows.forEach((r, i) => {
    const y = top + 34 + i * rowH
    const t = teamById(state, r.teamId).identity
    if (i < 4) {
      ctx.fillStyle = 'rgba(0,132,61,0.14)'
      ctx.fillRect(66, y - rowH / 2 + 6, CARD_W - 132, rowH - 12)
    }
    ctx.textAlign = 'left'
    ctx.textBaseline = 'middle'
    ctx.fillStyle = '#7b8794'
    ctx.font = 'bold 34px system-ui, sans-serif'
    ctx.fillText(String(i + 1), 96, y)
    ctx.fillStyle = t.color
    ctx.fillRect(150, y - 16, 32, 32)
    ctx.fillStyle = '#e8edf4'
    ctx.font = 'bold 38px system-ui, sans-serif'
    ctx.fillText(t.abbr, 205, y)
    ctx.textAlign = 'center'
    ctx.font = '34px system-ui, sans-serif'
    ctx.fillStyle = '#cdd6e0'
    ctx.fillText(String(r.played), cols.p, y)
    ctx.fillText(String(r.won), cols.w, y)
    ctx.fillText(String(r.drawn), cols.d, y)
    ctx.fillText(String(r.lost), cols.l, y)
    ctx.fillText((r.gd > 0 ? '+' : '') + r.gd, cols.gd, y)
    ctx.textAlign = 'right'
    ctx.fillStyle = '#ffffff'
    ctx.font = 'bold 38px system-ui, sans-serif'
    ctx.fillText(String(r.points), cols.pts, y)
  })

  ctx.textAlign = 'center'
  ctx.fillStyle = '#7b8794'
  ctx.font = '26px system-ui, sans-serif'
  ctx.fillText('@EliteSimSPN · Top 4 make the playoffs', CARD_W / 2, CARD_H - 70)
}

export async function exportStandingsPng(state: LeagueState, roundLabel: string): Promise<Blob> {
  const canvas = document.createElement('canvas')
  canvas.width = CARD_W
  canvas.height = CARD_H
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Could not create canvas context for the standings card.')
  drawStandingsCard(ctx, state, roundLabel)
  return await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('toBlob failed'))), 'image/png'),
  )
}
