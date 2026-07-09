import { describe, it, expect } from 'vitest'
import {
  buildGolfPreviewModel,
  golfPreviewSeed,
  previewImageName,
  PREVIEW_IMAGE_COUNT,
} from './golfCoursePreview'
import { golfEventBrand } from '../content/golfEventPack'
import { eventById, golfCourseById } from '../ratings/golfCourses'
import { HOLES_PER_ROUND } from '../sim/golfTypes'

describe('golf course preview', () => {
  it('golfPreviewSeed is deterministic and specific to tour/season/event', () => {
    const a = golfPreviewSeed('tour-x', 1, 0)
    expect(golfPreviewSeed('tour-x', 1, 0)).toBe(a)
    expect(golfPreviewSeed('tour-x', 1, 1)).not.toBe(a) // different event
    expect(golfPreviewSeed('tour-x', 2, 0)).not.toBe(a) // different season
    expect(golfPreviewSeed('tour-y', 1, 0)).not.toBe(a) // different tour
  })

  it('the carousel is a title card + one image per hole, with sortable filenames', () => {
    expect(PREVIEW_IMAGE_COUNT).toBe(1 + HOLES_PER_ROUND)
    expect(previewImageName(0)).toBe('0-title')
    expect(previewImageName(1)).toBe('1-hole-1')
    expect(previewImageName(9)).toBe('9-hole-9')
    // names sort into carousel order (title first, then holes 1..9)
    const names = Array.from({ length: PREVIEW_IMAGE_COUNT }, (_, i) => previewImageName(i))
    expect([...names].sort()).toEqual(names)
  })

  it('builds a 9-hole model whose layouts match the course holes', () => {
    const event = eventById('pinnacle-championship')
    const course = golfCourseById(event.courseId)
    const model = buildGolfPreviewModel(golfEventBrand(event.id), course, golfPreviewSeed('t', 1, 13))
    expect(model.layouts).toHaveLength(HOLES_PER_ROUND)
    expect(model.event.id).toBe('pinnacle-championship')
    expect(model.coursePar).toBe(course.par)
    model.layouts.forEach((l, i) => expect(l.hole).toBe(course.holes[i]))
  })

  it('same seed → byte-identical layouts (a stable preview forever)', () => {
    const event = eventById('harborlight-cup')
    const course = golfCourseById(event.courseId)
    const seed = golfPreviewSeed('stable', 1, 0)
    const a = buildGolfPreviewModel(golfEventBrand(event.id), course, seed)
    const b = buildGolfPreviewModel(golfEventBrand(event.id), course, seed)
    expect(JSON.stringify(a.layouts)).toBe(JSON.stringify(b.layouts))
  })
})
