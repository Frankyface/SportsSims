import { describe, expect, it } from 'vitest'
import { simulateRugbyMatch } from './rugbySim'
import type { RugbyMatchConfig } from './rugbyTypes'
import type { TeamRating } from './types'

function team(id: string, overrides: Partial<TeamRating> = {}): TeamRating {
  return {
    id,
    name: id,
    abbr: id.slice(0, 3).toUpperCase(),
    city: id,
    color: '#ffffff',
    colorAlt: '#000000',
    attack: 1,
    defense: 1,
    finishing: 1,
    discipline: 1,
    formSpread: 0.15,
    ...overrides,
  }
}

function cfg(seedKey: string): RugbyMatchConfig {
  return {
    seedKey,
    home: team('Carrick', { attack: 1.05 }),
    away: team('Kanbar', { attack: 0.98 }),
    homeAdvantage: 1.1,
  }
}

const POINTS: Record<string, number> = { try: 5, conversion: 2, penaltyGoal: 3, dropGoal: 3 }

describe('simulateRugbyMatch — determinism', () => {
  it('same seed → byte-identical result', () => {
    const a = simulateRugbyMatch(cfg('RL1:S1:R1:M1'))
    const b = simulateRugbyMatch(cfg('RL1:S1:R1:M1'))
    expect(JSON.stringify(a)).toBe(JSON.stringify(b))
  })

  it('different seed → different result', () => {
    const a = simulateRugbyMatch(cfg('RL1:S1:R1:M1'))
    const b = simulateRugbyMatch(cfg('RL1:S1:R1:M2'))
    expect(JSON.stringify(a)).not.toBe(JSON.stringify(b))
  })
})

describe('simulateRugbyMatch — result shape', () => {
  it('bookends, minute range, and score arithmetic all hold', () => {
    for (let i = 0; i < 40; i++) {
      const r = simulateRugbyMatch(cfg(`shape:${i}`))
      expect(r.events[0].type).toBe('kickoff')
      expect(r.events[r.events.length - 1].type).toBe('fulltime')
      expect(r.events.filter((e) => e.type === 'halftime')).toHaveLength(1)

      const tally: [number, number] = [0, 0]
      for (const e of r.events) {
        expect(e.minute).toBeGreaterThanOrEqual(0)
        expect(e.minute).toBeLessThanOrEqual(80)
        const pts = POINTS[e.type]
        if (pts && e.team) tally[e.team === 'home' ? 0 : 1] += pts
      }
      expect(r.score).toEqual(tally)
      expect(r.score[0]).toBe(
        r.stats.tries[0] * 5 + r.stats.conversions[0] * 2 + r.stats.penaltyGoals[0] * 3 + r.stats.dropGoals[0] * 3,
      )
      expect(r.score[1]).toBe(
        r.stats.tries[1] * 5 + r.stats.conversions[1] * 2 + r.stats.penaltyGoals[1] * 3 + r.stats.dropGoals[1] * 3,
      )
    }
  })

  it('every try is followed at id+1 by its conversion event (frozen convention)', () => {
    for (let i = 0; i < 40; i++) {
      const r = simulateRugbyMatch(cfg(`conv:${i}`))
      const byId = new Map(r.events.map((e) => [e.id, e]))
      for (const e of r.events) {
        if (e.type !== 'try') continue
        const next = byId.get(e.id + 1)
        expect(next).toBeDefined()
        expect(['conversion', 'conversionMiss']).toContain(next!.type)
        expect(next!.team).toBe(e.team)
      }
    }
  })

  it('possession spans are contiguous and cover the whole match', () => {
    const r = simulateRugbyMatch(cfg('spans:0'))
    expect(r.possessions[0].start).toBe(0)
    for (let i = 1; i < r.possessions.length; i++) {
      expect(r.possessions[i].start).toBe(r.possessions[i - 1].end)
    }
    expect(r.possessions[r.possessions.length - 1].end).toBeGreaterThanOrEqual(80 * 60)
  })
})

describe('simulateRugbyMatch — Monte-Carlo calibration', () => {
  it('resembles real club rugby union across many matches', () => {
    const N = 3000
    let points = 0
    let tries = 0
    let convMade = 0
    let penGoals = 0
    let dropGoals = 0
    let yellows = 0
    let reds = 0
    let draws = 0
    for (let i = 0; i < N; i++) {
      const r = simulateRugbyMatch(cfg(`rcal:${i}`))
      points += r.score[0] + r.score[1]
      tries += r.stats.tries[0] + r.stats.tries[1]
      convMade += r.stats.conversions[0] + r.stats.conversions[1]
      penGoals += r.stats.penaltyGoals[0] + r.stats.penaltyGoals[1]
      dropGoals += r.stats.dropGoals[0] + r.stats.dropGoals[1]
      yellows += r.stats.yellow[0] + r.stats.yellow[1]
      reds += r.stats.red[0] + r.stats.red[1]
      if (r.score[0] === r.score[1]) draws++
    }
    const avgPoints = points / N
    const avgTries = tries / N
    const convRate = convMade / Math.max(1, tries)
    const avgPens = penGoals / N
    const drawRate = draws / N
    console.log('[rugby calibration]', {
      avgPoints,
      avgTries,
      convRate,
      avgPens,
      avgDrops: dropGoals / N,
      avgYellows: yellows / N,
      avgReds: reds / N,
      drawRate,
    })
    // real-world anchors: ~45-50 total points, ~5-6 tries, ~70-75% conversions,
    // ~3-4 penalty goals, draws rare (~2%)
    expect(avgPoints).toBeGreaterThan(36)
    expect(avgPoints).toBeLessThan(60)
    expect(avgTries).toBeGreaterThan(3.5)
    expect(avgTries).toBeLessThan(8)
    expect(convRate).toBeGreaterThan(0.6)
    expect(convRate).toBeLessThan(0.9)
    expect(avgPens).toBeGreaterThan(2)
    expect(avgPens).toBeLessThan(6.5)
    expect(drawRate).toBeLessThan(0.07)
    expect(yellows / N).toBeGreaterThan(0.5)
    expect(yellows / N).toBeLessThan(2.5)
  })
})

describe('simulateRugbyMatch — a red card is a real disadvantage', () => {
  it('teams sent off before the hour lose measurably more often', () => {
    const N = 6000
    let redMatches = 0
    let redLosses = 0
    let cleanMatches = 0
    let cleanLosses = 0
    for (let i = 0; i < N; i++) {
      const r = simulateRugbyMatch({
        seedKey: `rugbyredmc:${i}`,
        home: team('EqualA'),
        away: team('EqualB'),
        homeAdvantage: 1,
      })
      const homeRed = r.events.find((e) => e.type === 'red' && e.team === 'home')
      const awayRed = r.events.some((e) => e.type === 'red' && e.team === 'away')
      if (homeRed && !awayRed && homeRed.minute <= 60) {
        redMatches++
        if (r.score[0] < r.score[1]) redLosses++
      } else if (!homeRed && !awayRed) {
        cleanMatches++
        if (r.score[0] < r.score[1]) cleanLosses++
      }
    }
    const redLossRate = redLosses / Math.max(1, redMatches)
    const cleanLossRate = cleanLosses / Math.max(1, cleanMatches)
    console.log('[rugby red-card]', { redMatches, redLossRate, cleanMatches, cleanLossRate })
    expect(redMatches).toBeGreaterThan(50)
    expect(redLossRate).toBeGreaterThan(cleanLossRate + 0.1)
  })
})
