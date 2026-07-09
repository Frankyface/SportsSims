import { describe, it, expect } from 'vitest'
import { golfLeaderLineAfter } from './golfCaptions'
import { createGolfSeason, ROUNDS_PER_EVENT, type GolfEventRecord } from '../league/golfSeason'

/**
 * Build a completed-event record where two golfers TIE on 36-hole total but one
 * shot the better final round — the case the engine settles by final-round
 * countback (finishOrderOf).
 */
function tieRecord(field: GolfEventRecord['field'], winnerId: string): GolfEventRecord {
  const n = field.length
  // everyone finishes well behind (+8) except idx 2 and idx 5, who tie at -8.
  const rounds = Array.from({ length: ROUNDS_PER_EVENT }, () => Array(n).fill(2) as number[])
  rounds[0][2] = -2; rounds[1][2] = -2; rounds[2][2] = -2; rounds[3][2] = -2 // idx2: -8, final -2
  rounds[0][5] = -1; rounds[1][5] = -1; rounds[2][5] = -1; rounds[3][5] = -5 // idx5: -8, final -5 (better)
  return {
    eventIndex: 0,
    eventId: 'harborlight-cup',
    season: 1,
    finishOrder: [],
    totalToPar: [],
    winnerId,
    wireToWire: false,
    comeback: false,
    winnerFirstWin: true,
    winnerFirstMajor: false,
    field,
    toParByRound: rounds,
  }
}

describe('golf captions — final-round countback', () => {
  it('golfLeaderLineAfter settles a 36-hole tie by the final round (agrees with the engine winner)', () => {
    const s = createGolfSeason('tie-tour', 'The SGA')
    const record = tieRecord(s.current.field, s.golfers[5].identity.id)
    const line = golfLeaderLineAfter(s, record, ROUNDS_PER_EVENT)
    // idx 5 shot the better final round, so it wins the countback — NOT idx 2 (lower tour index)
    expect(line).toContain(s.golfers[5].identity.name)
    expect(line).toContain('after 36 holes')
  })

  it('does NOT apply the countback before the final round (co-leaders stay tied by tour index)', () => {
    const s = createGolfSeason('tie-tour', 'The SGA')
    const record = tieRecord(s.current.field, s.golfers[5].identity.id)
    // through 2 rounds idx2 (-4) and idx5 (-2) are NOT tied; idx2 leads — no countback in play
    const line = golfLeaderLineAfter(s, record, 2)
    expect(line).toContain(s.golfers[2].identity.name)
    expect(line).toContain('after 18 holes')
  })
})
