import { useEffect, useMemo, useState } from 'react'
import { simulateMatch } from './sim/simulateMatch'
import { generateLeague } from './ratings/teams'
import { toTeamRating } from './ratings/strength'
import { MatchCanvas } from './ui/MatchCanvas'
import { exportMatchMp4, downloadBlob } from './export/exportMp4'

export default function App() {
  const league = useMemo(() => generateLeague('demo-league', 10), [])
  const [matchNo, setMatchNo] = useState(1)
  const [exporting, setExporting] = useState(0)
  const [exportErr, setExportErr] = useState<string | null>(null)

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

  // Expose a hook so export can be verified programmatically in dev.
  useEffect(() => {
    ;(window as unknown as { __exportCurrent?: () => Promise<Blob> }).__exportCurrent = () => exportMatchMp4(match)
  }, [match])

  async function doExport() {
    setExportErr(null)
    setExporting(0.0001)
    try {
      const blob = await exportMatchMp4(match, (p) => setExporting(Math.max(0.0001, p)))
      downloadBlob(blob, `elitesimspn-${home.identity.abbr}-${away.identity.abbr}.mp4`)
    } catch (e) {
      setExportErr(e instanceof Error ? e.message : String(e))
    } finally {
      setExporting(0)
    }
  }

  const busy = exporting > 0

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
        <button onClick={() => setMatchNo((n) => n + 1)} disabled={busy}>
          Next match ▸
        </button>
        <button onClick={doExport} disabled={busy}>
          {busy ? `Exporting ${Math.round(exporting * 100)}%` : 'Export MP4'}
        </button>
      </div>

      {exportErr && <p className="err">{exportErr}</p>}

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
