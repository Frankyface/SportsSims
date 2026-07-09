// Pure posting calendar for the hands-off daily cadence. Maps a per-account day
// index (0-based, since the account's season start) to exactly what to post that
// day. No rendering, no I/O — deterministic and unit-tested — so the day→content
// mapping can be verified without spinning up a browser.
//
// Cadence (locked spec, see the elitesimspn-autopost-config memory):
//  Soccer (Crown League): one match/day as a Reel; the completed round's FULL
//    table posts as a standalone photo on the FIRST match-day of the next round;
//    then playoffs sf1 → sf2 → final (the final regular table rides with sf1).
//  Golf (SGA Tour): a 5-day cycle per event — day 0 preview carousel, days 1–4 a
//    round each (BOTH groups the same day), repeated for all 14 events.

import { EVENTS_PER_SEASON } from '../ratings/golfCourses'
import { ROUNDS_PER_EVENT } from '../league/golfSeason'

/** Soccer: 6 teams, double round-robin = 10 rounds × 3 matches. */
export const SOCCER_MATCHES_PER_ROUND = 3
export const SOCCER_REGULAR_ROUNDS = 10
export const SOCCER_REGULAR_MATCHES = SOCCER_REGULAR_ROUNDS * SOCCER_MATCHES_PER_ROUND // 30
/** Regular matches, then sf1, sf2, final. (Finals-preview content piece deferred.) */
export const SOCCER_TOTAL_DAYS = SOCCER_REGULAR_MATCHES + 3 // 33

/** Golf: preview + 4 rounds per event, 14 events. */
export const GOLF_DAYS_PER_EVENT = 1 + ROUNDS_PER_EVENT // 5
export const GOLF_TOTAL_DAYS = EVENTS_PER_SEASON * GOLF_DAYS_PER_EVENT // 70

export type SoccerDayPlan =
  | {
      kind: 'match'
      /** 0-based index into the round-ordered regular fixtures (0..29). */
      matchIndex: number
      /** 0-based regular-season round this match belongs to. */
      round: number
      /** If this is a round-opener, the 0-based round whose full table to also post; else null. */
      roundTable: number | null
    }
  | { kind: 'playoff'; fixture: 'sf1' | 'sf2' | 'final'; finalRegTable: boolean }
  | { kind: 'none' }

export type GolfDayPlan =
  | { kind: 'preview'; eventIndex: number }
  | { kind: 'round'; eventIndex: number; round: number } // round is 1..4
  | { kind: 'none' }

/** What the soccer account posts on `day` (0-based since season start). */
export function soccerPlanForDay(day: number): SoccerDayPlan {
  if (!Number.isInteger(day) || day < 0) return { kind: 'none' }

  if (day < SOCCER_REGULAR_MATCHES) {
    const round = Math.floor(day / SOCCER_MATCHES_PER_ROUND)
    const matchInRound = day % SOCCER_MATCHES_PER_ROUND
    // Round-opener (and not the very first round) also carries the previous
    // round's completed full table.
    const roundTable = matchInRound === 0 && round > 0 ? round - 1 : null
    return { kind: 'match', matchIndex: day, round, roundTable }
  }

  const playoffDay = day - SOCCER_REGULAR_MATCHES
  if (playoffDay === 0) return { kind: 'playoff', fixture: 'sf1', finalRegTable: true }
  if (playoffDay === 1) return { kind: 'playoff', fixture: 'sf2', finalRegTable: false }
  if (playoffDay === 2) return { kind: 'playoff', fixture: 'final', finalRegTable: false }
  return { kind: 'none' } // season over — transition/re-roll deferred
}

/** What the golf account posts on `day` (0-based since season start). */
export function golfPlanForDay(day: number): GolfDayPlan {
  if (!Number.isInteger(day) || day < 0 || day >= GOLF_TOTAL_DAYS) return { kind: 'none' }
  const eventIndex = Math.floor(day / GOLF_DAYS_PER_EVENT)
  const dayInCycle = day % GOLF_DAYS_PER_EVENT
  if (dayInCycle === 0) return { kind: 'preview', eventIndex }
  return { kind: 'round', eventIndex, round: dayInCycle } // dayInCycle 1..4 → round 1..4
}

/** Advance the cursor only while the account still has content; hold at the end so
 * a future season-transition can resume from here. */
export function nextSoccerDay(day: number): number {
  return soccerPlanForDay(day).kind === 'none' ? day : day + 1
}
export function nextGolfDay(day: number): number {
  return golfPlanForDay(day).kind === 'none' ? day : day + 1
}
