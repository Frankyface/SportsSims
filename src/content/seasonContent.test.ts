import { describe, it, expect } from 'vitest'
import { folderTags } from './seasonContent'

describe('season pack — posting-order folder tags', () => {
  it('numbers games within each round and stages the playoffs', () => {
    const ordered = [
      { round: 0, stage: 'regular' },
      { round: 0, stage: 'regular' },
      { round: 0, stage: 'regular' },
      { round: 1, stage: 'regular' },
      { round: 1, stage: 'regular' },
      { round: 9, stage: 'regular' },
      { round: 10, stage: 'sf' },
      { round: 10, stage: 'sf' },
      { round: 11, stage: 'final' },
    ]
    expect(folderTags(ordered)).toEqual([
      'R01.1',
      'R01.2',
      'R01.3',
      'R02.1',
      'R02.2',
      'R10.1',
      'SF.1',
      'SF.2',
      'FINAL',
    ])
  })

  it('restarts the game counter every round', () => {
    const ordered = Array.from({ length: 6 }, (_, i) => ({
      round: Math.floor(i / 3),
      stage: 'regular',
    }))
    const tags = folderTags(ordered)
    expect(tags).toEqual(['R01.1', 'R01.2', 'R01.3', 'R02.1', 'R02.2', 'R02.3'])
  })
})
