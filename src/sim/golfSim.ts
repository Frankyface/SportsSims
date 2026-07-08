// Deterministic golf round sim — The Apex Tour engine.
//
// Eight golfers, two groups of four, nine holes, shot by shot. Same seed →
// byte-identical GolfRoundResult, so a saved season replays every round video
// exactly. All randomness comes from ONE seeded stream; determinism hygiene
// applies (no transcendental math — probabilities are piecewise linear).
//
// Model sketch (per shot): an execution-quality roll blends the golfer's
// skill, today's form, final-round pressure (clutch), the hole's difficulty
// and pure luck. Quality decides how far the shot advances, where it lands
// (fairway/rough/bunker/water) and how close approaches finish; a distance-
// based make table decides putts. riskTilt is a STYLE: aggressive golfers
// take on more hazard for better birdie looks — variance, not strength.

import { makeRng, randNormal, seedFromKey } from './prng'
import {
  FIELD_SIZE,
  GOLF_SIM_VERSION,
  GROUP_SIZE,
  HOLES_PER_ROUND,
  type GolfEvent,
  type GolfEventType,
  type GolfHoleDef,
  type GolfLie,
  type GolfRoundConfig,
  type GolfRoundResult,
  type GolfShot,
} from './golfTypes'

function clamp(x: number, lo: number, hi: number): number {
  return x < lo ? lo : x > hi ? hi : x
}
function clamp01(x: number): number {
  return x < 0 ? 0 : x > 1 ? 1 : x
}

/** Putt make probability by normalized pin distance (piecewise linear). */
function puttMakeProb(d: number, puttSkill: number): number {
  let base: number
  if (d <= 0.03) base = 0.99
  else if (d <= 0.08) base = 0.88 - (d - 0.03) * 6.0 // 0.88 -> 0.58
  else if (d <= 0.15) base = 0.58 - (d - 0.08) * 3.0 // 0.58 -> 0.37
  else if (d <= 0.3) base = 0.37 - (d - 0.15) * 1.4 // 0.37 -> 0.16
  else base = 0.16 - (d - 0.3) * 0.25 // long lags almost never drop
  return clamp(base + puttSkill * 0.08, 0.02, 0.995)
}

interface HoleState {
  y: number // 0 tee .. 1 pin
  x: number // lateral -1..1
  lie: GolfLie
  strokes: number
  shots: GolfShot[]
}

/** Per-shot execution quality: skill + form + pressure + luck, 0..1. */
function rollQuality(rng: () => number, perf: number, holeDiff: number): number {
  return clamp01(0.58 + perf * 0.2 + (rng() * 2 - 1) * 0.32 - holeDiff * 0.07)
}

/** The visible penalty DROP after a water ball — recorded, but NOT a stroke. */
function pushDrop(st: HoleState, golfer: number, hole: number, to: [number, number]): void {
  st.shots.push({
    golfer,
    hole,
    shotNo: st.strokes,
    kind: 'penaltyDrop',
    from: [st.x, st.y],
    to,
    fromLie: 'water',
    toLie: 'rough',
    quality: 1,
    holed: false,
    penalty: false,
  })
  st.x = to[0]
  st.y = to[1]
  st.lie = 'rough'
}

function pushShot(
  st: HoleState,
  golfer: number,
  hole: number,
  kind: GolfShot['kind'],
  to: [number, number],
  toLie: GolfLie,
  quality: number,
  opts: { holed?: boolean; penalty?: boolean } = {},
): void {
  st.shots.push({
    golfer,
    hole,
    shotNo: st.strokes + 1,
    kind,
    from: [st.x, st.y],
    to,
    fromLie: st.lie,
    toLie,
    quality,
    holed: opts.holed === true,
    penalty: opts.penalty === true,
  })
  st.strokes += opts.penalty ? 2 : 1 // a splashed ball costs the stroke AND a penalty
  st.x = to[0]
  st.y = to[1]
  st.lie = toLie
}

/**
 * Play one golfer's hole. Mutates nothing outside its own state; consumes the
 * shared stream in a fixed order (hole-outer, golfer-inner — see simulate).
 */
function playHole(
  rng: () => number,
  golfer: number,
  holeIdx: number,
  hole: GolfHoleDef,
  perf: number,
  risk: number,
): { strokes: number; shots: GolfShot[] } {
  const st: HoleState = { y: 0, x: 0, lie: 'tee', strokes: 0, shots: [] }
  // Loop bound, not a hard card cap: a penalty near the bound plus the pickup
  // putt can card up to par+6. The card ALWAYS equals the shot record.
  const maxStrokes = hole.par + 4

  // --- tee + long game: advance until the ball reaches the green ---
  while (st.lie !== 'green' && st.lie !== 'holed' && st.strokes < maxStrokes) {
    const q = rollQuality(rng, perf, hole.difficulty)
    const fromTrouble = st.lie === 'rough' ? 0.1 : st.lie === 'bunker' ? 0.22 : 0
    let eff = clamp01(q - fromTrouble)
    // the rough is a lottery: an extra variance die — flyers AND chunks
    if (st.lie === 'rough') eff = clamp01(eff + (rng() * 2 - 1) * 0.16)
    const remaining = 1 - st.y

    // Is this a green attempt? Par 3s always; otherwise once within reach.
    // Par-5 second shots: aggressive golfers go for the green from further out.
    const reach = st.lie === 'tee' && hole.par > 3 ? 0 : hole.par === 5 && st.strokes === 1 ? 0.62 + risk * 1.2 : 0.55
    const attackGreen = hole.par === 3 ? st.lie === 'tee' || remaining <= 0.55 : remaining <= reach

    if (!attackGreen) {
      // Advancing shot (drive or lay-up): cover ground, find a lie.
      const isDrive = st.lie === 'tee'
      let gain = isDrive ? 0.5 + eff * 0.26 + risk * 0.06 : Math.min(remaining - 0.12, 0.3 + eff * 0.2)
      if (st.lie === 'bunker') gain *= 0.55 // sand robs distance — it's hard in there
      const y2 = clamp(st.y + Math.max(0.08, gain), 0.05, 0.93)
      const lat = (rng() * 2 - 1) * (0.55 - eff * 0.35)
      const troubleRoll = rng()
      const splashP = hole.water ? clamp(hole.hazard * 0.08 + risk * 0.04 - eff * 0.06, 0, 0.22) : 0
      const bunkerP = clamp(hole.hazard * 0.11 - eff * 0.07, 0, 0.25)
      const roughP = clamp(0.3 - eff * 0.2 + risk * 0.06, 0.05, 0.45)
      if (troubleRoll < splashP) {
        // In the water: splash where it crossed, then the visible penalty drop.
        pushShot(st, golfer, holeIdx, isDrive ? 'drive' : 'approach', [lat < 0 ? -0.85 : 0.85, y2], 'water', eff, { penalty: true })
        pushDrop(st, golfer, holeIdx, [lat < 0 ? -0.62 : 0.62, y2 - 0.07])
      } else if (troubleRoll < splashP + bunkerP) {
        pushShot(st, golfer, holeIdx, isDrive ? 'drive' : 'approach', [lat < 0 ? -0.6 : 0.6, y2], 'bunker', eff)
      } else if (troubleRoll < splashP + bunkerP + roughP) {
        pushShot(st, golfer, holeIdx, isDrive ? 'drive' : 'approach', [clamp(lat * 1.4, -0.8, 0.8), y2], 'rough', eff)
      } else {
        pushShot(st, golfer, holeIdx, isDrive ? 'drive' : 'approach', [clamp(lat * 0.6, -0.4, 0.4), y2], 'fairway', eff)
      }
      continue
    }

    // Green attempt (tee shot on a par 3, approach, chip from just off).
    const isChip = remaining <= 0.12 && st.lie !== 'tee'
    const kind = isChip ? (st.lie === 'bunker' ? 'recovery' : 'chip') : st.lie === 'tee' && hole.par === 3 ? 'drive' : 'approach'
    const hitP = clamp01((isChip ? 0.86 : 0.7) + eff * 0.28 - remaining * 0.2 - hole.hazard * 0.07)
    if (rng() < hitP) {
      // On the green: how close? Flushed shots finish tight; bunker blasts
      // come out heavy and finish short-side long.
      let d = clamp(0.33 - eff * 0.24 + rng() * 0.13, 0.015, 0.42)
      if (st.lie === 'bunker') d = clamp(d + 0.09 + (1 - eff) * 0.08, 0.03, 0.5)
      // The rare holed-out approach / chip-in (an ace on a par 3 tee shot).
      if (d <= 0.02 && rng() < (isChip ? 0.3 : 0.12)) {
        pushShot(st, golfer, holeIdx, kind, [0, 1], 'holed', 1, { holed: true })
        break
      }
      const lat = (rng() * 2 - 1) * d * 0.7
      pushShot(st, golfer, holeIdx, kind, [lat, 1 - d * 0.08], 'green', eff)
    } else {
      // Missed the green: water (target-golf holes), sand, or thick stuff.
      const missRoll = rng()
      const splashP = hole.water ? clamp(hole.hazard * 0.2 + risk * 0.07 - eff * 0.1, 0, 0.38) : 0
      if (missRoll < splashP) {
        const side = st.x < 0 ? -1 : 1
        pushShot(st, golfer, holeIdx, kind, [side * 0.85, Math.max(0.66, 1 - remaining * 0.4)], 'water', eff, { penalty: true })
        pushDrop(st, golfer, holeIdx, [side * 0.6, Math.max(0.6, 1 - remaining * 0.5)])
      } else if (missRoll < splashP + 0.45) {
        pushShot(st, golfer, holeIdx, kind, [rng() < 0.5 ? -0.35 : 0.35, 0.93], 'bunker', eff)
      } else {
        pushShot(st, golfer, holeIdx, kind, [rng() < 0.5 ? -0.5 : 0.5, 0.9], 'rough', eff)
      }
    }
  }

  // --- putting ---
  while (st.lie === 'green' && st.strokes < maxStrokes) {
    // Recover the green-units distance the last shot left (y = 1 - d * 0.08).
    const pinD = clamp((1 - st.y) / 0.08, 0, 0.55) + Math.abs(st.x) * 0.1
    const q = rollQuality(rng, perf, 0)
    if (rng() < puttMakeProb(pinD, perf * 0.6 + (q - 0.5))) {
      pushShot(st, golfer, holeIdx, 'putt', [0, 1], 'holed', q, { holed: true })
      break
    }
    // Miss: leave the comeback. Good lags leave tap-ins; bad ones invite 3-putts.
    const leave = clamp(pinD * (0.32 - q * 0.22) + 0.015, 0.01, 0.14)
    pushShot(st, golfer, holeIdx, 'putt', [(rng() * 2 - 1) * leave * 0.5, 1 - leave * 0.08], 'green', q)
  }

  // Safety: hit the loop bound without holing out — one closing pickup putt,
  // so the card and the shot record always agree stroke for stroke.
  if (st.lie !== 'holed') {
    st.shots.push({
      golfer, hole: holeIdx, shotNo: st.strokes + 1, kind: 'putt',
      from: [st.x, st.y], to: [0, 1], fromLie: st.lie, toLie: 'holed',
      quality: 0.5, holed: true, penalty: false,
    })
    st.strokes += 1
  }
  return { strokes: st.strokes, shots: st.shots }
}

/** Simulate one nine-hole tournament round for the whole eight-golfer field. */
export function simulateGolfRound(config: GolfRoundConfig): GolfRoundResult {
  if (config.golfers.length !== FIELD_SIZE) throw new Error(`Golf sim needs a field of ${FIELD_SIZE}`)
  if (config.course.holes.length !== HOLES_PER_ROUND) throw new Error(`Golf courses are ${HOLES_PER_ROUND} holes`)
  const rng = makeRng(config.seedKey)

  // Today's form: one draw per golfer, in field order (frozen stream layout).
  const form = config.golfers.map((g) => randNormal(rng) * g.formSpread * 2.2)

  const strokes: number[][] = config.golfers.map(() => [])
  const allShots: GolfShot[] = []
  const events: GolfEvent[] = []
  const running = [...config.startToPar]
  let evId = 0
  let leader = -1 // outright leader golfer index, -1 = none yet/tied

  const pushEvent = (type: GolfEventType, hole: number, golfer: number | null, toParAfter: number): void => {
    events.push({ id: evId++, type, hole, golfer, toParAfter })
  }

  for (let holeIdx = 0; holeIdx < HOLES_PER_ROUND; holeIdx++) {
    const hole = config.course.holes[holeIdx]
    for (let gi = 0; gi < FIELD_SIZE; gi++) {
      const g = config.golfers[gi]
      // Final-round pressure on the closing stretch, for anyone in the hunt:
      // clutch golfers rise, tight ones shrink. Style-neutral on average.
      let pressure = 0
      if (config.round === 4 && holeIdx >= 5) {
        const best = Math.min(...running)
        if (running[gi] - best <= 2) pressure = g.clutch * 0.3 - 0.06
      }
      // Momentum: riding a hot round loosens the shoulders a touch.
      const roundSoFar = strokes[gi].reduce((s, x, i) => s + x - config.course.holes[i].par, 0)
      const heat = roundSoFar <= -2 ? 0.08 : roundSoFar >= 3 ? -0.06 : 0
      const perf = g.skill + form[gi] + pressure + heat
      const played = playHole(rng, gi, holeIdx, hole, perf, g.riskTilt)
      strokes[gi].push(played.strokes)
      allShots.push(...played.shots)
      running[gi] += played.strokes - hole.par

      const toPar = played.strokes - hole.par
      const holedOut = played.shots[played.shots.length - 1]
      if (played.strokes === 1) pushEvent('ace', holeIdx, gi, running[gi])
      else if (toPar <= -2) pushEvent('eagle', holeIdx, gi, running[gi])
      else if (toPar === -1) pushEvent('birdie', holeIdx, gi, running[gi])
      else if (toPar === 1) pushEvent('bogey', holeIdx, gi, running[gi])
      else if (toPar >= 2) pushEvent('double', holeIdx, gi, running[gi])
      if (played.shots.some((s) => s.penalty)) pushEvent('splash', holeIdx, gi, running[gi])
      if (
        holedOut.kind === 'putt' && holedOut.holed && toPar <= 0 &&
        (1 - holedOut.from[1]) / 0.08 >= 0.2
      ) {
        pushEvent('longPutt', holeIdx, gi, running[gi])
      }
    }
    // Lead check once the hole closes for the whole field.
    const best = Math.min(...running)
    const leaders = running.map((v, i) => (v === best ? i : -1)).filter((i) => i >= 0)
    if (leaders.length === 1 && leaders[0] !== leader) {
      leader = leaders[0]
      if (holeIdx > 0 || config.round > 1) pushEvent('leadChange', holeIdx, leader, best)
    } else if (leaders.length > 1) {
      leader = -1
    }
  }

  const roundToPar = strokes.map((hs) =>
    hs.reduce((s, x, i) => s + x - config.course.holes[i].par, 0),
  )
  const totalToPar = config.startToPar.map((s, gi) => s + roundToPar[gi])
  const leaderboard = totalToPar
    .map((_, i) => i)
    .sort((a, b) => totalToPar[a] - totalToPar[b] || a - b)

  if (config.round === 4) {
    pushEvent('winner', HOLES_PER_ROUND - 1, leaderboard[0], totalToPar[leaderboard[0]])
  }

  return {
    simVersion: GOLF_SIM_VERSION,
    config,
    strokes,
    shots: allShots,
    roundToPar,
    totalToPar,
    leaderboard,
    events,
    renderSeed: seedFromKey(`${config.seedKey}:render`),
  }
}

export { GROUP_SIZE }
