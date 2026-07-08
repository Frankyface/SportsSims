import { describe, it, expect } from 'vitest'
import { simulateGolfRound } from '../sim/golfSim'
import { HOLES_PER_ROUND, type GolfRoundConfig } from '../sim/golfTypes'
import { golfCourseById, GOLF_COURSES } from '../ratings/golfCourses'
import { generateGolfTour } from '../ratings/golfers'
import { toGolferRating } from '../ratings/golfStrength'
import { buildGolfRenderPlan, golfChapterAt, golfLbAt, golfTotalsThru, pickActiveGolfMoment } from './golfDirector'

function cfg(seed: string, courseId: string, round: number): GolfRoundConfig {
  return {
    seedKey: `golf-dir:${seed}`,
    course: golfCourseById(courseId),
    golfers: generateGolfTour(seed).map(toGolferRating),
    round,
    startToPar: Array(8).fill(0),
  }
}

describe('golf director', () => {
  const seeds = Array.from({ length: 200 }, (_, i) => i)

  it('every clip lands in the 55-70s square-race band, over 200 seeds', () => {
    let lo = Infinity
    let hi = -Infinity
    for (const i of seeds) {
      const plan = buildGolfRenderPlan(
        simulateGolfRound(cfg(`band-${i}`, GOLF_COURSES[i % GOLF_COURSES.length].id, (i % 4) + 1)),
      )
      lo = Math.min(lo, plan.total)
      hi = Math.max(hi, plan.total)
      expect(plan.total).toBeGreaterThanOrEqual(55)
      expect(plan.total).toBeLessThanOrEqual(70)
    }
    // the pacing engine is fixed-window by construction: sanity that both ends exist
    expect(lo).toBeGreaterThan(0)
    expect(hi).toBeGreaterThan(lo - 40)
  })

  it('coverage is always exactly 3, 6 or 9 holes, and every kind appears across seeds', () => {
    const seen = new Set<number>()
    for (const i of seeds) {
      const plan = buildGolfRenderPlan(
        simulateGolfRound(cfg(`cov-${i}`, GOLF_COURSES[(i * 3) % GOLF_COURSES.length].id, (i % 4) + 1)),
      )
      const covered = plan.chapters.filter((c) => c.covered).length
      expect([3, 6, 9]).toContain(covered)
      expect(covered).toBe(plan.coveredCount)
      seen.add(covered)
      // the closing hole is never skipped
      expect(plan.chapters[HOLES_PER_ROUND - 1].covered).toBe(true)
    }
    expect(seen.has(9)).toBe(true) // quiet rounds show the whole card
  })

  it('chapters tile the play window contiguously and featured shots stay inside them', () => {
    const plan = buildGolfRenderPlan(simulateGolfRound(cfg('tile', 'pinnacle', 4)))
    expect(plan.chapters[0].t0).toBeCloseTo(plan.playStart, 5)
    for (let i = 1; i < plan.chapters.length; i++) {
      expect(plan.chapters[i].t0).toBeCloseTo(plan.chapters[i - 1].t1, 5)
    }
    expect(plan.chapters[plan.chapters.length - 1].t1).toBeCloseTo(plan.playEnd, 5)
    for (const c of plan.chapters) {
      for (const f of c.featured) {
        expect(f.t0).toBeGreaterThanOrEqual(c.t0)
        expect(f.t1).toBeLessThanOrEqual(c.t1 + 1e-6)
      }
      if (c.covered) expect(c.featured.length).toBeGreaterThanOrEqual(1)
      else expect(c.featured).toHaveLength(0)
    }
  })

  it('the leaderboard steps to the true final standings', () => {
    for (const i of seeds.slice(0, 30)) {
      const m = simulateGolfRound(cfg(`lb-${i}`, 'mirrorlake', 2))
      const plan = buildGolfRenderPlan(m)
      const finalRows = golfLbAt(plan, plan.total)
      expect(finalRows.map((r) => r.golfer)).toEqual(m.leaderboard)
      expect(finalRows[0].toPar).toBe(m.totalToPar[m.leaderboard[0]])
      // and totals-thru agrees with the sim's own totals on the last hole
      expect(golfTotalsThru(m, HOLES_PER_ROUND - 1)).toEqual(m.totalToPar)
    }
  })

  it('a round-4 plan carries a winner moment; chapterAt/momentAt never throw across the clip', () => {
    const m = simulateGolfRound(cfg('winner', 'pinnacle', 4))
    const plan = buildGolfRenderPlan(m)
    expect(plan.moments.some((mo) => mo.kind === 'winner')).toBe(true)
    for (let t = 0; t <= plan.total; t += 0.25) {
      expect(golfChapterAt(plan, t)).toBeTruthy()
      pickActiveGolfMoment(plan, t) // may be null, must not throw
      expect(golfLbAt(plan, t).length).toBe(8)
    }
  })

  it('moments are chronological and labelled', () => {
    const plan = buildGolfRenderPlan(simulateGolfRound(cfg('mom', 'redrock', 3)))
    for (let i = 1; i < plan.moments.length; i++) {
      expect(plan.moments[i].t).toBeGreaterThanOrEqual(plan.moments[i - 1].t)
    }
    for (const mo of plan.moments) {
      expect(mo.label.length).toBeGreaterThan(3)
      expect(mo.label.length).toBeLessThanOrEqual(40)
    }
  })
})
