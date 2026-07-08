// One completed Apex Tour event -> a ready-to-post content drop: the four
// round videos (re-simmed byte-identically from the event's frozen record),
// the season rankings card, and captions. Golf's fork of the matchday packs;
// reuses the sport-agnostic PackPanel shapes.

import { exportGolfRoundMp4 } from '../export/exportGolfMp4'
import { buildGolfRenderModel, type GolfEventBrand } from '../render/golfRenderMatch'
import { exportGolfRankingsPng } from '../render/golfRankingsCard'
import {
  golfRecordRoundResult,
  ROUNDS_PER_EVENT,
  type GolfEventRecord,
  type GolfSeasonState,
} from '../league/golfSeason'
import { golfCourseById, golfEventByIndex } from '../ratings/golfCourses'
import type { MatchdayPack, PackItem } from './matchdayPack'
import { golfEventCaption, golfRankingsCaption, GOLF_HASHTAGS } from './golfCaptions'
import { formatToPar } from '../render/golfDirector'

export function golfEventBrand(eventIndex: number): GolfEventBrand {
  const e = golfEventByIndex(eventIndex)
  return {
    name: e.name,
    short: e.short,
    color: e.color,
    colorAlt: e.colorAlt,
    major: e.major,
    championship: e.championship,
  }
}

function roundVideoCaption(state: GolfSeasonState, record: GolfEventRecord, round: number): string {
  const event = golfEventByIndex(record.eventIndex)
  if (round === ROUNDS_PER_EVENT) return golfEventCaption(state, record)
  const totals = state.golfers.map((_, i) =>
    record.toParByRound.slice(0, round).reduce((s, r) => s + r[i], 0),
  )
  const order = state.golfers.map((_, i) => i).sort((a, b) => totals[a] - totals[b] || a - b)
  const leader = state.golfers[order[0]]
  return [
    `⛳ ${event.name} — Round ${round}${event.major ? ' · A MAJOR' : ''}`,
    `${leader.identity.name} leads on ${formatToPar(totals[order[0]])} after ${round * 9} holes.`,
    'Who wins it? Drop your pick 👇',
    `${GOLF_HASHTAGS} #${event.short.replace(/\s/g, '')}`,
  ].join('\n')
}

/** Build the full drop for a completed event: 4 round videos + rankings card. */
export async function buildGolfEventPack(
  state: GolfSeasonState,
  record: GolfEventRecord,
  onProgress?: (p: number, label: string) => void,
): Promise<MatchdayPack> {
  const event = golfEventByIndex(record.eventIndex)
  const brand = golfEventBrand(record.eventIndex)
  const course = golfCourseById(event.courseId)
  const items: PackItem[] = []
  const total = ROUNDS_PER_EVENT + 1
  const eventNo = record.eventIndex + 1

  for (let round = 1; round <= ROUNDS_PER_EVENT; round++) {
    const result = golfRecordRoundResult(state, record, round)
    const model = buildGolfRenderModel(result, brand, course.name)
    const blob = await exportGolfRoundMp4(model, (p) =>
      onProgress?.((round - 1 + p) / total, `${event.short} R${round}`),
    )
    items.push({
      name: `E${String(eventNo).padStart(2, '0')}-${event.short.replace(/\s/g, '')}-R${round}${round === ROUNDS_PER_EVENT ? '-FINAL' : ''}.mp4`,
      blob,
      kind: 'video',
      caption: roundVideoCaption(state, record, round),
    })
  }

  onProgress?.(ROUNDS_PER_EVENT / total, 'rankings card')
  const png = await exportGolfRankingsPng(state)
  items.push({
    name: `E${String(eventNo).padStart(2, '0')}-${event.short.replace(/\s/g, '')}-rankings.png`,
    blob: png,
    kind: 'image',
    caption: golfRankingsCaption(state),
  })
  onProgress?.(1, 'done')

  return { roundLabel: event.name, items }
}
