// Headless generator for the hands-off DAILY cadence. Renders ONLY the posts for
// one calendar day per account, driven by ?soccerDay=&golfDay= query params. The
// day→content mapping lives in dailyCalendar.ts (pure + unit-tested); this module
// just renders what the calendar says, reusing the app's own export functions.
//
// ?catchup=1 instead renders the one-off seed-drop gap posts (soccer R1 table,
// golf E1 results carousel, golf E2 course preview) and leaves the cursor as-is.
//
// Videos render VIDEO-ONLY + a WAV sidecar (CI has no AAC encoder); finalize-reels
// muxes audio + appends the scoreboard end-card. Emits a manifest with the posts
// AND the advanced cursor for the workflow to persist.
//
// Locked season seeds: soccer crown-alpha, golf sga-mrdklysr-2qbfer.

import {
  createLeague,
  playFixture,
  fixtureMatch,
  fixtureById,
  startPlayoffs,
  advancePlayoffs,
} from '../league/league'
import type { Fixture, LeagueState } from '../league/types'
import { exportMatchMp4, downloadBlob } from '../export/exportMp4'
import { exportStandingsPng } from '../render/standingsCard'
import {
  exportPlayoffsPreviewPng,
  exportFinalsPreviewPng,
  exportChampionsPng,
} from '../render/soccerSeasonCards'
import {
  matchCaption,
  standingsCaption,
  playoffsPreviewCaption,
  finalsPreviewCaption,
  championsCaption,
} from '../content/captions'
import { buildRenderModel, RENDER_W, RENDER_H } from '../render/renderMatch'
import { buildMatchAudio, AUDIO_SR } from '../export/audio'
import { loadAudioAssets } from '../export/audioAssets'
import { pcmToWav } from './wav'
import {
  createGolfSeason,
  playNextGolfRound,
  golfSeasonComplete,
  golfRecordRoundResult,
  type GolfSeasonState,
  type GolfEventRecord,
} from '../league/golfSeason'
import { eventById, golfCourseById, seasonSchedule } from '../ratings/golfCourses'
import { golfEventBrand } from '../content/golfEventPack'
import {
  buildGolfPreviewModel,
  golfPreviewSeed,
  exportGolfPreviewImages,
  exportGolfPreviewImage,
} from '../render/golfCoursePreview'
import { buildGolfRenderModel } from '../render/golfRenderMatch'
import { exportGolfRoundMp4 } from '../export/exportGolfMp4'
import { exportGolfLeaderboardPng } from '../render/golfLeaderboardCard'
import { exportGolfRankingsPng } from '../render/golfRankingsCard'
import { exportGolfChampionPng } from '../render/golfChampionCard'
import { buildGolfAmbientAudio } from '../export/golfAudio'
import {
  golfGroupVideoCaption,
  golfPreviewCaption,
  golfResultsCaption,
  golfChampionsCaption,
} from '../content/golfCaptions'
import { soccerPlanForDay, golfPlanForDay, nextSoccerDay, nextGolfDay } from './dailyCalendar'

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
    /** Exposed by the Playwright runner: append a base64 chunk to a file
     * (truncating on the first chunk). Bypasses browser downloads entirely —
     * Chromium's automatic-download limiter silently drops rapid download
     * bursts past ~10, which loses trailing carousel images. */
    __SAVE_CHUNK__?: (filename: string, b64: string, isFirst: boolean) => Promise<void>
  }
}

type Bank = Awaited<ReturnType<typeof loadAudioAssets>>
const SOCCER_SEED = 'crown-alpha'
const GOLF_SEED = 'sga-mrdklysr-2qbfer'

const SAVE_CHUNK_BYTES = 8 * 1024 * 1024

/** Save a blob to the runner's out dir (via the runner binding), falling back to
 * a browser download when run outside the harness. */
async function saveBlob(blob: Blob, filename: string): Promise<void> {
  const saveChunk = window.__SAVE_CHUNK__
  if (!saveChunk) {
    downloadBlob(blob, filename)
    return
  }
  for (let off = 0; off < blob.size; off += SAVE_CHUNK_BYTES) {
    const bytes = new Uint8Array(await blob.slice(off, off + SAVE_CHUNK_BYTES).arrayBuffer())
    let bin = ''
    for (let i = 0; i < bytes.length; i += 0x8000) {
      bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
    }
    await saveChunk(filename, btoa(bin), off === 0)
  }
}

// ---------- soccer ------------------------------------------------------------

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
  await saveBlob(video, `${vid}.mp4`)
  await saveBlob(wav, `${vid}.wav`)
  const board = `${vid}-table`
  await saveBlob(await exportStandingsPng(boardState, boardTitle), `${board}.png`)
  return { video: `${vid}.mp4`, board: `${board}.png` }
}

/** Soccer posts for one day, in posting order (reel first, companions after). */
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

    // The match Reel, ending with the progressive "as it stands" table.
    const f = fixtures[plan.matchIndex]
    window.__STAGE__ = `soccer match (day ${day})`
    const stateBefore = state
    const played = playFixture(state, f.id)
    const parts = await renderMatchReel(bank, stateBefore, f, `soccer-d${day}-match`, played, 'AS IT STANDS')
    posts.push({ account: 'soccer', order: order++, kind: 'reel', caption: matchCaption(played, f, played.results[f.id]!), ...parts })

    // Round-closer: the round's completed FULL table, after the match.
    if (plan.roundTable !== null) {
      const label = `Round ${plan.roundTable + 1}`
      const img = `soccer-d${day}-r${plan.roundTable + 1}-table`
      window.__STAGE__ = `soccer ${label} table`
      await saveBlob(await exportStandingsPng(played, `${label.toUpperCase()} · FINAL TABLE`), `${img}.png`)
      posts.push({ account: 'soccer', order: order++, kind: 'photo', caption: standingsCaption(played, label), image: `${img}.png` })
    }

    // Season's last regular match: the playoffs bracket, after the table.
    if (plan.playoffsPreview) {
      const img = `soccer-d${day}-playoffs`
      window.__STAGE__ = 'soccer playoffs preview'
      await saveBlob(await exportPlayoffsPreviewPng(played), `${img}.png`)
      posts.push({ account: 'soccer', order: order++, kind: 'photo', caption: playoffsPreviewCaption(played), image: `${img}.png` })
    }
    return posts
  }

  // Playoffs / champions: sim the whole regular season first.
  for (const f of fixtures) state = playFixture(state, f.id)
  const regState = state // computeStandings only counts 'regular' fixtures
  state = startPlayoffs(state)

  if (plan.kind === 'playoff') {
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

    // After sf2: the finals matchup card.
    if (plan.finalsPreview) {
      const img = `soccer-d${day}-finals`
      window.__STAGE__ = 'soccer finals preview'
      await saveBlob(await exportFinalsPreviewPng(played), `${img}.png`)
      posts.push({ account: 'soccer', order: order++, kind: 'photo', caption: finalsPreviewCaption(played), image: `${img}.png` })
    }
    return posts
  }

  // Champions carousel (day after the final): champions card + the final table.
  state = playFixture(state, 'sf1')
  state = playFixture(state, 'sf2')
  state = advancePlayoffs(state)
  state = playFixture(state, 'final')
  window.__STAGE__ = 'soccer champions'
  const champImg = `soccer-d${day}-champions.png`
  const tableImg = `soccer-d${day}-final-table.png`
  await saveBlob(await exportChampionsPng(state), champImg)
  await saveBlob(await exportStandingsPng(regState, 'FINAL TABLE'), tableImg)
  posts.push({ account: 'soccer', order: 1, kind: 'carousel', caption: championsCaption(state), images: [champImg, tableImg] })
  return posts
}

// ---------- golf --------------------------------------------------------------

/** Sim (no render) until `eventIndex` is completed; returns its frozen record. */
function golfStateThroughEvent(eventIndex: number): { state: GolfSeasonState; record: GolfEventRecord | undefined } {
  let state = createGolfSeason(GOLF_SEED, 'SGA Tour', 'live-sga')
  while (state.completed.length <= eventIndex && !golfSeasonComplete(state)) {
    state = playNextGolfRound(state).state
  }
  return { state, record: state.completed[eventIndex] }
}

/** The 10-image course-preview carousel for an event (by schedule position). */
async function golfPreviewPosts(state: GolfSeasonState, eventIndex: number, day: number, order: number): Promise<Post> {
  const eventId = seasonSchedule(state.seedKey, state.season)[eventIndex]
  const course = golfCourseById(eventById(eventId).courseId)
  const brand = golfEventBrand(eventId)
  window.__STAGE__ = `golf preview (event ${eventIndex + 1})`
  const model = buildGolfPreviewModel(brand, course, golfPreviewSeed(state.seedKey, state.season, eventIndex))
  const imgs = await exportGolfPreviewImages(model)
  const images: string[] = []
  for (let i = 0; i < imgs.length; i++) {
    const file = `golf-d${day}-e${eventIndex + 1}-preview-${String(i).padStart(2, '0')}.png`
    await saveBlob(imgs[i].blob, file)
    images.push(file)
  }
  return { account: 'golf', order, kind: 'carousel', caption: golfPreviewCaption(eventId), images }
}

/** The RESULTS carousel: course title card ("RESULTS") + the final leaderboard. */
async function golfResultsPost(
  state: GolfSeasonState,
  record: GolfEventRecord,
  day: number,
  order: number,
): Promise<Post> {
  const event = eventById(record.eventId)
  const course = golfCourseById(event.courseId)
  const brand = golfEventBrand(record.eventId)
  window.__STAGE__ = `golf results (event ${record.eventIndex + 1})`
  const model = buildGolfPreviewModel(
    brand,
    course,
    golfPreviewSeed(state.seedKey, record.season, record.eventIndex),
    undefined,
    undefined,
    'results',
  )
  const title = `golf-d${day}-e${record.eventIndex + 1}-results-title.png`
  await saveBlob(await exportGolfPreviewImage(model, 0), title)
  const board = `golf-d${day}-e${record.eventIndex + 1}-results-board.png`
  await saveBlob(
    await exportGolfLeaderboardPng({ event, season: record.season, field: record.field, toParByRound: record.toParByRound }),
    board,
  )
  return { account: 'golf', order, kind: 'carousel', caption: golfResultsCaption(state, record), images: [title, board] }
}

/** Golf posts for one day, in posting order. */
async function golfPostsForDay(bank: Bank, day: number): Promise<Post[]> {
  const plan = golfPlanForDay(day)
  if (plan.kind === 'none') return []

  if (plan.kind === 'champions') {
    const { state } = golfStateThroughEvent(13)
    window.__STAGE__ = 'golf champions'
    const champImg = `golf-d${day}-champion.png`
    const rankImg = `golf-d${day}-final-rankings.png`
    await saveBlob(await exportGolfChampionPng(state), champImg)
    await saveBlob(await exportGolfRankingsPng(state), rankImg)
    return [{ account: 'golf', order: 1, kind: 'carousel', caption: golfChampionsCaption(state), images: [champImg, rankImg] }]
  }

  if (plan.kind === 'preview') {
    const { state } = golfStateThroughEvent(plan.eventIndex)
    return [await golfPreviewPosts(state, plan.eventIndex, day, 1)]
  }

  // A round day: both display groups, sharing that round's leaderboard end-card.
  const { state, record } = golfStateThroughEvent(plan.eventIndex)
  if (!record) return []
  const event = eventById(record.eventId)
  const course = golfCourseById(event.courseId)
  const brand = golfEventBrand(record.eventId)
  const round = plan.round
  window.__STAGE__ = `golf event ${plan.eventIndex + 1} round ${round}`

  const board = `golf-d${day}-r${round}-lb.png`
  await saveBlob(
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
    await saveBlob(video, `${vid}.mp4`)
    await saveBlob(wav, `${vid}.wav`)
    posts.push({
      account: 'golf',
      order: order++,
      kind: 'reel',
      // The champion announcement lives on the Results carousel, not the reels.
      caption: golfGroupVideoCaption(state, record, round, group, false),
      video: `${vid}.mp4`,
      board,
    })
  }

  if (plan.results) posts.push(await golfResultsPost(state, record, day, order++))
  if (plan.nextPreviewEventIndex !== null) posts.push(await golfPreviewPosts(state, plan.nextPreviewEventIndex, day, order++))
  return posts
}

// ---------- catch-up (one-off seed-drop gap) -----------------------------------

/** The posts the seed drop missed under the revised format: soccer R1's table,
 * golf E1's results carousel, and golf E2's course preview. Cursor untouched. */
async function catchupPosts(): Promise<Post[]> {
  const posts: Post[] = []

  // Soccer: Round 1's completed table (matches 0-2 posted in the seed drop).
  let soccer = createLeague(SOCCER_SEED, 'Crown League', 6, 'live-crown')
  const fixtures = orderedRegularFixtures(soccer)
  for (let i = 0; i < 3; i++) soccer = playFixture(soccer, fixtures[i].id)
  window.__STAGE__ = 'catchup: soccer R1 table'
  const img = 'soccer-catchup-r1-table.png'
  await saveBlob(await exportStandingsPng(soccer, 'ROUND 1 · FINAL TABLE'), img)
  posts.push({ account: 'soccer', order: 1, kind: 'photo', caption: standingsCaption(soccer, 'Round 1'), image: img })

  // Golf: E1 results carousel + E2 preview.
  const { state, record } = golfStateThroughEvent(0)
  if (!record) throw new Error('golf event 1 did not complete')
  posts.push(await golfResultsPost(state, record, 0, 1))
  posts.push(await golfPreviewPosts(state, 1, 0, 2))
  return posts
}

// ---------- main ---------------------------------------------------------------

async function main(): Promise<void> {
  try {
    const params = new URLSearchParams(location.search)
    const isCatchup = params.get('catchup') === '1'
    const soccerDay = Number.parseInt(params.get('soccerDay') ?? '-1', 10)
    const golfDay = Number.parseInt(params.get('golfDay') ?? '-1', 10)

    let posts: Post[]
    let cursor: { soccer: number; golf: number }
    if (isCatchup) {
      posts = await catchupPosts()
      // Cursor unchanged — the catch-up fills the seed-drop gap, not a new day.
      cursor = { soccer: soccerDay, golf: golfDay }
    } else {
      const bank = await loadAudioAssets()
      posts = [...(await soccerPostsForDay(bank, soccerDay)), ...(await golfPostsForDay(bank, golfDay))]
      cursor = { soccer: nextSoccerDay(soccerDay), golf: nextGolfDay(golfDay) }
    }

    window.__MANIFEST__ = JSON.stringify({ posts, cursor }, null, 2)
    window.__STAGE__ = 'done'
    window.__DONE__ = true
  } catch (err) {
    window.__ERROR__ = err instanceof Error ? `${err.message}\n${err.stack ?? ''}` : String(err)
    window.__DONE__ = true
  }
}

void main()
