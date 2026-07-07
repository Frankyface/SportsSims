// The bridge from the rating layer to the deterministic sim: convert a team's
// current Glicko rating + identity/style into the playing-strength multipliers
// that simulateMatch consumes. Stronger Elo -> better attack/defense/finishing;
// higher RD -> a wider per-match form swing (more upset-prone).

import type { Glicko } from './glicko2'
import type { TeamIdentity } from './teams'
import type { TeamRating } from '../sim/types'

function clamp(x: number, lo: number, hi: number): number {
  return x < lo ? lo : x > hi ? hi : x
}

export function toTeamRating(identity: TeamIdentity, glicko: Glicko): TeamRating {
  const s = (glicko.rating - 1500) / 300 // ~ -1 (weak) .. +1 (strong) for 1200..1800

  return {
    id: identity.id,
    name: identity.name,
    abbr: identity.abbr,
    city: identity.city,
    color: identity.color,
    colorAlt: identity.colorAlt,
    // Strength lifts both attack and defense; style tilts between them.
    attack: clamp(1 + s * 0.16 + identity.styleTilt, 0.6, 1.5),
    defense: clamp(1 + s * 0.16 - identity.styleTilt, 0.6, 1.5),
    finishing: clamp(1 + s * 0.12, 0.7, 1.4),
    discipline: 1,
    // Higher rating deviation (more uncertain team) => wider form swings => more upsets.
    formSpread: clamp(0.1 + glicko.rd / 1600, 0.1, 0.24),
  }
}
