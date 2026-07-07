import { describe, it, expect } from 'vitest'
import { generateLeague } from './teams'
import { toTeamRating } from './strength'
import { simulateMatch } from '../sim/simulateMatch'

// Within a season, each team's strength is fixed (from its rating); upsets come
// from the seeded per-match form variance. Across seasons (Stage 3) ratings will
// evolve via Glicko. This test verifies the core promise of the rating model.

interface SeasonOutcome {
  startRating: number[]
  points: number[]
  goalDiff: number[]
  matches: number
  upsets: number
  championIdx: number
  topSeedIdx: number
}

function playSeason(seedKey: string, count = 6): SeasonOutcome {
  const teams = generateLeague(seedKey, count)
  const startRating = teams.map((t) => t.glicko.rating)
  const rat = teams.map((t) => toTeamRating(t.identity, t.glicko)) // fixed for the season
  const points = new Array(count).fill(0)
  const goalDiff = new Array(count).fill(0)
  let matches = 0
  let upsets = 0

  // Double round-robin: every ordered (home, away) pair once.
  for (let h = 0; h < count; h++) {
    for (let a = 0; a < count; a++) {
      if (h === a) continue
      const res = simulateMatch({ seedKey: `${seedKey}:${h}v${a}`, home: rat[h], away: rat[a], homeAdvantage: 1.1 })
      const [hg, ag] = res.score
      goalDiff[h] += hg - ag
      goalDiff[a] += ag - hg
      matches++
      if (hg > ag) points[h] += 3
      else if (ag > hg) points[a] += 3
      else {
        points[h] += 1
        points[a] += 1
      }
      if (hg !== ag) {
        const winner = hg > ag ? h : a
        const loser = hg > ag ? a : h
        if (startRating[winner] < startRating[loser]) upsets++
      }
    }
  }

  const order = Array.from({ length: count }, (_, i) => i).sort(
    (x, y) => points[y] - points[x] || goalDiff[y] - goalDiff[x],
  )
  let topSeedIdx = 0
  for (let i = 1; i < count; i++) if (startRating[i] > startRating[topSeedIdx]) topSeedIdx = i

  return { startRating, points, goalDiff, matches, upsets, championIdx: order[0], topSeedIdx }
}

function pearson(x: number[], y: number[]): number {
  const n = x.length
  const mx = x.reduce((s, v) => s + v, 0) / n
  const my = y.reduce((s, v) => s + v, 0) / n
  let num = 0
  let dx = 0
  let dy = 0
  for (let i = 0; i < n; i++) {
    num += (x[i] - mx) * (y[i] - my)
    dx += (x[i] - mx) * (x[i] - mx)
    dy += (y[i] - my) * (y[i] - my)
  }
  return num / Math.sqrt(dx * dy)
}

describe('rating model — seasons reward strength but allow upsets', () => {
  it('standings track team strength; not a coin flip, not deterministic', () => {
    const N = 40
    let corrSum = 0
    let totalUpsets = 0
    let totalMatches = 0
    let topSeedChampions = 0

    for (let s = 0; s < N; s++) {
      const r = playSeason(`season-${s}`)
      corrSum += pearson(r.startRating, r.points)
      totalUpsets += r.upsets
      totalMatches += r.matches
      if (r.championIdx === r.topSeedIdx) topSeedChampions++
    }

    const avgCorr = corrSum / N
    const upsetRate = totalUpsets / totalMatches
    const topSeedWinRate = topSeedChampions / N
    console.log('[rating-model]', { avgCorr, upsetRate, topSeedWinRate })

    // Standings clearly track strength (good teams good, bad teams bad).
    expect(avgCorr).toBeGreaterThan(0.4)
    // Underdogs win often enough to matter...
    expect(upsetRate).toBeGreaterThan(0.18)
    // ...but strength still dominates — it is NOT a coin flip (50%).
    expect(upsetRate).toBeLessThan(0.45)
    // The best team wins the title far more than random (0.10)...
    expect(topSeedWinRate).toBeGreaterThan(0.2)
    // ...but not always — the title race is not predetermined.
    expect(topSeedWinRate).toBeLessThan(0.9)
  })
})
