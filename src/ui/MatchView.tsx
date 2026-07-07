import { useEffect, useState } from 'react'
import type { MatchResult } from '../sim/types'
import { MatchCanvas } from './MatchCanvas'
import { exportMatchMp4, downloadBlob } from '../export/exportMp4'

/** Canvas preview + one-click MP4 export for a single match. */
export function MatchView({ match, filename, playKey }: { match: MatchResult; filename: string; playKey: number }) {
  const [exporting, setExporting] = useState(0)
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    ;(window as unknown as { __exportCurrent?: () => Promise<Blob> }).__exportCurrent = () => exportMatchMp4(match)
  }, [match])

  async function doExport() {
    setErr(null)
    setExporting(0.0001)
    try {
      const blob = await exportMatchMp4(match, (p) => setExporting(Math.max(0.0001, p)))
      downloadBlob(blob, filename)
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e))
    } finally {
      setExporting(0)
    }
  }

  const busy = exporting > 0
  return (
    <div className="matchView">
      <MatchCanvas match={match} playKey={playKey} />
      <button className="btn" onClick={doExport} disabled={busy}>
        {busy ? `Exporting ${Math.round(exporting * 100)}%` : '⬇ Export Instagram MP4'}
      </button>
      {err && <p className="err">{err}</p>}
    </div>
  )
}
