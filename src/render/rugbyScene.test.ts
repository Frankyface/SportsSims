import { describe, expect, it } from 'vitest'
import { RUGBY_SLOTS } from '../sim/rugbyFormation'
import { simulateRugbyMatch } from '../sim/rugbySim'
import type { RugbyMatchResult } from '../sim/rugbyTypes'
import type { TeamRating } from '../sim/types'
import { buildRugbyRenderPlan } from './rugbyDirector'
import {
  RUGBY_PITCH,
  rugbyBallStateAt,
  rugbyPlayerPosAt,
  rugbyTeamShiftAt,
  rugbyToPx,
} from './rugbyScene'

const FPS = 30

function team(id: string, overrides: Partial<TeamRating> = {}): TeamRating {
  return {
    id,
    name: id,
    abbr: id.slice(0, 3).toUpperCase(),
    city: id,
    color: '#ffffff',
    colorAlt: '#000000',
    attack: 1,
    defense: 1,
    finishing: 1,
    discipline: 1,
    formSpread: 0.15,
    ...overrides,
  }
}

function match(seedKey: string): RugbyMatchResult {
  return simulateRugbyMatch({
    seedKey,
    home: team('Carrick', { attack: 1.05 }),
    away: team('Kanbar', { attack: 0.98 }),
    homeAdvantage: 1.1,
  })
}

describe('rugby scene — ball motion quality (the anti-jank gate)', () => {
  it('the ball never teleports: frame-to-frame displacement < 160px @30fps', () => {
    for (let s = 0; s < 10; s++) {
      const m = match(`rscene:${s}`)
      const plan = buildRugbyRenderPlan(m)
      let worst = 0
      let prev = rugbyBallStateAt(plan, plan.playStart)
      for (let t = plan.playStart + 1 / FPS; t <= plan.playEnd; t += 1 / FPS) {
        const b = rugbyBallStateAt(plan, t)
        const d = Math.hypot(b.x - prev.x, b.y - prev.y)
        if (d > worst) worst = d
        prev = b
      }
      expect(worst).toBeLessThan(160)
    }
  })

  it('high-scoring stress seeds stay under the teleport gate too', () => {
    const goalfest = (seed: string): RugbyMatchResult =>
      simulateRugbyMatch({
        seedKey: seed,
        home: team('HOM', { attack: 1.25, finishing: 1.15 }),
        away: team('AWY', { defense: 0.8 }),
        homeAdvantage: 1.1,
      })
    for (const seed of ['rstress:fest:3', 'rstress:fest:17', 'rstress:fest:41']) {
      const plan = buildRugbyRenderPlan(goalfest(seed))
      let prev = rugbyBallStateAt(plan, plan.playStart)
      for (let t = plan.playStart + 1 / FPS; t <= plan.playEnd; t += 1 / FPS) {
        const b = rugbyBallStateAt(plan, t)
        expect(Math.hypot(b.x - prev.x, b.y - prev.y)).toBeLessThan(160)
        prev = b
      }
    }
  })

  it('the ball keeps moving (rucks and tee setups are the only stillness)', () => {
    const plan = buildRugbyRenderPlan(match('rlive:0'))
    let moving = 0
    let frames = 0
    let prev = rugbyBallStateAt(plan, plan.playStart)
    for (let t = plan.playStart + 1 / FPS; t <= plan.playEnd; t += 1 / FPS) {
      const b = rugbyBallStateAt(plan, t)
      const d2 = (b.x - prev.x) * (b.x - prev.x) + (b.y - prev.y) * (b.y - prev.y)
      if (d2 > 1) moving++
      frames++
      prev = b
    }
    console.log('[rugby liveliness]', { moving: moving / frames })
    expect(moving / frames).toBeGreaterThan(0.45)
  })

  it('the ball stays inside the frame (in-goal overshoot allowed, never off-canvas)', () => {
    for (let s = 0; s < 10; s++) {
      const plan = buildRugbyRenderPlan(match(`rbounds:${s}`))
      for (let t = plan.playStart; t <= plan.playEnd; t += 1 / FPS) {
        const b = rugbyBallStateAt(plan, t)
        expect(b.x).toBeGreaterThan(RUGBY_PITCH.x - 60)
        expect(b.x).toBeLessThan(RUGBY_PITCH.x + RUGBY_PITCH.w + 60)
        expect(b.y).toBeGreaterThan(RUGBY_PITCH.y - 60)
        expect(b.y).toBeLessThan(RUGBY_PITCH.y + RUGBY_PITCH.h + 60)
      }
    }
  })
})

describe('rugby scene — player motion', () => {
  it('players are never statues: the XV genuinely moves', () => {
    const m = match('rmove:0')
    const plan = buildRugbyRenderPlan(m)
    const seed = m.renderSeed >>> 0
    const t0 = plan.playStart + 0.3 * (plan.playEnd - plan.playStart)
    const t1 = t0 + 2.5
    let total = 0
    for (const side of ['home', 'away'] as const) {
      for (let slot = 0; slot < RUGBY_SLOTS.length; slot++) {
        const b0 = rugbyBallStateAt(plan, t0)
        const s0 = rugbyTeamShiftAt(plan, t0)
        const b1 = rugbyBallStateAt(plan, t1)
        const s1 = rugbyTeamShiftAt(plan, t1)
        const [x0, y0] = rugbyPlayerPosAt(plan, seed, side, slot, t0, b0, s0)
        const [x1, y1] = rugbyPlayerPosAt(plan, seed, side, slot, t1, b1, s1)
        total += Math.hypot(x1 - x0, y1 - y0)
      }
    }
    expect(total).toBeGreaterThan(400)
  })

  it('receivers and catchers arrive EXACTLY on the ball at arrival', () => {
    const m = match('rrecv:0')
    const plan = buildRugbyRenderPlan(m)
    const seed = m.renderSeed >>> 0
    let checked = 0
    for (const seg of plan.segs) {
      // rugby passes are short and quick; kicks are the long traversals —
      // both end with a named player meeting the ball
      if ((seg.kind !== 'pass' && seg.kind !== 'kick') || seg.slot < 0) continue
      if (seg.t1 - seg.t0 < 0.22) continue
      const manhattan =
        Math.abs(seg.to[0] - seg.from[0]) + Math.abs(seg.to[1] - seg.from[1])
      if (manhattan < 0.12) continue
      const [tx, ty] = rugbyToPx(seg.to)
      const ball = rugbyBallStateAt(plan, seg.t1)
      const shift = rugbyTeamShiftAt(plan, seg.t1)
      const [px, py] = rugbyPlayerPosAt(plan, seed, seg.team, seg.slot, seg.t1, ball, shift)
      expect(Math.hypot(px - tx, py - ty)).toBeLessThan(5)
      checked++
      if (checked >= 12) break
    }
    expect(checked).toBeGreaterThan(3)
  })

  it('the defence reacts: when home attacks deep, away bodies close on the ball', () => {
    const m = match('rdef:0')
    const plan = buildRugbyRenderPlan(m)
    const seed = m.renderSeed >>> 0
    // find a home grounding (deep attack into the top in-goal)
    const g = plan.segs.find((s) => s.kind === 'grounding' && s.team === 'home')
    if (!g) return // no home try this seed — other seeds cover it
    const t = g.t0
    const ball = rugbyBallStateAt(plan, t)
    const shift = rugbyTeamShiftAt(plan, t)
    let minD = Infinity
    for (let slot = 1; slot < RUGBY_SLOTS.length; slot++) {
      const [px, py] = rugbyPlayerPosAt(plan, seed, 'away', slot, t, ball, shift)
      minD = Math.min(minD, Math.hypot(px - ball.x, py - ball.y))
    }
    expect(minD).toBeLessThan(360)
  })

  it('pure functions: repeated calls are exactly equal', () => {
    const m = match('rpure:0')
    const plan = buildRugbyRenderPlan(m)
    const seed = m.renderSeed >>> 0
    const t = plan.playStart + 5
    const b1 = rugbyBallStateAt(plan, t)
    const b2 = rugbyBallStateAt(plan, t)
    expect(b1.x).toBe(b2.x)
    expect(b1.y).toBe(b2.y)
    const s1 = rugbyTeamShiftAt(plan, t)
    const s2 = rugbyTeamShiftAt(plan, t)
    expect(s1).toEqual(s2)
    const p1 = rugbyPlayerPosAt(plan, seed, 'home', 3, t, b1, s1)
    const p2 = rugbyPlayerPosAt(plan, seed, 'home', 3, t, b1, s1)
    expect(p1).toEqual(p2)
  })

  it('ONSIDE LAW: while a kick is in flight, the kicking team stays behind the kicker', () => {
    const m = match('ronside:0')
    const plan = buildRugbyRenderPlan(m)
    const seed = m.renderSeed >>> 0
    let checked = 0
    for (let i = 1; i < plan.segs.length; i++) {
      const seg = plan.segs[i]
      if (seg.kind !== 'kick' || seg.t1 - seg.t0 < 0.4) continue
      const kickerTeam = plan.segs[i - 1].team
      const t = seg.t0 + (seg.t1 - seg.t0) * 0.92 // late in the flight
      const ball = rugbyBallStateAt(plan, t)
      const shift = rugbyTeamShiftAt(plan, t)
      const [, originPy] = rugbyToPx([seg.from[0], seg.from[1]])
      for (let slot = 1; slot < RUGBY_SLOTS.length; slot++) {
        if (kickerTeam === seg.team && slot === seg.slot) continue // the chaser may be ahead
        const [, py] = rugbyPlayerPosAt(plan, seed, kickerTeam, slot, t, ball, shift)
        if (kickerTeam === 'home') {
          // home attacks the top: being AHEAD of the kick = smaller y
          expect(py).toBeGreaterThan(originPy - 45)
        } else {
          expect(py).toBeLessThan(originPy + 45)
        }
      }
      checked++
      if (checked >= 10) break
    }
    expect(checked).toBeGreaterThan(3)
  })

  it('defending gates never cliff: per-frame change stays smooth', () => {
    const plan = buildRugbyRenderPlan(match('rgate:0'))
    let prev = rugbyTeamShiftAt(plan, plan.playStart)
    for (let t = plan.playStart + 1 / FPS; t <= plan.playEnd; t += 1 / FPS) {
      const s = rugbyTeamShiftAt(plan, t)
      expect(Math.abs(s.defendHome - prev.defendHome)).toBeLessThan(0.08)
      expect(Math.abs(s.defendAway - prev.defendAway)).toBeLessThan(0.08)
      prev = s
    }
  })

  it('RUGBY LAW: attacking support is never drawn goal-side of the ball in open play', () => {
    const m = match('ronside:atk')
    const plan = buildRugbyRenderPlan(m)
    const seed = m.renderSeed >>> 0
    let checked = 0
    for (const seg of plan.segs) {
      if (seg.kind !== 'carry') continue
      const fwd = seg.team === 'home' ? seg.from[1] - seg.to[1] : seg.to[1] - seg.from[1]
      if (fwd < 0.1) continue // only meaningful forward carries
      const t = (seg.t0 + seg.t1) / 2
      const ball = rugbyBallStateAt(plan, t)
      const shift = rugbyTeamShiftAt(plan, t)
      for (let slot = 1; slot < RUGBY_SLOTS.length; slot++) {
        if (slot === seg.slot) continue // the carrier is allowed level/ahead
        const [, py] = rugbyPlayerPosAt(plan, seed, seg.team, slot, t, ball, shift)
        // 30px << the old possession push (0.08 * fieldH ~= 102px)
        if (seg.team === 'home') expect(py).toBeGreaterThan(ball.y - 30)
        else expect(py).toBeLessThan(ball.y + 30)
      }
      if (++checked >= 8) break
    }
    expect(checked).toBeGreaterThan(3)
  })

  it('kick cover: one nominated defender drops behind the flat line as a sweeper', () => {
    const m = match('rsweep:0')
    const plan = buildRugbyRenderPlan(m)
    const seed = m.renderSeed >>> 0
    const sweeperSlot = 6 + (seed % 4)
    let checked = 0
    for (const seg of plan.segs) {
      if (seg.kind !== 'pass' && seg.kind !== 'carry') continue
      const t = (seg.t0 + seg.t1) / 2
      const ball = rugbyBallStateAt(plan, t)
      // evaluate only when the ball is around midfield, so the defending line
      // sits well off its own goal and the sweeper can visibly drop behind it
      const midLo = RUGBY_PITCH.y + RUGBY_PITCH.h * 0.35
      const midHi = RUGBY_PITCH.y + RUGBY_PITCH.h * 0.65
      if (ball.y < midLo || ball.y > midHi) continue
      const shift = rugbyTeamShiftAt(plan, t)
      const def: 'home' | 'away' = seg.team === 'home' ? 'away' : 'home'
      const gate = def === 'home' ? shift.defendHome : shift.defendAway
      if (gate < 0.3) continue
      const ys: number[] = []
      for (let s = 1; s < RUGBY_SLOTS.length; s++) {
        const [, py] = rugbyPlayerPosAt(plan, seed, def, s, t, ball, shift)
        ys.push(py)
      }
      const sweeperPy = ys[sweeperSlot - 1]
      const others = ys.filter((_, i) => i + 1 !== sweeperSlot)
      const lineMean = others.reduce((a, b) => a + b, 0) / others.length
      const [, ownGoalPy] = rugbyToPx([0.5, def === 'home' ? 1 : 0])
      // the sweeper sits clearly closer to its own goal than the rest of the line
      expect(Math.abs(sweeperPy - ownGoalPy)).toBeLessThan(Math.abs(lineMean - ownGoalPy) - 20)
      if (++checked >= 4) break
    }
    expect(checked).toBeGreaterThan(0)
  })
})
