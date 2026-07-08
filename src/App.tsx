import { useEffect, useState } from 'react'
import type { LeagueState } from './league/types'
import { createLeague } from './league/league'
import { saveLocal, loadLocal } from './league/persistence'
import {
  createRugbyLeague,
  loadRugbyLocal,
  saveRugbyLocal,
  type RugbyLeagueState,
} from './league/rugbyLeague'
import { RUGBY_LEAGUE } from './ratings/rugbyTeams'
import { SoccerTab } from './ui/SoccerTab'
import { RugbyTab } from './ui/RugbyTab'
import { SettingsTab } from './ui/SettingsTab'

const LEAGUE_ID = 'crown-league'
const LEAGUE_NAME = 'Crown League'
const RUGBY_LEAGUE_ID = 'bastion-championships'
type Tab = 'soccer' | 'rugby' | 'settings'

// A fresh random seed each time a league is created, so every new league plays
// out differently. (This is a UI action, not the deterministic sim — a saved
// league stores its seed, so its matches still re-render identically.)
function newSeed(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e9).toString(36)}`
}

export default function App() {
  const [tab, setTab] = useState<Tab>('soccer')
  const [league, setLeague] = useState<LeagueState>(
    () => loadLocal(LEAGUE_ID) ?? createLeague(newSeed('crown'), LEAGUE_NAME, 6, LEAGUE_ID),
  )
  const [rugbyLeague, setRugbyLeague] = useState<RugbyLeagueState>(
    () =>
      loadRugbyLocal(RUGBY_LEAGUE_ID) ??
      createRugbyLeague(newSeed('bastion'), RUGBY_LEAGUE.name, 6, RUGBY_LEAGUE_ID),
  )

  useEffect(() => {
    saveLocal(league)
  }, [league])

  useEffect(() => {
    saveRugbyLocal(rugbyLeague)
  }, [rugbyLeague])

  function resetLeague() {
    if (window.confirm('Start a brand-new league? This clears the current one on this device.')) {
      setLeague(createLeague(newSeed('crown'), LEAGUE_NAME, 6, LEAGUE_ID))
    }
  }

  function resetRugbyLeague() {
    if (window.confirm('Start a brand-new Bastion Championships? This clears the current one on this device.')) {
      setRugbyLeague(createRugbyLeague(newSeed('bastion'), RUGBY_LEAGUE.name, 6, RUGBY_LEAGUE_ID))
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
        <button className={tab === 'soccer' ? 'on' : ''} onClick={() => setTab('soccer')}>
          ⚽ Soccer
        </button>
        <button className={tab === 'rugby' ? 'on' : ''} onClick={() => setTab('rugby')}>
          🏉 Rugby
        </button>
        <button className={tab === 'settings' ? 'on' : ''} onClick={() => setTab('settings')}>
          Settings
        </button>
      </nav>

      {tab === 'soccer' && <SoccerTab league={league} setLeague={setLeague} onReset={resetLeague} />}
      {tab === 'rugby' && (
        <RugbyTab league={rugbyLeague} setLeague={setRugbyLeague} onReset={resetRugbyLeague} />
      )}
      {tab === 'settings' && <SettingsTab state={league} setState={setLeague} />}
    </main>
  )
}
