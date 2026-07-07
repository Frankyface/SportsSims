import { describe, it, expect } from 'vitest'
import { updateGlicko, decayGlicko, winProbability, type Glicko } from './glicko2'

describe('glicko2 — canonical worked example (Glickman 2013)', () => {
  it('reproduces the published result within tolerance', () => {
    const player: Glicko = { rating: 1500, rd: 200, vol: 0.06 }
    const result = updateGlicko(
      player,
      [
        { opponent: { rating: 1400, rd: 30, vol: 0.06 }, score: 1 },
        { opponent: { rating: 1550, rd: 100, vol: 0.06 }, score: 0 },
        { opponent: { rating: 1700, rd: 300, vol: 0.06 }, score: 0 },
      ],
      0.5,
    )
    // Paper: rating ~1464.06, RD ~151.52, vol ~0.05999
    expect(result.rating).toBeCloseTo(1464.06, 1)
    expect(result.rd).toBeCloseTo(151.52, 1)
    expect(result.vol).toBeCloseTo(0.05999, 4)
  })
})

describe('glicko2 — behaviour', () => {
  it('raises rating on a win vs an equal, lowers on a loss', () => {
    const p: Glicko = { rating: 1500, rd: 80, vol: 0.06 }
    const opp: Glicko = { rating: 1500, rd: 80, vol: 0.06 }
    const win = updateGlicko(p, [{ opponent: opp, score: 1 }])
    const loss = updateGlicko(p, [{ opponent: opp, score: 0 }])
    expect(win.rating).toBeGreaterThan(1500)
    expect(loss.rating).toBeLessThan(1500)
  })

  it('grows RD when no games are played', () => {
    const p: Glicko = { rating: 1500, rd: 80, vol: 0.06 }
    expect(updateGlicko(p, []).rd).toBeGreaterThan(80)
  })

  it('decay regresses rating toward 1500 and inflates RD', () => {
    const strong: Glicko = { rating: 1800, rd: 60, vol: 0.06 }
    const d = decayGlicko(strong)
    expect(d.rating).toBeLessThan(1800)
    expect(d.rating).toBeGreaterThan(1500)
    expect(d.rd).toBeGreaterThan(60)
  })

  it('winProbability favours the stronger side but is never 0 or 1', () => {
    const strong: Glicko = { rating: 1800, rd: 50, vol: 0.06 }
    const weak: Glicko = { rating: 1300, rd: 50, vol: 0.06 }
    const p = winProbability(strong, weak)
    expect(p).toBeGreaterThan(0.6)
    expect(p).toBeLessThan(1)
  })
})
