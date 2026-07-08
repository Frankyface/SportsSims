import { describe, expect, it } from 'vitest'
import { buildRugbyPlayScript, type RugbyTouch } from './rugbyChoreographer'
import { simulateRugbyMatch } from './rugbySim'
import type { RugbyMatchResult } from './rugbyTypes'
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

function match(seedKey: string): RugbyMatchResult {
  return simulateRugbyMatch({
    seedKey,
    home: team('Carrick', { attack: 1.05 }),
    away: team('Kanbar', { attack: 0.98 }),
    homeAdvantage: 1.1,
  })
}

const SEEDS = Array.from({ length: 25 }, (_, i) => `rpbp:${i}`)

describe('rugby choreographer — timeline & continuity invariants', () => {
  it('is deterministic (separate :pbp stream)', () => {
    const m = match('rpbp:det')
    expect(JSON.stringify(buildRugbyPlayScript(m))).toBe(JSON.stringify(buildRugbyPlayScript(m)))
  })

  it('passages tile [0, matchEnd] exactly, in order', () => {
    for (const seed of SEEDS) {
      const s = buildRugbyPlayScript(match(seed))
      expect(s.passages[0].simStart).toBe(0)
      for (let i = 1; i < s.passages.length; i++) {
        expect(s.passages[i].simStart).toBe(s.passages[i - 1].simEnd)
      }
      expect(s.passages[s.passages.length - 1].simEnd).toBe(s.matchEnd)
      expect(s.matchEnd).toBeGreaterThanOrEqual(80 * 60)
    }
  })

  it('ball continuity: every touch starts where the previous ended', () => {
    for (const seed of SEEDS) {
      const touches = buildRugbyPlayScript(match(seed)).passages.flatMap((p) => p.touches)
      expect(touches.length).toBeGreaterThan(10)
      for (let i = 1; i < touches.length; i++) {
        expect(touches[i].from[0]).toBeCloseTo(touches[i - 1].to[0], 9)
        expect(touches[i].from[1]).toBeCloseTo(touches[i - 1].to[1], 9)
      }
    }
  })

  it('keeps every touch inside the pitch space (in-goal overshoot allowed)', () => {
    for (const seed of SEEDS) {
      for (const p of buildRugbyPlayScript(match(seed)).passages) {
        for (const t of p.touches) {
          for (const pt of [t.from, t.to]) {
            expect(pt[0]).toBeGreaterThanOrEqual(0)
            expect(pt[0]).toBeLessThanOrEqual(1)
            expect(pt[1]).toBeGreaterThanOrEqual(-0.06)
            expect(pt[1]).toBeLessThanOrEqual(1.06)
          }
        }
      }
    }
  })

  it('RUGBY LAW: passes never travel toward the attacked try line', () => {
    for (const seed of SEEDS) {
      for (const p of buildRugbyPlayScript(match(seed)).passages) {
        for (const t of p.touches) {
          if (t.kind !== 'pass') continue
          if (t.team === 'home') {
            // home attacks the top (y=0): a legal pass never decreases y
            expect(t.to[1]).toBeGreaterThanOrEqual(t.from[1] - 1e-9)
          } else {
            expect(t.to[1]).toBeLessThanOrEqual(t.from[1] + 1e-9)
          }
        }
      }
    }
  })

  it('every try in the score is staged: grounding past the line + a conversion kick', () => {
    for (const seed of SEEDS) {
      const m = match(seed)
      const s = buildRugbyPlayScript(m)
      const tryPassages = s.passages.filter((p) => p.outcome === 'try')
      expect(tryPassages.length).toBe(m.stats.tries[0] + m.stats.tries[1])
      for (const p of tryPassages) {
        const grounding = p.touches.find((t) => t.kind === 'grounding')
        expect(grounding).toBeDefined()
        expect(grounding!.to[1] < 0 || grounding!.to[1] > 1).toBe(true)
        const conv = p.touches.filter((t) => t.kind === 'shot')
        expect(conv).toHaveLength(1)
        expect(p.conv).toBeDefined()
        if (p.conv === 'good') {
          expect(conv[0].to[0]).toBeGreaterThan(0.45)
          expect(conv[0].to[0]).toBeLessThan(0.55)
        }
        expect(conv[0].to[1] < 0 || conv[0].to[1] > 1).toBe(true)
      }
    }
  })

  it('every kicked goal is staged as a shot at the posts', () => {
    for (const seed of SEEDS) {
      const m = match(seed)
      const s = buildRugbyPlayScript(m)
      const penPassages = s.passages.filter((p) => p.outcome === 'penGoal')
      expect(penPassages.length).toBe(m.stats.penaltyGoals[0] + m.stats.penaltyGoals[1])
      const dropPassages = s.passages.filter((p) => p.outcome === 'dropGoal')
      expect(dropPassages.length).toBe(m.stats.dropGoals[0] + m.stats.dropGoals[1])
      for (const p of [...penPassages, ...dropPassages]) {
        const shot = p.touches.find((t) => t.kind === 'shot')
        expect(shot).toBeDefined()
        expect(shot!.to[0]).toBeGreaterThan(0.45)
        expect(shot!.to[0]).toBeLessThan(0.55)
        expect(shot!.to[1] < 0 || shot!.to[1] > 1).toBe(true)
      }
    }
  })

  it('cards produce send-offs; sin-binned players return, reds never do', () => {
    let yellows = 0
    let reds = 0
    for (const seed of SEEDS) {
      const m = match(seed)
      const s = buildRugbyPlayScript(m)
      const cardEvents = m.events.filter((e) => e.type === 'yellow' || e.type === 'red')
      expect(s.sendOffs.length).toBe(cardEvents.length)
      for (const so of s.sendOffs) {
        expect(so.slot).toBeGreaterThanOrEqual(1)
        expect(so.slot).toBeLessThanOrEqual(9)
        if (so.returnSec !== undefined) {
          yellows++
          expect(so.returnSec).toBe(so.simSec + 600)
        } else {
          reds++
        }
        // while off the pitch, that slot never touches the ball
        for (const p of s.passages) {
          if (p.simStart < so.simSec) continue
          if (so.returnSec !== undefined && p.simStart >= so.returnSec) continue
          for (const t of p.touches) {
            if (t.team === so.team) expect(t.slot).not.toBe(so.slot)
          }
        }
      }
    }
    expect(yellows).toBeGreaterThan(10)
    expect(reds).toBeGreaterThan(0)
  })

  it('consecutive same-team passes always find a new receiver', () => {
    for (const seed of SEEDS) {
      for (const p of buildRugbyPlayScript(match(seed)).passages) {
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

  it('reads like rugby: carries, rucks, kicks and turnovers everywhere', () => {
    let carries = 0
    let rucks = 0
    let kicks = 0
    let steals = 0
    let mauls = 0
    for (const seed of SEEDS) {
      for (const p of buildRugbyPlayScript(match(seed)).passages) {
        for (const t of p.touches as RugbyTouch[]) {
          if (t.kind === 'carry') carries++
          if (t.kind === 'kick') kicks++
          if (t.kind === 'intercept') steals++
          if (t.tag === 'ruck') rucks++
          if (t.tag === 'maul') mauls++
        }
      }
    }
    expect(carries / SEEDS.length).toBeGreaterThan(8)
    expect(rucks / SEEDS.length).toBeGreaterThan(5)
    expect(kicks / SEEDS.length).toBeGreaterThan(4)
    expect(steals / SEEDS.length).toBeGreaterThan(2)
    expect(mauls).toBeGreaterThan(0)
  })

  it('pacing: featured and bridge passages both present, bridges in band', () => {
    for (const seed of SEEDS) {
      const s = buildRugbyPlayScript(match(seed))
      const kinds = new Set(s.passages.map((p) => p.kind))
      expect(kinds.has('featured')).toBe(true)
      expect(kinds.has('bridge')).toBe(true)
      for (const p of s.passages) {
        if (p.kind === 'bridge') {
          expect(p.renderDur).toBeGreaterThanOrEqual(1.5)
          expect(p.renderDur).toBeLessThanOrEqual(3.01)
        }
      }
    }
  })
})
