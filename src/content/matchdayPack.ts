// One matchday -> one content drop: an MP4 for every game in the round + a
// standings-update PNG + copy-paste captions. This is the "least manual effort"
// payoff — one click produces a whole day's posts.

import type { LeagueState } from '../league/types'
import { fixtureMatch, teamById } from '../league/league'
import { exportMatchMp4 } from '../export/exportMp4'
import { exportStandingsPng } from '../render/standingsCard'
import { matchCaption, standingsCaption } from './captions'
import { matchOfWeekIds } from './matchOfWeek'

export interface PackItem {
  name: string
  blob: Blob
  kind: 'video' | 'image'
  caption: string
}
export interface MatchdayPack {
  roundLabel: string
  items: PackItem[]
}

function roundLabelFor(state: LeagueState, round: number): string {
  const f = state.fixtures.find((x) => x.round === round)
  if (f && f.stage === 'final') return 'The Final'
  if (f && f.stage === 'sf') return 'Playoff Semis'
  return `Matchday ${round + 1}`
}

export async function buildMatchdayPack(
  state: LeagueState,
  round: number,
  onProgress?: (p: number, label: string) => void,
): Promise<MatchdayPack> {
  const fixtures = state.fixtures
    .filter((f) => f.round === round && state.results[f.id])
    .sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true }))
  const roundLabel = roundLabelFor(state, round)
  const items: PackItem[] = []
  const total = fixtures.length + 1
  let done = 0

  // Re-sim the round once, pick the Match of the Week (regular rounds only).
  const results = new Map(fixtures.map((f) => [f.id, fixtureMatch(state, f.id)]))
  const isRegular = fixtures[0]?.stage === 'regular'
  const motw = isRegular ? matchOfWeekIds(fixtures, results) : new Set<string>()

  for (const f of fixtures) {
    const h = teamById(state, f.home).identity
    const a = teamById(state, f.away).identity
    const isMotw = motw.has(f.id)
    const match = results.get(f.id)!
    const blob = await exportMatchMp4(match, (p) => onProgress?.((done + p) / total, `${h.abbr} v ${a.abbr}`))
    items.push({
      name: `${roundLabel.replace(/\s/g, '')}-${h.abbr}-${a.abbr}${isMotw ? '-MOTW' : ''}.mp4`,
      blob,
      kind: 'video',
      caption: (isMotw ? '⭐ MATCH OF THE WEEK\n' : '') + matchCaption(state, f, state.results[f.id]!),
    })
    done++
    onProgress?.(done / total, 'standings post')
  }

  const png = await exportStandingsPng(state, roundLabel)
  items.push({
    name: `${roundLabel.replace(/\s/g, '')}-standings.png`,
    blob: png,
    kind: 'image',
    caption: standingsCaption(state, roundLabel),
  })
  onProgress?.(1, 'done')

  return { roundLabel, items }
}
