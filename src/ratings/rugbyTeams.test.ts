import { describe, it, expect } from 'vitest'
import { RUGBY_CLUBS, RUGBY_LEAGUE, generateRugbyLeague } from './rugbyTeams'
import { CLUBS } from './teams'

describe('rugby clubs — identity layer', () => {
  it('defines six clubs', () => {
    expect(RUGBY_CLUBS).toHaveLength(6)
  })

  it('has unique, stable ids that never collide with the football clubs', () => {
    const ids = RUGBY_CLUBS.map((c) => c.id)
    expect(new Set(ids).size).toBe(ids.length)
    const footballIds = new Set(CLUBS.map((c) => c.id))
    for (const id of ids) expect(footballIds.has(id)).toBe(false)
  })

  it('every club carries a complete identity + description + logo prompt', () => {
    for (const c of RUGBY_CLUBS) {
      expect(c.name).toBeTruthy()
      expect(c.abbr).toBeTruthy()
      expect(c.city).toBeTruthy()
      expect(c.nickname).toBeTruthy()
      expect(c.archetype).toBeTruthy()
      expect(c.color).toMatch(/^#[0-9a-fA-F]{6}$/)
      expect(c.colorAlt).toMatch(/^#[0-9a-fA-F]{6}$/)
      expect(c.description.length).toBeGreaterThan(40)
      expect(c.logo.length).toBeGreaterThan(20)
    }
  })

  it('names a rugby competition brand', () => {
    expect(RUGBY_LEAGUE.name).toBeTruthy()
    expect(RUGBY_LEAGUE.short).toBeTruthy()
  })
})

describe('generateRugbyLeague', () => {
  it('is deterministic — same seed yields identical ratings', () => {
    const a = generateRugbyLeague('season-1')
    const b = generateRugbyLeague('season-1')
    expect(b).toEqual(a)
  })

  it('varies with the seed', () => {
    const a = generateRugbyLeague('season-1')
    const b = generateRugbyLeague('season-2')
    const ratingsA = a.map((t) => t.glicko.rating)
    const ratingsB = b.map((t) => t.glicko.rating)
    expect(ratingsB).not.toEqual(ratingsA)
  })

  it('draws six rated teams within the expected Glicko ranges', () => {
    const league = generateRugbyLeague('season-1')
    expect(league).toHaveLength(6)
    for (const t of league) {
      expect(t.glicko.rating).toBeGreaterThanOrEqual(1250)
      expect(t.glicko.rating).toBeLessThanOrEqual(1780)
      expect(t.glicko.rd).toBeGreaterThanOrEqual(70)
      expect(t.glicko.rd).toBeLessThanOrEqual(120)
      expect(t.glicko.vol).toBeGreaterThanOrEqual(0.05)
      expect(t.glicko.vol).toBeLessThanOrEqual(0.08)
    }
  })

  it('does not leak the description/logo prompt into the rated identity', () => {
    const league = generateRugbyLeague('season-1')
    const identity = league[0].identity as unknown as Record<string, unknown>
    expect(identity.description).toBeUndefined()
    expect(identity.logo).toBeUndefined()
  })
})
