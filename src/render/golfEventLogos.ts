// Per-event crests for golf graphics. Each SGA event can ship a real logo PNG
// (the majors have bespoke marks); everything else falls back to the drawn SGA
// tour crest. Same-origin static assets under public/logos/<eventId>.png, loaded
// lazily at RUNTIME and cached, so a missing file simply uses the fallback
// instead of breaking the build. Mirrors golfBrand's ensureSgaLogo, but keyed by
// event id and shared across every event.
//
// Drop artwork at e.g. public/logos/pinnacle-championship.png and it appears on
// that event's course-preview title card and round intro automatically.

import { drawSgaMark } from './golfBrand'

type Ctx = CanvasRenderingContext2D

const cache = new Map<string, HTMLImageElement | null>()
const loading = new Map<string, Promise<void>>()

function logoUrl(eventId: string): string {
  return `${import.meta.env.BASE_URL}logos/${eventId}.png`
}

/** Public URL for an event's crest PNG — for HTML `<img>` use (the DOM UI), as
 * opposed to the canvas `drawEventLogo`. A missing file just 404s; callers
 * should fall back on the image's error event. */
export function golfEventLogoUrl(eventId: string): string {
  return logoUrl(eventId)
}

/** Try to load one event's crest once. Never rejects — a miss caches `null` so
 * the drawn-crest fallback is used and we don't re-request it. */
export function ensureEventLogo(eventId: string): Promise<void> {
  if (cache.has(eventId)) return Promise.resolve()
  const existing = loading.get(eventId)
  if (existing) return existing
  const p = new Promise<void>((resolve) => {
    const img = new Image()
    let settled = false
    const done = (ok: boolean): void => {
      if (settled) return
      settled = true
      cache.set(eventId, ok ? img : null)
      resolve()
    }
    img.onload = () => done(true)
    img.onerror = () => done(false)
    setTimeout(() => done(false), 10000)
    img.src = logoUrl(eventId)
  })
  loading.set(eventId, p)
  return p
}

export function getEventLogo(eventId: string): HTMLImageElement | null {
  return cache.get(eventId) ?? null
}

/** Draw an event's crest centred in a `size`-wide box: the real PNG if loaded,
 * otherwise the drawn SGA tour mark. */
export function drawEventLogo(ctx: Ctx, eventId: string, cx: number, cy: number, size: number): void {
  const img = getEventLogo(eventId)
  if (img && img.width > 0 && img.height > 0) {
    const scale = Math.min(size / img.width, size / img.height)
    const w = img.width * scale
    const h = img.height * scale
    ctx.drawImage(img, cx - w / 2, cy - h / 2, w, h)
    return
  }
  drawSgaMark(ctx, cx, cy, size)
}
