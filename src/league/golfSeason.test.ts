import { describe, it, expect } from 'vitest'
import {
  advanceGolfSeason,
  createGolfSeason,
  golfFieldOrder,
  golfRankings,
  golfRecordRoundResult,
  golfRoundResult,
  golfSeasonComplete,
  playNextGolfRound,
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
