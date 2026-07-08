import { describe, expect, it } from 'vitest'
import {
  advanceRugbyPlayoffs,
  advanceRugbySeason,
  computeRugbyStandings,
  createRugbyLeague,
  playRugbyFixture,
  playRugbyRound,
  rugbyFixtureMatch,
  rugbySeasonComplete,
  startRugbyPlayoffs,
  type RugbyLeagueState,
  type RugbyMatchScore,
} from './rugbyLeague'

function fullSeason(state: RugbyLeagueState): RugbyLeagueState {
  let s = state
  const rounds = [...new Set(s.fixtures.filter((f) => f.stage === 'regular').map((f) => f.round))]
  for (const r of rounds) s = playRugbyRound(s, r)
  s = startRugbyPlayoffs(s)
  s = playRugbyFixture(s, 'sf1')
  s = playRugbyFixture(s, 'sf2')
  s = advanceRugbyPlayoffs(s)
  s = playRugbyFixture(s, 'final')
  return s
}

describe('rugby league — season spine', () => {
  it('creates 6 clubs and a double round-robin', () => {
    const s = createRugbyLeague('rl-test-1', 'Bastion Championships')
    expect(s.teams).toHaveLength(6)
    expect(s.fixtures.filter((f) => f.stage === 'regular')).toHaveLength(30)
    expect(s.phase).toBe('regular')
  })

  it('is deterministic: the same seed replays the identical season', () => {
    const a = fullSeason(createRugbyLeague('rl-det', 'Bastion Championships'))
    const b = fullSeason(createRugbyLeague('rl-det', 'Bastion Championships'))
    expect(JSON.stringify(a.results)).toBe(JSON.stringify(b.results))
    // and a played fixture re-sims to the exact same full match for video
    const f = a.fixtures.find((x) => x.stage === 'regular')!
    expect(JSON.stringify(rugbyFixtureMatch(a, f.id))).toBe(JSON.stringify(rugbyFixtureMatch(b, f.id)))
  })

  it('playFixture is idempotent', () => {
    let s = createRugbyLeague('rl-idem', 'Bastion Championships')
    const f = s.fixtures[0]
    s = playRugbyFixture(s, f.id)
    const once = s.results[f.id]
    s = playRugbyFixture(s, f.id)
    expect(s.results[f.id]).toBe(once)
  })

  it('runs playoffs and crowns a champion, then rolls the offseason', () => {
    let s = fullSeason(createRugbyLeague('rl-season', 'Bastion Championships'))
    expect(rugbySeasonComplete(s)).toBe(true)
    const ratingsBefore = s.teams.map((t) => t.glicko.rating)
    s = advanceRugbySeason(s)
    expect(s.season).toBe(2)
    expect(s.phase).toBe('regular')
    expect(Object.keys(s.results)).toHaveLength(0)
    expect(s.history).toHaveLength(1)
    expect(s.history[0].championId).toBeTruthy()
    const ratingsAfter = s.teams.map((t) => t.glicko.rating)
    expect(JSON.stringify(ratingsAfter)).not.toBe(JSON.stringify(ratingsBefore))
  })
})

describe('rugby league — union standings points', () => {
  // hand-built results against the first few fixtures of a known league
  function withResults(results: Record<string, RugbyMatchScore>): RugbyLeagueState {
    const s = createRugbyLeague('rl-points', 'Bastion Championships')
    return { ...s, results }
  }

  it('4 for a win, 2 each for a draw, bonus for 4+ tries and for losing within 7', () => {
    const s = createRugbyLeague('rl-points', 'Bastion Championships')
    const [f0, f1] = s.fixtures.filter((f) => f.round === 0)
    const state = withResults({
      // f0: home wins 33-29 with 4 tries; away loses within 7 with 3 tries
      [f0.id]: { home: 33, away: 29, homeTries: 4, awayTries: 3 },
      // f1: 20-20 draw, away bags a 4-try bonus
      [f1.id]: { home: 20, away: 20, homeTries: 2, awayTries: 4 },
    })
    const rows = computeRugbyStandings(state)
    const row = (id: string) => rows.find((r) => r.teamId === id)!

    expect(row(f0.home).points).toBe(5) // 4 win + 1 try bonus
    expect(row(f0.home).bonus).toBe(1)
    expect(row(f0.away).points).toBe(1) // 0 + losing-within-7 bonus
    expect(row(f0.away).bonus).toBe(1)
    expect(row(f1.home).points).toBe(2) // draw
    expect(row(f1.away).points).toBe(3) // draw + try bonus
    expect(row(f1.away).bonus).toBe(1)
  })

  it('ranks by points, then points difference, then points for', () => {
    const s = fullSeason(createRugbyLeague('rl-rank', 'Bastion Championships'))
    const rows = computeRugbyStandings(s)
    for (let i = 1; i < rows.length; i++) {
      const a = rows[i - 1]
      const b = rows[i]
      const ordered =
        a.points > b.points ||
        (a.points === b.points && a.pd > b.pd) ||
        (a.points === b.points && a.pd === b.pd && a.pf >= b.pf)
      expect(ordered).toBe(true)
    }
    // every team plays 10 regular-season games
    for (const r of rows) expect(r.played).toBe(10)
  })
})
