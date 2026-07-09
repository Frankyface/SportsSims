// Headless content generator for the seed drop: Round 1 (Crown League) + Event 1
// (SGA Tour). Reuses the app's own export functions so output is genuine app
// content. Videos are rendered VIDEO-ONLY + a WAV sidecar (CI has no AAC
// encoder); the workflow ffmpeg-muxes each pair. Everything is downloaded by the
// runner; a manifest describes the posts (account, order, carousel items, caption).
//
// Locked season seeds: soccer crown-alpha, golf sga-mrdklysr-2qbfer.

import { createLeague, playFixture, fixtureMatch } from '../league/league'
import { exportMatchMp4, downloadBlob } from '../export/exportMp4'
import { exportStandingsPng } from '../render/standingsCard'
import { matchCaption } from '../content/captions'
import { buildRenderModel, RENDER_W, RENDER_H } from '../render/renderMatch'
import { buildMatchAudio, AUDIO_SR } from '../export/audio'
import { loadAudioAssets } from '../export/audioAssets'
import { pcmToWav } from './wav'

interface PostItem {
  file: string
  type: 'video' | 'image'
}
interface Post {
  account: 'soccer' | 'golf'
  order: number
  caption: string
  items: PostItem[]
}

declare global {
  interface Window {
    __DONE__?: boolean
    __ERROR__?: string
    __MANIFEST__?: string
    __PROGRESS__?: string
  }
}

const SOCCER_SEED = 'crown-alpha'

/** Soccer Round 1: 3 match posts, each carousel = [match video + progressive "as it stands" table]. */
async function soccerRound1(bank: Awaited<ReturnType<typeof loadAudioAssets>>): Promise<Post[]> {
  let state = createLeague(SOCCER_SEED, 'Crown League', 6, 'live-crown')
  const fixtures = state.fixtures
    .filter((f) => f.round === 0 && f.stage === 'regular')
    .sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true }))

  const posts: Post[] = []
  for (let i = 0; i < fixtures.length; i++) {
    const f = fixtures[i]
    window.__PROGRESS__ = `soccer match ${i + 1}/${fixtures.length}`
    const match = fixtureMatch(state, f.id)

    // Match video: video-only MP4 + a WAV sidecar (ffmpeg adds AAC in CI).
    const video = await exportMatchMp4(match, undefined, { audio: false })
    const model = buildRenderModel(match, RENDER_W, RENDER_H)
    const wav = pcmToWav(buildMatchAudio(model, bank), AUDIO_SR)
    const vid = `soccer-r1-m${i + 1}`
    downloadBlob(video, `${vid}.mp4`)
    downloadBlob(wav, `${vid}.wav`)

    // Progressive "as it stands" table: standings AFTER only the matches posted so far.
    state = playFixture(state, f.id)
    const tablePng = await exportStandingsPng(state, 'AS IT STANDS')
    const table = `soccer-r1-m${i + 1}-table`
    downloadBlob(tablePng, `${table}.png`)

    posts.push({
      account: 'soccer',
      order: i + 1,
      caption: matchCaption(state, f, state.results[f.id]!),
      items: [
        { file: `${vid}.mp4`, type: 'video' },
        { file: `${table}.png`, type: 'image' },
      ],
    })
  }
  return posts
}

async function main(): Promise<void> {
  try {
    const bank = await loadAudioAssets()
    const posts: Post[] = []
    posts.push(...(await soccerRound1(bank)))
    // golf event 1 appended in the next build stage
    window.__MANIFEST__ = JSON.stringify({ posts }, null, 2)
    window.__PROGRESS__ = 'done'
    window.__DONE__ = true
  } catch (err) {
    window.__ERROR__ = err instanceof Error ? `${err.message}\n${err.stack ?? ''}` : String(err)
    window.__DONE__ = true
  }
}

void main()
