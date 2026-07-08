import { describe, expect, it } from 'vitest'
import {
  INGOAL_PX,
  RUGBY_CROWD_BOTTOM,
  RUGBY_CROWD_TOP,
  RUGBY_PITCH,
  rugbyToPx,
} from './rugbyScene'

// Frame geometry locks for the full-frame rugby stadium (1080x1920 portrait).
const FRAME_H = 1920
const SCOREBUG_BOTTOM = 250 // BUG_Y (150) + height (100)

describe('rugby stadium layout', () => {
  it('the pitch fills the frame — no dead space', () => {
    expect(RUGBY_PITCH.y).toBeLessThan(420)
    expect(RUGBY_PITCH.y + RUGBY_PITCH.h).toBeGreaterThan(1740)
    expect(RUGBY_PITCH.h / FRAME_H).toBeGreaterThan(0.7)
  })

  it('portrait pitch aspect stays believable', () => {
    const aspect = RUGBY_PITCH.w / RUGBY_PITCH.h
    expect(aspect).toBeGreaterThan(0.62)
    expect(aspect).toBeLessThan(0.8)
  })

  it('crowd terraces sit flush above and below the pitch, inside the frame', () => {
    expect(RUGBY_CROWD_TOP.y + RUGBY_CROWD_TOP.h).toBeLessThanOrEqual(RUGBY_PITCH.y)
    expect(RUGBY_CROWD_BOTTOM.y).toBeGreaterThanOrEqual(RUGBY_PITCH.y + RUGBY_PITCH.h)
    expect(RUGBY_CROWD_TOP.h).toBeGreaterThanOrEqual(100)
    expect(RUGBY_CROWD_BOTTOM.h).toBeGreaterThanOrEqual(100)
    expect(RUGBY_CROWD_BOTTOM.y + RUGBY_CROWD_BOTTOM.h).toBeLessThanOrEqual(FRAME_H)
  })

  it('money shot: a try grounded in the TOP in-goal clears the scorebug', () => {
    // deepest grounding overshoot the choreographer produces is y = -0.035
    const [, py] = rugbyToPx([0.5, -0.035])
    expect(py).toBeGreaterThan(SCOREBUG_BOTTOM)
    // and it still lands ON the in-goal grass, not in the crowd
    expect(py).toBeGreaterThan(RUGBY_PITCH.y)
  })

  it('the in-goal areas are deep enough to read as real zones', () => {
    expect(INGOAL_PX).toBeGreaterThanOrEqual(40)
    // both in-goals fit inside the pitch rect with a real field between them
    expect(RUGBY_PITCH.h - 2 * INGOAL_PX).toBeGreaterThan(1000)
  })
})
