// Crown League season-moment cards (1080x1920 PNGs) for the daily poster:
//   - PLAYOFFS preview — the top-4 bracket, posted after the last regular match
//   - FINAL preview — the two finalists, posted after the second semi
//   - CHAMPIONS — the crowned club + season, page 1 of the champions carousel
// Same broadcast style as the standings card (drawBackground/theme + crests).

import type { LeagueState } from '../league/types'
import { computeStandings, teamById, winnerOf } from '../league/league'
import { getLogo, getLeagueLogo, ensureLogosLoaded } from './logos'
import { CROWN, TEXT, MUTED, GOLD, drawBackground, drawCrestBadge, drawWordmark, f } from './theme'
import { CARD_W, CARD_H } from './leagueTable'

type Ctx = CanvasRenderingContext2D

interface ClubBits {
  name: string
  abbr: string
  color: string
  crest: HTMLImageElement | null
}

function clubBits(state: LeagueState, teamId: string): ClubBits {
  const t = teamById(state, teamId).identity
  return { name: t.name, abbr: t.abbr, color: t.color, crest: getLogo(teamId) ?? null }
}

function header(ctx: Ctx, state: LeagueState, title: string, kicker: string): void {
  const cx = CARD_W / 2
  drawBackground(ctx, CARD_W, CARD_H, { glowCx: cx, glowCy: 220, glowColor: CROWN.glow, glowAlpha: 0.09, glowR: 540 })
  ctx.fillStyle = CROWN.accent
  ctx.fillRect(0, 0, CARD_W, 6)
  drawWordmark(ctx, 72, 72, 34, 'left')
  ctx.textBaseline = 'middle'
  ctx.textAlign = 'right'
  ctx.fillStyle = MUTED
  ctx.font = f('700', 26)
  ctx.fillText(`SEASON ${state.season}`, CARD_W - 72, 72)

  const league = getLeagueLogo()
  if (league) drawCrestBadge(ctx, league, cx, 190, 88, { plate: false })

  ctx.textAlign = 'center'
  ctx.fillStyle = CROWN.accent
  ctx.font = f('700', 30)
  ctx.fillText(kicker, cx, 318)
  ctx.save()
  ctx.shadowColor = 'rgba(0,0,0,0.5)'
  ctx.shadowBlur = 10
  ctx.shadowOffsetY = 3
  ctx.fillStyle = TEXT
  ctx.font = f('800', 84)
  ctx.fillText(title, cx, 402)
  ctx.restore()
}

function matchupRow(ctx: Ctx, state: LeagueState, label: string, homeId: string, awayId: string, y: number): void {
  const cx = CARD_W / 2
  const home = clubBits(state, homeId)
  const away = clubBits(state, awayId)

  ctx.textAlign = 'center'
  ctx.fillStyle = MUTED
  ctx.font = f('700', 28)
  ctx.fillText(label, cx, y)

  const rowY = y + 130
  drawCrestBadge(ctx, home.crest, cx - 300, rowY, 96, { abbr: home.abbr, fallbackFill: home.color, shadow: true })
  drawCrestBadge(ctx, away.crest, cx + 300, rowY, 96, { abbr: away.abbr, fallbackFill: away.color, shadow: true })
  ctx.fillStyle = TEXT
  ctx.font = f('800', 52)
  ctx.fillText('VS', cx, rowY)

  ctx.font = f('700', 32)
  ctx.fillStyle = TEXT
  ctx.fillText(home.name.toUpperCase(), cx - 300, rowY + 150)
  ctx.fillText(away.name.toUpperCase(), cx + 300, rowY + 150)
}

/** The top-4 playoff bracket: 1v4 and 2v3, exactly how startPlayoffs seeds it. */
export function drawPlayoffsPreviewCard(ctx: Ctx, state: LeagueState): void {
  header(ctx, state, 'THE PLAYOFFS', 'CROWN LEAGUE · REGULAR SEASON COMPLETE')
  const top = computeStandings(state).slice(0, 4).map((r) => r.teamId)
  matchupRow(ctx, state, 'SEMI-FINAL 1 · SEED 1 v SEED 4', top[0], top[3], 560)
  matchupRow(ctx, state, 'SEMI-FINAL 2 · SEED 2 v SEED 3', top[1], top[2], 1010)

  const cx = CARD_W / 2
  ctx.textAlign = 'center'
  ctx.fillStyle = MUTED
  ctx.font = f('700', 28)
  ctx.fillText('WINNERS MEET IN THE FINAL', cx, 1500)
  ctx.fillStyle = CROWN.accent
  ctx.font = f('700', 26)
  ctx.fillText('SEMI-FINAL 1 · TOMORROW', cx, 1560)
}

/** The two finalists (winners of both semis). Only valid once sf1+sf2 are played. */
export function drawFinalsPreviewCard(ctx: Ctx, state: LeagueState): void {
  header(ctx, state, 'THE FINAL', 'CROWN LEAGUE · THE SEMIS ARE DONE')
  const a = winnerOf(state, 'sf1')
  const b = winnerOf(state, 'sf2')
  matchupRow(ctx, state, 'ONE MATCH FOR THE CROWN', a, b, 640)

  const cx = CARD_W / 2
  ctx.textAlign = 'center'
  ctx.fillStyle = MUTED
  ctx.font = f('700', 28)
  ctx.fillText('WINNER TAKES THE TITLE', cx, 1400)
  ctx.fillStyle = CROWN.accent
  ctx.font = f('700', 26)
  ctx.fillText('KICK-OFF · TOMORROW', cx, 1460)
}

/** The champions card — page 1 of the champions carousel (page 2 = final table). */
export function drawChampionsCard(ctx: Ctx, state: LeagueState): void {
  const championId = winnerOf(state, 'final')
  const club = clubBits(state, championId)
  const cx = CARD_W / 2

  header(ctx, state, 'CHAMPIONS', `CROWN LEAGUE · SEASON ${state.season}`)

  drawCrestBadge(ctx, club.crest, cx, 850, 250, { abbr: club.abbr, fallbackFill: club.color, shadow: true })

  ctx.textAlign = 'center'
  ctx.save()
  ctx.shadowColor = 'rgba(0,0,0,0.5)'
  ctx.shadowBlur = 10
  ctx.shadowOffsetY = 3
  ctx.fillStyle = GOLD
  ctx.font = f('800', 72)
  ctx.fillText(club.name.toUpperCase(), cx, 1230)
  ctx.restore()

  ctx.fillStyle = MUTED
  ctx.font = f('700', 30)
  ctx.fillText('KINGS OF THE CROWN LEAGUE', cx, 1310)
  ctx.fillStyle = 'rgba(255,255,255,0.5)'
  ctx.font = f('700', 26)
  ctx.fillText('SWIPE FOR THE FINAL TABLE →', cx, 1470)
}

async function exportCard(draw: (ctx: Ctx) => void): Promise<Blob> {
  await ensureLogosLoaded()
  const canvas = document.createElement('canvas')
  canvas.width = CARD_W
  canvas.height = CARD_H
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Could not create canvas context for a season card.')
  draw(ctx)
  return await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('toBlob failed'))), 'image/png'),
  )
}

export async function exportPlayoffsPreviewPng(state: LeagueState): Promise<Blob> {
  return exportCard((ctx) => drawPlayoffsPreviewCard(ctx, state))
}
export async function exportFinalsPreviewPng(state: LeagueState): Promise<Blob> {
  return exportCard((ctx) => drawFinalsPreviewCard(ctx, state))
}
export async function exportChampionsPng(state: LeagueState): Promise<Blob> {
  return exportCard((ctx) => drawChampionsCard(ctx, state))
}
