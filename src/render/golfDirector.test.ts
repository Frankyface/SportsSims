import { describe, it, expect } from 'vitest'
import { simulateGolfRound } from '../sim/golfSim'
import { GROUP_SIZE, HOLES_PER_ROUND, type GolfRoundConfig } from '../sim/golfTypes'
import { golfCourseById, GOLF_COURSES } from '../ratings/golfCourses'
import { generateGolfTour } from '../ratings/golfers'
import { toGolferRating } from '../ratings/golfStrength'
import {
  buildGolfGroupPlan,
  golfBoardAt,
  golferPosAt,
  golfHoleAt,
  golfTotalsThru,
  pickActiveGolfMoment,
} from './golfDirector'

function cfg(seed: string, courseId: string, round: number): GolfRoundConfig {
  return {
    seedKey: `golf-dir:${seed}`,
    course: golfCourseById(courseId),
    golfers: generateGolfTour(seed).map(toGolferRating),
    round,
    startToPar: Array(8).fill(0),
  }
}

describe('golf group director — every shot, all nine holes', () => {
  const seeds = Array.from({ length: 200 }, (_, i) => i)

  it('every group video lands under the Reels cap (60-88s), over 200 seeds × 2 groups', () => {
    for (const i of seeds) {
      const m = simulateGolfRound(cfg(`band-${i}`, GOLF_COURSES[i % GOLF_COURSES.length].id, (i % 4) + 1))
      for (const g of [0, 1] as const) {
        const plan = buildGolfGroupPlan(m, g)
        expect(plan.total).toBeGreaterThanOrEqual(60)
        expect(plan.total).toBeLessThanOrEqual(88)
      }
    }
  })

  it('shows EVERY shot of the group exactly once, chronologically, per-golfer order intact', () => {
    for (const i of seeds.slice(0, 30)) {
      const m = simulateGolfRound(cfg(`all-${i}`, 'mirrorlake', (i % 4) + 1))
      for (const g of [0, 1] as const) {
        const plan = buildGolfGroupPlan(m, g)
        const expected = m.shots.filter((s) => plan.golfers.includes(s.golfer))
        expect(plan.segs.length).toBe(expected.length)
        // chronological + inside the play window
        for (let k = 1; k < plan.segs.length; k++) {
          expect(plan.segs[k].t0).toBeGreaterThanOrEqual(plan.segs[k - 1].t1 - 1e-9)
        }
        expect(plan.segs[0].t0).toBeCloseTo(plan.playStart, 5)
        expect(plan.segs[plan.segs.length - 1].t1).toBeCloseTo(plan.playEnd, 5)
        // each golfer's own shots keep their sim order
        for (const gi of plan.golfers) {
          const mine = plan.segs.filter((s) => s.shot.golfer === gi).map((s) => s.shot)
          expect(mine).toEqual(expected.filter((s) => s.golfer === gi))
        }
      }
    }
  })

  it('holes play in order and open with the four tee shots in group order', () => {
    const m = simulateGolfRound(cfg('tee', 'pinnacle', 2))
    const plan = buildGolfGroupPlan(m, 1)
    expect(plan.holes.map((h) => h.hole)).toEqual([...Array(HOLES_PER_ROUND).keys()])
    for (const h of plan.holes) {
      const inHole = plan.segs.filter((s) => s.shot.hole === h.hole)
      const teeShots = inHole.slice(0, GROUP_SIZE)
      expect(teeShots.map((s) => s.shot.golfer)).toEqual(plan.golfers)
      expect(teeShots.every((s) => s.shot.fromLie === 'tee')).toBe(true)
      // and the hole span brackets its shots
      expect(inHole[0].t0).toBeCloseTo(h.t0, 5)
      expect(inHole[inHole.length - 1].t1).toBeCloseTo(h.t1, 5)
    }
  })

  it('after the honours, the farthest ball always plays first', () => {
    const m = simulateGolfRound(cfg('farthest', 'saltmarsh', 3))
    for (const g of [0, 1] as const) {
      const plan = buildGolfGroupPlan(m, g)
      for (const h of plan.holes) {
        const inHole = plan.segs.filter((s) => s.shot.hole === h.hole)
        // replay the queues and check each post-tee pick was the farthest out
        const remaining = new Map(plan.golfers.map((gi) => [gi, inHole.filter((s) => s.shot.golfer === gi).map((s) => s.shot)]))
        for (const [idx, seg] of inHole.entries()) {
          if (idx >= GROUP_SIZE) {
            const pickDist = 1 - seg.shot.from[1]
            for (const [gi, q] of remaining) {
              if (gi === seg.shot.golfer || q.length === 0) continue
              expect(pickDist).toBeGreaterThanOrEqual(1 - q[0].from[1] - 1e-6)
            }
          }
          const q = remaining.get(seg.shot.golfer)
          expect(q?.[0]).toEqual(seg.shot)
          q?.shift()
        }
      }
    }
  })

  it('the group board steps to the true totals, and everyone is holed at each hole end', () => {
    for (const i of seeds.slice(0, 20)) {
      const m = simulateGolfRound(cfg(`board-${i}`, 'redrock', 4))
      for (const g of [0, 1] as const) {
        const plan = buildGolfGroupPlan(m, g)
        const finalRows = golfBoardAt(plan, plan.total)
        const trueTotals = golfTotalsThru(m, HOLES_PER_ROUND - 1)
        for (const r of finalRows) {
          expect(r.toParTotal).toBe(trueTotals[r.golfer])
        }
        for (let k = 1; k < finalRows.length; k++) {
          expect(finalRows[k - 1].toParTotal).toBeLessThanOrEqual(finalRows[k].toParTotal)
        }
        for (const h of plan.holes) {
          for (const gi of plan.golfers) {
            expect(golferPosAt(plan, gi, h.t1 + 1e-6, h.hole).holed).toBe(true)
          }
        }
      }
    }
  })

  it('moments belong to the group; the winner banner only airs in the champion’s group', () => {
    const m = simulateGolfRound(cfg('winner', 'pinnacle', 4))
    const winner = m.events.find((e) => e.type === 'winner')
    expect(winner).toBeTruthy()
    let bannersSeen = 0
    for (const g of [0, 1] as const) {
      const plan = buildGolfGroupPlan(m, g)
      for (const mo of plan.moments) {
        if (mo.golfer !== null) expect(plan.golfers).toContain(mo.golfer)
        expect(mo.label.length).toBeGreaterThan(3)
        expect(mo.label.length).toBeLessThanOrEqual(40)
      }
      for (let k = 1; k < plan.moments.length; k++) {
        expect(plan.moments[k].t).toBeGreaterThanOrEqual(plan.moments[k - 1].t)
      }
      if (plan.moments.some((mo) => mo.kind === 'winner')) {
        bannersSeen++
        expect(plan.golfers).toContain(winner?.golfer)
      }
    }
    expect(bannersSeen).toBe(1)
  })

  it('greenT marks the shared putting phase: inside the hole span, only putts after it', () => {
    let seen = 0
    for (const i of seeds.slice(0, 20)) {
      const m = simulateGolfRound(cfg(`green-${i}`, 'gorsewood', (i % 4) + 1))
      for (const g of [0, 1] as const) {
        const plan = buildGolfGroupPlan(m, g)
        for (const h of plan.holes) {
          if (h.greenT === undefined) continue
          seen++
          expect(h.greenT).toBeGreaterThan(h.t0)
          expect(h.greenT).toBeLessThanOrEqual(h.t1)
          for (const s of plan.segs) {
            if (s.shot.hole === h.hole && s.t0 >= h.greenT - 1e-9) {
              expect(s.shot.kind).toBe('putt')
            }
          }
        }
      }
    }
    expect(seen).toBeGreaterThan(50) // the zoom phase is common, not exotic
  })

  it('holeAt/boardAt/momentAt never throw across the whole clip', () => {
    const m = simulateGolfRound(cfg('sweep', 'palmshade', 1))
    const plan = buildGolfGroupPlan(m, 0)
    for (let t = 0; t <= plan.total; t += 0.25) {
      expect(golfHoleAt(plan, t)).toBeTruthy()
      pickActiveGolfMoment(plan, t)
      expect(golfBoardAt(plan, t).length).toBe(GROUP_SIZE)
    }
  })
})
