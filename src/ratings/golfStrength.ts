// The bridge from the rating layer to the deterministic golf sim: convert a
// tour golfer's current Glicko rating + identity/style into the playing
// strengths that simulateGolfRound consumes. Stronger rating -> better skill;
// higher RD -> a wider per-round form swing (more upset-prone).

import type { TourGolfer } from './golfers'
import type { GolferRating } from '../sim/golfTypes'

function clamp(x: number, lo: number, hi: number): number {
  return x < lo ? lo : x > hi ? hi : x
}

export function toGolferRating(g: TourGolfer): GolferRating {
  const s = (g.glicko.rating - 1500) / 300 // ~ -1 (weak) .. +1 (strong) for 1200..1800
  return {
    id: g.identity.id,
    name: g.identity.name,
    abbr: g.identity.abbr,
    color: g.identity.color,
    colorAlt: g.identity.colorAlt,
    skill: clamp(s, -1.2, 1.2),
    riskTilt: g.identity.riskTilt,
    clutch: g.clutch,
    // Higher rating deviation (more uncertain golfer) => wider round-to-round swings.
    formSpread: clamp(0.1 + g.glicko.rd / 1600, 0.1, 0.24),
  }
}
