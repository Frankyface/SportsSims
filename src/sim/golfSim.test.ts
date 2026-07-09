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

describe('golf sim — "a guy having a day" boost (v3)', () => {
  it('fires ~9% of rounds, ALWAYS on a bottom-4 golfer, and lifts their scoring', () => {
    const N = 4000
    const courses = GOLF_COURSES.map((c) => c.id)
    let fired = 0
    let boostedSum = 0
    let boostedN = 0
    let baseSum = 0
    let baseN = 0
    for (let i = 0; i < N; i++) {
      const cfg = configFor(`hot-${i}`, courses[i % courses.length], (i % 4) + 1)
      const r = simulateGolfRound(cfg)
      const bottom4 = cfg.golfers
        .map((_, gi) => gi)
        .sort((a, b) => cfg.golfers[a].skill - cfg.golfers[b].skill || a - b)
        .slice(0, 4)
      if (r.hotHand !== null) {
        fired++
        expect(bottom4).toContain(r.hotHand) // only ever one of the weakest four
        boostedSum += r.roundToPar[r.hotHand]
        boostedN++
      } else {
        for (const gi of bottom4) {
          baseSum += r.roundToPar[gi]
          baseN++
        }
      }
    }
    const rate = fired / N
    expect(rate).toBeGreaterThan(0.06)
    expect(rate).toBeLessThan(0.12)
    // a boosted underdog outscores the typical un-boosted bottom-4 round
    expect(boostedSum / boostedN).toBeLessThan(baseSum / baseN)
  })

  it('is deterministic: the boosted golfer and their scores replay identically', () => {
    // find a seed that fires the boost, then re-sim it byte-for-byte
    let cfg = configFor('hot-seek-0')
    let fired = simulateGolfRound(cfg)
    for (let i = 1; fired.hotHand === null && i < 200; i++) {
      cfg = configFor(`hot-seek-${i}`)
      fired = simulateGolfRound(cfg)
    }
    expect(fired.hotHand).not.toBeNull()
    const again = simulateGolfRound(cfg)
    expect(again.hotHand).toBe(fired.hotHand)
    expect(JSON.stringify(again)).toBe(JSON.stringify(fired))
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

  it('tightened field gives real parity — several winners, no runaway favourite', () => {
    // one fixed field, many independent 4-round events (grouping is score-neutral)
    const field = generateGolfTour('parity-field').map(toGolferRating)
    const skillOrder = field.map((_, i) => i).sort((a, b) => field[b].skill - field[a].skill)
    const wins = Array(FIELD_SIZE).fill(0) as number[]
    const N = 60
    const eventCourses = ['harborlight', 'saltmarsh', 'redrock', 'mirrorlake']
    for (let e = 0; e < N; e++) {
      let totals = Array(FIELD_SIZE).fill(0) as number[]
      for (let r = 1; r <= 4; r++) {
        totals = simulateGolfRound({
          seedKey: `parity:e${e}:r${r}`,
          course: golfCourseById(eventCourses[e % eventCourses.length]),
          golfers: field,
          round: r,
          startToPar: totals,
        }).totalToPar
      }
      let w = 0
      for (let i = 1; i < FIELD_SIZE; i++) if (totals[i] < totals[w]) w = i
      wins[w]++
    }
    const distinct = wins.filter((x) => x > 0).length
    // the field is genuinely open: lots of different winners, and the favourite
    // does NOT run away with it
    expect(distinct).toBeGreaterThanOrEqual(4)
    expect(wins[skillOrder[0]] / N).toBeLessThan(0.5)
    // ...but skill still counts: the best golfer wins at least as often as the worst
    expect(wins[skillOrder[0]]).toBeGreaterThanOrEqual(wins[skillOrder[FIELD_SIZE - 1]])
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
