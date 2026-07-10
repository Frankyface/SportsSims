import { describe, it, expect } from 'vitest'
import {
  reconstructSoccerSeason,
  reconstructGolfSeason,
  playSoccerSeasonToEnd,
  playGolfSeasonToEnd,
  SOCCER_SEED,
  GOLF_SEED,
  SOCCER_ID,
  GOLF_ID,
} from './seasonReconstruct'
import { createLeague, winnerOf, seasonComplete } from '../league/league'
import { createGolfSeason, golfRankings, golfSeasonComplete } from '../league/golfSeason'
// (winnerOf/golfRankings also used by the GOLDEN chain test below)

describe('season reconstruction — season 1 is unchanged', () => {
  it('soccer S1 reconstruct === createLeague (no rolls consumed)', () => {
    const a = reconstructSoccerSeason(1, [])
    const b = createLeague(SOCCER_SEED, 'Crown League', 6, SOCCER_ID)
    expect(JSON.stringify(a)).toBe(JSON.stringify(b))
    expect(a.resultSeed).toBeUndefined() // falls back to default -> byte-identical
  })
  it('golf S1 reconstruct === createGolfSeason', () => {
    const a = reconstructGolfSeason(1, [])
    const b = createGolfSeason(GOLF_SEED, 'SGA Tour', GOLF_ID)
    expect(JSON.stringify(a)).toBe(JSON.stringify(b))
  })
})

describe('season reconstruction — deterministic & re-rollable', () => {
  it('soccer S2 is deterministic for the same roll', () => {
    const a = reconstructSoccerSeason(2, ['crown-alpha:s2:roll7'])
    const b = reconstructSoccerSeason(2, ['crown-alpha:s2:roll7'])
    expect(JSON.stringify(a)).toBe(JSON.stringify(b))
    expect(a.season).toBe(2)
    expect(a.resultSeed).toBe('crown-alpha:s2:roll7')
  })

  it('different soccer rolls produce different S2 champions/results (the re-roll works)', () => {
    const champs = new Set<string>()
    for (let c = 0; c < 12; c++) {
      const roll = c === 0 ? undefined : `crown-alpha:s2:roll${c}`
      let s = reconstructSoccerSeason(2, roll ? [roll] : [])
      s = playSoccerSeasonToEnd(s)
      expect(seasonComplete(s)).toBe(true)
      champs.add(winnerOf(s, 'final'))
    }
    // Re-rolling results on the same carried ratings must surface variety.
    expect(champs.size).toBeGreaterThan(1)
  })

  it('golf S2 is deterministic and re-rollable', () => {
    const a = reconstructGolfSeason(2, ['sga-mrdklysr-2qbfer:s2:roll3'])
    const b = reconstructGolfSeason(2, ['sga-mrdklysr-2qbfer:s2:roll3'])
    expect(JSON.stringify(a)).toBe(JSON.stringify(b))
    expect(a.season).toBe(2)

    const champs = new Set<string>()
    for (let c = 0; c < 12; c++) {
      const roll = c === 0 ? undefined : `sga-mrdklysr-2qbfer:s2:roll${c}`
      let s = reconstructGolfSeason(2, roll ? [roll] : [])
      s = playGolfSeasonToEnd(s)
      expect(golfSeasonComplete(s)).toBe(true)
      champs.add(golfRankings(s)[0].golferId)
    }
    expect(champs.size).toBeGreaterThan(1)
  })

  it('GOLDEN: the whole season-chain surface is frozen (fixtures/schedule/offseason/glicko/points/seeding)', () => {
    // Reconstruction replays ALL prior seasons through CURRENT code on every
    // generation, and content is NEVER stored — only the seed + rolls. If any
    // future change silently re-simulates a past season, the champion the cadence
    // reconstructs would no longer match what was already posted to Instagram.
    // This pins the champions of the roll0 chain so such drift fails CI loudly.
    const soc = (s: number) =>
      winnerOf(playSoccerSeasonToEnd(reconstructSoccerSeason(s, ['crown-alpha:s2:roll0', 'crown-alpha:s3:roll0'].slice(0, s - 1))), 'final')
    expect(soc(1)).toBe('MAR')
    expect(soc(2)).toBe('MDN') // topped by MAR (shield) but won the playoffs — a Cinderella
    expect(soc(3)).toBe('MDN')

    const golf = (s: number) =>
      golfRankings(playGolfSeasonToEnd(reconstructGolfSeason(s, ['sga-mrdklysr-2qbfer:s2:roll0', 'sga-mrdklysr-2qbfer:s3:roll0'].slice(0, s - 1))))[0].golferId
    expect(golf(1)).toBe('ACE')
    expect(golf(2)).toBe('STL')
    expect(golf(3)).toBe('DUV')
  })

  it('carried ratings are identical across different result rolls (only outcomes vary)', () => {
    // Ratings depend on the PRIOR season's finish, which itself depends on prior
    // rolls; but for S2 (rolls only affect S2's own results, not S1) the carried
    // ratings into S2 are the same regardless of the S2 roll chosen.
    const a = reconstructSoccerSeason(2, ['crown-alpha:s2:rollA'])
    const b = reconstructSoccerSeason(2, ['crown-alpha:s2:rollB'])
    const ra = a.teams.map((t) => `${t.identity.id}:${t.glicko.rating}`).join(',')
    const rb = b.teams.map((t) => `${t.identity.id}:${t.glicko.rating}`).join(',')
    expect(ra).toBe(rb)
  })
})
