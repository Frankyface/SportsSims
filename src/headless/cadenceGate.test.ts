import { describe, it, expect } from 'vitest'

// Mirrors the monotonic HWM gate in dailyContent.ts. Kept as a standalone pure
// model so the idempotency invariants (no duplicate posts on re-fire; a dropped
// companions run recovers next day) are unit-tested without a browser.

const ORD = { g1: 0, main: 1, companions: 2 } as const
type Slot = keyof typeof ORD
interface Cur { season: number; day: number; postedHWM: number }
const pos = (c: Cur, s: Slot) => c.season * 1_000_000 + c.day * 10 + ORD[s]

/** Simulate one slot run; returns { posted, next }. `hasContent` marks whether
 * the account has any post for (day, slot). advanceDay bumps the day. */
function runSlot(cur: Cur, slot: Slot, hasContent: boolean): { posted: boolean; next: Cur } {
  const doIt = pos(cur, slot) > cur.postedHWM
  const posted = doIt && hasContent
  let postedHWM = doIt && pos(cur, slot) > cur.postedHWM ? pos(cur, slot) : cur.postedHWM
  let next: Cur = { ...cur, postedHWM }
  if (slot === 'companions' && doIt) next = { season: cur.season, day: cur.day + 1, postedHWM }
  return { posted, next }
}

describe('cadence idempotency gate', () => {
  it('a normal day: g1, main, companions each post once, day advances after companions', () => {
    let cur: Cur = { season: 1, day: 5, postedHWM: 1 * 1_000_000 + 4 * 10 + 2 } // posted-through prev day
    const g1 = runSlot(cur, 'g1', true); expect(g1.posted).toBe(true); cur = g1.next
    const mn = runSlot(cur, 'main', true); expect(mn.posted).toBe(true); cur = mn.next
    const co = runSlot(cur, 'companions', true); expect(co.posted).toBe(true); cur = co.next
    expect(cur.day).toBe(6) // advanced
  })

  it('re-firing an already-posted slot is a no-op (no duplicate)', () => {
    let cur: Cur = { season: 1, day: 5, postedHWM: 1 * 1_000_000 + 4 * 10 + 2 }
    cur = runSlot(cur, 'g1', true).next
    const refire = runSlot(cur, 'g1', true)
    expect(refire.posted).toBe(false)
  })

  it('a dropped companions run recovers on the next day without duplicating reels', () => {
    // Day 5: g1 + main post, companions is DROPPED (never runs).
    let cur: Cur = { season: 1, day: 5, postedHWM: 1 * 1_000_000 + 4 * 10 + 2 }
    cur = runSlot(cur, 'g1', true).next
    cur = runSlot(cur, 'main', true).next
    expect(cur.day).toBe(5) // not advanced — companions never ran

    // Next calendar day the cron fires all three for the SAME cursor day 5:
    expect(runSlot(cur, 'g1', true).posted).toBe(false) // no dup
    expect(runSlot(cur, 'main', true).posted).toBe(false) // no dup
    const recover = runSlot(cur, 'companions', true)
    expect(recover.posted).toBe(true) // companions finally posts
    expect(recover.next.day).toBe(6) // and advances
  })

  it('companions with no content still advances the day', () => {
    let cur: Cur = { season: 1, day: 20, postedHWM: 1 * 1_000_000 + 20 * 10 + 1 } // main already done
    const co = runSlot(cur, 'companions', false) // e.g. a golf non-R4 day
    expect(co.posted).toBe(false)
    expect(co.next.day).toBe(21) // day still advances
  })
})
