import { useEffect, useState } from 'react'
import type { LeagueState } from './league/types'
import { createLeague } from './league/league'
import { saveLocal, loadLocal } from './league/persistence'
import { LeagueTab } from './ui/LeagueTab'
import { FriendlyTab } from './ui/FriendlyTab'
import { SettingsTab } from './ui/SettingsTab'

const LEAGUE_ID = 'esspn-league'
const LEAGUE_NAME = 'ESSPN Premier League'
type Tab = 'league' | 'friendly' | 'settings'

export default function App() {
  const [tab, setTab] = useState<Tab>('league')
  const [league, setLeague] = useState<LeagueState>(() => loadLocal(LEAGUE_ID) ?? createLeague(LEAGUE_ID, LEAGUE_NAME))

  useEffect(() => {
    saveLocal(league)
  }, [league])

  function resetLeague() {
    if (window.confirm('Start a brand-new league? This clears the current one on this device.')) {
      setLeague(createLeague(LEAGUE_ID, LEAGUE_NAME))
    }
  }

  return (
    <main className="wrap">
      <header>
        <span className="net">
          E<b>SS</b>PN
        </span>
        <span className="tag">Elite Simulated Sports Programming Network</span>
      </header>

      <nav className="tabs">
        <button className={tab === 'league' ? 'on' : ''} onClick={() => setTab('league')}>
          League
        </button>
        <button className={tab === 'friendly' ? 'on' : ''} onClick={() => setTab('friendly')}>
          Friendly
        </button>
        <button className={tab === 'settings' ? 'on' : ''} onClick={() => setTab('settings')}>
          Settings
        </button>
      </nav>

      {tab === 'league' && <LeagueTab state={league} setState={setLeague} />}
      {tab === 'friendly' && <FriendlyTab />}
      {tab === 'settings' && <SettingsTab state={league} setState={setLeague} />}

      {tab === 'league' && (
        <button className="btn ghost small" onClick={resetLeague}>
          Reset league
        </button>
      )}
    </main>
  )
}
