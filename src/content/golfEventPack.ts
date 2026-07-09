// One completed Apex Tour event -> a ready-to-post content drop. Every round
// yields THREE posts: the Group 1 video, the Final Group video (all four
// golfers playing all nine holes, every shot), and the full-field leaderboard
// card after the round. The season rankings card closes the drop. Videos are
// re-simmed byte-identically from the event's frozen record.

import { exportGolfRoundMp4 } from '../export/exportGolfMp4'
import { buildGolfRenderModel, type GolfEventBrand } from '../render/golfRenderMatch'
import { exportGolfRankingsPng } from '../render/golfRankingsCard'
import { exportGolfLeaderboardPng } from '../render/golfLeaderboardCard'
import {
  golfRecordRoundResult,
  ROUNDS_PER_EVENT,
  type GolfEventRecord,
  type GolfSeasonState,
} from '../league/golfSeason'
import { golfCourseById, eventById } from '../ratings/golfCourses'
import type { MatchdayPack, PackItem } from './matchdayPack'
import { golfEventCaption, golfRankingsCaption, GOLF_HASHTAGS } from './golfCaptions'
import { formatToPar } from '../render/golfDirector'

export function golfEventBrand(eventId: string): GolfEventBrand {
  const e = eventById(eventId)
  return {
    name: e.name,
    short: e.short,
    color: e.color,
    colorAlt: e.colorAlt,
    major: e.major,
    championship: e.championship,
  }
}

function leaderLineAfter(state: GolfSeasonState, record: GolfEventRecord, round: number): string {
  const totals = state.golfers.map((_, i) =>
    record.toParByRound.slice(0, round).reduce((s, r) => s + r[i], 0),
  )
  const order = state.golfers.map((_, i) => i).sort((a, b) => totals[a] - totals[b] || a - b)
  const leader = state.golfers[order[0]]
  return `${leader.identity.name} leads on ${formatToPar(totals[order[0]])} after ${round * 9} holes.`
}

function groupVideoCaption(
  state: GolfSeasonState,
  record: GolfEventRecord,
  round: number,
  group: 0 | 1,
): string {
  const event = eventById(record.eventId)
  const lines = [
    `⛳ ${event.name} — Round ${round}, ${group === 1 ? 'Group 2' : 'Group 1'}${event.major ? ' · A MAJOR' : ''}`,
    group === 1 && round > 1 ? 'The leaders, every shot, all nine holes.' : 'Every shot, all nine holes.',
  ]
  if (round === ROUNDS_PER_EVENT && group === 1) {
    lines.push(golfEventCaption(state, record))
  } else {
    lines.push(leaderLineAfter(state, record, round))
    lines.push('Who wins it? Drop your pick 👇')
    lines.push(`${GOLF_HASHTAGS} #${event.short.replace(/\s/g, '')}`)
  }
  return lines.join('\n')
}

/** Build the full drop for a completed event: (2 videos + leaderboard) × 4 rounds + rankings. */
export async function buildGolfEventPack(
  state: GolfSeasonState,
  record: GolfEventRecord,
  onProgress?: (p: number, label: string) => void,
): Promise<MatchdayPack> {
  const event = eventById(record.eventId)
  const brand = golfEventBrand(record.eventId)
  const course = golfCourseById(event.courseId)
  const items: PackItem[] = []
  const totalSteps = ROUNDS_PER_EVENT * 3 + 1
  const eventNo = record.eventIndex + 1
  const prefix = `E${String(eventNo).padStart(2, '0')}-${event.short.replace(/\s/g, '')}`
  let step = 0

  for (let round = 1; round <= ROUNDS_PER_EVENT; round++) {
    const result = golfRecordRoundResult(state, record, round)
    for (const group of [0, 1] as const) {
      const model = buildGolfRenderModel(result, group, brand, course.name)
      const blob = await exportGolfRoundMp4(model, (p) =>
        onProgress?.((step + p) / totalSteps, `${event.short} R${round} G${group + 1}`),
      )
      items.push({
        name: `${prefix}-R${round}-G${group + 1}${group === 1 && round === ROUNDS_PER_EVENT ? '-FINAL' : ''}.mp4`,
        blob,
        kind: 'video',
        caption: groupVideoCaption(state, record, round, group),
      })
      step++
    }
    onProgress?.(step / totalSteps, `R${round} leaderboard`)
    const lb = await exportGolfLeaderboardPng({
      event,
      season: record.season,
      field: record.field,
      toParByRound: record.toParByRound.slice(0, round),
    })
    items.push({
      name: `${prefix}-R${round}-leaderboard.png`,
      blob: lb,
      kind: 'image',
      caption: `📊 ${event.name} — the board after Round ${round}.\n${leaderLineAfter(state, record, round)}\n${GOLF_HASHTAGS}`,
    })
    step++
  }

  onProgress?.(step / totalSteps, 'rankings card')
  const png = await exportGolfRankingsPng(state)
  items.push({
    name: `${prefix}-rankings.png`,
    blob: png,
    kind: 'image',
    caption: golfRankingsCaption(state),
  })
  onProgress?.(1, 'done')

  return { roundLabel: event.name, items }
}
