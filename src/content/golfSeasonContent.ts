// "Download full season" for the SGA Tour: every completed event as one folder,
// each split BY ROUND. The event's Tuesday course-preview flyover leads, then
// the four rounds (Thu–Sun), each with both group videos + the leaderboard card
// after that round. One end-of-season rankings card sits at the root. Bundled
// into a single .zip whose folder names ARE the posting calendar, with a
// POSTING_ORDER.txt walking the whole season top-to-bottom.
//
// Everything is re-derived byte-identically from the season's frozen event
// records, so the same season always produces the same drop. Browser-only (the
// video encoders need WebCodecs); the folder/naming scheme is pulled out as a
// pure helper so it stays unit-testable.

import { zipSync } from 'fflate'
import {
  golfRankingsSnapshot,
  golfRecordRoundResult,
  ROUNDS_PER_EVENT,
  type GolfEventRecord,
  type GolfSeasonState,
} from '../league/golfSeason'
import { eventById, golfCourseById } from '../ratings/golfCourses'
import { buildGolfRenderModel } from '../render/golfRenderMatch'
import {
  buildGolfPreviewModel,
  golfPreviewSeed,
  exportGolfPreviewImages,
} from '../render/golfCoursePreview'
import { exportGolfRoundMp4 } from '../export/exportGolfMp4'
import { exportGolfLeaderboardPng } from '../render/golfLeaderboardCard'
import { exportGolfRankingsPng } from '../render/golfRankingsCard'
import { golfEventBrand } from './golfEventPack'
import {
  golfGroupVideoCaption,
  golfLeaderLineAfter,
  golfPreviewCaption,
  golfRankingsCaption,
  GOLF_HASHTAGS,
} from './golfCaptions'
import { BRAND } from '../brand'

const pad = (n: number): string => String(n).padStart(2, '0')

/** Weekday a round is posted on: R1→Thu … R4→Sun (the finale). */
const ROUND_DAYS = ['Thu', 'Fri', 'Sat', 'Sun']

export const PREVIEW_FOLDER = 'Tue - Course Preview'

/** The tournament's top-level folder: "E04 - The Evergreen Invitational (MAJOR)". */
export function golfEventFolder(record: GolfEventRecord): string {
  const e = eventById(record.eventId)
  const badge = e.championship ? ' (THE CHAMPIONSHIP)' : e.major ? ' (MAJOR)' : ''
  return `E${pad(record.eventIndex + 1)} - ${e.name}${badge}`
}

/** A round's sub-folder within its event: "Thu - Round 1", "Sun - Round 4 (FINAL)". */
export function golfRoundFolder(round: number): string {
  const day = ROUND_DAYS[round - 1] ?? `R${round}`
  return `${day} - Round ${round}${round === ROUNDS_PER_EVENT ? ' (FINAL)' : ''}`
}

export interface GolfEventFolderPlan {
  eventFolder: string
  previewFolder: string
  roundFolders: string[]
}

/**
 * The by-tournament / by-round folder plan for a set of completed events, in
 * playing order. Pure — the season download's naming scheme, unit-testable
 * without touching WebCodecs.
 */
export function golfSeasonFolderPlan(records: GolfEventRecord[]): GolfEventFolderPlan[] {
  return [...records]
    .sort((a, b) => a.eventIndex - b.eventIndex)
    .map((record) => ({
      eventFolder: golfEventFolder(record),
      previewFolder: PREVIEW_FOLDER,
      roundFolders: Array.from({ length: ROUNDS_PER_EVENT }, (_, i) => golfRoundFolder(i + 1)),
    }))
}

function indent(s: string): string {
  return s
    .split('\n')
    .map((line) => '    ' + line)
    .join('\n')
}

/**
 * Build the whole-season content drop as a .zip Blob. Operates on a season with
 * completed events (sim the season to the end first); reads only frozen records
 * so it never re-runs the sim. Reports 0..1 progress with a human label.
 */
export async function buildGolfSeasonContent(
  state: GolfSeasonState,
  onProgress?: (p: number, label: string) => void,
): Promise<Blob> {
  const records = [...state.completed].sort((a, b) => a.eventIndex - b.eventIndex)
  if (records.length === 0) {
    throw new Error('No completed events to export — sim the season first.')
  }

  const files: Record<string, Uint8Array> = {}
  const manifest: string[] = []
  const text = (s: string): Uint8Array => new TextEncoder().encode(s)
  let postNo = 1

  // Progress weight: each event has 1 preview + 4×2 round videos = 9 heavy
  // encodes (leaderboard PNGs are quick), plus the one rankings card.
  const perEvent = 1 + ROUNDS_PER_EVENT * 2
  const totalSteps = records.length * perEvent + 1
  let step = 0

  for (const record of records) {
    const event = eventById(record.eventId)
    const brand = golfEventBrand(record.eventId)
    const course = golfCourseById(event.courseId)
    const folder = golfEventFolder(record)

    // --- Tuesday: the course preview (10-image carousel: title + all 9 holes) ---
    const previewSeed = golfPreviewSeed(state.seedKey, record.season, record.eventIndex)
    const previewModel = buildGolfPreviewModel(brand, course, previewSeed)
    const previewImages = await exportGolfPreviewImages(previewModel, (p) =>
      onProgress?.((step + p) / totalSteps, `${event.short} · course preview`),
    )
    const previewCap = golfPreviewCaption(record.eventId)
    for (const img of previewImages) {
      files[`${folder}/${PREVIEW_FOLDER}/${img.name}.png`] = new Uint8Array(await img.blob.arrayBuffer())
    }
    files[`${folder}/${PREVIEW_FOLDER}/caption.txt`] = text(previewCap)
    manifest.push(
      `POST ${postNo++} — 🎬 ${folder}/${PREVIEW_FOLDER}/  (Tuesday · ${previewImages.length}-image carousel)`,
    )
    manifest.push(indent(previewCap))
    manifest.push('')
    step++

    // --- Thu–Sun: the four rounds, each with both groups + the round board ---
    for (let round = 1; round <= ROUNDS_PER_EVENT; round++) {
      const sub = golfRoundFolder(round)
      const result = golfRecordRoundResult(state, record, round)

      for (const group of [0, 1] as const) {
        const model = buildGolfRenderModel(result, group, brand, course.name)
        const vid = await exportGolfRoundMp4(model, (p) =>
          onProgress?.((step + p) / totalSteps, `${event.short} R${round} G${group + 1}`),
        )
        const isFinalGroup = group === 1 && round === ROUNDS_PER_EVENT
        const gname = group === 0 ? '1-Group1' : isFinalGroup ? '2-Group2-FINAL' : '2-Group2'
        const cap = golfGroupVideoCaption(state, record, round, group)
        files[`${folder}/${sub}/${gname}.mp4`] = new Uint8Array(await vid.arrayBuffer())
        files[`${folder}/${sub}/caption-group${group + 1}.txt`] = text(cap)
        manifest.push(`POST ${postNo++} — 🎬 ${folder}/${sub}/${gname}.mp4`)
        manifest.push(indent(cap))
        manifest.push('')
        step++
      }

      onProgress?.(step / totalSteps, `${event.short} R${round} board`)
      const lb = await exportGolfLeaderboardPng({
        event,
        season: record.season,
        field: record.field,
        toParByRound: record.toParByRound.slice(0, round),
      })
      const lbCap = `📊 ${event.name} — the board after Round ${round}.\n${golfLeaderLineAfter(state, record, round)}\n${GOLF_HASHTAGS}`
      files[`${folder}/${sub}/3-leaderboard.png`] = new Uint8Array(await lb.arrayBuffer())
      files[`${folder}/${sub}/caption-leaderboard.txt`] = text(lbCap)
      manifest.push(`POST ${postNo++} — 📊 ${folder}/${sub}/3-leaderboard.png`)
      manifest.push(indent(lbCap))
      manifest.push('')
    }

    // End of the event → the updated season rankings (standings AS OF this event),
    // posted with the Sunday finale. Its own point-in-time snapshot, not the final table.
    onProgress?.(step / totalSteps, `${event.short} · season rankings`)
    const sunday = golfRoundFolder(ROUNDS_PER_EVENT)
    const snap = golfRankingsSnapshot(state, record.eventIndex)
    const rankPng = await exportGolfRankingsPng(snap)
    const rankCap = golfRankingsCaption(snap)
    files[`${folder}/${sunday}/4-Rankings-after-event.png`] = new Uint8Array(await rankPng.arrayBuffer())
    files[`${folder}/${sunday}/caption-rankings.txt`] = text(rankCap)
    manifest.push(`POST ${postNo++} — 📊 ${folder}/${sunday}/4-Rankings-after-event.png`)
    manifest.push(indent(rankCap))
    manifest.push('')

    manifest.push('\n———\n')
  }

  // --- end-of-season rankings card at the root ---
  onProgress?.(step / totalSteps, 'season rankings card')
  const rankPng = await exportGolfRankingsPng(state)
  const rankCap = golfRankingsCaption(state)
  files['Season-Rankings.png'] = new Uint8Array(await rankPng.arrayBuffer())
  files['Season-Rankings-caption.txt'] = text(rankCap)
  manifest.push(`POST ${postNo++} — 📊 Season-Rankings.png`)
  manifest.push(indent(rankCap))
  step++

  onProgress?.(1, 'zipping')
  const header =
    `${BRAND} — SGA Tour, Season ${state.season}\n` +
    `One folder per tournament, split by round. Post each event top-to-bottom:\n` +
    `the course-preview carousel (10 images) on Tuesday, then Round 1–4\n` +
    `Thursday→Sunday (both group videos, then that round's leaderboard), and the\n` +
    `updated season rankings after the Sunday finale. Season-Rankings.png at the\n` +
    `root is the final table.\n\n`
  files['POSTING_ORDER.txt'] = text(header + manifest.join('\n'))

  const zipped = zipSync(files, { level: 0 }) // mp4/png already compressed → store, don't recompress
  return new Blob([zipped], { type: 'application/zip' })
}
