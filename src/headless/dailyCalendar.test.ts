import { describe, it, expect } from 'vitest'
import {
  soccerPlanForDay,
  golfPlanForDay,
  nextSoccerDay,
  nextGolfDay,
  SOCCER_REGULAR_MATCHES,
  SOCCER_TOTAL_DAYS,
  GOLF_DAYS_PER_EVENT,
  GOLF_TOTAL_DAYS,
} from './dailyCalendar'

describe('soccerPlanForDay', () => {
  it('posts round 1 matches on days 0-2 with no round table', () => {
    for (let d = 0; d < 3; d++) {
      const p = soccerPlanForDay(d)
      expect(p).toEqual({ kind: 'match', matchIndex: d, round: 0, roundTable: null })
    }
  })

  it('carries the previous full round table on each round-opener', () => {
    // Day 3 = round 1 opener → post round 0's table. Day 6 = round 2 opener → round 1.
    expect(soccerPlanForDay(3)).toEqual({ kind: 'match', matchIndex: 3, round: 1, roundTable: 0 })
    expect(soccerPlanForDay(6)).toEqual({ kind: 'match', matchIndex: 6, round: 2, roundTable: 1 })
    expect(soccerPlanForDay(27)).toEqual({ kind: 'match', matchIndex: 27, round: 9, roundTable: 8 })
  })

  it('mid-round match-days have no round table', () => {
    expect(soccerPlanForDay(4).kind).toBe('match')
    expect((soccerPlanForDay(4) as { roundTable: number | null }).roundTable).toBeNull()
    expect((soccerPlanForDay(5) as { roundTable: number | null }).roundTable).toBeNull()
  })

  it('runs playoffs after the 30 regular matches; sf1 carries the final regular table', () => {
    expect(soccerPlanForDay(30)).toEqual({ kind: 'playoff', fixture: 'sf1', finalRegTable: true })
    expect(soccerPlanForDay(31)).toEqual({ kind: 'playoff', fixture: 'sf2', finalRegTable: false })
    expect(soccerPlanForDay(32)).toEqual({ kind: 'playoff', fixture: 'final', finalRegTable: false })
  })

  it('is empty once the season (incl. playoffs) is done', () => {
    expect(soccerPlanForDay(SOCCER_TOTAL_DAYS).kind).toBe('none')
    expect(soccerPlanForDay(99).kind).toBe('none')
  })

  it('rejects bad indices', () => {
    expect(soccerPlanForDay(-1).kind).toBe('none')
    expect(soccerPlanForDay(1.5).kind).toBe('none')
  })

  it('covers every regular match exactly once across the regular window', () => {
    const seen = new Set<number>()
    for (let d = 0; d < SOCCER_REGULAR_MATCHES; d++) {
      const p = soccerPlanForDay(d)
      expect(p.kind).toBe('match')
      if (p.kind === 'match') seen.add(p.matchIndex)
    }
    expect(seen.size).toBe(SOCCER_REGULAR_MATCHES)
  })
})

describe('golfPlanForDay', () => {
  it('opens each 5-day event cycle with a preview', () => {
    expect(golfPlanForDay(0)).toEqual({ kind: 'preview', eventIndex: 0 })
    expect(golfPlanForDay(5)).toEqual({ kind: 'preview', eventIndex: 1 })
    expect(golfPlanForDay(65)).toEqual({ kind: 'preview', eventIndex: 13 })
  })

  it('maps days 1-4 of a cycle to rounds 1-4', () => {
    expect(golfPlanForDay(1)).toEqual({ kind: 'round', eventIndex: 0, round: 1 })
    expect(golfPlanForDay(4)).toEqual({ kind: 'round', eventIndex: 0, round: 4 })
    expect(golfPlanForDay(6)).toEqual({ kind: 'round', eventIndex: 1, round: 1 })
    expect(golfPlanForDay(69)).toEqual({ kind: 'round', eventIndex: 13, round: 4 })
  })

  it('is empty after the 14-event season', () => {
    expect(golfPlanForDay(GOLF_TOTAL_DAYS).kind).toBe('none')
    expect(golfPlanForDay(-1).kind).toBe('none')
  })

  it('produces exactly one preview + four rounds per event', () => {
    for (let ev = 0; ev < 14; ev++) {
      const kinds = Array.from({ length: GOLF_DAYS_PER_EVENT }, (_, i) => golfPlanForDay(ev * GOLF_DAYS_PER_EVENT + i).kind)
      expect(kinds).toEqual(['preview', 'round', 'round', 'round', 'round'])
    }
  })
})

describe('cursor advance', () => {
  it('advances one day while content remains', () => {
    expect(nextSoccerDay(3)).toBe(4)
    expect(nextGolfDay(5)).toBe(6)
  })
  it('holds at the terminal day when the season is over', () => {
    expect(nextSoccerDay(SOCCER_TOTAL_DAYS)).toBe(SOCCER_TOTAL_DAYS)
    expect(nextGolfDay(GOLF_TOTAL_DAYS)).toBe(GOLF_TOTAL_DAYS)
  })
})
