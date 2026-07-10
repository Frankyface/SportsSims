// Pure posting calendar for the hands-off daily cadence. Maps a per-account day
// index (0-based, since the account's season start) to exactly what to post that
// day. No rendering, no I/O — deterministic and unit-tested — so the day→content
// mapping can be verified without spinning up a browser.
//
// Cadence (operator spec, revised 2026-07-09 — reels every day, companion posts
// ride along on reel days):
//  Soccer (Crown League): one match Reel/day. The completed round's FULL table
//    posts the SAME day as the round's last match (after it). The last regular
//    match day also carries the PLAYOFFS bracket post. Then sf1; sf2 + the
//    FINALS preview; the final; and a CHAMPIONS carousel the day after.
//  Golf (SGA Tour): E1 keeps the legacy 5-day shape (preview + 4 rounds — the
//    seed drop posted it). From E2 on, each event is 4 ROUND DAYS (both group
//    Reels each day); the R4 day also carries the event's RESULTS carousel and
//    the NEXT event's course preview. After event 14: a CHAMPIONS carousel.

import { EVENTS_PER_SEASON } from '../ratings/golfCourses'
import { ROUNDS_PER_EVENT } from '../league/golfSeason'

/** Soccer: 6 teams, double round-robin = 10 rounds × 3 matches. */
export const SOCCER_MATCHES_PER_ROUND = 3
export const SOCCER_REGULAR_ROUNDS = 10
export const SOCCER_REGULAR_MATCHES = SOCCER_REGULAR_ROUNDS * SOCCER_MATCHES_PER_ROUND // 30
/** Regular matches, then sf1, sf2, final, champions day. */
export const SOCCER_TOTAL_DAYS = SOCCER_REGULAR_MATCHES + 4 // 34

/** Golf: E1 = 5 legacy days; events 2..14 = 4 round-days each; + champions day. */
export const GOLF_E1_DAYS = 1 + ROUNDS_PER_EVENT // 5
export const GOLF_DAYS_PER_EVENT = ROUNDS_PER_EVENT // 4 (E2 onward)
export const GOLF_TOTAL_DAYS = GOLF_E1_DAYS + (EVENTS_PER_SEASON - 1) * GOLF_DAYS_PER_EVENT + 1 // 58

export type SoccerDayPlan =
  | {
      kind: 'match'
      /** 0-based index into the round-ordered regular fixtures (0..29). */
      matchIndex: number
      /** 0-based regular-season round this match belongs to. */
      round: number
      /** If this is the round's LAST match, that round (0-based) — post its full
       * table after the match; else null. */
      roundTable: number | null
      /** Last regular match of the season → also post the playoffs bracket. */
      playoffsPreview: boolean
    }
  | { kind: 'playoff'; fixture: 'sf1' | 'sf2' | 'final'; finalsPreview: boolean }
  | { kind: 'champions' }
  | { kind: 'none' }

export type GolfDayPlan =
  | { kind: 'preview'; eventIndex: number } // legacy — E1 day 0 only
  | {
      kind: 'round'
      eventIndex: number
      round: number // 1..4
      /** Round 4: post the event's RESULTS carousel after the two group reels. */
      results: boolean
      /** Round 4: the NEXT event whose course preview posts after the results
       * (null on the season's last event). */
      nextPreviewEventIndex: number | null
    }
  | { kind: 'champions' }
  | { kind: 'none' }

/** What the soccer account posts on `day` (0-based since season start). */
export function soccerPlanForDay(day: number): SoccerDayPlan {
  if (!Number.isInteger(day) || day < 0) return { kind: 'none' }

  if (day < SOCCER_REGULAR_MATCHES) {
    const round = Math.floor(day / SOCCER_MATCHES_PER_ROUND)
    const isRoundCloser = day % SOCCER_MATCHES_PER_ROUND === SOCCER_MATCHES_PER_ROUND - 1
    return {
      kind: 'match',
      matchIndex: day,
      round,
      roundTable: isRoundCloser ? round : null,
      playoffsPreview: day === SOCCER_REGULAR_MATCHES - 1,
    }
  }

  const playoffDay = day - SOCCER_REGULAR_MATCHES
  if (playoffDay === 0) return { kind: 'playoff', fixture: 'sf1', finalsPreview: false }
  if (playoffDay === 1) return { kind: 'playoff', fixture: 'sf2', finalsPreview: true }
  if (playoffDay === 2) return { kind: 'playoff', fixture: 'final', finalsPreview: false }
  if (playoffDay === 3) return { kind: 'champions' }
  return { kind: 'none' } // season over — transition/re-roll deferred
}

/** What the golf account posts on `day` (0-based since season start). */
export function golfPlanForDay(day: number): GolfDayPlan {
  if (!Number.isInteger(day) || day < 0 || day >= GOLF_TOTAL_DAYS) return { kind: 'none' }

  // E1 legacy shape (the seed drop): day 0 preview, days 1-4 rounds 1-4.
  // Its R4 day predates the results/next-preview format — the one-off catch-up
  // run posted those, so the calendar leaves E1's round days plain.
  if (day < GOLF_E1_DAYS) {
    if (day === 0) return { kind: 'preview', eventIndex: 0 }
    return { kind: 'round', eventIndex: 0, round: day, results: false, nextPreviewEventIndex: null }
  }

  const roundDay = day - GOLF_E1_DAYS
  const eventIndex = 1 + Math.floor(roundDay / GOLF_DAYS_PER_EVENT)
  if (eventIndex >= EVENTS_PER_SEASON) return { kind: 'champions' } // day 57
  const round = (roundDay % GOLF_DAYS_PER_EVENT) + 1
  const isFinalRound = round === ROUNDS_PER_EVENT
  return {
    kind: 'round',
    eventIndex,
    round,
    results: isFinalRound,
    nextPreviewEventIndex: isFinalRound && eventIndex + 1 < EVENTS_PER_SEASON ? eventIndex + 1 : null,
  }
}

/** Advance the cursor only while the account still has content; hold at the end so
 * a future season-transition can resume from here. */
export function nextSoccerDay(day: number): number {
  return soccerPlanForDay(day).kind === 'none' ? day : day + 1
}
export function nextGolfDay(day: number): number {
  return golfPlanForDay(day).kind === 'none' ? day : day + 1
}
