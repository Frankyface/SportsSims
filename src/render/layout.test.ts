import { describe, it, expect } from 'vitest'
import { PITCH, CROWD_TOP, CROWD_BOTTOM } from './renderScene'

// The full-frame stadium layout has load-bearing geometry: the pitch must fill
// most of the 1080x1920 frame, the crowd bands must sit ABOVE/BELOW the pitch
// without overlapping it, and the top goal (money shot) must stay clear of the
// scorebug (bottom edge y=250). These are the constraints the redesign exists
// to satisfy — lock them so a future tweak can't silently reintroduce dead
// space or hide a goal behind the bug.
const FRAME_H = 1920
const SCOREBUG_BOTTOM = 250 // BUG_Y (150) + height (100)

describe('render layout — fills the frame, no dead space', () => {
  it('pitch fills the large majority of the frame height', () => {
    const pitchBottom = PITCH.y + PITCH.h
    expect(PITCH.y).toBeLessThan(420) // starts high, near the scorebug
    expect(pitchBottom).toBeGreaterThan(1740) // reaches near the bottom
    expect(PITCH.h / FRAME_H).toBeGreaterThan(0.7)
  })

  it('keeps a believable pitch shape (w:h in 0.62..0.80)', () => {
    const ratio = PITCH.w / PITCH.h
    expect(ratio).toBeGreaterThan(0.62)
    expect(ratio).toBeLessThan(0.8)
  })

  it('crowd terraces frame the pitch without overlapping it', () => {
    // top terrace sits above the pitch
    expect(CROWD_TOP.y + CROWD_TOP.h).toBeLessThanOrEqual(PITCH.y)
    // bottom terrace sits below the pitch
    expect(CROWD_BOTTOM.y).toBeGreaterThanOrEqual(PITCH.y + PITCH.h)
    // and both are deep enough to read as stands, not sprinkles
    expect(CROWD_TOP.h).toBeGreaterThanOrEqual(100)
    expect(CROWD_BOTTOM.h).toBeGreaterThanOrEqual(100)
    // bottom terrace still fits in the frame
    expect(CROWD_BOTTOM.y + CROWD_BOTTOM.h).toBeLessThanOrEqual(FRAME_H)
  })

  it('leaves the top goal clear of the scorebug (money shot)', () => {
    // a ball in the top net reaches ~normalized y -0.015 -> pixel:
    const ballInTopNet = PITCH.y - 0.015 * PITCH.h
    expect(ballInTopNet).toBeGreaterThan(SCOREBUG_BOTTOM)
  })
})
