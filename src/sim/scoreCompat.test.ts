import { describe, it, expect } from 'vitest'
import { simulateMatch } from './simulateMatch'
import type { MatchConfig, TeamRating } from './types'

// GOLDEN SCORE-COMPATIBILITY GUARD (load-bearing).
//
// League standings are never stored with their event timelines — every saved
// fixture is re-simulated from its seedKey on view/export. So the sim's main
// RNG stream is frozen: any change that adds, removes, or reorders an rng()
// call on that stream silently rewrites every saved league's history.
//
// The snapshot below was captured from SIM_VERSION 2 (the shipped v1 engine).
// It digests only the frozen surface — score, stats, events — so additive
// fields (e.g. possession spans for the continuous-play renderer) don't trip
// it, but ANY drift in the score-deciding math does.
//
// If this test fails you have broken replay identity for existing leagues.
// Do not update the snapshot unless that is an explicit, understood decision.

function fnv1a(s: string): string {
  let h = 0x811c9dc5
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return (h >>> 0).toString(16).padStart(8, '0')
}

function team(id: string, over: Partial<TeamRating> = {}): TeamRating {
  return {
    id,
    name: `${id} FC`,
    abbr: id,
    city: id,
    color: '#ffffff',
    colorAlt: '#000000',
    attack: 1,
    defense: 1,
    finishing: 1,
    discipline: 1,
    formSpread: 0.15,
    ...over,
  }
}

// Three rating profiles that exercise different sim branches: an even match,
// a heavy mismatch (more goals/cards one way), and a volatile upset-prone one.
const PROFILES: Array<{ name: string; home: TeamRating; away: TeamRating }> = [
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
]

describe('simulateMatch — golden score compatibility with saved leagues', () => {
  it('reproduces the frozen v2 scores/events for a spread of seeds', () => {
    const digests: string[] = []
    for (const p of PROFILES) {
      for (let i = 0; i < 10; i++) {
        const config: MatchConfig = {
          seedKey: `golden:${p.name}:${i}`,
          home: p.home,
          away: p.away,
          homeAdvantage: 1.1,
        }
        const r = simulateMatch(config)
        // Digest ONLY the frozen surface (score/stats/events) — additive
        // MatchResult fields are allowed, drift in these is not.
        const frozen = JSON.stringify({ score: r.score, stats: r.stats, events: r.events })
        const goals = r.events
          .filter((e) => e.type === 'goal')
          .map((e) => `${e.team === 'home' ? 'H' : 'A'}${e.minute}`)
          .join(',')
        digests.push(
          `${config.seedKey} ${r.score[0]}-${r.score[1]} [${goals}] shots:${r.stats.shots[0]}/${r.stats.shots[1]} fnv:${fnv1a(frozen)}`,
        )
      }
    }
    expect(digests).toMatchSnapshot()
  })
})
