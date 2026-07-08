// The golf director — turns a simulated nine-hole round into a ~60s broadcast
// plan. Golf has no clock, so the spine is HOLE CHAPTERS: the round's drama
// decides whether the clip covers 9, 6 or 3 holes in full (skipped holes
// collapse into quick leaderboard ticks), each covered hole stages its most
// dramatic shots as animated ball flights, and the leaderboard steps live as
// holes close. Pure and deterministic — a pure function of the round result.

import type { GolfEvent, GolfRoundResult, GolfShot } from '../sim/golfTypes'
import { HOLES_PER_ROUND, FIELD_SIZE } from '../sim/golfTypes'

export interface GolfFeaturedShot {
  t0: number
  t1: number
  shot: GolfShot
}

export interface GolfChapter {
  hole: number
  t0: number
  t1: number
  covered: boolean // false → a quick "thru N" leaderboard tick
  featured: GolfFeaturedShot[]
}

export type GolfMomentKind =
  | 'ace'
  | 'eagle'
  | 'birdie'
  | 'bogey'
  | 'double'
  | 'splash'
  | 'longPutt'
  | 'leadChange'
  | 'winner'

export interface GolfMoment {
  t: number
  dur: number
  kind: GolfMomentKind
  golfer: number | null
  hole: number
  label: string
}

export interface GolfLbRow {
  golfer: number
  toPar: number
  thru: number
}

export interface GolfLbKeyframe {
  t: number
  rows: GolfLbRow[] // sorted best-first
}

export interface GolfRenderPlan {
  total: number
  introDur: number
  playStart: number
  playEnd: number
  resultStart: number
  resultDur: number
  chapters: GolfChapter[]
  moments: GolfMoment[]
  lb: GolfLbKeyframe[]
  coveredCount: 3 | 6 | 9
}

const INTRO_DUR = 3.0
const RESULT_DUR = 4.4
const FT_BEAT = 0.6
const PLAY_WINDOW = 53 // fixed by construction → runtime ~61s, always in band
const TICK_DUR = 1.15
const HOLE_CARD = 0.9 // hole-number splash at the top of a chapter
const LB_BEAT = 0.7 // leaderboard settle at the end of a chapter

const EVENT_DRAMA: Record<GolfEvent['type'], number> = {
  ace: 100,
  eagle: 60,
  winner: 50,
  leadChange: 30,
  splash: 26,
  longPutt: 24,
  double: 22,
  birdie: 14,
  bogey: 4,
}

export function formatToPar(n: number): string {
  return n === 0 ? 'E' : n > 0 ? `+${n}` : `${n}`
}

/** Running tournament to-par per golfer THROUGH a given hole (inclusive). */
export function golfTotalsThru(m: GolfRoundResult, holeIdx: number): number[] {
  return m.config.golfers.map((_, gi) => {
    let v = m.config.startToPar[gi]
    for (let hIdx = 0; hIdx <= holeIdx; hIdx++) {
      v += m.strokes[gi][hIdx] - m.config.course.holes[hIdx].par
    }
    return v
  })
}

function sortedRows(totals: number[], thru: number): GolfLbRow[] {
  return totals
    .map((toPar, golfer) => ({ golfer, toPar, thru }))
    .sort((a, b) => a.toPar - b.toPar || a.golfer - b.golfer)
}

function momentLabel(m: GolfRoundResult, e: GolfEvent): string {
  const g = e.golfer !== null ? m.config.golfers[e.golfer] : null
  const nm = g ? g.name.toUpperCase() : ''
  const short = nm.length > 18 && g ? g.abbr : nm
  const tp = formatToPar(e.toParAfter)
  switch (e.type) {
    case 'ace':
      return `${short} — HOLE IN ONE!`
    case 'eagle':
      return `EAGLE — ${short} TO ${tp}`
    case 'birdie':
      return `BIRDIE — ${short} TO ${tp}`
    case 'bogey':
      return `BOGEY — ${short} SLIPS TO ${tp}`
    case 'double':
      return `DISASTER — ${short} TO ${tp}`
    case 'splash':
      return `${short} FINDS THE WATER`
    case 'longPutt':
      return `${short} FROM DOWNTOWN!`
    case 'leadChange':
      return `NEW LEADER — ${short} ${tp}`
    case 'winner':
      return `${short} WINS IT`
  }
}

const MOMENT_DUR: Record<GolfMomentKind, number> = {
  ace: 3.2,
  eagle: 2.8,
  birdie: 2.0,
  bogey: 1.8,
  double: 2.4,
  splash: 2.2,
  longPutt: 2.4,
  leadChange: 2.4,
  winner: 3.0,
}

/** Priority when overlays collide (higher wins). */
const MOMENT_PRIORITY: Record<GolfMomentKind, number> = {
  ace: 10,
  winner: 9,
  eagle: 8,
  leadChange: 7,
  longPutt: 6,
  splash: 5,
  double: 5,
  birdie: 3,
  bogey: 1,
}

/** Pick the featured shots for one covered hole, ordered as a build-to-climax. */
function pickFeatured(m: GolfRoundResult, holeIdx: number, maxShots: number): GolfShot[] {
  const holeEvents = m.events.filter((e) => e.hole === holeIdx && e.golfer !== null && e.type !== 'winner' && e.type !== 'leadChange')
  const score = new Map<number, number>()
  for (const e of holeEvents) {
    score.set(e.golfer as number, (score.get(e.golfer as number) ?? 0) + EVENT_DRAMA[e.type])
  }
  const ranked = [...score.entries()].sort((a, b) => b[1] - a[1])
  const shotsOf = (gi: number): GolfShot[] => m.shots.filter((s) => s.golfer === gi && s.hole === holeIdx)

  let primary: number
  if (ranked.length > 0) primary = ranked[0][0]
  else {
    // quiet hole: follow whoever leads the tournament through the previous hole
    const totals = golfTotalsThru(m, Math.max(0, holeIdx - 1))
    primary = sortedRows(totals, holeIdx)[0].golfer
  }

  const pShots = shotsOf(primary)
  const money = pShots.find((s) => s.penalty) && ranked[0]?.[1] === EVENT_DRAMA.splash
    ? (pShots.find((s) => s.penalty) as GolfShot)
    : pShots[pShots.length - 1]
  const setupIdx = pShots.indexOf(money) - 1
  const setup = setupIdx >= 0 ? pShots[setupIdx] : null

  const picks: GolfShot[] = []
  if (maxShots >= 3 && ranked.length > 1) {
    const sShots = shotsOf(ranked[1][0])
    picks.push(sShots[sShots.length - 1]) // rival's money shot first...
  }
  if (picks.length + (setup ? 1 : 0) + 1 <= maxShots && setup) picks.push(setup) // ...then the build-up...
  picks.push(money) // ...climax last
  return picks.slice(-maxShots)
}

/** Build the full render plan for a golf round. */
export function buildGolfRenderPlan(m: GolfRoundResult): GolfRenderPlan {
  // --- per-hole drama + coverage decision (9 / 6 / 3 holes) ---
  const drama = Array(HOLES_PER_ROUND).fill(0) as number[]
  for (const e of m.events) drama[e.hole] += EVENT_DRAMA[e.type]
  drama[HOLES_PER_ROUND - 1] += 12 // the closing hole always matters

  const total = drama.reduce((s, x) => s + x, 0)
  const byDrama = drama.map((_, i) => i).sort((a, b) => drama[b] - drama[a] || a - b)
  const top3 = byDrama.slice(0, 3).reduce((s, i) => s + drama[i], 0)
  const top6 = byDrama.slice(0, 6).reduce((s, i) => s + drama[i], 0)
  let coveredCount: 3 | 6 | 9 = 9
  if (total > 0 && top3 / total > 0.62) coveredCount = 3
  else if (total > 0 && top6 / total > 0.85) coveredCount = 6

  const covered = new Set(byDrama.slice(0, coveredCount))
  covered.add(HOLES_PER_ROUND - 1) // never skip the finish
  while (covered.size > coveredCount) {
    // adding the 9th displaced the weakest pick
    const weakest = [...covered].filter((hIdx) => hIdx !== HOLES_PER_ROUND - 1).sort((a, b) => drama[a] - drama[b])[0]
    covered.delete(weakest)
  }

  // --- time allocation: ticks fixed, covered holes share the rest by drama ---
  const nTicks = HOLES_PER_ROUND - covered.size
  const chapterBudget = PLAY_WINDOW - nTicks * TICK_DUR
  const weights = [...covered].reduce((s, hIdx) => s + 2 + drama[hIdx] * 0.06, 0)

  const chapters: GolfChapter[] = []
  const lb: GolfLbKeyframe[] = [{ t: INTRO_DUR, rows: sortedRows(m.config.startToPar, 0) }]
  const moments: GolfMoment[] = []
  let t = INTRO_DUR

  for (let holeIdx = 0; holeIdx < HOLES_PER_ROUND; holeIdx++) {
    const isCovered = covered.has(holeIdx)
    const dur = isCovered ? (chapterBudget * (2 + drama[holeIdx] * 0.06)) / weights : TICK_DUR
    const chapter: GolfChapter = { hole: holeIdx, t0: t, t1: t + dur, covered: isCovered, featured: [] }

    if (isCovered) {
      const shotWindow = dur - HOLE_CARD - LB_BEAT
      const nShots = Math.max(1, Math.min(3, Math.round(shotWindow / 2.3)))
      const picks = pickFeatured(m, holeIdx, nShots)
      const per = shotWindow / picks.length
      picks.forEach((shot, i) => {
        chapter.featured.push({ t0: t + HOLE_CARD + i * per, t1: t + HOLE_CARD + (i + 1) * per, shot })
      })

      // Moments fire when "their" featured shot lands; otherwise at the lb beat.
      for (const e of m.events.filter((x) => x.hole === holeIdx && x.type !== 'winner')) {
        const kind = e.type as GolfMomentKind
        if (kind === 'bogey' && e.toParAfter > golfTotalsThru(m, holeIdx)[sortedRows(golfTotalsThru(m, holeIdx), 0)[2].golfer]) {
          continue // bogeys only matter near the top of the board
        }
        const feat = chapter.featured.find((f) => f.shot.golfer === e.golfer)
        const at = feat ? Math.min(feat.t1 - 0.15, feat.t0 + (feat.t1 - feat.t0) * 0.66) : chapter.t1 - LB_BEAT
        moments.push({ t: at, dur: MOMENT_DUR[kind], kind, golfer: e.golfer, hole: holeIdx, label: momentLabel(m, e) })
      }
    }

    t += dur
    lb.push({ t: t - LB_BEAT * 0.5, rows: sortedRows(golfTotalsThru(m, holeIdx), holeIdx + 1) })
    chapters.push(chapter)
  }

  const playEnd = t
  const resultStart = playEnd + FT_BEAT
  const winner = m.events.find((e) => e.type === 'winner')
  if (winner) {
    moments.push({
      t: playEnd - 2.2,
      dur: MOMENT_DUR.winner,
      kind: 'winner',
      golfer: winner.golfer,
      hole: winner.hole,
      label: momentLabel(m, winner),
    })
  }

  return {
    total: resultStart + RESULT_DUR,
    introDur: INTRO_DUR,
    playStart: INTRO_DUR,
    playEnd,
    resultStart,
    resultDur: RESULT_DUR,
    chapters,
    moments: moments.sort((a, b) => a.t - b.t),
    lb,
    coveredCount,
  }
}

/** The chapter on screen at render-time t (clamped to the play window). */
export function golfChapterAt(plan: GolfRenderPlan, t: number): GolfChapter {
  const tt = Math.min(Math.max(t, plan.playStart), plan.playEnd - 0.001)
  for (const c of plan.chapters) {
    if (tt >= c.t0 && tt < c.t1) return c
  }
  return plan.chapters[plan.chapters.length - 1]
}

/** Leaderboard rows current at render-time t (stepped keyframes). */
export function golfLbAt(plan: GolfRenderPlan, t: number): GolfLbRow[] {
  let rows = plan.lb[0].rows
  for (const kf of plan.lb) {
    if (kf.t <= t) rows = kf.rows
    else break
  }
  return rows
}

/** Highest-priority moment active at t (one lower third at a time). */
export function pickActiveGolfMoment(plan: GolfRenderPlan, t: number): GolfMoment | null {
  let best: GolfMoment | null = null
  for (const mo of plan.moments) {
    if (t < mo.t || t > mo.t + mo.dur) continue
    if (!best || MOMENT_PRIORITY[mo.kind] > MOMENT_PRIORITY[best.kind]) best = mo
  }
  return best
}

export { FIELD_SIZE }
