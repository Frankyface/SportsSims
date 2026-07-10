import { describe, it, expect } from 'vitest'
import { golfDisplayGroups } from './golfDisplayGroups'
import { FIELD_SIZE, GROUP_SIZE } from '../sim/golfTypes'

describe('golfDisplayGroups', () => {
  it('is deterministic for a given round seedKey', () => {
    const a = golfDisplayGroups('tour:s1:e2:r3')
    const b = golfDisplayGroups('tour:s1:e2:r3')
    expect(a).toEqual(b)
  })

  it('partitions the full field into two foursomes', () => {
    for (let i = 0; i < 40; i++) {
      const [g1, g2] = golfDisplayGroups(`seed-${i}:s1:e${i % 14}:r${(i % 4) + 1}`)
      expect(g1).toHaveLength(GROUP_SIZE)
      expect(g2).toHaveLength(GROUP_SIZE)
      const all = [...g1, ...g2].sort((x, y) => x - y)
      expect(all).toEqual(Array.from({ length: FIELD_SIZE }, (_, j) => j))
    }
  })

  it('differs between rounds of the same event (fresh draw each round)', () => {
    const draws = new Set(
      [1, 2, 3, 4].map((r) => JSON.stringify(golfDisplayGroups(`tour:s1:e5:r${r}`))),
    )
    expect(draws.size).toBeGreaterThan(1)
  })

  it("group 2 is NOT systematically the sim's leader group (indices 4-7)", () => {
    // In rounds 2-4 the sim field order puts the leaders at indices 4-7. Count how
    // often the display draw reproduces exactly that split — must be rare.
    let leadersLast = 0
    const n = 200
    for (let i = 0; i < n; i++) {
      const [, g2] = golfDisplayGroups(`mix-${i}:s1:e${i % 14}:r${(i % 3) + 2}`)
      if ([...g2].sort((x, y) => x - y).join(',') === '4,5,6,7') leadersLast++
    }
    // 1 / C(8,4) ≈ 1.4% expected; allow generous slack, fail if it's systematic.
    expect(leadersLast / n).toBeLessThan(0.1)
  })
})
