import { useEffect, useRef, useState } from 'react'
import { zipSync } from 'fflate'
import {
  drawGolfPreviewImage,
  exportGolfPreviewImages,
  PREVIEW_IMAGE_COUNT,
  type GolfPreviewModel,
} from '../render/golfCoursePreview'
import { GOLF_RENDER_W, GOLF_RENDER_H } from '../render/golfRenderMatch'
import { ensureFontsLoaded } from '../render/fonts'
import { ensureSgaLogo } from '../render/golfBrand'
import { ensureEventLogo } from '../render/golfEventLogos'
import { golfPreviewCaption } from '../content/golfCaptions'
import { downloadBlob } from '../export/exportMp4'

const SLIDE_MS = 1900

/**
 * A looping slideshow of the 10 course-preview stills (title card + all 9
 * holes). The same pure drawGolfPreviewImage(ctx, model, index) that the PNG
 * export uses draws each slide, so preview and download stay pixel-identical.
 */
function GolfPreviewSlides({ model, playKey }: { model: GolfPreviewModel; playKey: number }) {
  const ref = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    let idx = 0
    let cancelled = false
    let timer: ReturnType<typeof setTimeout>
    const render = () => drawGolfPreviewImage(ctx, model, idx)
    const tick = () => {
      if (cancelled) return
      idx = (idx + 1) % PREVIEW_IMAGE_COUNT
      render()
      timer = setTimeout(tick, SLIDE_MS)
    }
    render()
    // redraw once the crest + fonts are in (the title card needs them)
    void Promise.all([ensureFontsLoaded(), ensureSgaLogo(), ensureEventLogo(model.event.id)]).then(() => {
      if (!cancelled) render()
    })
    timer = setTimeout(tick, SLIDE_MS)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [model, playKey])

  return <canvas ref={ref} width={GOLF_RENDER_W} height={GOLF_RENDER_H} className="matchCanvas" />
}

/** Slideshow + one-click download of the 10-image course-preview carousel (.zip). */
export function GolfPreviewView({
  model,
  filename,
  playKey,
}: {
  model: GolfPreviewModel
  filename: string
  playKey: number
}) {
  const [exporting, setExporting] = useState(0)
  const [error, setError] = useState('')

  const doDownload = async (): Promise<void> => {
    setError('')
    setExporting(0.0001)
    try {
      const images = await exportGolfPreviewImages(model, (p) => setExporting(Math.max(0.0001, p)))
      const files: Record<string, Uint8Array> = {}
      for (const img of images) {
        files[`${img.name}.png`] = new Uint8Array(await img.blob.arrayBuffer())
      }
      files['caption.txt'] = new TextEncoder().encode(golfPreviewCaption(model.event.id))
      const zip = zipSync(files, { level: 0 }) // PNGs already compressed → store
      downloadBlob(new Blob([zip], { type: 'application/zip' }), filename)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Export failed.')
    } finally {
      setExporting(0)
    }
  }

  return (
    <div className="matchView">
      <GolfPreviewSlides model={model} playKey={playKey} />
      <button className="btn" onClick={() => void doDownload()} disabled={exporting > 0}>
        {exporting > 0
          ? `Exporting ${Math.round(exporting * 100)}%`
          : `⬇ Download ${PREVIEW_IMAGE_COUNT} preview images (.zip)`}
      </button>
      {error && <p className="err">{error}</p>}
    </div>
  )
}
