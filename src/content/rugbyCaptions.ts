// Instagram captions for Bastion Championships content — the rugby fork of
// captions.ts. Margins are rescaled to rugby points (a 3-point margin is one
// penalty, not a rout) and the hashtags are rugby's own.

import {
  computeRugbyStandings,
  rugbyTeamById,
  type RugbyLeagueState,
  type RugbyMatchScore,
  type RugbyStandingRow,
} from '../league/rugbyLeague'
import type { Fixture } from '../league/types'

export const RUGBY_HASHTAGS = '#ESSPN #SimRugby'

function roundLabel(f: Fixture): string {
  if (f.stage === 'final') return 'THE FINAL'
  if (f.stage === 'sf') return 'Playoff Semi-Final'
  return `Round ${f.round + 1}`
}

export function rugbyMatchCaption(state: RugbyLeagueState, f: Fixture, sc: RugbyMatchScore): string {
  const h = rugbyTeamById(state, f.home)
  const a = rugbyTeamById(state, f.away)
  const hn = h.identity
  const an = a.identity
  const lines: string[] = [`🏉 ${roundLabel(f)} — ${hn.name} ${sc.home}-${sc.away} ${an.name}`]

  if (sc.home === sc.away) {
    lines.push(`${hn.nickname} and ${an.nickname} play out a draw. Nobody blinks.`)
  } else {
    const homeWin = sc.home > sc.away
    const winner = homeWin ? h : a
    const loser = homeWin ? a : h
    const margin = Math.abs(sc.home - sc.away)
    const winnerTries = homeWin ? sc.homeTries : sc.awayTries
    if (winner.glicko.rating < loser.glicko.rating - 60) {
      lines.push(`🚨 UPSET! ${winner.identity.nickname} stun ${loser.identity.name}.`)
    } else if (margin >= 21) {
      lines.push(`${winner.identity.nickname} run riot 🔥`)
    } else if (margin <= 7) {
      lines.push(`${winner.identity.nickname} edge a one-score thriller.`)
    } else {
      lines.push(`${winner.identity.nickname} take it home.`)
    }
    if (winnerTries >= 4) lines.push(`Four tries and the bonus point banked.`)
  }

  lines.push('Who wins the next one? Drop your score 👇')
  lines.push(`${RUGBY_HASHTAGS} #${hn.abbr} #${an.abbr}`)
  return lines.join('\n')
}

export function rugbyStandingsCaption(
  state: RugbyLeagueState,
  roundLbl: string,
  rowsOverride?: RugbyStandingRow[],
): string {
  const table = rowsOverride ?? computeRugbyStandings(state)
  const first = rugbyTeamById(state, table[0].teamId).identity
  const second = rugbyTeamById(state, table[1].teamId).identity
  const bottom = rugbyTeamById(state, table[table.length - 1].teamId).identity
  const gap = table[0].points - table[1].points
  const lines = [
    `📊 THE TABLE — ${roundLbl}, Season ${state.season}`,
    gap > 4
      ? `${first.nickname} are pulling clear at the top.`
      : `${first.nickname} lead, but ${second.nickname} are right on their heels.`,
    `${bottom.nickname} prop up the table. Top 4 make the playoffs.`,
    `Who lifts the Bastion? 👇`,
    RUGBY_HASHTAGS,
  ]
  return lines.join('\n')
}
