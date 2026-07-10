// DISPLAY grouping for golf round videos — which four golfers each video follows.
//
// The SIM field order is frozen (one shared RNG stream consumed in field order,
// golden-guarded) and for rounds 2-4 it sorts worst-first/leaders-last — so the
// sim's "group 2" is always the top four, which gives the result away when both
// group videos post the same day. This module re-partitions the field for the
// RENDER layer only: a seeded draw on the round's own seedKey, deterministic
// (same round → same foursomes forever), zero contact with the sim stream.

import { makeRng } from '../sim/prng'
import { FIELD_SIZE, GROUP_SIZE } from '../sim/golfTypes'

/**
 * The two display foursomes for a round, as ROUND-CONFIG indices (0..7 in the
 * sim's field order). `[group1, group2]`; array order = first-hole tee order.
 */
export function golfDisplayGroups(roundSeedKey: string): [number[], number[]] {
  const rng = makeRng(`${roundSeedKey}:dispgrp`)
  const order = Array.from({ length: FIELD_SIZE }, (_, i) => i)
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    const tmp = order[i]
    order[i] = order[j]
    order[j] = tmp
  }
  return [order.slice(0, GROUP_SIZE), order.slice(GROUP_SIZE)]
}
