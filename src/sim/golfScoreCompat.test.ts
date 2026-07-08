import { describe, it, expect } from 'vitest'
import { simulateGolfRound } from './golfSim'
import { GOLF_SIM_VERSION } from './golfTypes'
import { golfCourseById } from '../ratings/golfCourses'
import { generateGolfTour } from '../ratings/golfers'
import { toGolferRating } from '../ratings/golfStrength'

/**
 * GOLDEN GUARD — the golf score-deciding RNG stream is FROZEN at
 * GOLF_SIM_VERSION 1 (snapshot generated 2026-07-08, first shipped build).
 *
 * If this test fails you have changed the stream: every saved season would
 * re-render different rounds. Either make the change stream-neutral, or bump
 * GOLF_SIM_VERSION and consciously regenerate the snapshot (documenting why),
 * exactly as the soccer/rugby engines do.
 */
const GOLDEN: Record<
  string,
  { strokes: number[][]; totalToPar: number[]; shotCount: number; eventCount: number }
> = {
  'golf-golden:0': { strokes: [[4,5,4,5,3,4,4,5,4],[5,5,5,5,4,3,5,4,4],[3,4,4,6,4,4,5,4,5],[4,3,4,4,5,2,4,4,4],[4,4,5,4,4,3,6,3,5],[6,3,3,4,6,5,5,4,4],[3,4,4,3,5,5,3,4,8],[6,3,4,6,4,3,4,5,5]], totalToPar: [2,4,3,-2,2,4,3,4], shotCount: 307, eventCount: 56 },
  'golf-golden:1': { strokes: [[6,3,3,4,4,3,5,5,5],[3,4,4,4,4,5,4,3,3],[6,4,3,5,6,5,5,6,4],[4,3,6,5,4,2,6,3,3],[5,3,3,3,5,4,4,3,4],[5,3,3,3,5,3,5,4,5],[4,2,3,5,4,3,4,6,4],[6,3,4,4,4,3,4,4,5]], totalToPar: [2,-2,8,0,-2,0,-1,1], shotCount: 294, eventCount: 63 },
  'golf-golden:2': { strokes: [[4,4,4,5,4,3,4,4,7],[4,4,3,5,6,5,3,4,4],[3,3,5,5,4,2,4,5,3],[5,3,5,3,4,4,5,6,6],[3,3,4,4,4,3,3,4,4],[4,4,5,4,6,5,4,5,4],[4,4,5,4,6,4,5,4,6],[3,3,5,3,4,3,4,4,5]], totalToPar: [3,2,-2,5,-4,5,6,-2], shotCount: 301, eventCount: 52 },
  'golf-golden:3': { strokes: [[5,4,5,3,5,5,4,3,4],[3,3,4,3,4,3,3,4,3],[5,3,4,6,5,4,4,4,3],[5,6,5,4,6,5,5,5,6],[6,3,4,4,4,5,3,5,4],[4,2,3,4,4,5,4,5,5],[4,4,5,3,4,3,5,6,5],[5,4,4,4,4,3,3,3,3]], totalToPar: [2,-6,2,11,2,0,3,-3], shotCount: 299, eventCount: 63 },
  'golf-golden:4': { strokes: [[3,6,3,3,5,6,3,4,4],[5,3,4,3,4,5,3,4,4],[4,3,4,2,4,3,4,3,5],[5,5,5,2,3,4,6,9,4],[4,4,4,3,3,4,3,5,5],[6,5,5,2,5,5,4,4,5],[4,5,6,4,3,3,3,3,3],[6,4,4,5,5,6,4,4,4]], totalToPar: [1,-1,-4,7,-1,5,-2,6], shotCount: 297, eventCount: 59 },
  'golf-golden:5': { strokes: [[3,2,4,4,2,4,4,5,5],[4,4,4,4,2,5,5,3,5],[5,4,3,6,5,3,3,5,3],[4,4,3,4,3,4,5,3,4],[4,6,5,4,4,6,5,4,5],[4,4,4,4,2,5,3,3,5],[5,6,5,4,4,3,5,4,6],[5,3,4,4,4,4,5,4,4]], totalToPar: [-3,0,1,-2,7,-2,6,1], shotCount: 295, eventCount: 61 },
}

const COURSES = ['harborlight', 'saltmarsh', 'redrock', 'pinnacle', 'verdanthollow', 'palmshade']

describe('golf score-stream compatibility (golden, GOLF_SIM_VERSION 1)', () => {
  it('is still sim version 1 (bump = regenerate the golden, consciously)', () => {
    expect(GOLF_SIM_VERSION).toBe(1)
  })

  for (let i = 0; i < 6; i++) {
    const key = `golf-golden:${i}`
    it(`${key} re-sims byte-identically`, () => {
      const golfers = generateGolfTour(`golden-${i}`).map(toGolferRating)
      const r = simulateGolfRound({
        seedKey: key,
        course: golfCourseById(COURSES[i]),
        golfers,
        round: ((i % 4) + 1) as 1 | 2 | 3 | 4,
        startToPar: Array(8).fill(0),
      })
      const g = GOLDEN[key]
      expect(r.strokes).toEqual(g.strokes)
      expect(r.totalToPar).toEqual(g.totalToPar)
      expect(r.shots.length).toBe(g.shotCount)
      expect(r.events.length).toBe(g.eventCount)
    })
  }
})
