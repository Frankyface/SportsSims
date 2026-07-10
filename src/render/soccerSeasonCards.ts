// Crown League season-moment cards — 1080x1350 (4:5 FEED) PNGs for the daily
// poster (these are standalone carousel/photo posts, never reel end-cards):
//   - PLAYOFFS preview — the top-4 bracket, posted after the last regular match
//   - FINAL preview — the two finalists, posted after the second semi
//   - CHAMPIONS — the crowned club + season, page 1 of the champions carousel
// Same broadcast style as the standings card (drawBackground/theme + crests).

import type { LeagueState } from '../league/types'
import { computeStandings, teamById, winnerOf } from '../league/league'
import { getLogo, getLeagueLogo, ensureLogosLoaded } from './logos'
import { CROWN, TEXT, MUTED, GOLD, drawBackground, drawCornerTicks, drawCrestBadge, drawWordmark, f } from './theme'

const CARD_W = 1080
const CARD_H = 1350

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
  drawBackground(ctx, CARD_W, CARD_H, { glowCx: cx, glowCy: 180, glowColor: CROWN.glow, glowAlpha: 0.09, glowR: 480 })
  ctx.fillStyle = CROWN.accent
  ctx.fillRect(0, 0, CARD_W, 6)
  drawWordmark(ctx, 64, 64, 32, 'left')
  ctx.textBaseline = 'middle'
  ctx.textAlign = 'right'
  ctx.fillStyle = MUTED
  ctx.font = f('700', 24)
  ctx.fillText(`SEASON ${state.season}`, CARD_W - 64, 64)
  drawCornerTicks(ctx, CARD_W, CARD_H, CROWN.accent)

  const league = getLeagueLogo()
  if (league) drawCrestBadge(ctx, league, cx, 158, 74, { plate: false })

  ctx.textAlign = 'center'
  ctx.textBaseline = 'alphabetic'
  ctx.fillStyle = CROWN.accent
  ctx.font = f('700', 28)
  ctx.fillText(kicker, cx, 264)
  ctx.save()
  ctx.shadowColor = 'rgba(0,0,0,0.5)'
  ctx.shadowBlur = 10
  ctx.shadowOffsetY = 3
  ctx.fillStyle = TEXT
  ctx.font = f('800', 76)
  ctx.fillText(title, cx, 340)
  ctx.restore()
}

function matchupRow(ctx: Ctx, state: LeagueState, label: string, homeId: string, awayId: string, y: number): void {
  const cx = CARD_W / 2
  const home = clubBits(state, homeId)
  const away = clubBits(state, awayId)

  ctx.textAlign = 'center'
  ctx.textBaseline = 'alphabetic'
  ctx.fillStyle = MUTED
  ctx.font = f('700', 26)
  ctx.fillText(label, cx, y)

  const rowY = y + 110
  drawCrestBadge(ctx, home.crest, cx - 290, rowY, 84, { abbr: home.abbr, fallbackFill: home.color, shadow: true })
  drawCrestBadge(ctx, away.crest, cx + 290, rowY, 84, { abbr: away.abbr, fallbackFill: away.color, shadow: true })
  ctx.textBaseline = 'middle'
  ctx.fillStyle = TEXT
  ctx.font = f('800', 48)
  ctx.fillText('VS', cx, rowY)

  ctx.textBaseline = 'alphabetic'
  ctx.font = f('700', 30)
  ctx.fillStyle = TEXT
  ctx.fillText(home.name.toUpperCase(), cx - 290, rowY + 128)
  ctx.fillText(away.name.toUpperCase(), cx + 290, rowY + 128)
}

/** The top-4 playoff bracket: 1v4 and 2v3, exactly how startPlayoffs seeds it. */
export function drawPlayoffsPreviewCard(ctx: Ctx, state: LeagueState): void {
  header(ctx, state, 'THE PLAYOFFS', 'CROWN LEAGUE · REGULAR SEASON COMPLETE')
  const top = computeStandings(state).slice(0, 4).map((r) => r.teamId)
  matchupRow(ctx, state, 'SEMI-FINAL 1 · SEED 1 v SEED 4', top[0], top[3], 470)
  matchupRow(ctx, state, 'SEMI-FINAL 2 · SEED 2 v SEED 3', top[1], top[2], 830)

  const cx = CARD_W / 2
  ctx.textAlign = 'center'
  ctx.fillStyle = MUTED
  ctx.font = f('700', 27)
  ctx.fillText('WINNERS MEET IN THE FINAL', cx, 1210)
  ctx.fillStyle = CROWN.accent
  ctx.font = f('700', 25)
  ctx.fillText('SEMI-FINAL 1 · TOMORROW', cx, 1262)
}

/** The two finalists (winners of both semis). Only valid once sf1+sf2 are played. */
export function drawFinalsPreviewCard(ctx: Ctx, state: LeagueState): void {
  header(ctx, state, 'THE FINAL', 'CROWN LEAGUE · THE SEMIS ARE DONE')
  const a = winnerOf(state, 'sf1')
  const b = winnerOf(state, 'sf2')
  matchupRow(ctx, state, 'ONE MATCH FOR THE CROWN', a, b, 560)

  const cx = CARD_W / 2
  ctx.textAlign = 'center'
  ctx.fillStyle = MUTED
  ctx.font = f('700', 28)
  ctx.fillText('WINNER TAKES THE TITLE', cx, 1170)
  ctx.fillStyle = CROWN.accent
  ctx.font = f('700', 25)
  ctx.fillText('KICK-OFF · TOMORROW', cx, 1224)
}

/** The champions card — page 1 of the champions carousel (page 2 = final table). */
export function drawChampionsCard(ctx: Ctx, state: LeagueState): void {
  const championId = winnerOf(state, 'final')
  const club = clubBits(state, championId)
  const cx = CARD_W / 2

  header(ctx, state, 'CHAMPIONS', `CROWN LEAGUE · SEASON ${state.season}`)

  drawCrestBadge(ctx, club.crest, cx, 660, 200, { abbr: club.abbr, fallbackFill: club.color, shadow: true })

  ctx.textAlign = 'center'
  ctx.save()
  ctx.shadowColor = 'rgba(0,0,0,0.5)'
  ctx.shadowBlur = 10
  ctx.shadowOffsetY = 3
  ctx.fillStyle = GOLD
  ctx.font = f('800', 68)
  ctx.fillText(club.name.toUpperCase(), cx, 980)
  ctx.restore()

  ctx.fillStyle = MUTED
  ctx.font = f('700', 30)
  ctx.fillText('KINGS OF THE CROWN LEAGUE', cx, 1050)
  ctx.fillStyle = 'rgba(255,255,255,0.5)'
  ctx.font = f('700', 26)
  ctx.fillText('SWIPE FOR THE FINAL TABLE →', cx, 1240)
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
