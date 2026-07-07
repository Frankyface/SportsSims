// Glicko-2 rating system (Glickman, 2013 — "Example of the Glicko-2 system").
//
// This runs at the LEAGUE level only — never inside the deterministic per-frame
// match sim — so it is free to use exp/log/sqrt. The ratings/RD/volatility it
// produces are stored in league state; the match sim consumes only the derived
// playing strengths (see strength.ts), keeping simulateMatch pure & replayable.

const SCALE = 173.7178
const DEFAULT_TAU = 0.5 // system volatility constant (smaller = slower vol change)
const EPSILON = 0.000001

export interface Glicko {
  rating: number // display scale, e.g. 1500
  rd: number // rating deviation (uncertainty), 350 (new) .. ~30 (well established)
  vol: number // volatility σ, e.g. 0.06
}

export interface GameResult {
  opponent: Glicko
  score: number // 1 = win, 0.5 = draw, 0 = loss
}

export function newPlayer(rating = 1500, rd = 350, vol = 0.06): Glicko {
  return { rating, rd, vol }
}

function g(phi: number): number {
  return 1 / Math.sqrt(1 + (3 * phi * phi) / (Math.PI * Math.PI))
}

/** Update a player's Glicko-2 after a batch of games. Returns a NEW Glicko (immutable). */
export function updateGlicko(player: Glicko, games: GameResult[], tau = DEFAULT_TAU): Glicko {
  const phi = player.rd / SCALE

  if (games.length === 0) {
    // No games this period: only RD grows (uncertainty increases).
    const phiStar = Math.sqrt(phi * phi + player.vol * player.vol)
    return { rating: player.rating, rd: Math.min(phiStar * SCALE, 350), vol: player.vol }
  }

  const mu = (player.rating - 1500) / SCALE

  let vInv = 0
  let deltaSum = 0
  for (const game of games) {
    const muJ = (game.opponent.rating - 1500) / SCALE
    const phiJ = game.opponent.rd / SCALE
    const gj = g(phiJ)
    const e = 1 / (1 + Math.exp(-gj * (mu - muJ)))
    vInv += gj * gj * e * (1 - e)
    deltaSum += gj * (game.score - e)
  }
  const v = 1 / vInv
  const delta = v * deltaSum

  // --- New volatility via the Illinois (regula falsi) iteration ---
  const a = Math.log(player.vol * player.vol)
  const f = (x: number): number => {
    const ex = Math.exp(x)
    const d2 = delta * delta
    const pv = phi * phi + v
    return (ex * (d2 - pv - ex)) / (2 * (pv + ex) * (pv + ex)) - (x - a) / (tau * tau)
  }

  let A = a
  let B: number
  if (delta * delta > phi * phi + v) {
    B = Math.log(delta * delta - phi * phi - v)
  } else {
    let k = 1
    while (f(a - k * tau) < 0) k += 1
    B = a - k * tau
  }
  let fA = f(A)
  let fB = f(B)
  while (Math.abs(B - A) > EPSILON) {
    const C = A + ((A - B) * fA) / (fB - fA)
    const fC = f(C)
    if (fC * fB <= 0) {
      A = B
      fA = fB
    } else {
      fA = fA / 2
    }
    B = C
    fB = fC
  }
  const newVol = Math.exp(A / 2)

  const phiStar = Math.sqrt(phi * phi + newVol * newVol)
  const newPhi = 1 / Math.sqrt(1 / (phiStar * phiStar) + 1 / v)
  const newMu = mu + newPhi * newPhi * deltaSum

  return {
    rating: SCALE * newMu + 1500,
    rd: SCALE * newPhi,
    vol: newVol,
  }
}

/**
 * Season-to-season decay: regress the rating toward the league mean (1500) and
 * inflate RD (uncertainty). This stops dynasties running away forever and gives
 * weak teams a path back — each new season is a fresh, if informed, start.
 */
export function decayGlicko(player: Glicko, regress = 0.25, rdInflate = 1.25, maxRd = 350): Glicko {
  return {
    rating: 1500 + (player.rating - 1500) * (1 - regress),
    rd: Math.min(player.rd * rdInflate, maxRd),
    vol: player.vol,
  }
}

/** Win probability of A vs B from their ratings (Glicko expectation, for previews/odds). */
export function winProbability(a: Glicko, b: Glicko): number {
  const muA = (a.rating - 1500) / SCALE
  const muB = (b.rating - 1500) / SCALE
  const phi = Math.sqrt((a.rd * a.rd + b.rd * b.rd)) / SCALE
  return 1 / (1 + Math.exp(-g(phi) * (muA - muB)))
}
