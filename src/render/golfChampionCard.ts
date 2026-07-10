// The SGA Tour SEASON CHAMPION card (1080x1920 PNG) — page 1 of the golf
// champions carousel (page 2 = the final season rankings). Crowns the golfer
// atop the points list once all 14 events are done.

import { golfRankings, golferById, type GolfSeasonState } from '../league/golfSeason'
import { eventById } from '../ratings/golfCourses'
import { TEXT, MUTED, GOLD, drawBackground, drawWordmark, f } from './theme'
import { drawSgaMark, ensureSgaLogo } from './golfBrand'
import { APEX, GOLF_CARD_W, GOLF_CARD_H } from './golfRankingsCard'
import { ensureFontsLoaded } from './fonts'

type Ctx = CanvasRenderingContext2D

export function drawGolfChampionCard(ctx: Ctx, state: GolfSeasonState): void {
  const cx = GOLF_CARD_W / 2
  const rankings = golfRankings(state)
  const champ = golferById(state, rankings[0].golferId)
  const wins = rankings[0].wins
  const majors = state.completed.filter(
    (r) => r.winnerId === champ.identity.id && eventById(r.eventId).major,
  ).length

  drawBackground(ctx, GOLF_CARD_W, GOLF_CARD_H, {
    glowCx: cx,
    glowCy: 220,
    glowColor: APEX.glow,
    glowAlpha: 0.09,
    glowR: 540,
  })
  ctx.fillStyle = APEX.accent
  ctx.fillRect(0, 0, GOLF_CARD_W, 6)
  drawWordmark(ctx, 72, 72, 34, 'left')
  ctx.textBaseline = 'middle'
  ctx.textAlign = 'right'
  ctx.fillStyle = MUTED
  ctx.font = f('700', 26)
  ctx.fillText(`SEASON ${state.season}`, GOLF_CARD_W - 72, 72)

  drawSgaMark(ctx, cx, 360, 220)

  ctx.textAlign = 'center'
  ctx.fillStyle = APEX.accent
  ctx.font = f('700', 30)
  ctx.fillText('SGA TOUR · ALL 14 EVENTS PLAYED', cx, 600)
  ctx.save()
  ctx.shadowColor = 'rgba(0,0,0,0.5)'
  ctx.shadowBlur = 10
  ctx.shadowOffsetY = 3
  ctx.fillStyle = TEXT
  ctx.font = f('800', 84)
  ctx.fillText('SEASON CHAMPION', cx, 700)
  ctx.restore()

  // the champion
  ctx.save()
  ctx.shadowColor = 'rgba(0,0,0,0.5)'
  ctx.shadowBlur = 10
  ctx.shadowOffsetY = 3
  ctx.fillStyle = GOLD
  ctx.font = f('800', 92)
  ctx.fillText(champ.identity.name.toUpperCase(), cx, 950)
  ctx.restore()
  ctx.fillStyle = MUTED
  ctx.font = f('700', 34)
  ctx.fillText(`"${champ.identity.nickname.toUpperCase()}"`, cx, 1030)

  ctx.fillStyle = TEXT
  ctx.font = f('700', 38)
  const line = [`${rankings[0].points} PTS`, `${wins} WIN${wins === 1 ? '' : 'S'}`]
  if (majors > 0) line.push(`${majors} MAJOR${majors === 1 ? '' : 'S'}`)
  ctx.fillText(line.join(' · '), cx, 1180)

  ctx.fillStyle = 'rgba(255,255,255,0.5)'
  ctx.font = f('700', 26)
  ctx.fillText('SWIPE FOR THE FINAL RANKINGS →', cx, 1400)
}

export async function exportGolfChampionPng(state: GolfSeasonState): Promise<Blob> {
  await Promise.all([ensureFontsLoaded(), ensureSgaLogo()])
  const canvas = document.createElement('canvas')
  canvas.width = GOLF_CARD_W
  canvas.height = GOLF_CARD_H
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Could not create canvas context for the champion card.')
  drawGolfChampionCard(ctx, state)
  return await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('toBlob failed'))), 'image/png'),
  )
}
