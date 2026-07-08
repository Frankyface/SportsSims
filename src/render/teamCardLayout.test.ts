import { describe, it, expect } from 'vitest'
import { TEAM_CARD } from './teamCard'

// The 1080x1350 team-card zones must never overlap: header → hero crest → name →
// dossier panel → description → footer, each clearing the next, all inside the
// bottom safe area. Lock the rhythm so a tweak can't collide two blocks.

describe('team card layout', () => {
  it('is a 1080x1350 (4:5) card with even margins', () => {
    expect(TEAM_CARD.W).toBe(1080)
    expect(TEAM_CARD.H).toBe(1350)
    expect(TEAM_CARD.RIGHT).toBe(TEAM_CARD.W - TEAM_CARD.MARGIN)
    expect(TEAM_CARD.COL_W).toBe(TEAM_CARD.W - TEAM_CARD.MARGIN * 2)
  })

  it('the hero crest sits below the header and above the name', () => {
    const crestTop = TEAM_CARD.CREST_CY - TEAM_CARD.CREST_R
    const crestBottom = TEAM_CARD.CREST_CY + TEAM_CARD.CREST_R
    expect(crestTop).toBeGreaterThan(TEAM_CARD.HEADER_H)
    expect(crestBottom).toBeLessThan(TEAM_CARD.NAME_Y_SINGLE)
  })

  it('the dossier panel spans the content column and clears the description', () => {
    expect(TEAM_CARD.PANEL_X).toBe(TEAM_CARD.MARGIN)
    expect(TEAM_CARD.PANEL_X + TEAM_CARD.PANEL_W).toBe(TEAM_CARD.RIGHT)
    expect(TEAM_CARD.PANEL_Y + TEAM_CARD.PANEL_H).toBeLessThan(TEAM_CARD.DESC_Y)
  })

  it('the description clears the footer rule', () => {
    const descBottom = TEAM_CARD.DESC_Y + (TEAM_CARD.DESC_LINES - 1) * TEAM_CARD.DESC_LH
    expect(descBottom).toBeLessThan(TEAM_CARD.FOOTER_RULE_Y)
  })

  it('the footer stays inside the bottom safe area', () => {
    expect(TEAM_CARD.FOOTER_RULE_Y).toBeLessThan(TEAM_CARD.BOTTOM_SAFE)
    expect(TEAM_CARD.BOTTOM_SAFE).toBeLessThan(TEAM_CARD.H)
  })
})
