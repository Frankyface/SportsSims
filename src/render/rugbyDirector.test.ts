import { describe, expect, it } from 'vitest'
import { simulateRugbyMatch } from '../sim/rugbySim'
import type { RugbyMatchResult } from '../sim/rugbyTypes'
import type { TeamRating } from '../sim/types'
import {
  buildRugbyRenderPlan,
  pickActiveRugbyMoment,
  rugbyClockSecAt,
  rugbyMomentAlpha,
  rugbyScoreAt,
} from './rugbyDirector'

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

const TRY_LABEL_PATTERNS = [
  /WIN IT LATE$/,
  /LEVEL IT$/,
  /STRIKE FIRST$/,
  /IN FRONT$/,
  /RUNNING RIOT$/,
  /STRIKE AGAIN$/,
  /^TRY — /,
  /^A CONSOLATION FOR /,
  /HIT BACK$/,
]

describe('rugby director — the clock counts up, continuously', () => {
  it('is deterministic', () => {
    const m = match('rdir:det')
    expect(JSON.stringify(buildRugbyRenderPlan(m))).toBe(JSON.stringify(buildRugbyRenderPlan(m)))
  })

  it('clock is monotonic from 0 to full-time when sampled at 30fps', () => {
    const plan = buildRugbyRenderPlan(match('rdir:clock'))
    expect(rugbyClockSecAt(plan, 0)).toBe(0)
    let prev = 0
    for (let t = 0; t <= plan.total; t += 1 / 30) {
      const sec = rugbyClockSecAt(plan, t)
      expect(sec).toBeGreaterThanOrEqual(prev)
      prev = sec
    }
    expect(rugbyClockSecAt(plan, plan.playEnd)).toBeGreaterThanOrEqual(80 * 60)
  })

  it('ball segments tile the play window', () => {
    const plan = buildRugbyRenderPlan(match('rdir:segs'))
    expect(plan.segs.length).toBeGreaterThan(10)
    expect(plan.segs[0].t0).toBeCloseTo(plan.playStart, 6)
    for (let i = 1; i < plan.segs.length; i++) {
      expect(plan.segs[i].t0).toBeCloseTo(plan.segs[i - 1].t1, 6)
    }
    expect(plan.segs[plan.segs.length - 1].t1).toBeCloseTo(plan.playEnd, 6)
  })

  it('every clip lands in the runtime band (slower rugby pace, IG Reels-safe)', () => {
    for (let s = 0; s < 200; s++) {
      const plan = buildRugbyRenderPlan(match(`rband:${s}`))
      expect(plan.total).toBeGreaterThanOrEqual(69) // v3: slower, locks the floor up
      expect(plan.total).toBeLessThanOrEqual(82)
    }
  })

  it('the scorebug steps exactly as points land and finishes on the final score', () => {
    for (let s = 0; s < 40; s++) {
      const m = match(`rscore:${s}`)
      const plan = buildRugbyRenderPlan(m)
      const scoringEvents =
        m.stats.tries[0] + m.stats.tries[1] +
        m.stats.conversions[0] + m.stats.conversions[1] +
        m.stats.penaltyGoals[0] + m.stats.penaltyGoals[1] +
        m.stats.dropGoals[0] + m.stats.dropGoals[1]
      expect(plan.scorePts.length).toBe(1 + scoringEvents)
      expect(rugbyScoreAt(plan, 0)).toEqual([0, 0])
      expect(rugbyScoreAt(plan, plan.total)).toEqual(m.score)
      for (let i = 1; i < plan.scorePts.length; i++) {
        expect(plan.scorePts[i].score[0]).toBeGreaterThanOrEqual(plan.scorePts[i - 1].score[0])
        expect(plan.scorePts[i].score[1]).toBeGreaterThanOrEqual(plan.scorePts[i - 1].score[1])
        expect(plan.scorePts[i].t).toBeGreaterThanOrEqual(plan.scorePts[i - 1].t)
      }
    }
  })

  it('broadcast moments: one kickoff, one half-time (at ~40\'), one full-time; tries all covered', () => {
    for (let s = 0; s < 25; s++) {
      const m = match(`rmom:${s}`)
      const plan = buildRugbyRenderPlan(m)
      expect(plan.moments.filter((x) => x.kind === 'kickoff')).toHaveLength(1)
      expect(plan.moments.filter((x) => x.kind === 'fulltime')).toHaveLength(1)
      const ht = plan.moments.filter((x) => x.kind === 'halftime')
      expect(ht).toHaveLength(1)
      expect(Math.abs(Math.floor(rugbyClockSecAt(plan, ht[0].t) / 60) - 40)).toBeLessThanOrEqual(1)
      const tries = plan.moments.filter((x) => x.kind === 'try')
      expect(tries.length).toBe(m.stats.tries[0] + m.stats.tries[1])
      for (const mo of plan.moments) {
        expect(mo.t).toBeGreaterThanOrEqual(0)
        expect(mo.t).toBeLessThanOrEqual(plan.total)
      }
    }
  })

  it('every try label speaks broadcast (whitelist + 30-char cap)', () => {
    let nonGeneric = 0
    for (let s = 0; s < 40; s++) {
      const plan = buildRugbyRenderPlan(match(`rlbl:${s}`))
      for (const mo of plan.moments) {
        if (mo.kind !== 'try') continue
        expect(mo.label.length).toBeGreaterThan(0)
        expect(mo.label.length).toBeLessThanOrEqual(30)
        expect(TRY_LABEL_PATTERNS.some((re) => re.test(mo.label))).toBe(true)
        if (!/^TRY — /.test(mo.label)) nonGeneric++
      }
    }
    expect(nonGeneric).toBeGreaterThan(20)
  })

  it('cards map to send-offs on the render clock; sin-bins come back', () => {
    let yellows = 0
    for (let s = 0; s < 40; s++) {
      const m = match(`rso:${s}`)
      const plan = buildRugbyRenderPlan(m)
      const cards = m.events.filter((e) => e.type === 'yellow' || e.type === 'red')
      expect(plan.sendOffs.length).toBe(cards.length)
      for (const so of plan.sendOffs) {
        expect(so.t).toBeGreaterThanOrEqual(plan.playStart)
        expect(so.t).toBeLessThanOrEqual(plan.playEnd)
        if (so.returnT !== undefined) {
          yellows++
          expect(so.returnT).toBeGreaterThan(so.t)
          expect(so.returnT).toBeLessThanOrEqual(plan.playEnd)
        }
      }
    }
    expect(yellows).toBeGreaterThan(5)
  })

  it('never stacks overlays: one lower third at a time, never a bookend', () => {
    for (let s = 0; s < 15; s++) {
      const plan = buildRugbyRenderPlan(match(`rover:${s}`))
      for (let t = 0; t <= plan.total; t += 0.25) {
        const picked = pickActiveRugbyMoment(plan, t)
        if (!picked) continue
        expect(picked.kind).not.toBe('kickoff')
        expect(picked.kind).not.toBe('fulltime')
        expect(t).toBeGreaterThanOrEqual(picked.t)
        expect(t).toBeLessThanOrEqual(picked.t + picked.dur)
        expect(rugbyMomentAlpha(picked, t)).toBeGreaterThanOrEqual(0.15)
      }
    }
  })

  it('story captions: few, short, filled-in, inside the play window', () => {
    let stories = 0
    for (let s = 0; s < 60; s++) {
      const plan = buildRugbyRenderPlan(match(`rstory:${s}`))
      const st = plan.moments.filter((x) => x.kind === 'story')
      expect(st.length).toBeLessThanOrEqual(4)
      stories += st.length
      for (const mo of st) {
        expect(mo.t).toBeGreaterThanOrEqual(plan.playStart)
        expect(mo.t).toBeLessThanOrEqual(plan.playEnd)
        expect(mo.label.length).toBeGreaterThan(0)
        expect(mo.label.length).toBeLessThanOrEqual(30)
        expect(mo.label.includes('{ABBR}')).toBe(false)
      }
    }
    expect(stories).toBeGreaterThan(5)
  })
})
