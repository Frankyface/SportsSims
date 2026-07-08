import { describe, expect, it } from 'vitest'
import { simulateRugbyMatch } from './rugbySim'
import type { TeamRating } from './types'

/**
 * GOLDEN GUARD — rugby score compatibility with saved leagues.
 *
 * Saved rugby leagues will store no timelines; every fixture is re-simulated
 * from its seedKey. Any added/removed/reordered rng() call on the rugby
 * score-deciding stream silently rewrites history. This snapshot freezes the
 * stream at RUGBY_SIM_VERSION 1.
 *
 * Never update this snapshot without an explicit, understood decision about
 * exactly which matches change and why (see scoreCompat.test.ts for the
 * discipline the soccer engine follows).
 */

function fnv1a(s: string): string {
  let h = 0x811c9dc5
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return (h >>> 0).toString(16).padStart(8, '0')
}

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

const PROFILES = [
  {
    name: 'even',
    home: team('EVH', { attack: 1.02, defense: 0.99, finishing: 1.01 }),
    away: team('EVA', { attack: 0.98, defense: 1.03, finishing: 0.97 }),
  },
  {
    name: 'mismatch',
    home: team('BIG', { attack: 1.24, defense: 1.18, finishing: 1.15, discipline: 1.2 }),
    away: team('SML', { attack: 0.81, defense: 0.84, finishing: 0.86, discipline: 0.85 }),
  },
  {
    name: 'wild',
    home: team('WLH', { attack: 0.95, defense: 0.92, formSpread: 0.32 }),
    away: team('WLA', { attack: 1.06, defense: 1.02, formSpread: 0.28 }),
  },
] as const

describe('simulateRugbyMatch — golden score compatibility with saved leagues', () => {
  it('reproduces the frozen v1 scores/events for a spread of seeds', () => {
    const digests: string[] = []
    for (const p of PROFILES) {
      for (let i = 0; i < 10; i++) {
        const seedKey = `goldenRugby:${p.name}:${i}`
        const r = simulateRugbyMatch({ seedKey, home: p.home, away: p.away, homeAdvantage: 1.1 })
        // digest ONLY the frozen surface: score, stats, events — additive
        // RugbyMatchResult fields stay out so they can evolve freely
        const frozen = JSON.stringify({ score: r.score, stats: r.stats, events: r.events })
        const tries = r.events
          .filter((e) => e.type === 'try')
          .map((e) => `${e.team === 'home' ? 'H' : 'A'}${e.minute}`)
          .join(',')
        digests.push(
          `${seedKey} ${r.score[0]}-${r.score[1]} [${tries}] pens:${r.stats.penaltyGoals[0]}/${r.stats.penaltyGoals[1]} fnv:${fnv1a(frozen)}`,
        )
      }
    }
    expect(digests).toMatchSnapshot()
  })
})
