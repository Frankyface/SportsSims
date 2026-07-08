// The bundled display face for every ESSPN graphic (league tables + team cards):
// Barlow Semi Condensed, weights 600/700/800, latin subset. Vite hashes the
// woff2s to same-origin URLs, so drawing text never taints the canvas (same
// guarantee the crest PNGs rely on for the WebCodecs MP4 export).
//
// ensureFontsLoaded() is awaited inside ensureLogosLoaded()/ensureRugbyLogosLoaded()
// so a PNG can never export in the fallback face. It NEVER rejects — a font that
// fails to load must not block a render; text simply falls back to the stack.

import semibold from '../assets/fonts/BarlowSemiCondensed-SemiBold.woff2'
import bold from '../assets/fonts/BarlowSemiCondensed-Bold.woff2'
import extrabold from '../assets/fonts/BarlowSemiCondensed-ExtraBold.woff2'

/** The family name to reference in ctx.font. */
export const FONT_FAMILY = 'Barlow Semi Condensed'
/** Full stack with graceful fallbacks (used in every ctx.font string). */
export const FONT_STACK = `'Barlow Semi Condensed', 'Oswald', system-ui, sans-serif`

const WEIGHTS: Array<[string, string]> = [
  ['600', semibold],
  ['700', bold],
  ['800', extrabold],
]

let loadPromise: Promise<void> | null = null

/**
 * Register + load the bundled weights once. Safe to call repeatedly and safe to
 * call in a non-browser (Node/Vitest) context — it no-ops when the FontFace API
 * isn't present. Resolves once the faces are ready (or immediately on any error).
 */
export function ensureFontsLoaded(): Promise<void> {
  if (loadPromise) return loadPromise
  loadPromise = (async () => {
    // No FontFace API (Node test env, or an old browser) → nothing to do; the
    // ctx.font fallback stack handles it.
    if (typeof document === 'undefined' || typeof FontFace === 'undefined') return
    try {
      await Promise.all(
        WEIGHTS.map(async ([weight, url]) => {
          const face = new FontFace(FONT_FAMILY, `url(${url}) format('woff2')`, {
            weight,
            style: 'normal',
          })
          const loaded = await face.load()
          ;(document as Document & { fonts: FontFaceSet }).fonts.add(loaded)
        }),
      )
    } catch {
      // Swallow — a missing font must never break an export.
    }
  })()
  return loadPromise
}
