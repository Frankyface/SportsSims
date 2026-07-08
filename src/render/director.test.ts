import { describe, it, expect } from 'vitest'
import { simulateMatch } from '../sim/simulateMatch'
import type { MatchConfig, MatchResult, TeamRating } from '../sim/types'
import { buildRenderPlan, clockSecAt, momentAlpha, pickActiveMoment, scoreAt } from './director'

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

describe('director — the clock counts up, continuously', () => {
  it('clock is monotonic from 0 to full-time when sampled at 30fps', () => {
    for (let s = 0; s < 12; s++) {
      const m = mk(`dir:${s}`)
      const plan = buildRenderPlan(m)
      let prev = -1
      for (let t = 0; t <= plan.total + 0.001; t += 1 / 30) {
        const sec = clockSecAt(plan, t)
        expect(sec).toBeGreaterThanOrEqual(prev)
        prev = sec
      }
      expect(clockSecAt(plan, 0)).toBe(0)
      expect(clockSecAt(plan, plan.playEnd)).toBeGreaterThanOrEqual(90 * 60)
    }
  })

  it('ball segments tile the play window with no render-time gaps', () => {
    for (let s = 0; s < 12; s++) {
      const plan = buildRenderPlan(mk(`dir:${s}`))
      expect(plan.segs.length).toBeGreaterThan(10)
      expect(plan.segs[0].t0).toBeCloseTo(plan.playStart, 6)
      for (let i = 1; i < plan.segs.length; i++) {
        expect(plan.segs[i].t0).toBeCloseTo(plan.segs[i - 1].t1, 6)
      }
      expect(plan.segs[plan.segs.length - 1].t1).toBeCloseTo(plan.playEnd, 6)
    }
  })

  it('total runtime stays inside the square-race band across many matches', () => {
    let min = Infinity
    let max = 0
    for (let s = 0; s < 200; s++) {
      const plan = buildRenderPlan(mk(`band:${s}`))
      min = Math.min(min, plan.total)
      max = Math.max(max, plan.total)
    }
    // intro 2.6 + play 48..62 + whistle beat 0.7 + result 3.4 (IG Reels cap: 90s)
    expect(min).toBeGreaterThanOrEqual(53)
    expect(max).toBeLessThanOrEqual(70)
  })

  it('storyline captions: at most 4, in-window, filled labels, goal always outranks', () => {
    let total = 0
    for (let s = 0; s < 60; s++) {
      const plan = buildRenderPlan(mk(`story:${s}`))
      const stories = plan.moments.filter((x) => x.kind === 'story')
      total += stories.length
      expect(stories.length).toBeLessThanOrEqual(4)
      for (const st of stories) {
        expect(st.t).toBeGreaterThanOrEqual(plan.playStart)
        expect(st.t).toBeLessThanOrEqual(plan.playEnd)
        expect(st.label.length).toBeGreaterThan(0)
        expect(st.label.length).toBeLessThanOrEqual(30)
        expect(st.label).not.toContain('{ABBR}')
        // a story caption never beats a goal that is showing at the same time
        const goalOver = plan.moments.find(
          (g) => g.kind === 'goal' && st.t >= g.t && st.t <= g.t + g.dur,
        )
        if (goalOver) {
          expect(pickActiveMoment(plan, st.t + 0.05)?.kind).toBe('goal')
        }
      }
    }
    // across many matches the commentator does speak sometimes
    expect(total).toBeGreaterThan(10)
  })

  it('story captions never contradict the scorebug (fuzz-found regressions)', () => {
    // HIGH findings: 'ONE GOAL IN IT' after an equaliser made it level, and
    // 'ALL SQUARE' after a next-minute go-ahead goal (minute-quantised
    // deadline off-by-one). Premises must hold for the caption's whole window.
    for (let s = 0; s < 150; s++) {
      const plan = buildRenderPlan(mk(`probe:${s}`))
      for (const st of plan.moments) {
        if (st.kind !== 'story') continue
        for (let t = st.t; t <= st.t + st.dur; t += 0.1) {
          const sc = scoreAt(plan, t)
          const diff = Math.abs(sc[0] - sc[1])
          if (/ONE GOAL IN IT/.test(st.label)) {
            expect(diff, `"${st.label}" at diff ${diff}`).toBe(1)
          }
          if (/ALL SQUARE|BACK LEVEL|BACK FROM THE DEAD|REFUSE TO GO AWAY/.test(st.label)) {
            expect(diff, `"${st.label}" at diff ${diff}`).toBe(0)
          }
        }
      }
    }
  })

  it('goal labels react to context (equalisers, openers, late winners)', () => {
    const KNOWN = [
      /WIN IT LATE$/,
      /LEVEL IT$/,
      /STRIKE FIRST$/,
      /IN FRONT$/,
      /RUNNING RIOT$/,
      /STRIKE AGAIN$/,
      /^A CONSOLATION FOR /,
      /PULL ONE BACK$/,
      /^GOAL — /,
    ]
    let openers = 0
    let contextual = 0
    for (let s = 0; s < 40; s++) {
      const m = mk(`glabel:${s}`)
      const plan = buildRenderPlan(m)
      const goalMoments = plan.moments.filter((x) => x.kind === 'goal')
      goalMoments.forEach((g, i) => {
        expect(KNOWN.some((re) => re.test(g.label)), `unknown label: ${g.label}`).toBe(true)
        expect(g.label.length).toBeLessThanOrEqual(30)
        if (i === 0 && /STRIKE FIRST$/.test(g.label)) openers++
        if (!/^GOAL — /.test(g.label)) contextual++
      })
    }
    expect(openers).toBeGreaterThan(10) // first goals read as openers
    expect(contextual).toBeGreaterThan(20) // the voice is doing real work
  })

  it('the scorebug score steps exactly on goals and lands on the final score', () => {
    for (let s = 0; s < 20; s++) {
      const m = mk(`score:${s}`)
      const plan = buildRenderPlan(m)
      expect(plan.scorePts.length).toBe(1 + m.score[0] + m.score[1])
      expect(scoreAt(plan, 0)).toEqual([0, 0])
      expect(scoreAt(plan, plan.total)).toEqual(m.score)
      // never decreases
      let prev: [number, number] = [0, 0]
      for (const pt of plan.scorePts) {
        expect(pt.score[0]).toBeGreaterThanOrEqual(prev[0])
        expect(pt.score[1]).toBeGreaterThanOrEqual(prev[1])
        prev = pt.score
      }
    }
  })

  it('emits the broadcast moments: kickoff, one half-time, goals, full-time', () => {
    for (let s = 0; s < 12; s++) {
      const m = mk(`mom:${s}`)
      const plan = buildRenderPlan(m)
      const kinds = plan.moments.map((x) => x.kind)
      expect(kinds.filter((k) => k === 'kickoff').length).toBe(1)
      expect(kinds.filter((k) => k === 'halftime').length).toBe(1)
      expect(kinds.filter((k) => k === 'fulltime').length).toBe(1)
      expect(kinds.filter((k) => k === 'goal').length).toBe(m.score[0] + m.score[1])
      // moments are timed inside the plan
      for (const mo of plan.moments) {
        expect(mo.t).toBeGreaterThanOrEqual(0)
        expect(mo.t).toBeLessThanOrEqual(plan.total)
      }
      // half-time fires while the clock reads ~45'
      const ht = plan.moments.find((x) => x.kind === 'halftime')
      if (ht) {
        const minAtHt = Math.floor(clockSecAt(plan, ht.t) / 60)
        expect(Math.abs(minAtHt - 45)).toBeLessThanOrEqual(1)
      }
    }
  })

  it('maps send-offs to the render clock and labels corners', () => {
    let sendOffs = 0
    let corners = 0
    for (let s = 0; s < 60; s++) {
      const m = mk(`rules:${s}`)
      const plan = buildRenderPlan(m)
      const reds = m.events.filter((e) => e.type === 'red').length
      expect(plan.sendOffs.length).toBe(reds)
      for (const so of plan.sendOffs) {
        sendOffs++
        expect(so.t).toBeGreaterThanOrEqual(plan.playStart)
        expect(so.t).toBeLessThanOrEqual(plan.playEnd)
      }
      for (const mo of plan.moments) {
        if (mo.kind === 'corner') {
          corners++
          expect(mo.label).toMatch(/^CORNER — /)
        }
      }
    }
    expect(sendOffs).toBeGreaterThan(3)
    expect(corners).toBeGreaterThan(10)
  })

  it('is deterministic: same match -> identical plan', () => {
    const m = mk('dir:same')
    expect(JSON.stringify(buildRenderPlan(m))).toEqual(JSON.stringify(buildRenderPlan(m)))
  })

  it('never stacks overlays: one lower third at a time, drama outranks half-time', () => {
    // moment windows MAY overlap on the timeline (goal celebrations run into the
    // half-time crossing in >half of matches); the picker must resolve them
    for (let s = 0; s < 60; s++) {
      const m = mk(`overlay:${s}`)
      const plan = buildRenderPlan(m)
      // a goal always wins its own window, even mid-overlap
      for (const mo of plan.moments) {
        if (mo.kind !== 'goal') continue
        for (const f of [0.1, 0.5, 0.9]) {
          const picked = pickActiveMoment(plan, mo.t + mo.dur * f)
          expect(picked?.kind).toBe('goal')
        }
      }
      // sampled sweep: the picker returns a renderable, actually-VISIBLE moment
      // or null — an already-faded banner never blocks a visible one
      for (let t = 0; t <= plan.total; t += 0.25) {
        const picked = pickActiveMoment(plan, t)
        if (picked) {
          expect(picked.kind).not.toBe('kickoff')
          expect(picked.kind).not.toBe('fulltime')
          expect(t).toBeGreaterThanOrEqual(picked.t)
          expect(t).toBeLessThanOrEqual(picked.t + picked.dur)
          expect(momentAlpha(picked, t)).toBeGreaterThanOrEqual(0.15)
        }
      }
    }
  })
})
