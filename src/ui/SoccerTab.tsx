import { useState } from 'react'
import type { LeagueState } from '../league/types'
import { LeagueTab } from './LeagueTab'
import { FriendlyTab } from './FriendlyTab'

type SoccerView = 'league' | 'friendly'

/** The Crown League home: the existing soccer League + Friendly, unchanged,
 * behind one top-level Soccer tab. */
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
      </nav>

      {view === 'league' && <LeagueTab state={league} setState={setLeague} />}
      {view === 'friendly' && <FriendlyTab />}

      {view === 'league' && (
        <button className="btn ghost small" onClick={onReset}>
          Reset league
        </button>
      )}
    </div>
  )
}
