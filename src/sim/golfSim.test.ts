import { describe, it, expect } from 'vitest'
import { simulateGolfRound } from './golfSim'
import { FIELD_SIZE, HOLES_PER_ROUND, type GolfRoundConfig, type GolferRating } from './golfTypes'
import { golfCourseById, GOLF_COURSES } from '../ratings/golfCourses'
import { generateGolfTour } from '../ratings/golfers'
import { toGolferRating } from '../ratings/golfStrength'

function fieldFor(seed: string): GolferRating[] {
  return generateGolfTour(seed).map(toGolferRating)
}

function configFor(seed: string, courseId = 'harborlight', round = 1, startToPar?: number[]): GolfRoundConfig {
  return {
    seedKey: `golf-test:${seed}`,
    course: golfCourseById(courseId),
    golfers: fieldFor(seed),
    round,
    startToPar: startToPar ?? Array(FIELD_SIZE).fill(0),
  }
}

describe('golf sim determinism', () => {
  it('same seed → byte-identical result', () => {
    const a = simulateGolfRound(configFor('alpha'))
    const b = simulateGolfRound(configFor('alpha'))
    expect(JSON.stringify(a)).toBe(JSON.stringify(b))
  })

  it('different seeds → different rounds', () => {
    const a = simulateGolfRound(configFor('alpha'))
    const b = simulateGolfRound({ ...configFor('alpha'), seedKey: 'golf-test:beta' })
    expect(JSON.stringify(a.strokes)).not.toBe(JSON.stringify(b.strokes))
  })
})

describe('golf sim invariants', () => {
  const seeds = Array.from({ length: 40 }, (_, i) => `inv-${i}`)
  const courses = ['harborlight', 'saltmarsh', 'redrock', 'pinnacle', 'mirrorlake']

  it('scores, shots and leaderboard are structurally sound on every seed', () => {
    for (const [si, seed] of seeds.entries()) {
      const course = courses[si % courses.length]
      const r = simulateGolfRound(configFor(seed, course, (si % 4) + 1))
      expect(r.strokes).toHaveLength(FIELD_SIZE)
      for (let gi = 0; gi < FIELD_SIZE; gi++) {
        expect(r.strokes[gi]).toHaveLength(HOLES_PER_ROUND)
        for (let hIdx = 0; hIdx < HOLES_PER_ROUND; hIdx++) {
          const par = r.config.course.holes[hIdx].par
          const s = r.strokes[gi][hIdx]
          expect(s).toBeGreaterThanOrEqual(1)
          expect(s).toBeLessThanOrEqual(par + 6) // loop bound + penalty + pickup putt
          // the shot record agrees with the card (drops are NOT strokes)
          const shots = r.shots.filter((x) => x.golfer === gi && x.hole === hIdx)
          const strokes = shots.filter((x) => x.kind !== 'penaltyDrop')
          const counted = strokes.length + strokes.filter((x) => x.penalty).length
          expect(counted).toBe(s)
          // every hole ends in the cup
          expect(shots[shots.length - 1].holed).toBe(true)
          // every splash is followed immediately by its drop
          shots.forEach((x, i2) => {
            if (x.penalty) {
              expect(x.toLie).toBe('water')
              expect(shots[i2 + 1]?.kind).toBe('penaltyDrop')
            }
          })
        }
      }
      // leaderboard sorted on total
      for (let i = 1; i < r.leaderboard.length; i++) {
        expect(r.totalToPar[r.leaderboard[i - 1]]).toBeLessThanOrEqual(r.totalToPar[r.leaderboard[i]])
      }
      // totals reconcile
      for (let gi = 0; gi < FIELD_SIZE; gi++) {
        expect(r.totalToPar[gi]).toBe(r.config.startToPar[gi] + r.roundToPar[gi])
      }
      // a round-4 sim always crowns a winner event
      if (r.config.round === 4) {
        expect(r.events.some((e) => e.type === 'winner')).toBe(true)
      }
    }
  })

  it('shot positions stay in hole coordinates', () => {
    const r = simulateGolfRound(configFor('coords', 'pinnacle'))
    for (const s of r.shots) {
      for (const [x, y] of [s.from, s.to]) {
        expect(x).toBeGreaterThanOrEqual(-1)
        expect(x).toBeLessThanOrEqual(1)
        expect(y).toBeGreaterThanOrEqual(0)
        expect(y).toBeLessThanOrEqual(1)
      }
    }
  })
})

describe('golf sim Monte-Carlo calibration (N=600 rounds)', () => {
  // 600 rounds × 8 golfers × 9 holes = 43,200 holes — plenty for stable rates.
  const N = 600
  let holes = 0
  let birdiesOrBetter = 0
  let doubles = 0
  let aces = 0
  let toParSum = 0
  const roundScores: number[] = []
  // skill → results correlation: mean finish position by skill rank
  const finishBySkillRank: number[] = Array(FIELD_SIZE).fill(0)

  const allCourses = GOLF_COURSES.map((c) => c.id)
  for (let i = 0; i < N; i++) {
    const cfg = configFor(`mc-${i}`, allCourses[i % allCourses.length], (i % 4) + 1)
    const r = simulateGolfRound(cfg)
    const skillOrder = cfg.golfers.map((_, gi) => gi).sort((a, b) => cfg.golfers[b].skill - cfg.golfers[a].skill)
    for (let gi = 0; gi < FIELD_SIZE; gi++) {
      roundScores.push(r.roundToPar[gi])
      toParSum += r.roundToPar[gi]
      for (let hIdx = 0; hIdx < HOLES_PER_ROUND; hIdx++) {
        holes++
        const d = r.strokes[gi][hIdx] - cfg.course.holes[hIdx].par
        if (r.strokes[gi][hIdx] === 1) aces++
        if (d <= -1) birdiesOrBetter++
        if (d >= 2) doubles++
      }
    }
    // where did each skill rank finish this round (on round score alone)?
    const posOrder = cfg.golfers
      .map((_, gi) => gi)
      .sort((a, b) => r.roundToPar[a] - r.roundToPar[b] || a - b)
    for (let rank = 0; rank < FIELD_SIZE; rank++) {
      const golfer = skillOrder[rank]
      finishBySkillRank[rank] += posOrder.indexOf(golfer)
    }
  }

  it('field averages a touch over par (broadcast-real scoring)', () => {
    const mean = toParSum / (N * FIELD_SIZE)
    expect(mean).toBeGreaterThan(-0.3)
    expect(mean).toBeLessThan(2.2)
  })

  it('birdie-or-better rate lands in the real-golf band', () => {
    const rate = birdiesOrBetter / holes
    expect(rate).toBeGreaterThan(0.1)
    expect(rate).toBeLessThan(0.28)
  })

  it('double-bogey-or-worse rate stays honest but painful', () => {
    const rate = doubles / holes
    expect(rate).toBeGreaterThan(0.02)
    expect(rate).toBeLessThan(0.12)
  })

  it('aces are genuinely rare', () => {
    expect(aces / holes).toBeLessThan(0.004)
  })

  it('round scores spread enough for drama (σ ≥ 1.6 strokes)', () => {
    const mean = roundScores.reduce((s, x) => s + x, 0) / roundScores.length
    const varSum = roundScores.reduce((s, x) => s + (x - mean) * (x - mean), 0)
    const sd = Math.sqrt(varSum / roundScores.length)
    expect(sd).toBeGreaterThan(1.6)
    expect(sd).toBeLessThan(4.5)
  })

  it('skill wins out over a big sample, but never deterministically', () => {
    const bestSkillMeanFinish = finishBySkillRank[0] / N
    const worstSkillMeanFinish = finishBySkillRank[FIELD_SIZE - 1] / N
    // best-skill golfer averages a clearly better finish than the weakest...
    expect(bestSkillMeanFinish).toBeLessThan(worstSkillMeanFinish - 0.8)
    // ...but upsets exist: neither pins the extreme position on average
    expect(bestSkillMeanFinish).toBeGreaterThan(1.0)
    expect(worstSkillMeanFinish).toBeLessThan(6.0)
  })
})
