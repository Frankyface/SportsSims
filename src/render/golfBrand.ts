// The Simulated Golf Association (SGA) brand mark for golf graphics.
//
// The real logo is an operator-supplied PNG. Because it is a same-origin static
// asset (served from /public), it is loaded at RUNTIME (not a bundled import) so
// a missing file simply falls back to a drawn crest instead of breaking the
// build. Drop the artwork at `public/logos/sga.png` and it appears everywhere.

type Ctx = CanvasRenderingContext2D
const TAU = Math.PI * 2

const SGA_GREEN = '#123d24'
const SGA_GREEN_DK = '#0c2c19'
const SGA_GOLD = '#c9a227'
const SGA_CREAM = '#f4f1e6'

const SGA_URL = `${import.meta.env.BASE_URL}logos/sga.png`
let sgaImg: HTMLImageElement | null = null
let loadPromise: Promise<void> | null = null

/** Try to load the operator's SGA logo once. Never rejects — a miss just leaves
 * the drawn-crest fallback in place. */
export function ensureSgaLogo(): Promise<void> {
  if (!loadPromise) {
    loadPromise = new Promise<void>((resolve) => {
      const img = new Image()
      let settled = false
      const done = (ok: boolean): void => {
        if (settled) return
        settled = true
        if (ok) sgaImg = img
        resolve()
      }
      img.onload = () => done(true)
      img.onerror = () => done(false)
      setTimeout(() => done(false), 10000)
      img.src = SGA_URL
    })
  }
  return loadPromise
}

export function getSgaLogo(): HTMLImageElement | null {
  return sgaImg
}

/** Draw the SGA mark centred at (cx, cy) fitting a `size`-wide box: the real
 * logo if loaded, otherwise a drawn shield crest. */
export function drawSgaMark(ctx: Ctx, cx: number, cy: number, size: number): void {
  if (sgaImg) {
    const scale = Math.min(size / sgaImg.width, (size * 1.18) / sgaImg.height)
    const w = sgaImg.width * scale
    const h = sgaImg.height * scale
    ctx.drawImage(sgaImg, cx - w / 2, cy - h / 2, w, h)
    return
  }
  drawSgaCrest(ctx, cx, cy, size)
}

function shieldPath(ctx: Ctx, cx: number, cy: number, w: number, h: number): void {
  const l = cx - w / 2
  const r = cx + w / 2
  const top = cy - h / 2
  const bot = cy + h / 2
  const rad = w * 0.16
  ctx.beginPath()
  ctx.moveTo(l, top + rad)
  ctx.quadraticCurveTo(l, top, l + rad, top)
  ctx.lineTo(r - rad, top)
  ctx.quadraticCurveTo(r, top, r, top + rad)
  ctx.lineTo(r, cy + h * 0.16)
  ctx.quadraticCurveTo(r, bot - h * 0.16, cx, bot)
  ctx.quadraticCurveTo(l, bot - h * 0.16, l, cy + h * 0.16)
  ctx.closePath()
}

/** A clean drawn SGA shield crest — the fallback until the real PNG is dropped in. */
export function drawSgaCrest(ctx: Ctx, cx: number, cy: number, size: number): void {
  const w = size
  const h = size * 1.2
  ctx.save()
  // gold border, green field, thin cream inner line
  shieldPath(ctx, cx, cy, w, h)
  ctx.fillStyle = SGA_GOLD
  ctx.fill()
  shieldPath(ctx, cx, cy, w * 0.94, h * 0.94)
  const grad = ctx.createLinearGradient(0, cy - h / 2, 0, cy + h / 2)
  grad.addColorStop(0, SGA_GREEN)
  grad.addColorStop(1, SGA_GREEN_DK)
  ctx.fillStyle = grad
  ctx.fill()
  shieldPath(ctx, cx, cy, w * 0.86, h * 0.86)
  ctx.strokeStyle = SGA_CREAM
  ctx.lineWidth = Math.max(1.5, w * 0.012)
  ctx.stroke()

  // top emblem: a ball on a tee with a gold swoosh + a little flag
  const emY = cy - h * 0.26
  const ballR = w * 0.11
  // swoosh
  ctx.strokeStyle = SGA_GOLD
  ctx.lineWidth = w * 0.03
  ctx.lineCap = 'round'
  ctx.beginPath()
  ctx.moveTo(cx - w * 0.3, emY + w * 0.02)
  ctx.quadraticCurveTo(cx - w * 0.16, emY - w * 0.16, cx - w * 0.02, emY - w * 0.05)
  ctx.stroke()
  // tee
  ctx.strokeStyle = SGA_GOLD
  ctx.lineWidth = w * 0.05
  ctx.beginPath()
  ctx.moveTo(cx - w * 0.06, emY + ballR + w * 0.02)
  ctx.lineTo(cx - w * 0.06, emY + ballR + w * 0.12)
  ctx.stroke()
  // ball
  ctx.fillStyle = SGA_CREAM
  ctx.beginPath()
  ctx.arc(cx - w * 0.06, emY, ballR, 0, TAU)
  ctx.fill()
  // flag on the right
  ctx.strokeStyle = SGA_CREAM
  ctx.lineWidth = w * 0.02
  ctx.beginPath()
  ctx.moveTo(cx + w * 0.2, emY - w * 0.14)
  ctx.lineTo(cx + w * 0.2, emY + w * 0.14)
  ctx.stroke()
  ctx.fillStyle = SGA_GOLD
  ctx.beginPath()
  ctx.moveTo(cx + w * 0.2, emY - w * 0.14)
  ctx.lineTo(cx + w * 0.33, emY - w * 0.09)
  ctx.lineTo(cx + w * 0.2, emY - w * 0.04)
  ctx.closePath()
  ctx.fill()

  // SGA wordmark
  ctx.fillStyle = SGA_CREAM
  ctx.strokeStyle = SGA_GOLD
  ctx.lineWidth = w * 0.02
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.font = `900 ${w * 0.34}px "Arial Black", system-ui, sans-serif`
  ctx.fillText('SGA', cx, cy + h * 0.06)
  ctx.strokeText('SGA', cx, cy + h * 0.06)

  // laurel hint at the base
  ctx.strokeStyle = SGA_GOLD
  ctx.lineWidth = w * 0.015
  ctx.lineCap = 'round'
  for (const dir of [-1, 1]) {
    ctx.beginPath()
    ctx.moveTo(cx + dir * w * 0.06, cy + h * 0.3)
    ctx.quadraticCurveTo(cx + dir * w * 0.24, cy + h * 0.28, cx + dir * w * 0.28, cy + h * 0.16)
    ctx.stroke()
    for (let i = 0; i < 4; i++) {
      const tt = 0.3 + i * 0.16
      const lx = cx + dir * (w * 0.06 + (w * 0.22) * tt)
      const ly = cy + h * 0.3 - (h * 0.14) * tt * tt - h * 0.005
      ctx.beginPath()
      ctx.ellipse(lx, ly, w * 0.03, w * 0.014, dir * 0.6, 0, TAU)
      ctx.stroke()
    }
  }
  ctx.restore()
}
