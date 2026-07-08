// The Bastion Championships league engine — the rugby fork of league.ts.
// Same season spine (double round-robin via the shared generateFixtures, top-4
// playoffs, Glicko offseason), but rugby scoring throughout: UNION standings
// points (4 win / 2 draw / 0 loss), a +1 bonus for scoring 4+ tries and a +1
// bonus for losing by 7 or less, ranked points → points difference → points
// for. Deliberately its own module: the live soccer league path is untouched.

import { makeRng } from '../sim/prng'
import { simulateRugbyMatch } from '../sim/rugbySim'
import { RUGBY_SIM_VERSION, type RugbyMatchResult } from '../sim/rugbyTypes'
import { offseasonAdjust } from '../ratings/glicko2'
import { generateRugbyLeague } from '../ratings/rugbyTeams'
import type { LeagueTeam } from '../ratings/teams'
import { toTeamRating } from '../ratings/strength'
import { generateFixtures } from './fixtures'
import type { Fixture, SeasonRecord } from './types'

export interface RugbyMatchScore {
  home: number
  away: number
  homeTries: number
  awayTries: number
}

export interface RugbyLeagueState {
  id: string
  name: string
  seedKey: string
  season: number
  phase: 'regular' | 'playoffs' | 'done'
  teams: LeagueTeam[]
  fixtures: Fixture[]
  results: Record<string, RugbyMatchScore> // fixtureId -> score
  history: SeasonRecord[]
  simVersion: number
  offseasonBig?: string[]
}

export interface RugbyStandingRow {
  teamId: string
  played: number
  won: number
  drawn: number
  lost: number
  pf: number // points for
  pa: number // points against
  pd: number // points difference
  bonus: number // try bonuses + losing bonuses
  points: number
  form: string[] // last 5: 'W' | 'D' | 'L'
}

const WIN_PTS = 4
const DRAW_PTS = 2
const TRY_BONUS_AT = 4 // score 4+ tries -> +1
const LOSING_BONUS_WITHIN = 7 // lose by <= 7 -> +1

export function createRugbyLeague(
  seedKey: string,
  name: string,
  teamCount = 6,
  id: string = seedKey,
): RugbyLeagueState {
  const teams = generateRugbyLeague(seedKey, teamCount)
  return {
    id,
    name,
    seedKey,
    season: 1,
    phase: 'regular',
    teams,
    fixtures: generateFixtures(teams.map((t) => t.identity.id)),
    results: {},
    history: [],
    simVersion: RUGBY_SIM_VERSION,
  }
}

export function rugbyTeamById(state: RugbyLeagueState, id: string): LeagueTeam {
  const t = state.teams.find((x) => x.identity.id === id)
  if (!t) throw new Error(`Unknown team ${id}`)
  return t
}

export function rugbyFixtureById(state: RugbyLeagueState, id: string): Fixture {
  const f = state.fixtures.find((x) => x.id === id)
  if (!f) throw new Error(`Unknown fixture ${id}`)
  return f
}

/** Stable per-fixture seed — the determinism anchor for saved leagues. */
export function rugbyFixtureSeedKey(state: RugbyLeagueState, f: Fixture): string {
  return `${state.seedKey}:s${state.season}:${f.id}`
}

function simRugby(state: RugbyLeagueState, f: Fixture): RugbyMatchResult {
  const h = rugbyTeamById(state, f.home)
  const a = rugbyTeamById(state, f.away)
  return simulateRugbyMatch({
    seedKey: rugbyFixtureSeedKey(state, f),
    home: toTeamRating(h.identity, h.glicko),
    away: toTeamRating(a.identity, a.glicko),
    homeAdvantage: 1.1,
  })
}

export function simRugbyFixture(state: RugbyLeagueState, f: Fixture): RugbyMatchScore {
  const m = simRugby(state, f)
  return {
    home: m.score[0],
    away: m.score[1],
    homeTries: m.stats.tries[0],
    awayTries: m.stats.tries[1],
  }
}

/** Full deterministic re-sim of a fixture, for the video render/export. */
export function rugbyFixtureMatch(state: RugbyLeagueState, fixtureId: string): RugbyMatchResult {
  return simRugby(state, rugbyFixtureById(state, fixtureId))
}

export function playRugbyFixture(state: RugbyLeagueState, fixtureId: string): RugbyLeagueState {
  if (state.results[fixtureId]) return state
  const f = rugbyFixtureById(state, fixtureId)
  return { ...state, results: { ...state.results, [fixtureId]: simRugbyFixture(state, f) } }
}

export function playRugbyRound(state: RugbyLeagueState, round: number): RugbyLeagueState {
  let s = state
  for (const f of state.fixtures.filter((x) => x.round === round)) {
    s = playRugbyFixture(s, f.id)
  }
  return s
}

/** Union standings: 4/2/0 + try bonus + losing bonus, ranked pts → PD → PF. */
export function computeRugbyStandings(
  state: RugbyLeagueState,
  results: Record<string, RugbyMatchScore> = state.results,
): RugbyStandingRow[] {
  const rows = new Map<string, RugbyStandingRow>()
  for (const t of state.teams) {
    rows.set(t.identity.id, {
      teamId: t.identity.id,
      played: 0,
      won: 0,
      drawn: 0,
      lost: 0,
      pf: 0,
      pa: 0,
      pd: 0,
      bonus: 0,
      points: 0,
      form: [],
    })
  }
  const regular = state.fixtures
    .filter((f) => f.stage === 'regular' && results[f.id])
    .sort((a, b) => a.round - b.round)
  for (const f of regular) {
    const sc = results[f.id]
    const H = rows.get(f.home)
    const A = rows.get(f.away)
    if (!H || !A) continue
    H.played++
    A.played++
    H.pf += sc.home
    H.pa += sc.away
    A.pf += sc.away
    A.pa += sc.home
    if (sc.home > sc.away) {
      H.won++
      A.lost++
      H.points += WIN_PTS
      H.form.push('W')
      A.form.push('L')
      if (sc.home - sc.away <= LOSING_BONUS_WITHIN) {
        A.bonus++
        A.points++
      }
    } else if (sc.away > sc.home) {
      A.won++
      H.lost++
      A.points += WIN_PTS
      A.form.push('W')
      H.form.push('L')
      if (sc.away - sc.home <= LOSING_BONUS_WITHIN) {
        H.bonus++
        H.points++
      }
    } else {
      H.drawn++
      A.drawn++
      H.points += DRAW_PTS
      A.points += DRAW_PTS
      H.form.push('D')
      A.form.push('D')
    }
    if (sc.homeTries >= TRY_BONUS_AT) {
      H.bonus++
      H.points++
    }
    if (sc.awayTries >= TRY_BONUS_AT) {
      A.bonus++
      A.points++
    }
  }
  const arr = [...rows.values()]
  for (const r of arr) {
    r.pd = r.pf - r.pa
    r.form = r.form.slice(-5)
  }
  arr.sort((a, b) => b.points - a.points || b.pd - a.pd || b.pf - a.pf)
  return arr
}

export function rugbyRegularComplete(state: RugbyLeagueState): boolean {
  return state.fixtures.filter((f) => f.stage === 'regular').every((f) => state.results[f.id])
}

export function startRugbyPlayoffs(state: RugbyLeagueState): RugbyLeagueState {
  if (state.phase !== 'regular' || !rugbyRegularComplete(state)) return state
  const top = computeRugbyStandings(state).slice(0, 4)
  const maxRound = Math.max(...state.fixtures.map((f) => f.round))
  const semis: Fixture[] = [
    { id: 'sf1', round: maxRound + 1, stage: 'sf', home: top[0].teamId, away: top[3].teamId },
    { id: 'sf2', round: maxRound + 1, stage: 'sf', home: top[1].teamId, away: top[2].teamId },
  ]
  return { ...state, phase: 'playoffs', fixtures: [...state.fixtures, ...semis] }
}

/** Playoff ties go to the home side (the higher seed). */
export function rugbyWinnerOf(state: RugbyLeagueState, fixtureId: string): string {
  const f = rugbyFixtureById(state, fixtureId)
  const sc = state.results[fixtureId]
  if (!sc) throw new Error(`Fixture ${fixtureId} not played`)
  return sc.home >= sc.away ? f.home : f.away
}

export function advanceRugbyPlayoffs(state: RugbyLeagueState): RugbyLeagueState {
  if (!state.results['sf1'] || !state.results['sf2']) return state
  if (state.fixtures.some((f) => f.id === 'final')) return state
  const maxRound = Math.max(...state.fixtures.map((f) => f.round))
  const final: Fixture = {
    id: 'final',
    round: maxRound + 1,
    stage: 'final',
    home: rugbyWinnerOf(state, 'sf1'),
    away: rugbyWinnerOf(state, 'sf2'),
  }
  return { ...state, fixtures: [...state.fixtures, final] }
}

export function rugbySeasonComplete(state: RugbyLeagueState): boolean {
  return state.phase === 'playoffs' && state.results['final'] !== undefined
}

export function advanceRugbySeason(state: RugbyLeagueState): RugbyLeagueState {
  if (!rugbySeasonComplete(state)) return state
  const table = computeRugbyStandings(state)
  const record: SeasonRecord = {
    season: state.season,
    championId: rugbyWinnerOf(state, 'final'),
    shieldId: table[0].teamId,
    table: table.map((r) => ({ teamId: r.teamId, points: r.points, gd: r.pd })),
  }
  const n = table.length
  const big: string[] = []
  const teams = state.teams.map((t) => {
    const pos = table.findIndex((r) => r.teamId === t.identity.id)
    const p = pos >= 0 ? pos : Math.floor(n / 2)
    const formSignal = n > 1 ? 1 - (2 * p) / (n - 1) : 0
    const rng = makeRng(`${state.seedKey}:offseason:s${state.season}:${t.identity.id}`)
    const adj = offseasonAdjust(t.glicko, formSignal, rng)
    if (adj.big) big.push(t.identity.id)
    return { ...t, glicko: adj.glicko }
  })
  return {
    ...state,
    season: state.season + 1,
    phase: 'regular',
    teams,
    fixtures: generateFixtures(teams.map((t) => t.identity.id)),
    results: {},
    history: [...state.history, record],
    offseasonBig: big,
  }
}

// --- persistence (own namespace so soccer's league listing never sees it) ---

const LS_RUGBY = 'elitesim:rugbyleague:'

export function saveRugbyLocal(state: RugbyLeagueState): void {
  localStorage.setItem(LS_RUGBY + state.id, JSON.stringify(state))
}

export function loadRugbyLocal(id: string): RugbyLeagueState | null {
  const raw = localStorage.getItem(LS_RUGBY + id)
  if (!raw) return null
  try {
    return JSON.parse(raw) as RugbyLeagueState
  } catch {
    return null
  }
}
