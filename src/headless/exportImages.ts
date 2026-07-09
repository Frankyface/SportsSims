// Spike/dev-only headless image generator for the first test posts.
//
// Produces the real app graphics we want to publish:
//   • the 6 Crown League club cards (buildSoccerClubCards) — each with its caption
//   • one golf "HOLE 1" course-preview still (exportGolfPreviewImage)
// and exposes them as base64 PNGs on window for the Playwright runner to save.
//
// NOT part of the shipped app bundle. Mirrors the same functions the app UI uses,
// so the output is genuine app output.

import { buildSoccerClubCards } from '../content/clubCardsPack'
import { createGolfSeason } from '../league/golfSeason'
import { eventById, golfCourseById } from '../ratings/golfCourses'
import { golfEventBrand } from '../content/golfEventPack'
import {
  buildGolfPreviewModel,
  golfPreviewSeed,
  exportGolfPreviewImage,
} from '../render/golfCoursePreview'

interface OutImage {
  account: 'soccer' | 'golf'
  name: string
  caption: string
  b64: string
}

declare global {
  interface Window {
    __DONE__?: boolean
    __ERROR__?: string
    __IMAGES__?: OutImage[]
  }
}

async function blobToB64(blob: Blob): Promise<string> {
  const bytes = new Uint8Array(await blob.arrayBuffer())
  let bin = ''
  const CH = 0x8000
  for (let i = 0; i < bytes.length; i += CH) {
    bin += String.fromCharCode(...bytes.subarray(i, i + CH))
  }
  return btoa(bin)
}

async function main(): Promise<void> {
  try {
    const out: OutImage[] = []

    // --- Soccer: the 6 Crown League club cards, each with its own caption ---
    const cards = await buildSoccerClubCards()
    for (const c of cards) {
      out.push({
        account: 'soccer',
        name: c.file.replace(/\.png$/i, ''),
        caption: c.caption,
        b64: await blobToB64(c.blob),
      })
    }

    // --- Golf: one course-preview hole (HOLE 1) of a fresh season's first event ---
    const HOLE = 1
    const season = createGolfSeason('sga-preview-test', 'SGA Tour')
    const ev = eventById(season.current.eventId)
    const course = golfCourseById(ev.courseId)
    const brand = golfEventBrand(season.current.eventId)
    const seed = golfPreviewSeed(season.seedKey, season.season, season.current.eventIndex)
    const model = buildGolfPreviewModel(brand, course, seed)
    const golfBlob = await exportGolfPreviewImage(model, HOLE)
    const golfCaption = [
      `⛳ HOLE ${HOLE} — ${course.name}`,
      brand.name,
      '',
      'Course preview — a first look before the SGA Tour tees off.',
      '#SGATour #SimGolf',
    ].join('\n')
    out.push({ account: 'golf', name: `sga-preview-hole-${HOLE}`, caption: golfCaption, b64: await blobToB64(golfBlob) })

    window.__IMAGES__ = out
    window.__DONE__ = true
  } catch (err) {
    window.__ERROR__ = err instanceof Error ? `${err.message}\n${err.stack ?? ''}` : String(err)
    window.__DONE__ = true
  }
}

void main()
