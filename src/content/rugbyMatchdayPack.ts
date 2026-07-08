// One Bastion Championships round -> a ready-to-post content drop: a video
// per game (Match of the Week starred), the standings card, and captions.
// Rugby fork of matchdayPack.ts; reuses the sport-agnostic PackPanel shapes.

import { exportRugbyMatchMp4 } from '../export/exportRugbyMp4'
import {
  rugbyFixtureMatch,
  rugbyTeamById,
  type RugbyLeagueState,
} from '../league/rugbyLeague'
import type { RugbyMatchResult } from '../sim/rugbyTypes'
import { exportRugbyStandingsPng } from '../render/rugbyStandingsCard'
import type { MatchdayPack, PackItem } from './matchdayPack'
import { rugbyMatchCaption, rugbyStandingsCaption } from './rugbyCaptions'
import { rugbyMatchOfWeekIds } from './rugbyMatchOfWeek'

function roundLabelFor(state: RugbyLeagueState, round: number): string {
  const f = state.fixtures.find((x) => x.round === round)
  if (f?.stage === 'final') return 'The Final'
  if (f?.stage === 'sf') return 'Playoff Semis'
  return `Round ${round + 1}`
}

export async function buildRugbyMatchdayPack(
  state: RugbyLeagueState,
  round: number,
  onProgress?: (p: number, label: string) => void,
): Promise<MatchdayPack> {
  const fixtures = state.fixtures
    .filter((f) => f.round === round && state.results[f.id])
    .sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true }))
  const roundLabel = roundLabelFor(state, round)
  const items: PackItem[] = []
  const total = fixtures.length + 1

  // one deterministic re-sim per fixture, shared by MOTW scoring + export
  const results = new Map<string, RugbyMatchResult>(
    fixtures.map((f) => [f.id, rugbyFixtureMatch(state, f.id)]),
  )
  const isRegular = fixtures[0]?.stage === 'regular'
  const motw = isRegular ? rugbyMatchOfWeekIds(fixtures, results) : new Set<string>()

  let done = 0
  for (const f of fixtures) {
    const match = results.get(f.id)!
    const h = rugbyTeamById(state, f.home).identity
    const a = rugbyTeamById(state, f.away).identity
    const blob = await exportRugbyMatchMp4(match, (p) =>
      onProgress?.((done + p) / total, `${h.abbr} v ${a.abbr}`),
    )
    const isMotw = motw.has(f.id)
    items.push({
      name: `${roundLabel.replace(/\s/g, '')}-${h.abbr}-${a.abbr}${isMotw ? '-MOTW' : ''}.mp4`,
      blob,
      kind: 'video',
      caption:
        (isMotw ? '⭐ MATCH OF THE WEEK\n' : '') + rugbyMatchCaption(state, f, state.results[f.id]),
    })
    done++
  }

  onProgress?.(done / total, 'standings card')
  const png = await exportRugbyStandingsPng(state, roundLabel)
  items.push({
    name: `${roundLabel.replace(/\s/g, '')}-standings.png`,
    blob: png,
    kind: 'image',
    caption: rugbyStandingsCaption(state, roundLabel),
  })
  onProgress?.(1, 'done')

  return { roundLabel, items }
}
