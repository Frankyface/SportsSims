import { useEffect, useState } from 'react'
import type { LeagueState } from './league/types'
import { createLeague } from './league/league'
import { saveLocal, loadLocal } from './league/persistence'
import { LeagueTab } from './ui/LeagueTab'
import { FriendlyTab } from './ui/FriendlyTab'
import { RugbyTab } from './ui/RugbyTab'
import { SettingsTab } from './ui/SettingsTab'

const LEAGUE_ID = 'crown-league'
const LEAGUE_NAME = 'Crown League'
type Tab = 'league' | 'friendly' | 'rugby' | 'settings'

// A fresh random seed each time a league is created, so every new league plays
// out differently. (This is a UI action, not the deterministic sim — a saved
// league stores its seed, so its matches still re-render identically.)
function newSeed(): string {
  return `crown-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e9).toString(36)}`
}

export default function App() {
  const [tab, setTab] = useState<Tab>('league')
  const [league, setLeague] = useState<LeagueState>(() => loadLocal(LEAGUE_ID) ?? createLeague(newSeed(), LEAGUE_NAME, 6, LEAGUE_ID))

  useEffect(() => {
    saveLocal(league)
  }, [league])

  function resetLeague() {
    if (window.confirm('Start a brand-new league? This clears the current one on this device.')) {
      setLeague(createLeague(newSeed(), LEAGUE_NAME, 6, LEAGUE_ID))
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
        <button className={tab === 'rugby' ? 'on' : ''} onClick={() => setTab('rugby')}>
          Rugby
        </button>
        <button className={tab === 'settings' ? 'on' : ''} onClick={() => setTab('settings')}>
          Settings
        </button>
      </nav>

      {tab === 'league' && <LeagueTab state={league} setState={setLeague} />}
      {tab === 'friendly' && <FriendlyTab />}
      {tab === 'rugby' && <RugbyTab />}
      {tab === 'settings' && <SettingsTab state={league} setState={setLeague} />}

      {tab === 'league' && (
        <button className="btn ghost small" onClick={resetLeague}>
          Reset league
        </button>
      )}
    </main>
  )
}
