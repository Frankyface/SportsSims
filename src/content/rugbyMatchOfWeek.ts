// Match of the Week for the Bastion Championships — the rugby fork of
// matchOfWeek.ts. Drama is scored from rugby events: lead changes, late
// scores, cards and line breaks; blowouts are docked.

import type { RugbyMatchResult } from '../sim/rugbyTypes'

const SCORE_TYPES = new Set(['try', 'conversion', 'penaltyGoal', 'dropGoal'])

export function rugbyDramaScore(r: RugbyMatchResult): number {
  let flips = 0
  let lateScores = 0
  let reds = 0
  let yellows = 0
  let breaks = 0
  let prevLeader = 0 // -1 away, 0 level, +1 home
  for (const e of r.events) {
    if (SCORE_TYPES.has(e.type)) {
      const leader = e.scoreAfter[0] === e.scoreAfter[1] ? 0 : e.scoreAfter[0] > e.scoreAfter[1] ? 1 : -1
      if (leader !== 0 && prevLeader !== 0 && leader !== prevLeader) flips++
      if (leader !== 0) prevLeader = leader
      if (e.minute >= 68 && e.type !== 'conversion') lateScores++
    }
    if (e.type === 'red') reds++
    if (e.type === 'yellow') yellows++
    if (e.type === 'break') breaks++
  }
  const margin = Math.abs(r.score[0] - r.score[1])
  const total = r.score[0] + r.score[1]
  let score = flips * 2.5 + lateScores * 2 + reds * 2 + yellows * 0.8 + breaks * 0.25
  if (margin <= 7 && total >= 40) score += 2 // a tight shootout
  if (margin >= 22) score -= 2 // a blowout is a highlight reel, not a drama
  return score
}

/** The single most dramatic fixture id per round (regular rounds only). */
export function rugbyMatchOfWeekIds(
  fixtures: ReadonlyArray<{ id: string; round: number }>,
  results: Map<string, RugbyMatchResult>,
): Set<string> {
  const best = new Map<number, { id: string; score: number }>()
  for (const f of fixtures) {
    const r = results.get(f.id)
    if (!r) continue
    const s = rugbyDramaScore(r)
    const cur = best.get(f.round)
    if (!cur || s > cur.score) best.set(f.round, { id: f.id, score: s })
  }
  return new Set([...best.values()].map((b) => b.id))
}
