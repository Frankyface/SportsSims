import { describe, it, expect } from 'vitest'
import { simulateMatch } from './simulateMatch'
import type { MatchConfig, TeamRating } from './types'

function team(id: string, name: string, over: Partial<TeamRating> = {}): TeamRating {
  return {
    id,
    name,
    abbr: id,
    city: name,
    color: '#ffffff',
    colorAlt: '#000000',
    attack: 1,
    defense: 1,
    finishing: 1,
    discipline: 1,
    ...over,
  }
}

const cfg = (seedKey: string): MatchConfig => ({
  seedKey,
  homeAdvantage: 1.1,
  home: team('CAR', 'Cardinals', { attack: 1.05 }),
  away: team('KAN', 'Kangaroos', { attack: 0.98 }),
})

describe('simulateMatch — determinism (load-bearing)', () => {
  it('is byte-identical for the same seed', () => {
    const a = simulateMatch(cfg('L1:S1:R1:M1'))
    const b = simulateMatch(cfg('L1:S1:R1:M1'))
    expect(JSON.stringify(a)).toEqual(JSON.stringify(b))
  })

  it('differs for different seeds', () => {
    const a = simulateMatch(cfg('L1:S1:R1:M1'))
    const b = simulateMatch(cfg('L1:S1:R1:M2'))
    expect(JSON.stringify(a)).not.toEqual(JSON.stringify(b))
  })
})

describe('simulateMatch — shape & consistency', () => {
  it('ends with full-time and a score that matches its goal events', () => {
    const r = simulateMatch(cfg('shape-check'))
    expect(r.events[r.events.length - 1].type).toBe('fulltime')
    const goals = r.events.filter((e) => e.type === 'goal')
    const home = goals.filter((g) => g.team === 'home').length
    const away = goals.filter((g) => g.team === 'away').length
    expect(r.score).toEqual([home, away])
  })

  it('keeps every event minute within 0..90', () => {
    const r = simulateMatch(cfg('minutes'))
    for (const e of r.events) {
      expect(e.minute).toBeGreaterThanOrEqual(0)
      expect(e.minute).toBeLessThanOrEqual(90)
    }
  })
})

describe('simulateMatch — Monte-Carlo calibration', () => {
  it('resembles real football across many matches', () => {
    const N = 3000
    let goals = 0
    let shots = 0
    let draws = 0
    for (let i = 0; i < N; i++) {
      const r = simulateMatch(cfg(`cal:${i}`))
      goals += r.score[0] + r.score[1]
      shots += r.stats.shots[0] + r.stats.shots[1]
      if (r.score[0] === r.score[1]) draws++
    }
    const avgGoals = goals / N
    const avgShots = shots / N
    const drawRate = draws / N
    // Surface actuals so we can tighten the model as we calibrate.
    console.log('[calibration]', { avgGoals, avgShots, drawRate })
    // Loose sanity bands (real anchors: ~2.7 goals, ~26 shots, ~25% draws).
    expect(avgGoals).toBeGreaterThan(1.8)
    expect(avgGoals).toBeLessThan(4.2)
    expect(avgShots).toBeGreaterThan(12)
    expect(avgShots).toBeLessThan(40)
    expect(drawRate).toBeGreaterThan(0.12)
    expect(drawRate).toBeLessThan(0.45)
  })
})
