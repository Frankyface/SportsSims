// Shared formation geometry for the continuous-play engine.
// Normalized pitch space: x in [0,1] across the width, y in [0,1] down the
// length. y=0 is the TOP goal line (home attacks top), y=1 the BOTTOM
// (home defends bottom). The away side is the vertical mirror.
//
// Lives in src/sim so the deterministic choreographer can assign touches to
// player slots; the renderer imports the same table so the dots that receive
// passes are the dots drawn on screen. Determinism hygiene applies here.

import type { Side } from './types'

/** 8 slots per team: 0 = keeper, 1-4 = defence, 5-6 = midfield, 7 = striker. */
export const SLOTS: ReadonlyArray<readonly [number, number]> = [
  [0.5, 0.96], // keeper
  [0.16, 0.8],
  [0.38, 0.84],
  [0.62, 0.84],
  [0.84, 0.8],
  [0.3, 0.62],
  [0.7, 0.62],
  [0.5, 0.44], // striker
]

export const KEEPER_SLOT = 0
export const CENTER: readonly [number, number] = [0.5, 0.5]

/** Base (kickoff) position of a slot, mirrored for the away side. */
export function slotBase(side: Side, slot: number): [number, number] {
  const s = SLOTS[slot]
  return side === 'home' ? [s[0], s[1]] : [s[0], 1 - s[1]]
}

/**
 * Nearest outfield slot of `side` to a point (squared distance — no sqrt
 * needed to compare). `exclude` avoids handing consecutive touches to the
 * same dot; `exclude2` keeps a sent-off player out of the game. Pass -1 to
 * allow any.
 */
export function nearestSlot(side: Side, x: number, y: number, exclude: number, exclude2 = -1): number {
  let best = -1
  let bestD = Infinity
  for (let i = 1; i < SLOTS.length; i++) {
    if (i === exclude || i === exclude2) continue
    const b = slotBase(side, i)
    const dx = b[0] - x
    const dy = b[1] - y
    const d = dx * dx + dy * dy
    if (d < bestD) {
      bestD = d
      best = i
    }
  }
  return best
}
