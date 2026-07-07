// Template-driven captions generated from match & season data. Every caption
// ends on a prediction hook (the top comment-driver for this genre).

import type { LeagueState, Fixture, MatchScore } from '../league/types'
import { computeStandings, teamById } from '../league/league'

export function matchCaption(state: LeagueState, f: Fixture, sc: MatchScore): string {
  const home = teamById(state, f.home)
  const away = teamById(state, f.away)
  const h = home.identity
  const a = away.identity
  const label = f.stage === 'regular' ? `Matchday ${f.round + 1}` : f.stage === 'final' ? 'THE FINAL' : 'Playoff Semi-Final'

  let story: string
  if (sc.home === sc.away) {
    story = `${h.name} and ${a.name} share the spoils in a ${sc.home}-${sc.away} draw.`
  } else {
    const winner = sc.home > sc.away ? home : away
    const loser = sc.home > sc.away ? away : home
    const margin = Math.abs(sc.home - sc.away)
    if (winner.glicko.rating < loser.glicko.rating - 60) {
      story = `🚨 UPSET! ${winner.identity.name} stun ${loser.identity.name}.`
    } else if (margin >= 3) {
      story = `${winner.identity.name} run riot 🔥`
    } else {
      story = `${winner.identity.name} edge a tight one.`
    }
  }

  return [
    `${label} · Season ${state.season}`,
    `${h.name} ${sc.home}–${sc.away} ${a.name}`,
    '',
    story,
    '',
    'Who wins the next one? Drop your score 👇',
    `#EliteSimSPN #SimSoccer #${h.abbr} #${a.abbr}`,
  ].join('\n')
}

export function standingsCaption(state: LeagueState, roundLabel: string): string {
  const table = computeStandings(state)
  const leader = teamById(state, table[0].teamId).identity
  const second = teamById(state, table[1].teamId).identity
  const bottom = teamById(state, table[table.length - 1].teamId).identity
  const gap = table[0].points - table[1].points

  return [
    `📊 THE TABLE — ${roundLabel}, Season ${state.season}`,
    '',
    gap === 0
      ? `${leader.name} and ${second.name} are locked together at the top on ${table[0].points} pts.`
      : `${leader.name} lead on ${table[0].points} pts, ${gap} clear of ${second.name}.`,
    `${bottom.name} are rooted to the bottom.`,
    'Top 4 make the playoffs.',
    '',
    "Who's winning the title? 👇",
    '#EliteSimSPN #SimSoccer',
  ].join('\n')
}
