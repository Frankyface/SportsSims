// Rugby club crests + the Bastion Championships logo. Kept SEPARATE from the
// football logos (logos.ts) so the soccer render/export path never loads rugby
// assets, and vice-versa. Same approach: Vite hashes these PNGs to same-origin
// URLs (canvas stays untainted → WebCodecs export keeps working); preload once,
// cache, and fall back to a colour chip when a crest is missing.
//
// Keyed by rugby club id (see ratings/rugbyTeams.ts). All six clubs now have a
// crest; a missing crest still falls back to the colour-chip badge in the UI.

import thornbury from '../assets/logos/thornbury.png'
import highmoor from '../assets/logos/highmoor.png'
import saltcombe from '../assets/logos/saltcombe.png'
import ravensworth from '../assets/logos/ravensworth.png'
import duncarrow from '../assets/logos/duncarrow.png'
import wrenshire from '../assets/logos/wrenshire.png'
import bastion from '../assets/logos/bastion.png'

const BASTION_KEY = '__bastion'

const URLS: Record<string, string> = {
  THB: thornbury,
  HGH: highmoor,
  SLC: saltcombe,
  RVN: ravensworth,
  DNC: duncarrow,
  WRN: wrenshire,
  [BASTION_KEY]: bastion,
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

/** Preload every rugby crest once. Safe to call repeatedly. Never rejects. */
export function ensureRugbyLogosLoaded(): Promise<void> {
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

export function getRugbyLogo(clubId: string): HTMLImageElement | undefined {
  return cache.get(clubId)
}
export function getBastionLogo(): HTMLImageElement | undefined {
  return cache.get(BASTION_KEY)
}

/** The bundled URL for a rugby club's crest (for <img> tags in the DOM). */
export function rugbyLogoUrl(clubId: string): string | undefined {
  return URLS[clubId]
}
export const bastionLogoUrl = bastion
