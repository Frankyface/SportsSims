// Spike-only headless export harness.
//
// Purpose: prove a headless browser (Playwright/Chromium locally, GitHub Actions
// later) can run the app's *own* deterministic sim + WebCodecs MP4 export with no
// UI and no clicks — the technical linchpin for hands-off Rung-4 auto-posting.
//
// This is dev tooling, NOT part of the shipped app bundle. It mirrors the exact
// single-match recipe used by FriendlyTab so the output is real app output.
//
// A Playwright runner (scripts/headless-export.mjs) loads /headless.html, waits for
// window.__DONE__, and captures the browser download the harness triggers.

import { simulateMatch } from '../sim/simulateMatch'
import { generateLeague } from '../ratings/teams'
import { toTeamRating } from '../ratings/strength'
import { exportMatchMp4, downloadBlob } from '../export/exportMp4'

declare global {
  interface Window {
    __DONE__?: boolean
    __ERROR__?: string
    __PROGRESS__?: number
    __SIZE__?: number
    __SCORE__?: [number, number]
    __HAS_WEBCODECS__?: boolean
  }
}

async function main(): Promise<void> {
  window.__HAS_WEBCODECS__ = typeof VideoEncoder !== 'undefined'
  try {
    // Same recipe as FriendlyTab: a fresh 6-team pool, pick two, sim one match.
    const teams = generateLeague('friendly-pool', 6)
    const home = teams[0]
    const away = teams[3]
    const match = simulateMatch({
      seedKey: `headless:${home.identity.id}:${away.identity.id}:1`,
      home: toTeamRating(home.identity, home.glicko),
      away: toTeamRating(away.identity, away.glicko),
      homeAdvantage: 1.1,
    })

    window.__PROGRESS__ = 0
    const blob = await exportMatchMp4(match, (p) => {
      window.__PROGRESS__ = p
    })

    window.__SIZE__ = blob.size
    window.__SCORE__ = match.score
    // Trigger a browser download; the Playwright runner captures it to disk.
    downloadBlob(blob, 'headless-export.mp4')
    window.__DONE__ = true
  } catch (err) {
    window.__ERROR__ = err instanceof Error ? `${err.message}\n${err.stack ?? ''}` : String(err)
    window.__DONE__ = true
  }
}

void main()
