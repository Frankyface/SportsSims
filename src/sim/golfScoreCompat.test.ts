import { describe, it, expect } from 'vitest'
import { simulateGolfRound } from './golfSim'
import { GOLF_SIM_VERSION } from './golfTypes'
import { golfCourseById } from '../ratings/golfCourses'
import { generateGolfTour } from '../ratings/golfers'
import { toGolferRating } from '../ratings/golfStrength'

/**
 * GOLDEN GUARD — the golf score-deciding RNG stream is FROZEN at
 * GOLF_SIM_VERSION 2 (snapshot regenerated 2026-07-08 for the operator realism
 * pass: water splash + visible drop, short bunker shots, rough variance —
 * a deliberate stream change, see golfTypes.ts).
 *
 * Regenerated again 2026-07-08: golfer starting-rating spread tightened for
 * parity (RATING_SPREAD 120->66 in golfers.ts). That is a FIELD-GENERATION
 * change, not a sim-math change — the score stream is unchanged, so saved
 * tours keep their frozen fields; only freshly generated fields differ.
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
  'golf-golden:0': { strokes: [[4,3,3,4,5,4,5,4,4],[5,5,4,3,4,2,4,5,4],[3,5,4,5,5,3,5,4,5],[4,3,4,4,4,4,5,3,4],[4,8,3,5,5,3,4,5,7],[6,3,4,5,5,4,4,4,5],[3,5,5,5,5,5,4,4,3],[4,4,4,5,4,3,7,4,5]], totalToPar: [0,0,3,-1,8,4,3,4], shotCount: 309, eventCount: 53 },
  'golf-golden:1': { strokes: [[5,4,6,4,7,2,5,5,4],[4,3,5,5,6,3,5,5,6],[5,4,4,5,5,3,4,5,3],[4,3,4,5,4,4,3,4,5],[4,3,4,3,3,4,5,5,4],[4,6,5,4,6,3,4,4,4],[4,4,3,4,5,4,7,4,5],[5,2,5,5,3,3,4,5,5]], totalToPar: [6,6,2,0,-1,4,4,1], shotCount: 310, eventCount: 52 },
  'golf-golden:2': { strokes: [[3,4,4,4,4,3,4,4,4],[4,3,4,3,4,4,4,4,4],[4,2,4,3,5,3,4,5,5],[5,4,4,4,5,3,5,4,5],[5,3,3,4,5,3,5,3,4],[5,4,6,4,6,7,6,4,4],[4,5,4,6,3,4,5,4,6],[5,3,5,6,5,4,4,7,3]], totalToPar: [-2,-2,-1,3,-1,10,5,6], shotCount: 306, eventCount: 58 },
  'golf-golden:3': { strokes: [[5,3,4,4,3,3,4,6,4],[3,5,4,4,4,4,4,3,5],[5,4,4,5,6,3,5,5,4],[7,3,4,3,4,6,4,4,5],[5,3,5,3,4,3,3,5,5],[5,3,4,3,4,4,4,5,3],[5,6,5,4,7,2,4,5,5],[6,3,3,4,6,3,5,7,5]], totalToPar: [0,0,5,4,0,-1,7,6], shotCount: 309, eventCount: 59 },
  'golf-golden:4': { strokes: [[3,5,4,3,4,6,3,4,5],[5,5,4,3,3,4,3,4,5],[4,5,4,2,3,4,4,5,3],[5,5,4,2,5,5,6,4,5],[4,4,4,3,4,4,4,4,5],[4,4,4,2,4,3,5,3,3],[5,4,5,4,4,3,3,5,4],[6,4,4,3,5,6,4,6,5]], totalToPar: [1,0,-2,5,0,-4,1,7], shotCount: 296, eventCount: 56 },
  'golf-golden:5': { strokes: [[3,5,3,3,2,5,3,4,4],[5,5,4,4,2,4,6,5,5],[6,2,3,5,5,4,3,4,4],[4,3,4,4,2,4,5,4,7],[4,4,5,4,2,4,3,5,4],[5,4,3,4,3,5,6,4,7],[4,4,4,4,5,4,5,4,6],[6,5,4,4,4,4,3,5,3]], totalToPar: [-4,4,0,1,-1,5,4,2], shotCount: 299, eventCount: 59 },
}

const COURSES = ['harborlight', 'saltmarsh', 'redrock', 'pinnacle', 'verdanthollow', 'palmshade']

describe('golf score-stream compatibility (golden, GOLF_SIM_VERSION 2)', () => {
  it('is still sim version 2 (bump = regenerate the golden, consciously)', () => {
    expect(GOLF_SIM_VERSION).toBe(2)
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
