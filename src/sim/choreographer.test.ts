import { describe, it, expect } from 'vitest'
import { simulateMatch } from './simulateMatch'
import { buildPlayScript, type Touch } from './choreographer'
import type { MatchConfig, MatchResult, TeamRating } from './types'

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

const cfg = (seedKey: string): MatchConfig => ({
  seedKey,
  homeAdvantage: 1.1,
  home: team('CAR', { attack: 1.05 }),
  away: team('KAN', { attack: 0.98 }),
})

const mk = (seedKey: string): MatchResult => simulateMatch(cfg(seedKey))

const SAMPLE_SEEDS = Array.from({ length: 25 }, (_, i) => `pbp:${i}`)

describe('choreographer — determinism', () => {
  it('same seed -> byte-identical play script (separate stream from the score)', () => {
    const a = buildPlayScript(mk('L1:S1:R1:M1'))
    const b = buildPlayScript(mk('L1:S1:R1:M1'))
    expect(JSON.stringify(a)).toEqual(JSON.stringify(b))
  })
})

describe('choreographer — timeline & continuity invariants', () => {
  it('passages tile the whole match clock with no gaps or overlaps', () => {
    for (const seed of SAMPLE_SEEDS) {
      const s = buildPlayScript(mk(seed))
      expect(s.passages.length).toBeGreaterThan(0)
      expect(s.passages[0].simStart).toBe(0)
      for (let i = 1; i < s.passages.length; i++) {
        expect(s.passages[i].simStart).toBe(s.passages[i - 1].simEnd)
      }
      expect(s.passages[s.passages.length - 1].simEnd).toBe(s.matchEnd)
      expect(s.matchEnd).toBeGreaterThanOrEqual(90 * 60)
    }
  })

  it('the ball never teleports: every touch starts where the previous ended', () => {
    for (const seed of SAMPLE_SEEDS) {
      const s = buildPlayScript(mk(seed))
      const touches = s.passages.flatMap((p) => p.touches)
      expect(touches.length).toBeGreaterThan(10)
      for (let i = 1; i < touches.length; i++) {
        expect(touches[i].from[0]).toBeCloseTo(touches[i - 1].to[0], 9)
        expect(touches[i].from[1]).toBeCloseTo(touches[i - 1].to[1], 9)
      }
    }
  })

  it('keeps every touch inside the extended pitch space (net overshoot allowed)', () => {
    for (const seed of SAMPLE_SEEDS) {
      const s = buildPlayScript(mk(seed))
      for (const p of s.passages) {
        for (const t of p.touches) {
          for (const pt of [t.from, t.to]) {
            expect(pt[0]).toBeGreaterThanOrEqual(0)
            expect(pt[0]).toBeLessThanOrEqual(1)
            expect(pt[1]).toBeGreaterThanOrEqual(-0.05)
            expect(pt[1]).toBeLessThanOrEqual(1.05)
          }
        }
      }
    }
  })
})

describe('choreographer — real rules: send-offs & corners', () => {
  it('a sent-off player never touches the ball again', () => {
    let checked = 0
    for (let s = 0; s < 80; s++) {
      const m = mk(`sendoff:${s}`)
      const script = buildPlayScript(m)
      const reds = m.events.filter((e) => e.type === 'red').length
      expect(script.sendOffs.length).toBe(reds)
      if (reds === 0) continue
      checked++
      for (const so of script.sendOffs) {
        expect(so.slot).toBeGreaterThanOrEqual(1) // never the keeper
        expect(so.slot).toBeLessThanOrEqual(7)
        for (const p of script.passages) {
          if (p.simStart < so.simSec) continue // the containing passage may pre-date the card
          for (const tch of p.touches) {
            if (tch.team === so.team) {
              expect(tch.slot, `sent-off ${so.team}#${so.slot} touched at ${p.simStart}s`).not.toBe(so.slot)
            }
          }
        }
      }
    }
    expect(checked).toBeGreaterThan(5)
  })

  it('stages corners: ball behind, taken from the arc, swung in with risk', () => {
    let corners = 0
    for (let s = 0; s < 60; s++) {
      const script = buildPlayScript(mk(`corner:${s}`))
      for (const p of script.passages) {
        if (!p.corner) continue
        corners++
        const restart = p.touches.find(
          (t) => t.kind === 'restart' && (t.to[0] <= 0.06 || t.to[0] >= 0.94),
        )
        expect(restart, 'corner passage has a corner-arc restart').toBeDefined()
        const cross = p.touches.find((t) => t.kind === 'pass' && t.arc >= 0.9 && t.risky)
        expect(cross, 'corner passage has a lofted risky cross').toBeDefined()
      }
    }
    expect(corners).toBeGreaterThan(10)
  })
})

describe('choreographer — story requirements', () => {
  it('features every goal, staged as a shot into the net + celebration', () => {
    for (const seed of SAMPLE_SEEDS) {
      const m = mk(seed)
      const s = buildPlayScript(m)
      const goalPassages = s.passages.filter((p) => p.outcome === 'goal')
      expect(goalPassages.length).toBe(m.score[0] + m.score[1])
      for (const g of goalPassages) {
        const kinds = g.touches.map((t) => t.kind)
        expect(kinds).toContain('shot')
        expect(kinds[kinds.length - 1]).toBe('held')
        // the shot ends beyond the goal line (in the net)
        const shot = g.touches.find((t) => t.kind === 'shot') as Touch
        expect(shot.to[1] < 0 || shot.to[1] > 1).toBe(true)
      }
    }
  })

  it('passes move between distinct players within a chain', () => {
    for (const seed of SAMPLE_SEEDS.slice(0, 10)) {
      const s = buildPlayScript(mk(seed))
      for (const p of s.passages) {
        for (let i = 1; i < p.touches.length; i++) {
          const a = p.touches[i - 1]
          const b = p.touches[i]
          if (a.kind === 'pass' && b.kind === 'pass' && a.team === b.team) {
            expect(b.slot).not.toBe(a.slot)
          }
        }
      }
    }
  })

  it('stages risk: gamble balls and interceptions appear across matches', () => {
    let risky = 0
    let intercepts = 0
    let saves = 0
    let missesOrPosts = 0
    for (const seed of SAMPLE_SEEDS) {
      const s = buildPlayScript(mk(seed))
      for (const p of s.passages) {
        if (p.outcome === 'save' || p.outcome === 'bigChanceSaved') saves++
        if (p.outcome === 'miss' || p.outcome === 'bigChanceMiss') missesOrPosts++
        for (const t of p.touches) {
          if (t.risky) risky++
          if (t.kind === 'intercept') intercepts++
        }
      }
    }
    // missed opportunities & risks are a core watchability requirement
    expect(risky).toBeGreaterThan(SAMPLE_SEEDS.length) // ≥ ~1 gamble ball per match
    expect(intercepts).toBeGreaterThan(SAMPLE_SEEDS.length * 0.5)
    expect(saves).toBeGreaterThan(0)
    expect(missesOrPosts).toBeGreaterThan(0)
  })

  it('bridges carry a sane render pace and featured moments dominate screen time', () => {
    for (const seed of SAMPLE_SEEDS.slice(0, 10)) {
      const s = buildPlayScript(mk(seed))
      const featured = s.passages.filter((p) => p.kind === 'featured')
      const bridges = s.passages.filter((p) => p.kind === 'bridge')
      expect(featured.length).toBeGreaterThan(0)
      expect(bridges.length).toBeGreaterThan(0)
      for (const b of bridges) {
        expect(b.renderDur).toBeGreaterThanOrEqual(1.5)
        expect(b.renderDur).toBeLessThanOrEqual(2.61)
      }
      const featT = featured.reduce((x, p) => x + p.renderDur, 0)
      const briT = bridges.reduce((x, p) => x + p.renderDur, 0)
      expect(featT).toBeGreaterThan(briT * 0.8)
    }
  })
})
