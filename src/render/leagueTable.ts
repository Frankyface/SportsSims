// The shared, sport-agnostic league-table renderer. Both standingsCard.ts
// (Crown League / soccer) and rugbyStandingsCard.ts (Bastion Championships /
// rugby) build a LeagueTableConfig and call drawLeagueTable — so the network
// chrome, row rhythm, qualification system, form guide and footer stay identical;
// only the competition accent, the numeric columns and the data differ.
//
// Layout is the collision-checked 1080x1920 grid from the design spec. Geometry
// constants are exported so leagueTableLayout.test.ts can lock them.

import { drawLogoContain } from './logos'
import {
  DATA,
  FENCE,
  FORM_INK,
  GD_POS,
  GOLD,
  GOLD_WASH,
  HAIRLINE,
  MUTED,
  PTS_WHITE,
  TEXT,
  type CompetitionAccent,
  deriveClubTokens,
  drawBackground,
  drawCornerTicks,
  drawCrestBadge,
  drawFormPill,
  drawFormPills,
  drawTitleRule,
  drawWordmark,
  f,
  fitFont,
  roundRect,
  withAlpha,
} from './theme'

export const CARD_W = 1080
export const CARD_H = 1920

/** Load-bearing table geometry (locked by tests). */
export const TABLE = {
  W: CARD_W,
  H: CARD_H,
  MARGIN_L: 48,
  MARGIN_R: 1032,
  get BODY_W() {
    return this.MARGIN_R - this.MARGIN_L
  },
  TOP: 552,
  ROW_H: 164,
  BAND_H: 158,
  POS_X: 88,
  CREST_X: 164,
  CREST_R: 46,
  NAME_X: 228,
  DIVIDER_X: 496,
  FENCE_X: 780,
  PTS_X: 812,
  FORM_X: 858,
  FORM_SIZE: 26,
  FORM_GAP: 8,
  QUALIFY: 4,
  HEADER_LABEL_Y: 500,
  HEADER_RULE_Y: 526.5,
  BODY_BOTTOM: 1536,
  LEGEND_Y: 1592,
  FOOTER_TOP_Y: 1690,
  rowCenter(i: number): number {
    return 634 + i * this.ROW_H
  },
} as const

export interface TableColumn {
  label: string
  x: number
  key: string // key into TableRow.values
  /** Render with an explicit +/- sign and tint by sign (GD / PD). */
  signed?: boolean
}

export interface TableRow {
  teamId: string
  name: string
  abbr: string
  nickname: string
  primary: string
  secondary: string
  crest: HTMLImageElement | null | undefined
  form: string[]
  points: number
  values: Record<string, number> // stat cells keyed by column.key (e.g. p,w,d,l,gd)
}

export interface LeagueTableConfig {
  competition: CompetitionAccent
  competitionName: string // e.g. "CROWN LEAGUE"
  crestLogo: HTMLImageElement | null | undefined
  roundLabel: string
  season: number
  rows: TableRow[]
  columns: TableColumn[]
  legendRight: string
  footNote: string
}

type Ctx = CanvasRenderingContext2D

/** GD/PD tint: + reads green, − recedes, 0 neutral. */
export function diffTint(n: number): string {
  return n > 0 ? GD_POS : n < 0 ? MUTED : DATA
}
export function signed(n: number): string {
  return (n > 0 ? '+' : '') + n
}

export function drawLeagueTable(ctx: Ctx, cfg: LeagueTableConfig): void {
  const { accent } = cfg.competition
  const cx = CARD_W / 2

  drawBackground(ctx, CARD_W, CARD_H, {
    glowCx: cx,
    glowCy: 200,
    glowColor: cfg.competition.glow,
    glowAlpha: 0.1,
    glowR: 520,
  })

  drawHeader(ctx, cfg, accent)
  drawColumnHeaders(ctx, cfg)
  drawRows(ctx, cfg, accent)
  drawStructure(ctx, accent)
  drawLegendAndFooter(ctx, cfg, accent)
  drawCornerTicks(ctx, CARD_W, CARD_H, '#FF4655')
}

function drawHeader(ctx: Ctx, cfg: LeagueTableConfig, accent: string): void {
  const cx = CARD_W / 2
  // network top rule
  ctx.fillStyle = '#FF4655'
  ctx.fillRect(0, 0, CARD_W, 6)

  // kicker strip
  drawWordmark(ctx, TABLE.MARGIN_L, 72, 34, 'left')
  ctx.textBaseline = 'middle'
  ctx.textAlign = 'right'
  ctx.fillStyle = MUTED
  ctx.font = f('700', 26)
  ctx.fillText(`SEASON ${cfg.season}`.toUpperCase(), TABLE.MARGIN_R, 72)

  // competition crest, contain-fit with a soft shadow
  if (cfg.crestLogo) {
    ctx.save()
    ctx.shadowColor = 'rgba(0,0,0,0.5)'
    ctx.shadowBlur = 16
    ctx.shadowOffsetY = 4
    drawLogoContain(ctx, cfg.crestLogo, cx, 196, 300, 132)
    ctx.restore()
  }

  // title
  ctx.textAlign = 'center'
  ctx.textBaseline = 'alphabetic'
  ctx.save()
  ctx.shadowColor = 'rgba(0,0,0,0.5)'
  ctx.shadowBlur = 10
  ctx.shadowOffsetY = 3
  ctx.fillStyle = TEXT
  ctx.font = f('800', 80)
  ctx.fillText('LEAGUE TABLE', cx, 358)
  ctx.restore()

  // subtitle
  ctx.fillStyle = MUTED
  ctx.font = f('600', 30)
  ctx.fillText(`${cfg.competitionName} · ${cfg.roundLabel}`.toUpperCase(), cx, 402)

  drawTitleRule(ctx, cx, 430, 320, accent)
}

function drawColumnHeaders(ctx: Ctx, cfg: LeagueTableConfig): void {
  ctx.fillStyle = MUTED
  ctx.font = f('600', 24)
  ctx.textBaseline = 'middle'

  ctx.textAlign = 'left'
  ctx.fillText('TEAM', TABLE.NAME_X, TABLE.HEADER_LABEL_Y)

  ctx.textAlign = 'center'
  for (const col of cfg.columns) ctx.fillText(col.label, col.x, TABLE.HEADER_LABEL_Y)
  ctx.fillText('PTS', TABLE.PTS_X, TABLE.HEADER_LABEL_Y)
  ctx.fillText('FORM', TABLE.FORM_X + (5 * TABLE.FORM_SIZE + 4 * TABLE.FORM_GAP) / 2, TABLE.HEADER_LABEL_Y)

  // full-width header hairline
  ctx.strokeStyle = HAIRLINE
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(TABLE.MARGIN_L, TABLE.HEADER_RULE_Y)
  ctx.lineTo(TABLE.MARGIN_R, TABLE.HEADER_RULE_Y)
  ctx.stroke()
}

function drawRows(ctx: Ctx, cfg: LeagueTableConfig, accent: string): void {
  // Pass A — band backgrounds, washes, rails
  cfg.rows.forEach((row, i) => {
    const center = TABLE.rowCenter(i)
    const bandTop = center - TABLE.BAND_H / 2
    const qualified = i < TABLE.QUALIFY
    const tokens = deriveClubTokens(row.primary, row.secondary)
    ctx.save()
    ctx.globalAlpha = qualified ? 1 : 0.72

    // zebra relief
    ctx.fillStyle = withAlpha('#FFFFFF', i % 2 ? 0.045 : 0.022)
    ctx.fillRect(TABLE.MARGIN_L, bandTop, TABLE.BODY_W, TABLE.BAND_H)
    // qualification wash
    if (qualified) {
      ctx.fillStyle = withAlpha(accent, 0.1)
      ctx.fillRect(TABLE.MARGIN_L, bandTop, TABLE.BODY_W, TABLE.BAND_H)
    }
    // leader gold wash + top border
    if (i === 0) {
      ctx.fillStyle = GOLD_WASH
      ctx.fillRect(TABLE.MARGIN_L, bandTop, TABLE.BODY_W, TABLE.BAND_H)
      ctx.fillStyle = withAlpha(accent, 0.85)
      ctx.fillRect(TABLE.MARGIN_L, bandTop, TABLE.BODY_W, 2)
    }
    // top highlight + bottom shadow (relief)
    ctx.fillStyle = 'rgba(255,255,255,0.06)'
    ctx.fillRect(TABLE.MARGIN_L, bandTop, TABLE.BODY_W, 1)
    ctx.fillStyle = 'rgba(0,0,0,0.35)'
    ctx.fillRect(TABLE.MARGIN_L, bandTop + TABLE.BAND_H - 1, TABLE.BODY_W, 1)

    // club-colour left rail
    roundRect(ctx, TABLE.MARGIN_L, bandTop + 6, 6, TABLE.BAND_H - 12, 3)
    ctx.fillStyle = tokens.field
    ctx.fill()
    if (tokens.dark) {
      ctx.strokeStyle = 'rgba(255,255,255,0.35)'
      ctx.lineWidth = 1
      ctx.stroke()
    }
    ctx.restore()
  })

  // structural verticals sit between backgrounds and content
  // (drawn in drawStructure, called after this)

  // Pass B — foreground content
  cfg.rows.forEach((row, i) => {
    const center = TABLE.rowCenter(i)
    const qualified = i < TABLE.QUALIFY
    const tokens = deriveClubTokens(row.primary, row.secondary)
    ctx.save()
    ctx.globalAlpha = qualified ? 1 : 0.72

    // position
    ctx.textBaseline = 'middle'
    if (i === 0) {
      ctx.beginPath()
      ctx.arc(TABLE.POS_X, center, 19, 0, Math.PI * 2)
      ctx.fillStyle = GOLD
      ctx.fill()
      ctx.fillStyle = FORM_INK
      ctx.font = f('800', 30)
      ctx.textAlign = 'center'
      ctx.fillText('1', TABLE.POS_X, center + 1)
    } else {
      ctx.fillStyle = DATA
      ctx.font = f('700', 34)
      ctx.textAlign = 'center'
      ctx.fillText(String(i + 1), TABLE.POS_X, center)
    }

    // crest
    drawCrestBadge(ctx, row.crest, TABLE.CREST_X, center, TABLE.CREST_R, {
      ringColor: tokens.dark ? tokens.accent : withAlpha(tokens.accent, 0.9),
      abbr: row.abbr,
      fallbackFill: tokens.field,
      shadow: true,
    })

    // name + nickname
    const nameMax = TABLE.DIVIDER_X - TABLE.NAME_X - 16
    ctx.textAlign = 'left'
    fitFont(ctx, row.name, '700', 34, 22, nameMax)
    ctx.fillStyle = TEXT
    ctx.fillText(row.name, TABLE.NAME_X, center - 12)
    ctx.fillStyle = MUTED
    ctx.font = f('600', 21)
    ctx.fillText(row.nickname.toUpperCase(), TABLE.NAME_X, center + 22)

    // numeric columns
    ctx.textAlign = 'center'
    ctx.font = f('600', 38)
    for (const col of cfg.columns) {
      const v = row.values[col.key] ?? 0
      ctx.fillStyle = col.signed ? diffTint(v) : DATA
      ctx.fillText(col.signed ? signed(v) : String(v), col.x, center)
    }

    // points (the payoff)
    ctx.save()
    ctx.shadowColor = 'rgba(0,0,0,0.5)'
    ctx.shadowBlur = 8
    ctx.fillStyle = PTS_WHITE
    ctx.font = f('800', 46)
    ctx.fillText(String(row.points), TABLE.PTS_X, center)
    ctx.restore()

    // form guide
    drawFormPills(ctx, row.form, TABLE.FORM_X, center - TABLE.FORM_SIZE / 2, {
      size: TABLE.FORM_SIZE,
      gap: TABLE.FORM_GAP,
    })

    ctx.restore()
  })
}

/** Continuous column rules + the playoff cut-line + PLAYOFFS tab. */
function drawStructure(ctx: Ctx, accent: string): void {
  const bodyTop = TABLE.HEADER_RULE_Y + 8
  const bodyBottom = TABLE.BODY_BOTTOM

  // identity | numbers divider (faint) and PTS fence (heavier)
  ctx.strokeStyle = HAIRLINE
  ctx.lineWidth = 1
  line(ctx, TABLE.DIVIDER_X + 0.5, bodyTop, TABLE.DIVIDER_X + 0.5, bodyBottom)
  ctx.strokeStyle = FENCE
  line(ctx, TABLE.FENCE_X + 0.5, bodyTop, TABLE.FENCE_X + 0.5, bodyBottom)

  // playoff cut-line between seed 4 and 5
  const r4Bottom = TABLE.rowCenter(TABLE.QUALIFY - 1) + TABLE.BAND_H / 2
  const r5Top = TABLE.rowCenter(TABLE.QUALIFY) - TABLE.BAND_H / 2
  const cutY = Math.round((r4Bottom + r5Top) / 2)
  ctx.save()
  ctx.shadowColor = accent
  ctx.shadowBlur = 6
  ctx.strokeStyle = accent
  ctx.lineWidth = 2
  line(ctx, TABLE.MARGIN_L, cutY, TABLE.MARGIN_R, cutY)
  ctx.restore()

  // PLAYOFFS tab
  const tabW = 156
  const tabH = 30
  roundRect(ctx, TABLE.MARGIN_L, cutY - tabH / 2, tabW, tabH, 6)
  ctx.fillStyle = accent
  ctx.fill()
  ctx.fillStyle = FORM_INK
  ctx.font = f('800', 18)
  ctx.textAlign = 'left'
  ctx.textBaseline = 'middle'
  ctx.fillText('PLAYOFFS', TABLE.MARGIN_L + 40, cutY + 1)
  // up-chevron shape
  ctx.strokeStyle = FORM_INK
  ctx.lineWidth = 3
  ctx.lineCap = 'round'
  ctx.beginPath()
  ctx.moveTo(TABLE.MARGIN_L + 16, cutY + 4)
  ctx.lineTo(TABLE.MARGIN_L + 22, cutY - 4)
  ctx.lineTo(TABLE.MARGIN_L + 28, cutY + 4)
  ctx.stroke()
  ctx.lineCap = 'butt'
}

function drawLegendAndFooter(ctx: Ctx, cfg: LeagueTableConfig, accent: string): void {
  const y = TABLE.LEGEND_Y
  // left: mini W D L swatches + label
  let lx = TABLE.MARGIN_L
  const s = 22
  for (const r of ['W', 'D', 'L']) {
    drawFormPill(ctx, r, lx, y - s / 2, s)
    lx += s + 6
  }
  ctx.fillStyle = MUTED
  ctx.font = f('600', 22)
  ctx.textAlign = 'left'
  ctx.textBaseline = 'middle'
  ctx.fillText('FORM · LAST 5', lx + 8, y)

  // right: column legend
  ctx.textAlign = 'right'
  ctx.fillText(cfg.legendRight.toUpperCase(), TABLE.MARGIN_R, y)

  // footer top hairline + accent segment
  ctx.strokeStyle = HAIRLINE
  ctx.lineWidth = 1
  line(ctx, TABLE.MARGIN_L, TABLE.FOOTER_TOP_Y + 0.5, TABLE.MARGIN_R, TABLE.FOOTER_TOP_Y + 0.5)
  ctx.strokeStyle = accent
  ctx.lineWidth = 3
  line(ctx, TABLE.MARGIN_L, TABLE.FOOTER_TOP_Y + 1.5, TABLE.MARGIN_L + 120, TABLE.FOOTER_TOP_Y + 1.5)

  // centered brand lockup
  const cx = CARD_W / 2
  drawWordmark(ctx, cx, 1778, 32, 'center')
  ctx.fillStyle = MUTED
  ctx.font = f('600', 24)
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(`@ESSPN · ${cfg.footNote}`.toUpperCase(), cx, 1820)
}

function line(ctx: Ctx, x1: number, y1: number, x2: number, y2: number): void {
  ctx.beginPath()
  ctx.moveTo(x1, y1)
  ctx.lineTo(x2, y2)
  ctx.stroke()
}
