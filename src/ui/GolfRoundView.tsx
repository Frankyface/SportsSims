import { useEffect, useRef, useState } from 'react'
import {
  drawGolfFrame,
  GOLF_RENDER_W,
  GOLF_RENDER_H,
  type GolfRenderModel,
} from '../render/golfRenderMatch'
import { ensureFontsLoaded } from '../render/fonts'
import { ensureSgaLogo } from '../render/golfBrand'
import { exportGolfRoundMp4 } from '../export/exportGolfMp4'
import { downloadBlob } from '../export/exportMp4'

/**
 * Looping live preview of a golf round. The exact same pure
 * drawGolfFrame(ctx, model, t) that powers the MP4 export drives this canvas —
 * requestAnimationFrame only picks WHICH t to draw, so preview and export stay
 * pixel-identical. Mirrors RugbyMatchCanvas.
 */
function GolfRoundCanvas({ model, playKey }: { model: GolfRenderModel; playKey: number }) {
  const ref = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    void ensureFontsLoaded()
    void ensureSgaLogo()
    let raf = 0
    let start: number | null = null
    const loop = (ts: number) => {
      if (start === null) start = ts
      let t = (ts - start) / 1000
      if (t > model.plan.total) {
        start = ts
        t = 0
      }
      drawGolfFrame(ctx, model, t)
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [model, playKey])

  return <canvas ref={ref} width={GOLF_RENDER_W} height={GOLF_RENDER_H} className="matchCanvas" />
}

/** Preview + Instagram MP4 export for a golf round. Mirrors RugbyMatchView. */
export function GolfRoundView({
  model,
  filename,
  playKey,
}: {
  model: GolfRenderModel
  filename: string
  playKey: number
}) {
  const [exporting, setExporting] = useState(0)
  const [error, setError] = useState('')

  useEffect(() => {
    // scripted-export hook for smoke tests — whichever tab is active owns it
    ;(window as unknown as { __exportCurrent?: () => Promise<Blob> }).__exportCurrent = () =>
      exportGolfRoundMp4(model)
  }, [model])

  const doExport = async (): Promise<void> => {
    setError('')
    setExporting(0.0001)
    try {
      const blob = await exportGolfRoundMp4(model, (p) => setExporting(Math.max(0.0001, p)))
      downloadBlob(blob, filename)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Export failed.')
    } finally {
      setExporting(0)
    }
  }

  return (
    <div className="matchView">
      <GolfRoundCanvas model={model} playKey={playKey} />
      <button className="btn" onClick={() => void doExport()} disabled={exporting > 0}>
        {exporting > 0 ? `Exporting ${Math.round(exporting * 100)}%` : '⬇ Export Instagram MP4'}
      </button>
      {error && <p className="err">{error}</p>}
    </div>
  )
}
