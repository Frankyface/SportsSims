import { describe, it, expect } from 'vitest'
import {
  BG_MID,
  clampLines,
  contrastRatio,
  deriveClubTokens,
  mixToward,
  withAlpha,
} from './theme'

// A minimal measureText stub — clampLines only needs width, not a real canvas.
function fakeCtx(perChar = 10): CanvasRenderingContext2D {
  return {
    font: '',
    measureText: (s: string) => ({ width: s.length * perChar }) as TextMetrics,
  } as unknown as CanvasRenderingContext2D
}

describe('theme — colour math', () => {
  it('contrast ratio spans black↔white ≈ 21', () => {
    expect(contrastRatio('#FFFFFF', '#000000')).toBeGreaterThan(20.9)
    expect(contrastRatio('#0A0E14', '#0A0E14')).toBeCloseTo(1, 5)
  })

  it('lifts a dark club colour until its accent is legible on the bg', () => {
    // Kingsbridge navy is far too dark to read on the near-black base.
    expect(contrastRatio('#1a237e', BG_MID)).toBeLessThan(4.5)
    const t = deriveClubTokens('#1a237e', '#d4af37')
    expect(contrastRatio(t.accent, BG_MID)).toBeGreaterThanOrEqual(4.5)
    expect(t.dark).toBe(true)
  })

  it('keeps an already-bright club colour readable without wrecking it', () => {
    const t = deriveClubTokens('#ffb300', '#2e7d32') // Sundervale amber
    expect(contrastRatio(t.accent, BG_MID)).toBeGreaterThanOrEqual(4.5)
    expect(t.dark).toBe(false)
  })

  it('falls back to platinum when both club colours are near-black', () => {
    const t = deriveClubTokens('#000000', '#0a0a0a')
    expect(contrastRatio(t.accent, BG_MID)).toBeGreaterThanOrEqual(4.5)
  })

  it('always exposes the raw colours for the swatches', () => {
    const t = deriveClubTokens('#1a237e', '#d4af37')
    expect(t.primary).toBe('#1a237e')
    expect(t.secondary).toBe('#d4af37')
  })

  it('withAlpha builds an rgba() from hex', () => {
    expect(withAlpha('#FF4655', 0.5)).toBe('rgba(255,70,85,0.5)')
  })

  it('mixToward blends linearly (black→white @0.5 is mid-grey)', () => {
    expect(mixToward('#000000', '#FFFFFF', 0.5)).toBe('#808080')
  })
})

describe('theme — clampLines', () => {
  it('keeps a short string on one line, no ellipsis', () => {
    const lines = clampLines(fakeCtx(), 'The Foundry', 1000, 3)
    expect(lines).toEqual(['The Foundry'])
  })

  it('wraps to at most maxLines and ellipsizes the overflow', () => {
    const long = 'one two three four five six seven eight nine ten eleven twelve'
    const lines = clampLines(fakeCtx(20), long, 200, 2) // ~10 chars fit per line
    expect(lines.length).toBeLessThanOrEqual(2)
    expect(lines[lines.length - 1].endsWith('…')).toBe(true)
  })
})
