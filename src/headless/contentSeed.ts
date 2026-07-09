// Headless content generator for the seed drop: Round 1 (Crown League) + Event 1
// (SGA Tour). Reuses the app's own export functions so output is genuine app
// content.
//
// Videos render VIDEO-ONLY + a WAV sidecar (CI has no AAC encoder). The workflow
// (finalize-reels.mjs) ffmpeg-muxes the audio AND appends the scoreboard image as
// a ~2.5s end-card, producing a single Reel per match/round. The golf preview is
// an image carousel. The manifest describes each post (account, order, kind, caption).
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
import {
  createGolfSeason,
  playNextGolfRound,
  golfSeasonComplete,
  golfRecordRoundResult,
  ROUNDS_PER_EVENT,
} from '../league/golfSeason'
import { eventById, golfCourseById } from '../ratings/golfCourses'
import { golfEventBrand } from '../content/golfEventPack'
import { buildGolfPreviewModel, golfPreviewSeed, exportGolfPreviewImages } from '../render/golfCoursePreview'
import { buildGolfRenderModel } from '../render/golfRenderMatch'
import { exportGolfRoundMp4 } from '../export/exportGolfMp4'
import { exportGolfLeaderboardPng } from '../render/golfLeaderboardCard'
import { buildGolfAmbientAudio } from '../export/golfAudio'
import { golfGroupVideoCaption, golfPreviewCaption } from '../content/golfCaptions'

/** A Reel = a video-only <video> + implicit <video>.wav + a <board> PNG flashed at
 * the end. A carousel = a list of image files. */
interface Post {
  account: 'soccer' | 'golf'
  order: number
  caption: string
  kind: 'reel' | 'carousel'
  video?: string
  board?: string
  images?: string[]
}

declare global {
  interface Window {
    __DONE__?: boolean
    __ERROR__?: string
    __MANIFEST__?: string
    __STAGE__?: string
  }
}

type Bank = Awaited<ReturnType<typeof loadAudioAssets>>
const SOCCER_SEED = 'crown-alpha'
const GOLF_SEED = 'sga-mrdklysr-2qbfer'

/** Soccer Round 1: 3 Reels — the match video ending with its progressive "as it stands" table. */
async function soccerRound1(bank: Bank): Promise<Post[]> {
  let state = createLeague(SOCCER_SEED, 'Crown League', 6, 'live-crown')
  const fixtures = state.fixtures
    .filter((f) => f.round === 0 && f.stage === 'regular')
    .sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true }))

  const posts: Post[] = []
  for (let i = 0; i < fixtures.length; i++) {
    const f = fixtures[i]
    window.__STAGE__ = `soccer match ${i + 1}/${fixtures.length}`
    const match = fixtureMatch(state, f.id)

    const video = await exportMatchMp4(match, undefined, { audio: false })
    const model = buildRenderModel(match, RENDER_W, RENDER_H)
    const wav = pcmToWav(buildMatchAudio(model, bank), AUDIO_SR)
    const vid = `soccer-r1-m${i + 1}`
    downloadBlob(video, `${vid}.mp4`)
    downloadBlob(wav, `${vid}.wav`)

    // Progressive standings AFTER only the matches posted so far → the end-card.
    state = playFixture(state, f.id)
    const board = `${vid}-table`
    downloadBlob(await exportStandingsPng(state, 'AS IT STANDS'), `${board}.png`)

    posts.push({
      account: 'soccer',
      order: i + 1,
      kind: 'reel',
      caption: matchCaption(state, f, state.results[f.id]!),
      video: `${vid}.mp4`,
      board: `${board}.png`,
    })
  }
  return posts
}

/** Golf Event 1: the preview carousel, then each round's two group Reels (video ending
 * with that round's whole-field leaderboard). */
async function golfEvent1(bank: Bank): Promise<Post[]> {
  let state = createGolfSeason(GOLF_SEED, 'SGA Tour', 'live-sga')
  const eventId = state.current.eventId
  const eventIndex = state.current.eventIndex
  const season = state.season
  const event = eventById(eventId)
  const course = golfCourseById(event.courseId)
  const brand = golfEventBrand(eventId)

  window.__STAGE__ = 'golf preview carousel'
  const previewModel = buildGolfPreviewModel(brand, course, golfPreviewSeed(state.seedKey, season, eventIndex))
  const previewImgs = await exportGolfPreviewImages(previewModel)
  const images: string[] = []
  for (let i = 0; i < previewImgs.length; i++) {
    const file = `golf-e1-preview-${String(i).padStart(2, '0')}.png`
    downloadBlob(previewImgs[i].blob, file)
    images.push(file)
  }
  const posts: Post[] = [{ account: 'golf', order: 1, kind: 'carousel', caption: golfPreviewCaption(eventId), images }]

  while (state.completed.length === 0 && !golfSeasonComplete(state)) {
    state = playNextGolfRound(state).state
  }
  const record = state.completed[0]

  let order = 2
  for (let round = 1; round <= ROUNDS_PER_EVENT; round++) {
    window.__STAGE__ = `golf round ${round}`
    const board = `golf-e1-r${round}-lb.png`
    downloadBlob(
      await exportGolfLeaderboardPng({
        event,
        season: record.season,
        field: record.field,
        toParByRound: record.toParByRound.slice(0, round),
      }),
      board,
    )

    const result = golfRecordRoundResult(state, record, round)
    for (const group of [0, 1] as const) {
      const model = buildGolfRenderModel(result, group, brand, course.name)
      const video = await exportGolfRoundMp4(model, undefined, { audio: false })
      const wav = pcmToWav(buildGolfAmbientAudio(model.plan.total, bank, model.seed >>> 0), AUDIO_SR)
      const vid = `golf-e1-r${round}-g${group + 1}`
      downloadBlob(video, `${vid}.mp4`)
      downloadBlob(wav, `${vid}.wav`)
      posts.push({
        account: 'golf',
        order: order++,
        kind: 'reel',
        caption: golfGroupVideoCaption(state, record, round, group),
        video: `${vid}.mp4`,
        board,
      })
    }
  }
  return posts
}

async function main(): Promise<void> {
  try {
    const bank = await loadAudioAssets()
    const posts: Post[] = []
    posts.push(...(await soccerRound1(bank)))
    posts.push(...(await golfEvent1(bank)))
    window.__MANIFEST__ = JSON.stringify({ posts }, null, 2)
    window.__STAGE__ = 'done'
    window.__DONE__ = true
  } catch (err) {
    window.__ERROR__ = err instanceof Error ? `${err.message}\n${err.stack ?? ''}` : String(err)
    window.__DONE__ = true
  }
}

void main()
