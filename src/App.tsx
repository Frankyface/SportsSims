import { useMemo, useState } from 'react'
import { simulateMatch } from './sim/simulateMatch'
import { generateLeague } from './ratings/teams'
import { toTeamRating } from './ratings/strength'
import { MatchCanvas } from './ui/MatchCanvas'

export default function App() {
  const league = useMemo(() => generateLeague('demo-league', 10), [])
  const [matchNo, setMatchNo] = useState(1)

  const { match, home, away } = useMemo(() => {
    const h = league[(matchNo * 2) % league.length]
    const a = league[(matchNo * 2 + 1) % league.length]
    const m = simulateMatch({
      seedKey: `friendly:${matchNo}`,
      home: toTeamRating(h.identity, h.glicko),
      away: toTeamRating(a.identity, a.glicko),
      homeAdvantage: 1.1,
    })
    return { match: m, home: h, away: a }
  }, [league, matchNo])

  return (
    <main className="wrap">
      <header>
        <span className="net">
          ELITE<b>SIM</b>SPN
        </span>
        <span className="tag">Elite Simulated Sports Programming Network</span>
      </header>

      <MatchCanvas match={match} playKey={matchNo} />

      <div className="controls">
        <button onClick={() => setMatchNo((n) => n + 1)}>Next match ▸</button>
        <code>friendly · replays on loop</code>
      </div>

      <p className="stats">
        <span style={{ color: home.identity.color }}>{home.identity.name}</span> ({Math.round(home.glicko.rating)})
        {'  vs  '}
        <span style={{ color: away.identity.color }}>{away.identity.name}</span> ({Math.round(away.glicko.rating)})
        {'  ·  Final '}
        {match.score[0]}–{match.score[1]} · Shots {match.stats.shots[0]}–{match.stats.shots[1]} · xG{' '}
        {match.stats.xg[0].toFixed(2)}–{match.stats.xg[1].toFixed(2)}
      </p>
    </main>
  )
}
