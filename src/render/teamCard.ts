// The ESSPN team identity card — one per club, 1080x1350 (4:5 feed post). The
// "club book" page turned into a shareable graphic: a hero crest, the club name +
// nickname, a dossier panel (city / identity / kit colours) and the personality
// blurb. Sport-agnostic: soccer and rugby both build a TeamCardInput and pass the
// competition branding; the shared theme.ts helpers keep it on the ESSPN system.
//
// Header, panel, description and footer geometry are FIXED across all six cards so
// a set reads as a deliberate series; only the crest, strings and derived club
// colours change. The hero crest is the only centered element — everything else is
// flush-left (editorial asymmetry, an intentional anti-"AI-centered-stack" choice).

import {
  DATA,
  HAIRLINE,
  MUTED,
  NET_RED,
  TEXT,
  type CompetitionAccent,
  clampLines,
  deriveClubTokens,
  drawBackground,
  drawCornerTicks,
  drawCrestBadge,
  drawWordmark,
  f,
  fitFont,
  mixToward,
  roundRect,
  withAlpha,
} from './theme'

export const TEAM_CARD_W = 1080
export const TEAM_CARD_H = 1350

/** Fixed team-card geometry (locked by tests). */
export const TEAM_CARD = {
  W: TEAM_CARD_W,
  H: TEAM_CARD_H,
  MARGIN: 72,
  get RIGHT() {
    return this.W - this.MARGIN
  },
  get COL_W() {
    return this.W - this.MARGIN * 2
  },
  HEADER_H: 150,
  CREST_CX: 540,
  CREST_CY: 396,
  CREST_R: 196,
  HALO_R: 320,
  NAME_Y_SINGLE: 706,
  PANEL_X: 72,
  PANEL_Y: 828,
  PANEL_W: 936,
  PANEL_H: 272,
  DESC_Y: 1140,
  DESC_LH: 36,
  DESC_LINES: 3,
  FOOTER_RULE_Y: 1252,
  BOTTOM_SAFE: 1340,
} as const

export interface TeamCardInput {
  name: string
  abbr: string
  city: string
  nickname: string
  archetype: string
  color: string
  colorAlt: string
  description: string
  crest: HTMLImageElement | null | undefined
}

export interface TeamCardBrand {
  competition: CompetitionAccent
  competitionName: string // e.g. "Crown League"
}

type Ctx = CanvasRenderingContext2D

export function drawTeamCard(ctx: Ctx, club: TeamCardInput, brand: TeamCardBrand): void {
  const T = TEAM_CARD
  const tokens = deriveClubTokens(club.color, club.colorAlt)
  const accent = tokens.accent

  drawBackground(ctx, T.W, T.H, {
    glowCx: T.CREST_CX,
    glowCy: T.CREST_CY,
    glowColor: accent,
    glowAlpha: 0.18,
    glowR: T.HALO_R,
  })

  drawHeader(ctx, brand, accent)
  drawHero(ctx, club, tokens.accent)
  drawName(ctx, club, accent)
  drawPanel(ctx, club, tokens.field)
  drawDescription(ctx, club)
  drawFooter(ctx, brand, accent)
  drawCornerTicks(ctx, T.W, T.H, NET_RED)
}

function drawHeader(ctx: Ctx, brand: TeamCardBrand, accent: string): void {
  const T = TEAM_CARD
  // network red rule + thin club spine beneath it — "ESSPN presents <club>"
  ctx.fillStyle = NET_RED
  ctx.fillRect(0, 0, T.W, 6)
  ctx.fillStyle = accent
  ctx.fillRect(0, 6, T.W, 6)

  // wordmark left
  drawWordmark(ctx, T.MARGIN, 96, 34, 'left')

  // competition chip, right-anchored
  const label = brand.competitionName.toUpperCase()
  ctx.font = f('700', 22)
  ctx.save()
  const c = ctx as Ctx & { letterSpacing?: string }
  if ('letterSpacing' in c) c.letterSpacing = '4px'
  const textW = ctx.measureText(label).width
  const chipW = textW + 40
  const chipH = 42
  const chipX = T.RIGHT - chipW
  const chipY = 96 - chipH / 2
  roundRect(ctx, chipX, chipY, chipW, chipH, chipH / 2)
  ctx.strokeStyle = accent
  ctx.lineWidth = 2
  ctx.stroke()
  ctx.fillStyle = accent
  ctx.textAlign = 'left'
  ctx.textBaseline = 'middle'
  ctx.fillText(label, chipX + 20, 97)
  if ('letterSpacing' in c) c.letterSpacing = '0px'
  ctx.restore()

  // header divider
  ctx.strokeStyle = HAIRLINE
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(T.MARGIN, T.HEADER_H + 0.5)
  ctx.lineTo(T.RIGHT, T.HEADER_H + 0.5)
  ctx.stroke()
}

function drawHero(ctx: Ctx, club: TeamCardInput, accent: string): void {
  const T = TEAM_CARD
  // ghost watermark echo of the abbreviation, behind the crest
  ctx.save()
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillStyle = withAlpha(accent, 0.09)
  ctx.font = f('800', 300)
  const c = ctx as Ctx & { letterSpacing?: string }
  if ('letterSpacing' in c) c.letterSpacing = '8px'
  ctx.fillText(club.abbr.toUpperCase(), T.CREST_CX, T.CREST_CY)
  if ('letterSpacing' in c) c.letterSpacing = '0px'
  ctx.restore()

  drawCrestBadge(ctx, club.crest, T.CREST_CX, T.CREST_CY, T.CREST_R, {
    ringColor: accent,
    abbr: club.abbr,
    fallbackFill: club.color,
    shadow: true,
    plate: true,
  })
}

/** Draws the flush-left name + nickname; returns the nickname baseline y. */
function drawName(ctx: Ctx, club: TeamCardInput, accent: string): number {
  const T = TEAM_CARD
  const upper = club.name.toUpperCase()
  ctx.textAlign = 'left'
  ctx.textBaseline = 'alphabetic'

  const single = fitFont(ctx, upper, '800', 88, 60, T.COL_W)
  const fitsSingle = ctx.measureText(upper).width <= T.COL_W && single >= 62

  ctx.fillStyle = TEXT
  let nickBaseline: number
  if (fitsSingle) {
    ctx.font = f('800', single)
    ctx.fillText(upper, T.MARGIN, T.NAME_Y_SINGLE)
    nickBaseline = T.NAME_Y_SINGLE + 48
  } else {
    let size = 74
    ctx.font = f('800', size)
    let lines = clampLines(ctx, upper, T.COL_W, 2)
    while (size > 46 && lines.some((l) => ctx.measureText(l).width > T.COL_W)) {
      size -= 3
      ctx.font = f('800', size)
      lines = clampLines(ctx, upper, T.COL_W, 2)
    }
    const lh = size * 1.02
    const firstBaseline = T.NAME_Y_SINGLE - 34
    lines.forEach((l, i) => ctx.fillText(l, T.MARGIN, firstBaseline + i * lh))
    nickBaseline = firstBaseline + (lines.length - 1) * lh + 48
  }

  // nickname
  ctx.fillStyle = accent
  ctx.font = f('700', 40)
  ctx.fillText(`“${club.nickname}”`, T.MARGIN, nickBaseline)
  return nickBaseline
}

function drawPanel(ctx: Ctx, club: TeamCardInput, field: string): void {
  const T = TEAM_CARD
  // panel surface
  roundRect(ctx, T.PANEL_X, T.PANEL_Y, T.PANEL_W, T.PANEL_H, 20)
  ctx.fillStyle = '#121822'
  ctx.fill()
  // field top accent hairline + inner highlight
  ctx.save()
  roundRect(ctx, T.PANEL_X, T.PANEL_Y, T.PANEL_W, T.PANEL_H, 20)
  ctx.clip()
  ctx.fillStyle = withAlpha(mixToward(field, '#FFFFFF', 0.1), 0.9)
  ctx.fillRect(T.PANEL_X, T.PANEL_Y, T.PANEL_W, 2)
  ctx.fillStyle = 'rgba(255,255,255,0.05)'
  ctx.fillRect(T.PANEL_X, T.PANEL_Y + 2, T.PANEL_W, 1)
  ctx.restore()

  const label = (text: string, x: number, y: number) => {
    ctx.fillStyle = MUTED
    ctx.font = f('700', 20)
    ctx.textAlign = 'left'
    ctx.textBaseline = 'alphabetic'
    const c = ctx as Ctx & { letterSpacing?: string }
    if ('letterSpacing' in c) c.letterSpacing = '3px'
    ctx.fillText(text.toUpperCase(), x, y)
    if ('letterSpacing' in c) c.letterSpacing = '0px'
  }
  const value = (text: string, x: number, y: number) => {
    ctx.fillStyle = TEXT
    ctx.font = f('600', 30)
    ctx.textAlign = 'left'
    ctx.fillText(text, x, y)
  }

  // left column — city + identity
  const LX = 104
  label('City', LX, 900)
  value(club.city, LX, 938)
  label('Identity', LX, 1006)
  ctx.font = f('600', 28)
  const archLines = clampLines(ctx, club.archetype, 420, 2)
  archLines.forEach((l, i) => {
    ctx.fillStyle = TEXT
    ctx.font = f('600', 28)
    ctx.textAlign = 'left'
    ctx.fillText(l, LX, 1044 + i * 34)
  })

  // right column — colours
  const RX = 596
  label('Colours', RX, 900)
  drawSwatch(ctx, RX, 922, club.color)
  drawSwatch(ctx, RX + 72, 922, club.colorAlt)
  ctx.fillStyle = DATA
  ctx.font = f('600', 20)
  ctx.textAlign = 'left'
  ctx.fillText(club.color.toUpperCase(), RX, 1012)
  ctx.fillText(club.colorAlt.toUpperCase(), RX + 72, 1012)
}

function drawSwatch(ctx: Ctx, x: number, y: number, color: string): void {
  roundRect(ctx, x, y, 56, 56, 12)
  ctx.fillStyle = color
  ctx.fill()
  ctx.strokeStyle = 'rgba(255,255,255,0.15)'
  ctx.lineWidth = 1
  ctx.stroke()
}

function drawDescription(ctx: Ctx, club: TeamCardInput): void {
  const T = TEAM_CARD
  ctx.font = f('600', 25)
  ctx.textAlign = 'left'
  ctx.textBaseline = 'alphabetic'
  ctx.fillStyle = DATA
  const lines = clampLines(ctx, club.description, T.COL_W, T.DESC_LINES)
  lines.forEach((l, i) => ctx.fillText(l, T.MARGIN, T.DESC_Y + i * T.DESC_LH))
}

function drawFooter(ctx: Ctx, brand: TeamCardBrand, accent: string): void {
  const T = TEAM_CARD
  ctx.strokeStyle = HAIRLINE
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(T.MARGIN, T.FOOTER_RULE_Y + 0.5)
  ctx.lineTo(T.RIGHT, T.FOOTER_RULE_Y + 0.5)
  ctx.stroke()

  // accent tick + handle
  ctx.fillStyle = accent
  ctx.fillRect(T.MARGIN, 1284, 8, 28)
  ctx.fillStyle = TEXT
  ctx.font = f('700', 26)
  ctx.textAlign = 'left'
  ctx.textBaseline = 'middle'
  ctx.fillText('@ESSPN', T.MARGIN + 22, 1300)

  // context note, right
  ctx.fillStyle = MUTED
  ctx.font = f('600', 22)
  ctx.textAlign = 'right'
  ctx.fillText(`${brand.competitionName} · Club Identity`.toUpperCase(), T.RIGHT, 1300)
}

export async function exportTeamCardPng(club: TeamCardInput, brand: TeamCardBrand): Promise<Blob> {
  const canvas = document.createElement('canvas')
  canvas.width = TEAM_CARD_W
  canvas.height = TEAM_CARD_H
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Could not create a 2D canvas context for the team card.')
  drawTeamCard(ctx, club, brand)
  return new Promise((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('team card PNG export failed'))), 'image/png')
  })
}
