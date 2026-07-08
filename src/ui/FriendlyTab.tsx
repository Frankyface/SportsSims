import { useMemo, useState } from 'react'
import { simulateMatch } from '../sim/simulateMatch'
import { generateLeague } from '../ratings/teams'
import { toTeamRating } from '../ratings/strength'
import { MatchView } from './MatchView'

/** A one-off match: pick the teams, and every run is a fresh game. Nothing is saved. */
export function FriendlyTab() {
  const teams = useMemo(() => generateLeague('friendly-pool', 6), [])
  const [homeIdx, setHomeIdx] = useState(0)
  const [awayIdx, setAwayIdx] = useState(3)
  // `gen` bumps on every interaction; it feeds the seed so the SAME matchup
  // still plays out differently each time you hit "New match".
  const [gen, setGen] = useState(1)

  const home = teams[homeIdx]
  const away = teams[awayIdx]

  const match = useMemo(
    () =>
      simulateMatch({
        seedKey: `friendly:${home.identity.id}:${away.identity.id}:${gen}`,
        home: toTeamRating(home.identity, home.glicko),
        away: toTeamRating(away.identity, away.glicko),
        homeAdvantage: 1.1,
      }),
    [home, away, gen],
  )

  const pickHome = (i: number): void => {
    setHomeIdx(i)
    if (i === awayIdx) setAwayIdx((i + 1) % teams.length)
    setGen((g) => g + 1)
  }
  const pickAway = (i: number): void => {
    setAwayIdx(i)
    if (i === homeIdx) setHomeIdx((i + 1) % teams.length)
    setGen((g) => g + 1)
  }
  const shuffle = (): void => {
    // UI-side randomness (not the deterministic sim) — pick two distinct teams
    const i = Math.floor(Math.random() * teams.length)
    let j = Math.floor(Math.random() * (teams.length - 1))
    if (j >= i) j += 1
    setHomeIdx(i)
    setAwayIdx(j)
    setGen((g) => g + 1)
  }

  return (
    <div>
      <p className="hint">Pick a matchup, or shuffle — every run is a fresh game. Nothing is saved.</p>

      <div className="controls" style={{ gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
        <label>
          Home{' '}
          <select value={homeIdx} onChange={(e) => pickHome(Number(e.target.value))}>
            {teams.map((t, i) => (
              <option key={t.identity.id} value={i} disabled={i === awayIdx}>
                {t.identity.name}
              </option>
            ))}
          </select>
        </label>
        <span aria-hidden>vs</span>
        <label>
          Away{' '}
          <select value={awayIdx} onChange={(e) => pickAway(Number(e.target.value))}>
            {teams.map((t, i) => (
              <option key={t.identity.id} value={i} disabled={i === homeIdx}>
                {t.identity.name}
              </option>
            ))}
          </select>
        </label>
        <button className="btn" onClick={shuffle}>
          🔀 Shuffle
        </button>
      </div>

      <MatchView
        match={match}
        filename={`esspn-friendly-${home.identity.abbr}-${away.identity.abbr}.mp4`}
        playKey={gen}
      />

      <div className="controls">
        <button className="btn" onClick={() => setGen((g) => g + 1)}>
          New match ▸
        </button>
      </div>

      <p className="stats">
        <span style={{ color: home.identity.color }}>{home.identity.name}</span> ({Math.round(home.glicko.rating)}) vs{' '}
        <span style={{ color: away.identity.color }}>{away.identity.name}</span> ({Math.round(away.glicko.rating)}) · Final{' '}
        {match.score[0]}–{match.score[1]}
      </p>
    </div>
  )
}
