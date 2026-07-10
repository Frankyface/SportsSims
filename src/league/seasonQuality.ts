// "Good season" quality gate + auto-roll selector.
//
// When a competition's season ends, the cadence must pick a GOOD next season
// automatically (the operator never re-rolls by hand). Because ratings carry
// forward, the ONLY lever is the per-season RESULT seed: for the SAME carried
// ratings we enumerate candidate result-seeds, fully simulate each (pure, fast,
// no rendering), score each on narrative quality, and pick one.
//
// A good season = decent PARITY + at least one HISTORIC hook. To keep upsets
// ("historic loser back on top") rare AND force season-to-season variety, we draw
// a deterministic per-season TARGET ARCHETYPE (weighted so the loser-comeback is
// uncommon) and reward candidates that hit that archetype, on top of a baseline
// parity+hook score. Deterministic and reproducible — we record the chosen roll.
//
// NOTE: scoring weights + archetype table are tuned constants; see SEASON_QUALITY.

import type { LeagueState } from './types'
import { computeStandings, winnerOf, advanceSeasonWithSeed, seasonComplete } from './league'
import type { GolfSeasonState } from './golfSeason'
import { golfRankings, advanceGolfSeasonWithSeed, golfSeasonComplete } from './golfSeason'
import { eventById } from '../ratings/golfCourses'
import { playSoccerSeasonToEnd, playGolfSeasonToEnd } from '../headless/seasonReconstruct'
import { makeRng } from '../sim/prng'

export const SEASON_QUALITY = {
  /** How many result-seed candidates to try per transition. */
  CANDIDATE_CAP: 48,
  /** A candidate at/above this composite is accepted as soon as it's found. */
  ACCEPT: 0.62,
  /** Parity's share of the composite; the rest is the best narrative hook. */
  PARITY_WEIGHT: 0.4,
  /** Bonus for hitting the season's drawn target archetype. */
  ARCHETYPE_BONUS: 0.2,
  /** Small bonus for a genuine SECOND distinct hook (a layered story). */
  SECOND_HOOK_BONUS: 0.08,
} as const

export interface SeasonPick {
  roll: string
  score: number
  archetype: string
  hooks: string[]
}

interface Scored {
  score: number
  parity: number
  archetype: string
  hooks: { name: string; strength: number }[]
}

/** Archetypes we deliberately steer toward, with draw weights. The loser-comeback
 * ("underdog") is weighted LOW so it stays rare, per the operator. */
const ARCHETYPES = [
  { name: 'title-race', weight: 3 }, // down-to-the-wire points/table race
  { name: 'rivalry', weight: 3 }, // a two-horse race, top 2 clear of the pack
  { name: 'dynasty', weight: 2 }, // repeat / dominant champion (strong stays strong)
  { name: 'maiden', weight: 2 }, // a first-time champion / first major
  { name: 'parity', weight: 2 }, // spread-out, anyone-beats-anyone season
  { name: 'underdog', weight: 1 }, // historic loser back on top — RARE
] as const

function drawArchetype(root: string, season: number): string {
  const rng = makeRng(`${root}:archetype:s${season}`)
  const total = ARCHETYPES.reduce((s, a) => s + a.weight, 0)
  let x = rng() * total
  for (const a of ARCHETYPES) {
    x -= a.weight
    if (x < 0) return a.name
  }
  return ARCHETYPES[0].name
}

const clamp01 = (x: number): number => (x < 0 ? 0 : x > 1 ? 1 : x)
/** Population standard deviation. */
function stdev(xs: number[]): number {
  const m = xs.reduce((s, x) => s + x, 0) / xs.length
  let v = 0
  for (const x of xs) v += (x - m) * (x - m)
  return Math.sqrt(v / xs.length)
}
/** A "parity tent": penalize BOTH a lopsided spread AND a totally flat table
 * (everyone equal is as boring/unrealistic as a runaway). Peaks at `peak`. */
function parityTent(sd: number, peak: number, high: number): number {
  return sd <= peak ? clamp01(0.5 + (0.5 * sd) / peak) : clamp01(1 - (sd - peak) / (high - peak))
}

/** Upset-flavored hooks only count toward the composite in an 'underdog' season
 * (the operator: "historic loser back on top shouldn't happen much"). Elsewhere
 * they stay available as an occasional targeted archetype, never winning the
 * fallback selection. */
const GATED_HOOKS = new Set(['underdog'])

// ---------- soccer scoring ----------------------------------------------------

function scoreSoccerSeason(finished: LeagueState, target: string): Scored {
  const table = computeStandings(finished)
  const n = table.length
  const pts = table.map((r) => r.points)
  const champion = winnerOf(finished, 'final')
  const shieldId = table[0].teamId
  const prior = finished.history[finished.history.length - 1] // most recent PAST season

  const titleGap = pts[0] - pts[1]
  const parityRace = clamp01(1 - titleGap / 9) // 3 wins clear = 0
  const parityBand = parityTent(stdev(pts), 6, 13) // flat OR blowout both dampened
  const parity = clamp01(0.55 * parityBand + 0.45 * parityRace)

  const priorPosOf = (teamId: string): number | null => {
    if (!prior) return null
    const idx = prior.table.findIndex((t) => t.teamId === teamId)
    return idx < 0 ? null : idx
  }
  const championPriorPos = priorPosOf(champion)
  const wonBefore = finished.history.some((h) => h.championId === champion)
  const championSeed = table.findIndex((r) => r.teamId === champion) // 0..3 playoff seed

  const hooks: { name: string; strength: number }[] = []
  const add = (name: string, strength: number) => { if (strength > 0.01) hooks.push({ name, strength: clamp01(strength) }) }

  const spread = pts[0] - pts[n - 1]
  if (prior && prior.championId === champion) add('dynasty', 1) // back-to-back
  add('title-race', titleGap <= 3 ? parityRace : 0)
  // rivalry: top 2 tight AND clear of 3rd
  if (n >= 3) add('rivalry', clamp01((1 - titleGap / 4) * clamp01((pts[1] - pts[2]) / 4)))
  if (!wonBefore) add('maiden', 0.72)
  // playoff cinderella (a low seed lifts the trophy) — capped below maiden so it
  // can't dominate the fallback selection.
  if (shieldId !== champion) add('cinderella', Math.min(0.6, 0.4 + 0.07 * championSeed))
  // dominant wire-to-wire (a great-team story), counter to parity
  if (shieldId === champion) add('dynasty', clamp01((spread - 10) / 14))
  add('parity', parity)
  // underdog / historic loser back on top — GATED (counts only in an underdog season)
  if (championPriorPos !== null && championPriorPos >= Math.ceil(n / 2)) {
    add('underdog', clamp01(0.45 + 0.15 * (championPriorPos - Math.ceil(n / 2) + 1)))
  }

  return composite(parity, hooks, target)
}

// ---------- golf scoring ------------------------------------------------------

function scoreGolfSeason(finished: GolfSeasonState, target: string): Scored {
  const rankings = golfRankings(finished)
  const champion = rankings[0].golferId
  const margin = rankings[0].points - rankings[1].points
  const winners = finished.completed.map((r) => r.winnerId)
  const distinctWinners = new Set(winners).size
  const majorWinners = finished.completed.filter((r) => eventById(r.eventId).major).map((r) => r.winnerId)
  const majorsByChamp = majorWinners.filter((w) => w === champion).length
  const topMajorStack = Math.max(0, ...[...new Set(majorWinners)].map((w) => majorWinners.filter((x) => x === w).length))
  const prior = finished.history[finished.history.length - 1]
  const wonBefore = finished.history.some((h) => h.rankingsChampionId === champion)

  const parityWinners = clamp01((distinctWinners - 2) / 5) // 2 distinct -> 0, 7 -> 1
  const closeRace = clamp01(1 - margin / 800) // ~<2 wins apart
  const parity = clamp01(0.55 * parityWinners + 0.45 * closeRace)

  const hooks: { name: string; strength: number }[] = []
  const add = (name: string, strength: number) => { if (strength > 0.01) hooks.push({ name, strength: clamp01(strength) }) }

  if (prior && prior.rankingsChampionId === champion) add('dynasty', 1)
  add('title-race', margin <= 300 ? closeRace : 0)
  add('rivalry', clamp01((1 - margin / 400) * clamp01((rankings[1].points - rankings[2].points) / 300)))
  if (!wonBefore) add('maiden', 0.7)
  if (topMajorStack >= 2) add('dynasty', clamp01((topMajorStack - 1) / 3)) // multi-major season
  add('parity', parity)
  // underdog: champ was bottom-half of the prior rankings — RARE
  if (prior) {
    const order = Object.entries(prior.points).sort((a, b) => b[1] - a[1]).map(([id]) => id)
    const pos = order.indexOf(champion)
    if (pos >= Math.ceil(order.length / 2)) add('underdog', clamp01(0.4 + 0.12 * (pos - Math.ceil(order.length / 2) + 1)))
  }
  void majorsByChamp

  return composite(parity, hooks, target)
}

// ---------- shared composite + selector ---------------------------------------

function composite(parity: number, hooksIn: { name: string; strength: number }[], target: string): Scored {
  // Gated (upset-flavored) hooks contribute to the score ONLY in their own
  // archetype season — otherwise they stay detected but can't win the fallback.
  const hooks = hooksIn.filter((h) => !GATED_HOOKS.has(h.name) || h.name === target)
  const sorted = [...hooks].sort((a, b) => b.strength - a.strength)
  const best = sorted[0]?.strength ?? 0
  const archetypeHit = sorted.find((h) => h.name === target)
  const archetypeBonus = archetypeHit ? SEASON_QUALITY.ARCHETYPE_BONUS * archetypeHit.strength : 0
  const secondHook = sorted.length >= 2 ? SEASON_QUALITY.SECOND_HOOK_BONUS * sorted[1].strength : 0
  const score = clamp01(
    SEASON_QUALITY.PARITY_WEIGHT * parity +
      (1 - SEASON_QUALITY.PARITY_WEIGHT) * best +
      archetypeBonus +
      secondHook,
  )
  return { score, parity, archetype: target, hooks: sorted }
}

function pickBest(
  root: string,
  nextSeason: number,
  buildAndScore: (roll: string, target: string) => Scored,
): SeasonPick {
  const target = drawArchetype(root, nextSeason)
  let best: { roll: string; s: Scored } | null = null
  for (let c = 0; c < SEASON_QUALITY.CANDIDATE_CAP; c++) {
    const roll = `${root}:s${nextSeason}:roll${c}`
    const s = buildAndScore(roll, target)
    if (!best || s.score > best.s.score) best = { roll, s }
    if (s.score >= SEASON_QUALITY.ACCEPT && s.hooks.some((h) => h.name === target)) {
      // first candidate that clears the bar AND hits the drawn archetype
      return { roll, score: s.score, archetype: target, hooks: s.hooks.map((h) => h.name) }
    }
  }
  // fallback: best-scoring candidate overall
  return { roll: best!.roll, score: best!.s.score, archetype: target, hooks: best!.s.hooks.map((h) => h.name) }
}

/** Choose the result-seed for `nextSeason` of soccer, given the FINISHED prior season. */
export function selectNextSoccerSeason(priorFinished: LeagueState, nextSeason: number): SeasonPick {
  if (!seasonComplete(priorFinished)) throw new Error('selectNextSoccerSeason: prior season is not complete')
  return pickBest(priorFinished.seedKey, nextSeason, (roll, target) =>
    scoreSoccerSeason(playSoccerSeasonToEnd(advanceSeasonWithSeed(priorFinished, roll)), target),
  )
}

/** Choose the result-seed for `nextSeason` of golf, given the FINISHED prior season. */
export function selectNextGolfSeason(priorFinished: GolfSeasonState, nextSeason: number): SeasonPick {
  if (!golfSeasonComplete(priorFinished)) throw new Error('selectNextGolfSeason: prior season is not complete')
  return pickBest(priorFinished.seedKey, nextSeason, (roll, target) =>
    scoreGolfSeason(playGolfSeasonToEnd(advanceGolfSeasonWithSeed(priorFinished, roll)), target),
  )
}
