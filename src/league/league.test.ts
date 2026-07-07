import { describe, it, expect } from 'vitest'
import {
  createLeague,
  computeStandings,
  regularComplete,
  startPlayoffs,
  advancePlayoffs,
  playRound,
  playFixture,
  seasonComplete,
  advanceSeason,
  winnerOf,
} from './league'
import type { LeagueState } from './types'

function playRegularSeason(state: LeagueState): LeagueState {
  const rounds = new Set(state.fixtures.filter((f) => f.stage === 'regular').map((f) => f.round))
  let s = state
  for (const r of [...rounds].sort((a, b) => a - b)) s = playRound(s, r)
  return s
}

function playFullSeason(state: LeagueState): LeagueState {
  let s = playRegularSeason(state)
  s = startPlayoffs(s)
  s = playFixture(s, 'sf1')
  s = playFixture(s, 'sf2')
  s = advancePlayoffs(s)
  s = playFixture(s, 'final')
  return s
}

describe('league — structure', () => {
  it('creates a 10-team double round-robin (90 matches, 18 rounds)', () => {
    const s = createLeague('L-struct', 'Test League', 10)
    const regular = s.fixtures.filter((f) => f.stage === 'regular')
    expect(s.teams).toHaveLength(10)
    expect(regular).toHaveLength(90)
    expect(new Set(regular.map((f) => f.round)).size).toBe(18)
    // each team plays 18 (9 home, 9 away)
    for (const t of s.teams) {
      const home = regular.filter((f) => f.home === t.identity.id).length
      const away = regular.filter((f) => f.away === t.identity.id).length
      expect(home).toBe(9)
      expect(away).toBe(9)
    }
  })
})

describe('league — standings integrity', () => {
  it('every team plays 18 and goals-for total equals goals-against total', () => {
    const s = playRegularSeason(createLeague('L-stand', 'Test', 10))
    expect(regularComplete(s)).toBe(true)
    const table = computeStandings(s)
    let gf = 0
    let ga = 0
    for (const row of table) {
      expect(row.played).toBe(18)
      expect(row.won + row.drawn + row.lost).toBe(18)
      expect(row.points).toBe(row.won * 3 + row.drawn)
      gf += row.gf
      ga += row.ga
    }
    expect(gf).toBe(ga) // every goal scored is a goal conceded somewhere
  })
})

describe('league — season lifecycle', () => {
  it('runs playoffs, crowns a champion, and rolls into the next season with evolved ratings', () => {
    const s0 = createLeague('L-life', 'Test', 10)
    const startRatings = new Map(s0.teams.map((t) => [t.identity.id, t.glicko.rating]))
    const done = playFullSeason(s0)
    expect(seasonComplete(done)).toBe(true)
    const champion = winnerOf(done, 'final')
    expect(done.teams.some((t) => t.identity.id === champion)).toBe(true)

    const s2 = advanceSeason(done)
    expect(s2.season).toBe(2)
    expect(s2.phase).toBe('regular')
    expect(s2.history).toHaveLength(1)
    expect(s2.history[0].championId).toBe(champion)
    expect(Object.keys(s2.results)).toHaveLength(0)
    expect(s2.fixtures.filter((f) => f.stage === 'regular')).toHaveLength(90)
    // at least some ratings changed after a season of results
    const changed = s2.teams.filter((t) => t.glicko.rating !== startRatings.get(t.identity.id))
    expect(changed.length).toBeGreaterThan(5)
  })

  it('is deterministic — same seed yields the same champion', () => {
    const a = winnerOf(playFullSeason(createLeague('same', 'A', 10)), 'final')
    const b = winnerOf(playFullSeason(createLeague('same', 'B', 10)), 'final')
    expect(a).toBe(b)
  })
})
