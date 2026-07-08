// Picks the "Match of the Week" for a content pack: the game that was the most
// fun to watch. A rough drama score rewards goals, lead swings, late drama,
// red cards and near-misses, and penalises a blowout — then the highest-drama
// fixture in each round gets the label.

import type { MatchResult } from '../sim/types'

/** How watchable was this match? Higher = more dramatic. */
export function dramaScore(r: MatchResult): number {
  const [h, a] = r.score
  const goals = h + a
  const margin = Math.abs(h - a)
  let flips = 0 // times the lead changed hands or levelled
  let prev = 0
  let lateGoals = 0
  let reds = 0
  let nearMisses = 0
  for (const e of r.events) {
    if (e.type === 'goal') {
      const diff = e.scoreAfter[0] - e.scoreAfter[1]
      const cur = diff === 0 ? 0 : diff > 0 ? 1 : -1
      if (cur !== prev) flips++
      prev = cur
      if (e.minute >= 80) lateGoals++
    } else if (e.type === 'red') {
      reds++
    } else if (e.type === 'bigChance' || e.type === 'save') {
      nearMisses++
    }
  }
  let s = goals
  s += flips * 2.5 // back-and-forth is the biggest driver
  s += lateGoals * 2
  s += reds * 2
  s += nearMisses * 0.12
  if (margin <= 1 && goals >= 3) s += 2 // a tight high-scorer
  if (margin >= 4) s -= 2 // a blowout is less of a watch
  return s
}

/**
 * The set of fixture ids that are their round's Match of the Week. `results`
 * maps a fixture id to its (already re-simulated) MatchResult.
 */
export function matchOfWeekIds(
  fixtures: ReadonlyArray<{ id: string; round: number }>,
  results: Map<string, MatchResult>,
): Set<string> {
  const bestByRound = new Map<number, { id: string; score: number }>()
  for (const f of fixtures) {
    const r = results.get(f.id)
    if (!r) continue
    const s = dramaScore(r)
    const cur = bestByRound.get(f.round)
    if (!cur || s > cur.score) bestByRound.set(f.round, { id: f.id, score: s })
  }
  return new Set(Array.from(bestByRound.values(), (b) => b.id))
}
