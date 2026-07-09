// Spike-only headless export harness.
//
// Proves a headless browser (Playwright/Chromium locally, GitHub Actions later)
// can run the app's own deterministic sim + WebCodecs export with no UI — the
// linchpin for hands-off Rung-4 auto-posting.
//
// CI-safe audio: renders a VIDEO-ONLY MP4 (H.264 always encodes) plus the
// soundtrack as a raw WAV (no codec). The runner captures both; the workflow
// uses ffmpeg to encode the WAV to AAC and mux it into the MP4 — because Linux
// CI Chromium has no AAC encoder.

import { simulateMatch } from '../sim/simulateMatch'
import { generateLeague } from '../ratings/teams'
import { toTeamRating } from '../ratings/strength'
import { exportMatchMp4, downloadBlob } from '../export/exportMp4'
import { buildRenderModel, RENDER_W, RENDER_H } from '../render/renderMatch'
import { buildMatchAudio, AUDIO_SR } from '../export/audio'
import { loadAudioAssets } from '../export/audioAssets'
import { pcmToWav } from './wav'

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
    // Video-only MP4 (audio added by ffmpeg in CI from the WAV below).
    const video = await exportMatchMp4(match, (p) => {
      window.__PROGRESS__ = p
    }, { audio: false })

    // The soundtrack as a raw WAV — no codec, so it works even where AAC can't encode.
    const model = buildRenderModel(match, RENDER_W, RENDER_H)
    const bank = await loadAudioAssets()
    const wav = pcmToWav(buildMatchAudio(model, bank), AUDIO_SR)

    window.__SIZE__ = video.size
    window.__SCORE__ = match.score
    downloadBlob(video, 'headless-export.mp4')
    downloadBlob(wav, 'headless-export.wav')
    window.__DONE__ = true
  } catch (err) {
    window.__ERROR__ = err instanceof Error ? `${err.message}\n${err.stack ?? ''}` : String(err)
    window.__DONE__ = true
  }
}

void main()
