import { describe, it, expect } from 'vitest'
import { dramaScore, matchOfWeekIds } from './matchOfWeek'
import type { MatchEvent, MatchResult } from '../sim/types'

function ev(type: MatchEvent['type'], minute: number, scoreAfter: [number, number]): MatchEvent {
  return { id: 0, minute, type, team: 'home', scoreAfter, momentumAfter: 0 }
}

function match(score: [number, number], events: MatchEvent[]): MatchResult {
  return {
    simVersion: 4,
    config: { seedKey: 'x', home: {} as never, away: {} as never, homeAdvantage: 1.1 },
    score,
    events,
    stats: {} as never,
    possessions: [],
    renderSeed: 0,
  }
}

describe('matchOfWeek — drama score', () => {
  it('rates a back-and-forth thriller above a drab draw', () => {
    const thriller = match([3, 3], [
      ev('goal', 10, [1, 0]),
      ev('goal', 30, [1, 1]),
      ev('goal', 55, [1, 2]),
      ev('goal', 70, [2, 2]),
      ev('goal', 84, [2, 3]),
      ev('goal', 90, [3, 3]),
    ])
    const drab = match([0, 0], [])
    expect(dramaScore(thriller)).toBeGreaterThan(dramaScore(drab))
  })

  it('penalises a blowout relative to a tight game with the same goals', () => {
    const blowout = match([5, 1], [
      ev('goal', 5, [1, 0]),
      ev('goal', 20, [2, 0]),
      ev('goal', 35, [3, 0]),
      ev('goal', 50, [4, 0]),
      ev('goal', 65, [5, 0]),
      ev('goal', 80, [5, 1]),
    ])
    const tight = match([3, 3], [
      ev('goal', 12, [1, 0]),
      ev('goal', 25, [1, 1]),
      ev('goal', 44, [2, 1]),
      ev('goal', 60, [2, 2]),
      ev('goal', 75, [3, 2]),
      ev('goal', 88, [3, 3]),
    ])
    expect(dramaScore(tight)).toBeGreaterThan(dramaScore(blowout))
  })

  it('rewards a late winner and a red card', () => {
    const base = match([1, 0], [ev('goal', 30, [1, 0])])
    const lateWinner = match([1, 0], [ev('goal', 89, [1, 0])])
    const withRed = match([1, 0], [ev('goal', 30, [1, 0]), ev('red', 55, [1, 0])])
    expect(dramaScore(lateWinner)).toBeGreaterThan(dramaScore(base))
    expect(dramaScore(withRed)).toBeGreaterThan(dramaScore(base))
  })

  it('picks exactly one Match of the Week per round', () => {
    const results = new Map<string, MatchResult>([
      ['f0', match([0, 0], [])],
      ['f1', match([3, 2], [ev('goal', 10, [1, 0]), ev('goal', 40, [1, 1]), ev('goal', 60, [2, 1]), ev('goal', 75, [2, 2]), ev('goal', 88, [3, 2])])],
      ['f2', match([1, 0], [ev('goal', 20, [1, 0])])],
      ['g0', match([2, 2], [ev('goal', 15, [1, 0]), ev('goal', 50, [1, 1]), ev('goal', 70, [2, 1]), ev('goal', 85, [2, 2])])],
      ['g1', match([0, 0], [])],
    ])
    const fixtures = [
      { id: 'f0', round: 0 },
      { id: 'f1', round: 0 },
      { id: 'f2', round: 0 },
      { id: 'g0', round: 1 },
      { id: 'g1', round: 1 },
    ]
    const motw = matchOfWeekIds(fixtures, results)
    expect(motw.size).toBe(2) // one per round
    expect(motw.has('f1')).toBe(true) // the round-0 thriller
    expect(motw.has('g0')).toBe(true) // the round-1 thriller
  })
})
