// Headless generator for the hands-off DAILY cadence. Unlike contentSeed.ts (which
// dumps the whole Round 1 + Event 1 seed), this renders ONLY the posts for one
// calendar day per account, driven by ?soccerDay=&golfDay= query params. The
// day→content mapping lives in dailyCalendar.ts (pure + unit-tested); this module
// just renders what the calendar says, reusing the app's own export functions.
//
// Videos render VIDEO-ONLY + a WAV sidecar (CI has no AAC encoder); finalize-reels
// muxes audio + appends the scoreboard end-card. Emits a manifest with the posts
// AND the advanced cursor for the workflow to persist.
//
// Locked season seeds: soccer crown-alpha, golf sga-mrdklysr-2qbfer.

import { createLeague, playFixture, fixtureMatch, fixtureById, startPlayoffs, advancePlayoffs } from '../league/league'
import type { Fixture, LeagueState } from '../league/types'
import { exportMatchMp4, downloadBlob } from '../export/exportMp4'
import { exportStandingsPng } from '../render/standingsCard'
import { matchCaption, standingsCaption } from '../content/captions'
import { buildRenderModel, RENDER_W, RENDER_H } from '../render/renderMatch'
import { buildMatchAudio, AUDIO_SR } from '../export/audio'
import { loadAudioAssets } from '../export/audioAssets'
import { pcmToWav } from './wav'
import {
  createGolfSeason,
  playNextGolfRound,
  golfSeasonComplete,
  golfRecordRoundResult,
} from '../league/golfSeason'
import { eventById, golfCourseById } from '../ratings/golfCourses'
import { golfEventBrand } from '../content/golfEventPack'
import { buildGolfPreviewModel, golfPreviewSeed, exportGolfPreviewImages } from '../render/golfCoursePreview'
import { buildGolfRenderModel } from '../render/golfRenderMatch'
import { exportGolfRoundMp4 } from '../export/exportGolfMp4'
import { exportGolfLeaderboardPng } from '../render/golfLeaderboardCard'
import { buildGolfAmbientAudio } from '../export/golfAudio'
import { golfGroupVideoCaption, golfPreviewCaption } from '../content/golfCaptions'
import {
  soccerPlanForDay,
  golfPlanForDay,
  nextSoccerDay,
  nextGolfDay,
  SOCCER_REGULAR_MATCHES,
} from './dailyCalendar'

/** reel = video-only <video> + <video>.wav + a <board> PNG end-card.
 *  photo = a single <image>. carousel = a list of <images>. */
interface Post {
  account: 'soccer' | 'golf'
  order: number
  caption: string
  kind: 'reel' | 'photo' | 'carousel'
  video?: string
  board?: string
  image?: string
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

/** Regular-season fixtures in play order: round, then numeric id. */
function orderedRegularFixtures(state: LeagueState): Fixture[] {
  return state.fixtures
    .filter((f) => f.stage === 'regular')
    .sort((a, b) => a.round - b.round || a.id.localeCompare(b.id, undefined, { numeric: true }))
}

/** Render one match into a reel: video + wav sidecar + a standings end-card. */
async function renderMatchReel(
  bank: Bank,
  state: LeagueState,
  f: Fixture,
  vid: string,
  boardState: LeagueState,
  boardTitle: string,
): Promise<{ video: string; board: string }> {
  const match = fixtureMatch(state, f.id)
  const video = await exportMatchMp4(match, undefined, { audio: false })
  const model = buildRenderModel(match, RENDER_W, RENDER_H)
  const wav = pcmToWav(buildMatchAudio(model, bank), AUDIO_SR)
  downloadBlob(video, `${vid}.mp4`)
  downloadBlob(wav, `${vid}.wav`)
  const board = `${vid}-table`
  downloadBlob(await exportStandingsPng(boardState, boardTitle), `${board}.png`)
  return { video: `${vid}.mp4`, board: `${board}.png` }
}

/** Soccer posts for one day (a match Reel, optionally preceded by the previous
 * round's full table; or a playoff match Reel with the final regular table). */
async function soccerPostsForDay(bank: Bank, day: number): Promise<Post[]> {
  const plan = soccerPlanForDay(day)
  if (plan.kind === 'none') return []

  let state = createLeague(SOCCER_SEED, 'Crown League', 6, 'live-crown')
  const fixtures = orderedRegularFixtures(state)
  const posts: Post[] = []
  let order = 1

  if (plan.kind === 'match') {
    // Advance through everything before today's match.
    for (let i = 0; i < plan.matchIndex; i++) state = playFixture(state, fixtures[i].id)

    // Round-opener: the previous round's completed FULL table (state is exactly at
    // the end of that round now) as a standalone photo, posted first.
    if (plan.roundTable !== null) {
      const label = `Round ${plan.roundTable + 1}`
      const img = `soccer-d${day}-r${plan.roundTable + 1}-table`
      window.__STAGE__ = `soccer ${label} table`
      downloadBlob(await exportStandingsPng(state, `${label.toUpperCase()} · FINAL TABLE`), `${img}.png`)
      posts.push({ account: 'soccer', order: order++, kind: 'photo', caption: standingsCaption(state, label), image: `${img}.png` })
    }

    // The match Reel, ending with the progressive "as it stands" table.
    const f = fixtures[plan.matchIndex]
    window.__STAGE__ = `soccer match (day ${day})`
    const stateBefore = state
    const played = playFixture(state, f.id)
    const parts = await renderMatchReel(bank, stateBefore, f, `soccer-d${day}-match`, played, 'AS IT STANDS')
    posts.push({ account: 'soccer', order: order++, kind: 'reel', caption: matchCaption(played, f, played.results[f.id]!), ...parts })
    return posts
  }

  // Playoffs: sim the whole regular season, then advance to the target fixture.
  for (const f of fixtures) state = playFixture(state, f.id)
  const regState = state // computeStandings only counts 'regular', so this stays the final table
  const regImg = `soccer-d${day}-final-table`
  if (plan.finalRegTable) {
    window.__STAGE__ = 'soccer final regular table'
    downloadBlob(await exportStandingsPng(regState, 'FINAL TABLE'), `${regImg}.png`)
    posts.push({ account: 'soccer', order: order++, kind: 'photo', caption: standingsCaption(regState, 'Final table'), image: `${regImg}.png` })
  }

  state = startPlayoffs(state)
  if (plan.fixture !== 'sf1') state = playFixture(state, 'sf1')
  if (plan.fixture === 'final') {
    state = playFixture(state, 'sf2')
    state = advancePlayoffs(state)
  }

  const f = fixtureById(state, plan.fixture)
  window.__STAGE__ = `soccer ${plan.fixture}`
  const stateBefore = state
  const played = playFixture(state, plan.fixture)
  // Playoff reels use the final regular table as the end-card context.
  const parts = await renderMatchReel(bank, stateBefore, f, `soccer-d${day}-${plan.fixture}`, regState, 'FINAL TABLE')
  posts.push({ account: 'soccer', order: order++, kind: 'reel', caption: matchCaption(played, f, played.results[plan.fixture]!), ...parts })
  return posts
}

/** Golf posts for one day (the preview carousel, or one round's two group Reels). */
async function golfPostsForDay(bank: Bank, day: number): Promise<Post[]> {
  const plan = golfPlanForDay(day)
  if (plan.kind === 'none') return []

  let state = createGolfSeason(GOLF_SEED, 'SGA Tour', 'live-sga')
  // Sim (no render) until the target event is completed so we hold its frozen record.
  while (state.completed.length <= plan.eventIndex && !golfSeasonComplete(state)) {
    state = playNextGolfRound(state).state
  }
  const record = state.completed[plan.eventIndex]
  if (!record) return [] // season shorter than expected — nothing to post
  const event = eventById(record.eventId)
  const course = golfCourseById(event.courseId)
  const brand = golfEventBrand(record.eventId)

  if (plan.kind === 'preview') {
    window.__STAGE__ = `golf preview (event ${plan.eventIndex + 1})`
    const previewModel = buildGolfPreviewModel(brand, course, golfPreviewSeed(state.seedKey, record.season, record.eventIndex))
    const previewImgs = await exportGolfPreviewImages(previewModel)
    const images: string[] = []
    for (let i = 0; i < previewImgs.length; i++) {
      const file = `golf-d${day}-preview-${String(i).padStart(2, '0')}.png`
      downloadBlob(previewImgs[i].blob, file)
      images.push(file)
    }
    return [{ account: 'golf', order: 1, kind: 'carousel', caption: golfPreviewCaption(record.eventId), images }]
  }

  // A round day: both groups, sharing that round's whole-field leaderboard end-card.
  const round = plan.round
  window.__STAGE__ = `golf event ${plan.eventIndex + 1} round ${round}`
  const board = `golf-d${day}-lb.png`
  downloadBlob(
    await exportGolfLeaderboardPng({ event, season: record.season, field: record.field, toParByRound: record.toParByRound.slice(0, round) }),
    board,
  )
  const result = golfRecordRoundResult(state, record, round)
  const posts: Post[] = []
  let order = 1
  for (const group of [0, 1] as const) {
    const model = buildGolfRenderModel(result, group, brand, course.name)
    const video = await exportGolfRoundMp4(model, undefined, { audio: false })
    const wav = pcmToWav(buildGolfAmbientAudio(model.plan.total, bank, model.seed >>> 0), AUDIO_SR)
    const vid = `golf-d${day}-r${round}-g${group + 1}`
    downloadBlob(video, `${vid}.mp4`)
    downloadBlob(wav, `${vid}.wav`)
    posts.push({ account: 'golf', order: order++, kind: 'reel', caption: golfGroupVideoCaption(state, record, round, group), video: `${vid}.mp4`, board })
  }
  return posts
}

async function main(): Promise<void> {
  try {
    const params = new URLSearchParams(location.search)
    const soccerDay = Number.parseInt(params.get('soccerDay') ?? '-1', 10)
    const golfDay = Number.parseInt(params.get('golfDay') ?? '-1', 10)
    void SOCCER_REGULAR_MATCHES // (documented constant; calendar owns the mapping)

    const bank = await loadAudioAssets()
    const posts: Post[] = []
    posts.push(...(await soccerPostsForDay(bank, soccerDay)))
    posts.push(...(await golfPostsForDay(bank, golfDay)))

    const cursor = { soccer: nextSoccerDay(soccerDay), golf: nextGolfDay(golfDay) }
    window.__MANIFEST__ = JSON.stringify({ posts, cursor }, null, 2)
    window.__STAGE__ = 'done'
    window.__DONE__ = true
  } catch (err) {
    window.__ERROR__ = err instanceof Error ? `${err.message}\n${err.stack ?? ''}` : String(err)
    window.__DONE__ = true
  }
}

void main()
