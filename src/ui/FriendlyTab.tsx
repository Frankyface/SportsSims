import { useMemo, useState } from 'react'
import { simulateMatch } from '../sim/simulateMatch'
import { generateLeague } from '../ratings/teams'
import { toTeamRating } from '../ratings/strength'
import { MatchView } from './MatchView'

/** A one-off match. Nothing is saved to any league. */
export function FriendlyTab() {
  const teams = useMemo(() => generateLeague('friendly-pool', 12), [])
  const [n, setN] = useState(1)

  const { match, home, away } = useMemo(() => {
    const h = teams[(n * 2) % teams.length]
    const a = teams[(n * 2 + 1) % teams.length]
    return {
      match: simulateMatch({
        seedKey: `friendly:${n}`,
        home: toTeamRating(h.identity, h.glicko),
        away: toTeamRating(a.identity, a.glicko),
        homeAdvantage: 1.1,
      }),
      home: h,
      away: a,
    }
  }, [teams, n])

  return (
    <div>
      <p className="hint">A one-off match to see how it works — nothing is saved.</p>
      <MatchView match={match} filename={`esspn-friendly-${home.identity.abbr}-${away.identity.abbr}.mp4`} playKey={n} />
      <div className="controls">
        <button className="btn" onClick={() => setN((x) => x + 1)}>
          New matchup ▸
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
