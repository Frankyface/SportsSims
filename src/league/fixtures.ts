import type { Fixture } from './types'

/**
 * Double round-robin schedule via the circle method: every team plays every
 * other twice (home & away). For n teams → 2*(n-1) rounds, n*(n-1) matches.
 */
export function generateFixtures(teamIds: string[]): Fixture[] {
  const ids = [...teamIds]
  if (ids.length % 2 !== 0) ids.push('BYE')
  const n = ids.length
  const rounds = n - 1
  const half = n / 2
  const arr = [...ids]
  const fixtures: Fixture[] = []
  let fid = 0

  for (let r = 0; r < rounds; r++) {
    for (let i = 0; i < half; i++) {
      const a = arr[i]
      const b = arr[n - 1 - i]
      if (a !== 'BYE' && b !== 'BYE') {
        const homeFirst = (r + i) % 2 === 0
        const home = homeFirst ? a : b
        const away = homeFirst ? b : a
        fixtures.push({ id: `f${fid++}`, round: r, stage: 'regular', home, away })
        fixtures.push({ id: `f${fid++}`, round: r + rounds, stage: 'regular', home: away, away: home })
      }
    }
    // rotate all but the first entry
    const last = arr.splice(n - 1, 1)[0]
    arr.splice(1, 0, last)
  }

  return fixtures.sort((x, y) => x.round - y.round)
}
