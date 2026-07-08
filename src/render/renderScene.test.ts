import { describe, it, expect } from 'vitest'
import { simulateMatch } from '../sim/simulateMatch'
import type { MatchConfig, MatchResult, TeamRating } from '../sim/types'
import { buildRenderPlan } from './director'
import { ballStateAt, playerPosAt, teamShiftAt, PITCH } from './renderScene'
import { SLOTS } from '../sim/formation'

function team(id: string, over: Partial<TeamRating> = {}): TeamRating {
  return {
    id,
    name: `${id} FC`,
    abbr: id,
    city: id,
    color: '#ffffff',
    colorAlt: '#000000',
    attack: 1,
    defense: 1,
    finishing: 1,
    discipline: 1,
    formSpread: 0.15,
    ...over,
  }
}

const cfg = (seedKey: string): MatchConfig => ({
  seedKey,
  homeAdvantage: 1.1,
  home: team('CAR', { attack: 1.05 }),
  away: team('KAN', { attack: 0.98 }),
})

const mk = (seedKey: string): MatchResult => simulateMatch(cfg(seedKey))

const FPS = 30

describe('scene — ball motion quality (the anti-jank gate)', () => {
  it('never teleports: frame-to-frame displacement stays under 160px at 30fps', () => {
    for (let s = 0; s < 10; s++) {
      const m = mk(`scene:${s}`)
      const plan = buildRenderPlan(m)
      let prev = ballStateAt(plan, plan.playStart)
      let maxStep = 0
      for (let t = plan.playStart; t <= plan.playEnd; t += 1 / FPS) {
        const b = ballStateAt(plan, t)
        const dx = b.x - prev.x
        const dy = b.y - prev.y
        maxStep = Math.max(maxStep, Math.sqrt(dx * dx + dy * dy))
        prev = b
      }
      expect(maxStep).toBeLessThan(160)
    }
  })

  it('the ball is actually moving through open play (not standing still)', () => {
    const plan = buildRenderPlan(mk('scene:move'))
    let moved = 0
    let samples = 0
    let prev = ballStateAt(plan, plan.playStart)
    for (let t = plan.playStart; t <= plan.playEnd; t += 1 / FPS) {
      const b = ballStateAt(plan, t)
      const dx = b.x - prev.x
      const dy = b.y - prev.y
      if (dx * dx + dy * dy > 1) moved++
      samples++
      prev = b
    }
    // in motion for well over half of open play (held celebrations/stoppages are still)
    expect(moved / samples).toBeGreaterThan(0.55)
  })

  it('stays inside the frame (net overshoot allowed, never off-canvas)', () => {
    for (let s = 0; s < 6; s++) {
      const plan = buildRenderPlan(mk(`bounds:${s}`))
      for (let t = plan.playStart; t <= plan.playEnd; t += 1 / FPS) {
        const b = ballStateAt(plan, t)
        expect(b.x).toBeGreaterThanOrEqual(PITCH.x - 60)
        expect(b.x).toBeLessThanOrEqual(PITCH.x + PITCH.w + 60)
        expect(b.y).toBeGreaterThanOrEqual(PITCH.y - 60)
        expect(b.y).toBeLessThanOrEqual(PITCH.y + PITCH.h + 60)
      }
    }
  })
})

describe('scene — anti-jank regression seeds (found by 600-sample stress fuzzing)', () => {
  // These exact (config, seed) pairs once pushed a post-goal restart retrieval
  // past the 160px/frame gate (easeInOut doubles mid-segment speed on the
  // longest fixed traversal). Locked here so the mechanism can never return.
  const goalfest = (seedKey: string): MatchConfig => ({
    seedKey,
    homeAdvantage: 1.1,
    home: team('HOM', { attack: 1.25, finishing: 1.15 }),
    away: team('AWY', { defense: 0.8 }),
  })
  const baseline = (seedKey: string): MatchConfig => ({
    seedKey,
    homeAdvantage: 1.1,
    home: team('HOM'),
    away: team('AWY'),
  })
  const cases: Array<[string, MatchConfig]> = [
    ['goalfest 18', goalfest('stress:goalfest-home:18')],
    ['goalfest 59', goalfest('stress:goalfest-home:59')],
    ['baseline 34', baseline('stress:baseline-1.0:34')],
    ['baseline 56', baseline('stress:baseline-1.0:56')],
  ]
  for (const [name, config] of cases) {
    it(`${name}: stays under the 160px/frame gate`, () => {
      const plan = buildRenderPlan(simulateMatch(config))
      let prev = ballStateAt(plan, plan.playStart)
      let maxStep = 0
      for (let t = plan.playStart; t <= plan.playEnd; t += 1 / FPS) {
        const b = ballStateAt(plan, t)
        const dx = b.x - prev.x
        const dy = b.y - prev.y
        maxStep = Math.max(maxStep, Math.sqrt(dx * dx + dy * dy))
        prev = b
      }
      expect(maxStep).toBeLessThan(160)
    })
  }
})

describe('scene — players move with the game', () => {
  it('players change position over open play (no statues)', () => {
    const m = mk('players:0')
    const plan = buildRenderPlan(m)
    const seed = m.renderSeed >>> 0
    // compare everyone's position at two moments mid-play
    const t0 = plan.playStart + (plan.playEnd - plan.playStart) * 0.3
    const t1 = t0 + 2.5
    const b0 = ballStateAt(plan, t0)
    const b1 = ballStateAt(plan, t1)
    const s0 = teamShiftAt(plan, t0)
    const s1 = teamShiftAt(plan, t1)
    let total = 0
    for (const side of ['home', 'away'] as const) {
      for (let slot = 0; slot < SLOTS.length; slot++) {
        const a = playerPosAt(plan, seed, side, slot, t0, b0, s0)
        const b = playerPosAt(plan, seed, side, slot, t1, b1, s1)
        const dx = a[0] - b[0]
        const dy = a[1] - b[1]
        total += Math.sqrt(dx * dx + dy * dy)
      }
    }
    // 16 players moving meaningfully — far beyond ±6px idle wobble
    expect(total).toBeGreaterThan(400)
  })

  it('receivers run to meet their pass (movement beyond wobble at arrival)', () => {
    const m = mk('players:receiver')
    const plan = buildRenderPlan(m)
    const seed = m.renderSeed >>> 0
    // find a decent-length pass and check its receiver converges on the target
    const seg = plan.segs.find(
      (x) =>
        x.kind === 'pass' &&
        x.slot >= 0 &&
        x.t1 - x.t0 > 0.3 &&
        Math.abs(x.to[0] - x.from[0]) + Math.abs(x.to[1] - x.from[1]) > 0.15,
    )
    expect(seg).toBeDefined()
    if (!seg) return
    const tArrive = seg.t1
    const tBefore = seg.t1 - 2.5
    const target = [PITCH.x + seg.to[0] * PITCH.w, PITCH.y + seg.to[1] * PITCH.h]
    const dist = (t: number): number => {
      const b = ballStateAt(plan, t)
      const sh = teamShiftAt(plan, t)
      const p = playerPosAt(plan, seed, seg.team, seg.slot, t, b, sh)
      const dx = p[0] - target[0]
      const dy = p[1] - target[1]
      return Math.sqrt(dx * dx + dy * dy)
    }
    // at arrival the receiver is ON the ball (pull reaches 1.0 — no more
    // "almost met it" gaps deep in the attacking zone); well before, they weren't
    expect(dist(tArrive)).toBeLessThan(5)
    expect(dist(tBefore)).toBeGreaterThan(dist(tArrive))
  })

  it('the defence reacts: closes down and collapses goal-side on a box attack', () => {
    const m = mk('players:defence')
    const plan = buildRenderPlan(m)
    const seed = m.renderSeed >>> 0
    // a home shot attacks the TOP goal, which AWAY defends
    const shot = plan.segs.find((x) => x.kind === 'shot' && x.team === 'home')
    expect(shot).toBeDefined()
    if (!shot) return
    const t = shot.t0
    const b = ballStateAt(plan, t)
    const sh = teamShiftAt(plan, t)
    let minD = Infinity
    let baseMinD = Infinity
    let backLineY = 0
    let baseBackLineY = 0
    for (let slot = 1; slot < SLOTS.length; slot++) {
      const p = playerPosAt(plan, seed, 'away', slot, t, b, sh)
      const dx = p[0] - b.x
      const dy = p[1] - b.y
      minD = Math.min(minD, Math.sqrt(dx * dx + dy * dy))
      const base = SLOTS[slot]
      const basePx = PITCH.x + base[0] * PITCH.w
      const basePy = PITCH.y + (1 - base[1]) * PITCH.h // away side is mirrored
      const bdx = basePx - b.x
      const bdy = basePy - b.y
      baseMinD = Math.min(baseMinD, Math.sqrt(bdx * bdx + bdy * bdy))
      if (slot <= 4) {
        backLineY += p[1] / 4
        baseBackLineY += basePy / 4
      }
    }
    // somebody stepped to the ball — meaningfully closer than any static slot
    expect(minD).toBeLessThan(baseMinD * 0.75)
    // and the back line dropped toward its own (top) goal to protect the box
    expect(backLineY).toBeLessThan(baseBackLineY - 40)
  })

  it('the defending gate is cliff-free: no boolean pop at possession flips', () => {
    // fuzz-found regression: a boolean defending flag teleported the back line
    // at every turnover/goal boundary; the smoothed gate must ramp, never jump
    for (let s = 0; s < 5; s++) {
      const plan = buildRenderPlan(mk(`gate:${s}`))
      let prev = teamShiftAt(plan, plan.playStart)
      for (let t = plan.playStart; t <= plan.playEnd; t += 1 / FPS) {
        const sh = teamShiftAt(plan, t)
        expect(Math.abs(sh.defendHome - prev.defendHome)).toBeLessThan(0.08)
        expect(Math.abs(sh.defendAway - prev.defendAway)).toBeLessThan(0.08)
        prev = sh
      }
    }
  })

  it('is a pure function of (plan, t): repeated calls agree exactly', () => {
    const m = mk('purity')
    const plan = buildRenderPlan(m)
    const seed = m.renderSeed >>> 0
    for (const t of [3.1, 9.7, 18.4, 27.9]) {
      const a = ballStateAt(plan, t)
      const b = ballStateAt(plan, t)
      expect(a.x).toBe(b.x)
      expect(a.y).toBe(b.y)
      const sh = teamShiftAt(plan, t)
      const p1 = playerPosAt(plan, seed, 'home', 5, t, a, sh)
      const p2 = playerPosAt(plan, seed, 'home', 5, t, b, sh)
      expect(p1).toEqual(p2)
    }
  })
})
