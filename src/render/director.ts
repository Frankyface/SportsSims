// The "director" turns a 90-minute event timeline into a ~30s highlight edit:
// it picks which events to show, dwells on goals, and lays them out on a render
// clock. Pure and deterministic — the same plan drives live preview and export.

import type { MatchResult, Side } from '../sim/types'

export type BeatKind = 'intro' | 'goal' | 'bigChance' | 'save' | 'miss' | 'card' | 'result'

export interface Beat {
  start: number // render seconds
  dur: number
  kind: BeatKind
  team: Side | null
  minute: number
  score: [number, number]
  shotXY: [number, number]
  label: string
}

export interface RenderPlan {
  beats: Beat[]
  total: number
}

const DUR: Record<string, number> = {
  intro: 2.6,
  goal: 3.6,
  bigChance: 1.9,
  save: 1.3,
  miss: 1.1,
  card: 1.2,
  result: 3.4,
  gap: 0.45,
}
const MAX_ACTION_BEATS = 11

export function buildRenderPlan(m: MatchResult): RenderPlan {
  const key = m.events.filter(
    (e) =>
      e.type === 'goal' ||
      e.type === 'bigChance' ||
      e.type === 'save' ||
      e.type === 'miss' ||
      e.type === 'red' ||
      e.type === 'yellow',
  )
  // Goals, big chances and cards are always shown; saves/misses fill remaining slots.
  const must = key.filter(
    (e) => e.type === 'goal' || e.type === 'bigChance' || e.type === 'red' || e.type === 'yellow',
  )
  const fill = key.filter((e) => e.type === 'save' || e.type === 'miss')
  const chosen = [...must]
  for (const e of fill) {
    if (chosen.length >= MAX_ACTION_BEATS) break
    chosen.push(e)
  }
  chosen.sort((a, b) => a.minute - b.minute || a.id - b.id)

  const beats: Beat[] = []
  let t = 0
  beats.push({ start: 0, dur: DUR.intro, kind: 'intro', team: null, minute: 0, score: [0, 0], shotXY: [0.5, 0.5], label: '' })
  t += DUR.intro

  for (const e of chosen) {
    t += DUR.gap
    const kind: BeatKind = e.type === 'red' || e.type === 'yellow' ? 'card' : (e.type as BeatKind)
    const dur = DUR[kind] ?? 1.2
    beats.push({
      start: t,
      dur,
      kind,
      team: e.team,
      minute: e.minute,
      score: [e.scoreAfter[0], e.scoreAfter[1]],
      shotXY: e.shotXY ?? [0.5, 0.5],
      label: e.label ?? '',
    })
    t += dur
  }

  t += DUR.gap
  beats.push({ start: t, dur: DUR.result, kind: 'result', team: null, minute: 90, score: m.score, shotXY: [0.5, 0.5], label: 'FULL-TIME' })
  t += DUR.result

  return { beats, total: t }
}

export function beatAt(plan: RenderPlan, t: number): { beat: Beat; progress: number } {
  let b = plan.beats[0]
  for (const beat of plan.beats) {
    if (t >= beat.start) b = beat
    else break
  }
  const progress = Math.max(0, Math.min(1, (t - b.start) / b.dur))
  return { beat: b, progress }
}
