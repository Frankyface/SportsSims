import { WORDMARK } from '../brand'

/** Draw the ESSPN wordmark centred at (cx, y). Shared by the match renderer and the standings card. */
export function drawWordmark(
  ctx: CanvasRenderingContext2D,
  cx: number,
  y: number,
  size = 40,
  accent = '#ff5566',
  base = '#e8edf4',
): void {
  ctx.textAlign = 'left'
  ctx.textBaseline = 'middle'
  ctx.font = `bold ${size}px system-ui, sans-serif`
  const widths = WORDMARK.map((p) => ctx.measureText(p[0]).width)
  const total = widths.reduce((s, w) => s + w, 0)
  let x = cx - total / 2
  for (let i = 0; i < WORDMARK.length; i++) {
    ctx.fillStyle = WORDMARK[i][1] ? accent : base
    ctx.fillText(WORDMARK[i][0], x, y)
    x += widths[i]
  }
}
