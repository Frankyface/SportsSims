// Shared visual system for every ESSPN graphic — the league tables (Crown League
// + Bastion Championships) and the team identity cards. One file so the network
// chrome (background, wordmark, footer, crest badges, form pills) stays identical
// across soccer, rugby and the card series; only content + club colour vary.
//
// This lives in src/render (NOT src/sim), so gradients / Math.* / shadows are all
// fair game — it is not under the determinism-hygiene scan.
//
// COLOUR TIERS (the spine of the system):
//   Tier 1 NETWORK   — constant on every asset (NET_RED, backgrounds, text).
//   Tier 2 COMPETITION — CROWN (soccer) vs BASTION (rugby) accent.
//   Tier 3 CLUB      — deriveClubTokens(color, colorAlt), contrast-guarded.

import { WORDMARK } from '../brand'
import { FONT_STACK } from './fonts'

// ─────────────────────────────────────────────────────────────────────────────
// Tier 1 — NETWORK tokens (never theme)
// ─────────────────────────────────────────────────────────────────────────────
export const NET_RED = '#FF4655'
export const BG_TOP = '#10161F'
export const BG_MID = '#0A0E14'
export const BG_BOTTOM = '#06080C'
export const VIGNETTE = 'rgba(0,0,0,0.38)'
export const TEXT = '#F2F5FA' // primary, warm off-white
export const DATA = '#D6DEE8' // numeric cells
export const MUTED = '#8A97A6' // labels / subtitles / footer ONLY — never live data
export const HAIRLINE = 'rgba(255,255,255,0.08)'
export const FENCE = 'rgba(255,255,255,0.14)'
export const CREST_RING = 'rgba(255,255,255,0.18)'
export const PTS_WHITE = '#FFFFFF'
export const GOLD = '#F5C451' // rank-1 ONLY, reserved
export const GOLD_WASH = 'rgba(245,196,81,0.06)'
export const FORM_W = '#2FBF71'
export const FORM_D = '#C9A227'
export const FORM_L = '#E5484D'
export const FORM_INK = '#0B0F16'
export const GD_POS = '#7FCF9F'

// ─────────────────────────────────────────────────────────────────────────────
// Tier 2 — COMPETITION accent
// ─────────────────────────────────────────────────────────────────────────────
export interface CompetitionAccent {
  accent: string
  glow: string
}
export const CROWN: CompetitionAccent = { accent: '#FF4655', glow: '#FF6B7A' }
export const BASTION: CompetitionAccent = { accent: '#C8102E', glow: '#E23048' }

const TAU = Math.PI * 2

/** Font shorthand: f('800', 42) -> "800 42px 'Barlow Semi Condensed', …". */
export function f(weight: string, px: number): string {
  return `${weight} ${px}px ${FONT_STACK}`
}

// ─────────────────────────────────────────────────────────────────────────────
// Colour math
// ─────────────────────────────────────────────────────────────────────────────
interface Rgb {
  r: number
  g: number
  b: number
}

export function hexToRgb(hex: string): Rgb {
  let h = hex.replace('#', '').trim()
  if (h.length === 3)
    h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2]
  const n = parseInt(h, 16)
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 }
}

function toHex(n: number): string {
  const s = Math.round(clamp(n, 0, 255)).toString(16)
  return s.length === 1 ? '0' + s : s
}
export function rgbToHex({ r, g, b }: Rgb): string {
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`
}

function clamp(x: number, lo: number, hi: number): number {
  return x < lo ? lo : x > hi ? hi : x
}

/** hex + alpha -> rgba() string. */
export function withAlpha(hex: string, a: number): string {
  const { r, g, b } = hexToRgb(hex)
  return `rgba(${r},${g},${b},${clamp(a, 0, 1)})`
}

/** WCAG relative luminance (gamma-expanded), 0..1. */
export function relLum(hex: string): number {
  const { r, g, b } = hexToRgb(hex)
  const lin = (c: number) => {
    const s = c / 255
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4)
  }
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b)
}

/** WCAG contrast ratio between two colours (1..21). */
export function contrastRatio(a: string, b: string): number {
  const la = relLum(a)
  const lb = relLum(b)
  const hi = Math.max(la, lb)
  const lo = Math.min(la, lb)
  return (hi + 0.05) / (lo + 0.05)
}

/** Linear-RGB mix from hex toward target by t (0..1). */
export function mixToward(hex: string, target: string, t: number): string {
  const a = hexToRgb(hex)
  const b = hexToRgb(target)
  const k = clamp(t, 0, 1)
  return rgbToHex({
    r: a.r + (b.r - a.r) * k,
    g: a.g + (b.g - a.g) * k,
    b: a.b + (b.b - a.b) * k,
  })
}

interface Hsl {
  h: number
  s: number
  l: number
}
function hexToHsl(hex: string): Hsl {
  const { r, g, b } = hexToRgb(hex)
  const rr = r / 255,
    gg = g / 255,
    bb = b / 255
  const max = Math.max(rr, gg, bb),
    min = Math.min(rr, gg, bb)
  const l = (max + min) / 2
  let h = 0
  let s = 0
  const d = max - min
  if (d !== 0) {
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
    if (max === rr) h = ((gg - bb) / d + (gg < bb ? 6 : 0)) / 6
    else if (max === gg) h = ((bb - rr) / d + 2) / 6
    else h = ((rr - gg) / d + 4) / 6
  }
  return { h, s, l }
}
function hslToHex({ h, s, l }: Hsl): string {
  const hue = (p: number, q: number, t: number) => {
    let tt = t
    if (tt < 0) tt += 1
    if (tt > 1) tt -= 1
    if (tt < 1 / 6) return p + (q - p) * 6 * tt
    if (tt < 1 / 2) return q
    if (tt < 2 / 3) return p + (q - p) * (2 / 3 - tt) * 6
    return p
  }
  let r: number, g: number, b: number
  if (s === 0) {
    r = g = b = l
  } else {
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s
    const p = 2 * l - q
    r = hue(p, q, h + 1 / 3)
    g = hue(p, q, h)
    b = hue(p, q, h - 1 / 3)
  }
  return rgbToHex({ r: r * 255, g: g * 255, b: b * 255 })
}

/**
 * Raise a colour's lightness (capping saturation to avoid neon) until it clears
 * a contrast ratio against bg. Returns the lifted hex — may still fail if the
 * hue simply can't get there; the caller decides the fallback.
 */
export function liftForContrast(hex: string, bg: string, min = 4.5): string {
  const hsl = hexToHsl(hex)
  hsl.s = Math.min(hsl.s, 0.85)
  let out = hslToHex(hsl)
  for (let i = 0; i < 16 && contrastRatio(out, bg) < min && hsl.l < 0.98; i++) {
    hsl.l = Math.min(0.98, hsl.l + 0.06)
    out = hslToHex(hsl)
  }
  return out
}

export interface ClubTokens {
  primary: string // raw P (true colour, for swatches)
  secondary: string // raw S
  accent: string // contrast-guarded — anything that must be READ
  field: string // large fills (rails, halos, ghost echo)
  deep: string // shadow foot of a field block
  dark: boolean // P is dark enough to need an edge stroke on thin marks
}

/**
 * Turn a club's (primary, secondary) into a safe token set. Big fills may stay
 * low-contrast (they're large); anything read uses `accent`, which is lifted /
 * swapped to secondary / falls back to platinum until it clears 4.5:1 on the bg.
 */
export function deriveClubTokens(primary: string, secondary: string): ClubTokens {
  const bg = BG_MID
  let accent = primary
  if (contrastRatio(accent, bg) < 4.5) accent = liftForContrast(primary, bg, 4.5)
  if (contrastRatio(accent, bg) < 4.5) {
    const alt = contrastRatio(secondary, bg) < 4.5 ? liftForContrast(secondary, bg, 4.5) : secondary
    accent = contrastRatio(alt, bg) >= 4.5 ? alt : '#CFD6E0'
  }
  const field = relLum(primary) < 0.05 ? mixToward(primary, '#FFFFFF', 0.12) : primary
  const deep = mixToward(primary, bg, 0.45)
  return { primary, secondary, accent, field, deep, dark: relLum(primary) < 0.18 }
}

/** Pick black or off-white ink for legible text on a fill. */
export function inkFor(bg: string): string {
  return contrastRatio(TEXT, bg) >= contrastRatio(FORM_INK, bg) ? TEXT : FORM_INK
}

// ─────────────────────────────────────────────────────────────────────────────
// Drawing helpers
// ─────────────────────────────────────────────────────────────────────────────
type Ctx = CanvasRenderingContext2D

export function roundRect(ctx: Ctx, x: number, y: number, w: number, h: number, r: number): void {
  const rr = Math.min(r, w / 2, h / 2)
  ctx.beginPath()
  ctx.moveTo(x + rr, y)
  ctx.arcTo(x + w, y, x + w, y + h, rr)
  ctx.arcTo(x + w, y + h, x, y + h, rr)
  ctx.arcTo(x, y + h, x, y, rr)
  ctx.arcTo(x, y, x + w, y, rr)
  ctx.closePath()
}

export function verticalGradient(ctx: Ctx, x: number, y: number, h: number, top: string, bottom: string): CanvasGradient {
  const g = ctx.createLinearGradient(x, y, x, y + h)
  g.addColorStop(0, top)
  g.addColorStop(1, bottom)
  return g
}

export interface BackgroundOpts {
  glowCx?: number
  glowCy?: number
  glowColor?: string
  glowAlpha?: number
  glowR?: number
}

/** Vertical gradient base + optional radial accent glow + edge vignette. */
export function drawBackground(ctx: Ctx, w: number, h: number, opts: BackgroundOpts = {}): void {
  const g = ctx.createLinearGradient(0, 0, 0, h)
  g.addColorStop(0, BG_TOP)
  g.addColorStop(0.52, BG_MID)
  g.addColorStop(1, BG_BOTTOM)
  ctx.fillStyle = g
  ctx.fillRect(0, 0, w, h)

  if (opts.glowColor && opts.glowCx !== undefined && opts.glowCy !== undefined) {
    const r = opts.glowR ?? 520
    const rg = ctx.createRadialGradient(opts.glowCx, opts.glowCy, 0, opts.glowCx, opts.glowCy, r)
    rg.addColorStop(0, withAlpha(opts.glowColor, opts.glowAlpha ?? 0.1))
    rg.addColorStop(1, withAlpha(opts.glowColor, 0))
    ctx.fillStyle = rg
    ctx.fillRect(0, 0, w, h)
  }

  const maxR = Math.hypot(w, h) / 2
  const v = ctx.createRadialGradient(w / 2, h / 2, maxR * 0.55, w / 2, h / 2, maxR)
  v.addColorStop(0, 'rgba(0,0,0,0)')
  v.addColorStop(1, VIGNETTE)
  ctx.fillStyle = v
  ctx.fillRect(0, 0, w, h)
}

function setTracking(ctx: Ctx, px: number): void {
  const c = ctx as Ctx & { letterSpacing?: string }
  if ('letterSpacing' in c) c.letterSpacing = `${px}px`
}
function clearTracking(ctx: Ctx): void {
  const c = ctx as Ctx & { letterSpacing?: string }
  if ('letterSpacing' in c) c.letterSpacing = '0px'
}

/** The E·SS·PN network wordmark — the "SS" in accent, everything else in TEXT. */
export function drawWordmark(
  ctx: Ctx,
  x: number,
  y: number,
  size: number,
  align: 'left' | 'center' | 'right' = 'left',
  accent: string = NET_RED,
): void {
  ctx.save()
  ctx.textBaseline = 'middle'
  ctx.textAlign = 'left'
  ctx.font = f('800', size)
  setTracking(ctx, Math.max(1, size * 0.05))
  const widths = WORDMARK.map((p) => ctx.measureText(p[0]).width)
  const total = widths.reduce((s, wdt) => s + wdt, 0)
  let sx = align === 'center' ? x - total / 2 : align === 'right' ? x - total : x
  for (let i = 0; i < WORDMARK.length; i++) {
    ctx.fillStyle = WORDMARK[i][1] ? accent : TEXT
    ctx.fillText(WORDMARK[i][0], sx, y)
    sx += widths[i]
  }
  clearTracking(ctx)
  ctx.restore()
}

/** A short centered gradient title bar with a whisper of glow. */
export function drawTitleRule(ctx: Ctx, cx: number, y: number, width: number, accent: string): void {
  const g = ctx.createLinearGradient(cx - width / 2, 0, cx + width / 2, 0)
  g.addColorStop(0, withAlpha(accent, 0))
  g.addColorStop(0.5, accent)
  g.addColorStop(1, withAlpha(accent, 0))
  ctx.save()
  ctx.shadowColor = accent
  ctx.shadowBlur = 8
  ctx.fillStyle = g
  ctx.fillRect(cx - width / 2, y - 1.5, width, 3)
  ctx.restore()
}

/** L-shaped broadcast corner ticks, top-left + bottom-right. */
export function drawCornerTicks(ctx: Ctx, w: number, h: number, accent: string, inset = 40, len = 34): void {
  ctx.save()
  ctx.strokeStyle = accent
  ctx.lineWidth = 2
  ctx.globalAlpha = 0.9
  ctx.beginPath()
  ctx.moveTo(inset, inset + len)
  ctx.lineTo(inset, inset)
  ctx.lineTo(inset + len, inset)
  ctx.stroke()
  ctx.beginPath()
  ctx.moveTo(w - inset, h - inset - len)
  ctx.lineTo(w - inset, h - inset)
  ctx.lineTo(w - inset - len, h - inset)
  ctx.stroke()
  ctx.restore()
}

export interface CrestOpts {
  ringColor?: string
  abbr?: string
  fallbackFill?: string
  mode?: 'contain' | 'cover'
  plate?: boolean
  shadow?: boolean
}

/**
 * A crest on a subtle circular plate with a ring. `contain` (default) fits the
 * whole logo inside the circle — so wordmark-style logos (e.g. Cobalt Bay) show
 * in full rather than being cropped. Null image -> filled colour circle + abbr
 * (replaces the old square fillRect fallback).
 */
export function drawCrestBadge(
  ctx: Ctx,
  img: HTMLImageElement | null | undefined,
  cx: number,
  cy: number,
  r: number,
  opts: CrestOpts = {},
): void {
  const { ringColor = CREST_RING, abbr = '', fallbackFill = '#1B2532', mode = 'contain', plate = true, shadow = false } =
    opts
  ctx.save()
  if (shadow) {
    ctx.shadowColor = 'rgba(0,0,0,0.5)'
    ctx.shadowBlur = 12
    ctx.shadowOffsetY = 4
  }
  if (plate) {
    ctx.beginPath()
    ctx.arc(cx, cy, r, 0, TAU)
    ctx.closePath()
    ctx.fillStyle = 'rgba(255,255,255,0.045)'
    ctx.fill()
  }
  ctx.restore()

  if (img) {
    ctx.save()
    ctx.beginPath()
    ctx.arc(cx, cy, r, 0, TAU)
    ctx.closePath()
    ctx.clip()
    if (mode === 'cover') {
      ctx.drawImage(img, cx - r, cy - r, r * 2, r * 2)
    } else {
      const box = r * 2 * 0.86
      const scale = Math.min(box / img.width, box / img.height)
      const wd = img.width * scale
      const ht = img.height * scale
      ctx.drawImage(img, cx - wd / 2, cy - ht / 2, wd, ht)
    }
    ctx.restore()
  } else {
    ctx.save()
    ctx.beginPath()
    ctx.arc(cx, cy, r, 0, TAU)
    ctx.closePath()
    ctx.fillStyle = fallbackFill
    ctx.fill()
    ctx.fillStyle = inkFor(fallbackFill)
    ctx.font = f('800', r * 0.62)
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(abbr, cx, cy + r * 0.04)
    ctx.restore()
  }

  ctx.beginPath()
  ctx.arc(cx, cy, r, 0, TAU)
  ctx.lineWidth = Math.max(2, r * 0.05)
  ctx.strokeStyle = ringColor
  ctx.stroke()
}

/** One form pill (used by the guide and the legend). y is the pill TOP. */
export function drawFormPill(ctx: Ctx, res: string, x: number, y: number, size: number): void {
  const fill = res === 'W' ? FORM_W : res === 'D' ? FORM_D : FORM_L
  roundRect(ctx, x, y, size, size, Math.max(4, size * 0.24))
  ctx.fillStyle = withAlpha(fill, 0.92)
  ctx.fill()
  ctx.fillStyle = FORM_INK
  ctx.font = f('700', size * 0.62)
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(res, x + size / 2, y + size / 2 + 1)
}

/** Up to 5 form pills, oldest -> newest, left aligned at x; yTop is the pill top. */
export function drawFormPills(
  ctx: Ctx,
  form: string[],
  x: number,
  yTop: number,
  opts: { size?: number; gap?: number } = {},
): void {
  const size = opts.size ?? 26
  const gap = opts.gap ?? 8
  const five = form.slice(-5)
  let px = x
  for (const res of five) {
    drawFormPill(ctx, res, px, yTop, size)
    px += size + gap
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Text fitting
// ─────────────────────────────────────────────────────────────────────────────
/** Shrink from startPx down to minPx (in steps) until text fits maxWidth. Sets ctx.font. Returns px. */
export function fitFont(
  ctx: Ctx,
  text: string,
  weight: string,
  startPx: number,
  minPx: number,
  maxWidth: number,
  step = 2,
): number {
  let px = startPx
  ctx.font = f(weight, px)
  while (px > minPx && ctx.measureText(text).width > maxWidth) {
    px -= step
    ctx.font = f(weight, px)
  }
  return px
}

/**
 * Word-wrap to at most maxLines, ellipsizing the final line if content remains.
 * ctx.font must be set to the intended size before calling.
 */
export function clampLines(ctx: Ctx, text: string, maxWidth: number, maxLines: number): string[] {
  const words = text.split(/\s+/).filter(Boolean)
  const lines: string[] = []
  let cur = ''
  let i = 0
  for (; i < words.length; i++) {
    const trial = cur ? cur + ' ' + words[i] : words[i]
    if (ctx.measureText(trial).width <= maxWidth || !cur) {
      cur = trial
    } else {
      lines.push(cur)
      cur = words[i]
      if (lines.length === maxLines - 1) {
        i++
        break
      }
    }
  }
  if (lines.length < maxLines - 1) {
    if (cur) lines.push(cur)
    return lines
  }
  // Building the final (maxLines-th) line, absorbing remaining words + ellipsis.
  let last = cur
  for (; i < words.length; i++) {
    const trial = last ? last + ' ' + words[i] : words[i]
    if (ctx.measureText(trial + '…').width <= maxWidth || !last) last = trial
    else {
      last = last + '…'
      last = trimToWidth(ctx, last, maxWidth)
      lines.push(last)
      return lines
    }
  }
  if (last) lines.push(last)
  return lines
}

function trimToWidth(ctx: Ctx, text: string, maxWidth: number): string {
  let t = text
  while (t.length > 1 && ctx.measureText(t).width > maxWidth) {
    t = t.slice(0, -2) + '…'
  }
  return t
}
