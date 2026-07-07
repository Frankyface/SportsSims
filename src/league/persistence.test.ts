import { describe, it, expect } from 'vitest'
import { toBase64, fromBase64 } from './persistence'
import { createLeague, playRound } from './league'

describe('persistence — base64 handles unicode', () => {
  it('round-trips accented names and emoji (btoa alone would throw)', () => {
    const s = 'Sundervale Åthletic · Café FC ⚽'
    expect(fromBase64(toBase64(s))).toBe(s)
  })
})

describe('persistence — league serialization', () => {
  it('survives a JSON round-trip with results intact', () => {
    const s = playRound(createLeague('ser-test', 'Serialize', 6), 0)
    const clone = JSON.parse(JSON.stringify(s))
    expect(clone.teams).toHaveLength(6)
    expect(Object.keys(clone.results).length).toBe(Object.keys(s.results).length)
    expect(clone.fixtures.length).toBe(s.fixtures.length)
    // base64 round-trip of the whole state
    const restored = JSON.parse(fromBase64(toBase64(JSON.stringify(s))))
    expect(restored.id).toBe(s.id)
    expect(restored.season).toBe(1)
  })
})
