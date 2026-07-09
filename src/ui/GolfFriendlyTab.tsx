import { useMemo, useState } from 'react'
import { generateGolfTour } from '../ratings/golfers'
import { toGolferRating } from '../ratings/golfStrength'
import { simulateGolfRound } from '../sim/golfSim'
import { GOLF_COURSES } from '../ratings/golfCourses'
import { buildGolfRenderModel, type GolfEventBrand } from '../render/golfRenderMatch'
import { GolfRoundView } from './GolfRoundView'

const FRIENDLY_BRAND: GolfEventBrand = {
  id: 'friendly',
  name: 'SGA Tour Friendly',
  short: 'FRIENDLY',
  color: '#1E8E5A',
  colorAlt: '#d4af37',
  major: false,
  championship: false,
}

/** A one-off golf exhibition: pick YOUR foursome and the course, and watch
 * them play all nine holes shot for shot. Nothing is saved. */
export function GolfFriendlyTab() {
  const pool = useMemo(() => generateGolfTour('golf-friendly-pool'), [])
  const [picks, setPicks] = useState<number[]>([0, 1, 2, 3])
  const [courseIdx, setCourseIdx] = useState(0)
  // `gen` bumps on every interaction so the SAME foursome replays differently.
  const [gen, setGen] = useState(1)

  const course = GOLF_COURSES[courseIdx]

  const pick = (slot: number, poolIdx: number): void => {
    setPicks((prev) => {
      const next = [...prev]
      const clash = next.indexOf(poolIdx)
      if (clash >= 0 && clash !== slot) next[clash] = next[slot] // swap on collision
      next[slot] = poolIdx
      return next
    })
    setGen((g) => g + 1)
  }

  const shuffle = (): void => {
    // UI-side randomness (not the deterministic sim) — draw four distinct golfers
    const idxs = pool.map((_, i) => i)
    for (let i = idxs.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[idxs[i], idxs[j]] = [idxs[j], idxs[i]]
    }
    setPicks(idxs.slice(0, 4))
    setCourseIdx(Math.floor(Math.random() * GOLF_COURSES.length))
    setGen((g) => g + 1)
  }

  const model = useMemo(() => {
    // your four are group one; the rest of the tour quietly fills the field
    const rest = pool.map((_, i) => i).filter((i) => !picks.includes(i))
    const field = [...picks, ...rest].map((i) => toGolferRating(pool[i]))
    const result = simulateGolfRound({
      seedKey: `golf-friendly:${picks.join('-')}:${course.id}:${gen}`,
      course,
      golfers: field,
      round: 1,
      startToPar: Array(8).fill(0),
    })
    return buildGolfRenderModel(result, 0, FRIENDLY_BRAND, course.name)
  }, [pool, picks, course, gen])

  return (
    <div>
      <p className="hint">
        Pick your foursome and a course — they play all 9 holes, every shot. Nothing is saved.
      </p>

      <div className="controls" style={{ gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
        {picks.map((poolIdx, slot) => (
          <label key={slot}>
            {slot + 1}{' '}
            <select value={poolIdx} onChange={(e) => pick(slot, Number(e.target.value))}>
              {pool.map((g, i) => (
                <option key={g.identity.id} value={i} disabled={picks.includes(i) && picks[slot] !== i}>
                  {g.identity.name}
                </option>
              ))}
            </select>
          </label>
        ))}
      </div>
      <div className="controls" style={{ gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
        <label>
          Course{' '}
          <select
            value={courseIdx}
            onChange={(e) => {
              setCourseIdx(Number(e.target.value))
              setGen((g) => g + 1)
            }}
          >
            {GOLF_COURSES.map((c, i) => (
              <option key={c.id} value={i}>
                {c.name} ({c.env})
              </option>
            ))}
          </select>
        </label>
        <button className="btn" onClick={shuffle}>
          🔀 Shuffle
        </button>
        <button className="btn" onClick={() => setGen((g) => g + 1)}>
          New round ▸
        </button>
      </div>

      <GolfRoundView
        model={model}
        filename={`esspn-golf-friendly-${course.id}.mp4`}
        playKey={gen}
      />

      <p className="stats">
        {picks.map((i) => pool[i].identity.name).join(' · ')} at {course.name}
      </p>
    </div>
  )
}
