// Rugby formation table — shared by the rugby choreographer and renderer so
// the dots receiving passes are the dots drawn (same contract as formation.ts
// for soccer). Determinism hygiene applies (this is src/sim).
//
// Coordinates are a normalized pitch: x in [0,1] across the width, y in [0,1]
// down the length. y=0 is the TOP try line (home attacks top, defends bottom);
// away is the vertical mirror.
//
// 10 dots per team — a readable subset of a 15 (a full XV is dot soup at phone
// size): 0 = fullback (deep kick cover), 1-5 = the pack (clustered centre-
// field), 6-9 = the backline (spread wide and staggered deeper).

import type { Side } from './types'

export const RUGBY_SLOTS: ReadonlyArray<readonly [number, number]> = [
  [0.5, 0.88], // 0 fullback
  [0.38, 0.56], // 1 prop
  [0.5, 0.55], // 2 hooker
  [0.62, 0.56], // 3 prop
  [0.44, 0.62], // 4 lock
  [0.56, 0.62], // 5 flanker
  [0.5, 0.7], // 6 scrum-half
  [0.34, 0.72], // 7 fly-half
  [0.18, 0.76], // 8 left wing
  [0.82, 0.76], // 9 right wing
]

export const FULLBACK_SLOT = 0
export const RUGBY_CENTER: readonly [number, number] = [0.5, 0.5]

export function rugbySlotBase(side: Side, slot: number): [number, number] {
  const s = RUGBY_SLOTS[slot]
  return side === 'home' ? [s[0], s[1]] : [s[0], 1 - s[1]]
}

/**
 * Nearest OUTFIELD slot (1-9; the fullback is only ever addressed explicitly,
 * e.g. fielding kicks) to a normalized point, skipping `exclude` (avoids
 * consecutive touches to the same dot) and every slot in `unavailable`
 * (sin-binned / sent-off players). Squared distance — no sqrt needed.
 */
export function rugbyNearestSlot(
  side: Side,
  x: number,
  y: number,
  exclude: number,
  unavailable: readonly number[] = [],
): number {
  let best = -1
  let bestD = Infinity
  for (let i = 1; i < RUGBY_SLOTS.length; i++) {
    if (i === exclude || unavailable.includes(i)) continue
    const p = rugbySlotBase(side, i)
    const dx = p[0] - x
    const dy = p[1] - y
    const d = dx * dx + dy * dy
    if (d < bestD) {
      bestD = d
      best = i
    }
  }
  return best
}
