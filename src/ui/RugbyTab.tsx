import { useMemo, useState } from 'react'
import { generateRugbyLeague, RUGBY_CLUBS, RUGBY_LEAGUE } from '../ratings/rugbyTeams'
import { toTeamRating } from '../ratings/strength'
import { simulateRugbyMatch } from '../sim/rugbySim'
import { bastionLogoUrl, rugbyLogoUrl } from '../render/rugbyLogos'
import type { RugbyLeagueState } from '../league/rugbyLeague'
import { buildRugbyClubCards } from '../content/clubCardsPack'
import { ClubBook } from './ClubBook'
import { RugbyLeagueTab } from './RugbyLeagueTab'
import { RugbyMatchView } from './RugbyMatchView'

type RugbyView = 'league' | 'friendly' | 'clubs'

/** The Bastion Championships home: League season, one-off Friendlies, and the
 * club book — mirroring the Soccer tab's League/Friendly split. */
export function RugbyTab({
  league,
  setLeague,
  onReset,
}: {
  league: RugbyLeagueState
  setLeague: (s: RugbyLeagueState) => void
  onReset: () => void
}) {
  const [view, setView] = useState<RugbyView>('league')

  return (
    <div>
      <nav className="tabs sub">
        <button className={view === 'league' ? 'on' : ''} onClick={() => setView('league')}>
          League
        </button>
        <button className={view === 'friendly' ? 'on' : ''} onClick={() => setView('friendly')}>
          Friendly
        </button>
        <button className={view === 'clubs' ? 'on' : ''} onClick={() => setView('clubs')}>
          Clubs
        </button>
      </nav>

      {view === 'league' && <RugbyLeagueTab state={league} setState={setLeague} />}
      {view === 'friendly' && <RugbyFriendly />}
      {view === 'clubs' && <RugbyClubBook />}

      {view === 'league' && (
        <button className="btn ghost small" onClick={onReset}>
          Reset league
        </button>
      )}
    </div>
  )
}

/** A one-off rugby match: pick the clubs, and every run is a fresh 80 minutes. */
function RugbyFriendly() {
  const teams = useMemo(() => generateRugbyLeague('rugby-friendly-pool', 6), [])
  const [homeIdx, setHomeIdx] = useState(0)
  const [awayIdx, setAwayIdx] = useState(3)
  // `gen` bumps on every interaction; it feeds the seed so the SAME matchup
  // still plays out differently each time you hit "New match".
  const [gen, setGen] = useState(1)

  const home = teams[homeIdx]
  const away = teams[awayIdx]

  const match = useMemo(
    () =>
      simulateRugbyMatch({
        seedKey: `rugby-friendly:${home.identity.id}:${away.identity.id}:${gen}`,
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
    // UI-side randomness (not the deterministic sim) — pick two distinct clubs
    const i = Math.floor(Math.random() * teams.length)
    let j = Math.floor(Math.random() * (teams.length - 1))
    if (j >= i) j += 1
    setHomeIdx(i)
    setAwayIdx(j)
    setGen((g) => g + 1)
  }

  return (
    <div>
      <p className="hint">
        Pick a matchup, or shuffle — every run is a fresh 80 minutes. Nothing is saved.
      </p>

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

      <RugbyMatchView
        match={match}
        filename={`esspn-rugby-${home.identity.abbr}-${away.identity.abbr}.mp4`}
        playKey={gen}
      />

      <div className="controls">
        <button className="btn" onClick={() => setGen((g) => g + 1)}>
          New match ▸
        </button>
      </div>

      <p className="stats">
        <span style={{ color: home.identity.color }}>{home.identity.name}</span> (
        {Math.round(home.glicko.rating)}) vs{' '}
        <span style={{ color: away.identity.color }}>{away.identity.name}</span> (
        {Math.round(away.glicko.rating)}) · Final {match.score[0]}–{match.score[1]}
      </p>
    </div>
  )
}

/** Read-only club book: the Bastion Championships lineup + downloadable cards. */
function RugbyClubBook() {
  return (
    <ClubBook
      title={RUGBY_LEAGUE.name}
      subtitle={`${RUGBY_CLUBS.length} clubs · the ESSPN rugby competition`}
      logoUrl={bastionLogoUrl}
      clubs={RUGBY_CLUBS}
      crestUrl={rugbyLogoUrl}
      buildCards={buildRugbyClubCards}
    />
  )
}
