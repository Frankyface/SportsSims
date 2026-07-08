// Real club crests + the Crown League logo. Vite bundles these PNGs and gives us
// hashed same-origin URLs, so drawing them to canvas never taints it (keeping the
// WebCodecs export working). Images are preloaded once and cached; renderers call
// ensureLogosLoaded() before drawing.

import kingsbridge from '../assets/logos/kingsbridge.png'
import cobaltbay from '../assets/logos/cobaltbay.png'
import marlowe from '../assets/logos/marlowe.png'
import ironhaven from '../assets/logos/ironhaven.png'
import meridian from '../assets/logos/meridian.png'
import sundervale from '../assets/logos/sundervale.png'
import leagueLogo from '../assets/logos/league.png'

const LEAGUE_KEY = '__league'

const URLS: Record<string, string> = {
  KNG: kingsbridge,
  COB: cobaltbay,
  MAR: marlowe,
  IRN: ironhaven,
  MDN: meridian,
  SUN: sundervale,
  [LEAGUE_KEY]: leagueLogo,
}

const cache = new Map<string, HTMLImageElement>()
let loadPromise: Promise<void> | null = null

/** Load an image, resolving to null on error OR after a timeout — it must never hang the render/export. */
function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image()
    let settled = false
    const done = (val: HTMLImageElement | null) => {
      if (settled) return
      settled = true
      resolve(val)
    }
    img.onload = () => done(img)
    img.onerror = () => done(null)
    setTimeout(() => done(null), 12000)
    img.src = src
  })
}

/** Preload every logo once. Safe to call repeatedly. Never rejects (missing logos fall back to a colour chip). */
export function ensureLogosLoaded(): Promise<void> {
  if (!loadPromise) {
    loadPromise = Promise.all(
      Object.entries(URLS).map(async ([key, url]) => {
        const img = await loadImage(url)
        if (img) cache.set(key, img)
      }),
    ).then(() => undefined)
  }
  return loadPromise
}

export function getLogo(teamId: string): HTMLImageElement | undefined {
  return cache.get(teamId)
}
export function getLeagueLogo(): HTMLImageElement | undefined {
  return cache.get(LEAGUE_KEY)
}

/** The bundled URL for a team's crest (for use in <img> tags in the DOM). */
export function logoUrl(teamId: string): string | undefined {
  return URLS[teamId]
}
export const leagueLogoUrl = leagueLogo

/** Draw a (square) crest as a circular badge, cropping the baked-in background glow. */
export function drawLogoCircle(ctx: CanvasRenderingContext2D, img: HTMLImageElement, cx: number, cy: number, r: number): void {
  ctx.save()
  ctx.beginPath()
  ctx.arc(cx, cy, r, 0, Math.PI * 2)
  ctx.closePath()
  ctx.clip()
  ctx.drawImage(img, cx - r, cy - r, r * 2, r * 2)
  ctx.restore()
  ctx.beginPath()
  ctx.arc(cx, cy, r, 0, Math.PI * 2)
  ctx.lineWidth = Math.max(2, r * 0.035)
  ctx.strokeStyle = 'rgba(255,255,255,0.18)'
  ctx.stroke()
}

/** Draw a logo fit-contained (no crop) centred in a box — used for the transparent league mark. */
export function drawLogoContain(ctx: CanvasRenderingContext2D, img: HTMLImageElement, cx: number, cy: number, boxW: number, boxH: number): void {
  const scale = Math.min(boxW / img.width, boxH / img.height)
  const w = img.width * scale
  const h = img.height * scale
  ctx.drawImage(img, cx - w / 2, cy - h / 2, w, h)
}
