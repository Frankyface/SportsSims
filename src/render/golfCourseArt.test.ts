import { describe, it, expect } from 'vitest'
import { buildHoleLayout, holeToScreen, GOLF_ART, type GolfHoleLayout } from './golfCourseArt'
import { GOLF_COURSES } from '../ratings/golfCourses'
import { HOLES_PER_ROUND } from '../sim/golfTypes'

function pointInPoly(pt: [number, number], poly: [number, number][]): boolean {
  let inside = false
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i][0]
    const yi = poly[i][1]
    const xj = poly[j][0]
    const yj = poly[j][1]
    const hit = yi > pt[1] !== yj > pt[1] && pt[0] < ((xj - xi) * (pt[1] - yi)) / (yj - yi) + xi
    if (hit) inside = !inside
  }
  return inside
}

const SEEDS = Array.from({ length: 24 }, (_, i) => (i * 2654435761) >>> 0)

function everyHole(fn: (l: GolfHoleLayout, course: string, hole: number, seed: number) => void): void {
  for (const seed of SEEDS) {
    for (const course of GOLF_COURSES) {
      for (let h = 0; h < HOLES_PER_ROUND; h++) {
        fn(buildHoleLayout(course, h, seed), course.id, h, seed)
      }
    }
  }
}

describe('golf hole art', () => {
  it('is deterministic — same seed → byte-identical layout', () => {
    const a = buildHoleLayout(GOLF_COURSES[0], 3, 12345)
    const b = buildHoleLayout(GOLF_COURSES[0], 3, 12345)
    expect(JSON.stringify(a)).toBe(JSON.stringify(b))
  })

  it('holeToScreen keeps lateral offset a pure horizontal corridor shift', () => {
    const l = buildHoleLayout(GOLF_COURSES[2], 4, 999)
    for (const t of [0.1, 0.3, 0.5, 0.7, 0.9]) {
      const base = holeToScreen(l, [0, t])
      const right = holeToScreen(l, [0.4, t])
      expect(right[0] - base[0]).toBeCloseTo(0.4 * l.corridor, 6)
      expect(right[1] - base[1]).toBeCloseTo(0, 6)
    }
  })

  it('no NaN / infinite vertices anywhere', () => {
    everyHole((l) => {
      const all = [
        ...l.fairwayPoly,
        ...l.fairwayCore,
        ...l.green,
        ...l.fringe,
        ...l.greenRings.flat(),
        l.pin,
        l.greenC,
        l.tee,
      ]
      for (const p of all) {
        expect(Number.isFinite(p[0])).toBe(true)
        expect(Number.isFinite(p[1])).toBe(true)
      }
      expect(l.fairwayPoly.length).toBeGreaterThan(10)
      expect(l.green.length).toBeGreaterThan(10)
    })
  })

  it('fairway covers a driving-lie ball at the middle of every landing zone (par 4/5)', () => {
    everyHole((l) => {
      if (l.hole.par === 3) return
      const windows = l.hole.par === 5 ? [0.35, 0.62, 0.88] : [0.35, 0.88]
      for (const t of windows) {
        for (const lx of [-0.3, 0, 0.3]) {
          const p = holeToScreen(l, [lx, t])
          expect(pointInPoly(p, l.fairwayPoly)).toBe(true)
        }
      }
    })
  })

  it('the full ±0.40 fairway band lands on grass ≥90% across the landing zones', () => {
    let inside = 0
    let total = 0
    everyHole((l) => {
      if (l.hole.par === 3) return
      const ts = l.hole.par === 5 ? [0.24, 0.35, 0.46, 0.58, 0.66, 0.84, 0.9] : [0.24, 0.32, 0.4, 0.46, 0.84, 0.9]
      for (const t of ts) {
        for (const lx of [-0.4, -0.2, 0, 0.2, 0.4]) {
          total++
          if (pointInPoly(holeToScreen(l, [lx, t]), l.fairwayPoly)) inside++
        }
      }
    })
    expect(inside / total).toBeGreaterThan(0.9)
  })

  it('every on-green ball lands on the drawn green blob', () => {
    let inside = 0
    let total = 0
    everyHole((l) => {
      for (const d of [0, 0.2, 0.4, 0.55]) {
        const ly = 1 - 0.08 * d
        for (const lx of [-0.45, -0.2, 0, 0.2, 0.45]) {
          total++
          if (pointInPoly(holeToScreen(l, [lx, ly]), l.green)) inside++
        }
      }
    })
    expect(inside / total).toBeGreaterThan(0.995)
  })

  it('keeps hole art clear of the leaderboard rail', () => {
    everyHole((l) => {
      const verts = [...l.fairwayPoly, ...l.green, ...l.fringe]
      for (const v of verts) {
        if (v[1] > 318 && v[1] < 662) expect(v[0]).toBeLessThanOrEqual(786.5)
      }
    })
  })

  it('produces varied hole shapes — several archetypes per course', () => {
    for (const seed of SEEDS.slice(0, 8)) {
      for (const course of GOLF_COURSES) {
        const kinds = new Set<string>()
        for (let h = 0; h < HOLES_PER_ROUND; h++) {
          kinds.add(buildHoleLayout(course, h, seed).archetype)
        }
        expect(kinds.size).toBeGreaterThanOrEqual(3)
      }
    }
  })

  it('stays inside the art region vertically', () => {
    everyHole((l) => {
      for (const v of [...l.fairwayPoly, ...l.green]) {
        expect(v[1]).toBeGreaterThan(GOLF_ART.y - 20)
        expect(v[1]).toBeLessThan(GOLF_ART.y + GOLF_ART.h + 60)
      }
    })
  })

  it('greens stay below the horizon band (never paste over the sky)', () => {
    const horizon = GOLF_ART.y + 118
    everyHole((l) => {
      for (const v of [...l.green, ...l.fringe]) {
        expect(v[1]).toBeGreaterThanOrEqual(horizon)
      }
    })
  })
})
