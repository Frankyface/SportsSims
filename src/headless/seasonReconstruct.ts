// Deterministic season-chain reconstruction for the auto-rolling cadence.
//
// The cadence posts season N of each competition. Ratings carry across seasons,
// so season N is reconstructed by replaying from the locked ROOT seed and applying
// each recorded transition roll: play season k to completion → advance with
// rolls[k-1] → repeat. Pure sim (no rendering); fast enough to run every generation.
//
// `rolls[k]` is the RESULT seed chosen for the transition INTO season k+2 (rolls[0]
// → season 2). Reconstructing season N consumes rolls[0..N-2]. A missing roll falls
// back to the default `${seedKey}:s${season}`, i.e. the natural (candidate-0) season.

import type { LeagueState, Fixture } from '../league/types'
import {
  createLeague,
  playFixture,
  startPlayoffs,
  advancePlayoffs,
  advanceSeasonWithSeed,
} from '../league/league'
import type { GolfSeasonState } from '../league/golfSeason'
import {
  createGolfSeason,
  playNextGolfRound,
  golfSeasonComplete,
  advanceGolfSeasonWithSeed,
} from '../league/golfSeason'

/** The locked season-1 seeds (see the elitesimspn-autopost-config memory). */
export const SOCCER_SEED = 'crown-alpha'
export const GOLF_SEED = 'sga-mrdklysr-2qbfer'
export const SOCCER_ID = 'live-crown'
export const GOLF_ID = 'live-sga'

/** Regular-season fixtures in play order: round, then numeric id. */
export function orderedRegularFixtures(state: LeagueState): Fixture[] {
  return state.fixtures
    .filter((f) => f.stage === 'regular')
    .sort((a, b) => a.round - b.round || a.id.localeCompare(b.id, undefined, { numeric: true }))
}

/** Play a soccer season fully (all regular fixtures + sf1/sf2/final). */
export function playSoccerSeasonToEnd(state: LeagueState): LeagueState {
  let s = state
  for (const f of orderedRegularFixtures(s)) s = playFixture(s, f.id)
  s = startPlayoffs(s)
  s = playFixture(s, 'sf1')
  s = playFixture(s, 'sf2')
  s = advancePlayoffs(s)
  s = playFixture(s, 'final')
  return s
}

/** Play a golf season fully (all 14 events). */
export function playGolfSeasonToEnd(state: GolfSeasonState): GolfSeasonState {
  let s = state
  let guard = 0
  while (!golfSeasonComplete(s) && guard++ < 1000) s = playNextGolfRound(s).state
  return s
}

/** Soccer state at the START of `season` (regular phase, nothing played). */
export function reconstructSoccerSeason(season: number, rolls: string[]): LeagueState {
  let s = createLeague(SOCCER_SEED, 'Crown League', 6, SOCCER_ID)
  for (let k = 0; k < season - 1; k++) {
    s = playSoccerSeasonToEnd(s)
    s = advanceSeasonWithSeed(s, rolls[k])
  }
  return s
}

/** Golf state at the START of `season` (event 0, nothing played). */
export function reconstructGolfSeason(season: number, rolls: string[]): GolfSeasonState {
  let s = createGolfSeason(GOLF_SEED, 'SGA Tour', GOLF_ID)
  for (let k = 0; k < season - 1; k++) {
    s = playGolfSeasonToEnd(s)
    s = advanceGolfSeasonWithSeed(s, rolls[k])
  }
  return s
}
