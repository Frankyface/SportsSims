import { describe, it, expect } from 'vitest'
import { selectNextSoccerSeason, selectNextGolfSeason } from './seasonQuality'
import { winnerOf, seasonComplete } from './league'
import { golfRankings, golfSeasonComplete } from './golfSeason'
import {
  reconstructSoccerSeason,
  reconstructGolfSeason,
  playSoccerSeasonToEnd,
  playGolfSeasonToEnd,
  SOCCER_SEED,
  GOLF_SEED,
} from '../headless/seasonReconstruct'
import { advanceSeasonWithSeed } from './league'
import { advanceGolfSeasonWithSeed } from './golfSeason'

const finishedSoccer = (season: number, rolls: string[]) => playSoccerSeasonToEnd(reconstructSoccerSeason(season, rolls))
const finishedGolf = (season: number, rolls: string[]) => playGolfSeasonToEnd(reconstructGolfSeason(season, rolls))

describe('selector — soccer', () => {
  it('is deterministic and returns a well-formed pick', () => {
    const a = selectNextSoccerSeason(finishedSoccer(1, []), 2)
    const b = selectNextSoccerSeason(finishedSoccer(1, []), 2)
    expect(a).toEqual(b)
    expect(a.roll.startsWith(`${SOCCER_SEED}:s2:roll`)).toBe(true)
    expect(a.score).toBeGreaterThanOrEqual(0)
    expect(a.score).toBeLessThanOrEqual(1)
    expect(a.hooks.length).toBeGreaterThan(0)
  })

  it('the chosen roll reconstructs the exact chosen season', () => {
    const s1 = finishedSoccer(1, [])
    const pick = selectNextSoccerSeason(s1, 2)
    const viaSelector = playSoccerSeasonToEnd(advanceSeasonWithSeed(s1, pick.roll))
    const viaReconstruct = playSoccerSeasonToEnd(reconstructSoccerSeason(2, [pick.roll]))
    expect(seasonComplete(viaReconstruct)).toBe(true)
    expect(winnerOf(viaReconstruct, 'final')).toBe(winnerOf(viaSelector, 'final'))
  })
})

describe('selector — golf', () => {
  it('is deterministic and returns a reconstructable pick', () => {
    const g1 = finishedGolf(1, [])
    const pick = selectNextGolfSeason(g1, 2)
    expect(pick.roll).toMatch(new RegExp(`^${GOLF_SEED}:s2:roll\\d+$`))
    const via = playGolfSeasonToEnd(reconstructGolfSeason(2, [pick.roll]))
    expect(golfSeasonComplete(via)).toBe(true)
    expect(golfRankings(via)[0].golferId).toBe(golfRankings(playGolfSeasonToEnd(advanceGolfSeasonWithSeed(g1, pick.roll)))[0].golferId)
  })
})

describe('variety + rare upsets over a chain of seasons', () => {
  it('rolls 8 seasons; archetypes vary and underdog stays uncommon', () => {
    const archetypes: string[] = []
    const rolls: string[] = []
    for (let season = 2; season <= 9; season++) {
      const prior = finishedSoccer(season - 1, rolls)
      const pick = selectNextSoccerSeason(prior, season)
      archetypes.push(pick.archetype)
      rolls.push(pick.roll)
    }
    // the target archetype should not be identical every single season
    expect(new Set(archetypes).size).toBeGreaterThan(1)
    // underdog is the rarest target (weight 1 of 13) — should be a small minority
    const underdogs = archetypes.filter((a) => a === 'underdog').length
    expect(underdogs).toBeLessThanOrEqual(2)
  })
})
