// The Apex Tour season engine — golf's fork of the league spine. An individual
// sport plays as a CALENDAR, not a fixture grid: 14 events (10 tournaments +
// 4 majors, the Pinnacle Championship closing the year), four 9-hole rounds
// each, a season-long rankings points race, Glicko updated per event from
// pairwise finishes, and a career stats book that fuels the storylines.
// Deliberately its own module: the soccer/rugby league paths are untouched.

import { makeRng } from '../sim/prng'
import { simulateGolfRound } from '../sim/golfSim'
import {
  GOLF_SIM_VERSION,
  FIELD_SIZE,
  type GolferRating,
  type GolfRoundConfig,
  type GolfRoundResult,
} from '../sim/golfTypes'
import { updateGlicko, offseasonAdjust, type GameResult } from '../ratings/glicko2'
import { generateGolfTour, type TourGolfer } from '../ratings/golfers'
import { toGolferRating } from '../ratings/golfStrength'
import { EVENTS_PER_SEASON, eventById, golfCourseById, seasonSchedule } from '../ratings/golfCourses'

export const ROUNDS_PER_EVENT = 4

/** Rankings points by finish position; majors pay DOUBLE. */
export const GOLF_POINTS = [500, 300, 190, 135, 105, 80, 60, 45]
export const MAJOR_MULTIPLIER = 2

export interface GolferCareer {
  starts: number
  wins: number
  majorWins: number
  top3s: number
  runnerUps: number
  winlessStreak: number // consecutive starts without a win
  blownLeads: number // led entering the final round, didn't win
  comebackWins: number // won from 3+ back entering the final round
  wireToWire: number // led (or co-led) after every round of a win
  seasonsWon: number // rankings titles
}

export interface GolfEventRecord {
  eventIndex: number // schedule position 0..13 (for ordering/display)
  eventId: string // the event def id — the venue actually played this season
  season: number
  finishOrder: string[] // golfer ids, best -> worst
  totalToPar: number[] // aligned with finishOrder
  winnerId: string
  wireToWire: boolean
  comeback: boolean
  blownLeadId?: string
  /** Point-in-time career milestones, frozen when the event completed (so captions
   * built later from an advanced/whole-season state stay accurate). */
  winnerFirstWin: boolean // this win was the winner's first career win
  winnerFirstMajor: boolean // a major, and the winner's first career major
  /** Frozen replay data: the exact field ratings + per-round scores (tour order). */
  field: GolferRating[]
  toParByRound: number[][]
}

export interface GolfEventState {
  eventIndex: number // schedule position 0..13
  eventId: string // the event def id (this season's venue at that position)
  roundsPlayed: number // 0..4
  /**
   * The field's playing strengths, SNAPSHOTTED when the event starts. Glicko
   * moves after every event, so configs must read this frozen field — it is
   * what makes any past round's video re-render byte-identically forever.
   */
  field: GolferRating[] // tour order
  /** toParByRound[round][i] is TOUR-ORDER golfer i's score for that round. */
  toParByRound: number[][]
  totalToPar: number[] // tour order, sum of rounds played
}

export interface GolfSeasonRecord {
  season: number
  rankingsChampionId: string
  majorWinners: Array<{ eventIndex: number; golferId: string }>
  points: Record<string, number>
}

export interface GolfSeasonState {
  id: string
  name: string
  seedKey: string
  season: number
  golfers: TourGolfer[]
  current: GolfEventState // the event in progress (or about to start)
  completed: GolfEventRecord[] // finished events THIS season
  points: Record<string, number>
  career: Record<string, GolferCareer>
  history: GolfSeasonRecord[]
  simVersion: number
  offseasonBig?: string[]
  /** Optional per-season RESULT seed (see golfResultSeed). Absent = the default
   * `${seedKey}:s${season}`; set by the auto-roll selector to re-roll outcomes. */
  resultSeed?: string
}

function freshCareer(): GolferCareer {
  return {
    starts: 0, wins: 0, majorWins: 0, top3s: 0, runnerUps: 0,
    winlessStreak: 0, blownLeads: 0, comebackWins: 0, wireToWire: 0, seasonsWon: 0,
  }
}

function freshEvent(eventIndex: number, eventId: string, golfers: TourGolfer[]): GolfEventState {
  return {
    eventIndex,
    eventId,
    roundsPlayed: 0,
    field: golfers.map(toGolferRating),
    toParByRound: [],
    totalToPar: Array(FIELD_SIZE).fill(0),
  }
}

/** The event id at a schedule position for a tour's given season. */
function scheduledEventId(seedKey: string, season: number, eventIndex: number): string {
  return seasonSchedule(seedKey, season)[eventIndex]
}

export function createGolfSeason(seedKey: string, name: string, id: string = seedKey): GolfSeasonState {
  const golfers = generateGolfTour(seedKey)
  const career: Record<string, GolferCareer> = {}
  const points: Record<string, number> = {}
  for (const g of golfers) {
    career[g.identity.id] = freshCareer()
    points[g.identity.id] = 0
  }
  return {
    id, name, seedKey,
    season: 1,
    golfers,
    current: freshEvent(0, scheduledEventId(seedKey, 1, 0), golfers),
    completed: [],
    points, career,
    history: [],
    simVersion: GOLF_SIM_VERSION,
  }
}

export function golferById(state: GolfSeasonState, id: string): TourGolfer {
  const g = state.golfers.find((x) => x.identity.id === id)
  if (!g) throw new Error(`Unknown golfer ${id}`)
  return g
}

export function golfSeasonComplete(state: GolfSeasonState): boolean {
  return state.completed.length >= EVENTS_PER_SEASON
}

/**
 * Field order for a round: round 1 is a seeded draw; later rounds re-group by
 * the leaderboard with the LEADERS OUT LAST (indices 4..7 = the final group,
 * best of all at 7). Returns TOUR-ORDER indices in field order.
 */
/** The per-season RESULT seed — the prefix golf outcome seeds hang off. Defaults
 * to `${seedKey}:s${season}` (byte-identical). A season may carry an explicit
 * `resultSeed` (for its OWN season only) so the cadence can re-roll outcomes while
 * ratings + venue schedule stay derived from the root. */
export function golfResultSeed(state: GolfSeasonState, season: number): string {
  return season === state.season && state.resultSeed ? state.resultSeed : `${state.seedKey}:s${season}`
}

export function golfFieldOrder(state: GolfSeasonState, ev: GolfEventState, round: number, season = state.season): number[] {
  const n = state.golfers.length
  if (round === 1) {
    // seeded shuffle (Fisher-Yates on the deterministic stream). Thread `season`
    // so the draw seed agrees with the round-config seed even when rendering a
    // record whose season differs from state.season.
    const rng = makeRng(`${golfResultSeed(state, season)}:e${ev.eventIndex}:draw`)
    const order = state.golfers.map((_, i) => i)
    for (let i = n - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1))
      const tmp = order[i]
      order[i] = order[j]
      order[j] = tmp
    }
    return order
  }
  // worst first, leader hits last: sort DESC on total, ties by tour index
  return state.golfers
    .map((_, i) => i)
    .sort((a, b) => ev.totalToPar[b] - ev.totalToPar[a] || a - b)
}

/** Build the deterministic sim config for a round, from the event's FROZEN field. */
export function golfRoundConfig(
  state: GolfSeasonState,
  ev: GolfEventState,
  round: number,
  season = state.season,
): GolfRoundConfig {
  const event = eventById(ev.eventId)
  const order = golfFieldOrder(state, ev, round, season)
  return {
    seedKey: `${golfResultSeed(state, season)}:e${ev.eventIndex}:r${round}`,
    course: golfCourseById(event.courseId),
    golfers: order.map((i) => ev.field[i]),
    round,
    startToPar: order.map((i) => ev.totalToPar[i]),
  }
}

/** Deterministic re-sim of any round of an event in progress (for video render/export). */
export function golfRoundResult(
  state: GolfSeasonState,
  ev: GolfEventState,
  round: number,
  season = state.season,
): GolfRoundResult {
  // Rebuild the event state as it stood BEFORE `round` so the config matches.
  const before: GolfEventState = {
    eventIndex: ev.eventIndex,
    eventId: ev.eventId,
    roundsPlayed: round - 1,
    field: ev.field,
    toParByRound: ev.toParByRound.slice(0, round - 1),
    totalToPar: state.golfers.map((_, i) =>
      ev.toParByRound.slice(0, round - 1).reduce((s, r) => s + r[i], 0),
    ),
  }
  return simulateGolfRound(golfRoundConfig(state, before, round, season))
}

/** Deterministic re-sim of any round of a COMPLETED event, from its frozen record. */
export function golfRecordRoundResult(
  state: GolfSeasonState,
  record: GolfEventRecord,
  round: number,
): GolfRoundResult {
  const ev: GolfEventState = {
    eventIndex: record.eventIndex,
    eventId: record.eventId,
    roundsPlayed: ROUNDS_PER_EVENT,
    field: record.field,
    toParByRound: record.toParByRound,
    totalToPar: state.golfers.map((_, i) => record.toParByRound.reduce((s, r) => s + r[i], 0)),
  }
  return golfRoundResult(state, ev, round, record.season)
}

/** Finish order of a COMPLETE event: total, then final-round countback, then id. */
function finishOrderOf(state: GolfSeasonState, ev: GolfEventState): number[] {
  const last = ev.toParByRound[ROUNDS_PER_EVENT - 1]
  return state.golfers
    .map((_, i) => i)
    .sort((a, b) => ev.totalToPar[a] - ev.totalToPar[b] || last[a] - last[b] || a - b)
}

function leaderAfter(state: GolfSeasonState, ev: GolfEventState, rounds: number): number | null {
  const totals = state.golfers.map((_, i) => ev.toParByRound.slice(0, rounds).reduce((s, r) => s + r[i], 0))
  const best = Math.min(...totals)
  const leaders = totals.map((v, i) => (v === best ? i : -1)).filter((i) => i >= 0)
  return leaders.length === 1 ? leaders[0] : null
}

function coLeaderAfter(state: GolfSeasonState, ev: GolfEventState, rounds: number, golfer: number): boolean {
  const totals = state.golfers.map((_, i) => ev.toParByRound.slice(0, rounds).reduce((s, r) => s + r[i], 0))
  return totals[golfer] === Math.min(...totals)
}

/**
 * Play the next round of the current event. Returns the new state AND the
 * simulated round (tour-order mapping included) for immediate viewing.
 */
export function playNextGolfRound(state: GolfSeasonState): { state: GolfSeasonState; result: GolfRoundResult } {
  if (golfSeasonComplete(state)) throw new Error('Season complete — advance to the next season first')
  const ev = state.current
  const round = ev.roundsPlayed + 1
  const result = simulateGolfRound(golfRoundConfig(state, ev, round))

  // fold field-order results back into tour order
  const order = golfFieldOrder(state, ev, round)
  const roundToPar = Array(FIELD_SIZE).fill(0) as number[]
  order.forEach((tourIdx, fieldIdx) => {
    roundToPar[tourIdx] = result.roundToPar[fieldIdx]
  })

  const nextEv: GolfEventState = {
    ...ev,
    roundsPlayed: round,
    toParByRound: [...ev.toParByRound, roundToPar],
    totalToPar: ev.totalToPar.map((v, i) => v + roundToPar[i]),
  }

  if (round < ROUNDS_PER_EVENT) {
    return { state: { ...state, current: nextEv }, result }
  }
  return { state: completeGolfEvent(state, nextEv), result }
}

/** Event over: points, Glicko, the career stats book, and the next tee time. */
function completeGolfEvent(state: GolfSeasonState, ev: GolfEventState): GolfSeasonState {
  const event = eventById(ev.eventId)
  const order = finishOrderOf(state, ev)
  const ids = order.map((i) => state.golfers[i].identity.id)
  const winnerIdx = order[0]
  const winnerId = ids[0]

  // rankings points
  const mult = event.major ? MAJOR_MULTIPLIER : 1
  const points = { ...state.points }
  order.forEach((tourIdx, pos) => {
    points[state.golfers[tourIdx].identity.id] += GOLF_POINTS[pos] * mult
  })

  // Glicko: every pairwise finish is a game (raw totals — strokes don't lie)
  const golfers = state.golfers.map((g, gi) => {
    const games: GameResult[] = state.golfers
      .map((opp, oi) => ({ opp, oi }))
      .filter(({ oi }) => oi !== gi)
      .map(({ opp, oi }) => ({
        opponent: opp.glicko,
        score: ev.totalToPar[gi] < ev.totalToPar[oi] ? 1 : ev.totalToPar[gi] > ev.totalToPar[oi] ? 0 : 0.5,
      }))
    return { ...g, glicko: updateGlicko(g.glicko, games) }
  })

  // the stats book
  const r3Leader = leaderAfter(state, ev, 3)
  const wireToWire =
    coLeaderAfter(state, ev, 1, winnerIdx) &&
    coLeaderAfter(state, ev, 2, winnerIdx) &&
    coLeaderAfter(state, ev, 3, winnerIdx)
  const winnerR3Total = ev.toParByRound.slice(0, 3).reduce((s, r) => s + r[winnerIdx], 0)
  const bestR3Total = Math.min(...state.golfers.map((_, i) => ev.toParByRound.slice(0, 3).reduce((s, r) => s + r[i], 0)))
  const comeback = winnerR3Total - bestR3Total >= 3

  const career = { ...state.career }
  order.forEach((tourIdx, pos) => {
    const id = state.golfers[tourIdx].identity.id
    const c = { ...career[id] }
    c.starts += 1
    if (pos === 0) {
      c.wins += 1
      c.winlessStreak = 0
      if (event.major) c.majorWins += 1
      if (wireToWire) c.wireToWire += 1
      if (comeback) c.comebackWins += 1
    } else {
      c.winlessStreak += 1
      if (pos === 1) c.runnerUps += 1
    }
    if (pos <= 2) c.top3s += 1
    career[id] = c
  })
  let blownLeadId: string | undefined
  if (r3Leader !== null && r3Leader !== winnerIdx) {
    blownLeadId = state.golfers[r3Leader].identity.id
    career[blownLeadId] = { ...career[blownLeadId], blownLeads: career[blownLeadId].blownLeads + 1 }
  }

  // Milestone status of the winner BEFORE this event folds into their career.
  const preWinner = state.career[winnerId]
  const winnerFirstWin = preWinner.wins === 0
  const winnerFirstMajor = event.major && preWinner.majorWins === 0

  const record: GolfEventRecord = {
    eventIndex: ev.eventIndex,
    eventId: ev.eventId,
    season: state.season,
    finishOrder: ids,
    totalToPar: order.map((i) => ev.totalToPar[i]),
    winnerId,
    wireToWire,
    comeback,
    blownLeadId,
    winnerFirstWin,
    winnerFirstMajor,
    field: ev.field,
    toParByRound: ev.toParByRound,
  }

  const completed = [...state.completed, record]
  const nextIndex = ev.eventIndex + 1
  return {
    ...state,
    golfers,
    points,
    career,
    completed,
    current:
      nextIndex < EVENTS_PER_SEASON
        ? freshEvent(nextIndex, scheduledEventId(state.seedKey, state.season, nextIndex), golfers)
        : { ...ev, roundsPlayed: ROUNDS_PER_EVENT },
  }
}

/** Cumulative rankings points earned across a set of completed events (majors pay double). */
function pointsThroughEvents(records: GolfEventRecord[]): Record<string, number> {
  const points: Record<string, number> = {}
  for (const r of records) {
    const mult = eventById(r.eventId).major ? MAJOR_MULTIPLIER : 1
    r.finishOrder.forEach((id, pos) => {
      points[id] = (points[id] ?? 0) + (GOLF_POINTS[pos] ?? 0) * mult
    })
  }
  return points
}

/**
 * A season-state view AS OF the end of a given event (by schedule index): only
 * the events up to and including it count as completed, and points are recomputed
 * cumulatively through them. Golfer identities are unchanged — the rankings card
 * shows names / points / wins / majors / top-3, not live ratings — so this renders
 * the exact standings that stood after that event. Powers the "rankings after
 * every event" posts in the season download. Pure and deterministic.
 */
export function golfRankingsSnapshot(state: GolfSeasonState, throughEventIndex: number): GolfSeasonState {
  const completed = state.completed
    .filter((r) => r.eventIndex <= throughEventIndex)
    .sort((a, b) => a.eventIndex - b.eventIndex)
  return { ...state, completed, points: pointsThroughEvents(completed) }
}

/** Season rankings, best first (points, then wins, then id). */
export function golfRankings(state: GolfSeasonState): Array<{ golferId: string; points: number; wins: number }> {
  return state.golfers
    .map((g) => {
      const id = g.identity.id
      const wins = state.completed.filter((r) => r.winnerId === id).length
      return { golferId: id, points: state.points[id] ?? 0, wins }
    })
    .sort((a, b) => b.points - a.points || b.wins - a.wins || a.golferId.localeCompare(b.golferId))
}

/**
 * Play every remaining round of the current season, returning the fully
 * completed state (all 14 events in `completed`). Deterministic — it just
 * drives `playNextGolfRound` to the end. Does NOT advance to the next season,
 * so the caller can read `completed`/`career`/`points` before the offseason
 * reset. A no-op if the season is already complete.
 */
export function simGolfSeasonToEnd(state: GolfSeasonState): GolfSeasonState {
  let s = state
  while (!golfSeasonComplete(s)) {
    s = playNextGolfRound(s).state
  }
  return s
}

/** Roll into the next season: crown the rankings champion, drift the ratings. */
export function advanceGolfSeason(state: GolfSeasonState): GolfSeasonState {
  return advanceGolfSeasonWithSeed(state)
}

/** advanceGolfSeason, but the NEXT season's outcomes hang off `resultRoll` instead
 * of the default `${seedKey}:s${nextSeason}`. Ratings carry + offseason drift +
 * venue schedule are UNCHANGED (derived from the root), so omitting `resultRoll`
 * is byte-identical. Used by the auto-roll selector. */
export function advanceGolfSeasonWithSeed(state: GolfSeasonState, resultRoll?: string): GolfSeasonState {
  if (!golfSeasonComplete(state)) return state
  const rankings = golfRankings(state)
  const championId = rankings[0].golferId
  const record: GolfSeasonRecord = {
    season: state.season,
    rankingsChampionId: championId,
    majorWinners: state.completed
      .filter((r) => eventById(r.eventId).major)
      .map((r) => ({ eventIndex: r.eventIndex, golferId: r.winnerId })),
    points: { ...state.points },
  }
  const career = { ...state.career }
  career[championId] = { ...career[championId], seasonsWon: career[championId].seasonsWon + 1 }

  const n = rankings.length
  const big: string[] = []
  const golfers = state.golfers.map((g) => {
    const pos = rankings.findIndex((r) => r.golferId === g.identity.id)
    const formSignal = n > 1 ? 1 - (2 * pos) / (n - 1) : 0
    const rng = makeRng(`${state.seedKey}:offseason:s${state.season}:${g.identity.id}`)
    const adj = offseasonAdjust(g.glicko, formSignal, rng)
    if (adj.big) big.push(g.identity.id)
    return { ...g, glicko: adj.glicko }
  })

  const points: Record<string, number> = {}
  for (const g of golfers) points[g.identity.id] = 0
  const nextSeason = state.season + 1
  return {
    ...state,
    season: nextSeason,
    resultSeed: resultRoll ?? `${state.seedKey}:s${nextSeason}`,
    golfers,
    current: freshEvent(0, scheduledEventId(state.seedKey, nextSeason, 0), golfers),
    completed: [],
    points,
    career,
    history: [...state.history, record],
    offseasonBig: big,
  }
}

// --- persistence (own namespace so the other sports never see it) ---

const LS_GOLF = 'elitesim:golfseason:'

export function saveGolfLocal(state: GolfSeasonState): void {
  localStorage.setItem(LS_GOLF + state.id, JSON.stringify(state))
}

export function loadGolfLocal(id: string): GolfSeasonState | null {
  const raw = localStorage.getItem(LS_GOLF + id)
  if (!raw) return null
  try {
    return JSON.parse(raw) as GolfSeasonState
  } catch {
    return null
  }
}
