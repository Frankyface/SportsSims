import { describe, it, expect } from 'vitest'
import {
  soccerPlanForDay,
  golfPlanForDay,
  nextSoccerDay,
  nextGolfDay,
  SOCCER_REGULAR_MATCHES,
  SOCCER_TOTAL_DAYS,
  GOLF_E1_DAYS,
  GOLF_DAYS_PER_EVENT,
  GOLF_TOTAL_DAYS,
} from './dailyCalendar'

describe('soccerPlanForDay', () => {
  it('posts one match per day; the round table rides the round-CLOSER day', () => {
    expect(soccerPlanForDay(0)).toEqual({ kind: 'match', matchIndex: 0, round: 0, roundTable: null, playoffsPreview: false })
    expect(soccerPlanForDay(1)).toEqual({ kind: 'match', matchIndex: 1, round: 0, roundTable: null, playoffsPreview: false })
    // day 2 = round 1's last match → round 1's full table posts the same day
    expect(soccerPlanForDay(2)).toEqual({ kind: 'match', matchIndex: 2, round: 0, roundTable: 0, playoffsPreview: false })
    // day 3 = round 2 opener → NO table (it moved to the closer day)
    expect(soccerPlanForDay(3)).toEqual({ kind: 'match', matchIndex: 3, round: 1, roundTable: null, playoffsPreview: false })
    expect(soccerPlanForDay(5)).toEqual({ kind: 'match', matchIndex: 5, round: 1, roundTable: 1, playoffsPreview: false })
  })

  it('adds the playoffs bracket post on the last regular match day (29)', () => {
    expect(soccerPlanForDay(29)).toEqual({ kind: 'match', matchIndex: 29, round: 9, roundTable: 9, playoffsPreview: true })
    // no other day carries it
    for (let d = 0; d < 29; d++) {
      const p = soccerPlanForDay(d)
      if (p.kind === 'match') expect(p.playoffsPreview).toBe(false)
    }
  })

  it('runs sf1, then sf2 + the finals preview, then the final', () => {
    expect(soccerPlanForDay(30)).toEqual({ kind: 'playoff', fixture: 'sf1', finalsPreview: false })
    expect(soccerPlanForDay(31)).toEqual({ kind: 'playoff', fixture: 'sf2', finalsPreview: true })
    expect(soccerPlanForDay(32)).toEqual({ kind: 'playoff', fixture: 'final', finalsPreview: false })
  })

  it('posts the champions carousel the day after the final, then goes quiet', () => {
    expect(soccerPlanForDay(33)).toEqual({ kind: 'champions' })
    expect(soccerPlanForDay(SOCCER_TOTAL_DAYS).kind).toBe('none')
    expect(soccerPlanForDay(99).kind).toBe('none')
  })

  it('rejects bad indices', () => {
    expect(soccerPlanForDay(-1).kind).toBe('none')
    expect(soccerPlanForDay(1.5).kind).toBe('none')
  })

  it('covers every regular match exactly once and every round table exactly once', () => {
    const matches = new Set<number>()
    const tables = new Set<number>()
    for (let d = 0; d < SOCCER_REGULAR_MATCHES; d++) {
      const p = soccerPlanForDay(d)
      expect(p.kind).toBe('match')
      if (p.kind === 'match') {
        matches.add(p.matchIndex)
        if (p.roundTable !== null) tables.add(p.roundTable)
      }
    }
    expect(matches.size).toBe(SOCCER_REGULAR_MATCHES)
    expect([...tables].sort((a, b) => a - b)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9])
  })
})

describe('golfPlanForDay', () => {
  it('keeps E1 in the legacy seed-drop shape (preview day + plain round days)', () => {
    expect(golfPlanForDay(0)).toEqual({ kind: 'preview', eventIndex: 0 })
    expect(golfPlanForDay(1)).toEqual({ kind: 'round', eventIndex: 0, round: 1, results: false, nextPreviewEventIndex: null })
    expect(golfPlanForDay(4)).toEqual({ kind: 'round', eventIndex: 0, round: 4, results: false, nextPreviewEventIndex: null })
  })

  it('runs E2+ as 4 round days; R4 carries results + the NEXT preview', () => {
    // E2 = days 5-8
    expect(golfPlanForDay(5)).toEqual({ kind: 'round', eventIndex: 1, round: 1, results: false, nextPreviewEventIndex: null })
    expect(golfPlanForDay(8)).toEqual({ kind: 'round', eventIndex: 1, round: 4, results: true, nextPreviewEventIndex: 2 })
    // E3 = days 9-12
    expect(golfPlanForDay(9)).toEqual({ kind: 'round', eventIndex: 2, round: 1, results: false, nextPreviewEventIndex: null })
    expect(golfPlanForDay(12)).toEqual({ kind: 'round', eventIndex: 2, round: 4, results: true, nextPreviewEventIndex: 3 })
  })

  it("the season's last event posts results but no next preview", () => {
    const lastR4 = GOLF_E1_DAYS + 13 * GOLF_DAYS_PER_EVENT - 1 // E14 R4 = day 56
    expect(golfPlanForDay(lastR4)).toEqual({ kind: 'round', eventIndex: 13, round: 4, results: true, nextPreviewEventIndex: null })
  })

  it('posts the champions carousel the day after E14, then goes quiet', () => {
    expect(golfPlanForDay(57)).toEqual({ kind: 'champions' })
    expect(golfPlanForDay(GOLF_TOTAL_DAYS).kind).toBe('none')
    expect(golfPlanForDay(-1).kind).toBe('none')
  })

  it('covers every event round exactly once across the season', () => {
    const seen = new Set<string>()
    for (let d = 0; d < GOLF_TOTAL_DAYS; d++) {
      const p = golfPlanForDay(d)
      if (p.kind === 'round') {
        const key = `${p.eventIndex}:${p.round}`
        expect(seen.has(key)).toBe(false)
        seen.add(key)
      }
    }
    expect(seen.size).toBe(14 * 4)
  })

  it('previews every event exactly once (E1 standalone; E2+ ride the prior R4 day)', () => {
    const previews: number[] = []
    for (let d = 0; d < GOLF_TOTAL_DAYS; d++) {
      const p = golfPlanForDay(d)
      if (p.kind === 'preview') previews.push(p.eventIndex)
      if (p.kind === 'round' && p.nextPreviewEventIndex !== null) previews.push(p.nextPreviewEventIndex)
    }
    // E2's preview was the one-off catch-up (E1's R4 predates the format), so the
    // calendar itself covers previews for E1 and E3..E14.
    expect(previews.sort((a, b) => a - b)).toEqual([0, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13])
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
