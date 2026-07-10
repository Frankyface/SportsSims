// Headless generator for the hands-off DAILY cadence. Renders ONLY the posts for
// one calendar day per account AND one time SLOT, reconstructing the correct
// SEASON from the recorded transition rolls. The day→content mapping lives in
// dailyCalendar.ts (pure, unit-tested); season reconstruction + the auto-roll
// selector are in seasonReconstruct.ts / seasonQuality.ts. This module renders
// what those say, reusing the app's own export functions.
//
// Query params: soccerDay/soccerSeason/soccerRolls, golfDay/golfSeason/golfRolls,
// slot (g1|main|companions), catchup. Slots (posting times):
//   g1 (13:00 UTC)         = golf Group-1 reel
//   main (16:00 UTC)       = golf Group-2 reel + soccer match/playoff reel
//   companions (19:00 UTC) = all carousels/photos (results, previews, tables,
//                            playoffs/finals/champions) + cursor advance + (on a
//                            champions day) the season-transition selection.
//
// Videos render VIDEO-ONLY + a WAV sidecar (CI has no AAC encoder); finalize-reels
// muxes audio + appends the scoreboard end-card. Emits a manifest with the posts
// AND the advanced cursor for the workflow to persist.

import { playFixture, fixtureMatch, fixtureById, startPlayoffs, advancePlayoffs } from '../league/league'
import type { Fixture, LeagueState } from '../league/types'
import { exportMatchMp4, downloadBlob } from '../export/exportMp4'
import { exportStandingsPng } from '../render/standingsCard'
import { exportStandingsFeedPng } from '../render/standingsFeedCard'
import { exportPlayoffsPreviewPng, exportFinalsPreviewPng, exportChampionsPng } from '../render/soccerSeasonCards'
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
  playNextGolfRound,
  golfSeasonComplete,
  golfRecordRoundResult,
  type GolfSeasonState,
  type GolfEventRecord,
} from '../league/golfSeason'
import { eventById, golfCourseById, seasonSchedule } from '../ratings/golfCourses'
import { golfEventBrand } from '../content/golfEventPack'
import { buildGolfPreviewModel, golfPreviewSeed, exportGolfPreviewImages } from '../render/golfCoursePreview'
import { buildGolfRenderModel } from '../render/golfRenderMatch'
import { exportGolfRoundMp4 } from '../export/exportGolfMp4'
import { exportGolfLeaderboardPng } from '../render/golfLeaderboardCard'
import { exportGolfResultsCarousel, exportGolfSeasonBoardPng } from '../render/golfResultsCarousel'
import { exportGolfChampionPng } from '../render/golfChampionCard'
import { buildGolfAmbientAudio } from '../export/golfAudio'
import {
  golfGroupVideoCaption,
  golfPreviewCaption,
  golfResultsCaption,
  golfChampionsCaption,
} from '../content/golfCaptions'
import {
  soccerPlanForDay,
  golfPlanForDay,
  nextSoccerDay,
  nextGolfDay,
} from './dailyCalendar'
import {
  reconstructSoccerSeason,
  reconstructGolfSeason,
  orderedRegularFixtures,
  playSoccerSeasonToEnd,
  playGolfSeasonToEnd,
} from './seasonReconstruct'
import { selectNextSoccerSeason, selectNextGolfSeason } from '../league/seasonQuality'

type Slot = 'g1' | 'main' | 'companions'

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

interface Cursor {
  season: number
  day: number
  rolls: string[]
  /** Monotonic high-water mark of the highest (season, day, slot) already posted
   * for this account: season*1e6 + day*10 + slotOrdinal. A slot posts only when
   * its position exceeds this — so a re-fired or delayed cron run never
   * duplicate-posts, and a dropped 19:00 recovers on the next day's 19:00. */
  postedHWM: number
}

const SLOT_ORD: Record<Slot, number> = { g1: 0, main: 1, companions: 2 }
function slotPos(cur: Cursor, slot: Slot): number {
  return cur.season * 1_000_000 + cur.day * 10 + SLOT_ORD[slot]
}

declare global {
  interface Window {
    __DONE__?: boolean
    __ERROR__?: string
    __MANIFEST__?: string
    __STAGE__?: string
    __SAVE_CHUNK__?: (filename: string, b64: string, isFirst: boolean) => Promise<void>
  }
}

type Bank = Awaited<ReturnType<typeof loadAudioAssets>>
const SAVE_CHUNK_BYTES = 8 * 1024 * 1024

/** Save a blob via the runner binding (chunked base64), falling back to a browser
 * download outside the harness. Bypasses Chromium's rapid-download limiter. */
async function saveBlob(blob: Blob, filename: string): Promise<void> {
  const saveChunk = window.__SAVE_CHUNK__
  if (!saveChunk) {
    downloadBlob(blob, filename)
    return
  }
  for (let off = 0; off < blob.size; off += SAVE_CHUNK_BYTES) {
    const bytes = new Uint8Array(await blob.slice(off, off + SAVE_CHUNK_BYTES).arrayBuffer())
    let bin = ''
    for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
    await saveChunk(filename, btoa(bin), off === 0)
  }
}

// ---------- soccer ------------------------------------------------------------

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

/** Soccer posts for one day + slot. `main` = the match/playoff reel; `companions`
 * = the round table / playoffs bracket / finals preview / champions carousel. */
async function soccerPostsForSlot(bank: Bank, cur: Cursor, slot: Slot): Promise<Post[]> {
  const day = cur.day
  const plan = soccerPlanForDay(day)
  if (plan.kind === 'none') return []
  const tag = `s${cur.season}-d${day}`
  const posts: Post[] = []
  let order = 1

  if (plan.kind === 'match') {
    let state = reconstructSoccerSeason(cur.season, cur.rolls)
    const fixtures = orderedRegularFixtures(state)
    for (let i = 0; i < plan.matchIndex; i++) state = playFixture(state, fixtures[i].id)
    const f = fixtures[plan.matchIndex]
    const played = playFixture(state, f.id)

    if (slot === 'main') {
      window.__STAGE__ = `soccer match (${tag})`
      const parts = await renderMatchReel(bank, state, f, `soccer-${tag}-match`, played, 'AS IT STANDS')
      posts.push({ account: 'soccer', order: order++, kind: 'reel', caption: matchCaption(played, f, played.results[f.id]!), ...parts })
    }
    if (slot === 'companions' && plan.roundTable !== null) {
      const label = `Round ${plan.roundTable + 1}`
      const img = `soccer-${tag}-r${plan.roundTable + 1}-table`
      window.__STAGE__ = `soccer ${label} table`
      await saveBlob(await exportStandingsFeedPng(played, `${label} · FINAL TABLE`), `${img}.png`)
      posts.push({ account: 'soccer', order: order++, kind: 'photo', caption: standingsCaption(played, label), image: `${img}.png` })
    }
    if (slot === 'companions' && plan.playoffsPreview) {
      const img = `soccer-${tag}-playoffs`
      window.__STAGE__ = 'soccer playoffs preview'
      await saveBlob(await exportPlayoffsPreviewPng(played), `${img}.png`)
      posts.push({ account: 'soccer', order: order++, kind: 'photo', caption: playoffsPreviewCaption(played), image: `${img}.png` })
    }
    return posts
  }

  // Playoffs / champions: reconstruct + play the whole regular season first.
  let state = reconstructSoccerSeason(cur.season, cur.rolls)
  for (const f of orderedRegularFixtures(state)) state = playFixture(state, f.id)
  const regState = state
  state = startPlayoffs(state)

  if (plan.kind === 'playoff') {
    if (plan.fixture !== 'sf1') state = playFixture(state, 'sf1')
    if (plan.fixture === 'final') {
      state = playFixture(state, 'sf2')
      state = advancePlayoffs(state)
    }
    const f = fixtureById(state, plan.fixture)
    const played = playFixture(state, plan.fixture)
    if (slot === 'main') {
      window.__STAGE__ = `soccer ${plan.fixture}`
      const parts = await renderMatchReel(bank, state, f, `soccer-${tag}-${plan.fixture}`, regState, 'FINAL TABLE')
      posts.push({ account: 'soccer', order: order++, kind: 'reel', caption: matchCaption(played, f, played.results[plan.fixture]!), ...parts })
    }
    if (slot === 'companions' && plan.finalsPreview) {
      const img = `soccer-${tag}-finals`
      window.__STAGE__ = 'soccer finals preview'
      await saveBlob(await exportFinalsPreviewPng(played), `${img}.png`)
      posts.push({ account: 'soccer', order: order++, kind: 'photo', caption: finalsPreviewCaption(played), image: `${img}.png` })
    }
    return posts
  }

  // champions carousel (companions only)
  if (slot !== 'companions') return []
  state = playFixture(state, 'sf1')
  state = playFixture(state, 'sf2')
  state = advancePlayoffs(state)
  state = playFixture(state, 'final')
  window.__STAGE__ = 'soccer champions'
  const champImg = `soccer-${tag}-champions.png`
  const tableImg = `soccer-${tag}-final-table.png`
  await saveBlob(await exportChampionsPng(state), champImg)
  await saveBlob(await exportStandingsFeedPng(regState, 'Final table'), tableImg)
  posts.push({ account: 'soccer', order: 1, kind: 'carousel', caption: championsCaption(state), images: [champImg, tableImg] })
  return posts
}

// ---------- golf --------------------------------------------------------------

/** Reconstruct the golf season, then play (no render) until `eventIndex` completes. */
function golfSeasonAtEvent(cur: Cursor, eventIndex: number): { state: GolfSeasonState; record: GolfEventRecord | undefined } {
  let state = reconstructGolfSeason(cur.season, cur.rolls)
  let guard = 0
  while (state.completed.length <= eventIndex && !golfSeasonComplete(state) && guard++ < 1000) {
    state = playNextGolfRound(state).state
  }
  return { state, record: state.completed[eventIndex] }
}

async function golfPreviewPost(state: GolfSeasonState, eventIndex: number, tag: string, order: number): Promise<Post> {
  const eventId = seasonSchedule(state.seedKey, state.season)[eventIndex]
  const course = golfCourseById(eventById(eventId).courseId)
  const brand = golfEventBrand(eventId)
  window.__STAGE__ = `golf preview (event ${eventIndex + 1})`
  // 4:5 (1080x1350) feed carousel — consistent with the results carousel.
  const model = buildGolfPreviewModel(brand, course, golfPreviewSeed(state.seedKey, state.season, eventIndex), 1080, 1350)
  const imgs = await exportGolfPreviewImages(model)
  const images: string[] = []
  for (let i = 0; i < imgs.length; i++) {
    const file = `golf-${tag}-e${eventIndex + 1}-preview-${String(i).padStart(2, '0')}.png`
    await saveBlob(imgs[i].blob, file)
    images.push(file)
  }
  return { account: 'golf', order, kind: 'carousel', caption: golfPreviewCaption(eventId), images }
}

async function golfResultsPost(state: GolfSeasonState, record: GolfEventRecord, tag: string, order: number): Promise<Post> {
  window.__STAGE__ = `golf results (event ${record.eventIndex + 1})`
  // Three 4:5 feed pages: RESULTS title, final leaderboard, season league-board
  // (wins/majors/top-3/points as "this-season (all-time)"). The tall 9:16
  // leaderboard stays only as the reel end-card.
  const pages = await exportGolfResultsCarousel(state, record)
  const names = ['results-title', 'results-board', 'season-board']
  const images: string[] = []
  for (let i = 0; i < pages.length; i++) {
    const file = `golf-${tag}-e${record.eventIndex + 1}-${names[i]}.png`
    await saveBlob(pages[i], file)
    images.push(file)
  }
  return { account: 'golf', order, kind: 'carousel', caption: golfResultsCaption(state, record), images }
}

/** Golf posts for one day + slot. g1 = Group-1 reel; main = Group-2 reel;
 * companions = preview / results / champions carousels. */
async function golfPostsForSlot(bank: Bank, cur: Cursor, slot: Slot): Promise<Post[]> {
  const day = cur.day
  const plan = golfPlanForDay(day)
  if (plan.kind === 'none') return []
  const tag = `s${cur.season}-d${day}`

  if (plan.kind === 'champions') {
    if (slot !== 'companions') return []
    const state = playGolfSeasonToEnd(reconstructGolfSeason(cur.season, cur.rolls))
    window.__STAGE__ = 'golf champions'
    const champImg = `golf-${tag}-champion.png`
    const rankImg = `golf-${tag}-final-rankings.png`
    await saveBlob(await exportGolfChampionPng(state), champImg)
    await saveBlob(await exportGolfSeasonBoardPng(state), rankImg)
    return [{ account: 'golf', order: 1, kind: 'carousel', caption: golfChampionsCaption(state), images: [champImg, rankImg] }]
  }

  if (plan.kind === 'preview') {
    if (slot !== 'companions') return []
    const state = reconstructGolfSeason(cur.season, cur.rolls)
    return [await golfPreviewPost(state, plan.eventIndex, tag, 1)]
  }

  // round day
  const { state, record } = golfSeasonAtEvent(cur, plan.eventIndex)
  if (!record) return []
  const event = eventById(record.eventId)
  const course = golfCourseById(event.courseId)
  const brand = golfEventBrand(record.eventId)
  const round = plan.round
  const posts: Post[] = []

  // both group reels share the round leaderboard end-card
  const groupSlot: Record<0 | 1, Slot> = { 0: 'g1', 1: 'main' }
  const needsReel = slot === 'g1' || slot === 'main'
  let board = ''
  if (needsReel) {
    board = `golf-${tag}-r${round}-lb.png`
    await saveBlob(
      await exportGolfLeaderboardPng({ event, season: record.season, field: record.field, toParByRound: record.toParByRound.slice(0, round) }),
      board,
    )
    const result = golfRecordRoundResult(state, record, round)
    for (const group of [0, 1] as const) {
      if (groupSlot[group] !== slot) continue
      window.__STAGE__ = `golf E${plan.eventIndex + 1} R${round} G${group + 1}`
      const model = buildGolfRenderModel(result, group, brand, course.name)
      const video = await exportGolfRoundMp4(model, undefined, { audio: false })
      const wav = pcmToWav(buildGolfAmbientAudio(model.plan.total, bank, model.seed >>> 0), AUDIO_SR)
      const vid = `golf-${tag}-r${round}-g${group + 1}`
      await saveBlob(video, `${vid}.mp4`)
      await saveBlob(wav, `${vid}.wav`)
      posts.push({
        account: 'golf',
        order: 1,
        kind: 'reel',
        caption: golfGroupVideoCaption(state, record, round, group, false),
        video: `${vid}.mp4`,
        board,
      })
    }
  }

  if (slot === 'companions') {
    let order = 1
    if (plan.results) posts.push(await golfResultsPost(state, record, tag, order++))
    if (plan.nextPreviewEventIndex !== null) posts.push(await golfPreviewPost(state, plan.nextPreviewEventIndex, tag, order++))
  }
  return posts
}

// ---------- cursor advance (companions slot only) -----------------------------

function nextSoccerCursor(cur: Cursor): Cursor {
  const plan = soccerPlanForDay(cur.day)
  if (plan.kind === 'champions') {
    window.__STAGE__ = 'soccer season transition'
    const end = playSoccerSeasonToEnd(reconstructSoccerSeason(cur.season, cur.rolls))
    const pick = selectNextSoccerSeason(end, cur.season + 1)
    return { season: cur.season + 1, day: 0, rolls: [...cur.rolls, pick.roll], postedHWM: cur.postedHWM }
  }
  return { season: cur.season, day: nextSoccerDay(cur.day), rolls: cur.rolls, postedHWM: cur.postedHWM }
}

function nextGolfCursor(cur: Cursor): Cursor {
  const plan = golfPlanForDay(cur.day)
  if (plan.kind === 'champions') {
    window.__STAGE__ = 'golf season transition'
    const end = playGolfSeasonToEnd(reconstructGolfSeason(cur.season, cur.rolls))
    const pick = selectNextGolfSeason(end, cur.season + 1)
    return { season: cur.season + 1, day: 0, rolls: [...cur.rolls, pick.roll], postedHWM: cur.postedHWM }
  }
  return { season: cur.season, day: nextGolfDay(cur.day), rolls: cur.rolls, postedHWM: cur.postedHWM }
}

// ---------- catch-up (one-off S1 seed-drop gap; ignores slot) ------------------

async function catchupPosts(): Promise<Post[]> {
  const posts: Post[] = []
  let soccer = reconstructSoccerSeason(1, [])
  const fixtures = orderedRegularFixtures(soccer)
  for (let i = 0; i < 3; i++) soccer = playFixture(soccer, fixtures[i].id)
  window.__STAGE__ = 'catchup: soccer R1 table'
  const img = 'soccer-catchup-r1-table.png'
  await saveBlob(await exportStandingsFeedPng(soccer, 'Round 1 · Final table'), img)
  posts.push({ account: 'soccer', order: 1, kind: 'photo', caption: standingsCaption(soccer, 'Round 1'), image: img })

  const { state, record } = golfSeasonAtEvent({ season: 1, day: 0, rolls: [], postedHWM: -1 }, 0)
  if (!record) throw new Error('golf event 1 did not complete')
  posts.push(await golfResultsPost(state, record, 's1-catchup', 1))
  posts.push(await golfPreviewPost(state, 1, 's1-catchup', 2))
  return posts
}

// ---------- main ---------------------------------------------------------------

function readCursor(params: URLSearchParams, key: string): Cursor {
  try {
    const c = JSON.parse(params.get(key) ?? '{}')
    return {
      season: Number.isInteger(c.season) ? c.season : 1,
      day: Number.isInteger(c.day) ? c.day : -1,
      rolls: Array.isArray(c.rolls) ? c.rolls.map(String) : [],
      postedHWM: Number.isFinite(c.postedHWM) ? c.postedHWM : -1,
    }
  } catch {
    return { season: 1, day: -1, rolls: [], postedHWM: -1 }
  }
}

/** The account's state after processing `slot`. Bumps the HWM if this slot was
 * posted; on the companions slot (the day's last), advances the day / runs the
 * season transition. */
function nextAccountCursor(cur: Cursor, slot: Slot, didPost: boolean, advance: (c: Cursor) => Cursor): Cursor {
  const p = slotPos(cur, slot)
  const postedHWM = didPost && p > cur.postedHWM ? p : cur.postedHWM
  if (slot === 'companions' && didPost) {
    return { ...advance(cur), postedHWM } // day/season move; HWM records position
  }
  return { ...cur, postedHWM }
}

async function main(): Promise<void> {
  try {
    const params = new URLSearchParams(location.search)
    const isCatchup = params.get('catchup') === '1'
    const isDry = params.get('dry') === '1'
    const slot = (params.get('slot') as Slot) || 'companions'
    const soccer = readCursor(params, 'soccer')
    const golf = readCursor(params, 'golf')

    let posts: Post[]
    let cursor: { soccer: Cursor; golf: Cursor }
    if (isCatchup) {
      posts = await catchupPosts()
      cursor = { soccer, golf } // catch-up fills a gap; cursor unchanged
    } else {
      const bank = await loadAudioAssets()
      // Idempotency gate: skip an account whose slot was already posted (unless a
      // dry-run, which renders everything for eyeballing and never advances).
      const soccerDo = isDry || slotPos(soccer, slot) > soccer.postedHWM
      const golfDo = isDry || slotPos(golf, slot) > golf.postedHWM
      posts = [
        ...(soccerDo ? await soccerPostsForSlot(bank, soccer, slot) : []),
        ...(golfDo ? await golfPostsForSlot(bank, golf, slot) : []),
      ]
      cursor = isDry
        ? { soccer, golf }
        : {
            soccer: nextAccountCursor(soccer, slot, soccerDo, nextSoccerCursor),
            golf: nextAccountCursor(golf, slot, golfDo, nextGolfCursor),
          }
    }

    window.__MANIFEST__ = JSON.stringify({ posts, cursor, slot }, null, 2)
    window.__STAGE__ = 'done'
    window.__DONE__ = true
  } catch (err) {
    window.__ERROR__ = err instanceof Error ? `${err.message}\n${err.stack ?? ''}` : String(err)
    window.__DONE__ = true
  }
}

void main()
