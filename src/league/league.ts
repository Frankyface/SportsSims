// League engine: fixtures, standings, playoffs, and the season lifecycle.
// Ratings are fixed within a season (from each team's Glicko) and evolve between
// seasons — a full season's results update Glicko, then decay/regress runs, so a
// mid-table side can rise and a champion can fall. Pure/immutable; every op
// returns a new LeagueState so it serializes and re-simulates identically.

import { generateLeague, type LeagueTeam } from '../ratings/teams'
import { updateGlicko, decayGlicko, type GameResult } from '../ratings/glicko2'
import { toTeamRating } from '../ratings/strength'
import { simulateMatch } from '../sim/simulateMatch'
import { SIM_VERSION, type MatchResult } from '../sim/types'
import { generateFixtures } from './fixtures'
import type { Fixture, LeagueState, MatchScore, SeasonRecord, StandingRow } from './types'

export function createLeague(seedKey: string, name: string, teamCount = 6): LeagueState {
  const teams = generateLeague(seedKey, teamCount)
  const fixtures = generateFixtures(teams.map((t) => t.identity.id))
  return {
    id: seedKey,
    name,
    seedKey,
    season: 1,
    phase: 'regular',
    teams,
    fixtures,
    results: {},
    history: [],
    simVersion: SIM_VERSION,
  }
}

export function teamById(state: LeagueState, id: string): LeagueTeam {
  const t = state.teams.find((x) => x.identity.id === id)
  if (!t) throw new Error(`Unknown team ${id}`)
  return t
}

export function fixtureById(state: LeagueState, id: string): Fixture {
  const f = state.fixtures.find((x) => x.id === id)
  if (!f) throw new Error(`Unknown fixture ${id}`)
  return f
}

/** Deterministic seed key for a fixture, stable across re-simulation. */
export function fixtureSeedKey(state: LeagueState, f: Fixture): string {
  return `${state.seedKey}:s${state.season}:${f.id}`
}

export function simFixture(state: LeagueState, f: Fixture): MatchScore {
  const h = teamById(state, f.home)
  const a = teamById(state, f.away)
  const match = simulateMatch({
    seedKey: fixtureSeedKey(state, f),
    home: toTeamRating(h.identity, h.glicko),
    away: toTeamRating(a.identity, a.glicko),
    homeAdvantage: 1.1,
  })
  return { home: match.score[0], away: match.score[1], homeXg: match.stats.xg[0], awayXg: match.stats.xg[1] }
}

/** The full deterministic MatchResult for a fixture (re-simulated from its seed) — used to render/export video. */
export function fixtureMatch(state: LeagueState, fixtureId: string): MatchResult {
  const f = fixtureById(state, fixtureId)
  const h = teamById(state, f.home)
  const a = teamById(state, f.away)
  return simulateMatch({
    seedKey: fixtureSeedKey(state, f),
    home: toTeamRating(h.identity, h.glicko),
    away: toTeamRating(a.identity, a.glicko),
    homeAdvantage: 1.1,
  })
}

export function playFixture(state: LeagueState, fixtureId: string): LeagueState {
  if (state.results[fixtureId]) return state
  const f = fixtureById(state, fixtureId)
  const score = simFixture(state, f)
  return { ...state, results: { ...state.results, [fixtureId]: score } }
}

export function playRound(state: LeagueState, round: number): LeagueState {
  let s = state
  for (const f of state.fixtures.filter((x) => x.round === round && !s.results[x.id])) {
    s = playFixture(s, f.id)
  }
  return s
}

export function computeStandings(state: LeagueState): StandingRow[] {
  const rows = new Map<string, StandingRow>()
  for (const t of state.teams) {
    rows.set(t.identity.id, { teamId: t.identity.id, played: 0, won: 0, drawn: 0, lost: 0, gf: 0, ga: 0, gd: 0, points: 0, form: [] })
  }
  const regular = state.fixtures.filter((f) => f.stage === 'regular').sort((a, b) => a.round - b.round)
  for (const f of regular) {
    const sc = state.results[f.id]
    if (!sc) continue
    const H = rows.get(f.home)
    const A = rows.get(f.away)
    if (!H || !A) continue
    H.played++
    A.played++
    H.gf += sc.home
    H.ga += sc.away
    A.gf += sc.away
    A.ga += sc.home
    if (sc.home > sc.away) {
      H.won++
      A.lost++
      H.points += 3
      H.form.push('W')
      A.form.push('L')
    } else if (sc.away > sc.home) {
      A.won++
      H.lost++
      A.points += 3
      A.form.push('W')
      H.form.push('L')
    } else {
      H.drawn++
      A.drawn++
      H.points++
      A.points++
      H.form.push('D')
      A.form.push('D')
    }
  }
  const arr = [...rows.values()]
  for (const r of arr) {
    r.gd = r.gf - r.ga
    r.form = r.form.slice(-5)
  }
  arr.sort((a, b) => b.points - a.points || b.gd - a.gd || b.gf - a.gf)
  return arr
}

export function regularComplete(state: LeagueState): boolean {
  return state.fixtures.filter((f) => f.stage === 'regular').every((f) => state.results[f.id] !== undefined)
}

/** After the regular season, seed the top-4 playoff (1v4, 2v3). Home = higher seed. */
export function startPlayoffs(state: LeagueState): LeagueState {
  if (state.phase !== 'regular' || !regularComplete(state)) return state
  const table = computeStandings(state)
  const top = table.slice(0, 4).map((r) => r.teamId)
  const base = state.fixtures.reduce((m, f) => Math.max(m, f.round), 0)
  const sf: Fixture[] = [
    { id: 'sf1', round: base + 1, stage: 'sf', home: top[0], away: top[3] },
    { id: 'sf2', round: base + 1, stage: 'sf', home: top[1], away: top[2] },
  ]
  return { ...state, phase: 'playoffs', fixtures: [...state.fixtures, ...sf] }
}

/** Winner of a fixture; playoff ties go to the higher seed (the home team). */
export function winnerOf(state: LeagueState, fixtureId: string): string {
  const f = fixtureById(state, fixtureId)
  const sc = state.results[fixtureId]
  if (!sc) throw new Error(`Fixture ${fixtureId} not played`)
  return sc.home >= sc.away ? f.home : f.away
}

/** Once both semis are done, create the final. */
export function advancePlayoffs(state: LeagueState): LeagueState {
  if (state.phase !== 'playoffs') return state
  const haveSemis = state.results['sf1'] && state.results['sf2']
  const haveFinal = state.fixtures.some((f) => f.id === 'final')
  if (haveSemis && !haveFinal) {
    const base = state.fixtures.reduce((m, f) => Math.max(m, f.round), 0)
    return {
      ...state,
      fixtures: [...state.fixtures, { id: 'final', round: base + 1, stage: 'final', home: winnerOf(state, 'sf1'), away: winnerOf(state, 'sf2') }],
    }
  }
  return state
}

export function seasonComplete(state: LeagueState): boolean {
  return state.phase === 'playoffs' && state.results['final'] !== undefined
}

function evolveRatings(state: LeagueState): LeagueTeam[] {
  const startGlicko = new Map(state.teams.map((t) => [t.identity.id, t.glicko]))
  const games = new Map<string, GameResult[]>()
  for (const t of state.teams) games.set(t.identity.id, [])
  for (const f of state.fixtures.filter((x) => x.stage === 'regular')) {
    const sc = state.results[f.id]
    if (!sc) continue
    const hs = sc.home > sc.away ? 1 : sc.home < sc.away ? 0 : 0.5
    games.get(f.home)?.push({ opponent: startGlicko.get(f.away)!, score: hs })
    games.get(f.away)?.push({ opponent: startGlicko.get(f.home)!, score: 1 - hs })
  }
  return state.teams.map((t) => ({ ...t, glicko: updateGlicko(t.glicko, games.get(t.identity.id) ?? []) }))
}

/** Crown the champion, archive the season, evolve + decay ratings, and roll into the next season. */
export function advanceSeason(state: LeagueState): LeagueState {
  if (!seasonComplete(state)) return state
  const table = computeStandings(state)
  const record: SeasonRecord = {
    season: state.season,
    championId: winnerOf(state, 'final'),
    shieldId: table[0].teamId,
    table: table.map((r) => ({ teamId: r.teamId, points: r.points, gd: r.gd })),
  }
  const evolved = evolveRatings(state).map((t) => ({ ...t, glicko: decayGlicko(t.glicko) }))
  const fixtures = generateFixtures(evolved.map((t) => t.identity.id))
  return {
    ...state,
    season: state.season + 1,
    phase: 'regular',
    teams: evolved,
    fixtures,
    results: {},
    history: [...state.history, record],
  }
}
