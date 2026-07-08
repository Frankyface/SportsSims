import { useState } from 'react'
import type { LeagueState } from '../league/types'
import { CLUBS } from '../ratings/teams'
import { leagueLogoUrl, logoUrl } from '../render/logos'
import { buildSoccerClubCards } from '../content/clubCardsPack'
import { LeagueTab } from './LeagueTab'
import { FriendlyTab } from './FriendlyTab'
import { ClubBook } from './ClubBook'

type SoccerView = 'league' | 'friendly' | 'clubs'

/** The Crown League home: the existing soccer League + Friendly, plus the club
 * book (with downloadable Instagram club cards), behind one top-level Soccer tab. */
export function SoccerTab({
  league,
  setLeague,
  onReset,
}: {
  league: LeagueState
  setLeague: (s: LeagueState) => void
  onReset: () => void
}) {
  const [view, setView] = useState<SoccerView>('league')

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

      {view === 'league' && <LeagueTab state={league} setState={setLeague} />}
      {view === 'friendly' && <FriendlyTab />}
      {view === 'clubs' && (
        <ClubBook
          title="Crown League"
          subtitle={`${CLUBS.length} clubs · the ESSPN soccer competition`}
          logoUrl={leagueLogoUrl}
          clubs={CLUBS}
          crestUrl={logoUrl}
          buildCards={buildSoccerClubCards}
        />
      )}

      {view === 'league' && (
        <button className="btn ghost small" onClick={onReset}>
          Reset league
        </button>
      )}
    </div>
  )
}
