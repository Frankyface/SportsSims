// Instagram captions for Apex Tour content — golf's fork of captions.ts.
// Round captions lead with the leaderboard story; event captions crown the
// winner and surface the career-book drama (maiden wins, droughts ended,
// blown leads); rankings captions sell the season race.

import type { GolfRoundResult } from '../sim/golfTypes'
import {
  golferById,
  golfRankings,
  ROUNDS_PER_EVENT,
  type GolfEventRecord,
  type GolfSeasonState,
} from '../league/golfSeason'
import { golfEventByIndex } from '../ratings/golfCourses'
import { formatToPar } from '../render/golfDirector'

export const GOLF_HASHTAGS = '#ESSPN #SimGolf'

function first(name: string): string {
  return name.split(' ')[0]
}

/** Caption for a single round video (uses the round's own field ordering). */
export function golfRoundCaption(state: GolfSeasonState, result: GolfRoundResult): string {
  const event = golfEventByIndex(state.current.eventIndex)
  const round = result.config.round
  const lead = result.leaderboard[0]
  const leader = result.config.golfers[lead]
  const gap = result.totalToPar[result.leaderboard[1]] - result.totalToPar[lead]
  const lines: string[] = [
    `⛳ ${event.name} — Round ${round}${event.major ? ' · A MAJOR' : ''}`,
  ]
  const roundLow = Math.min(...result.roundToPar)
  const lowIdx = result.roundToPar.indexOf(roundLow)
  const lowG = result.config.golfers[lowIdx]

  if (round === ROUNDS_PER_EVENT) {
    lines.push(`${leader.name} takes it at ${formatToPar(result.totalToPar[lead])}.`)
    if (gap === 0) lines.push('Won on the final-round countback. Brutal.')
    else if (gap === 1) lines.push('By a single stroke. Breathe out.')
    else if (gap >= 5) lines.push(`By ${gap}. A procession.`)
  } else {
    lines.push(
      gap === 0
        ? `All tied at the top on ${formatToPar(result.totalToPar[lead])}.`
        : `${leader.name} leads on ${formatToPar(result.totalToPar[lead])} (by ${gap}).`,
    )
    if (roundLow <= -3) lines.push(`${lowG.name} went ${formatToPar(roundLow)} today 🔥`)
    const splashes = result.events.filter((e) => e.type === 'splash').length
    if (splashes >= 3) lines.push(`${splashes} balls in the water. Carnage.`)
  }
  lines.push('Who wins it? Drop your pick 👇')
  lines.push(`${GOLF_HASHTAGS} #${event.short.replace(/\s/g, '')}`)
  return lines.join('\n')
}

/** Caption for a completed event (posted with the final-round video). */
export function golfEventCaption(state: GolfSeasonState, record: GolfEventRecord): string {
  const event = golfEventByIndex(record.eventIndex)
  const winner = golferById(state, record.winnerId)
  const career = state.career[record.winnerId]
  const lines: string[] = [
    `🏆 ${winner.identity.name} wins ${event.name}${event.major ? ' — A MAJOR 🏆' : ''}`,
  ]
  if (career.wins === 1) lines.push(`A FIRST CAREER WIN for ${first(winner.identity.name)}!`)
  else if (event.major && career.majorWins === 1) lines.push(`The major drought is OVER.`)
  if (record.wireToWire) lines.push('Wire to wire. Never headed.')
  if (record.comeback) lines.push('Stormed from the pack on the final nine.')
  if (record.blownLeadId) {
    const b = golferById(state, record.blownLeadId)
    lines.push(`${b.identity.name} led into the last round… and it slipped again.`)
  }
  lines.push(`${GOLF_HASHTAGS} #${event.short.replace(/\s/g, '')}`)
  return lines.join('\n')
}

/** Caption for the rankings card. */
export function golfRankingsCaption(state: GolfSeasonState): string {
  const rankings = golfRankings(state)
  const leader = golferById(state, rankings[0].golferId)
  const second = golferById(state, rankings[1].golferId)
  const gap = rankings[0].points - rankings[1].points
  const played = state.completed.length
  return [
    `📊 APEX TOUR RANKINGS — after ${played} of 14 events, Season ${state.season}`,
    gap > 400
      ? `${leader.identity.name} is running away with the season.`
      : `${leader.identity.name} leads, ${second.identity.name} within a swing (${gap} pts).`,
    'Majors pay double. The Pinnacle decides it all.',
    `Who takes the season title? 👇`,
    GOLF_HASHTAGS,
  ].join('\n')
}
