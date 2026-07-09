import { describe, it, expect } from 'vitest'
import {
  golfEventFolder,
  golfRoundFolder,
  golfSeasonFolderPlan,
  PREVIEW_FOLDER,
} from './golfSeasonContent'
import { createGolfSeason, simGolfSeasonToEnd, ROUNDS_PER_EVENT } from '../league/golfSeason'
import { EVENTS_PER_SEASON } from '../ratings/golfCourses'

describe('golf season content layout', () => {
  it('round folders map R1..R4 to Thu..Sun, tagging the finale', () => {
    expect(golfRoundFolder(1)).toBe('Thu - Round 1')
    expect(golfRoundFolder(2)).toBe('Fri - Round 2')
    expect(golfRoundFolder(3)).toBe('Sat - Round 3')
    expect(golfRoundFolder(4)).toBe('Sun - Round 4 (FINAL)')
  })

  it('event folders are ordered, padded, and badge majors vs the championship', () => {
    const state = simGolfSeasonToEnd(createGolfSeason('layout-tour', 'The SGA'))
    const plan = golfSeasonFolderPlan(state.completed)
    expect(plan).toHaveLength(EVENTS_PER_SEASON)

    // E01..E14 in playing order, each with one preview folder + 4 round folders
    plan.forEach((p, i) => {
      expect(p.eventFolder.startsWith(`E${String(i + 1).padStart(2, '0')} - `)).toBe(true)
      expect(p.previewFolder).toBe(PREVIEW_FOLDER)
      expect(p.roundFolders).toHaveLength(ROUNDS_PER_EVENT)
      expect(p.roundFolders[ROUNDS_PER_EVENT - 1]).toContain('(FINAL)')
    })

    // the season-ending Pinnacle gets the championship badge; a plain major reads (MAJOR)
    const pinnacle = state.completed.find((r) => r.eventId === 'pinnacle-championship')!
    expect(golfEventFolder(pinnacle)).toContain('(THE CHAMPIONSHIP)')
    const evergreen = state.completed.find((r) => r.eventId === 'evergreen-invitational')!
    expect(golfEventFolder(evergreen)).toContain('(MAJOR)')
    expect(golfEventFolder(evergreen)).not.toContain('(THE CHAMPIONSHIP)')
  })

  it('the folder plan sorts by event index regardless of input order', () => {
    const state = simGolfSeasonToEnd(createGolfSeason('order-tour', 'The SGA'))
    const plan = golfSeasonFolderPlan([...state.completed].reverse())
    const indices = plan.map((p) => Number(p.eventFolder.slice(1, 3)))
    expect(indices).toEqual([...indices].sort((a, b) => a - b))
  })
})
