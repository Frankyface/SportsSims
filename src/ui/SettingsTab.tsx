import { useState } from 'react'
import type { LeagueState } from '../league/types'
import { type Settings, loadSettings, saveSettings, testConnection, saveToRepo, loadFromRepo } from '../league/persistence'

export function SettingsTab({ state, setState }: { state: LeagueState; setState: (s: LeagueState) => void }) {
  const [s, setS] = useState<Settings>(() => loadSettings() ?? { token: '', owner: '', repo: 'elitesim-data' })
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState(false)

  function persist(next: Settings) {
    setS(next)
    saveSettings(next)
  }

  async function test() {
    setBusy(true)
    setMsg('Testing…')
    const r = await testConnection(s)
    setMsg(r.message)
    setBusy(false)
  }
  async function save() {
    setBusy(true)
    setMsg('Saving to cloud…')
    try {
      await saveToRepo(s, state)
      setMsg('✅ Saved this league to your repo.')
    } catch (e) {
      setMsg('❌ ' + (e instanceof Error ? e.message : String(e)))
    }
    setBusy(false)
  }
  async function load() {
    setBusy(true)
    setMsg('Loading from cloud…')
    try {
      const r = await loadFromRepo(s, state.id)
      if (r) {
        setState(r.state)
        setMsg('✅ Loaded league from your repo.')
      } else {
        setMsg('No saved league found in the repo yet — save one first.')
      }
    } catch (e) {
      setMsg('❌ ' + (e instanceof Error ? e.message : String(e)))
    }
    setBusy(false)
  }

  return (
    <div className="settings">
      <p className="hint">
        Save your league to a GitHub repo so it persists across devices. See <code>help.md</code> (items 2–3) for how to create
        the data repo and the save token.
      </p>
      <label>
        GitHub username
        <input value={s.owner} onChange={(e) => persist({ ...s, owner: e.target.value })} placeholder="your-github-username" />
      </label>
      <label>
        Data repo
        <input value={s.repo} onChange={(e) => persist({ ...s, repo: e.target.value })} placeholder="elitesim-data" />
      </label>
      <label>
        Save token
        <input type="password" value={s.token} onChange={(e) => persist({ ...s, token: e.target.value })} placeholder="github_pat_…" />
      </label>
      <div className="controls">
        <button className="btn ghost" onClick={test} disabled={busy || !s.token || !s.owner}>
          Test connection
        </button>
        <button className="btn" onClick={save} disabled={busy || !s.token || !s.owner}>
          Save to cloud
        </button>
        <button className="btn ghost" onClick={load} disabled={busy || !s.token || !s.owner}>
          Load from cloud
        </button>
      </div>
      {msg && <p className="msg">{msg}</p>}
    </div>
  )
}
