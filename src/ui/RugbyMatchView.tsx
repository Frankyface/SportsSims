import { useEffect, useRef, useState } from 'react'
import type { RugbyMatchResult } from '../sim/rugbyTypes'
import {
  buildRugbyRenderModel,
  drawRugbyFrame,
  RUGBY_RENDER_W,
  RUGBY_RENDER_H,
} from '../render/rugbyRenderMatch'
import { ensureRugbyLogosLoaded } from '../render/rugbyLogos'
import { exportRugbyMatchMp4 } from '../export/exportRugbyMp4'
import { downloadBlob } from '../export/exportMp4'

/**
 * Looping live preview of a rugby match. The exact same pure
 * drawRugbyFrame(ctx, model, t) that powers the MP4 export drives this canvas —
 * requestAnimationFrame only picks WHICH t to draw, so preview and export stay
 * pixel-identical. Mirrors MatchCanvas (soccer).
 */
function RugbyMatchCanvas({ match, playKey }: { match: RugbyMatchResult; playKey: number }) {
  const ref = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const model = buildRugbyRenderModel(match)
    // fire-and-forget: crests pop in when loaded, colour chips until then
    void ensureRugbyLogosLoaded()
    let raf = 0
    let start: number | null = null
    const loop = (ts: number) => {
      if (start === null) start = ts
      let t = (ts - start) / 1000
      if (t > model.plan.total) {
        start = ts
        t = 0
      }
      drawRugbyFrame(ctx, model, t)
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [match, playKey])

  return <canvas ref={ref} width={RUGBY_RENDER_W} height={RUGBY_RENDER_H} className="matchCanvas" />
}

/** Preview + Instagram MP4 export for a rugby match. Mirrors MatchView (soccer). */
export function RugbyMatchView({
  match,
  filename,
  playKey,
}: {
  match: RugbyMatchResult
  filename: string
  playKey: number
}) {
  const [exporting, setExporting] = useState(0)
  const [error, setError] = useState('')

  useEffect(() => {
    // scripted-export hook for smoke tests — whichever tab is active owns it
    ;(window as unknown as { __exportCurrent?: () => Promise<Blob> }).__exportCurrent = () =>
      exportRugbyMatchMp4(match)
  }, [match])

  const doExport = async (): Promise<void> => {
    setError('')
    setExporting(0.0001)
    try {
      const blob = await exportRugbyMatchMp4(match, (p) => setExporting(Math.max(0.0001, p)))
      downloadBlob(blob, filename)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Export failed.')
    } finally {
      setExporting(0)
    }
  }

  return (
    <div className="matchView">
      <RugbyMatchCanvas match={match} playKey={playKey} />
      <button className="btn" onClick={() => void doExport()} disabled={exporting > 0}>
        {exporting > 0 ? `Exporting ${Math.round(exporting * 100)}%` : '⬇ Export Instagram MP4'}
      </button>
      {error && <p className="err">{error}</p>}
    </div>
  )
}
