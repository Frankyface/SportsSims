import { describe, it, expect } from 'vitest'
import { reconstructGolfSeason, reconstructSoccerSeason, orderedRegularFixtures } from './seasonReconstruct'
import { playNextGolfRound, golfSeasonComplete } from '../league/golfSeason'
import { buildGolfGroupPlan } from '../render/golfDirector'
import { playFixture, fixtureMatch, startPlayoffs, advancePlayoffs } from '../league/league'
import { buildRenderModel } from '../render/renderMatch'

/**
 * REELS-CAP GUARD — Instagram's content publishing API hard-rejects reels over
 * 90 seconds (container status ERROR after IN_PROGRESS; discovered 2026-07-20
 * when EVERY golf reel of the daily cadence, at 92.4s, failed while soccer's
 * ~65s reels published). finalize-reels.mjs appends a leaderboard end-card
 * (golf 5s, soccer 2.5s), so the PLAN duration must leave that much headroom.
 *
 * This walks the LIVE cadence seeds through season 1 and asserts every reel
 * the newsroom will actually post fits under the cap with margin.
 */
const REEL_CAP = 90
const MARGIN = 0.5
const GOLF_END_CARD = 5 // finalize-reels.mjs BOARD_SEC_BY_ACCOUNT.golf
const SOCCER_END_CARD = 2.5 // finalize-reels.mjs BOARD_SEC_BY_ACCOUNT.soccer

describe('daily-cadence reel durations (IG 90s cap)', () => {
  it('every season-1 GOLF reel (plan + 5s end-card) fits the cap', () => {
    let s = reconstructGolfSeason(1, [])
    let worst = 0
    while (!golfSeasonComplete(s)) {
      const out = playNextGolfRound(s)
      for (const group of [0, 1] as const) {
        const total = buildGolfGroupPlan(out.result, group).total + GOLF_END_CARD
        worst = Math.max(worst, total)
        expect(total).toBeLessThanOrEqual(REEL_CAP - MARGIN)
      }
      s = out.state
    }
    expect(worst).toBeGreaterThan(0) // the loop genuinely ran
  })

  it('every season-1 SOCCER reel (plan + 2.5s end-card) fits the cap', () => {
    let s = reconstructSoccerSeason(1, [])
    const check = (state: typeof s, id: string): void => {
      const total = buildRenderModel(fixtureMatch(state, id)).plan.total + SOCCER_END_CARD
      expect(total).toBeLessThanOrEqual(REEL_CAP - MARGIN)
    }
    for (const f of orderedRegularFixtures(s)) {
      s = playFixture(s, f.id)
      check(s, f.id)
    }
    s = startPlayoffs(s)
    for (const id of ['sf1', 'sf2']) {
      s = playFixture(s, id)
      check(s, id)
    }
    s = advancePlayoffs(s)
    s = playFixture(s, 'final')
    check(s, 'final')
  })
})
