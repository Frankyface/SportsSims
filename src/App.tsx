import { useMemo, useState } from 'react'
import { simulateMatch } from './sim/simulateMatch'
import type { MatchConfig, TeamRating } from './sim/types'

// Two hardcoded sample teams for the Stage-1 slice (real rosters arrive in Stage 3).
const CARDINALS: TeamRating = {
  id: 'CAR', name: 'South City Cardinals', abbr: 'CAR', city: 'South City',
  color: '#c8102e', colorAlt: '#111111', attack: 1.08, defense: 1.02, finishing: 1.05, discipline: 1.0,
}
const KANGAROOS: TeamRating = {
  id: 'KAN', name: 'Kangaroos City FC', abbr: 'KAN', city: 'Kangaroos City',
  color: '#0067b1', colorAlt: '#ffffff', attack: 0.98, defense: 1.05, finishing: 0.97, discipline: 1.0,
}

const KEY_EVENTS = new Set(['goal', 'red', 'bigChance'])

export default function App() {
  const [matchNo, setMatchNo] = useState(1)
  const seedKey = `L1:S1:R1:M${matchNo}`

  const config: MatchConfig = useMemo(
    () => ({ seedKey, home: CARDINALS, away: KANGAROOS, homeAdvantage: 1.1 }),
    [seedKey],
  )
  const result = useMemo(() => simulateMatch(config), [config])
  const highlights = result.events.filter((e) => KEY_EVENTS.has(e.type))

  return (
    <main className="wrap">
      <header>
        <span className="net">ELITE<b>SIM</b>SPN</span>
        <span className="tag">Elite Simulated Sports Programming Network</span>
      </header>

      <section className="scoreboard">
        <div className="team home">
          <span className="dot" style={{ background: CARDINALS.color }} />
          {CARDINALS.abbr}
        </div>
        <div className="score">
          {result.score[0]} <span style={{ opacity: 0.4 }}>–</span> {result.score[1]}
        </div>
        <div className="team away">
          {KANGAROOS.abbr}
          <span className="dot" style={{ background: KANGAROOS.color }} />
        </div>
      </section>

      <div className="controls">
        <button onClick={() => setMatchNo((n) => n + 1)}>Next match ▸</button>
        <code>{seedKey}</code>
      </div>

      <ul className="feed">
        {highlights.map((e) => (
          <li key={e.id}>
            <span className="min">{e.minute}&apos;</span> <b>{e.type.toUpperCase()}</b>{' '}
            {e.label ?? ''} <span className="sc">({e.scoreAfter[0]}–{e.scoreAfter[1]})</span>
          </li>
        ))}
        {highlights.length === 0 && <li>A cagey affair — no clear-cut chances.</li>}
      </ul>

      <p className="stats">
        Shots {result.stats.shots[0]}–{result.stats.shots[1]} · xG{' '}
        {result.stats.xg[0].toFixed(2)}–{result.stats.xg[1].toFixed(2)} · Poss{' '}
        {result.stats.possession[0]}%–{result.stats.possession[1]}%
      </p>
    </main>
  )
}
