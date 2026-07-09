import { describe, it, expect } from 'vitest'
import {
  advanceGolfSeason,
  createGolfSeason,
  golfFieldOrder,
  golfRankings,
  golfRankingsSnapshot,
  golfRecordRoundResult,
  golfRoundResult,
  golfSeasonComplete,
  playNextGolfRound,
  simGolfSeasonToEnd,
  GOLF_POINTS,
  MAJOR_MULTIPLIER,
  ROUNDS_PER_EVENT,
  type GolfSeasonState,
} from './golfSeason'
import { EVENTS_PER_SEASON, MAJOR_IDS, TOURNAMENT_IDS, eventById, seasonSchedule } from '../ratings/golfCourses'
import { FIELD_SIZE } from '../sim/golfTypes'

function playEvent(state: GolfSeasonState): GolfSeasonState {
  let s = state
  for (let r = 0; r < ROUNDS_PER_EVENT; r++) s = playNextGolfRound(s).state
  return s
}

describe('golf season engine', () => {
  it('creation is deterministic and starts at event 0, round 0', () => {
    const a = createGolfSeason('tour-a', 'The Apex Tour')
    const b = createGolfSeason('tour-a', 'The Apex Tour')
    expect(JSON.stringify(a)).toBe(JSON.stringify(b))
    expect(a.current.eventIndex).toBe(0)
    expect(a.current.roundsPlayed).toBe(0)
    expect(a.golfers).toHaveLength(FIELD_SIZE)
  })

  it('rounds accumulate and the event completes with points, career + record', () => {
    let s = createGolfSeason('tour-pts', 'The Apex Tour')
    for (let r = 1; r <= ROUNDS_PER_EVENT; r++) {
      const out = playNextGolfRound(s)
      s = out.state
      expect(out.result.config.round).toBe(r)
    }
    expect(s.completed).toHaveLength(1)
    const rec = s.completed[0]
    expect(rec.finishOrder).toHaveLength(FIELD_SIZE)
    // finish order sorted on totals
    for (let i = 1; i < rec.totalToPar.length; i++) {
      expect(rec.totalToPar[i - 1]).toBeLessThanOrEqual(rec.totalToPar[i])
    }
    // winner earned exactly the P1 purse (event 0 is always a tournament)
    expect(eventById(rec.eventId).major).toBe(false)
    expect(s.points[rec.winnerId]).toBe(GOLF_POINTS[0])
    // everyone made a start; the winner's streak reset, others' grew
    for (const g of s.golfers) {
      const c = s.career[g.identity.id]
      expect(c.starts).toBe(1)
      if (g.identity.id === rec.winnerId) {
        expect(c.wins).toBe(1)
        expect(c.winlessStreak).toBe(0)
      } else {
        expect(c.wins).toBe(0)
        expect(c.winlessStreak).toBe(1)
      }
    }
    // the next event is teed up
    expect(s.current.eventIndex).toBe(1)
    expect(s.current.roundsPlayed).toBe(0)
  })

  it('replay guarantee: live rounds re-sim byte-identically, even after the event closed', () => {
    let s = createGolfSeason('tour-replay', 'The Apex Tour')
    const live: string[] = []
    for (let r = 1; r <= ROUNDS_PER_EVENT; r++) {
      const out = playNextGolfRound(s)
      live.push(JSON.stringify(out.result))
      s = out.state
    }
    // event is complete (Glicko already moved) — replays must still match
    const rec = s.completed[0]
    for (let r = 1; r <= ROUNDS_PER_EVENT; r++) {
      expect(JSON.stringify(golfRecordRoundResult(s, rec, r))).toBe(live[r - 1])
    }
  })

  it('in-progress replay matches too', () => {
    let s = createGolfSeason('tour-mid', 'The Apex Tour')
    const r1 = playNextGolfRound(s)
    s = r1.state
    const r2 = playNextGolfRound(s)
    s = r2.state
    expect(JSON.stringify(golfRoundResult(s, s.current, 1))).toBe(JSON.stringify(r1.result))
    expect(JSON.stringify(golfRoundResult(s, s.current, 2))).toBe(JSON.stringify(r2.result))
  })

  it('rounds 2+ regroup with the leaders out last', () => {
    let s = createGolfSeason('tour-groups', 'The Apex Tour')
    s = playNextGolfRound(s).state
    const order = golfFieldOrder(s, s.current, 2)
    const totals = s.current.totalToPar
    for (let i = 1; i < order.length; i++) {
      expect(totals[order[i - 1]]).toBeGreaterThanOrEqual(totals[order[i]])
    }
  })

  it('a full season: 14 events, majors pay double, rollover crowns a champion', () => {
    let s = createGolfSeason('tour-season', 'The SGA')
    for (let e = 0; e < EVENTS_PER_SEASON; e++) s = playEvent(s)
    expect(golfSeasonComplete(s)).toBe(true)
    expect(s.completed).toHaveLength(14)

    // every major paid double
    const majorRecs = s.completed.filter((r) => eventById(r.eventId).major)
    expect(majorRecs).toHaveLength(4)
    const totalAwarded = Object.values(s.points).reduce((a, b) => a + b, 0)
    const purse = GOLF_POINTS.reduce((a, b) => a + b, 0)
    expect(totalAwarded).toBe(purse * 10 + purse * MAJOR_MULTIPLIER * 4)

    const rankings = golfRankings(s)
    expect(rankings[0].points).toBeGreaterThanOrEqual(rankings[1].points)

    const next = advanceGolfSeason(s)
    expect(next.season).toBe(2)
    expect(next.completed).toHaveLength(0)
    expect(next.current.eventIndex).toBe(0)
    expect(next.history).toHaveLength(1)
    expect(next.history[0].rankingsChampionId).toBe(rankings[0].golferId)
    expect(next.history[0].majorWinners).toHaveLength(4)
    expect(next.career[rankings[0].golferId].seasonsWon).toBe(1)
    // points reset for the new year
    expect(Object.values(next.points).every((p) => p === 0)).toBe(true)
    // ratings carried over with drift, not reset
    const changed = next.golfers.some(
      (g, i) => Math.abs(g.glicko.rating - s.golfers[i].glicko.rating) > 0.001,
    )
    expect(changed).toBe(true)
  })

  it('simGolfSeasonToEnd plays the whole season, deterministically, and is idempotent', () => {
    const a = simGolfSeasonToEnd(createGolfSeason('tour-to-end', 'The SGA'))
    expect(golfSeasonComplete(a)).toBe(true)
    expect(a.completed).toHaveLength(EVENTS_PER_SEASON)
    // identical to driving it one event at a time
    let manual = createGolfSeason('tour-to-end', 'The SGA')
    for (let e = 0; e < EVENTS_PER_SEASON; e++) manual = playEvent(manual)
    expect(JSON.stringify(a)).toBe(JSON.stringify(manual))
    // same seed → byte-identical outcome
    expect(JSON.stringify(simGolfSeasonToEnd(createGolfSeason('tour-to-end', 'The SGA')))).toBe(
      JSON.stringify(a),
    )
    // a complete season is returned untouched
    expect(simGolfSeasonToEnd(a)).toBe(a)
  })

  it('freezes each winner’s maiden-win / first-major status point-in-time on the record', () => {
    const s = simGolfSeasonToEnd(createGolfSeason('freeze-tour', 'The SGA'))
    const sorted = [...s.completed].sort((a, b) => a.eventIndex - b.eventIndex)
    const winsSoFar = new Map<string, number>()
    const majorsSoFar = new Map<string, number>()
    for (const r of sorted) {
      // winnerFirstWin is true iff this is the winner's earliest win of the season
      const priorWins = winsSoFar.get(r.winnerId) ?? 0
      expect(r.winnerFirstWin).toBe(priorWins === 0)
      winsSoFar.set(r.winnerId, priorWins + 1)
      // winnerFirstMajor is true iff a major AND the winner's earliest major win
      if (eventById(r.eventId).major) {
        const priorMajors = majorsSoFar.get(r.winnerId) ?? 0
        expect(r.winnerFirstMajor).toBe(priorMajors === 0)
        majorsSoFar.set(r.winnerId, priorMajors + 1)
      } else {
        expect(r.winnerFirstMajor).toBe(false)
      }
    }
    // the bug this guards only bites when a golfer wins 2+ events — with 14 events
    // and 8 golfers, at least one always does (so the check above is not vacuous)
    expect(Math.max(...winsSoFar.values())).toBeGreaterThanOrEqual(2)
  })

  it('golfRankingsSnapshot gives standings AS OF an event (sliced events, cumulative points)', () => {
    const s = simGolfSeasonToEnd(createGolfSeason('rank-snap', 'The SGA'))

    // after the first event: exactly one completed, the winner is the leader on
    // the winner's-share of points (500 × the event multiplier)
    const afterE0 = golfRankingsSnapshot(s, 0)
    expect(afterE0.completed).toHaveLength(1)
    const e0 = s.completed.find((r) => r.eventIndex === 0)!
    const mult0 = eventById(e0.eventId).major ? MAJOR_MULTIPLIER : 1
    expect(afterE0.points[e0.winnerId]).toBe(GOLF_POINTS[0] * mult0)
    expect(golfRankings(afterE0)[0].golferId).toBe(e0.winnerId)

    // points only accumulate as the season goes
    const afterE6 = golfRankingsSnapshot(s, 6)
    expect(afterE6.completed).toHaveLength(7)
    const total = (pts: Record<string, number>): number => Object.values(pts).reduce((a, b) => a + b, 0)
    expect(total(afterE6.points)).toBeGreaterThan(total(afterE0.points))

    // the final snapshot matches the real end-of-season standings exactly
    const afterLast = golfRankingsSnapshot(s, EVENTS_PER_SEASON - 1)
    expect(afterLast.completed).toHaveLength(EVENTS_PER_SEASON)
    for (const id of Object.keys(s.points)) {
      expect(afterLast.points[id]).toBe(s.points[id])
    }
  })

  it('a season rotates 10 of the 20 tournaments; the 4 majors sit at fixed slots', () => {
    expect(TOURNAMENT_IDS).toHaveLength(20)
    expect(MAJOR_IDS).toHaveLength(4)
    const sched = seasonSchedule('rot-tour', 3)
    expect(sched).toHaveLength(EVENTS_PER_SEASON)
    // majors at slots 3,7,10,13 in order; Pinnacle (championship) last
    expect(sched[3]).toBe('evergreen-invitational')
    expect(sched[7]).toBe('saltmarsh-open')
    expect(sched[10]).toBe('redrock-classic')
    expect(sched[13]).toBe('pinnacle-championship')
    // the 10 non-major slots are distinct tournaments from the pool
    const tourneys = sched.filter((id) => !eventById(id).major)
    expect(tourneys).toHaveLength(10)
    expect(new Set(tourneys).size).toBe(10)
    for (const id of tourneys) expect(TOURNAMENT_IDS).toContain(id)
    // deterministic
    expect(seasonSchedule('rot-tour', 3)).toEqual(sched)
    // different seasons visit different venues, and over enough seasons ALL 20 appear
    const seen = new Set<string>()
    for (let season = 1; season <= 12; season++) {
      for (const id of seasonSchedule('rot-tour', season)) if (!eventById(id).major) seen.add(id)
    }
    expect(seen.size).toBe(20)
  })
})
