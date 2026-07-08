import { describe, it, expect } from 'vitest'
import { TABLE } from './leagueTable'
import { COLUMNS as SOCCER_COLS } from './standingsCard'
import { COLUMNS as RUGBY_COLS } from './rugbyStandingsCard'
import type { TableColumn } from './leagueTable'

// The 1080x1920 table grid is collision-checked. Lock the geometry so a future
// tweak can't reintroduce column crush, hide the playoff line, or push the
// footer off-frame.

describe('league table layout — frame + rhythm', () => {
  it('is a 1080x1920 card with even margins', () => {
    expect(TABLE.W).toBe(1080)
    expect(TABLE.H).toBe(1920)
    expect(TABLE.MARGIN_L).toBe(1080 - TABLE.MARGIN_R)
  })

  it('fits all six rows above the legend', () => {
    const lastBandBottom = TABLE.rowCenter(5) + TABLE.BAND_H / 2
    expect(TABLE.rowCenter(0)).toBe(634)
    expect(lastBandBottom).toBeLessThanOrEqual(TABLE.BODY_BOTTOM)
    expect(TABLE.BODY_BOTTOM).toBeLessThan(TABLE.LEGEND_Y)
  })

  it('keeps the header + footer inside the frame', () => {
    expect(TABLE.HEADER_RULE_Y).toBeLessThan(TABLE.TOP)
    expect(TABLE.FOOTER_TOP_Y).toBeGreaterThan(TABLE.BODY_BOTTOM)
    expect(TABLE.FOOTER_TOP_Y).toBeLessThan(TABLE.H)
  })

  it('draws the playoff cut-line between seed 4 and seed 5', () => {
    const r4Bottom = TABLE.rowCenter(TABLE.QUALIFY - 1) + TABLE.BAND_H / 2
    const r5Top = TABLE.rowCenter(TABLE.QUALIFY) - TABLE.BAND_H / 2
    expect(r4Bottom).toBeLessThan(r5Top) // there's a real gap to draw the line in
    expect(TABLE.QUALIFY).toBe(4)
  })

  it('orders the zones left→right: name | numbers | fence | pts | form', () => {
    expect(TABLE.NAME_X).toBeGreaterThan(TABLE.CREST_X)
    expect(TABLE.DIVIDER_X).toBeGreaterThan(TABLE.NAME_X)
    expect(TABLE.FENCE_X).toBeLessThan(TABLE.PTS_X)
    expect(TABLE.PTS_X).toBeLessThan(TABLE.FORM_X)
    const formEnd = TABLE.FORM_X + 5 * TABLE.FORM_SIZE + 4 * TABLE.FORM_GAP
    expect(formEnd).toBeLessThanOrEqual(TABLE.MARGIN_R)
  })
})

function assertColumns(cols: TableColumn[]) {
  // strictly increasing, comfortably spaced, and inside the numbers band.
  for (let i = 0; i < cols.length; i++) {
    expect(cols[i].x).toBeGreaterThan(TABLE.DIVIDER_X)
    expect(cols[i].x).toBeLessThan(TABLE.FENCE_X)
    if (i > 0) expect(cols[i].x - cols[i - 1].x).toBeGreaterThanOrEqual(40)
  }
}

describe('league table layout — numeric columns fit without crush', () => {
  it('soccer columns (P W D L GD) are ordered and spaced', () => {
    expect(SOCCER_COLS.map((c) => c.label)).toEqual(['P', 'W', 'D', 'L', 'GD'])
    assertColumns(SOCCER_COLS)
  })

  it('rugby columns (P W D L PD BP) are ordered and spaced', () => {
    expect(RUGBY_COLS.map((c) => c.label)).toEqual(['P', 'W', 'D', 'L', 'PD', 'BP'])
    assertColumns(RUGBY_COLS)
  })
})
